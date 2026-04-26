-- AlterTable
ALTER TABLE "Courier" ADD COLUMN "hiddenFromReports" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Courier" ADD COLUMN "blocked" BOOLEAN NOT NULL DEFAULT false;
