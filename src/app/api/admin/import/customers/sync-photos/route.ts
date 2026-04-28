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

export async function POST() {
  try {
    // جلب الزبائن الذين لديهم صور قديمة (تبدأ بـ http) ولم يتم رفعها بعد لـ R2
    const customers = await prisma.customerPhoneProfile.findMany({
      where: {
        photoUrl: { startsWith: "http" },
        NOT: { photoUrl: { contains: "r2.dev" } }
      },
      take: 50 // معالجة 50 صورة في كل مرة لتجنب التوقف
    });

    let syncedCount = 0;

    for (const customer of customers) {
      try {
        const response = await fetch(customer.photoUrl);
        if (!response.ok) continue;

        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const fileExt = customer.photoUrl.split('.').pop()?.split('?')[0] || "jpg";

        // المسار في R2 داخل مجلد customers
        const fileName = `customers/${customer.id}.${fileExt}`;

        await r2.send(new PutObjectCommand({
          Bucket: BUCKET_NAME,
          Key: fileName,
          Body: buffer,
          ContentType: response.headers.get("content-type") || "image/jpeg",
        }));

        // تحديث الرابط في Supabase ليشير إلى R2 الجديد
        await prisma.customerPhoneProfile.update({
          where: { id: customer.id },
          data: { photoUrl: `${R2_PUBLIC_URL}/${fileName}` }
        });

        syncedCount++;
      } catch (err) {
        console.error(`Failed to sync photo for ${customer.id}:`, err);
      }
    }

    return NextResponse.json({ success: true, syncedCount });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
