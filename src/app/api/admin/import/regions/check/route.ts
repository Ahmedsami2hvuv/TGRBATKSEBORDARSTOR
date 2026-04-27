import { NextResponse } from "next/server";
import { Client } from "pg";
import { prisma } from "@/lib/prisma";

const OLD_DB_URL = "postgresql://postgres:jkDcspXZlicvzQvaffZAxBgischujWrX@caboose.proxy.rlwy.net:46307/railway";

export async function GET() {
  const client = new Client({ connectionString: OLD_DB_URL, connectionTimeoutMillis: 5000 });
  try {
    await client.connect();
    const res = await client.query('SELECT name FROM "Region"');
    const oldRegions = res.rows;

    const currentRegions = await prisma.region.findMany({ select: { name: true } });
    const currentNames = new Set(currentRegions.map(r => r.name));

    const newRegions = oldRegions.filter(r => !currentNames.has(r.name));

    return NextResponse.json({
      success: true,
      totalInOld: oldRegions.length,
      newCount: newRegions.length
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  } finally {
    await client.end();
  }
}
