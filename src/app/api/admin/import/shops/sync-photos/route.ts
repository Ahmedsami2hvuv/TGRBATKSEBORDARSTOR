import { NextResponse } from "next/server";
import { Client } from "pg";
import { prisma } from "@/lib/prisma";
import { uploadToR2 } from "@/lib/upload-storage";
import { nanoid } from "nanoid";

const OLD_DB_URL = "postgresql://postgres:jkDcspXZlicvzQvaffZAxBgischujWrX@caboose.proxy.rlwy.net:46307/railway";
const R2_PUBLIC_URL = process.env.NEXT_PUBLIC_R2_PUBLIC_URL || "";

async function migrateImage(oldUrl: string | null | undefined): Promise<string> {
  if (!oldUrl || !oldUrl.startsWith("http")) return "";
  try {
    const response = await fetch(oldUrl, { signal: AbortSignal.timeout(15000) });
    if (!response.ok) return "";
    const buffer = Buffer.from(await response.arrayBuffer());
    const contentType = response.headers.get("content-type") || "image/jpeg";
    const extension = contentType.split("/")[1]?.split("+")[0] || "jpg";
    const key = `shops/sync_${nanoid(7)}.${extension}`;
    const uploadedKey = await uploadToR2(buffer, key, contentType);
    return uploadedKey ? `${R2_PUBLIC_URL}/${uploadedKey}` : "";
  } catch (e) { return ""; }
}

export async function POST(req: Request) {
  const client = new Client({ connectionString: OLD_DB_URL });
  try {
    const { offset = 0, limit = 10 } = await req.json();
    await client.connect();

    // جلب دفعة من المحلات القديمة
    const res = await client.query(`
      SELECT name, "locationUrl", "photoUrl"
      FROM "Shop"
      ORDER BY id
      LIMIT $1 OFFSET $2
    `, [limit, offset]);

    let updatedCount = 0;
    for (const oldShop of res.rows) {
      if (!oldShop.photoUrl) continue;

      // المطابقة الذكية: الاسم + اللوكيشن (تجاوز الهاتف المكرر)
      const targetShop = await prisma.shop.findFirst({
        where: {
          name: oldShop.name,
          locationUrl: oldShop.locationUrl || "",
          OR: [
            { photoUrl: "" },
            { photoUrl: null as any }
          ]
        }
      });

      if (targetShop) {
        const newUrl = await migrateImage(oldShop.photoUrl);
        if (newUrl) {
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
      updated: updatedCount,
      done: res.rows.length < limit
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  } finally {
    await client.end();
  }
}
