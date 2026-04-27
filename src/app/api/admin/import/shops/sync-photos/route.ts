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
    .replace(/\/$/, "") // حذف السلاش في نهاية الروابط
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

    const publicUrl = process.env.NEXT_PUBLIC_R2_PUBLIC_URL?.replace(/\/$/, "") || "";
    // إذا لم يوجد رابط عام، سنعتمد على أن المفتاح سيعاد استخدامه في العرض
    return publicUrl ? `${publicUrl}/${uploadedKey}` : uploadedKey;
  } catch (e) { return ""; }
}

export async function POST(req: Request) {
  const client = new Client({ connectionString: OLD_DB_URL });
  try {
    const body = await req.json();
    const offset = Number(body.offset) || 0;
    const limit = Number(body.limit) || 10;

    const localShops = await prisma.shop.findMany({
      orderBy: { id: "asc" },
      skip: offset,
      take: limit,
    });

    if (localShops.length === 0) return NextResponse.json({ success: true, updated: 0, done: true });

    await client.connect();
    // جلب البيانات مع اللوكيشن والهاتف لضمان التطابق
    const oldRes = await client.query('SELECT name, "locationUrl", phone, "photoUrl" FROM "Shop" WHERE "photoUrl" IS NOT NULL AND "photoUrl" != \'\'');
    const oldShops = oldRes.rows;

    let updatedCount = 0;
    for (const shop of localShops) {
      // إذا كان للمحل صورة مرفوعة مسبقاً على نظام التخزين الجديد، نتخطاه
      if (shop.photoUrl && (shop.photoUrl.includes("r2.dev") || shop.photoUrl.includes("pub-") || shop.photoUrl.startsWith("shops/"))) continue;

      const normName = normalize(shop.name);
      const normLoc = normalize(shop.locationUrl || "");

      // محاولة المطابقة بأكثر من وسيلة (اسم + لوكيشن) أو (هاتف) أو (اسم فقط كحل أخير)
      const oldMatch = oldShops.find(os => {
        const osName = normalize(os.name);
        const osLoc = normalize(os.locationUrl || "");
        return (osName === normName && (osLoc === normLoc || !normLoc || !osLoc)) ||
               (os.phone && shop.phone && os.phone === shop.phone);
      });

      if (oldMatch && oldMatch.photoUrl) {
        const newUrl = await migrateImage(oldMatch.photoUrl);
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
      done: localShops.length < limit,
      debug: { foundOld: oldShops.length, processed: localShops.length }
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message, updated: 0 }, { status: 500 });
  } finally {
    await client.end();
  }
}
