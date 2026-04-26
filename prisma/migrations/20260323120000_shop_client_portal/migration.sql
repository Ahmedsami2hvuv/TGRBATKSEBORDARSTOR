-- صفحة العميل: حقول المحل + تفاصيل الطلب
ALTER TABLE "Shop" ADD COLUMN "ownerName" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Shop" ADD COLUMN "photoUrl" TEXT NOT NULL DEFAULT '';

ALTER TABLE "Order" ADD COLUMN "orderType" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Order" ADD COLUMN "customerAddress" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Order" ADD COLUMN "customerRegionId" TEXT;
ALTER TABLE "Order" ADD COLUMN "deliveryPrice" DECIMAL(10,2);
ALTER TABLE "Order" ADD COLUMN "orderSubtotal" DECIMAL(10,2);
ALTER TABLE "Order" ADD COLUMN "totalAmount" DECIMAL(10,2);
ALTER TABLE "Order" ADD COLUMN "customerPhone" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Order" ADD COLUMN "alternatePhone" TEXT;
ALTER TABLE "Order" ADD COLUMN "orderNoteTime" TEXT;
ALTER TABLE "Order" ADD COLUMN "imageUrl" TEXT;
ALTER TABLE "Order" ADD COLUMN "submissionSource" TEXT NOT NULL DEFAULT 'employee';

ALTER TABLE "Order" ADD CONSTRAINT "Order_customerRegionId_fkey" FOREIGN KEY ("customerRegionId") REFERENCES "Region"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "Order_customerRegionId_idx" ON "Order"("customerRegionId");
