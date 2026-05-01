-- أعمدة موقع الموظف (Employee) — idempotent لقواعد فاتها migration 20260429120000
ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "lastEmployeeLat" DOUBLE PRECISION;
ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "lastEmployeeLng" DOUBLE PRECISION;
ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "lastEmployeeLocationAt" TIMESTAMP(3);
