import { NextResponse } from "next/server";
import { Client } from "pg";
import { prisma } from "@/lib/prisma";
import { uploadToR2 } from "@/lib/upload-storage";
import { nanoid } from "nanoid";

const OLD_DB_URL = "postgresql://postgres:jkDcspXZlicvzQvaffZAxBgischujWrX@caboose.proxy.rlwy.net:46307/railway";
const OLD_BASE_URL = "https://kseb-order-production.up.railway.app";

function normalize(text: string): string {
  if (!text) return "";
  return text.trim()
    .replace(/[أإآ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .toLowerCase();
}

async function migrateImage(oldUrl: string | null | undefined): Promise<string> {
  if (!oldUrl || oldUrl === "") return "";

  let finalUrl = oldUrl;
  // إذا كان الرابط لا يبدأ بـ http، نضيف له رابط السيرفر القديم
  if (!finalUrl.startsWith("http")) {
    finalUrl = `${OLD_BASE_URL}${finalUrl.startsWith("/") ? "" : "/"}${finalUrl}`;
  }

  if (finalUrl.includes("r2.dev") || finalUrl.includes("pub-")) return finalUrl;

  try {
    const response = await fetch(finalUrl, {
      signal: AbortSignal.timeout(20000),
      headers: { "User-Agent": "Mozilla/5.0" }
    });
    if (!response.ok) return "";

    const buffer = Buffer.from(await response.arrayBuffer());
    const contentType = response.headers.get("content-type") || "image/jpeg";
    const extension = contentType.split("/")[1]?.split("+")[0] || "jpg";

    const fileName = `${nanoid(12)}.${extension}`;
    const key = `shops/${fileName}`;

    const uploadedKey = await uploadToR2(buffer, key, contentType);
    if (!uploadedKey) return "";

    const publicUrl = process.env.NEXT_PUBLIC_R2_PUBLIC_URL?.replace(/\/$/, "") || "https://pub-2f7b4947937d4575971a8f949826a575.r2.dev";
    return `${publicUrl}/${key}`;
  } catch (e) {
    console.error("Migration Image Error:", e);
    return "";
  }
}

export async function POST(req: Request) {
  const client = new Client({ connectionString: OLD_DB_URL });
  try {
    const { offset = 0, limit = 20 } = await req.json();
    await client.connect();

    // جلب كل المحلات القديمة التي تملك صورة (سواء رابط أو مسار)
    const oldRes = await client.query(`
      SELECT name, phone, "photoUrl"
      FROM "Shop"
      WHERE "photoUrl" IS NOT NULL AND "photoUrl" != ''
    `);
    const oldShops = oldRes.rows;

    // جلب المحلات الحالية في السيرفر الجديد
    const localShops = await prisma.shop.findMany({
      orderBy: { id: "asc" },
      skip: offset,
      take: limit,
    });

    let updatedCount = 0;
    for (const shop of localShops) {
      // إذا كانت الصورة قد رفعت لـ R2 مسبقاً أو لا توجد صورة أصلاً، تخطاها
      if (shop.photoUrl && (shop.photoUrl.includes("r2.dev") || shop.photoUrl.includes("pub-"))) continue;

      const normName = normalize(shop.name);
      const match = oldShops.find(os =>
        normalize(os.name) === normName || (os.phone && os.phone === shop.phone)
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
      updated: updatedCount,
      done: localShops.length < limit
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  } finally {
    await client.end();
  }
}
