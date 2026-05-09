"use server";

import { Decimal } from "@prisma/client/runtime/library";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { verifyCompanyPreparerPortalQuery } from "@/lib/company-preparer-portal-link";
import {
  dinarAmountsMatchExpected,
  MONEY_KIND_DELIVERY,
  MONEY_KIND_PICKUP,
} from "@/lib/mandoub-money-events";
import { parseAlfInputToDinarDecimalRequired } from "@/lib/money-alf";
import { prisma } from "@/lib/prisma";
import { reconcileMoneyEventsOnOrderStatusChange } from "@/lib/order-money-reconcile";
import { syncOrderStatusFromActiveMoneyEvents } from "@/lib/mandoub-order-status-from-money";
import { computeCourierDeliveryEarningDinar } from "@/lib/courier-earnings";

export type PreparerCashState = { error?: string };

function safePreparerReturn(next: string): string {
  if (!next.startsWith("/preparer")) return "/preparer";
  return next;
}

function withRefreshParam(url: string): string {
  const sep = url.includes("?") ? "&" : "?";
  return `${url}${sep}__r=${Date.now()}`;
}

function revalidatePreparerPaths(nextUrl: string) {
  revalidatePath("/preparer");
  revalidatePath("/preparer/wallet");
  const path = nextUrl.split("?")[0];
  if (path.startsWith("/preparer/order/")) revalidatePath(path);
  // قد يكون هناك مندوب مسند للطلب؛ تحديث صفحات المندوب لا يضر حتى لو لم يكن.
  revalidatePath("/mandoub");
  revalidatePath("/mandoub/wallet");
  revalidatePath("/admin/orders/tracking");
}

function mismatchNoteRequiredError(): PreparerCashState {
  return { error: "المبلغ مختلف — اكتب السبب." };
}

async function loadPreparerAndAssertAccess(input: {
  p: string;
  exp: string;
  s: string;
  orderId: string;
  requireAssignedCourier?: boolean;
}) {
  const v = verifyCompanyPreparerPortalQuery(input.p, input.exp, input.s);
  if (!v.ok) return { ok: false as const, error: "الرابط غير صالح." };

  const preparer = await prisma.companyPreparer.findFirst({
    where: { id: v.preparerId, active: true },
    include: { shopLinks: { select: { shopId: true } } },
  });
  if (!preparer) return { ok: false as const, error: "الحساب غير متاح." };

  const order = await prisma.order.findUnique({
    where: { id: input.orderId },
    select: {
      id: true,
      status: true,
      orderSubtotal: true,
      totalAmount: true,
      deliveryPrice: true,
      assignedCourierId: true,
      shopId: true,
    },
  });
  if (!order) return { ok: false as const, error: "الطلب غير موجود." };

  const allowed = preparer.shopLinks.some((l) => l.shopId === order.shopId);
  if (!allowed) return { ok: false as const, error: "لا صلاحية لهذا الطلب." };
  if (input.requireAssignedCourier !== false && !order.assignedCourierId) {
    return { ok: false as const, error: "لا يوجد مندوب مسند للطلب." };
  }

  return { ok: true as const, preparer, order, courierId: order.assignedCourierId ?? null };
}

export async function submitPreparerPickupMoney(
  _prev: PreparerCashState,
  formData: FormData,
): Promise<PreparerCashState> {
  const p = String(formData.get("p") ?? "");
  const exp = String(formData.get("exp") ?? "");
  const s = String(formData.get("s") ?? "");
  const orderId = String(formData.get("orderId") ?? "").trim();
  const nextRaw = String(formData.get("next") ?? "/preparer");
  const amountRaw = String(formData.get("amountAlf") ?? "").trim();
  const mismatchNote = String(formData.get("mismatchNote") ?? "").trim();
  const advanceStatus = String(formData.get("advanceStatus") ?? "").trim();
  const statusAdvanceOnly = formData.get("statusAdvanceOnly") === "1";
  const submitMode = String(formData.get("mandoubMoneySubmitMode") ?? "").trim();
  const assignToCourierId = String(formData.get("assignToCourierId") ?? "").trim();

  if (!orderId) return { error: "معرّف الطلب مفقود." };

  const a = await loadPreparerAndAssertAccess({
    p,
    exp,
    s,
    orderId,
    requireAssignedCourier: false,
  });
  if (!a.ok) return { error: a.error };

  // إذا تم اختيار مندوب للإسناد
  let finalCourierId = a.courierId;
  if (assignToCourierId && !a.courierId) {
    const courierExists = await prisma.courier.findUnique({ where: { id: assignToCourierId } });
    if (courierExists) {
      finalCourierId = assignToCourierId;
    }
  }

  const expected = a.order.orderSubtotal;
  if (expected == null) return { error: "سعر الطلب غير محدد في النظام." };

  const agg = await prisma.orderCourierMoneyEvent.aggregate({
    where: { orderId, kind: MONEY_KIND_PICKUP, deletedAt: null },
    _sum: { amountDinar: true },
  });
  const paidSoFar = agg._sum.amountDinar ?? new Decimal(0);

  const pickupStatusOnly =
    advanceStatus === "delivering" &&
    (a.order.status === "assigned" || (a.order.status === "pending" && finalCourierId)) &&
    (statusAdvanceOnly || submitMode === "statusOnlyNoAmount");

  if (pickupStatusOnly) {
    if (paidSoFar.greaterThan(0) && !dinarAmountsMatchExpected(paidSoFar, expected) && !mismatchNote.trim()) {
      return mismatchNoteRequiredError();
    }
    await prisma.$transaction(async (tx) => {
      if (assignToCourierId && !a.order.assignedCourierId) {
        await tx.order.update({ where: { id: orderId }, data: { assignedCourierId: assignToCourierId } });
      }
      await reconcileMoneyEventsOnOrderStatusChange(tx, orderId, a.order.status as any, "delivering");
      await tx.order.update({
        where: { id: orderId },
        data: {
          status: "delivering",
          customerPaymentReceivedAt: new Date(),
        },
      });
    });
    revalidatePreparerPaths(nextRaw);
    redirect(safePreparerReturn(nextRaw));
  }

  const parsed = parseAlfInputToDinarDecimalRequired(amountRaw);
  if (!parsed.ok) return { error: "أدخل المبلغ  بشكل صحيح." };
  const amountDinar = new Decimal(parsed.value);
  if (amountDinar.lte(0)) return { error: "أدخل مبلغاً أكبر من صفر." };

  const nextPaid = paidSoFar.plus(amountDinar);
  const matches = dinarAmountsMatchExpected(nextPaid, expected);
  if (!matches && !mismatchNote.trim()) return mismatchNoteRequiredError();

  await prisma.$transaction(async (tx) => {
    // إسناد المندوب إذا لم يكن مسنداً وتم اختياره
    if (assignToCourierId && !a.order.assignedCourierId) {
      await tx.order.update({ where: { id: orderId }, data: { assignedCourierId: assignToCourierId } });
    }

    await tx.orderCourierMoneyEvent.create({
      data: {
        orderId,
        courierId: finalCourierId,
        kind: MONEY_KIND_PICKUP,
        amountDinar,
        expectedDinar: expected,
        matchesExpected: matches,
        mismatchReason: "",
        mismatchNote,
        recordedByCompanyPreparerId: a.preparer.id,
      },
    });
    if (advanceStatus === "delivering" && (a.order.status === "assigned" || (a.order.status === "pending" && finalCourierId))) {
      await reconcileMoneyEventsOnOrderStatusChange(tx, orderId, a.order.status as any, "delivering");
      await tx.order.update({
        where: { id: orderId },
        data: {
          status: "delivering",
          customerPaymentReceivedAt: new Date(),
        },
      });
    }
  });

  revalidatePreparerPaths(nextRaw);
  redirect(withRefreshParam(safePreparerReturn(nextRaw)));
}

export async function submitPreparerDeliveryMoney(
  _prev: PreparerCashState,
  formData: FormData,
): Promise<PreparerCashState> {
  const p = String(formData.get("p") ?? "");
  const exp = String(formData.get("exp") ?? "");
  const s = String(formData.get("s") ?? "");
  const orderId = String(formData.get("orderId") ?? "").trim();
  const nextRaw = String(formData.get("next") ?? "/preparer");
  const amountRaw = String(formData.get("amountAlf") ?? "").trim();
  const mismatchNote = String(formData.get("mismatchNote") ?? "").trim();
  const advanceStatus = String(formData.get("advanceStatus") ?? "").trim();
  const statusAdvanceOnly = formData.get("statusAdvanceOnly") === "1";
  const submitMode = String(formData.get("mandoubMoneySubmitMode") ?? "").trim();

  if (!orderId) return { error: "معرّف الطلب مفقود." };

  const a = await loadPreparerAndAssertAccess({ p, exp, s, orderId, requireAssignedCourier: false });
  if (!a.ok) return { error: a.error };

  const expected = a.order.totalAmount;
  if (expected == null) return { error: "السعر الكلي غير محدد في النظام." };

  const agg = await prisma.orderCourierMoneyEvent.aggregate({
    where: { orderId, kind: MONEY_KIND_DELIVERY, deletedAt: null },
    _sum: { amountDinar: true },
  });
  const receivedSoFar = agg._sum.amountDinar ?? new Decimal(0);

  const deliveryStatusOnly =
    advanceStatus === "delivered" &&
    a.order.status === "delivering" &&
    (statusAdvanceOnly || submitMode === "statusOnlyNoAmount");

  if (deliveryStatusOnly) {
    if (receivedSoFar.greaterThan(0) && !dinarAmountsMatchExpected(receivedSoFar, expected) && !mismatchNote.trim()) {
      return mismatchNoteRequiredError();
    }
    await prisma.$transaction(async (tx) => {
      await reconcileMoneyEventsOnOrderStatusChange(tx, orderId, "delivering", "delivered");
      const deliveryEv = await tx.orderCourierMoneyEvent.findFirst({
        where: { orderId, kind: MONEY_KIND_DELIVERY, deletedAt: null },
        orderBy: { createdAt: "desc" },
      });
      const earningCourierId = deliveryEv?.courierId ?? a.courierId;
      let earning: Decimal | null = null;
      let earningFor: string | null = null;
      if (earningCourierId && a.order.deliveryPrice != null) {
        const cr = await tx.courier.findUnique({ where: { id: earningCourierId } });
        if (cr) {
          earning = computeCourierDeliveryEarningDinar(cr.vehicleType, a.order.deliveryPrice);
          earningFor = earning != null ? earningCourierId : null;
        }
      }
      await tx.order.update({
        where: { id: orderId },
        data: { status: "delivered", courierEarningDinar: earning, courierEarningForCourierId: earningFor },
      });
    });
    revalidatePreparerPaths(nextRaw);
    redirect(safePreparerReturn(nextRaw));
  }

  const parsed = parseAlfInputToDinarDecimalRequired(amountRaw);
  if (!parsed.ok) return { error: "أدخل المبلغ  بشكل صحيح." };
  const amountDinar = new Decimal(parsed.value);
  if (amountDinar.lte(0)) return { error: "أدخل مبلغاً أكبر من صفر." };

  const nextReceived = receivedSoFar.plus(amountDinar);
  const matches = dinarAmountsMatchExpected(nextReceived, expected);
  if (!matches && !mismatchNote.trim()) return mismatchNoteRequiredError();

  await prisma.$transaction(async (tx) => {
    await tx.orderCourierMoneyEvent.create({
      data: {
        orderId,
        courierId: a.courierId,
        kind: MONEY_KIND_DELIVERY,
        amountDinar,
        expectedDinar: expected,
        matchesExpected: matches,
        mismatchReason: "",
        mismatchNote,
        recordedByCompanyPreparerId: a.preparer.id,
      },
    });
    if (advanceStatus === "delivered" && a.order.status === "delivering") {
      await reconcileMoneyEventsOnOrderStatusChange(tx, orderId, "delivering", "delivered");
    }
    await tx.order.update({
      where: { id: orderId },
      data: advanceStatus === "delivered" && a.order.status === "delivering" ? { status: "delivered" } : {},
    });
  });

  revalidatePreparerPaths(nextRaw);
  redirect(safePreparerReturn(nextRaw));
}

export async function softDeletePreparerMoneyEvent(
  _prev: PreparerCashState,
  formData: FormData,
): Promise<PreparerCashState> {
  const p = String(formData.get("p") ?? "");
  const exp = String(formData.get("exp") ?? "");
  const s = String(formData.get("s") ?? "");
  const eventId = String(formData.get("eventId") ?? "").trim();
  const nextRaw = String(formData.get("next") ?? "/preparer");

  if (!eventId) return { error: "معرّف المعاملة مفقود." };

  const v = verifyCompanyPreparerPortalQuery(p, exp, s);
  if (!v.ok) return { error: "الرابط غير صالح." };

  const preparer = await prisma.companyPreparer.findFirst({
    where: { id: v.preparerId, active: true },
    include: { shopLinks: { select: { shopId: true } } },
  });
  if (!preparer) return { error: "الحساب غير متاح." };

  const ev = await prisma.orderCourierMoneyEvent.findFirst({
    where: { id: eventId, deletedAt: null },
    include: { order: true },
  });
  if (!ev) return { error: "المعاملة غير موجودة." };

  const allowed = preparer.shopLinks.some((l) => l.shopId === ev.order.shopId);
  if (!allowed) return { error: "لا صلاحية." };

  if (ev.recordedByCompanyPreparerId == null) {
    return { error: "لا يمكن حذف معاملة سجّلها المندوب — من لوحة المندوب أو الإدارة." };
  }
  if (ev.recordedByCompanyPreparerId !== preparer.id) {
    return { error: "سجّلها مجهز آخر — لا يمكنك حذفها من حسابك." };
  }

  const deletedBy = `مجهز: ${preparer.name.trim() || "مجهز"}`;

  await prisma.$transaction(async (tx) => {
    await tx.orderCourierMoneyEvent.update({
      where: { id: eventId },
      data: {
        deletedAt: new Date(),
        deletedReason: "manual_preparer",
        deletedByDisplayName: deletedBy,
      },
    });
    await syncOrderStatusFromActiveMoneyEvents(tx, ev.order.id);
  });

  revalidatePreparerPaths(nextRaw);
  redirect(safePreparerReturn(nextRaw));
}

