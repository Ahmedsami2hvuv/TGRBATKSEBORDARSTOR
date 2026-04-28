import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { uploadToR2 } from "@/lib/upload-storage";

export async function POST() {
  try {
    const R2_DOMAIN = "pub-2f347893a77443198f121df01053c847.r2.dev";
    const OLD_BASE_URL = "https://tgrbatks-production.up.railway.app";

    // جلب الزبائن الذين لا يزالون يملكون روابط قديمة أو روابط Base64 طويلة
    const customers = await prisma.customerPhoneProfile.findMany({
      where: {
        AND: [
          { photoUrl: { not: { contains: R2_DOMAIN } } },
          { photoUrl: { not: "" } },
          { photoUrl: { not: { contains: "broken_link" } } }
        ]
      },
      take: 15 // نعالج 15 في كل مرة لضمان عدم تجاوز الذاكرة
    });

    if (customers.length === 0) {
      return NextResponse.json({ success: true, synced: 0, done: true, message: "تمت المزامنة بنجاح!" });
    }

    let successCount = 0;
    let failCount = 0;

    for (const customer of customers) {
      try {
        let buffer: Buffer;
        let contentType: string;
        let ext: string;

        // الحالة الأولى: الصورة هي Base64 (تبدأ بـ data:image)
        if (customer.photoUrl.startsWith("data:image")) {
          const base64Data = customer.photoUrl.split(",")[1];
          contentType = customer.photoUrl.split(";")[0].split(":")[1] || "image/jpeg";
          ext = contentType.split("/")[1] || "jpg";
          buffer = Buffer.from(base64Data, 'base64');
        }
        // الحالة الثانية: رابط عادي (URL)
        else {
          let targetUrl = customer.photoUrl;
          if (targetUrl.startsWith("/")) targetUrl = `${OLD_BASE_URL}${targetUrl}`;
          else if (!targetUrl.startsWith("http")) targetUrl = `${OLD_BASE_URL}/${targetUrl}`;

          const response = await fetch(targetUrl);
          if (!response.ok) throw new Error("Failed to fetch");

          const arrayBuffer = await response.arrayBuffer();
          buffer = Buffer.from(arrayBuffer);
          contentType = response.headers.get("content-type") || "image/jpeg";
          ext = contentType.split("/")[1] || "jpg";
        }

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
        console.error(`Error for ${customer.phone}:`, err);
        // وسم الروابط العملاقة المعطلة لكي لا تسبب تعليق للنظام
        if (customer.photoUrl.length > 2000) {
           await prisma.customerPhoneProfile.update({
             where: { id: customer.id },
             data: { photoUrl: "broken_base64" }
           });
        }
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

    return NextResponse.json({ success: true, synced: successCount, failed: failCount, remaining });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
