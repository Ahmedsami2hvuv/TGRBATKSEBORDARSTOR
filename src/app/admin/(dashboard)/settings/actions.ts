"use server";

import { revalidatePath } from "next/cache";
import { isAdminSession } from "@/lib/admin-session";
import { prisma } from "@/lib/prisma";
import { DEFAULT_NOTIFICATION_SETTINGS } from "@/lib/notification-settings";
import { normalizeNotificationSoundPreset } from "@/lib/notification-sound-presets";
import { saveEmployeeWhatsappShareTemplate, saveCustomerOrderWhatsappTemplate } from "@/lib/whatsapp-template-settings";
import { saveTelegramNewOrderTemplate } from "@/lib/telegram-notify";

import { GlobalIconsConfig, saveGlobalIcons } from "@/lib/icon-settings";
import { setChatEnabledGlobally } from "@/lib/portal-chat-settings";
import { RoleFeaturesConfig, saveRoleFeatures } from "@/lib/role-features-settings";
import { ensureTelegramWebhookConfigured } from "@/lib/telegram";

export async function saveGlobalIconsAction(config: GlobalIconsConfig) {
  if (!(await isAdminSession())) return { error: "Unauthenticated" };
  await saveGlobalIcons(config);
  revalidatePath("/admin/settings");
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function saveChatSettingsAction(enabled: boolean) {
  if (!(await isAdminSession())) return { error: "Unauthenticated" };
  await setChatEnabledGlobally(enabled);
  revalidatePath("/admin/settings");
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function saveRoleFeaturesAction(role: "mandoub" | "preparer", config: RoleFeaturesConfig) {
  if (!(await isAdminSession())) return { error: "Unauthenticated" };
  await saveRoleFeatures(role, config);
  revalidatePath("/admin/settings");
  revalidatePath("/mandoub", "layout");
  revalidatePath("/preparer", "layout");
  return { ok: true };
}

export async function updateCourierButtonsAction(courierId: string, data: {
  showDoorBtn?: boolean;
  showLocationBtn?: boolean;
  showCallBtn?: boolean;
  showWhatsAppBtn?: boolean;
  showNotesBtn?: boolean;
  showVoiceNotesBtn?: boolean;
}) {
  if (!(await isAdminSession())) return { error: "Unauthenticated" };
  try {
    await prisma.courier.update({
      where: { id: courierId },
      data,
    });
    revalidatePath("/admin/settings");
    revalidatePath("/mandoub");
    return { ok: true };
  } catch (error: any) {
    return { error: error.message || "Failed to update courier buttons" };
  }
}

export async function saveTelegramAdminIdsAction(telegramAdminIds: string) {
  // This function is kept for backward compatibility if needed, but we'll use the new one below
  if (!(await isAdminSession())) return { error: "Unauthenticated" };
  try {
    await prisma.appNotificationSettings.update({
      where: { id: 1 },
      data: { telegramAdminIds },
    });
    revalidatePath("/admin/settings");
    return { ok: true };
  } catch (error: any) {
    return { error: error.message || "Failed to save Telegram Admin IDs" };
  }
}

export async function addTelegramAdminAction(telegramUserId: string, name: string) {
  if (!(await isAdminSession())) return { error: "Unauthenticated" };
  try {
    await prisma.telegramAdmin.upsert({
      where: { telegramUserId },
      create: { telegramUserId, name },
      update: { name },
    });
    revalidatePath("/admin/settings");
    return { ok: true };
  } catch (error: any) {
    return { error: error.message || "Failed to add Telegram Admin" };
  }
}

export async function deleteTelegramAdminAction(id: string) {
  if (!(await isAdminSession())) return { error: "Unauthenticated" };
  try {
    await prisma.telegramAdmin.delete({ where: { id } });
    revalidatePath("/admin/settings");
    return { ok: true };
  } catch (error: any) {
    return { error: error.message || "Failed to delete Telegram Admin" };
  }
}

export async function toggleTelegramAdminActiveAction(id: string, active: boolean) {
  if (!(await isAdminSession())) return { error: "Unauthenticated" };
  try {
    await prisma.telegramAdmin.update({
      where: { id },
      data: { active },
    });
    revalidatePath("/admin/settings");
    return { ok: true };
  } catch (error: any) {
    return { error: error.message || "Failed to toggle Telegram Admin status" };
  }
}

export async function addTelegramBotAction(data: { name: string; username: string; token: string; purpose: string }) {
  if (!(await isAdminSession())) return { error: "Unauthenticated" };
  try {
    const bot = await prisma.telegramBot.create({
      data: {
        name: data.name,
        username: data.username,
        token: data.token,
        purpose: data.purpose,
      },
    });
    // تهيئة الـ Webhook فور الإضافة
    await ensureTelegramWebhookConfigured(bot.token, bot.id).catch(console.error);
    revalidatePath("/admin/settings");
    return { ok: true };
  } catch (error: any) {
    console.error("Error adding telegram bot:", error);
    throw error;
  }
}

export async function deleteTelegramBotAction(id: string) {
  if (!(await isAdminSession())) return { error: "Unauthenticated" };
  try {
    await prisma.telegramBot.delete({ where: { id } });
    revalidatePath("/admin/settings");
    return { ok: true };
  } catch (error: any) {
    throw error;
  }
}

export async function toggleTelegramBotActiveAction(id: string, active: boolean) {
  if (!(await isAdminSession())) return { error: "Unauthenticated" };
  try {
    await prisma.telegramBot.update({
      where: { id },
      data: { active },
    });
    revalidatePath("/admin/settings");
    return { ok: true };
  } catch (error: any) {
    throw error;
  }
}

export async function syncTelegramWebhooksAction() {
  if (!(await isAdminSession())) return { error: "Unauthenticated" };
  try {
    const { ensureAllBotsWebhooksConfigured } = await import("@/lib/telegram-bots");
    await ensureAllBotsWebhooksConfigured();
    return { ok: true };
  } catch (error: any) {
    console.error("Error syncing telegram webhooks:", error);
    return { error: error.message || "Failed to sync webhooks" };
  }
}

export type NotificationSettingsFormState = {
  ok?: boolean;
  error?: string;
};

export type WhatsappTemplateSettingsState = {
  ok?: boolean;
  error?: string;
};

function formString(formData: FormData, key: string): string {
  const v = formData.get(key);
  return typeof v === "string" ? v.trim() : "";
}

function formBool(formData: FormData, key: string): boolean {
  return formData.get(key) === "on";
}

export async function saveWhatsappTemplateSettings(
  _prev: WhatsappTemplateSettingsState,
  formData: FormData,
): Promise<WhatsappTemplateSettingsState> {
  try {
    if (!(await isAdminSession())) {
      return { error: "غير مصرّح." };
    }
    const employeeShareTemplate = formString(formData, "employeeShareTemplate");
    const customerOrderTemplate = formString(formData, "customerOrderTemplate");
    const telegramNewOrderTemplate = formString(formData, "telegramNewOrderTemplate");

    if (!employeeShareTemplate && !customerOrderTemplate && !telegramNewOrderTemplate) {
      return { error: "يرجى كتابة نص الرسالة." };
    }

    if (employeeShareTemplate) {
      await saveEmployeeWhatsappShareTemplate(employeeShareTemplate);
    }
    if (customerOrderTemplate) {
      await saveCustomerOrderWhatsappTemplate(customerOrderTemplate);
    }
    if (telegramNewOrderTemplate) {
      await saveTelegramNewOrderTemplate(telegramNewOrderTemplate);
    }
    revalidatePath("/admin/settings");
    revalidatePath("/admin/shops");
    return { ok: true };
  } catch (error: any) {
    console.error("Error saving WhatsApp templates:", error);
    return { error: "حدث خطأ: " + (error.message || "خطأ غير معروف") };
  }
}

export async function saveNotificationSettings(
  _prev: NotificationSettingsFormState,
  formData: FormData,
): Promise<NotificationSettingsFormState> {
  try {
    if (!(await isAdminSession())) {
      return { error: "غير مصرّح." };
    }

    const adminTitleSingle = formString(formData, "adminTitleSingle") || DEFAULT_NOTIFICATION_SETTINGS.adminTitleSingle;
    const adminTemplateSingle = formString(formData, "adminTemplateSingle") || DEFAULT_NOTIFICATION_SETTINGS.adminTemplateSingle;
    const adminTemplateMultiple = formString(formData, "adminTemplateMultiple") || DEFAULT_NOTIFICATION_SETTINGS.adminTemplateMultiple;

    const telegramAdminIds = formString(formData, "telegramAdminIds");

    const mandoubTitleSingle = formString(formData, "mandoubTitleSingle") || DEFAULT_NOTIFICATION_SETTINGS.mandoubTitleSingle;
    const mandoubTemplateSingle = formString(formData, "mandoubTemplateSingle") || DEFAULT_NOTIFICATION_SETTINGS.mandoubTemplateSingle;
    const mandoubTemplateMultiple = formString(formData, "mandoubTemplateMultiple") || DEFAULT_NOTIFICATION_SETTINGS.mandoubTemplateMultiple;

    const preparerTitleSingle = formString(formData, "preparerTitleSingle") || DEFAULT_NOTIFICATION_SETTINGS.preparerTitleSingle;
    const preparerTemplateSingle = formString(formData, "preparerTemplateSingle") || DEFAULT_NOTIFICATION_SETTINGS.preparerTemplateSingle;
    const preparerTemplateMultiple = formString(formData, "preparerTemplateMultiple") || DEFAULT_NOTIFICATION_SETTINGS.preparerTemplateMultiple;
    const preparerTemplateWebsite = formString(formData, "preparerTemplateWebsite") || DEFAULT_NOTIFICATION_SETTINGS.preparerTemplateWebsite;

    const adminSoundPreset = normalizeNotificationSoundPreset(formString(formData, "adminSoundPreset"));
    const mandoubSoundPreset = normalizeNotificationSoundPreset(formString(formData, "mandoubSoundPreset"));
    const preparerSoundPreset = normalizeNotificationSoundPreset(formString(formData, "preparerSoundPreset"));

    await prisma.appNotificationSettings.upsert({
      where: { id: 1 },
      create: {
        id: 1,
        adminEnabled: formBool(formData, "adminEnabled"),
        adminTitleSingle,
        adminTemplateSingle,
        adminTemplateMultiple,
        adminSoundEnabled: formBool(formData, "adminSoundEnabled"),
        adminSoundPreset,
        telegramAdminIds,
        mandoubEnabled: formBool(formData, "mandoubEnabled"),
        mandoubTitleSingle,
        mandoubTemplateSingle,
        mandoubTemplateMultiple,
        mandoubSoundEnabled: formBool(formData, "mandoubSoundEnabled"),
        mandoubSoundPreset,
        preparerEnabled: formBool(formData, "preparerEnabled"),
        preparerTitleSingle,
        preparerTemplateSingle,
        preparerTemplateMultiple,
        preparerTemplateWebsite,
        preparerSoundEnabled: formBool(formData, "preparerSoundEnabled"),
        preparerSoundPreset,
      },
      update: {
        adminEnabled: formBool(formData, "adminEnabled"),
        adminTitleSingle,
        adminTemplateSingle,
        adminTemplateMultiple,
        adminSoundEnabled: formBool(formData, "adminSoundEnabled"),
        adminSoundPreset,
        telegramAdminIds,
        mandoubEnabled: formBool(formData, "mandoubEnabled"),
        mandoubTitleSingle,
        mandoubTemplateSingle,
        mandoubTemplateMultiple,
        mandoubSoundEnabled: formBool(formData, "mandoubSoundEnabled"),
        mandoubSoundPreset,
        preparerEnabled: formBool(formData, "preparerEnabled"),
        preparerTitleSingle,
        preparerTemplateSingle,
        preparerTemplateMultiple,
        preparerTemplateWebsite,
        preparerSoundEnabled: formBool(formData, "preparerSoundEnabled"),
        preparerSoundPreset,
      },
    });

    revalidatePath("/admin/settings");
    revalidatePath("/admin/orders/pending");
    revalidatePath("/mandoub");
    revalidatePath("/preparer");
    return { ok: true };
  } catch (error: any) {
    console.error("Error saving notification settings:", error);
    return { error: "حدث خطأ غير متوقع: " + (error.message || "خطأ غير معروف") };
  }
}

export type PurgeDemoCoreDataState = {
  ok?: boolean;
  error?: string;
};

/**
 * تصفير تجريبي شامل (للاختبار فقط):
 * - يمسح المحلات والـ Employees المرتبطين بها
 * - يمسح العملاء
 * - يمسح المجهزين
 * - يمسح المندوبين
 * - يمسح الطلبات ويُعيد تصفير عدّاد `orderNumber`
 *
 * ملاحظة: لا يحذف ملفات الصور من `public/uploads`، فقط الروابط/السجلات داخل PostgreSQL.
 */
export async function purgeDemoCoreData(
  _prev: PurgeDemoCoreDataState,
  formData: FormData,
): Promise<PurgeDemoCoreDataState> {
  if (!(await isAdminSession())) {
    return { error: "غير مصرّح. سجّل الدخول من لوحة الإدارة." };
  }

  const confirm = String(formData.get("confirm") ?? "").trim();
  const required = "مسح شامل";

  if (confirm !== required) {
    return { error: `اكتب «${required}» للتأكيد تماماً.` };
  }

  const deleteOrders = formData.get("target_orders") === "on";
  const deleteCustomers = formData.get("target_customers") === "on";
  const deleteShops = formData.get("target_shops") === "on";
  const deleteRegions = formData.get("target_regions") === "on";

  try {
    if (deleteOrders) {
      await prisma.$executeRawUnsafe('TRUNCATE TABLE "OrderCourierMoneyEvent", "Order" RESTART IDENTITY CASCADE;');
    }
    if (deleteCustomers) {
      await prisma.$executeRawUnsafe('TRUNCATE TABLE "Customer", "CustomerPhoneProfile" RESTART IDENTITY CASCADE;');
    }
    if (deleteShops) {
      await prisma.$executeRawUnsafe('TRUNCATE TABLE "Shop", "Employee", "PreparerShop" RESTART IDENTITY CASCADE;');
    }
    if (deleteRegions) {
      // حذف المناطق يقتضي تصفير كل ما هو مرتبط بها في الأغلب
      await prisma.$executeRawUnsafe('TRUNCATE TABLE "Region", "Shop", "Customer", "CustomerPhoneProfile", "Order" RESTART IDENTITY CASCADE;');
    }

    // إذا لم يتم اختيار أي شيء، نفترض المسح الشامل لكل الجداول الأساسية
    if (!deleteOrders && !deleteCustomers && !deleteShops && !deleteRegions) {
       await prisma.$executeRawUnsafe(`
        TRUNCATE TABLE
          "Order", "Shop", "Customer", "CompanyPreparer", "Courier",
          "CustomerPhoneProfile", "Employee", "Region", "OrderCourierMoneyEvent"
        RESTART IDENTITY CASCADE;
      `);
    }

    revalidatePath("/admin/settings");
    revalidatePath("/admin/orders/pending");
    revalidatePath("/admin/orders/tracking");
    revalidatePath("/admin/preparers");
    revalidatePath("/admin/couriers");
    revalidatePath("/admin/customers");
    revalidatePath("/admin/regions");
    revalidatePath("/mandoub");
    revalidatePath("/preparer", "layout");

    return { ok: true };
  } catch (e: any) {
    return { error: "فشل المسح: " + e.message };
  }
}
