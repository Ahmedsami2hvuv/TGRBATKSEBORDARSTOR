import { prisma } from "@/lib/prisma";

/**
 * يضيف أعمدة موقع الموظف في جدول Employee إن كانت مفقودة (قواعد لم تُطبَّق عليها prisma migrate).
 * أوامر ثابتة فقط — بدون مدخلات من المستخدم. idempotent عبر IF NOT EXISTS (PostgreSQL 11+).
 */
export async function ensureEmployeeLocationColumnsIfMissing(): Promise<void> {
  await prisma.$executeRawUnsafe(
    `ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "lastEmployeeLat" DOUBLE PRECISION`,
  );
  await prisma.$executeRawUnsafe(
    `ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "lastEmployeeLng" DOUBLE PRECISION`,
  );
  await prisma.$executeRawUnsafe(
    `ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "lastEmployeeLocationAt" TIMESTAMP(3)`,
  );
}
