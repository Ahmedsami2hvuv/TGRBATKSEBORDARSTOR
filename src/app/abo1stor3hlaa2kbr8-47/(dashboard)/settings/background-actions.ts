"use server";

import { revalidatePath } from "next/cache";
import { getBackgroundsConfig, saveBackgroundsConfig, type BackgroundsConfig } from "@/lib/background-settings";

export async function getBackgroundsConfigAction() {
  return await getBackgroundsConfig();
}

export async function saveBackgroundsConfigAction(config: BackgroundsConfig) {
  try {
    const result = await saveBackgroundsConfig(config);
    revalidatePath("/");
    return { success: true, result };
  } catch (error: any) {
    return { success: false, error: error?.message || "حدث خطأ غير متوقع" };
  }
}
