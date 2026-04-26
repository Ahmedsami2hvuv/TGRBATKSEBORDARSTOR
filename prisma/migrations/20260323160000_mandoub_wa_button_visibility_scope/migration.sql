-- تحديد من سيظهر له زر واتساب (الكل/الإدارة/الموظفين/المجهزين/المندوبين)
ALTER TABLE "MandoubWaButtonSetting" ADD COLUMN "visibilityScope" TEXT NOT NULL DEFAULT 'all';

