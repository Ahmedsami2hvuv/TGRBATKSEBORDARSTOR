import { NextResponse } from "next/server";
import { Client } from "pg";
import { prisma } from "@/lib/prisma";

const OLD_DB_URL = "postgresql://postgres:jkDcspXZlicvzQvaffZAxBgischujWrX@caboose.proxy.rlwy.net:46307/railway";

export async function GET() {
  const client = new Client({ connectionString: OLD_DB_URL, connectionTimeoutMillis: 10000 });
  try {
    await client.connect();
    const res = await client.query('SELECT name FROM "Shop"');
    const oldShops = res.rows;

    const currentShops = await prisma.shop.findMany({ select: { name: true } });
    const currentNames = new Set(currentShops.map(s => s.name));

    // فلترة المحلات التي غير موجودة أسماؤها في القاعدة الجديدة
    const newShops = oldShops.filter(os => !currentNames.has(os.name));

    return NextResponse.json({
      success: true,
      totalInOld: oldShops.length,
      newCount: newShops.length
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  } finally {
    await client.end();
  }
}
