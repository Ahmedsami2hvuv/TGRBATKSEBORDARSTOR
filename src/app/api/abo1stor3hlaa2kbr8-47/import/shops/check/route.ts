import { NextResponse } from "next/server";
import { Client } from "pg";

const OLD_DB_URL = "postgresql://postgres:jkDcspXZlicvzQvaffZAxBgischujWrX@caboose.proxy.rlwy.net:46307/railway";

export async function GET() {
  const client = new Client({ connectionString: OLD_DB_URL, connectionTimeoutMillis: 10000 });
  try {
    await client.connect();

    // استعلام مباشر لعد كل السجلات في جدول المحلات دون استثناء
    const res = await client.query('SELECT COUNT(*) as total FROM "Shop"');
    const totalCount = parseInt(res.rows[0].total);

    return NextResponse.json({
      success: true,
      totalInOld: totalCount,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  } finally {
    await client.end();
  }
}
