"use server";

import { revalidatePath } from "next/cache";
import { isAdminSession } from "@/lib/admin-session";
import { prisma } from "@/lib/prisma";
import { DEFAULT_NOTIFICATION_SETTINGS } from "@/lib/notification-settings";
import { normalizeNotificationSoundPreset } from "@/lib/notification-sound-presets";

export type NotificationSettingsFormState = {
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

export async function saveNotificationSettings(
  _prev: NotificationSettingsFormState,
  formData: FormData,
): Promise<NotificationSettingsFormState> {
  const adminTemplateSingle = formString(formData, "adminTemplateSingle");
  const adminTemplateMultiple = formString(formData, "adminTemplateMultiple");
  const mandoubTemplateSingle = formString(formData, "mandoubTemplateSingle");
  const mandoubTemplateMultiple = formString(formData, "mandoubTemplateMultiple");
  const adminSoundPreset = normalizeNotificationSoundPreset(formString(formData, "adminSoundPreset"));
  const mandoubSoundPreset = normalizeNotificationSoundPreset(formString(formData, "mandoubSoundPreset"));

  if (!adminTemplateSingle || !adminTemplateMultiple) {
    return { error: "يرجى إدخال نص إشعارات الإدارة (مفرد ومتعدد)." };
  }
  if (!mandoubTemplateSingle || !mandoubTemplateMultiple) {
    return { error: "يرجى إدخال نص إشعارات المندوب (مفرد ومتعدد)." };
  }

  await prisma.appNotificationSettings.upsert({
    where: { id: 1 },
    create: {
      id: 1,
      ...DEFAULT_NOTIFICATION_SETTINGS,
      adminEnabled: formBool(formData, "adminEnabled"),
      adminTemplateSingle,
      adminTemplateMultiple,
      adminSoundEnabled: formBool(formData, "adminSoundEnabled"),
      adminSoundPreset,
      mandoubEnabled: formBool(formData, "mandoubEnabled"),
      mandoubTemplateSingle,
      mandoubTemplateMultiple,
      mandoubSoundEnabled: formBool(formData, "mandoubSoundEnabled"),
      mandoubSoundPreset,
    },
    update: {
      adminEnabled: formBool(formData, "adminEnabled"),
      adminTemplateSingle,
      adminTemplateMultiple,
      adminSoundEnabled: formBool(formData, "adminSoundEnabled"),
      adminSoundPreset,
      mandoubEnabled: formBool(formData, "mandoubEnabled"),
      mandoubTemplateSingle,
      mandoubTemplateMultiple,
      mandoubSoundEnabled: formBool(formData, "mandoubSoundEnabled"),
      mandoubSoundPreset,
    },
  });

  revalidatePath("/admin/settings");
  revalidatePath("/admin/orders/pending");
  revalidatePath("/mandoub");
  return { ok: true };
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
