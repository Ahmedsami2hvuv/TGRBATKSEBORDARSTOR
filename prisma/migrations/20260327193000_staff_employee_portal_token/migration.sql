-- AlterTable
ALTER TABLE "StaffEmployee" ADD COLUMN "portalToken" TEXT NOT NULL DEFAULT '';

-- Backfill (Prisma default is cuid(); for existing rows keep non-empty)
UPDATE "StaffEmployee"
SET "portalToken" = CONCAT('seed_', "id")
WHERE "portalToken" = '';

