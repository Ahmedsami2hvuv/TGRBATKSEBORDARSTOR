import { NextResponse } from "next/server";
import { Client } from "pg";
import { prisma } from "@/lib/prisma";

const OLD_DB_URL = "postgresql://postgres:jkDcspXZlicvzQvaffZAxBgischujWrX@caboose.proxy.rlwy.net:46307/railway";

export async function POST() {
  const client = new Client({ connectionString: OLD_DB_URL, connectionTimeoutMillis: 15000 });

  try {
    await client.connect();

    // 1. جلب المحلات الحالية لربط الموظفين بها
    const allShops = await prisma.shop.findMany({ select: { id: true, name: true } });
    const shopMap = new Map(allShops.map(s => [s.name, s.id]));

    // 2. جلب الموظفين من القاعدة القديمة
    const res = await client.query(`
      SELECT e.name, e.phone, e."orderPortalToken", s.name as "shopName"
      FROM "Employee" e
      JOIN "Shop" s ON e."shopId" = s.id
    `);

    let importedCount = 0;

    for (const oldEmp of res.rows) {
      const targetShopId = shopMap.get(oldEmp.shopName);
      if (!targetShopId) continue;

      // فحص إذا كان الموظف موجود مسبقاً
      const existing = await prisma.employee.findFirst({
        where: { phone: oldEmp.phone, shopId: targetShopId }
      });

      if (!existing) {
        await prisma.employee.create({
          data: {
            name: oldEmp.name,
            phone: oldEmp.phone,
            shopId: targetShopId,
            orderPortalToken: oldEmp.orderPortalToken || undefined,
          }
        });
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
