import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { uploadToR2 } from "@/lib/upload-storage";

export async function POST() {
  try {
    const R2_DOMAIN = "pub-2f347893a77443198f121df01053c847.r2.dev";

    // 1. جلب أي سجل صورته ليست على R2 (سواء كانت رابط قديم، أو not_found، أو مسار مكسور)
    const customers = await prisma.customerPhoneProfile.findMany({
      where: {
        AND: [
          { photoUrl: { not: { contains: R2_DOMAIN } } }, // ليست على R2
          { photoUrl: { not: "" } },                     // وليست فارغة تماماً
          { photoUrl: { bnest: null } }                  // وليست نل
        ]
      },
      take: 30, // سحب 30 في كل مرة لزيادة السرعة مع الاستقرار
    });

    if (customers.length === 0) {
      return NextResponse.json({ success: true, synced: 0, done: true, message: "كل الصور الآن موجودة على R2!" });
    }

    let successCount = 0;
    let failCount = 0;

    for (const customer of customers) {
      try {
        let currentUrl = customer.photoUrl || "";

        // إذا كانت "not_found" أو رابط قديم، سنحاول الوصول إليها
        // إذا كان الرابط لا يبدأ بـ http، سنضيف الدومين القديم تلقائياً
        if (currentUrl === "not_found") {
           // محاولة تخمين الرابط الأصلي إذا كان مفقوداً (بناءً على الهاتف)
           // أو يمكن تخطيها إذا لم نرد المجازفة، لكننا هنا سنحاول مع الروابط الموجودة فعلياً
           continue;
        }

        const response = await fetch(currentUrl, { method: 'GET', Buffer: true } as any);

        if (!response.ok) {
          // إذا فشل السيرفر القديم في الرد، نتركها للمحاولة القادمة أو نسمها بـ not_found_final
          console.error(`Link broken for ${customer.phone}: ${currentUrl}`);
          failCount++;
          continue;
        }

        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const contentType = response.headers.get("content-type") || "image/jpeg";

        if (!contentType.includes("image")) {
          throw new Error("Target URL is not an image");
        }

        const ext = contentType.split("/")[1] || "jpg";
        const key = `customers/${customer.phone}-${customer.regionId}.${ext}`;

        const uploadedKey = await uploadToR2(buffer, key, contentType);

        if (uploadedKey) {
          const publicUrl = `https://${R2_DOMAIN}/${uploadedKey}`;

          await prisma.customerPhoneProfile.update({
            where: {
              phone_regionId: {
                phone: customer.phone,
                regionId: customer.regionId,
              },
            },
            data: { photoUrl: publicUrl },
          });
          successCount++;
        } else {
          failCount++;
        }
      } catch (err: any) {
        console.error(`Failed to sync for ${customer.phone}:`, err.message);
        failCount++;
      }
    }

    const remaining = await prisma.customerPhoneProfile.count({
      where: {
        AND: [
          { photoUrl: { not: { contains: R2_DOMAIN } } },
          { photoUrl: { not: "" } }
        ]
      }
    });

    return NextResponse.json({
      success: true,
      synced: successCount,
      failed: failCount,
      remaining: remaining,
      done: remaining === 0
    });
  } catch (error: any) {
    console.error("CRITICAL SYNC ERROR:", error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
