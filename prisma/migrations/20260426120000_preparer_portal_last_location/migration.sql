-- AlterTable
ALTER TABLE "CompanyPreparer" ADD COLUMN     "lastPreparerLat" DOUBLE PRECISION,
ADD COLUMN     "lastPreparerLng" DOUBLE PRECISION,
ADD COLUMN     "lastPreparerLocationAt" TIMESTAMP(3);
