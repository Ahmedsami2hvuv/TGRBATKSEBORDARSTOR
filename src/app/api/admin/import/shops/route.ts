import { NextResponse } from "next/server";
import { Client } from "pg";
import { prisma } from "@/lib/prisma";

const OLD_DB_URL = "postgresql://postgres:jkDcspXZlicvzQvaffZAxBgischuJWrX@caboose.proxy.rlwy.net:46307/railway";

export async function POST() {
  const client = new Client({ connectionString: OLD_DB_URL });

  try {
    await client.connect();

    // جلب المحلات مع اسم منطقتها من القاعدة القديمة
    // سأقوم بعمل Join بسيط لجلب اسم المنطقة
    const res = await client.query(`
      SELECT s.name, s."locationUrl", s."ownerName", s."photoUrl", s."phone", r.name as "regionName"
      FROM "Shop" s
      LEFT JOIN "Region" r ON s."regionId" = r.id
    `);
    const oldShops = res.rows;

    let importedCount = 0;
    let skippedCount = 0;

    for (const oldShop of oldShops) {
      // التحقق إذا كان المحل موجود مسبقاً (بالاسم ورقم الهاتف لضمان الدقة)
      const exists = await prisma.shop.findFirst({
        where: {
          name: oldShop.name,
          phone: oldShop.phone || ""
        }
      });

      if (!exists) {
        // البحث عن المنطقة في القاعدة الجديدة باستخدام الاسم
        let regionId = "";
        if (oldShop.regionName) {
          const region = await prisma.region.findFirst({
            where: { name: oldShop.regionName }
          });
          if (region) {
            regionId = region.id;
          }
        }

        // إذا لم نجد المنطقة، قد نحتاج لمنطقة افتراضية أو تخطي المحل
        // سأفترض وجود المنطقة لأننا استوردنا المناطق أولاً
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
        } else {
          skippedCount++;
        }
      } else {
        skippedCount++;
      }
    }

    return NextResponse.json({
      success: true,
      count: importedCount,
      skipped: skippedCount
    });
  } catch (error: any) {
    console.error("Import Shops Error:", error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  } finally {
    await client.end();
  }
}
