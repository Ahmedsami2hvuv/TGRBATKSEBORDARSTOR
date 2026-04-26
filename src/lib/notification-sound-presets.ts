/** قيم نغمة الإشعار — تُخزَّن في DB وتُرسل للعميل عبر API */

export const NOTIFICATION_SOUND_PRESET_IDS = ["beep", "chime", "bell", "soft", "urgent"] as const;

export type NotificationSoundPresetId = (typeof NOTIFICATION_SOUND_PRESET_IDS)[number];

export function normalizeNotificationSoundPreset(raw: string): NotificationSoundPresetId {
  return NOTIFICATION_SOUND_PRESET_IDS.includes(raw as NotificationSoundPresetId)
    ? (raw as NotificationSoundPresetId)
    : "beep";
}

export const NOTIFICATION_SOUND_PRESET_LABELS_AR: Record<NotificationSoundPresetId, string> = {
  beep: "صفارة قصيرة (افتراضي)",
  chime: "نغمة مزدوجة (جرس خفيف)",
  bell: "جرس أطول",
  soft: "نغمة هادئة",
  urgent: "تنبيه متكرّر (عاجل)",
};
