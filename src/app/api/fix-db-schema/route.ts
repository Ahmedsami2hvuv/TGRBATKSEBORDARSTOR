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
    log.push("Starting database schema repair for Courier.showMoneyBoxes...");

    // 1. Inspect the columns of the Courier table
    log.push("Fetching current columns of the 'Courier' table...");
    const columnsBefore: any = await prisma.$queryRawUnsafe(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'Courier';
    `);
    report.columnsBefore = columnsBefore;

    // 2. Add showMoneyBoxes column to Courier table
    log.push("Adding column 'showMoneyBoxes' to 'Courier' table if not exists...");
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "Courier" ADD COLUMN IF NOT EXISTS "showMoneyBoxes" BOOLEAN NOT NULL DEFAULT true;
    `);
    log.push("Column 'showMoneyBoxes' added or verified.");

    // 3. Re-inspect columns to verify changes
    log.push("Fetching updated columns of the 'Courier' table...");
    const columnsAfter: any = await prisma.$queryRawUnsafe(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'Courier';
    `);
    report.columnsAfter = columnsAfter;

    log.push("Database schema repair completed successfully!");
    return NextResponse.json({ success: true, log, report });
  } catch (err: any) {
    log.push(`❌ CRITICAL ERROR: ${err.message || err}`);
    return NextResponse.json({ success: false, log, error: err.message || err }, { status: 500 });
  }
}
