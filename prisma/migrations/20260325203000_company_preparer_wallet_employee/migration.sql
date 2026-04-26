-- AlterTable
ALTER TABLE "CompanyPreparer" ADD COLUMN "walletEmployeeId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "CompanyPreparer_walletEmployeeId_key" ON "CompanyPreparer"("walletEmployeeId");

-- AddForeignKey
ALTER TABLE "CompanyPreparer" ADD CONSTRAINT "CompanyPreparer_walletEmployeeId_fkey" FOREIGN KEY ("walletEmployeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

