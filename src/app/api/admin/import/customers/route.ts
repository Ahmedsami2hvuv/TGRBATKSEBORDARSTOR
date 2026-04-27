import { NextResponse } from "next/server";
import { Client } from "pg";
import { prisma } from "@/lib/prisma";

const OLD_DB_URL = "postgresql://postgres:jkDcspXZlicvzQvaffZAxBgischuJWrX@caboose.proxy.rlwy.net:46307/railway";

export async function POST() {
  const client = new Client({ connectionString: OLD_DB_URL });

  try {
    await client.connect();

    // --- 1. استيراد الزبائن المرتبطين بالمحلات (Customer) ---
    const resCust = await client.query(`
      SELECT
        c.name, c.phone, c."customerLocationUrl", c."customerLandmark", c."customerDoorPhotoUrl", c."alternatePhone",
        r.name as "regionName",
        s.name as "shopName"
      FROM "Customer" c
      LEFT JOIN "Region" r ON c."customerRegionId" = r.id
      LEFT JOIN "Shop" s ON c."shopId" = s.id
    `);
    const oldCustomers = resCust.rows;

    let importedCustCount = 0;

    for (const oldCust of oldCustomers) {
      const shop = await prisma.shop.findFirst({ where: { name: oldCust.shopName } });
      if (!shop) continue;

      const exists = await prisma.customer.findFirst({
        where: { phone: oldCust.phone, shopId: shop.id }
      });

      if (!exists) {
        let regionId = null;
        if (oldCust.regionName) {
          const region = await prisma.region.findFirst({ where: { name: oldCust.regionName } });
          if (region) regionId = region.id;
        }

        await prisma.customer.create({
          data: {
            name: oldCust.name || "",
            phone: oldCust.phone,
            shopId: shop.id,
            customerRegionId: regionId,
            customerLocationUrl: oldCust.customerLocationUrl || "",
            customerLandmark: oldCust.customerLandmark || "",
            customerDoorPhotoUrl: oldCust.customerDoorPhotoUrl || "",
            alternatePhone: oldCust.alternatePhone || null,
          }
        });
        importedCustCount++;
      }
    }

    // --- 2. استيراد ملفات الهواتف (CustomerPhoneProfile) ---
    // هذه هي البيانات التي تظهر في صفحة "بيانات الزبائن"
    const resProfile = await client.query(`
      SELECT
        p.phone, p."locationUrl", p."photoUrl", p.notes, p.landmark, p."alternatePhone",
        r.name as "regionName"
      FROM "CustomerPhoneProfile" p
      LEFT JOIN "Region" r ON p."regionId" = r.id
    `);
    const oldProfiles = resProfile.rows;

    let importedProfileCount = 0;

    for (const oldProf of oldProfiles) {
      let regionId = "";
      if (oldProf.regionName) {
        const region = await prisma.region.findFirst({ where: { name: oldProf.regionName } });
        if (region) regionId = region.id;
      }

      if (regionId) {
        // التحقق من وجود الملف مسبقاً (مفتاح فريد: الهاتف + المنطقة)
        const exists = await prisma.customerPhoneProfile.findUnique({
          where: { phone_regionId: { phone: oldProf.phone, regionId: regionId } }
        });

        if (!exists) {
          await prisma.customerPhoneProfile.create({
            data: {
              phone: oldProf.phone,
              regionId: regionId,
              locationUrl: oldProf.locationUrl || "",
              photoUrl: oldProf.photoUrl || "",
              notes: oldProf.notes || "",
              landmark: oldProf.landmark || "",
              alternatePhone: oldProf.alternatePhone || null,
            }
          });
          importedProfileCount++;
        }
      }
    }

    return NextResponse.json({
      success: true,
      customersCount: importedCustCount,
      profilesCount: importedProfileCount
    });
  } catch (error: any) {
    console.error("Import Customers Error:", error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  } finally {
    await client.end();
  }
}
