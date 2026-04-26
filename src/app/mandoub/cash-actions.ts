"use server";

import { Decimal } from "@prisma/client/runtime/library";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { isCourierPortalBlocked } from "@/lib/courier-delegate-access";
import { verifyDelegatePortalQuery } from "@/lib/delegate-link";
import {
  dinarAmountsMatchExpected,
  MONEY_KIND_DELIVERY,
  MONEY_KIND_PICKUP,
} from "@/lib/mandoub-money-events";
import { notifyTelegramMoneyEvent } from "@/lib/telegram-notify";
import { parseAlfInputToDinarDecimalRequired } from "@/lib/money-alf";
import { hasCustomerLocationUrl } from "@/lib/order-location";
import { computeCourierDeliveryEarningDinar } from "@/lib/courier-earnings";
import { reconcileMoneyEventsOnOrderStatusChange } from "@/lib/order-money-reconcile";
import { CourierWalletMiscDirection } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import { adminCookieName, verifyAdminToken } from "@/lib/auth";
import { ADMIN_MONEY_HARD_DELETE_CONFIRM_PHRASE } from "@/lib/mandoub-cash-constants";
import {
  createWalletPeerTransferFromCourier,
  respondWalletPeerTransferByCourier,
} from "../wallet-peer-transfer-actions";

function safeMandoubReturn(next: string): string {
  if (!next.startsWith("/mandoub")) {
    return "/mandoub";
  }
  return next;
}

function revalidateMandoubPaths(nextUrl: string) {
  revalidatePath("/mandoub");
  revalidatePath("/mandoub/wallet");
  const path = nextUrl.split("?")[0];
  if (path.startsWith("/mandoub/order/")) {
    revalidatePath(path);
  }
}

async function courierUploaderLabelForLocation(courierId: string): Promise<string> {
  const row = await prisma.courier.findUnique({
    where: { id: courierId },
    select: { name: true },
  });
  return row?.name?.trim() || "مندوب";
}

async function assertAdmin(): Promise<boolean> {
  const jar = await cookies();
  const t = jar.get(adminCookieName)?.value ?? "";
  return !!(t && (await verifyAdminToken(t)));
}

function mismatchNoteRequiredError(): MandoubCashState {
  return {
    error: "المبلغ مختلف — اكتب السبب.",
  };
}

export type MandoubCashState = {
  error?: string;
  ok?: boolean;
  deletedEventId?: string;
  deletedMode?: "soft" | "hard";
};

export async function submitMandoubPickupMoney(
  _prev: MandoubCashState,
  formData: FormData,
): Promise<MandoubCashState> {
  const c = String(formData.get("c") ?? "");
  const exp = String(formData.get("exp") ?? "");
  const s = String(formData.get("s") ?? "");
  const orderId = String(formData.get("orderId") ?? "").trim();
  const nextRaw = String(formData.get("next") ?? "/mandoub");
  const amountRaw = String(formData.get("amountAlf") ?? "").trim();
  const mismatchNote = String(formData.get("mismatchNote") ?? "").trim();
  const advanceStatus = String(formData.get("advanceStatus") ?? "").trim();
  const statusAdvanceOnly = formData.get("statusAdvanceOnly") === "1";
  const submitMode = String(formData.get("mandoubMoneySubmitMode") ?? "").trim();

  const v = verifyDelegatePortalQuery(c, exp, s);
  if (!v.ok) {
    return { error: "الرابط غير صالح." };
  }
  if (await isCourierPortalBlocked(v.courierId)) {
    return { error: "هذا الحساب محظور ولا يمكن تنفيذ العملية." };
  }
  if (!orderId) {
    return { error: "معرّف الطلب مفقود." };
  }

  const order = await prisma.order.findFirst({
    where: { id: orderId, assignedCourierId: v.courierId },
  });
  if (!order) {
    return { error: "لا يمكن تسجيل الصادر لهذا الطلب." };
  }

  const expected = order.orderSubtotal;
  if (expected == null) {
    return { error: "سعر الطلب غير محدد في النظام." };
  }

  const agg = await prisma.orderCourierMoneyEvent.aggregate({
    where: {
      orderId,
      kind: MONEY_KIND_PICKUP,
      deletedAt: null,
      recordedByCompanyPreparerId: null,
    },
    _sum: { amountDinar: true },
  });
  const paidSoFar = agg._sum.amountDinar ?? new Decimal(0);

  const pickupStatusOnly =
    advanceStatus === "delivering" &&
    order.status === "assigned" &&
    (statusAdvanceOnly || submitMode === "statusOnlyNoAmount");

  if (pickupStatusOnly) {
    if (!paidSoFar.greaterThan(0)) {
      /* تحويل دون تسجيل صادر — مسموح */
    } else if (!dinarAmountsMatchExpected(paidSoFar, expected) && !mismatchNote.trim()) {
      return mismatchNoteRequiredError();
    }
    await prisma.$transaction(async (tx) => {
      await reconcileMoneyEventsOnOrderStatusChange(tx, orderId, "assigned", "delivering");
      await tx.order.update({
        where: { id: orderId },
        data: { status: "delivering" },
      });
    });
    revalidateMandoubPaths(nextRaw);
    redirect(safeMandoubReturn(nextRaw));
  }

  const parsed = parseAlfInputToDinarDecimalRequired(amountRaw);
  if (!parsed.ok) {
    return { error: "أدخل المبلغ بالألف بشكل صحيح." };
  }
  const amountDinar = new Decimal(parsed.value);
  // السماح بإدخال 0 للأرصدة/المواقف الخاصة، لكن نطلب ملاحظة عند إدخال 0.
  if (amountDinar.lt(0)) {
    return { error: "أدخل مبلغاً أكبر أو يساوي صفر." };
  }
  if (amountDinar.eq(0) && !mismatchNote.trim()) {
    return mismatchNoteRequiredError();
  }

  const nextPaid = paidSoFar.plus(amountDinar);
  const matches = dinarAmountsMatchExpected(nextPaid, expected);
  if (!matches && !mismatchNote.trim()) {
    return mismatchNoteRequiredError();
  }

  await prisma.$transaction(async (tx) => {
    await tx.orderCourierMoneyEvent.create({
      data: {
        orderId,
        courierId: v.courierId,
        kind: MONEY_KIND_PICKUP,
        amountDinar,
        expectedDinar: expected,
        matchesExpected: matches,
        mismatchReason: "",
        mismatchNote,
      },
    });
    if (advanceStatus === "delivering" && order.status === "assigned") {
      await reconcileMoneyEventsOnOrderStatusChange(tx, orderId, "assigned", "delivering");
      await tx.order.update({
        where: { id: orderId },
        data: { status: "delivering" },
      });
    }
  });

  const courierRow = await prisma.courier.findUnique({
    where: { id: v.courierId },
    select: { name: true },
  });
  void notifyTelegramMoneyEvent({
    orderId,
    kind: MONEY_KIND_PICKUP,
    amountDinar,
    expectedDinar: expected,
    matchesExpected: matches,
    courierName: courierRow?.name ?? "—",
  }).catch(() => {});

  revalidateMandoubPaths(nextRaw);
  redirect(safeMandoubReturn(nextRaw));
}

export async function submitMandoubDeliveryMoney(
  _prev: MandoubCashState,
  formData: FormData,
): Promise<MandoubCashState> {
  const c = String(formData.get("c") ?? "");
  const exp = String(formData.get("exp") ?? "");
  const s = String(formData.get("s") ?? "");
  const orderId = String(formData.get("orderId") ?? "").trim();
  const nextRaw = String(formData.get("next") ?? "/mandoub");
  const amountRaw = String(formData.get("amountAlf") ?? "").trim();
  const mismatchNote = String(formData.get("mismatchNote") ?? "").trim();
  const advanceStatus = String(formData.get("advanceStatus") ?? "").trim();
  const statusAdvanceOnly = formData.get("statusAdvanceOnly") === "1";
  const submitMode = String(formData.get("mandoubMoneySubmitMode") ?? "").trim();
  const latRaw = formData.get("lat");
  const lngRaw = formData.get("lng");

  // تحسين صارم: التحقق من أن القيم نصية وليست فارغة وليست صفراً
  const latStr = typeof latRaw === "string" ? latRaw.trim() : "";
  const lngStr = typeof lngRaw === "string" ? lngRaw.trim() : "";

  const lat = latStr ? Number(latStr) : NaN;
  const lng = lngStr ? Number(lngStr) : NaN;

  const v = verifyDelegatePortalQuery(c, exp, s);
  if (!v.ok) {
    return { error: "الرابط غير صالح." };
  }
  if (await isCourierPortalBlocked(v.courierId)) {
    return { error: "هذا الحساب محظور ولا يمكن تنفيذ العملية." };
  }
  if (!orderId) {
    return { error: "معرّف الطلب مفقود." };
  }

  const order = await prisma.order.findFirst({
    where: { id: orderId, assignedCourierId: v.courierId },
    include: { customer: true },
  });
  if (!order) {
    return { error: "لا يمكن تسجيل الوارد لهذا الطلب." };
  }
  if (!order.assignedCourierId) {
    return { error: "لا يوجد مندوب مسند للطلب." };
  }

  const expected = order.totalAmount;
  if (expected == null) {
    return { error: "السعر الكلي غير محدد في النظام." };
  }

  const agg = await prisma.orderCourierMoneyEvent.aggregate({
    where: {
      orderId,
      kind: MONEY_KIND_DELIVERY,
      deletedAt: null,
      recordedByCompanyPreparerId: null,
    },
    _sum: { amountDinar: true },
  });
  const receivedSoFar = agg._sum.amountDinar ?? new Decimal(0);

  const deliveryStatusOnly =
    advanceStatus === "delivered" &&
    order.status === "delivering" &&
    (statusAdvanceOnly || submitMode === "statusOnlyNoAmount");

  if (deliveryStatusOnly) {
    if (!receivedSoFar.greaterThan(0)) {
      /* تحويل دون تسجيل وارد — مسموح */
    } else if (!dinarAmountsMatchExpected(receivedSoFar, expected) && !mismatchNote.trim()) {
      return mismatchNoteRequiredError();
    }
    await prisma.$transaction(async (tx) => {
      await reconcileMoneyEventsOnOrderStatusChange(tx, orderId, "delivering", "delivered");
      const deliveryEv = await tx.orderCourierMoneyEvent.findFirst({
        where: { orderId, kind: MONEY_KIND_DELIVERY, deletedAt: null },
        orderBy: { createdAt: "desc" },
      });
      const earningCourierId = deliveryEv?.courierId ?? order.assignedCourierId;
      let earning: Decimal | null = null;
      let earningFor: string | null = null;
      if (earningCourierId && order.deliveryPrice != null) {
        const cr = await tx.courier.findUnique({ where: { id: earningCourierId } });
        if (cr) {
          earning = computeCourierDeliveryEarningDinar(cr.vehicleType, order.deliveryPrice);
          earningFor = earning != null ? earningCourierId : null;
        }
      }
      await tx.order.update({
        where: { id: orderId },
        data: {
          status: "delivered",
          courierEarningDinar: earning,
          courierEarningForCourierId: earningFor,
        },
      });
    });
    revalidateMandoubPaths(nextRaw);
    redirect(safeMandoubReturn(nextRaw));
  }

  const parsed = parseAlfInputToDinarDecimalRequired(amountRaw);
  if (!parsed.ok) {
    return { error: "أدخل المبلغ بالألف بشكل صحيح." };
  }
  const amountDinar = new Decimal(parsed.value);
  // السماح بإدخال 0 للأرصدة/المواقف الخاصة، لكن نطلب ملاحظة عند إدخال 0.
  if (amountDinar.lt(0)) {
    return { error: "أدخل مبلغاً أكبر أو يساوي صفر." };
  }
  if (amountDinar.eq(0) && !mismatchNote.trim()) {
    return mismatchNoteRequiredError();
  }

  const nextReceived = receivedSoFar.plus(amountDinar);
  const matches = dinarAmountsMatchExpected(nextReceived, expected);
  if (!matches && !mismatchNote.trim()) {
    return mismatchNoteRequiredError();
  }

  const courierRow = await prisma.courier.findUnique({
    where: { id: order.assignedCourierId },
    select: { vehicleType: true },
  });
  if (!courierRow) {
    return { error: "بيانات المندوب غير موجودة." };
  }

  const hadLocationBefore = hasCustomerLocationUrl(
    order.customerLocationUrl,
    undefined,
  );

  // حماية حقيقية: التأكد من أن الإحداثيات ليست 0 وليست فارغة وليست NaN
  const coordsOk =
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat !== 0 &&
    lng !== 0;

  const attachCourierGpsAsCustomer =
    !hadLocationBefore && coordsOk;
  const mapsUrl = attachCourierGpsAsCustomer
    ? `https://www.google.com/maps?q=${lat},${lng}`
    : null;
  const uploadedBy = attachCourierGpsAsCustomer
    ? await courierUploaderLabelForLocation(v.courierId)
    : null;

  await prisma.$transaction(async (tx) => {
    await tx.orderCourierMoneyEvent.create({
      data: {
        orderId,
        courierId: v.courierId,
        kind: MONEY_KIND_DELIVERY,
        amountDinar,
        expectedDinar: expected,
        matchesExpected: matches,
        mismatchReason: "",
        mismatchNote,
      },
    });
    if (attachCourierGpsAsCustomer && mapsUrl && order.customerId) {
      await tx.customer.update({
        where: { id: order.customerId },
        data: { customerLocationUrl: mapsUrl },
      });
    }
    if (advanceStatus === "delivered" && order.status === "delivering") {
      await reconcileMoneyEventsOnOrderStatusChange(tx, orderId, "delivering", "delivered");
    }
    await tx.order.update({
      where: { id: orderId },
      data: {
        ...(attachCourierGpsAsCustomer && mapsUrl && uploadedBy
          ? {
              customerLocationUrl: mapsUrl,
              customerLocationSetByCourierAt: new Date(),
              customerLocationUploadedByName: uploadedBy,
            }
          : {}),
        ...(advanceStatus === "delivered" && order.status === "delivering"
          ? (() => {
              const earningCourierId = v.courierId;
              const earning =
                order.deliveryPrice != null
                  ? computeCourierDeliveryEarningDinar(
                      courierRow.vehicleType,
                      order.deliveryPrice,
                    )
                  : null;
              return {
                status: "delivered",
                courierEarningDinar: earning,
                courierEarningForCourierId: earning != null ? earningCourierId : null,
              };
            })()
          : {}),
      },
    });
  });

  const courierForNotify = await prisma.courier.findUnique({
    where: { id: v.courierId },
    select: { name: true },
  });
  void notifyTelegramMoneyEvent({
    orderId,
    kind: MONEY_KIND_DELIVERY,
    amountDinar,
    expectedDinar: expected,
    matchesExpected: matches,
    courierName: courierForNotify?.name ?? "—",
  }).catch(() => {});

  revalidateMandoubPaths(nextRaw);
  redirect(safeMandoubReturn(nextRaw));
}

/** معاملة نقدية خارج الطلبات (أخذت / أعطيت) — تدخل في وارد/صادر المحفظة */
export async function submitMandoubMiscWalletEntry(
  _prev: MandoubCashState,
  formData: FormData,
): Promise<MandoubCashState> {
  const c = String(formData.get("c") ?? "");
  const exp = String(formData.get("exp") ?? "");
  const s = String(formData.get("s") ?? "");
  const nextRaw = String(formData.get("next") ?? "/mandoub");
  const directionRaw = String(formData.get("direction") ?? "").trim();
  const labelRaw = String(formData.get("label") ?? "").trim();
  const amountRaw = String(formData.get("amountAlf") ?? "").trim();

  const v = verifyDelegatePortalQuery(c, exp, s);
  if (!v.ok) {
    return { error: "الرابط غير صالح." };
  }
  if (await isCourierPortalBlocked(v.courierId)) {
    return { error: "هذا الحساب محظور ولا يمكن تنفيذ العملية." };
  }
  if (directionRaw !== "take" && directionRaw !== "give") {
    return { error: "نوع المعاملة غير صالح." };
  }
  if (!labelRaw.length) {
    return { error: "اكتب اسم المعاملة." };
  }
  if (labelRaw.length > 200) {
    return { error: "اسم المعاملة طويل جداً." };
  }
  const parsed = parseAlfInputToDinarDecimalRequired(amountRaw);
  if (!parsed.ok) {
    return { error: "أدخل المبلغ بالألف بشكل صحيح." };
  }
  const amountDinar = new Decimal(parsed.value);
  if (amountDinar.lte(0)) {
    return { error: "أدخل مبلغاً أكبر من صفر." };
  }

  await prisma.courierWalletMiscEntry.create({
    data: {
      courierId: v.courierId,
      direction:
        directionRaw === "take"
          ? CourierWalletMiscDirection.take
          : CourierWalletMiscDirection.give,
      amountDinar,
      label: labelRaw,
    },
  });

  revalidateMandoubPaths(nextRaw);
  redirect(safeMandoubReturn(nextRaw));
}

export async function softDeleteMandoubMiscWalletEntry(
  _prev: MandoubCashState,
  formData: FormData,
): Promise<MandoubCashState> {
  const c = String(formData.get("c") ?? "");
  const exp = String(formData.get("exp") ?? "");
  const s = String(formData.get("s") ?? "");
  const entryId = String(formData.get("miscEntryId") ?? "").trim();
  const nextRaw = String(formData.get("next") ?? "/mandoub");

  const v = verifyDelegatePortalQuery(c, exp, s);
  if (!v.ok) {
    return { error: "الرابط غير صالح." };
  }
  if (await isCourierPortalBlocked(v.courierId)) {
    return { error: "هذا الحساب محظور ولا يمكن تنفيذ العملية." };
  }
  if (!entryId) {
    return { error: "معرّف المعاملة مفقود." };
  }

  const row = await prisma.courierWalletMiscEntry.findFirst({
    where: { id: entryId, courierId: v.courierId, deletedAt: null },
  });
  if (!row) {
    return { error: "المعاملة غير موجودة." };
  }

  const courierRow = await prisma.courier.findUnique({
    where: { id: v.courierId },
    select: { name: true },
  });
  const deletedBy = courierRow?.name?.trim() || "مندوب";

  await prisma.courierWalletMiscEntry.update({
    where: { id: entryId },
    data: {
      deletedAt: new Date(),
      deletedReason: "manual_courier",
      deletedByDisplayName: deletedBy,
    },
  });

  revalidateMandoubPaths(nextRaw);
  redirect(safeMandoubReturn(nextRaw));
}

export async function softDeleteMandoubMoneyEvent(
  _prev: MandoubCashState,
  formData: FormData,
): Promise<MandoubCashState> {
  const c = String(formData.get("c") ?? "");
  const exp = String(formData.get("exp") ?? "");
  const s = String(formData.get("s") ?? "");
  const eventId = String(formData.get("eventId") ?? "").trim();
  const nextRaw = String(formData.get("next") ?? "/mandoub");

  const v = verifyDelegatePortalQuery(c, exp, s);
  if (!v.ok) {
    return { error: "الرابط غير صالح." };
  }
  if (await isCourierPortalBlocked(v.courierId)) {
    return { error: "هذا الحساب محظور ولا يمكن تنفيذ العملية." };
  }
  if (!eventId) {
    return { error: "معرّف المعاملة مفقود." };
  }

  const ev = await prisma.orderCourierMoneyEvent.findFirst({
    where: { id: eventId, courierId: v.courierId, deletedAt: null },
    include: { order: true },
  });
  if (!ev) {
    return { error: "المعاملة غير موجودة." };
  }
  if (ev.recordedByCompanyPreparerId != null) {
    return { error: "لا يمكن حذف معاملة سجّلها المجهز من لوحة المندوب." };
  }

  const courierRow = await prisma.courier.findUnique({
    where: { id: v.courierId },
    select: { name: true },
  });
  const deletedBy =
    courierRow?.name?.trim() || "مندوب";

  await prisma.$transaction(async (tx) => {
    await tx.orderCourierMoneyEvent.update({
      where: { id: eventId },
      data: {
        deletedAt: new Date(),
        deletedReason: "manual_courier",
        deletedByDisplayName: deletedBy,
      },
    });
  });

  revalidatePath(`/mandoub/order/${ev.orderId}`);
  revalidateMandoubPaths(nextRaw);
  redirect(safeMandoubReturn(nextRaw));
}

export async function softDeleteMandoubMoneyEventAdmin(
  _prev: MandoubCashState,
  formData: FormData,
): Promise<MandoubCashState> {
  if (!(await assertAdmin())) {
    return { error: "غير مصرّح" };
  }
  const eventId = String(formData.get("eventId") ?? "").trim();
  const nextPath = String(formData.get("nextPath") ?? "").trim();

  if (!eventId) {
    return { error: "معرّف المعاملة مفقود." };
  }

  const ev = await prisma.orderCourierMoneyEvent.findFirst({
    where: { id: eventId, deletedAt: null },
    include: { order: true },
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
  });

  const oid = ev.orderId;
  revalidatePath("/admin/orders/tracking");
  revalidatePath("/mandoub");
  revalidatePath(`/mandoub/order/${oid}`);
  revalidatePath("/mandoub/wallet");
  revalidatePath("/preparer");
  revalidatePath("/preparer/wallet");
  revalidatePath(`/preparer/order/${oid}`);
  revalidatePath(`/admin/orders/${oid}/edit`);
  revalidatePath(`/admin/orders/${oid}`);
  if (nextPath.startsWith("/admin")) {
    revalidatePath(nextPath.split("?")[0]);
  }
  return { ok: true, deletedEventId: eventId, deletedMode: "soft" };
}

/** حذف معاملة نقد الطلب نهائياً من قاعدة البيانات (لا يبقى أثر في السجلات أو التقارير). */
export async function hardDeleteOrderCourierMoneyEventAdmin(
  _prev: MandoubCashState,
  formData: FormData,
): Promise<MandoubCashState> {
  if (!(await assertAdmin())) {
    return { error: "غير مصرّح" };
  }
  const eventId = String(formData.get("eventId") ?? "").trim();
  const nextPath = String(formData.get("nextPath") ?? "").trim();
  const confirmPhrase = String(formData.get("confirmPhrase") ?? "").trim();

  if (!eventId) {
    return { error: "معرّف المعاملة مفقود." };
  }
  if (confirmPhrase !== ADMIN_MONEY_HARD_DELETE_CONFIRM_PHRASE) {
    return {
      error: `اكتب بالضبط «${ADMIN_MONEY_HARD_DELETE_CONFIRM_PHRASE}» في حقل التأكيد.`,
    };
  }

  const ev = await prisma.orderCourierMoneyEvent.findFirst({
    where: { id: eventId },
    include: { order: true },
  });
  if (!ev) {
    return { error: "المعاملة غير موجودة." };
  }

  const orderId = ev.orderId;

  await prisma.$transaction(async (tx) => {
    await tx.orderCourierMoneyEvent.delete({ where: { id: eventId } });
  });

  revalidatePath("/admin/orders/tracking");
  revalidatePath("/mandoub");
  revalidatePath(`/mandoub/order/${orderId}`);
  revalidatePath("/mandoub/wallet");
  revalidatePath("/preparer");
  revalidatePath("/preparer/wallet");
  revalidatePath(`/preparer/order/${orderId}`);
  revalidatePath(`/admin/orders/${orderId}/edit`);
  revalidatePath(`/admin/orders/${orderId}`);
  if (nextPath.startsWith("/admin")) {
    revalidatePath(nextPath.split("?")[0]);
  }
  return { ok: true, deletedEventId: eventId, deletedMode: "hard" };
}

export async function acceptIncomingWalletTransfer(
  prev: MandoubCashState,
  formData: FormData,
): Promise<MandoubCashState> {
  formData.set("accept", "1");
  return respondWalletPeerTransferByCourier(prev, formData);
}

export async function rejectIncomingWalletTransfer(
  prev: MandoubCashState,
  formData: FormData,
): Promise<MandoubCashState> {
  formData.set("accept", "0");
  return respondWalletPeerTransferByCourier(prev, formData);
}

export async function submitWalletTransferAction(
  prev: MandoubCashState,
  formData: FormData,
): Promise<MandoubCashState> {
  const toId = String(formData.get("toId") ?? "");
  const toKind = String(formData.get("toKind") ?? "");
  if (toKind === "courier") {
    formData.set("toCourierId", toId);
  } else if (toKind === "employee") {
    formData.set("toEmployeeId", toId);
  }
  return createWalletPeerTransferFromCourier(prev, formData);
}
