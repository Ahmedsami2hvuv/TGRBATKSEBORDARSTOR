ALTER TABLE "AppNotificationSettings"
ADD COLUMN "preparerEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "preparerTemplateSingle" TEXT NOT NULL DEFAULT 'لديك طلب تجهيز جديد من {shopName} إلى {regionName} (#{orderNumber})',
ADD COLUMN "preparerTemplateMultiple" TEXT NOT NULL DEFAULT 'لديك {count} طلبات تجهيز جديدة',
ADD COLUMN "preparerSoundEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "preparerSoundPreset" TEXT NOT NULL DEFAULT 'phone';

ALTER TABLE "WebPushSubscription"
ADD COLUMN "preparerId" TEXT;

ALTER TABLE "WebPushSubscription"
ADD CONSTRAINT "WebPushSubscription_preparerId_fkey"
FOREIGN KEY ("preparerId") REFERENCES "CompanyPreparer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
