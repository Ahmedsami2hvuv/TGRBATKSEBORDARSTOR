import { NextResponse } from "next/server";
import { Client } from "pg";
import { prisma } from "@/lib/prisma";

const OLD_DB_URL = "postgresql://postgres:jkDcspXZlicvzQvaffZAxBgischujWrX@caboose.proxy.rlwy.net:46307/railway";

export async function POST() {
  const client = new Client({ connectionString: OLD_DB_URL, connectionTimeoutMillis: 15000 });

  try {
    await client.connect();

    // 1. جلب البيانات المرجعية
    const [allShops, allRegions, existingCustomers] = await Promise.all([
      prisma.shop.findMany({ select: { id: true, name: true } }),
      prisma.region.findMany({ select: { id: true, name: true } }),
      prisma.customer.findMany({ select: { phone: true, shopId: true } })
    ]);

    // البحث عن أو إنشاء "محل افتراضي" للزبائن المرجعيين
    let generalShop = allShops.find(s => s.name.includes("عام"));
    if (!generalShop) {
        const firstRegion = await prisma.region.findFirst({ select: { id: true } });
        if (firstRegion) {
            generalShop = await prisma.shop.create({
                data: {
                    name: "زبائن عامون (قاعدة قديمة)",
                    locationUrl: "",
                    regionId: firstRegion.id
                },
                select: { id: true, name: true }
            });
        }
    }

    const shopMap = new Map(allShops.map(s => [s.name, s.id]));
    const regionMap = new Map(allRegions.map(r => [r.name, r.id]));
    const customerSet = new Set(existingCustomers.map(c => `${c.phone}-${c.shopId}`));

    const resCust = await client.query(`
      SELECT c.name, c.phone, c."customerLocationUrl", c."customerLandmark", c."customerDoorPhotoUrl",
             r.name as "regionName", s.name as "shopName"
      FROM "Customer" c
      LEFT JOIN "Region" r ON c."customerRegionId" = r.id
      LEFT JOIN "Shop" s ON c."shopId" = s.id
    `);

    let importedCust = 0;
    const customersToCreate = [];

    for (const oldCust of resCust.rows) {
      // إذا لم يجد المحل، يستخدم المحل العام بدلاً من التجاهل
      const shopId = shopMap.get(oldCust.shopName) || generalShop?.id;
      if (!shopId) continue;

      if (!customerSet.has(`${oldCust.phone}-${shopId}`)) {
        customersToCreate.push({
          name: oldCust.name || "",
          phone: oldCust.phone,
          shopId: shopId,
          customerRegionId: regionMap.get(oldCust.regionName) || null,
          customerLocationUrl: oldCust.customerLocationUrl || "",
          customerLandmark: oldCust.customerLandmark || "",
          customerDoorPhotoUrl: oldCust.customerDoorPhotoUrl || "",
        });
        importedCust++;
      }
    }

    if (customersToCreate.length > 0) {
      await prisma.customer.createMany({ data: customersToCreate, skipDuplicates: true });
    }

    return NextResponse.json({ success: true, customers: importedCust });
  } catch (error: any) {
    console.error("IMPORT CUSTOMERS ERROR:", error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  } finally {
    await client.end();
  }
}
