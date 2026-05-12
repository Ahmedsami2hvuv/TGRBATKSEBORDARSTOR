import type { NotificationSoundPresetId } from "@/lib/notification-sound-presets";

export function renderNotificationTemplate(
  template: string,
  vars: {
    count: number;
    orderNumber: number;
    shopName?: string;
    regionName?: string;
  },
): string {
  const shopName = (vars.shopName ?? "—").trim() || "—";
  const regionName = (vars.regionName ?? "—").trim() || "—";
  return template
    .replaceAll("{orderNumber}", String(vars.orderNumber))
    .replaceAll("#{orderNumber}", `#${vars.orderNumber}`)
    .replaceAll("{count}", String(vars.count))
    .replaceAll("{shopName}", shopName)
    .replaceAll("{regionName}", regionName)
    // دعم الأسماء العربية كـ Alias للتوافق مع الإعدادات القديمة
    .replaceAll("{رقم الطلب}", String(vars.orderNumber))
    .replaceAll("{عدد الطلبات}", String(vars.count))
    .replaceAll("{اسم المحل}", shopName)
    .replaceAll("{اسم المنطقة}", regionName);
}

export type NotificationSettingsPayload = {
  enabled: boolean;
  templateSingle: string;
  templateMultiple: string;
  templateWebsite?: string; // قالب خاص لطلبات الموقع المسندة
  soundEnabled: boolean;
  soundPreset: NotificationSoundPresetId;
};

/** قيم افتراضية للعرض قبل أول استجابة من الـ API (وتتوافق مع المخطط الافتراضي في قاعدة البيانات) */
export const DEFAULT_ADMIN_NOTIFICATION_PAYLOAD: NotificationSettingsPayload = {
  enabled: true,
  templateSingle: "طلب جديد: {shopName} ← {regionName} (#{orderNumber})",
  templateMultiple: "وصلت {count} طلبات جديدة بانتظار الموافقة",
  soundEnabled: true,
  soundPreset: "beep",
};

export const DEFAULT_MANDOUB_NOTIFICATION_PAYLOAD: NotificationSettingsPayload = {
  enabled: true,
  templateSingle: "طلب من {shopName} إلى {regionName} (#{orderNumber})",
  templateMultiple: "تم إسناد {count} طلبات جديدة إليك",
  soundEnabled: true,
  soundPreset: "beep",
};

export const DEFAULT_PREPARER_NOTIFICATION_PAYLOAD: NotificationSettingsPayload = {
  enabled: true,
  templateSingle: "تجهيز: {shopName} ← {regionName} (#{orderNumber})",
  templateMultiple: "طلب من محل {shopName} المسند إليك (#{orderNumber})",
  templateWebsite: "طلب من الموقع إلى {regionName} (#{orderNumber})",
  soundEnabled: true,
  soundPreset: "phone",
};
