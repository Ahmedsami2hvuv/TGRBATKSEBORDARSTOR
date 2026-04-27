import { NextResponse } from "next/server";
import { Client } from "pg";
import { prisma } from "@/lib/prisma";
import { uploadToR2 } from "@/lib/upload-storage";
import { nanoid } from "nanoid";

const OLD_DB_URL = "postgresql://postgres:jkDcspXZlicvzQvaffZAxBgischujWrX@caboose.proxy.rlwy.net:46307/railway";
const R2_PUBLIC_URL = process.env.NEXT_PUBLIC_R2_PUBLIC_URL || "";

async function migrateImage(oldUrl: string | null | undefined): Promise<string> {
  if (!oldUrl || !oldUrl.startsWith("http")) return "";
  // إذا كانت الصورة مرفوعة مسبقاً على R2 لا نرفعها مرة أخرى
  if (oldUrl.includes("r2.dev") || (R2_PUBLIC_URL && oldUrl.includes(R2_PUBLIC_URL))) return oldUrl;

  try {
    const response = await fetch(oldUrl, { signal: AbortSignal.timeout(10000) });
    if (!response.ok) return "";
    const buffer = Buffer.from(await response.arrayBuffer());
    const contentType = response.headers.get("content-type") || "image/jpeg";
    const extension = contentType.split("/")[1]?.split("+")[0] || "jpg";
    const key = `shops/imported_${nanoid(7)}.${extension}`;

    const uploadedKey = await uploadToR2(buffer, key, contentType);
    return uploadedKey ? `${R2_PUBLIC_URL}/${uploadedKey}` : "";
  } catch (e) {
    console.error("Failed to migrate image:", oldUrl, e);
    return "";
  }
}

export async function POST(req: Request) {
  const client = new Client({ connectionString: OLD_DB_URL, connectionTimeoutMillis: 30000 });
  try {
    const { offset = 0, limit = 10 } = await req.json().catch(() => ({}));
    await client.connect();

    // سحب كافة البيانات بدون استثناء لضمان الوصول لـ 334 محل
    const res = await client.query(`
      SELECT s.id as "oldId", s.name, s."locationUrl", s."ownerName", s."photoUrl", s."phone", r.name as "regionName"
      FROM "Shop" s
      LEFT JOIN "Region" r ON s."regionId" = r.id
      ORDER BY s.id ASC
      LIMIT $1 OFFSET $2
    `, [limit, offset]);

    const oldShops = res.rows;
    if (oldShops.length === 0) return NextResponse.json({ success: true, count: 0, done: true });

    const allRegions = await prisma.region.findMany({ select: { id: true, name: true } });
    const regionMap = new Map(allRegions.map(r => [r.name, r.id]));
    const firstRegionId = allRegions[0]?.id || "";

    let importedCount = 0;
    let photosCount = 0;

    for (const oldShop of oldShops) {
      // البحث عن المحل بالاسم والهاتف معاً لضمان عدم التكرار مع السماح بالفروع
      const existing = await prisma.shop.findFirst({
        where: { name: oldShop.name, phone: oldShop.phone || "" }
      });

      if (!existing) {
        const targetRegionId = regionMap.get(oldShop.regionName) || firstRegionId;

        // معالجة الصورة ورفعها لـ R2
        let finalPhotoUrl = "";
        if (oldShop.photoUrl) {
          finalPhotoUrl = await migrateImage(oldShop.photoUrl);
          if (finalPhotoUrl) photosCount++;
        }

        await prisma.shop.create({
          data: {
            name: oldShop.name,
            locationUrl: oldShop.locationUrl || "",
            ownerName: oldShop.ownerName || "",
            photoUrl: finalPhotoUrl,
            phone: oldShop.phone || "",
            regionId: targetRegionId,
          }
        });
        importedCount++;
      }
    }

    return NextResponse.json({
      success: true,
      count: importedCount,
      photos: photosCount,
      done: oldShops.length < limit
    });
  } catch (error: any) {
    console.error("Import Error:", error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  } finally {
    await client.end();
  }
}
