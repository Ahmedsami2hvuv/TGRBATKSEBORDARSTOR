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
    log.push("Starting database schema repair...");

    // 1. Inspect the columns of the Shop table
    log.push("Fetching current columns of the 'Shop' table...");
    const columnsBefore: any = await prisma.$queryRawUnsafe(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'Shop';
    `);
    report.columnsBefore = columnsBefore;

    // 2. Add ordersPaused column
    log.push("Adding column 'ordersPaused' to 'Shop' table if not exists...");
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "Shop" ADD COLUMN IF NOT EXISTS "ordersPaused" BOOLEAN NOT NULL DEFAULT false;
    `);
    log.push("Column 'ordersPaused' added or verified.");

    // 3. Add pauseMessage column
    log.push("Adding column 'pauseMessage' to 'Shop' table if not exists...");
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "Shop" ADD COLUMN IF NOT EXISTS "pauseMessage" TEXT NOT NULL DEFAULT '';
    `);
    log.push("Column 'pauseMessage' added or verified.");

    // 4. Re-inspect columns to verify changes
    log.push("Fetching updated columns of the 'Shop' table...");
    const columnsAfter: any = await prisma.$queryRawUnsafe(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'Shop';
    `);
    report.columnsAfter = columnsAfter;

    log.push("Database schema repair completed successfully!");
    return NextResponse.json({ success: true, log, report });
  } catch (err: any) {
    log.push(`❌ CRITICAL ERROR: ${err.message || err}`);
    return NextResponse.json({ success: false, log, error: err.message || err }, { status: 500 });
  }
}
