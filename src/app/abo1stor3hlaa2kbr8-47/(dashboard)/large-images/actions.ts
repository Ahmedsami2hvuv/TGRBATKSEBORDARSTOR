"use server";

import { deleteFromR2, getR2ObjectBuffer, uploadToR2, getS3Client, BUCKET_NAME } from "@/lib/upload-storage";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import sharp from "sharp";

const SECRET_ADMIN_PATH = "/abo1stor3hlaa2kbr8-47";

/**
 * يقوم بتحميل الصورة من R2 وضغطها بنسبة 96% ثم إعادة رفعها بنفس المفتاح لتحديث الحجم دون تخريب الروابط.
 */
export async function compressR2ImageAction(key: string) {
  try {
    const buffer = await getR2ObjectBuffer(key);
    if (!buffer) {
      return { ok: false, error: "تعذر قراءة الصورة من R2" };
    }

    // تقليص أبعاد الصورة لـ 1200 بكسل كحد أقصى للضلع وضغط الجودة
    const pipeline = sharp(buffer)
      .rotate() // الحفاظ على اتجاه الصورة الصحيح
      .resize({
        width: 1200,
        height: 1200,
        fit: "inside",
        withoutEnlargement: true,
      });

    let contentType = "image/jpeg";
    let compressedBuffer: Buffer;
    
    if (key.toLowerCase().endsWith(".png")) {
      compressedBuffer = await pipeline.png({ palette: true, compressionLevel: 6 }).toBuffer();
      contentType = "image/png";
    } else if (key.toLowerCase().endsWith(".webp")) {
      compressedBuffer = await pipeline.webp({ quality: 75 }).toBuffer();
      contentType = "image/webp";
    } else {
      compressedBuffer = await pipeline.jpeg({ quality: 75 }).toBuffer();
      contentType = "image/jpeg";
    }

    const uploadedKey = await uploadToR2(compressedBuffer, key, contentType, true);
    if (!uploadedKey) {
      return { ok: false, error: "تعذر إعادة رفع الصورة المصغرة" };
    }

    return { ok: true };
  } catch (e: any) {
    console.error("Image compression failed:", e);
    return { ok: false, error: `فشل تقليص الصورة: ${e.message || e}` };
  }
}

/**
 * حذف الصورة بالكامل من R2
 */
export async function deleteR2ImageAction(key: string) {
  try {
    await deleteFromR2(key);
    revalidatePath(`${SECRET_ADMIN_PATH}/large-images`);
    return { ok: true };
  } catch (e: any) {
    console.error("Failed to delete object from R2:", e);
    return { ok: false, error: "فشل حذف الصورة من R2" };
  }
}

/**
 * جلب الدفعة التالية من الصور الكبيرة (أكبر 100 صورة متبقية) مع استخداماتها
 */
export async function fetchNextLargeImagesAction() {
  try {
    const s3Client = await getS3Client();
    if (!s3Client || !BUCKET_NAME) {
      return { ok: false, error: "إعدادات R2 غير متوفرة" };
    }

    const { ListObjectsV2Command } = await import("@aws-sdk/client-s3");
    let isTruncated = true;
    let continuationToken: string | undefined = undefined;
    const contents: any[] = [];

    while (isTruncated) {
      const listCommand = new ListObjectsV2Command({
        Bucket: BUCKET_NAME,
        ContinuationToken: continuationToken,
      });
      const r2Objects = await s3Client.send(listCommand);
      if (r2Objects.Contents) {
        contents.push(...r2Objects.Contents);
      }
      isTruncated = !!r2Objects.IsTruncated;
      continuationToken = r2Objects.NextContinuationToken;
    }

    let allLargeObjects: {
      key: string;
      sizeKb: number;
      sizeMb: string;
      size: number;
      lastModified?: Date;
    }[] = [];

    contents.forEach(obj => {
      const size = obj.Size ?? 0;
      if (size > 500 * 1024) {
        const key = obj.Key ?? "";
        const sizeKb = Math.round(size / 1024);
        const sizeMb = (size / (1024 * 1024)).toFixed(2);

        allLargeObjects.push({
          key,
          sizeKb,
          sizeMb,
          size,
          lastModified: obj.LastModified,
        });
      }
    });

    // ترتيب تنازلي حسب الحجم لاختيار الأكبر أولاً
    allLargeObjects.sort((a, b) => b.size - a.size);

    // اختيار أكبر 100 صورة فقط للاستعلام عن استخداماتها
    const itemsToDisplay = allLargeObjects.slice(0, 100);
    const largeKeys = itemsToDisplay.map(item => item.key);

    const usageMap = new Map<string, string[]>();
    const addUsage = (url: string | null | undefined, description: string) => {
      if (!url) return;
      const trimmed = url.trim();
      const parts = trimmed.split("/uploads/");
      const key = parts.length > 1 ? parts[parts.length - 1] : trimmed;
      if (!usageMap.has(key)) usageMap.set(key, []);
      usageMap.get(key)!.push(description);
    };

    if (largeKeys.length > 0) {
      const searchUrls = largeKeys.flatMap(key => [
        key,
        `/uploads/${key}`,
        `https://aboakbr.com/uploads/${key}`
      ]);

      // الاستعلامات تتم بشكل تسلسلي لتجنب إجهاد قاعدة البيانات واستنفاد pool الاتصالات
      const orders = await prisma.order.findMany({
        where: {
          OR: [
            { imageUrl: { in: searchUrls } },
            { shopDoorPhotoUrl: { in: searchUrls } },
            { customerDoorPhotoUrl: { in: searchUrls } },
            { secondCustomerDoorPhotoUrl: { in: searchUrls } }
          ]
        },
        select: { id: true, imageUrl: true, shopDoorPhotoUrl: true, customerDoorPhotoUrl: true, secondCustomerDoorPhotoUrl: true }
      });

      const shops = await prisma.shop.findMany({
        where: { photoUrl: { in: searchUrls } },
        select: { name: true, photoUrl: true }
      });

      const customers = await prisma.customer.findMany({
        where: { customerDoorPhotoUrl: { in: searchUrls } },
        select: { name: true, customerDoorPhotoUrl: true }
      });

      const products = await prisma.storeProduct.findMany({
        where: { photoUrls: { hasSome: searchUrls } },
        select: { name: true, photoUrls: true }
      });

      const categories = await prisma.storeCategory.findMany({
        where: { photoUrl: { in: searchUrls } },
        select: { name: true, photoUrl: true }
      });

      const branches = await prisma.storeBranch.findMany({
        where: { photoUrl: { in: searchUrls } },
        select: { name: true, photoUrl: true }
      });

      const profiles = await prisma.customerPhoneProfile.findMany({
        where: { photoUrl: { in: searchUrls } },
        select: { phone: true, photoUrl: true }
      });

      orders.forEach(o => {
        addUsage(o.imageUrl, `طلب #${o.id}`);
        addUsage(o.shopDoorPhotoUrl, `باب محل لطلب #${o.id}`);
        addUsage(o.customerDoorPhotoUrl, `باب زبون لطلب #${o.id}`);
        addUsage(o.secondCustomerDoorPhotoUrl, `باب زبون ثاني لطلب #${o.id}`);
      });
      shops.forEach(s => addUsage(s.photoUrl, `محل: ${s.name}`));
      customers.forEach(c => addUsage(c.customerDoorPhotoUrl, `زبون: ${c.name}`));
      products.forEach(p => p.photoUrls.forEach(url => addUsage(url, `منتج: ${p.name}`)));
      categories.forEach(c => addUsage(c.photoUrl, `قسم: ${c.name}`));
      branches.forEach(b => addUsage(b.photoUrl, `فرع: ${b.name}`));
      profiles.forEach(p => addUsage(p.photoUrl, `بروفايل زبون: ${p.phone}`));
    }

    const largeObjects = itemsToDisplay.map(obj => {
      const usages = usageMap.get(obj.key) || [];
      return {
        key: obj.key,
        sizeKb: obj.sizeKb,
        sizeMb: obj.sizeMb,
        size: obj.size,
        lastModified: obj.lastModified,
        usages: usages.length > 0 ? usages : ["صورة يتيمة / غير مستخدمة 🗑️"],
        url: `/uploads/${obj.key}`,
      };
    });

    return { ok: true, objects: largeObjects, totalCount: allLargeObjects.length };
  } catch (error: any) {
    console.error("Failed to fetch next large images:", error);
    return { ok: false, error: error.message || "حدث خطأ أثناء جلب الدفعة التالية" };
  }
}

/**
 * جلب استخدامات قائمة معينة من مفاتيح الصور (100 كحد أقصى) من قاعدة البيانات
 */
export async function fetchImagesUsagesAction(keys: string[]) {
  try {
    const usageMap: { [key: string]: string[] } = {};
    const addUsage = (url: string | null | undefined, description: string) => {
      if (!url) return;
      const trimmed = url.trim();
      const parts = trimmed.split("/uploads/");
      const key = parts.length > 1 ? parts[parts.length - 1] : trimmed;
      if (!usageMap[key]) usageMap[key] = [];
      usageMap[key].push(description);
    };

    if (keys.length > 0) {
      const searchUrls = keys.flatMap(key => [
        key,
        `/uploads/${key}`,
        `https://aboakbr.com/uploads/${key}`
      ]);

      // الاستعلامات تتم بشكل تسلسلي لتجنب إجهاد قاعدة البيانات واستنفاد pool الاتصالات
      const orders = await prisma.order.findMany({
        where: {
          OR: [
            { imageUrl: { in: searchUrls } },
            { shopDoorPhotoUrl: { in: searchUrls } },
            { customerDoorPhotoUrl: { in: searchUrls } },
            { secondCustomerDoorPhotoUrl: { in: searchUrls } }
          ]
        },
        select: { id: true, imageUrl: true, shopDoorPhotoUrl: true, customerDoorPhotoUrl: true, secondCustomerDoorPhotoUrl: true }
      });

      const shops = await prisma.shop.findMany({
        where: { photoUrl: { in: searchUrls } },
        select: { name: true, photoUrl: true }
      });

      const customers = await prisma.customer.findMany({
        where: { customerDoorPhotoUrl: { in: searchUrls } },
        select: { name: true, customerDoorPhotoUrl: true }
      });

      const products = await prisma.storeProduct.findMany({
        where: { photoUrls: { hasSome: searchUrls } },
        select: { name: true, photoUrls: true }
      });

      const categories = await prisma.storeCategory.findMany({
        where: { photoUrl: { in: searchUrls } },
        select: { name: true, photoUrl: true }
      });

      const branches = await prisma.storeBranch.findMany({
        where: { photoUrl: { in: searchUrls } },
        select: { name: true, photoUrl: true }
      });

      const profiles = await prisma.customerPhoneProfile.findMany({
        where: { photoUrl: { in: searchUrls } },
        select: { phone: true, photoUrl: true }
      });

      orders.forEach(o => {
        addUsage(o.imageUrl, `طلب #${o.id}`);
        addUsage(o.shopDoorPhotoUrl, `باب محل لطلب #${o.id}`);
        addUsage(o.customerDoorPhotoUrl, `باب زبون لطلب #${o.id}`);
        addUsage(o.secondCustomerDoorPhotoUrl, `باب زبون ثاني لطلب #${o.id}`);
      });
      shops.forEach(s => addUsage(s.photoUrl, `محل: ${s.name}`));
      customers.forEach(c => addUsage(c.customerDoorPhotoUrl, `زبون: ${c.name}`));
      products.forEach(p => p.photoUrls.forEach(url => addUsage(url, `منتج: ${p.name}`)));
      categories.forEach(c => addUsage(c.photoUrl, `قسم: ${c.name}`));
      branches.forEach(b => addUsage(b.photoUrl, `فرع: ${b.name}`));
      profiles.forEach(p => addUsage(p.photoUrl, `بروفايل زبون: ${p.phone}`));
    }

    return { ok: true, usages: usageMap };
  } catch (error: any) {
    console.error("Failed to fetch image usages:", error);
    return { ok: false, error: error.message || "فشل جلب استخدامات الصور الكبيرة" };
  }
}
