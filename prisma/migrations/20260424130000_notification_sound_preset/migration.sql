-- نغمة الإشعار (قيمة منطقية من الواجهة: beep, chime, bell, soft, urgent)
ALTER TABLE "AppNotificationSettings" ADD COLUMN "adminSoundPreset" TEXT NOT NULL DEFAULT 'beep';
ALTER TABLE "AppNotificationSettings" ADD COLUMN "mandoubSoundPreset" TEXT NOT NULL DEFAULT 'beep';
