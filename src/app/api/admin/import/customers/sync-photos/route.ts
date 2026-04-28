import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

// إعداد Cloudflare R2
const r2 = new S3Client({
  region: "auto",
  endpoint: `https://b28d5df4bbe98bc845341bc88ff9cb13.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: "770f37021798363683a45218d6e326c7",
    secretAccessKey: "8472465d6487e65155f9f6e696235b848039860b73e514101e18981f95180f2d",
  },
});

const BUCKET_NAME = "kseb-storage";
const R2_PUBLIC_URL = "https://pub-2f7b4947937d4575971a8f949826a575.r2.dev";
const OLD_BASE_URL = "https://kseb-order-production.up.railway.app";

export async function POST() {
  try {
    // 1. جلب عينة من الصور التي لم تُرفع بعد
    const customers = await prisma.customerPhoneProfile.findMany({
      where: {
        photoUrl: {
          notIn: ["", "not_found", "null"],
          not: { contains: "r2.dev" }
        }
      },
      take: 15 // تقليل العدد لزيادة السرعة والاستقرار في كل طلب
    });

    // 2. حساب المجموع الكلي للصور المتبقية للعرض في العداد
    const remaining = await prisma.customerPhoneProfile.count({
      where: {
        photoUrl: {
          notIn: ["", "not_found", "null"],
          not: { contains: "r2.dev" }
        }
      }
    });

    if (customers.length === 0) {
      return NextResponse.json({ success: true, syncedCount: 0, remaining: 0, done: true });
    }

    let syncedCount = 0;

    for (const customer of customers) {
      try {
        let finalUrl = customer.photoUrl;

        // تصحيح الرابط إذا كان مساراً داخلياً
        if (finalUrl && !finalUrl.startsWith("http")) {
          finalUrl = `${OLD_BASE_URL}${finalUrl.startsWith("/") ? "" : "/"}${finalUrl}`;
        }

        const imgRes = await fetch(finalUrl);

        if (!imgRes.ok) {
          console.log(`Image not found: ${finalUrl}`);
          // وسم الصورة بأنها غير موجودة لكي لا يحاول النظام سحبها مجدداً
          await prisma.customerPhoneProfile.update({
            where: { id: customer.id },
            data: { photoUrl: "not_found" }
          });
          continue;
        }

        const arrayBuffer = await imgRes.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        // استخراج الامتداد
        const fileExt = finalUrl.split('.').pop()?.split('?')[0] || "jpg";
        const fileName = `customers/${customer.id}_${Date.now()}.${fileExt}`;

        // الرفع إلى R2
        await r2.send(new PutObjectCommand({
          Bucket: BUCKET_NAME,
          Key: fileName,
          Body: buffer,
          ContentType: imgRes.headers.get("content-type") || "image/jpeg",
        }));

        // تحديث الرابط في قاعدة البيانات
        await prisma.customerPhoneProfile.update({
          where: { id: customer.id },
          data: { photoUrl: `${R2_PUBLIC_URL}/${fileName}` }
        });

        syncedCount++;
      } catch (err) {
        console.error(`Error syncing customer ${customer.id}:`, err);
      }
    }

    return NextResponse.json({
      success: true,
      syncedCount,
      remaining,
      done: remaining <= syncedCount
    });

  } catch (error: any) {
    console.error("CRITICAL SYNC ERROR:", error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
