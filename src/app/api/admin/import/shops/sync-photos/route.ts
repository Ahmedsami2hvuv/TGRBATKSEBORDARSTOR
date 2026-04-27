import { NextResponse } from "next/server";
import { Client } from "pg";
import { prisma } from "@/lib/prisma";
import { uploadToR2 } from "@/lib/upload-storage";
import { nanoid } from "nanoid";

const OLD_DB_URL = "postgresql://postgres:jkDcspXZlicvzQvaffZAxBgischujWrX@caboose.proxy.rlwy.net:46307/railway";

function normalize(text: string): string {
  if (!text) return "";
  return text.trim()
    .replace(/[أإآ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .toLowerCase();
}

async function migrateImage(oldUrl: string | null | undefined): Promise<string> {
  if (!oldUrl || !oldUrl.startsWith("http")) return "";
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

    const publicUrl = process.env.NEXT_PUBLIC_R2_PUBLIC_URL?.replace(/\/$/, "") || "https://pub-8c3866b1d40842a2818641a9675231c5.r2.dev";
    return `${publicUrl}/${uploadedKey}`;
  } catch (e) { return ""; }
}

export async function POST(req: Request) {
  const client = new Client({ connectionString: OLD_DB_URL });
  try {
    const { offset = 0, limit = 10 } = await req.json();

    // 1. إنشاء المجلد في R2 فوراً (رفع ملف وهمي)
    if (offset === 0) {
      await uploadToR2(Buffer.from("kse-shops-folder"), "shops/.directory_init", "text/plain");
    }

    await client.connect();

    // 2. جلب البيانات القديمة (نحتاج الصور فقط)
    const oldRes = await client.query(`
      SELECT name, phone, "photoUrl", "locationUrl"
      FROM "Shop"
      WHERE "photoUrl" IS NOT NULL AND "photoUrl" LIKE 'http%'
    `);
    const oldShops = oldRes.rows;

    // 3. جلب المحلات الحالية التي ليس لها صورة R2
    const localShops = await prisma.shop.findMany({
      orderBy: { id: "asc" },
      skip: offset,
      take: limit,
    });

    let updatedCount = 0;
    for (const shop of localShops) {
      // تخطي إذا كان لديه صورة R2 بالفعل
      if (shop.photoUrl && (shop.photoUrl.includes("r2.dev") || shop.photoUrl.includes("pub-") || shop.photoUrl.startsWith("shops/"))) continue;

      const normName = normalize(shop.name);

      // مطابقة مرنة جداً
      const match = oldShops.find(os =>
        normalize(os.name) === normName ||
        (os.phone && os.phone === shop.phone)
      );

      if (match && match.photoUrl) {
        const newUrl = await migrateImage(match.photoUrl);
        if (newUrl) {
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
      updated: Number(updatedCount) || 0,
      done: localShops.length < limit,
      totalOldWithPhotos: oldShops.length
    });
  } catch (error: any) {
    console.error("Sync Error:", error);
    return NextResponse.json({ success: false, message: error.message, updated: 0 }, { status: 500 });
  } finally {
    await client.end();
  }
}
