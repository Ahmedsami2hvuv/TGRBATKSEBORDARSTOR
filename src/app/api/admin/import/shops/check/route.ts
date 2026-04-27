import { NextResponse } from "next/server";
import { Client } from "pg";
import { prisma } from "@/lib/prisma";

const OLD_DB_URL = "postgresql://postgres:jkDcspXZlicvzQvaffZAxBgischuJWrX@caboose.proxy.rlwy.net:46307/railway";

export async function GET() {
  const client = new Client({ connectionString: OLD_DB_URL, connectionTimeoutMillis: 5000 });
  try {
    await client.connect();
    const res = await client.query('SELECT name, phone FROM "Shop"');
    const oldShops = res.rows;

    const currentShops = await prisma.shop.findMany({ select: { name: true, phone: true } });

    const newShops = oldShops.filter(os =>
      !currentShops.some(cs => cs.name === os.name && cs.phone === os.phone)
    );

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
