"use server";

import { prisma } from "@/lib/prisma";
import { uploadToR2 } from "@/lib/upload-storage";
import { nanoid } from "nanoid";
import { revalidatePath } from "next/cache";

const R2_PUBLIC_URL = process.env.NEXT_PUBLIC_R2_PUBLIC_URL || "";

export async function syncCustomerImages() {
  try {
    // جلب الزبائن الذين لديهم صور قديمة (تبدأ بـ http ولا تنتمي لـ R2)
    const customersWithOldImages = await prisma.customer.findMany({
      where: {
        customerDoorPhotoUrl: {
          contains: "http",
          not: { contains: "r2.dev" }
        }
      },
      take: 50 // معالجة 50 صورة في كل دفعة
    });

    if (customersWithOldImages.length === 0) {
      return { success: true, count: 0, message: "تم تأمين جميع الصور بنجاح!" };
    }

    let syncedCount = 0;

    for (const customer of customersWithOldImages) {
      const oldUrl = customer.customerDoorPhotoUrl;
      if (!oldUrl) continue;

      try {
        const response = await fetch(oldUrl);
        if (!response.ok) continue;

        const buffer = Buffer.from(await response.arrayBuffer());
        const contentType = response.headers.get("content-type") || "image/jpeg";
        const extension = contentType.split("/")[1] || "jpg";
        const key = `customers/door_${customer.id}_${nanoid(5)}.${extension}`;

        const uploadedKey = await uploadToR2(buffer, key, contentType);
        if (uploadedKey) {
          const newUrl = `${R2_PUBLIC_URL}/${uploadedKey}`;
          await prisma.customer.update({
            where: { id: customer.id },
            data: { customerDoorPhotoUrl: newUrl }
          });
          syncedCount++;
        }
      } catch (err) {
        console.error(`Failed to sync image for customer ${customer.id}:`, err);
      }
    }

    revalidatePath("/admin/customers");
    return {
      success: true,
      count: syncedCount,
      remaining: customersWithOldImages.length - syncedCount,
      message: `تم تأمين ${syncedCount} صورة بنجاح.`
    };
  } catch (error: any) {
    return { success: false, message: error.message };
  }
}
