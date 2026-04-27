import { NextResponse } from "next/server";
import { Client } from "pg";
import { prisma } from "@/lib/prisma";
import { uploadToR2 } from "@/lib/upload-storage";
import { nanoid } from "nanoid";

const OLD_DB_URL = "postgresql://postgres:jkDcspXZlicvzQvaffZAxBgischujWrX@caboose.proxy.rlwy.net:46307/railway";
const R2_PUBLIC_URL = process.env.NEXT_PUBLIC_R2_PUBLIC_URL || "";

async function migrateImage(oldUrl: string | null | undefined): Promise<string> {
  if (!oldUrl || !oldUrl.startsWith("http")) return "";
  // إذا كانت الصورة أصلاً مرفوعة على R2، لا نعيد رفعها
  if (oldUrl.includes("r2.dev") || (R2_PUBLIC_URL && oldUrl.includes(R2_PUBLIC_URL))) return oldUrl;

  try {
    const response = await fetch(oldUrl, { signal: AbortSignal.timeout(15000) });
    if (!response.ok) return "";
    const buffer = Buffer.from(await response.arrayBuffer());
    const contentType = response.headers.get("content-type") || "image/jpeg";
    const extension = contentType.split("/")[1]?.split("+")[0] || "jpg";
    const key = `shops/${nanoid(12)}.${extension}`;
    const uploadedKey = await uploadToR2(buffer, key, contentType);
    return uploadedKey ? `${R2_PUBLIC_URL}/${uploadedKey}` : "";
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

    await client.connect();

    const res = await client.query(`
      SELECT name, "locationUrl", "photoUrl", phone
      FROM "Shop"
      ORDER BY id
      LIMIT $1 OFFSET $2
    `, [limit, offset]);

    let updatedCount = 0;
    for (const oldShop of res.rows) {
      if (!oldShop.photoUrl || !oldShop.photoUrl.startsWith("http")) continue;

      // مطابقة مرنة (بالاسم النظيف)
      const targetShop = await prisma.shop.findFirst({
        where: {
          name: oldShop.name?.trim(),
          OR: [
            { phone: oldShop.phone?.trim() || "---" },
            { locationUrl: oldShop.locationUrl?.trim() || "---" }
          ]
        }
      });

      // إذا وجدنا المحل وصورته حالياً ليست على R2 (فارغة أو رابط قديم)
      if (targetShop && (!targetShop.photoUrl || !targetShop.photoUrl.includes("r2.dev"))) {
        const newUrl = await migrateImage(oldShop.photoUrl);
        if (newUrl && newUrl !== oldShop.photoUrl) {
          await prisma.shop.update({
            where: { id: targetShop.id },
            data: { photoUrl: newUrl }
          });
          updatedCount++;
        }
      }
    }

    return NextResponse.json({
      success: true,
      updated: Number(updatedCount) || 0,
      done: res.rows.length < limit
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message, updated: 0 }, { status: 500 });
  } finally {
    await client.end();
  }
}
