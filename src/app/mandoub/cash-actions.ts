"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { verifyDelegatePortalQuery } from "@/lib/delegate-link";
import { Decimal } from "@prisma/client/runtime/library";
import {
  MONEY_KIND_PICKUP,
  MONEY_KIND_DELIVERY,
} from "@/lib/mandoub-money-events";
import { syncOrderStatusFromActiveMoneyEvents } from "@/lib/mandoub-order-status-from-money";
import { orderExpectedTotal } from "@/lib/mandoub-money";
import { syncPhoneProfileFromOrder } from "@/lib/customer-phone-profile-sync";
import { computeCourierDeliveryEarningDinar } from "@/lib/courier-earnings";
import { appendMandoubLocFlash, safeMandoubReturn } from "@/lib/mandoub-loc-flash-url";

export type MandoubCashState = {
  ok?: boolean;
  error?: string;
  deletedEventId?: string;
  flash?: "saved";
};

export async function recordMandoubPickup(
  _prev: MandoubCashState,
  formData: FormData,
): Promise<MandoubCashState> {
  const orderId = String(formData.get("orderId") ?? "").trim();
  const amountAlfRaw = String(formData.get("amountAlf") ?? "").trim();
  const note = String(formData.get("note") ?? "").trim();
  const next = String(formData.get("next") ?? "").trim();
  const c = String(formData.get("c") ?? "").trim();
  const exp = String(formData.get("exp") ?? "").trim();
  const s = String(formData.get("s") ?? "").trim();

  const v = verifyDelegatePortalQuery(c, exp || undefined, s);
  if (!v.ok) {
    return { error: "الرابط غير صالح." };
  }

  const amountDinar = new Decimal(Number(amountAlfRaw));
  if (amountDinar.lte(0)) {
    return { error: "المبلغ غير صالح." };
  }

  const order = await prisma.order.findFirst({
    where: {
      id: orderId,
      assignedCourierId: v.courierId,
      status: { in: ["assigned", "delivering"] },
    },
    select: {
      id: true,
      orderSubtotal: true,
      customerPhone: true,
      customerRegionId: true,
      status: true,
      shop: { select: { id: true, name: true } },
    },
  });

  if (!order) {
    return { error: "الطلب غير موجود أو لا يخصك." };
  }

  const expectedTotal = order.orderSubtotal;
  if (!expectedTotal) {
    return { error: "سعر الطلب غير محدد." };
  }

  const matchesExpected = amountDinar.equals(expectedTotal);
  let mismatchReason = "";
  let mismatchNote = "";
  if (!matchesExpected) {
    if (amountDinar.gt(expectedTotal)) mismatchReason = "excess";
    else mismatchReason = "deficit";
    if (note) mismatchNote = note;
  }

  await prisma.$transaction(async (tx) => {
    await tx.orderCourierMoneyEvent.create({
      data: {
        orderId: order.id,
        courierId: v.courierId,
        kind: MONEY_KIND_PICKUP,
        amountDinar,
        expectedDinar: expectedTotal,
        matchesExpected,
        mismatchReason,
        mismatchNote: mismatchNote || null,
      },
    });
    await syncOrderStatusFromActiveMoneyEvents(tx, order.id);
  });

  // محاولة مزامنة البروفايل (إذا فشلت، ما تأثر على العملية الأساسية)
  try {
    await syncPhoneProfileFromOrder(order.id);
  } catch (e) {
    console.error("sync failed but pickup recorded", e);
  }

  const returnUrl = appendMandoubLocFlash(safeMandoubReturn(next), "saved");
  redirect(returnUrl);
}

export async function recordMandoubDelivery(
  _prev: MandoubCashState,
  formData: FormData,
): Promise<MandoubCashState> {
  const orderId = String(formData.get("orderId") ?? "").trim();
  const amountAlfRaw = String(formData.get("amountAlf") ?? "").trim();
  const note = String(formData.get("note") ?? "").trim();
  const next = String(formData.get("next") ?? "").trim();
  const c = String(formData.get("c") ?? "").trim();
  const exp = String(formData.get("exp") ?? "").trim();
  const s = String(formData.get("s") ?? "").trim();

  const v = verifyDelegatePortalQuery(c, exp || undefined, s);
  if (!v.ok) {
    return { error: "الرابط غير صالح." };
  }

  const amountDinar = new Decimal(Number(amountAlfRaw));
  if (amountDinar.lte(0)) {
    return { error: "المبلغ غير صالح." };
  }

  const order = await prisma.order.findFirst({
    where: {
      id: orderId,
      OR: [
        { assignedCourierId: v.courierId },
        { courierEarningForCourierId: v.courierId },
      ],
      status: { in: ["assigned", "delivering"] },
    },
    select: {
      id: true,
      totalAmount: true,
      deliveryPrice: true,
      courierEarningDinar: true,
      courier: { select: { vehicleType: true } },
      assignedCourierId: true,
      status: true,
      orderSubtotal: true,
      customerPhone: true,
      customerRegionId: true,
    },
  });

  if (!order) {
    return { error: "الطلب غير موجود أو لا يخصك." };
  }

  const expectedTotal = order.totalAmount;
  if (!expectedTotal) {
    return { error: "المبلغ الكلي غير محدد." };
  }

  const matchesExpected = amountDinar.equals(expectedTotal);
  let mismatchReason = "";
  let mismatchNote = "";
  if (!matchesExpected) {
    if (amountDinar.gt(expectedTotal)) mismatchReason = "excess";
    else mismatchReason = "deficit";
    if (note) mismatchNote = note;
  }

  await prisma.$transaction(async (tx) => {
    await tx.orderCourierMoneyEvent.create({
      data: {
        orderId: order.id,
        courierId: v.courierId,
        kind: MONEY_KIND_DELIVERY,
        amountDinar,
        expectedDinar: expectedTotal,
        matchesExpected,
        mismatchReason,
        mismatchNote: mismatchNote || null,
      },
    });

    // تحديث أجر المندوب إذا كان التسليم كاملاً
    const deliveryEv = await tx.orderCourierMoneyEvent.findFirst({
      where: { orderId: order.id, kind: MONEY_KIND_DELIVERY, deletedAt: null },
    });
    if (deliveryEv && order.deliveryPrice) {
      const courier = await tx.courier.findUnique({
        where: { id: v.courierId },
      });
      if (courier) {
        const earning = computeCourierDeliveryEarningDinar(
          courier.vehicleType,
          order.deliveryPrice,
        );
        if (earning) {
          await tx.order.update({
            where: { id: order.id },
            data: {
              courierEarningDinar: earning,
              courierEarningForCourierId: v.courierId,
            },
          });
        }
      }
    }

    await syncOrderStatusFromActiveMoneyEvents(tx, order.id);
  });

  try {
    await syncPhoneProfileFromOrder(order.id);
  } catch (e) {
    console.error("sync failed but delivery recorded", e);
  }

  const returnUrl = appendMandoubLocFlash(safeMandoubReturn(next), "saved");
  redirect(returnUrl);
}

export async function softDeleteMandoubMoneyEvent(
  _prev: MandoubCashState,
  formData: FormData,
): Promise<MandoubCashState> {
  const eventId = String(formData.get("eventId") ?? "").trim();
  const next = String(formData.get("next") ?? "").trim();
  const c = String(formData.get("c") ?? "").trim();
  const exp = String(formData.get("exp") ?? "").trim();
  const s = String(formData.get("s") ?? "").trim();

  const v = verifyDelegatePortalQuery(c, exp || undefined, s);
  if (!v.ok) {
    return { error: "الرابط غير صالح." };
  }

  const ev = await prisma.orderCourierMoneyEvent.findFirst({
    where: {
      id: eventId,
      courierId: v.courierId,
      deletedAt: null,
    },
    select: { id: true, orderId: true, recordedByCompanyPreparerId: true },
  });

  if (!ev) {
    return { error: "المعاملة غير موجودة." };
  }

  if (ev.recordedByCompanyPreparerId) {
    return {
      error:
        "هذه المعاملة سجّلها المجهز. لا يمكن إلغاؤها من لوحة المندوب.",
    };
  }

  await prisma.$transaction(async (tx) => {
    await tx.orderCourierMoneyEvent.update({
      where: { id: eventId },
      data: {
        deletedAt: new Date(),
        deletedReason: "manual_courier",
        deletedByDisplayName: "مندوب",
      },
    });
    await syncOrderStatusFromActiveMoneyEvents(tx, ev.orderId);
  });

  revalidatePath(`/mandoub/order/${ev.orderId}`);
  const url = new URL(next, "http://placeholder");
  const returnUrl = appendMandoubLocFlash(safeMandoubReturn(next), "saved");
  redirect(returnUrl);
}

export async function softDeleteMandoubMoneyEventAdmin(
  _prev: MandoubCashState,
  formData: FormData,
): Promise<MandoubCashState> {
  const eventId = String(formData.get("eventId") ?? "").trim();
  const next = String(formData.get("next") ?? "").trim();

  const ev = await prisma.orderCourierMoneyEvent.findFirst({
    where: { id: eventId, deletedAt: null },
    select: { id: true, orderId: true },
  });

  if (!ev) {
    return { error: "المعاملة غير موجودة." };
  }

  await prisma.$transaction(async (tx) => {
    await tx.orderCourierMoneyEvent.update({
      where: { id: eventId },
      data: {
        deletedAt: new Date(),
        deletedReason: "manual_admin",
        deletedByDisplayName: "لوحة الإدارة",
      },
    });
    await syncOrderStatusFromActiveMoneyEvents(tx, ev.orderId);
  });

  revalidatePath(next);
  return { ok: true, deletedEventId: eventId };
}

export async function hardDeleteOrderCourierMoneyEventAdmin(
  _prev: MandoubCashState,
  formData: FormData,
): Promise<MandoubCashState> {
  const eventId = String(formData.get("eventId") ?? "").trim();
  const next = String(formData.get("next") ?? "").trim();
  const confirmPhrase = String(formData.get("confirmPhrase") ?? "").trim();

  if (confirmPhrase !== "حذف نهائي") {
    return { error: "اكتب «حذف نهائي» للتأكيد." };
  }

  const ev = await prisma.orderCourierMoneyEvent.findFirst({
    where: { id: eventId },
    select: { id: true, orderId: true },
  });

  if (!ev) {
    return { error: "المعاملة غير موجودة." };
  }

  await prisma.$transaction(async (tx) => {
    await tx.orderCourierMoneyEvent.delete({ where: { id: eventId } });
    await syncOrderStatusFromActiveMoneyEvents(tx, ev.orderId);
  });

  revalidatePath(next);
  return { ok: true, deletedEventId: eventId };
}