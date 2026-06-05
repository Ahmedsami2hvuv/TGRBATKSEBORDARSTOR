"use server";

import { revalidatePath } from "next/cache";
import { isAdminSession } from "@/lib/admin-session";
import { prisma } from "@/lib/prisma";
import { DEFAULT_NOTIFICATION_SETTINGS } from "@/lib/notification-settings";
import { normalizeNotificationSoundPreset } from "@/lib/notification-sound-presets";
import { saveEmployeeWhatsappShareTemplate, saveCustomerOrderWhatsappTemplate } from "@/lib/whatsapp-template-settings";
import { saveTelegramNewOrderTemplate } from "@/lib/telegram-notify";

import { GlobalIconsConfig, saveGlobalIcons } from "@/lib/icon-settings";
import { setChatEnabledGlobally, setTrackingEnabledGlobally } from "@/lib/portal-chat-settings";
import { RoleFeaturesConfig, saveRoleFeatures } from "@/lib/role-features-settings";
import { ensureTelegramWebhookConfigured } from "@/lib/telegram";
import { setChosenFont } from "@/lib/font-settings";

const SECRET_ADMIN_PATH = "/abo1stor3hlaa2kbr8-47";

export async function saveChosenFontAction(fontName: string) {
  if (!(await isAdminSession())) return { error: "Unauthenticated" };
  await setChosenFont(fontName);
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function saveGlobalIconsAction(config: GlobalIconsConfig) {
  if (!(await isAdminSession())) return { error: "Unauthenticated" };
  await saveGlobalIcons(config);
  revalidatePath(`${SECRET_ADMIN_PATH}/settings`);
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function saveChatSettingsAction(enabled: boolean) {
  if (!(await isAdminSession())) return { error: "Unauthenticated" };
  await setChatEnabledGlobally(enabled);
  revalidatePath(`${SECRET_ADMIN_PATH}/settings`);
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function saveTrackingSettingsAction(enabled: boolean) {
  if (!(await isAdminSession())) return { error: "Unauthenticated" };
  await setTrackingEnabledGlobally(enabled);
  revalidatePath(`${SECRET_ADMIN_PATH}/settings`);
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function saveRoleFeaturesAction(role: "mandoub" | "preparer", config: RoleFeaturesConfig) {
  if (!(await isAdminSession())) return { error: "Unauthenticated" };
  await saveRoleFeatures(role, config);
  revalidatePath(`${SECRET_ADMIN_PATH}/settings`);
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
    revalidatePath(`${SECRET_ADMIN_PATH}/settings`);
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
    revalidatePath(`${SECRET_ADMIN_PATH}/settings`);
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
    revalidatePath(`${SECRET_ADMIN_PATH}/settings`);
    return { ok: true };
  } catch (error: any) {
    return { error: error.message || "Failed to add Telegram Admin" };
  }
}

export async function deleteTelegramAdminAction(id: string) {
  if (!(await isAdminSession())) return { error: "Unauthenticated" };
  try {
    await prisma.telegramAdmin.delete({ where: { id } });
    revalidatePath(`${SECRET_ADMIN_PATH}/settings`);
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
    revalidatePath(`${SECRET_ADMIN_PATH}/settings`);
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
    revalidatePath(`${SECRET_ADMIN_PATH}/settings`);
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
    revalidatePath(`${SECRET_ADMIN_PATH}/settings`);
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
    revalidatePath(`${SECRET_ADMIN_PATH}/settings`);
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
    revalidatePath(`${SECRET_ADMIN_PATH}/settings`);
    revalidatePath(`${SECRET_ADMIN_PATH}/shops`);
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

    revalidatePath(`${SECRET_ADMIN_PATH}/settings`);
    revalidatePath(`${SECRET_ADMIN_PATH}/orders/pending`);
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
  const required = "مسح الطلبات";

  if (confirm !== required) {
    return { error: `اكتب «${required}» للتأكيد تماماً.` };
  }

  try {
    // تصفير كافة الطلبات والمسودات والحسابات المرتبطة بها نهائياً وإعادة متسلسلة الترقيم للرقم 1
    await prisma.$executeRawUnsafe(`
      TRUNCATE TABLE 
        "OrderCourierMoneyEvent",
        "Order",
        "CompanyPreparerShoppingDraft",
        "PreparerHiddenDebt",
        "CompanyPreparerPrepNotice"
      RESTART IDENTITY CASCADE;
    `);

    await prisma.$executeRawUnsafe('ALTER SEQUENCE IF EXISTS "Order_orderNumber_seq" RESTART WITH 1;');
    await prisma.$executeRawUnsafe('ALTER SEQUENCE IF EXISTS "CompanyPreparerShoppingDraft_draftNumber_seq" RESTART WITH 1;');

    revalidatePath(`${SECRET_ADMIN_PATH}/settings`);
    revalidatePath(`${SECRET_ADMIN_PATH}/orders/pending`);
    revalidatePath(`${SECRET_ADMIN_PATH}/orders/tracking`);
    revalidatePath("/mandoub");
    revalidatePath("/preparer", "layout");

    return { ok: true };
  } catch (e: any) {
    return { error: "فشل مسح الطلبات: " + e.message };
  }
}

export async function uploadFontAction(formData: FormData) {
  if (!(await isAdminSession())) return { error: "Unauthenticated" };

  try {
    const fs = await import("fs");
    const path = await import("path");

    const fontName = formData.get("fontName") as string;
    const fontFile = formData.get("fontFile") as File;

    if (!fontName || !fontName.trim()) {
      return { error: "يرجى كتابة اسم الخط." };
    }

    if (!fontFile || fontFile.size === 0) {
      return { error: "يرجى اختيار ملف الخط المرفوع." };
    }

    // تنظيف اسم الخط ليكون اسماً آمناً للملف (السماح بالحروف العربية والأجنبية والأرقام والمسافات والشرطات)
    // لتسهيل كتابة الأسماء باللغة العربية، سننظف فقط الرموز الخاصة بالملفات والمسارات
    const cleanFontName = fontName.replace(/[\/\\:\*\?"<>\|]/g, "").trim();
    if (!cleanFontName) {
      return { error: "اسم الخط يحتوي على رموز غير صالحة لأسماء الملفات." };
    }

    const originalName = fontFile.name;
    const ext = path.extname(originalName).toLowerCase();
    
    // الصيغ المدعومة للخطوط
    const allowedExtensions = [".ttf", ".otf", ".woff", ".woff2", ".eot", ".svg", ".ttc", ".dfont"];
    if (!allowedExtensions.includes(ext)) {
      return { error: "صيغة الملف غير مدعومة كخط. الصيغ المدعومة هي: ttf, otf, woff, woff2, eot, svg, ttc, dfont" };
    }

    const root = process.cwd();
    const fontsDir = path.join(root, "public", "fonts");

    // التأكد من وجود المجلد
    if (!fs.existsSync(fontsDir)) {
      fs.mkdirSync(fontsDir, { recursive: true });
    }

    // كتابة الملف
    const bytes = await fontFile.arrayBuffer();
    const buffer = Buffer.from(bytes);
    
    const targetPath = path.join(fontsDir, `${cleanFontName}${ext}`);
    
    await fs.promises.writeFile(targetPath, buffer);

    revalidatePath("/", "layout");
    revalidatePath(`${SECRET_ADMIN_PATH}/settings`);

    return { ok: true, fontName: cleanFontName };
  } catch (error: any) {
    console.error("Error uploading font:", error);
    return { error: "حدث خطأ أثناء رفع الخط: " + (error.message || "خطأ غير معروف") };
  }
}

