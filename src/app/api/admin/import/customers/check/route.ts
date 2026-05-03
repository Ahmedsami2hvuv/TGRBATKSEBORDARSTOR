import { NextResponse } from "next/server";
import { Client } from "pg";
import { prisma } from "@/lib/prisma";

const OLD_DB_URL = "postgresql://postgres:jkDcspXZlicvzQvaffZAxBgischujWrX@caboose.proxy.rlwy.net:46307/railway";

export async function GET() {
  const client = new Client({ connectionString: OLD_DB_URL, connectionTimeoutMillis: 5000 });
  try {
    await client.connect();
    // جلب المفاتيح الفعلية من السيرفر القديم
    const resProf = await client.query(`
      SELECT phone, "regionId"
      FROM "CustomerPhoneProfile"
      WHERE phone IS NOT NULL AND "regionId" IS NOT NULL
    `);
    const totalInOld = resProf.rows.length;

    // جلب مفاتيح السيرفر الجديد
    const localProfiles = await prisma.customerPhoneProfile.findMany({
      select: { phone: true, regionId: true },
    });
    const currentCount = localProfiles.length;
    const localKeys = new Set(
      localProfiles.map((p) => `${String(p.phone).trim()}|${String(p.regionId).trim()}`)
    );

    // النواقص الحقيقية = مفاتيح موجودة في القديم وغير موجودة في الجديد
    let missingExact = 0;
    for (const row of resProf.rows) {
      const key = `${String(row.phone).trim()}|${String(row.regionId).trim()}`;
      if (!localKeys.has(key)) missingExact++;
    }

    return NextResponse.json({
      success: true,
      totalInOld: totalInOld,
      currentCount: currentCount,
      newCount: missingExact
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  } finally {
    await client.end();
  }
}
