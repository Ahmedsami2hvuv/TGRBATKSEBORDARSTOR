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
    .replaceAll("{count}", String(vars.count))
    .replaceAll("{orderNumber}", String(vars.orderNumber))
    .replaceAll("#{orderNumber}", `#${vars.orderNumber}`)
    .replaceAll("{shopName}", shopName)
    .replaceAll("{regionName}", regionName)
    .replaceAll("{اسم المحل}", shopName)
    .replaceAll("{اسم المنطقة}", regionName)
    .replaceAll("{رقم الطلب}", String(vars.orderNumber))
    .replaceAll("{عدد الطلبات}", String(vars.count));
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

export const DEFAULT_PREPARER_NOTIFICATION_PAYLOAD: NotificationSettingsPayload = {
  enabled: true,
  templateSingle: "لديك طلب تجهيز جديد من {shopName} إلى {regionName} (#{orderNumber})",
  templateMultiple: "لديك {count} طلبات تجهيز جديدة",
  soundEnabled: true,
  soundPreset: "phone",
};
