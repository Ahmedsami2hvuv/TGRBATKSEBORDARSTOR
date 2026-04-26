-- إعدادات زر واتساب للمندوب (قوالب + شروط ظهور)
CREATE TABLE "MandoubWaButtonSetting" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT '',
    "label" TEXT NOT NULL,
    "iconKey" TEXT NOT NULL DEFAULT '💬',
    "templateText" TEXT NOT NULL,
    "recipient" TEXT NOT NULL DEFAULT 'customer',
    "statusesCsv" TEXT NOT NULL DEFAULT '',
    "customerLocationRule" TEXT NOT NULL DEFAULT 'any',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MandoubWaButtonSetting_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "MandoubWaButtonSetting_isActive_idx" ON "MandoubWaButtonSetting"("isActive");

