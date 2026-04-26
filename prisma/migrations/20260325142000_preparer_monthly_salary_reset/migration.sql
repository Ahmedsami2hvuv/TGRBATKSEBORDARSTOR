-- Migration: preparer monthly salary reset settings

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'PreparerMonthlySalaryResetMode'
  ) THEN
    CREATE TYPE "PreparerMonthlySalaryResetMode" AS ENUM ('calendar_month', 'every_n_days', 'manual');
  END IF;
END
$$;

ALTER TABLE "CompanyPreparer"
  ADD COLUMN IF NOT EXISTS "preparerMonthlySalaryResetMode" "PreparerMonthlySalaryResetMode" NOT NULL DEFAULT 'calendar_month',
  ADD COLUMN IF NOT EXISTS "preparerMonthlySalaryResetAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "preparerMonthlySalaryResetEveryDays" INTEGER;

