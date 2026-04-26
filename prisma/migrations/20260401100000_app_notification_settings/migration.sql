-- CreateTable
CREATE TABLE "AppNotificationSettings" (
    "id" INTEGER NOT NULL,
    "adminEnabled" BOOLEAN NOT NULL DEFAULT true,
    "adminTemplateSingle" TEXT NOT NULL DEFAULT 'طلب جديد بانتظار الموافقة (#{orderNumber})',
    "adminTemplateMultiple" TEXT NOT NULL DEFAULT 'وصلت {count} طلبات جديدة بانتظار الموافقة',
    "adminSoundEnabled" BOOLEAN NOT NULL DEFAULT true,
    "mandoubEnabled" BOOLEAN NOT NULL DEFAULT true,
    "mandoubTemplateSingle" TEXT NOT NULL DEFAULT 'تم إسناد طلب جديد إليك (#{orderNumber})',
    "mandoubTemplateMultiple" TEXT NOT NULL DEFAULT 'تم إسناد {count} طلبات جديدة إليك',
    "mandoubSoundEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppNotificationSettings_pkey" PRIMARY KEY ("id")
);

-- Seed singleton row
INSERT INTO "AppNotificationSettings" ("id", "updatedAt")
VALUES (1, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;
