import { prisma } from "@/lib/prisma";
import type { NotificationSettingsPayload } from "@/lib/notification-template";
import { normalizeNotificationSoundPreset } from "@/lib/notification-sound-presets";

export type NotificationAudience = "admin" | "mandoub" | "preparer";
export type { NotificationSettingsPayload };

export const DEFAULT_NOTIFICATION_SETTINGS = {
  adminEnabled: true,
  adminTitleSingle: "طلب جديد #{orderNumber}",
  adminTemplateSingle: "طلب جديد: {shopName} ← {regionName} (#{orderNumber})",
  adminTemplateMultiple: "وصلت {count} طلبات جديدة بانتظار الموافقة",
  adminSoundEnabled: true,
  adminSoundPreset: "beep",
  mandoubEnabled: true,
  mandoubTitleSingle: "طلب جديد #{orderNumber}",
  mandoubTemplateSingle: "طلب من {shopName} إلى {regionName} (#{orderNumber})",
  mandoubTemplateMultiple: "تم إسناد {count} طلبات جديدة إليك",
  mandoubSoundEnabled: true,
  mandoubSoundPreset: "beep",
  preparerEnabled: true,
  preparerTitleSingle: "تجهيز طلب #{orderNumber}",
  preparerTemplateSingle: "تجهيز: {shopName} ← {regionName} (#{orderNumber})",
  preparerTemplateMultiple: "طلب من محل {shopName} المسند إليك (#{orderNumber})",
  preparerTemplateWebsite: "طلب من الموقع إلى {regionName} (#{orderNumber})",
  preparerSoundEnabled: true,
  preparerSoundPreset: "phone",
} as const;

export async function getOrCreateNotificationSettings() {
  const row = await prisma.appNotificationSettings.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      ...DEFAULT_NOTIFICATION_SETTINGS,
    },
  });

  // ضمان ملء القيم المفقودة إذا كان السجل موجوداً مسبقاً بدون الحقول الجديدة
  return {
    ...DEFAULT_NOTIFICATION_SETTINGS,
    ...row,
  };
}

export function audienceSettings(
  settings: Awaited<ReturnType<typeof getOrCreateNotificationSettings>>,
  audience: NotificationAudience,
): NotificationSettingsPayload {
  if (audience === "admin") {
    return {
      enabled: settings.adminEnabled,
      titleSingle: settings.adminTitleSingle,
      templateSingle: settings.adminTemplateSingle,
      templateMultiple: settings.adminTemplateMultiple,
      soundEnabled: settings.adminSoundEnabled,
      soundPreset: normalizeNotificationSoundPreset(settings.adminSoundPreset),
    };
  }
  if (audience === "preparer") {
    return {
      enabled: settings.preparerEnabled,
      titleSingle: settings.preparerTitleSingle,
      templateSingle: settings.preparerTemplateSingle,
      templateMultiple: settings.preparerTemplateMultiple,
      templateWebsite: settings.preparerTemplateWebsite,
      soundEnabled: settings.preparerSoundEnabled,
      soundPreset: normalizeNotificationSoundPreset(settings.preparerSoundPreset),
    };
  }
  return {
    enabled: settings.mandoubEnabled,
    titleSingle: settings.mandoubTitleSingle,
    templateSingle: settings.mandoubTemplateSingle,
    templateMultiple: settings.mandoubTemplateMultiple,
    soundEnabled: settings.mandoubSoundEnabled,
    soundPreset: normalizeNotificationSoundPreset(settings.mandoubSoundPreset),
  };
}
