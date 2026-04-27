import { NextResponse } from "next/server";
import { Client } from "pg";
import { prisma } from "@/lib/prisma";

const OLD_DB_URL = "postgresql://postgres:jkDcspXZlicvzQvaffZAxBgischujWrX@caboose.proxy.rlwy.net:46307/railway";

export async function POST() {
  const client = new Client({ connectionString: OLD_DB_URL, connectionTimeoutMillis: 15000 });

  try {
    await client.connect();

    const res = await client.query(`
      SELECT s.name, s."locationUrl", s."ownerName", s."photoUrl", s."phone", r.name as "regionName"
      FROM "Shop" s
      LEFT JOIN "Region" r ON s."regionId" = r.id
    `);
    const oldShops = res.rows;

    let importedCount = 0;

    for (const oldShop of oldShops) {
      // تعديل هام: استخدام select لتجنب طلب حقول غير موجودة تسبب انهيار البريزما
      const exists = await prisma.shop.findFirst({
        where: { name: oldShop.name, phone: oldShop.phone || "" },
        select: { id: true }
      });

      if (!exists) {
        let regionId = "";
        if (oldShop.regionName) {
          const region = await prisma.region.findFirst({
            where: { name: oldShop.regionName },
            select: { id: true }
          });
          if (region) regionId = region.id;
        }

        // إذا لم يجد منطقة، سنضعه في أول منطقة متاحة أو نتركه (لكن الجدول يتطلب regionId)
        if (!regionId) {
           const firstRegion = await prisma.region.findFirst({ select: { id: true } });
           if (firstRegion) regionId = firstRegion.id;
        }

        if (regionId) {
          await prisma.shop.create({
            data: {
              name: oldShop.name,
              locationUrl: oldShop.locationUrl || "",
              ownerName: oldShop.ownerName || "",
              photoUrl: oldShop.photoUrl || "",
              phone: oldShop.phone || "",
              regionId: regionId,
            }
          });
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
