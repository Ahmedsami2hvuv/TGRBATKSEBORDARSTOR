import type { NotificationSoundPresetId } from "@/lib/notification-sound-presets";

export function renderNotificationTemplate(
  template: string,
  vars: { count: number; orderNumber: number },
): string {
  return template
    .replaceAll("{count}", String(vars.count))
    .replaceAll("{orderNumber}", String(vars.orderNumber))
    .replaceAll("#{orderNumber}", `#${vars.orderNumber}`);
}

export type NotificationSettingsPayload = {
  enabled: boolean;
  templateSingle: string;
  templateMultiple: string;
  soundEnabled: boolean;
  soundPreset: NotificationSoundPresetId;
};

/** قيم افتراضية للعرض قبل أول استجابة من الـ API (وتتوافق مع المخطط الافتراضي في قاعدة البيانات) */
export const DEFAULT_ADMIN_NOTIFICATION_PAYLOAD: NotificationSettingsPayload = {
  enabled: true,
  templateSingle: "طلب جديد بانتظار الموافقة (#{orderNumber})",
  templateMultiple: "وصلت {count} طلبات جديدة بانتظار الموافقة",
  soundEnabled: true,
  soundPreset: "beep",
};

export const DEFAULT_MANDOUB_NOTIFICATION_PAYLOAD: NotificationSettingsPayload = {
  enabled: true,
  templateSingle: "تم إسناد طلب جديد إليك (#{orderNumber})",
  templateMultiple: "تم إسناد {count} طلبات جديدة إليك",
  soundEnabled: true,
  soundPreset: "beep",
};
