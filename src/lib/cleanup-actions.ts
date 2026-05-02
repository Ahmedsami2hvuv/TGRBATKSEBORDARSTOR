"use server";

import { prisma } from "@/lib/prisma";
import { uploadToR2 } from "@/lib/upload-storage";
import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";

function decodeBase64Image(value: string): { buffer: Buffer; contentType: string; ext: string } | null {
  const raw = value.trim();
  if (!raw) return null;

  if (raw.startsWith("data:image")) {
    const parts = raw.split(",", 2);
    if (parts.length < 2) return null;
    const meta = parts[0];
    const payload = parts[1];
    const contentType = (meta.match(/^data:(image\/[a-zA-Z0-9+.-]+);base64$/)?.[1] || "image/jpeg").toLowerCase();
    const ext = contentType.split("/")[1]?.split("+")[0] || "jpg";
    return { buffer: Buffer.from(payload, "base64"), contentType, ext };
  }

  const looksRawBase64 = !raw.startsWith("http") && !raw.startsWith("/") && raw.length > 500;
  if (!looksRawBase64) return null;
  return { buffer: Buffer.from(raw, "base64"), contentType: "image/jpeg", ext: "jpg" };
}

async function fetchImageFromUrl(rawUrl: string): Promise<{ buffer: Buffer; contentType: string; ext: string } | null> {
  if (!rawUrl.startsWith("http")) return null;
  if (rawUrl.includes("/uploads/")) return null;
  if (rawUrl.includes("r2.dev")) return null;
  if (rawUrl.includes("cloudflarestorage.com")) return null;

  try {
    const res = await fetch(rawUrl, { signal: AbortSignal.timeout(20000) });
    if (!res.ok) return null;
    const contentType = (res.headers.get("content-type") || "image/jpeg").toLowerCase();
    const ext = contentType.split("/")[1]?.split("+")[0] || "jpg";
    const buffer = Buffer.from(await res.arrayBuffer());
    return { buffer, contentType, ext };
  } catch {
    return null;
  }
}

export async function migrateBase64ImagesToR2() {
  let totalMigrated = 0;
  let totalFailed = 0;
  let totalScanned = 0;

  try {
    const profiles = await prisma.customerPhoneProfile.findMany({
      where: {
        OR: [
          { photoUrl: { startsWith: "data:image" } },
          { photoUrl: { contains: "base64" } },
          { photoUrl: { startsWith: "http" } },
        ],
      },
      select: { id: true, photoUrl: true },
      take: 300,
    });

    totalScanned = profiles.length;

    for (const row of profiles) {
      const raw = row.photoUrl || "";
      const parsed = decodeBase64Image(raw) || await fetchImageFromUrl(raw);
      if (!parsed) continue;

      const key = `profiles/${row.id}-${randomUUID()}.${parsed.ext}`;
      const uploadedKey = await uploadToR2(parsed.buffer, key, parsed.contentType);
      if (!uploadedKey) {
        totalFailed++;
        continue;
      }

      await prisma.customerPhoneProfile.update({
        where: { id: row.id },
        data: { photoUrl: `/uploads/${uploadedKey}` },
      });
      totalMigrated++;
    }

    revalidatePath("/admin/customers");
    revalidatePath("/admin/customers/profiles");

    return {
      success: true,
      scanned: totalScanned,
      migrated: totalMigrated,
      failed: totalFailed,
      message: `تم تحويل ${totalMigrated} صورة إلى R2 بنجاح.`,
    };
  } catch (error) {
    console.error("migrateBase64ImagesToR2 error:", error);
    return { success: false, scanned: totalScanned, migrated: totalMigrated, failed: totalFailed, message: "فشل تحويل الصور إلى R2." };
  }
}

/**
 * تنظيف شامل وقوي لقاعدة البيانات من الصور المخزنة بصيغة Base64
 * يشمل الأقسام، ملفات التعريف، والطلبات
 */
export async function cleanupBase64Images() {
  console.log("Starting Deep Database Cleanup...");

  try {
    // 1. الأقسام (StoreCategory)
    // نبحث عن أي رابط يبدأ بـ data:image أو يحتوي على base64
    await prisma.storeCategory.updateMany({
      where: {
        OR: [
          { photoUrl: { contains: "base64" } },
          { photoUrl: { startsWith: "data:image" } }
        ]
      },
      data: { photoUrl: "" }
    });

    // 2. ملفات تعريف هاتف الزبون (CustomerPhoneProfile) - هذي اللي فيها صور الأبواب غالباً
    await prisma.customerPhoneProfile.updateMany({
      where: {
        OR: [
          { photoUrl: { contains: "base64" } },
          { photoUrl: { startsWith: "data:image" } }
        ]
      },
      data: { photoUrl: "" }
    });

    // 3. الطلبات (Order) - صور الأبواب في الطلبات الفردية
    const orderFields = ["imageUrl", "shopDoorPhotoUrl", "customerDoorPhotoUrl", "secondCustomerDoorPhotoUrl"];
    for (const field of orderFields) {
      await (prisma.order as any).updateMany({
        where: {
          OR: [
            { [field]: { contains: "base64" } },
            { [field]: { startsWith: "data:image" } }
          ]
        },
        data: { [field]: null }
      });
    }

    // 4. المنتجات (StoreProduct) - مصفوفة نصوص
    const products = await prisma.storeProduct.findMany({
      where: {
        photoUrls: { hasSome: ["base64"] } // هذا فلتر تقريبي لأن Prisma لا تدعم contains داخل المصفوفة بسهولة
      },
      select: { id: true, photoUrls: true }
    });

    // حل بديل للمنتجات: جلب الكل وفلترتهم برمجياً لضمان الدقة
    const allProductsWithImages = await prisma.storeProduct.findMany({
      where: { photoUrls: { isEmpty: false } },
      select: { id: true, photoUrls: true }
    });

    for (const p of allProductsWithImages) {
      const filtered = p.photoUrls.filter(url =>
        !url.includes("base64") && !url.startsWith("data:image")
      );
      if (filtered.length !== p.photoUrls.length) {
        await prisma.storeProduct.update({
          where: { id: p.id },
          data: { photoUrls: filtered }
        });
      }
    }

    // 5. الزبائن (Customer)
    await prisma.customer.updateMany({
      where: {
        OR: [
          { customerDoorPhotoUrl: { contains: "base64" } },
          { customerDoorPhotoUrl: { startsWith: "data:image" } }
        ]
      },
      data: { customerDoorPhotoUrl: null }
    });

    // 6. المحلات (Shop) والفروع (StoreBranch)
    await prisma.shop.updateMany({
      where: { OR: [{ photoUrl: { contains: "base64" } }, { photoUrl: { startsWith: "data:image" } }] },
      data: { photoUrl: "" }
    });

    await prisma.storeBranch.updateMany({
      where: { OR: [{ photoUrl: { contains: "base64" } }, { photoUrl: { startsWith: "data:image" } }] },
      data: { photoUrl: "" }
    });

    console.log("Deep Cleanup completed successfully!");
    return { success: true, message: "تم تنظيف كافة الجداول بنجاح بما في ذلك الأقسام وصور الأبواب." };
  } catch (error) {
    console.error("Cleanup Error:", error);
    return { success: false, message: "حدث خطأ أثناء التنظيف." };
  }
}
