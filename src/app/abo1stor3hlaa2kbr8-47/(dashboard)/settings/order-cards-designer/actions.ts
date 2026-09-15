"use server";

import { revalidatePath } from "next/cache";
import {
  saveOrderCardsDesignerConfig,
  type OrderCardDesignerConfig,
} from "@/lib/order-card-customizer";

export async function updateOrderCardsDesignerAction(
  config: Partial<OrderCardDesignerConfig>
): Promise<{ ok: boolean; error?: string }> {
  try {
    const success = await saveOrderCardsDesignerConfig(config);
    if (!success) {
      return { ok: false, error: "فشل حفظ إعدادات التصميم في قاعدة البيانات." };
    }

    revalidatePath("/abo1stor3hlaa2kbr8-47", "layout");
    revalidatePath("/abo1stor3hlaa2kbr8-47/orders", "layout");
    revalidatePath("/mandoub", "layout");
    revalidatePath("/preparer", "layout");
    revalidatePath("/staff/portal", "layout");
    revalidatePath("/", "layout");

    return { ok: true };
  } catch (error: any) {
    return { ok: false, error: error?.message || "حدث خطأ غير متوقع." };
  }
}
