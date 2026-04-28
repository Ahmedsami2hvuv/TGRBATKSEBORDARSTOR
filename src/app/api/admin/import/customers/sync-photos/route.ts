import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { uploadToR2 } from "@/lib/upload-storage";

export async function POST() {
  try {
    const R2_DOMAIN = "pub-2f347893a77443198f121df01053c847.r2.dev";

    // جلب كل من لديه رابط صورة يحتاج تحديث
    // سنقوم بجلب عينة وفلترتها برمجياً لضمان عدم حدوث خطأ في استعلام Prisma
    const allCandidates = await prisma.customerPhoneProfile.findMany({
      where: {
        photoUrl: {
          not: "",
        }
      },
      take: 100 // نأخذ عينة كبيرة ونفلترها
    });

    // نختار فقط الذين لديهم روابط قديمة (تبدأ بـ http ولا تحتوي على الدومين الجديد)
    const customers = allCandidates.filter(c =>
      c.photoUrl &&
      c.photoUrl.includes("railway.app") &&
      !c.photoUrl.includes(R2_DOMAIN)
    ).slice(0, 15); // نعالج 15 فقط في هذه الدفعة

    if (customers.length === 0) {
      return NextResponse.json({
        success: true,
        synced: 0,
        done: true,
        message: "لم يتم العثور على صور تحتاج مزامنة (ربما اكتملت العملية أو الروابط غير مدعومة)"
      });
    }

    let successCount = 0;
    let failCount = 0;

    for (const customer of customers) {
      try {
        const response = await fetch(customer.photoUrl);
        if (!response.ok) {
           // وسم الرابط كمعطل لكي لا نختاره مرة أخرى
           await prisma.customerPhoneProfile.update({
             where: { id: customer.id },
             data: { photoUrl: "broken_link_" + customer.photoUrl }
           });
           failCount++;
           continue;
        }

        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const contentType = response.headers.get("content-type") || "image/jpeg";
        const ext = contentType.split("/")[1] || "jpg";

        const key = `customers/${customer.phone}-${customer.regionId}.${ext}`;
        const uploadedKey = await uploadToR2(buffer, key, contentType);

        if (uploadedKey) {
          const publicUrl = `https://${R2_DOMAIN}/${uploadedKey}`;
          await prisma.customerPhoneProfile.update({
            where: { id: customer.id },
            data: { photoUrl: publicUrl },
          });
          successCount++;
        }
      } catch (err) {
        failCount++;
      }
    }

    // حساب المتبقي
    const totalRemaining = await prisma.customerPhoneProfile.count({
      where: {
        photoUrl: {
          contains: "railway.app"
        }
      }
    });

    return NextResponse.json({
      success: true,
      synced: successCount,
      failed: failCount,
      remaining: totalRemaining,
      done: totalRemaining === 0
    });
  } catch (error: any) {
    console.error("SYNC ERROR:", error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
