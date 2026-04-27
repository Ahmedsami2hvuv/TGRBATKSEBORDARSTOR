import { NextResponse } from "next/server";
import { Client } from "pg";
import { prisma } from "@/lib/prisma";

const OLD_DB_URL = "postgresql://postgres:jkDcspXZlicvzQvaffZAxBgischujWrX@caboose.proxy.rlwy.net:46307/railway";

export async function GET() {
  const client = new Client({ connectionString: OLD_DB_URL, connectionTimeoutMillis: 5000 });
  try {
    await client.connect();
    // فحص عدد ملفات الهواتف (البروفايلات) والزبائن
    const resProf = await client.query('SELECT phone FROM "CustomerPhoneProfile"');
    const oldProfiles = resProf.rows;

    const currentProfiles = await prisma.customerPhoneProfile.count();
    const newCount = Math.max(0, oldProfiles.length - currentProfiles);

    return NextResponse.json({
      success: true,
      totalInOld: oldProfiles.length,
      newCount: newCount
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  } finally {
    await client.end();
  }
}
