import { NextResponse } from "next/server";
import { Client } from "pg";
import { prisma } from "@/lib/prisma";

const OLD_DB_URL = "postgresql://postgres:jkDcspXZlicvzQvaffZAxBgischujWrX@caboose.proxy.rlwy.net:46307/railway";

export async function POST(req: Request) {
  const client = new Client({ connectionString: OLD_DB_URL, connectionTimeoutMillis: 30000 });
  try {
    const { offset = 0 } = await req.json().catch(() => ({ offset: 0 }));
    await client.connect();

    // 1. جلب البيانات من السيرفر القديم - نركز على البروفايلات
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

    // 2. ضمان وجود المناطق في القاعدة الجديدة
    const allRegions = await prisma.region.findMany();
    let regionMap = new Map(allRegions.map(r => [r.name, r.id]));

    // إنشاء منطقة افتراضية إذا لم يوجد أي منطقة في القاعدة
    let defaultRegionId = allRegions[0]?.id;
    if (!defaultRegionId) {
      const fallbackRegion = await prisma.region.upsert({
        where: { name: "غير محدد" },
        update: {},
        create: { name: "غير محدد", deliveryPrice: 0 }
      });
      defaultRegionId = fallbackRegion.id;
      regionMap.set(fallbackRegion.name, fallbackRegion.id);
    }

    let addedOrUpdated = 0;

    for (const row of res.rows) {
      let targetRegionId = row.regionName ? regionMap.get(row.regionName) : defaultRegionId;

      // إذا المنطقة غير موجودة، ننشئها فوراً
      if (!targetRegionId && row.regionName) {
        try {
          const newReg = await prisma.region.create({
            data: { name: row.regionName, deliveryPrice: 0 }
          });
          targetRegionId = newReg.id;
          regionMap.set(row.regionName, targetRegionId);
          console.log(`Created new region: ${row.regionName}`);
        } catch (e) {
          targetRegionId = defaultRegionId;
        }
      }

      const finalRegionId = targetRegionId || defaultRegionId;

      try {
        // 3. تحديث أو إنشاء البروفايل (الزبون المرجعي)
        await prisma.customerPhoneProfile.upsert({
          where: {
            phone_regionId: {
              phone: row.phone,
              regionId: finalRegionId
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
            regionId: finalRegionId,
            locationUrl: row.locationUrl || "",
            photoUrl: row.photoUrl || "",
            notes: row.notes || "",
            landmark: row.landmark || "",
            alternatePhone: row.alternatePhone
          }
        });
        addedOrUpdated++;
      } catch (upsertError) {
        console.error(`Error upserting customer ${row.phone}:`, upsertError);
      }
    }

    // جلب العدد الكلي الحقيقي
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
