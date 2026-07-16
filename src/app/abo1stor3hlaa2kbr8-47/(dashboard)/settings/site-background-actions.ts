"use server";

import { revalidatePath } from "next/cache";
import { getBackgroundsConfig, saveBackgroundsConfig, type BackgroundsConfig } from "@/lib/background-settings";

/**
 * جلب قائمة الخلفيات المتاحة للموقع
 */
export async function getSiteBackgroundsConfigAction() {
  try {
    return await getBackgroundsConfig();
  } catch (error) {
    console.error("فشل جلب إعدادات الخلفية من السيرفر:", error);
    return { items: [], defaultBackgroundId: "" };
  }
}

/**
 * حفظ قائمة الخلفيات وإعادة تهيئة الصفحات
 */
export async function saveSiteBackgroundsConfigAction(config: BackgroundsConfig) {
  try {
    const result = await saveBackgroundsConfig(config);
    revalidatePath("/");
    return { success: true, result };
  } catch (error: any) {
    console.error("فشل حفظ إعدادات الخلفية:", error);
    return { success: false, error: error?.message || "حدث خطأ أثناء الحفظ" };
  }
}
