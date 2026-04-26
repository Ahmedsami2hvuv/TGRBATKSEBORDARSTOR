-- AlterTable
ALTER TABLE "Courier" ADD COLUMN "availableForAssignment" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "CompanyPreparer" ADD COLUMN "availableForAssignment" BOOLEAN NOT NULL DEFAULT true;
