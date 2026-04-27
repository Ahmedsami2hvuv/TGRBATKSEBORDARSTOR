import { NextResponse } from "next/server";
import { Client } from "pg";
import { prisma } from "@/lib/prisma";

const OLD_DB_URL = "postgresql://postgres:jkDcspXZlicvzQvaffZAxBgischujWrX@caboose.proxy.rlwy.net:46307/railway";

export async function POST() {
  const client = new Client({ connectionString: OLD_DB_URL, connectionTimeoutMillis: 15000 });

  try {
    await client.connect();

    // جلب المحلات من القاعدة القديمة
    const res = await client.query(`
      SELECT s.name, s."locationUrl", s."ownerName", s."photoUrl", s."phone", r.name as "regionName"
      FROM "Shop" s
      LEFT JOIN "Region" r ON s."regionId" = r.id
    `);
    const oldShops = res.rows;

    let importedCount = 0;

    for (const oldShop of oldShops) {
      // التحقق من وجود المحل مسبقاً بطريقة آمنة
      const existingShops = await prisma.$queryRaw`SELECT id FROM "Shop" WHERE name = ${oldShop.name} AND phone = ${oldShop.phone || ""} LIMIT 1` as any[];

      if (existingShops.length === 0) {
        let regionId = "";
        if (oldShop.regionName) {
          const regions = await prisma.$queryRaw`SELECT id FROM "Region" WHERE name = ${oldShop.regionName} LIMIT 1` as any[];
          if (regions.length > 0) regionId = regions[0].id;
        }

        // إذا لم يجد منطقة، يستخدم أول منطقة متاحة
        if (!regionId) {
           const firstRegions = await prisma.$queryRaw`SELECT id FROM "Region" LIMIT 1` as any[];
           if (firstRegions.length > 0) regionId = firstRegions[0].id;
        }

        if (regionId) {
          // إضافة المحل باستخدام الاستعلام المباشر لتجنب أخطاء الحقول المفقودة في موديل بريزما
          await prisma.$executeRaw`
            INSERT INTO "Shop" (id, name, "locationUrl", "ownerName", "photoUrl", "phone", "regionId", "updatedAt")
            VALUES (${Math.random().toString(36).substr(2, 9)}, ${oldShop.name}, ${oldShop.locationUrl || ""}, ${oldShop.ownerName || ""}, ${oldShop.photoUrl || ""}, ${oldShop.phone || ""}, ${regionId}, NOW())
          `;
          importedCount++;
        }
      }
    }

    return NextResponse.json({ success: true, count: importedCount });
  } catch (error: any) {
    console.error("IMPORT SHOPS ERROR:", error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  } finally {
    await client.end();
  }
}
