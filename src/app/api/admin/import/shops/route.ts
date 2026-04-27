import { NextResponse } from "next/server";
import { Client } from "pg";
import { prisma } from "@/lib/prisma";
import { uploadToR2 } from "@/lib/upload-storage";
import { nanoid } from "nanoid";

const OLD_DB_URL = "postgresql://postgres:jkDcspXZlicvzQvaffZAxBgischujWrX@caboose.proxy.rlwy.net:46307/railway";
const R2_PUBLIC_URL = process.env.NEXT_PUBLIC_R2_PUBLIC_URL || "";

async function migrateImage(oldUrl: string | null | undefined): Promise<string> {
  if (!oldUrl || !oldUrl.startsWith("http")) return "";
  if (oldUrl.includes("r2.dev") || (R2_PUBLIC_URL && oldUrl.includes(R2_PUBLIC_URL))) return oldUrl;
  try {
    const response = await fetch(oldUrl);
    if (!response.ok) return "";
    const buffer = Buffer.from(await response.arrayBuffer());
    const contentType = response.headers.get("content-type") || "image/jpeg";
    const extension = contentType.split("/")[1] || "jpg";
    const key = `shops/photo_${nanoid(5)}.${extension}`;
    const uploadedKey = await uploadToR2(buffer, key, contentType);
    return uploadedKey ? `${R2_PUBLIC_URL}/${uploadedKey}` : "";
  } catch (e) { return ""; }
}

export async function POST() {
  const client = new Client({ connectionString: OLD_DB_URL, connectionTimeoutMillis: 30000 });
  try {
    await client.connect();
    const res = await client.query(`
      SELECT s.name, s."locationUrl", s."ownerName", s."photoUrl", s."phone", r.name as "regionName"
      FROM "Shop" s
      LEFT JOIN "Region" r ON s."regionId" = r.id
    `);
    const oldShops = res.rows;

    const allRegions = await prisma.region.findMany({ select: { id: true, name: true } });
    const regionMap = new Map(allRegions.map(r => [r.name, r.id]));
    const firstRegionId = allRegions[0]?.id || "";

    let importedCount = 0;

    for (const oldShop of oldShops) {
      // فحص الوجود بالاسم والهاتف معاً لجلب الـ 334 كاملة
      const existing = await prisma.shop.findFirst({
        where: {
          name: oldShop.name,
          phone: oldShop.phone || ""
        },
        select: { id: true }
      });

      if (!existing) {
        const targetRegionId = regionMap.get(oldShop.regionName) || firstRegionId;
        if (!targetRegionId) continue;

        const newPhotoUrl = await migrateImage(oldShop.photoUrl);

        await prisma.$executeRaw`
          INSERT INTO "Shop" (id, name, "locationUrl", "ownerName", "photoUrl", "phone", "regionId", "updatedAt", "createdAt")
          VALUES (${nanoid(10)}, ${oldShop.name}, ${oldShop.locationUrl || ""}, ${oldShop.ownerName || ""}, ${newPhotoUrl}, ${oldShop.phone || ""}, ${targetRegionId}, NOW(), NOW())
        `;
        importedCount++;
      }
    }
    return NextResponse.json({ success: true, count: importedCount });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  } finally {
    await client.end();
  }
}
