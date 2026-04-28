import { NextResponse } from "next/server";
import { Client } from "pg";
import { prisma } from "@/lib/prisma";

const OLD_DB_URL = "postgresql://postgres:jkDcspXZlicvzQvaffZAxBgischujWrX@caboose.proxy.rlwy.net:46307/railway";

export async function POST(req: Request) {
  const client = new Client({ connectionString: OLD_DB_URL, connectionTimeoutMillis: 30000 });
  try {
    const { offset = 0 } = await req.json().catch(() => ({ offset: 0 }));
    await client.connect();

    // 1. جلب البيانات من السيرفر القديم
    const res = await client.query(`
      SELECT cpp.phone, cpp."locationUrl", cpp."photoUrl", cpp.notes, cpp.landmark, cpp."alternatePhone",
             r.name as "regionName"
      FROM "CustomerPhoneProfile" cpp
      LEFT JOIN "Region" r ON cpp."regionId" = r.id
      ORDER BY cpp."createdAt" ASC
      LIMIT 100 OFFSET $1
    `, [offset]);

    if (res.rows.length === 0) {
      return NextResponse.json({ success: true, rowsProcessed: 0, done: true });
    }

    // 2. معالجة المناطق أولاً لضمان عدم ضياع أي زبون
    const uniqueRegions = Array.from(new Set(res.rows.map(r => r.regionName).filter(Boolean))) as string[];
    for (const rName of uniqueRegions) {
      await prisma.region.upsert({
        where: { name: rName },
        update: {},
        create: { name: rName, deliveryPrice: 0 }
      });
    }

    const allRegions = await prisma.region.findMany();
    const regionMap = new Map(allRegions.map(r => [r.name, r.id]));
    const defaultRegionId = allRegions[0]?.id;

    let addedOrUpdated = 0;

    // 3. التنفيذ الفعلي في القاعدة
    for (const row of res.rows) {
      const targetRegionId = regionMap.get(row.regionName) || defaultRegionId;
      if (!targetRegionId) continue;

      await prisma.customerPhoneProfile.upsert({
        where: {
          phone_regionId: {
            phone: row.phone,
            regionId: targetRegionId
          }
        },
        update: {
          locationUrl: row.locationUrl || "",
          photoUrl: row.photoUrl || "",
          notes: row.notes || "",
          landmark: row.landmark || "",
          alternatePhone: row.alternatePhone
        },
        create: {
          phone: row.phone,
          regionId: targetRegionId,
          locationUrl: row.locationUrl || "",
          photoUrl: row.photoUrl || "",
          notes: row.notes || "",
          landmark: row.landmark || "",
          alternatePhone: row.alternatePhone
        }
      });
      addedOrUpdated++;
    }

    // جلب العدد الكلي الحقيقي من القاعدة الآن بعد الإضافة
    const totalNowInDb = await prisma.customerPhoneProfile.count();

    return NextResponse.json({
      success: true,
      rowsProcessed: res.rows.length,
      addedOrUpdated: addedOrUpdated,
      totalNowInDb: totalNowInDb,
      done: res.rows.length < 100
    });
  } catch (error: any) {
    console.error("IMPORT ERROR:", error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  } finally {
    await client.end();
  }
}
