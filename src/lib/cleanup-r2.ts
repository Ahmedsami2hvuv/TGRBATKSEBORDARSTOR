import { ListObjectsV2Command, DeleteObjectsCommand } from "@aws-sdk/client-s3";
import { s3Client, BUCKET_NAME } from "./upload-storage";
import { prisma } from "./prisma";

export async function cleanupOrphanedR2Images() {
  try {
    // 1. جلب كل الملفات من R2
    const listCommand = new ListObjectsV2Command({
      Bucket: BUCKET_NAME,
    });
    const r2Objects = await s3Client.send(listCommand);
    if (!r2Objects.Contents || r2Objects.Contents.length === 0) {
      return { message: "لا توجد ملفات في R2 للتنظيف" };
    }

    const r2Keys = r2Objects.Contents.map(obj => obj.Key).filter(Boolean) as string[];

    // 2. جلب كل الروابط المستخدمة في قاعدة البيانات
    const [
      orders,
      shops,
      customers,
      products,
      categories,
      branches,
      profiles
    ] = await Promise.all([
      prisma.order.findMany({ select: { imageUrl: true, shopDoorPhotoUrl: true, customerDoorPhotoUrl: true, secondCustomerDoorPhotoUrl: true } }),
      prisma.shop.findMany({ select: { photoUrl: true, originalPhotoUrl: true } }),
      prisma.customer.findMany({ select: { customerDoorPhotoUrl: true } }),
      prisma.storeProduct.findMany({ select: { photoUrls: true } }),
      prisma.storeCategory.findMany({ select: { photoUrl: true } }),
      prisma.storeBranch.findMany({ select: { photoUrl: true } }),
      prisma.customerPhoneProfile.findMany({ select: { photoUrl: true } }),
    ]);

    const usedKeys = new Set<string>();

    const addUrl = (url: string | null | undefined) => {
      if (!url) return;
      // استخراج الـ Key من الرابط (نفترض أنه يبدأ بعد /uploads/)
      const parts = url.split("/uploads/");
      if (parts.length > 1) usedKeys.add(parts[parts.length - 1]);
    };

    orders.forEach(o => { addUrl(o.imageUrl); addUrl(o.shopDoorPhotoUrl); addUrl(o.customerDoorPhotoUrl); addUrl(o.secondCustomerDoorPhotoUrl); });
    shops.forEach(s => { addUrl(s.photoUrl); addUrl((s as any).originalPhotoUrl); });
    customers.forEach(c => { addUrl(c.customerDoorPhotoUrl); });
    products.forEach(p => p.photoUrls.forEach(addUrl));
    categories.forEach(c => addUrl(c.photoUrl));
    branches.forEach(b => addUrl(b.photoUrl));
    profiles.forEach(p => addUrl(p.photoUrl));

    // 3. تحديد المفاتيح اليتيمة (موجودة في R2 وليست في DB)
    const orphans = r2Keys.filter(key => !usedKeys.has(key));

    if (orphans.length === 0) {
      return { message: "لا توجد صور يتيمة، كل الصور مستخدمة" };
    }

    // 4. حذف اليتامى
    const deleteCommand = new DeleteObjectsCommand({
      Bucket: BUCKET_NAME,
      Delete: {
        Objects: orphans.map(key => ({ Key: key })),
      },
    });

    await s3Client.send(deleteCommand);

    return {
      message: `تم التنظيف بنجاح`,
      deletedCount: orphans.length,
      deletedKeys: orphans
    };
  } catch (error: any) {
    console.error("Cleanup failed:", error);
    return { error: error.message };
  }
}
