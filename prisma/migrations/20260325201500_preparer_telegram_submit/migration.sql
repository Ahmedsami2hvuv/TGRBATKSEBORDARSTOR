-- AlterTable
ALTER TABLE "CompanyPreparer" ADD COLUMN "telegramUserId" TEXT NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE "PreparerShop" ADD COLUMN "canSubmitOrders" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Order" ADD COLUMN "submittedByCompanyPreparerId" TEXT;

-- CreateIndex
CREATE INDEX "Order_submittedByCompanyPreparerId_idx" ON "Order"("submittedByCompanyPreparerId");

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_submittedByCompanyPreparerId_fkey" FOREIGN KEY ("submittedByCompanyPreparerId") REFERENCES "CompanyPreparer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
