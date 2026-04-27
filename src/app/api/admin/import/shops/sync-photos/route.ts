import { NextResponse } from "next/server";
import { Client } from "pg";
import { prisma } from "@/lib/prisma";
import { uploadToR2 } from "@/lib/upload-storage";
import { nanoid } from "nanoid";

const OLD_DB_URL = "postgresql://postgres:jkDcspXZlicvzQvaffZAxBgischujWrX@caboose.proxy.rlwy.net:46307/railway";

// وظيفة لتنظيف النص العربي لزيادة دقة المطابقة
function normalizeArabic(text: string): string {
  if (!text) return "";
  return text
    .trim()
    .replace(/[أإآ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/[\u064B-\u0652]/g, ""); // حذف الحركات
}

async function migrateImage(oldUrl: string | null | undefined): Promise<string> {
  if (!oldUrl || !oldUrl.startsWith("http")) return "";

  // إذا كانت الصورة مسحوبة مسبقاً على R2 الخاص بنا
  if (oldUrl.includes("r2.dev") || oldUrl.includes("pub-")) return oldUrl;

  try {
    const response = await fetch(oldUrl, {
      signal: AbortSignal.timeout(15000),
      headers: { "User-Agent": "Mozilla/5.0" }
    });
    if (!response.ok) return "";

    const buffer = Buffer.from(await response.arrayBuffer());
    const contentType = response.headers.get("content-type") || "image/jpeg";
    const extension = contentType.split("/")[1]?.split("+")[0] || "jpg";

    // المفتاح الفريد في R2
    const key = `shops/${nanoid(12)}.${extension}`;
    const uploadedKey = await uploadToR2(buffer, key, contentType);

    if (!uploadedKey) return "";

    // بناء الرابط النهائي
    const publicUrl = process.env.NEXT_PUBLIC_R2_PUBLIC_URL?.replace(/\/$/, "");
    return publicUrl ? `${publicUrl}/${uploadedKey}` : `https://pub-8c3866b1d40842a2818641a9675231c5.r2.dev/${uploadedKey}`;
  } catch (e) {
    return "";
  }
}

export async function POST(req: Request) {
  const client = new Client({ connectionString: OLD_DB_URL });
  try {
    const body = await req.json();
    const offset = Number(body.offset) || 0;
    const limit = Number(body.limit) || 10;

    // 1. جلب دفعة من المحلات من نظامك "الحالي" التي لا تملك صور R2
    const localShops = await prisma.shop.findMany({
      where: {
        OR: [
          { photoUrl: "" },
          { photoUrl: null as any },
          { photoUrl: { not: { contains: "r2.dev" } } },
          { photoUrl: { not: { contains: "pub-" } } }
        ]
      },
      skip: offset,
      take: limit,
    });

    if (localShops.length === 0) {
      return NextResponse.json({ success: true, updated: 0, done: true });
    }

    await client.connect();
    let updatedCount = 0;

    for (const shop of localShops) {
      // 2. البحث عن هذا المحل في القاعدة القديمة باستخدام الاسم المنظف
      const oldRes = await client.query(`
        SELECT "photoUrl" FROM "Shop"
        WHERE (LOWER(name) = LOWER($1) OR phone = $2)
        AND "photoUrl" IS NOT NULL
        AND "photoUrl" LIKE 'http%'
        LIMIT 1
      `, [shop.name, shop.phone]);

      const oldPhotoUrl = oldRes.rows[0]?.photoUrl;

      if (oldPhotoUrl) {
        const newR2Url = await migrateImage(oldPhotoUrl);
        if (newR2Url && newR2Url !== oldPhotoUrl) {
          await prisma.shop.update({
            where: { id: shop.id },
            data: { photoUrl: newR2Url }
          });
          updatedCount++;
        }
      }
    }

    return NextResponse.json({
      success: true,
      updated: updatedCount,
      done: localShops.length < limit
    });
  } catch (error: any) {
    console.error("Migration Error:", error);
    return NextResponse.json({ success: false, message: error.message, updated: 0 }, { status: 500 });
  } finally {
    await client.end();
  }
}
