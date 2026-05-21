"use server";

import { revalidatePath } from "next/cache";
import { saveUISettings, UISectionConfig } from "@/lib/ui-settings";

export async function updateUISectionAction(target: string, section: string, config: UISectionConfig) {
  try {
    await saveUISettings(target, section, config);
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (e) {
    console.error(e);
    return { error: "فشل في حفظ الإعدادات" };
  }
}
