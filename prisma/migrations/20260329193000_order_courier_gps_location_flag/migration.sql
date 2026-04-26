-- تتبع لوكيشن رفعه المندوب عبر GPS (للفلترة لاحقاً في واتساب وغيره)
ALTER TABLE "Order" ADD COLUMN "customerLocationSetByCourierAt" TIMESTAMP(3);
