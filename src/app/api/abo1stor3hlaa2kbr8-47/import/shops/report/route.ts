import { NextResponse } from "next/server";
import { Client } from "pg";
import { prisma } from "@/lib/prisma";

const OLD_DB_URL = "postgresql://postgres:jkDcspXZlicvzQvaffZAxBgischujWrX@caboose.proxy.rlwy.net:46307/railway";

export async function GET() {
  const client = new Client({ connectionString: OLD_DB_URL });
  try {
    await client.connect();

    // 1. جلب كافة المحلات من القاعدة القديمة
    const oldRes = await client.query(`SELECT name, "locationUrl", phone, "ownerName" FROM "Shop" ORDER BY name`);
    const oldShops = oldRes.rows;

    // 2. جلب كافة المحلات من القاعدة الجديدة
    const newShops = await prisma.shop.findMany({
      select: { name: true, locationUrl: true, phone: true }
    });

    const missingShops: any[] = [];

    // 3. المقارنة
    for (const oldS of oldShops) {
      const exists = newShops.find(newS => {
        const nameMatch = newS.name?.trim() === oldS.name?.trim();
        const locMatch = (newS.locationUrl?.trim()?.replace(/\/$/, "") || "") === (oldS.locationUrl?.trim()?.replace(/\/$/, "") || "");
        return nameMatch && (oldS.locationUrl ? locMatch : true);
      });

      if (!exists) {
        missingShops.push({
          name: oldS.name,
          owner: oldS.ownerName,
          phone: oldS.phone,
          location: oldS.locationUrl
        });
      }
    }

    return NextResponse.json({
      success: true,
      totalOld: oldShops.length,
      totalNew: newShops.length,
      missingCount: missingShops.length,
      missingShops
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  } finally {
    await client.end();
  }
}
