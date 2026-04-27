import { NextResponse } from "next/server";
import { Client } from "pg";
import { prisma } from "@/lib/prisma";

const OLD_DB_URL = "postgresql://postgres:jkDcspXZlicvzQvaffZAxBgischujWrX@caboose.proxy.rlwy.net:46307/railway";

export async function POST() {
  const client = new Client({ connectionString: OLD_DB_URL, connectionTimeoutMillis: 30000 });

  try {
    await client.connect();

    // 1. جلب البيانات المرجعية
    const allShops = await prisma.shop.findMany({ select: { id: true, name: true } });
    const allRegions = await prisma.region.findMany({ select: { id: true, name: true } });

    // إنشاء محل افتراضي للزبائن اليتامى (الذين ليس لديهم محل في القاعدة الجديدة)
    let defaultShop = allShops.find(s => s.name.includes("عام") || s.name.includes("افتراضي"));
    if (!defaultShop) {
      const firstRegion = await prisma.region.findFirst();
      if (!firstRegion) throw new Error("يجب إضافة منطقة واحدة على الأقل في النظام أولاً");

      defaultShop = await prisma.shop.create({
        data: {
          name: "قاعدة بيانات الزبائن المهاجرة",
          locationUrl: "",
          regionId: firstRegion.id
        }
      });
    }

    const shopMap = new Map(allShops.map(s => [s.name, s.id]));
    const regionMap = new Map(allRegions.map(r => [r.name, r.id]));

    // جلب كافة الزبائن من القاعدة القديمة
    const resCust = await client.query(`
      SELECT c.name, c.phone, c."customerLocationUrl", c."customerLandmark", c."customerDoorPhotoUrl",
             r.name as "regionName", s.name as "shopName"
      FROM "Customer" c
      LEFT JOIN "Region" r ON c."customerRegionId" = r.id
      LEFT JOIN "Shop" s ON c."shopId" = s.id
    `);

    let importedCount = 0;

    // سنقوم بالسحب على دفعات لضمان الاستقرار
    for (const oldCust of resCust.rows) {
      const shopId = shopMap.get(oldCust.shopName) || defaultShop.id;

      // نتحقق إذا كان الزبون موجوداً مسبقاً بنفس الهاتف والمحل
      const existing = await prisma.customer.findFirst({
        where: { phone: oldCust.phone, shopId: shopId }
      });

      if (!existing) {
        const newCustomer = await prisma.customer.create({
          data: {
            name: oldCust.name || "زبون غير مسمى",
            phone: oldCust.phone,
            shopId: shopId,
            customerRegionId: regionMap.get(oldCust.regionName) || null,
            customerLocationUrl: oldCust.customerLocationUrl || "",
            customerLandmark: oldCust.customerLandmark || "",
            customerDoorPhotoUrl: oldCust.customerDoorPhotoUrl || "",
          }
        });

        // إنشاء بروفايل تلقائي للزبون (لضمان ظهور الصور لاحقاً)
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

    return NextResponse.json({ success: true, customers: importedCount });
  } catch (error: any) {
    console.error("CRITICAL IMPORT ERROR:", error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  } finally {
    await client.end();
  }
}
