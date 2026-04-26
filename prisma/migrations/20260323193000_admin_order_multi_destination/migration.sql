-- Add support for admin-created one/two destination orders.
ALTER TABLE "Order"
ADD COLUMN "routeMode" TEXT NOT NULL DEFAULT 'single',
ADD COLUMN "adminOrderCode" TEXT NOT NULL DEFAULT '',
ADD COLUMN "secondCustomerPhone" TEXT,
ADD COLUMN "secondCustomerRegionId" TEXT,
ADD COLUMN "secondCustomerLocationUrl" TEXT NOT NULL DEFAULT '',
ADD COLUMN "secondCustomerLandmark" TEXT NOT NULL DEFAULT '',
ADD COLUMN "secondCustomerDoorPhotoUrl" TEXT;

CREATE INDEX "Order_secondCustomerRegionId_idx" ON "Order"("secondCustomerRegionId");
CREATE INDEX "Order_routeMode_idx" ON "Order"("routeMode");

ALTER TABLE "Order"
ADD CONSTRAINT "Order_secondCustomerRegionId_fkey"
FOREIGN KEY ("secondCustomerRegionId")
REFERENCES "Region"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;

