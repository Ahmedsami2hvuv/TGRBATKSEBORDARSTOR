import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { uploadToR2 } from "@/lib/upload-storage";

export async function POST() {
  try {
    const R2_DOMAIN = "pub-2f347893a77443198f121df01053c847.r2.dev";
    const OLD_BASE_URL = "https://tgrbatks-production.up.railway.app";

    // 1. جلب عينة من الزبائن الذين لديهم "أي شيء" في خانة الصورة ولكنه ليس رابط R2
    const customers = await prisma.customerPhoneProfile.findMany({
      where: {
        AND: [
          { photoUrl: { not: { contains: R2_DOMAIN } } },
          { photoUrl: { not: "" } },
          { photoUrl: { not: { contains: "broken_link" } } }
        ]
      },
      take: 20
    });

    if (customers.length === 0) {
      return NextResponse.json({ success: true, synced: 0, done: true, message: "تمت مزامنة جميع الصور!" });
    }

    let successCount = 0;
    let failCount = 0;

    for (const customer of customers) {
      try {
        let targetUrl = customer.photoUrl;

        // إذا كان الرابط نسبياً (يبدأ بـ /)، نحوله لرابط كامل للسيرفر القديم
        if (targetUrl.startsWith("/")) {
          targetUrl = `${OLD_BASE_URL}${targetUrl}`;
        } else if (!targetUrl.startsWith("http")) {
          targetUrl = `${OLD_BASE_URL}/${targetUrl}`;
        }

        const response = await fetch(targetUrl);
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
        console.error(`Error syncing ${customer.phone}:`, err);
        failCount++;
      }
    }

    const remaining = await prisma.customerPhoneProfile.count({
      where: {
        AND: [
          { photoUrl: { not: { contains: R2_DOMAIN } } },
          { photoUrl: { not: "" } },
          { photoUrl: { not: { contains: "broken_link" } } }
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
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
