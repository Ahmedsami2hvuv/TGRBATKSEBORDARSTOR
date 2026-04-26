-- AlterTable
ALTER TABLE "CompanyPreparer" ADD COLUMN "portalToken" TEXT NOT NULL DEFAULT '';

-- Backfill existing rows
UPDATE "CompanyPreparer"
SET "portalToken" = CONCAT('seed_', "id")
WHERE "portalToken" = '';
