import { NextResponse } from "next/server";
import { Client } from "pg";
import { prisma } from "@/lib/prisma";

const OLD_DB_URL = "postgresql://postgres:jkDcspXZlicvzQvaffZAxBgischujWrX@caboose.proxy.rlwy.net:46307/railway";

export async function POST(req: Request) {
  const client = new Client({ connectionString: OLD_DB_URL, connectionTimeoutMillis: 30000 });
  try {
    const { offset = 0 } = await req.json().catch(() => ({ offset: 0 }));
    await client.connect();

    // 1. جلب المناطق الحالية للربط
    const allRegions = await prisma.region.findMany({ select: { id: true, name: true } });
    const regionMap = new Map(allRegions.map(r => [r.name, r.id]));
    const firstRegionId = allRegions[0]?.id;

    if (!firstRegionId) throw new Error("يجب إضافة منطقة واحدة على الأقل في النظام الجديد");

    // 2. سحب البيانات من جدول البروفايلات (حيث توجد البيانات الحقيقية والمنطقة)
    const res = await client.query(`
      SELECT cpp.phone, cpp."locationUrl", cpp."photoUrl", cpp.notes, cpp.landmark, cpp."alternatePhone",
             r.name as "regionName"
      FROM "CustomerPhoneProfile" cpp
      LEFT JOIN "Region" r ON cpp."regionId" = r.id
      ORDER BY cpp."createdAt" DESC
      LIMIT 100 OFFSET $1
    `, [offset]);

    let importedCount = 0;
    for (const old of res.rows) {
      const regionId = regionMap.get(old.regionName) || firstRegionId;

      // تحديث أو إنشاء بروفايل الهاتف
      await prisma.customerPhoneProfile.upsert({
        where: { phone_regionId: { phone: old.phone, regionId: regionId } },
        update: {
          locationUrl: old.locationUrl || "",
          photoUrl: old.photoUrl || "",
          notes: old.notes || "",
          landmark: old.landmark || "",
          alternatePhone: old.alternatePhone || null
        },
        create: {
          phone: old.phone,
          regionId: regionId,
          locationUrl: old.locationUrl || "",
          photoUrl: old.photoUrl || "",
          notes: old.notes || "",
          landmark: old.landmark || "",
          alternatePhone: old.alternatePhone || null
        }
      });
      importedCount++;
    }

    return NextResponse.json({
      success: true,
      customers: importedCount,
      rowsProcessed: res.rows.length,
      done: res.rows.length < 100
    });
  } catch (error: any) {
    console.error("IMPORT ERROR:", error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  } finally {
    await client.end();
  }
}
