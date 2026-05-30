import { prisma } from "@/lib/prisma";

let hasChecked = false;

/**
 * يضيف أعمدة موقع الموظف في جدول Employee إن كانت مفقودة (قواعد لم تُطبَّق عليها prisma migrate).
 * أوامر ثابتة فقط — بدون مدخلات من المستخدم. idempotent عبر IF NOT EXISTS (PostgreSQL 11+).
 */
export async function ensureEmployeeLocationColumnsIfMissing(): Promise<void> {
  if (hasChecked) return;

  try {
    // التحقق أولاً بشكل آمن دون قفل الجدول
    const existingColumns = await prisma.$queryRawUnsafe<{ column_name: string }[]>(
      `SELECT column_name 
       FROM information_schema.columns 
       WHERE table_name = 'Employee' 
         AND column_name IN ('lastEmployeeLat', 'lastEmployeeLng', 'lastEmployeeLocationAt')`
    );

    if (existingColumns && existingColumns.length === 3) {
      hasChecked = true;
      return;
    }

    const colNames = (existingColumns || []).map((col) => col.column_name);

    if (!colNames.includes("lastEmployeeLat")) {
      await prisma.$executeRawUnsafe(
        `ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "lastEmployeeLat" DOUBLE PRECISION`,
      );
    }
    if (!colNames.includes("lastEmployeeLng")) {
      await prisma.$executeRawUnsafe(
        `ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "lastEmployeeLng" DOUBLE PRECISION`,
      );
    }
    if (!colNames.includes("lastEmployeeLocationAt")) {
      await prisma.$executeRawUnsafe(
        `ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "lastEmployeeLocationAt" TIMESTAMP(3)`,
      );
    }

    hasChecked = true;
  } catch (error) {
    console.error("[DbSelfHeal] Error checking/adding employee location columns:", error);
  }
}
