-- رقم المحل + أعلام تسوية المندوب
ALTER TABLE "Shop" ADD COLUMN "phone" TEXT NOT NULL DEFAULT '';

ALTER TABLE "Order" ADD COLUMN "shopCostPaidAt" TIMESTAMP(3);
ALTER TABLE "Order" ADD COLUMN "customerPaymentReceivedAt" TIMESTAMP(3);
ALTER TABLE "Order" ADD COLUMN "courierCashSettledAt" TIMESTAMP(3);
