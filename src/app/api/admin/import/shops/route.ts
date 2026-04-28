import { NextResponse } from "next/server";
import { Client } from "pg";
import { prisma } from "@/lib/prisma";

const OLD_DB_URL = "postgresql://postgres:jkDcspXZlicvzQvaffZAxBgischujWrX@caboose.proxy.rlwy.net:46307/railway";

export async function POST(req: Request) {
  const client = new Client({ connectionString: OLD_DB_URL, connectionTimeoutMillis: 30000 });
  try {
    const { offset = 0, limit = 5 } = await req.json().catch(() => ({}));
    await client.connect();

    // 1. جلب المحلات
    const resShops = await client.query(`
      SELECT s.id as "oldId", s.name, s."locationUrl", s."ownerName", s."photoUrl", s."phone", r.name as "regionName"
      FROM "Shop" s
      LEFT JOIN "Region" r ON s."regionId" = r.id
      ORDER BY s.id ASC
      LIMIT $1 OFFSET $2
    `, [limit, offset]);

    if (resShops.rows.length === 0) return NextResponse.json({ success: true, count: 0, done: true });

    const allRegions = await prisma.region.findMany();
    const regionMap = new Map(allRegions.map(r => [r.name, r.id]));
    const firstRegionId = allRegions[0]?.id || "";

    let shopsImported = 0;
    let employeesImported = 0;
    let customersImported = 0;

    for (const oldShop of resShops.rows) {
      const targetRegionId = regionMap.get(oldShop.regionName) || firstRegionId;

      const newShop = await prisma.shop.upsert({
        where: { id: oldShop.oldId },
        update: {
          name: oldShop.name,
          locationUrl: oldShop.locationUrl || "",
          ownerName: oldShop.ownerName || "",
          phone: oldShop.phone || "",
          regionId: targetRegionId
        },
        create: {
          id: oldShop.oldId,
          name: oldShop.name,
          locationUrl: oldShop.locationUrl || "",
          ownerName: oldShop.ownerName || "",
          phone: oldShop.phone || "",
          regionId: targetRegionId
        }
      });
      shopsImported++;

      // 2. سحب الموظفين (Employees) - اللي يرفعون الطلبات
      const resEmp = await client.query(`
        SELECT id, name, phone, "orderPortalToken"
        FROM "Employee"
        WHERE "shopId" = $1
      `, [oldShop.oldId]);

      for (const oldEmp of resEmp.rows) {
        await prisma.employee.upsert({
          where: { id: oldEmp.id },
          update: {
            name: oldEmp.name,
            phone: oldEmp.phone,
            shopId: newShop.id,
            orderPortalToken: oldEmp.orderPortalToken
          },
          create: {
            id: oldEmp.id,
            name: oldEmp.name,
            phone: oldEmp.phone,
            shopId: newShop.id,
            orderPortalToken: oldEmp.orderPortalToken
          }
        });
        employeesImported++;
      }

      // 3. سحب الزبائن (الوجهات)
      const resCust = await client.query(`
        SELECT id, name, phone, "customerLocationUrl", "customerLandmark", "alternatePhone", "customerDoorPhotoUrl"
        FROM "Customer"
        WHERE "shopId" = $1
      `, [oldShop.oldId]);

      for (const oldCust of resCust.rows) {
        await prisma.customer.upsert({
          where: { id: oldCust.id },
          update: {
            name: oldCust.name || "",
            phone: oldCust.phone,
            shopId: newShop.id,
            customerLocationUrl: oldCust.customerLocationUrl || "",
            customerLandmark: oldCust.customerLandmark || "",
            alternatePhone: oldCust.alternatePhone,
            customerDoorPhotoUrl: oldCust.customerDoorPhotoUrl
          },
          create: {
            id: oldCust.id,
            name: oldCust.name || "",
            phone: oldCust.phone,
            shopId: newShop.id,
            customerLocationUrl: oldCust.customerLocationUrl || "",
            customerLandmark: oldCust.customerLandmark || "",
            alternatePhone: oldCust.alternatePhone,
            customerDoorPhotoUrl: oldCust.customerDoorPhotoUrl
          }
        });
        customersImported++;
      }
    }

    return NextResponse.json({
      success: true,
      shopsCount: shopsImported,
      employeesCount: employeesImported,
      customersCount: customersImported,
      done: resShops.rows.length < limit
    });

  } catch (error: any) {
    console.error("IMPORT ERROR:", error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  } finally {
    await client.end();
  }
}
