import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const secret = searchParams.get("secret");

  if (secret !== "super-secure-fix-9923") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const log: string[] = [];
  const report: any = {};

  try {
    log.push("Starting database schema repair for secondCustomerAlternatePhone...");

    // 1. Inspect the columns of the Order table
    log.push("Fetching current columns of the 'Order' table...");
    const columnsBefore: any = await prisma.$queryRawUnsafe(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'Order';
    `);
    report.columnsBefore = columnsBefore;

    // 2. Add secondCustomerAlternatePhone column to Order table
    log.push("Adding column 'secondCustomerAlternatePhone' to 'Order' table if not exists...");
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "secondCustomerAlternatePhone" TEXT;
    `);
    log.push("Column 'secondCustomerAlternatePhone' added or verified.");

    // 3. Re-inspect columns to verify changes
    log.push("Fetching updated columns of the 'Order' table...");
    const columnsAfter: any = await prisma.$queryRawUnsafe(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'Order';
    `);
    report.columnsAfter = columnsAfter;

    log.push("Database schema repair completed successfully!");
    return NextResponse.json({ success: true, log, report });
  } catch (err: any) {
    log.push(`❌ CRITICAL ERROR: ${err.message || err}`);
    return NextResponse.json({ success: false, log, error: err.message || err }, { status: 500 });
  }
}
