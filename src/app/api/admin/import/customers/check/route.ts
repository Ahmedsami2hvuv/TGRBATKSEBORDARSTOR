import { NextResponse } from "next/server";
import { Client } from "pg";
import { prisma } from "@/lib/prisma";

const OLD_DB_URL = "postgresql://postgres:jkDcspXZlicvzQvaffZAxBgischujWrX@caboose.proxy.rlwy.net:46307/railway";

export async function GET() {
  const client = new Client({ connectionString: OLD_DB_URL, connectionTimeoutMillis: 5000 });
  try {
    await client.connect();
    // جلب العدد الكلي من السيرفر القديم
    const resProf = await client.query('SELECT count(*) FROM "CustomerPhoneProfile"');
    const totalInOld = parseInt(resProf.rows[0].count);

    // جلب العدد الموجود حالياً في السيرفر الجديد
    const currentCount = await prisma.customerPhoneProfile.count();

    // الكمية المتبقية للسحب
    const remaining = Math.max(0, totalInOld - currentCount);

    return NextResponse.json({
      success: true,
      totalInOld: totalInOld,
      currentCount: currentCount,
      newCount: remaining
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  } finally {
    await client.end();
  }
}
