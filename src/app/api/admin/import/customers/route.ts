import { NextResponse } from "next/server";
import { Client } from "pg";
import { prisma } from "@/lib/prisma";

const OLD_DB_URL = "postgresql://postgres:jkDcspXZlicvzQvaffZAxBgischujWrX@caboose.proxy.rlwy.net:46307/railway";

export async function POST(req: Request) {
  const client = new Client({ connectionString: OLD_DB_URL, connectionTimeoutMillis: 30000 });
  try {
    const { offset = 0 } = await req.json().catch(() => ({ offset: 0 }));
    await client.connect();

    const allShops = await prisma.shop.findMany({ select: { id: true, name: true } });
    const allRegions = await prisma.region.findMany({ select: { id: true, name: true } });

    let defaultShop = allShops.find(s => s.name.includes("عام") || s.name.includes("مهاجرة"));
    if (!defaultShop) {
      const firstReg = await prisma.region.findFirst();
      if (!firstReg) throw new Error("يجب إضافة منطقة أولاً");
      defaultShop = await prisma.shop.create({
        data: { name: "الزبائن المهاجرون", locationUrl: "", regionId: firstReg.id }
      });
    }

    const shopMap = new Map(allShops.map(s => [s.name, s.id]));
    const regionMap = new Map(allRegions.map(r => [r.name, r.id]));

    // سحب 50 زبوناً فقط بناءً على الـ offset لضمان السرعة وظهور التقدم
    const resCust = await client.query(`
      SELECT c.name, c.phone, c."customerLocationUrl", c."customerLandmark", c."customerDoorPhotoUrl",
             r.name as "regionName", s.name as "shopName"
      FROM "Customer" c
      LEFT JOIN "Region" r ON c."customerRegionId" = r.id
      LEFT JOIN "Shop" s ON c."shopId" = s.id
      ORDER BY c.id ASC
      LIMIT 50 OFFSET $1
    `, [offset]);

    let importedCount = 0;
    for (const oldCust of resCust.rows) {
      const shopId = shopMap.get(oldCust.shopName) || defaultShop.id;

      const existing = await prisma.customer.findFirst({
        where: { phone: oldCust.phone, shopId: shopId }
      });

      if (!existing) {
        const newCustomer = await prisma.customer.create({
          data: {
            name: oldCust.name || "زبون مهاجر",
            phone: oldCust.phone,
            shopId: shopId,
            customerRegionId: regionMap.get(oldCust.regionName) || null,
            customerLocationUrl: oldCust.customerLocationUrl || "",
            customerLandmark: oldCust.customerLandmark || "",
            customerDoorPhotoUrl: oldCust.customerDoorPhotoUrl || "",
          }
        });

        await prisma.customerProfile.upsert({
            where: { customerId: newCustomer.id },
            update: {},
            create: {
                customerId: newCustomer.id,
                name: newCustomer.name,
                phone: newCustomer.phone,
                photoUrl: oldCust.customerDoorPhotoUrl || ""
            }
        });
        importedCount++;
      }
    }

    return NextResponse.json({
      success: true,
      customers: importedCount,
      rowsProcessed: resCust.rows.length,
      done: resCust.rows.length < 50
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  } finally {
    await client.end();
  }
}
