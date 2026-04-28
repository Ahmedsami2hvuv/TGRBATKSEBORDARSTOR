import { NextResponse } from "next/server";
import { Client } from "pg";
import { prisma } from "@/lib/prisma";

const OLD_DB_URL = "postgresql://postgres:jkDcspXZlicvzQvaffZAxBgischujWrX@caboose.proxy.rlwy.net:46307/railway";

export async function POST(req: Request) {
  const client = new Client({ connectionString: OLD_DB_URL, connectionTimeoutMillis: 30000 });
  try {
    const { offset = 0 } = await req.json().catch(() => ({ offset: 0 }));
    await client.connect();

    // 1. جلب الزبائن مع الـ regionId الأصلي والاسم
    const res = await client.query(`
      SELECT cpp.phone, cpp."regionId", cpp."locationUrl", cpp."photoUrl", cpp.notes, cpp.landmark, cpp."alternatePhone",
             r.name as "regionName"
      FROM "CustomerPhoneProfile" cpp
      LEFT JOIN "Region" r ON cpp."regionId" = r.id
      ORDER BY cpp."createdAt" ASC
      LIMIT 100 OFFSET $1
    `, [offset]);

    if (res.rows.length === 0) {
      return NextResponse.json({ success: true, rowsProcessed: 0, done: true });
    }

    // 2. جلب المناطق الحالية لضمان الربط
    const allRegions = await prisma.region.findMany();
    const regionIdMap = new Set(allRegions.map(r => r.id));
    const regionNameMap = new Map(allRegions.map(r => [r.name.trim(), r.id]));

    let addedOrUpdated = 0;

    for (const row of res.rows) {
      let targetRegionId = null;

      // محاولة 1: الربط عن طريق الـ ID (لأنك سحبت المناطق بنفس الـ ID)
      if (regionIdMap.has(row.regionId)) {
        targetRegionId = row.regionId;
      }
      // محاولة 2: الربط عن طريق الاسم
      else if (row.regionName && regionNameMap.has(row.regionName.trim())) {
        targetRegionId = regionNameMap.get(row.regionName.trim());
      }
      // محاولة 3: إنشاء المنطقة إذا لم توجد (لضمان عدم التخطي)
      else if (row.regionName) {
        const newReg = await prisma.region.create({
          data: { id: row.regionId, name: row.regionName, deliveryPrice: 0 }
        });
        targetRegionId = newReg.id;
        regionIdMap.add(newReg.id);
        regionNameMap.set(newReg.name.trim(), newReg.id);
      }

      if (!targetRegionId) continue;

      // 3. الحفظ الفعلي
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
