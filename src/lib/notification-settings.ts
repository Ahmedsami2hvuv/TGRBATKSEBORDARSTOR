import { prisma } from "@/lib/prisma";
import type { NotificationSettingsPayload } from "@/lib/notification-template";
import { normalizeNotificationSoundPreset } from "@/lib/notification-sound-presets";

export type NotificationAudience = "admin" | "mandoub";
export type { NotificationSettingsPayload };

export const DEFAULT_NOTIFICATION_SETTINGS = {
  adminEnabled: true,
  adminTemplateSingle: "طلب جديد بانتظار الموافقة (#{orderNumber})",
  adminTemplateMultiple: "وصلت {count} طلبات جديدة بانتظار الموافقة",
  adminSoundEnabled: true,
  adminSoundPreset: "beep",
  mandoubEnabled: true,
  mandoubTemplateSingle: "تم إسناد طلب جديد إليك (#{orderNumber})",
  mandoubTemplateMultiple: "تم إسناد {count} طلبات جديدة إليك",
  mandoubSoundEnabled: true,
  mandoubSoundPreset: "beep",
} as const;

export async function getOrCreateNotificationSettings() {
  return prisma.appNotificationSettings.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      ...DEFAULT_NOTIFICATION_SETTINGS,
    },
  });
}

export function audienceSettings(
  settings: Awaited<ReturnType<typeof getOrCreateNotificationSettings>>,
  audience: NotificationAudience,
): NotificationSettingsPayload {
  if (audience === "admin") {
    return {
      enabled: settings.adminEnabled,
      templateSingle: settings.adminTemplateSingle,
      templateMultiple: settings.adminTemplateMultiple,
      soundEnabled: settings.adminSoundEnabled,
      soundPreset: normalizeNotificationSoundPreset(settings.adminSoundPreset),
    };
  }
  return {
    enabled: settings.mandoubEnabled,
    templateSingle: settings.mandoubTemplateSingle,
    templateMultiple: settings.mandoubTemplateMultiple,
    soundEnabled: settings.mandoubSoundEnabled,
    soundPreset: normalizeNotificationSoundPreset(settings.mandoubSoundPreset),
  };
}
