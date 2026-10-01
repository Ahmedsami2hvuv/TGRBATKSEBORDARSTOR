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

    let targetShopId = (shopId || "").trim();
    if (!targetShopId && orderId) {
      const ord = await prisma.order.findUnique({
        where: { id: orderId },
        select: { shopId: true },
      });
      targetShopId = ord?.shopId || "";
    }

    if (targetShopId) {
      await prisma.shop.update({
        where: { id: targetShopId },
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

export async function updateShopOwnerNameAction(
  orderId: string,
  shopId: string,
  newOwnerName: string
): Promise<{ ok: boolean; error?: string; ownerName?: string }> {
  try {
    const raw = newOwnerName.trim();
    if (!raw) {
      return { ok: false, error: "يرجى كتابة اسم العميل" };
    }

    let targetShopId = (shopId || "").trim();
    if (!targetShopId && orderId) {
      const ord = await prisma.order.findUnique({
        where: { id: orderId },
        select: { shopId: true },
      });
      targetShopId = ord?.shopId || "";
    }

    if (targetShopId) {
      await prisma.shop.update({
        where: { id: targetShopId },
        data: { ownerName: raw },
      });
    }

    if (orderId) {
      revalidatePath(`/mandoub/order/${orderId}`);
      revalidatePath(`/abo1stor3hlaa2kbr8-47/orders/${orderId}`);
      revalidatePath("/mandoub");
      revalidatePath("/abo1stor3hlaa2kbr8-47/orders");
    }

    return { ok: true, ownerName: raw };
  } catch (err: any) {
    console.error("[updateShopOwnerNameAction] Error:", err);
    return { ok: false, error: err?.message || "تعذر حفظ اسم العميل" };
  }
}
