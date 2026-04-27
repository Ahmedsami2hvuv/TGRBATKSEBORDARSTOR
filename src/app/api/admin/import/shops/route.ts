import { NextResponse } from "next/server";
import { Client } from "pg";
import { prisma } from "@/lib/prisma";
import { uploadToR2 } from "@/lib/upload-storage";
import { nanoid } from "nanoid";

const OLD_DB_URL = "postgresql://postgres:jkDcspXZlicvzQvaffZAxBgischujWrX@caboose.proxy.rlwy.net:46307/railway";

export async function POST(req: Request) {
  const client = new Client({ connectionString: OLD_DB_URL, connectionTimeoutMillis: 30000 });
  try {
    const { offset = 0, limit = 10 } = await req.json().catch(() => ({}));
    await client.connect();

    const res = await client.query(`
      SELECT s.name, s."locationUrl", s."ownerName", s."photoUrl", s."phone", r.name as "regionName"
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
    for (const oldShop of oldShops) {
      const cleanName = oldShop.name?.trim();
      const cleanLocation = oldShop.locationUrl?.trim()?.replace(/\/$/, "") || "";
      const cleanPhone = oldShop.phone?.trim() || "";

      // بحث متقدم:
      // 1. نبحث عن تطابق (الاسم + اللوكيشن المنظف)
      // 2. إذا لم يوجد لوكيشن، نبحث عن (الاسم + الهاتف)
      const existing = await prisma.shop.findFirst({
        where: {
          name: cleanName,
          OR: [
            { locationUrl: cleanLocation !== "" ? cleanLocation : undefined },
            {
               AND: [
                 { locationUrl: "" },
                 { phone: cleanPhone }
               ]
            }
          ]
        }
      });

      if (!existing) {
        const targetRegionId = regionMap.get(oldShop.regionName) || firstRegionId;
        await prisma.shop.create({
          data: {
            name: cleanName,
            locationUrl: cleanLocation,
            ownerName: oldShop.ownerName || "",
            photoUrl: "",
            phone: cleanPhone,
            regionId: targetRegionId,
          }
        });
        importedCount++;
      }
    }
    return NextResponse.json({ success: true, count: importedCount, done: oldShops.length < limit });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  } finally {
    await client.end();
  }
}
