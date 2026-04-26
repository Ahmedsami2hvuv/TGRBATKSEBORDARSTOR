"use server";

import { prisma } from "@/lib/prisma";

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
