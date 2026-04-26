-- AlterTable (must run after OrderCourierMoneyEvent exists — see 20260330120000_courier_money_events)
ALTER TABLE "OrderCourierMoneyEvent" ADD COLUMN "recordedByCompanyPreparerId" TEXT;

-- CreateIndex
CREATE INDEX "OrderCourierMoneyEvent_recordedByCompanyPreparerId_idx" ON "OrderCourierMoneyEvent"("recordedByCompanyPreparerId");

-- AddForeignKey
ALTER TABLE "OrderCourierMoneyEvent" ADD CONSTRAINT "OrderCourierMoneyEvent_recordedByCompanyPreparerId_fkey" FOREIGN KEY ("recordedByCompanyPreparerId") REFERENCES "CompanyPreparer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
