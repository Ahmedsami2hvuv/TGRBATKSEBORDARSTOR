import { NextResponse } from "next/server";
import { Client } from "pg";
import { prisma } from "@/lib/prisma";

const OLD_DB_URL = "postgresql://postgres:jkDcspXZlicvzQvaffZAxBgischuJWrX@caboose.proxy.rlwy.net:46307/railway";

export async function POST() {
  const client = new Client({ connectionString: OLD_DB_URL });

  try {
    await client.connect();

    // جلب المناطق من القاعدة القديمة
    // ملاحظة: قد تختلف أسماء الجداول أو الحقول، سأفترض أنها "Region" و "name", "deliveryPrice"
    const res = await client.query('SELECT name, "deliveryPrice" FROM "Region"');
    const oldRegions = res.rows;

    let importedCount = 0;

    for (const oldReg of oldRegions) {
      // التحقق إذا كانت المنطقة موجودة مسبقاً في القاعدة الجديدة
      const exists = await prisma.region.findFirst({
        where: { name: oldReg.name }
      });

      if (!exists) {
        await prisma.region.create({
          data: {
            name: oldReg.name,
            deliveryPrice: oldReg.deliveryPrice,
          }
        });
        importedCount++;
      }
    }

    return NextResponse.json({ success: true, count: importedCount });
  } catch (error: any) {
    console.error("Import Error:", error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  } finally {
    await client.end();
  }
}
