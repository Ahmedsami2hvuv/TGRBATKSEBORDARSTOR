-- زبائن مرتبطون بكل محل + ربط الطلب بعميل اختياري

CREATE TABLE "Customer" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT '',
    "phone" TEXT NOT NULL,
    "customerRegionId" TEXT,
    "customerLocationUrl" TEXT NOT NULL DEFAULT '',
    "customerLandmark" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Customer_shopId_idx" ON "Customer"("shopId");

CREATE INDEX "Customer_phone_idx" ON "Customer"("phone");

ALTER TABLE "Customer" ADD CONSTRAINT "Customer_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Customer" ADD CONSTRAINT "Customer_customerRegionId_fkey" FOREIGN KEY ("customerRegionId") REFERENCES "Region"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Order" ADD COLUMN "customerId" TEXT;

CREATE INDEX "Order_customerId_idx" ON "Order"("customerId");

ALTER TABLE "Order" ADD CONSTRAINT "Order_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
