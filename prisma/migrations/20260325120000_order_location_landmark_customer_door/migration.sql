-- إزالة «عنوان الزبون» واستبدالها بموقع (رابط) + أقرب نقطة دالة + صورة باب الزبون

ALTER TABLE "Order" ADD COLUMN "customerLocationUrl" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Order" ADD COLUMN "customerLandmark" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Order" ADD COLUMN "customerDoorPhotoUrl" TEXT;

UPDATE "Order" SET "customerLandmark" = "customerAddress" WHERE "customerAddress" IS NOT NULL AND BTRIM("customerAddress") <> '';

ALTER TABLE "Order" DROP COLUMN "customerAddress";
