-- بيانات إضافية للزبون: الرقم الثاني وصورة باب الزبون (لإعادة استخدامها في طلبات لاحقة)
ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "alternatePhone" TEXT;
ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "customerDoorPhotoUrl" TEXT;
