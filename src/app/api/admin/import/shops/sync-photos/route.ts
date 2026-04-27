import { NextResponse } from "next/server";
import { Client } from "pg";
import { prisma } from "@/lib/prisma";
import { uploadToR2 } from "@/lib/upload-storage";
import { nanoid } from "nanoid";

const OLD_DB_URL = "postgresql://postgres:jkDcspXZlicvzQvaffZAxBgischujWrX@caboose.proxy.rlwy.net:46307/railway";

function normalizeArabic(text: string): string {
  if (!text) return "";
  return text
    .trim()
    .replace(/[أإآ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/[\u064B-\u0652]/g, "")
    .toLowerCase();
}

async function migrateImage(oldUrl: string | null | undefined): Promise<string> {
  if (!oldUrl || !oldUrl.startsWith("http")) return "";

  // إذا كانت الصورة مسحوبة مسبقاً على R2
  if (oldUrl.includes("r2.dev") || oldUrl.includes("pub-")) return oldUrl;

  try {
    const response = await fetch(oldUrl, {
      signal: AbortSignal.timeout(20000),
      headers: { "User-Agent": "Mozilla/5.0" }
    });
    if (!response.ok) return "";

    const buffer = Buffer.from(await response.arrayBuffer());
    const contentType = response.headers.get("content-type") || "image/jpeg";
    const extension = contentType.split("/")[1]?.split("+")[0] || "jpg";

    const key = `shops/${nanoid(12)}.${extension}`;
    const uploadedKey = await uploadToR2(buffer, key, contentType);

    if (!uploadedKey) return "";

    const publicUrl = (process.env.NEXT_PUBLIC_R2_PUBLIC_URL || "https://pub-8c3866b1d40842a2818641a9675231c5.r2.dev").replace(/\/$/, "");
    return `${publicUrl}/${uploadedKey}`;
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

    // 1. جلب دفعة من المحلات الحالية (بدون فلترة الصور هنا لتجنب خطأ التخطي)
    const localShops = await prisma.shop.findMany({
      orderBy: { id: "asc" },
      skip: offset,
      take: limit,
    });

    if (localShops.length === 0) return NextResponse.json({ success: true, updated: 0, done: true });

    await client.connect();

    // جلب كل المحلات القديمة (بما أنها 334 فقط) في الذاكرة لمرة واحدة للمطابقة السريعة
    const oldRes = await client.query('SELECT name, phone, "photoUrl" FROM "Shop" WHERE "photoUrl" IS NOT NULL AND "photoUrl" LIKE \'http%\'');
    const oldShops = oldRes.rows;

    let updatedCount = 0;
    for (const shop of localShops) {
      // إذا كان المحل يملك صورة R2 بالفعل، نتخطاه
      if (shop.photoUrl && (shop.photoUrl.includes("r2.dev") || shop.photoUrl.includes("pub-"))) continue;

      // البحث عن المحل القديم في القائمة التي جلبناها
      const normalizedLocalName = normalizeArabic(shop.name);
      const oldMatch = oldShops.find(os =>
        normalizeArabic(os.name) === normalizedLocalName ||
        (os.phone && os.phone === shop.phone)
      );

      if (oldMatch && oldMatch.photoUrl) {
        const newUrl = await migrateImage(oldMatch.photoUrl);
        if (newUrl && !newUrl.includes(oldMatch.photoUrl)) {
          await prisma.shop.update({
            where: { id: shop.id },
            data: { photoUrl: newUrl }
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
    return NextResponse.json({ success: false, message: error.message, updated: 0 }, { status: 500 });
  } finally {
    await client.end();
  }
}
