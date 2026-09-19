"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { normalizeIraqMobileLocal11 } from "@/lib/whatsapp";

export async function updateShopPhoneAction(
  orderId: string,
  shopId: string,
  newPhone: string
): Promise<{ ok: boolean; error?: string; phone?: string }> {
  try {
    const raw = newPhone.trim();
    if (!raw) {
      return { ok: false, error: "يرجى كتابة رقم الهاتف" };
    }

    const normalized = normalizeIraqMobileLocal11(raw) || raw;

    if (shopId) {
      await prisma.shop.update({
        where: { id: shopId },
        data: { phone: normalized },
      });
    }

    if (orderId) {
      revalidatePath(`/mandoub/order/${orderId}`);
      revalidatePath(`/abo1stor3hlaa2kbr8-47/orders/${orderId}`);
      revalidatePath("/mandoub");
      revalidatePath("/abo1stor3hlaa2kbr8-47/orders");
    }

    return { ok: true, phone: normalized };
  } catch (err: any) {
    console.error("[updateShopPhoneAction] Error:", err);
    return { ok: false, error: err?.message || "تعذر حفظ رقم الهاتف" };
  }
}
