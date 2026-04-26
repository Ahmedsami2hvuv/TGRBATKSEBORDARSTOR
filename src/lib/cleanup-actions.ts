"use server";

import { prisma } from "@/lib/prisma";

/**
 * تنظيف قاعدة البيانات من الصور المخزنة بصيغة Base64 (النصوص الطويلة)
 * مع الإبقاء على الصور المخزنة كروابط (تبدأ بـ /uploads/)
 */
export async function cleanupBase64Images() {
  console.log("Starting Database Cleanup for Base64 images...");

  // 1. تنظيف المنتجات (StoreProduct)
  // ملاحظة: photoUrls هو مصفوفة نصوص
  const products = await prisma.storeProduct.findMany({
    select: { id: true, photoUrls: true }
  });

  for (const p of products) {
    const filtered = p.photoUrls.filter(url => !url.startsWith("data:image"));
    if (filtered.length !== p.photoUrls.length) {
      await prisma.storeProduct.update({
        where: { id: p.id },
        data: { photoUrls: filtered }
      });
    }
  }

  // 2. تنظيف الطلبات (Order)
  await prisma.order.updateMany({
    where: { imageUrl: { startsWith: "data:image" } },
    data: { imageUrl: null }
  });
  await prisma.order.updateMany({
    where: { shopDoorPhotoUrl: { startsWith: "data:image" } },
    data: { shopDoorPhotoUrl: null }
  });
  await prisma.order.updateMany({
    where: { customerDoorPhotoUrl: { startsWith: "data:image" } },
    data: { customerDoorPhotoUrl: null }
  });
  await prisma.order.updateMany({
    where: { secondCustomerDoorPhotoUrl: { startsWith: "data:image" } },
    data: { secondCustomerDoorPhotoUrl: null }
  });

  // 3. تنظيف المحلات (Shop)
  await prisma.shop.updateMany({
    where: { photoUrl: { startsWith: "data:image" } },
    data: { photoUrl: "" }
  });

  // 4. تنظيف الزبائن (Customer)
  await prisma.customer.updateMany({
    where: { customerDoorPhotoUrl: { startsWith: "data:image" } },
    data: { customerDoorPhotoUrl: null }
  });

  // 5. تنظيف الفروع (StoreBranch)
  await prisma.storeBranch.updateMany({
    where: { photoUrl: { startsWith: "data:image" } },
    data: { photoUrl: "" }
  });

  console.log("Cleanup completed successfully!");
  return { success: true };
}
