import { NextResponse } from "next/server";
import { Client } from "pg";
import { prisma } from "@/lib/prisma";

const OLD_DB_URL = "postgresql://postgres:jkDcspXZlicvzQvaffZAxBgischujWrX@caboose.proxy.rlwy.net:46307/railway";

export async function POST() {
  const client = new Client({ connectionString: OLD_DB_URL, connectionTimeoutMillis: 15000 });

  try {
    await client.connect();

    // 1. Customers
    const resCust = await client.query(`
      SELECT c.name, c.phone, c."customerLocationUrl", c."customerLandmark", c."customerDoorPhotoUrl", c."alternatePhone",
             r.name as "regionName", s.name as "shopName"
      FROM "Customer" c
      LEFT JOIN "Region" r ON c."customerRegionId" = r.id
      LEFT JOIN "Shop" s ON c."shopId" = s.id
    `);

    let importedCust = 0;
    for (const oldCust of resCust.rows) {
      const shop = await prisma.shop.findFirst({ where: { name: oldCust.shopName } });
      if (!shop) continue;

      const exists = await prisma.customer.findFirst({ where: { phone: oldCust.phone, shopId: shop.id } });
      if (!exists) {
        const region = oldCust.regionName ? await prisma.region.findFirst({ where: { name: oldCust.regionName } }) : null;
        await prisma.customer.create({
          data: {
            name: oldCust.name || "",
            phone: oldCust.phone,
            shopId: shop.id,
            customerRegionId: region?.id || null,
            customerLocationUrl: oldCust.customerLocationUrl || "",
            customerLandmark: oldCust.customerLandmark || "",
            customerDoorPhotoUrl: oldCust.customerDoorPhotoUrl || "",
          }
        });
        importedCust++;
      }
    }

    // 2. Profiles
    const resProf = await client.query(`
       SELECT p.phone, p."locationUrl", p."photoUrl", p.notes, p.landmark, r.name as "regionName"
       FROM "CustomerPhoneProfile" p
       LEFT JOIN "Region" r ON p."regionId" = r.id
    `);

    let importedProf = 0;
    for (const oldProf of resProf.rows) {
      const region = await prisma.region.findFirst({ where: { name: oldProf.regionName } });
      if (!region) continue;

      const exists = await prisma.customerPhoneProfile.findUnique({
        where: { phone_regionId: { phone: oldProf.phone, regionId: region.id } }
      });

      if (!exists) {
        await prisma.customerPhoneProfile.create({
          data: {
            phone: oldProf.phone,
            regionId: region.id,
            locationUrl: oldProf.locationUrl || "",
            photoUrl: oldProf.photoUrl || "",
            notes: oldProf.notes || "",
            landmark: oldProf.landmark || "",
          }
        });
        importedProf++;
      }
    }

    return NextResponse.json({ success: true, customers: importedCust, profiles: importedProf });
  } catch (error: any) {
    console.error("IMPORT CUSTOMERS ERROR:", error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  } finally {
    await client.end();
  }
}
