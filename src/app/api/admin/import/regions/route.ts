import { NextResponse } from "next/server";
import { Client } from "pg";
import { prisma } from "@/lib/prisma";

const OLD_DB_URL = "postgresql://postgres:jkDcspXZlicvzQvaffZAxBgischujWrX@caboose.proxy.rlwy.net:46307/railway";

export async function POST() {
  console.log("Starting regions import...");
  const client = new Client({
    connectionString: OLD_DB_URL,
    connectionTimeoutMillis: 10000, // 10 seconds timeout
  });

  try {
    await client.connect();
    console.log("Connected to old database successfully.");

    const res = await client.query('SELECT name, "deliveryPrice" FROM "Region"');
    const oldRegions = res.rows;
    console.log(`Found ${oldRegions.length} regions in old database.`);

    let importedCount = 0;

    for (const oldReg of oldRegions) {
      const exists = await prisma.region.findFirst({
        where: { name: oldReg.name }
      });

      if (!exists) {
        await prisma.region.create({
          data: {
            name: oldReg.name,
            deliveryPrice: oldReg.deliveryPrice, // حفظ القيمة بالدينار الكامل (مثلاً 3000)
          }
        });
        importedCount++;
        console.log(`Imported region: ${oldReg.name}`);
      }
    }

    return NextResponse.json({ success: true, count: importedCount });
  } catch (error: any) {
    console.error("CRITICAL IMPORT ERROR:", error);
    return NextResponse.json({
      success: false,
      message: error.message,
      detail: error.stack
    }, { status: 500 });
  } finally {
    await client.end();
  }
}
