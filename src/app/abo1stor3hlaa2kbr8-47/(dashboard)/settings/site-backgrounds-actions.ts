"use server";

import { revalidatePath } from "next/cache";
import { getStaticBackgroundsConfig, saveStaticBackgroundsConfig, type StaticBackgroundsConfig } from "@/lib/site-backgrounds";

/**
 * جلب قائمة الخلفيات الثابتة المتاحة
 */
export async function getStaticBackgroundsConfigAction() {
  try {
    return await getStaticBackgroundsConfig();
  } catch (error) {
    console.error("فشل جلب إعدادات الخلفية الثابتة من السيرفر:", error);
    return { items: [], defaultBackgroundId: "" };
  }
}

/**
 * حفظ قائمة الخلفيات الثابتة وإعادة بناء الصفحة الرئيسية
 */
export async function saveStaticBackgroundsConfigAction(config: StaticBackgroundsConfig) {
  try {
    const result = await saveStaticBackgroundsConfig(config);
    revalidatePath("/");
    return { success: true, result };
  } catch (error: any) {
    console.error("فشل حفظ إعدادات الخلفية الثابتة:", error);
    return { success: false, error: error?.message || "حدث خطأ أثناء حفظ التحديثات" };
  }
}
