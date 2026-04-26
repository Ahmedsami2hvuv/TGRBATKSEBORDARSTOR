-- CreateEnum
CREATE TYPE "PreparerShoppingDraftStatus" AS ENUM ('draft', 'priced', 'sent', 'archived');

-- CreateTable
CREATE TABLE "CompanyPreparerShoppingDraft" (
    "id" TEXT NOT NULL,
    "preparerId" TEXT NOT NULL,
    "status" "PreparerShoppingDraftStatus" NOT NULL DEFAULT 'draft',
    "titleLine" TEXT NOT NULL DEFAULT '',
    "rawListText" TEXT NOT NULL DEFAULT '',
    "customerRegionId" TEXT,
    "customerPhone" TEXT NOT NULL DEFAULT '',
    "customerName" TEXT NOT NULL DEFAULT '',
    "customerLandmark" TEXT NOT NULL DEFAULT '',
    "orderTime" TEXT NOT NULL DEFAULT 'فوري',
    "placesCount" INTEGER,
    "data" JSONB,
    "sentOrderId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompanyPreparerShoppingDraft_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CompanyPreparerShoppingDraft_preparerId_status_createdAt_idx" ON "CompanyPreparerShoppingDraft"("preparerId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "CompanyPreparerShoppingDraft_customerRegionId_idx" ON "CompanyPreparerShoppingDraft"("customerRegionId");

-- CreateIndex
CREATE INDEX "CompanyPreparerShoppingDraft_sentOrderId_idx" ON "CompanyPreparerShoppingDraft"("sentOrderId");

-- AddForeignKey
ALTER TABLE "CompanyPreparerShoppingDraft" ADD CONSTRAINT "CompanyPreparerShoppingDraft_preparerId_fkey" FOREIGN KEY ("preparerId") REFERENCES "CompanyPreparer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyPreparerShoppingDraft" ADD CONSTRAINT "CompanyPreparerShoppingDraft_customerRegionId_fkey" FOREIGN KEY ("customerRegionId") REFERENCES "Region"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyPreparerShoppingDraft" ADD CONSTRAINT "CompanyPreparerShoppingDraft_sentOrderId_fkey" FOREIGN KEY ("sentOrderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;
