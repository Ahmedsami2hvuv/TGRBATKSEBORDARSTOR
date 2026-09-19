import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyDelegatePortalQuery } from "@/lib/delegate-link";
import { isCourierPortalBlocked } from "@/lib/courier-delegate-access";
import {
  dinarAmountsMatchExpected,
  MONEY_KIND_DELIVERY,
  MONEY_KIND_PICKUP,
} from "@/lib/mandoub-money-events";
import { parseAlfInputToDinarDecimalRequired } from "@/lib/money-alf";
import { hasCustomerLocationUrl } from "@/lib/order-location";
import { computeCourierDeliveryEarningDinar } from "@/lib/courier-earnings";
import { reconcileMoneyEventsOnOrderStatusChange } from "@/lib/order-money-reconcile";
import { notifyTelegramMoneyEvent } from "@/lib/telegram-notify";
import {
  notifyStaffOrderPickedUp,
  notifyStaffOrderDelivered,
} from "@/lib/telegram-staff-panel";
import { revalidatePath } from "next/cache";
import { Decimal } from "@prisma/client/runtime/library";

async function courierUploaderLabelForLocation(courierId: string): Promise<string> {
  const row = await prisma.courier.findUnique({
    where: { id: courierId },
    select: { name: true },
  });
  return row?.name?.trim() ? `المندوب ${row.name.trim()}` : "المندوب";
}

function revalidateMandoubPaths(orderId: string) {
  revalidatePath("/mandoub");
  revalidatePath("/mandoub/wallet");
  revalidatePath(`/mandoub/order/${orderId}`);
  revalidatePath("/abo1stor3hlaa2kbr8-47/orders/tracking");
  revalidatePath(`/abo1stor3hlaa2kbr8-47/orders/${orderId}`);
  revalidatePath("/abo1stor3hlaa2kbr8-47/orders");
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      type, // 'pickup' | 'delivery'
      c = "",
      exp = "",
      s = "",
      orderId = "",
      amountAlf = "",
      mismatchNote = "",
      advanceStatus = "",
      submitMode = "",
      lat: latRaw,
      lng: lngRaw,
    } = body;

    const v = verifyDelegatePortalQuery(String(c), String(exp), String(s));
    if (!v.ok) {
      return NextResponse.json({ ok: false, error: "الرابط غير صالح أو انتهت صلاحيته." }, { status: 401 });
    }

    if (await isCourierPortalBlocked(v.courierId)) {
      return NextResponse.json({ ok: false, error: "هذا الحساب محظور ولا يمكن تنفيذ العملية." }, { status: 403 });
    }

    const cleanOrderId = String(orderId || "").trim();
    if (!cleanOrderId) {
      return NextResponse.json({ ok: false, error: "معرّف الطلب مفقود." }, { status: 400 });
    }

    const order = await prisma.order.findFirst({
      where: { id: cleanOrderId, assignedCourierId: v.courierId },
      include: { customer: true },
    });

    if (!order) {
      return NextResponse.json({ ok: false, error: "الطلب غير موجود أو غير مسند إليك." }, { status: 404 });
    }

    const amountStr = String(amountAlf || "").trim();
    const isZeroAmount =
      amountStr === "0" ||
      amountStr === "٠" ||
      submitMode === "statusOnlyNoAmount";

    // ==========================================
    // 1. تسجيل استلام وصادر (PICKUP / أعطيت للمحل)
    // ==========================================
    if (type === "pickup") {
      const doubleStaff = order.routeMode === "double" && order.submissionSource === "staff_portal";
      const prepJson = order.preparerShoppingJson as any;
      const staffProfit =
        doubleStaff && prepJson && typeof prepJson === "object" && typeof prepJson.staffProfit === "number"
          ? prepJson.staffProfit
          : 0;
      const baseSubtotal = order.purchasePrice ?? order.orderSubtotal;
      const expected = baseSubtotal != null ? new Decimal(Number(baseSubtotal) - staffProfit) : null;

      if (isZeroAmount) {
        if (advanceStatus === "delivering" || order.status === "assigned" || order.status === "pending") {
          await prisma.$transaction(async (tx) => {
            await reconcileMoneyEventsOnOrderStatusChange(tx, cleanOrderId, order.status as any, "delivering");
            await tx.order.update({
              where: { id: cleanOrderId },
              data: { status: "delivering" },
            });
          });
          void notifyStaffOrderPickedUp(cleanOrderId).catch(() => {});
        }
        const courierRow = await prisma.courier.findUnique({
          where: { id: v.courierId },
          select: { name: true },
        });
        void notifyTelegramMoneyEvent({
          orderId: cleanOrderId,
          kind: MONEY_KIND_PICKUP,
          amountDinar: new Decimal(0),
          expectedDinar: expected,
          matchesExpected: true,
          courierName: courierRow?.name ?? "—",
        }).catch((err) => console.error("[notifyTelegramMoneyEvent zero error]:", err));

        revalidateMandoubPaths(cleanOrderId);
        return NextResponse.json({ ok: true, success: true, status: "delivering" });
      }

      const parsed = parseAlfInputToDinarDecimalRequired(amountStr);
      if (!parsed.ok) {
        return NextResponse.json({ ok: false, error: "أدخل المبلغ بشكل صحيح." }, { status: 400 });
      }
      const amountDinar = new Decimal(parsed.value);
      if (amountDinar.lt(0)) {
        return NextResponse.json({ ok: false, error: "أدخل مبلغاً أكبر أو يساوي صفر." }, { status: 400 });
      }

      const agg = await prisma.orderCourierMoneyEvent.aggregate({
        where: {
          orderId: cleanOrderId,
          kind: MONEY_KIND_PICKUP,
          deletedAt: null,
        },
        _sum: { amountDinar: true },
      });
      const paidSoFar = agg._sum.amountDinar ?? new Decimal(0);
      const nextPaid = paidSoFar.plus(amountDinar);

      const matches =
        amountDinar.isZero() ||
        (expected != null && dinarAmountsMatchExpected(nextPaid, expected)) ||
        (expected != null && dinarAmountsMatchExpected(amountDinar, expected)) ||
        (order.orderSubtotal != null && dinarAmountsMatchExpected(amountDinar, order.orderSubtotal)) ||
        (order.purchasePrice != null && dinarAmountsMatchExpected(amountDinar, order.purchasePrice));

      if (!matches && !amountDinar.isZero() && !String(mismatchNote || "").trim()) {
        return NextResponse.json({ ok: false, error: "المبلغ مختلف — اكتب سبب الاختلاف." }, { status: 400 });
      }

      const finalMismatchNote = String(mismatchNote || "").trim() || (amountDinar.isZero() ? "لم أدفع (0)" : "");

      const createdEvent = await prisma.$transaction(async (tx) => {
        const ev = await tx.orderCourierMoneyEvent.create({
          data: {
            orderId: cleanOrderId,
            courierId: v.courierId,
            kind: MONEY_KIND_PICKUP,
            amountDinar,
            expectedDinar: expected,
            matchesExpected: matches,
            mismatchReason: "",
            mismatchNote: finalMismatchNote,
          },
        });
        if (advanceStatus === "delivering" && (order.status === "assigned" || order.status === "pending")) {
          await reconcileMoneyEventsOnOrderStatusChange(tx, cleanOrderId, order.status as any, "delivering");
          await tx.order.update({
            where: { id: cleanOrderId },
            data: { status: "delivering" },
          });
        }
        return ev;
      });

      if (advanceStatus === "delivering" || order.status === "assigned" || order.status === "pending") {
        void notifyStaffOrderPickedUp(cleanOrderId).catch(() => {});
      }

      const courierRow = await prisma.courier.findUnique({
        where: { id: v.courierId },
        select: { name: true },
      });

      void notifyTelegramMoneyEvent({
        orderId: cleanOrderId,
        kind: MONEY_KIND_PICKUP,
        amountDinar,
        expectedDinar: expected,
        matchesExpected: matches,
        courierName: courierRow?.name ?? "—",
      }).catch(() => {});

      revalidateMandoubPaths(cleanOrderId);
      return NextResponse.json({ ok: true, success: true, eventId: createdEvent.id, status: "delivering" });
    }

    // ==========================================
    // 2. تسجيل تسليم ووارد (DELIVERY / أخذت من الزبون)
    // ==========================================
    if (type === "delivery") {
      const expected = order.totalAmount;
      const courierRow = await prisma.courier.findUnique({
        where: { id: v.courierId },
        select: { vehicleType: true, zeroEarning: true },
      });

      const lat = latRaw != null && latRaw !== "" ? Number(latRaw) : NaN;
      const lng = lngRaw != null && lngRaw !== "" ? Number(lngRaw) : NaN;
      const coordsOk = Number.isFinite(lat) && Number.isFinite(lng) && lat !== 0 && lng !== 0;

      const hadLocationBefore = hasCustomerLocationUrl(order.customerLocationUrl, undefined);
      const attachCourierGpsAsCustomer = !hadLocationBefore && coordsOk;
      const mapsUrl = attachCourierGpsAsCustomer ? `https://www.google.com/maps?q=${lat},${lng}` : null;
      const uploadedBy = attachCourierGpsAsCustomer ? await courierUploaderLabelForLocation(v.courierId) : null;

      const shouldAdvanceToDelivered =
        advanceStatus === "delivered" ||
        order.status === "delivering" ||
        order.status === "assigned" ||
        order.status === "pending";

      if (isZeroAmount) {
        await prisma.$transaction(async (tx) => {
          if (shouldAdvanceToDelivered) {
            await reconcileMoneyEventsOnOrderStatusChange(tx, cleanOrderId, order.status as any, "delivered");
          }
          let earning: Decimal | null = null;
          let earningFor: string | null = null;
          if (courierRow && order.deliveryPrice != null) {
            earning = computeCourierDeliveryEarningDinar(
              courierRow.vehicleType,
              order.deliveryPrice,
              courierRow.zeroEarning,
            );
            earningFor = earning != null ? v.courierId : null;
          }

          if (attachCourierGpsAsCustomer && mapsUrl && order.customerId) {
            await tx.customer.update({
              where: { id: order.customerId },
              data: { customerLocationUrl: mapsUrl },
            });
          }

          await tx.order.update({
            where: { id: cleanOrderId },
            data: {
              ...(attachCourierGpsAsCustomer && mapsUrl && uploadedBy
                ? {
                    customerLocationUrl: mapsUrl,
                    customerLocationUploadedByName: uploadedBy,
                    customerLocationSetByCourierAt: new Date(),
                  }
                : {}),
              ...(shouldAdvanceToDelivered
                ? {
                    status: "delivered",
                    courierEarningDinar: earning,
                    courierEarningForCourierId: earningFor,
                  }
                : {}),
            },
          });
        });

        if (shouldAdvanceToDelivered) {
          void (async () => {
            try {
              const { handleOrderDelivered } = await import("@/lib/order-delivery-hook");
              await handleOrderDelivered(cleanOrderId);
            } catch (err) {
              console.error("[Background handleOrderDelivered error]:", err);
            }
          })();
          void notifyStaffOrderDelivered(cleanOrderId).catch(() => {});
        }

        revalidateMandoubPaths(cleanOrderId);
        return NextResponse.json({ ok: true, success: true, status: "delivered" });
      }

      const parsed = parseAlfInputToDinarDecimalRequired(amountStr);
      if (!parsed.ok) {
        return NextResponse.json({ ok: false, error: "أدخل المبلغ بشكل صحيح." }, { status: 400 });
      }
      const amountDinar = new Decimal(parsed.value);
      if (amountDinar.lt(0)) {
        return NextResponse.json({ ok: false, error: "أدخل مبلغاً أكبر أو يساوي صفر." }, { status: 400 });
      }

      const agg = await prisma.orderCourierMoneyEvent.aggregate({
        where: {
          orderId: cleanOrderId,
          kind: MONEY_KIND_DELIVERY,
          deletedAt: null,
        },
        _sum: { amountDinar: true },
      });
      const receivedSoFar = agg._sum.amountDinar ?? new Decimal(0);
      const nextReceived = receivedSoFar.plus(amountDinar);

      const matches =
        amountDinar.isZero() ||
        (expected != null && dinarAmountsMatchExpected(nextReceived, expected)) ||
        (expected != null && dinarAmountsMatchExpected(amountDinar, expected)) ||
        (order.totalAmount != null && dinarAmountsMatchExpected(amountDinar, order.totalAmount));

      if (!matches && !amountDinar.isZero() && !String(mismatchNote || "").trim()) {
        return NextResponse.json({ ok: false, error: "المبلغ مختلف — اكتب سبب الاختلاف." }, { status: 400 });
      }

      const finalMismatchNote = String(mismatchNote || "").trim() || (amountDinar.isZero() ? "لم استلم (0)" : "");

      const createdEvent = await prisma.$transaction(async (tx) => {
        const ev = await tx.orderCourierMoneyEvent.create({
          data: {
            orderId: cleanOrderId,
            courierId: v.courierId,
            kind: MONEY_KIND_DELIVERY,
            amountDinar,
            expectedDinar: expected,
            matchesExpected: matches,
            mismatchReason: "",
            mismatchNote: finalMismatchNote,
          },
        });

        if (attachCourierGpsAsCustomer && mapsUrl && order.customerId) {
          await tx.customer.update({
            where: { id: order.customerId },
            data: { customerLocationUrl: mapsUrl },
          });
        }

        if (shouldAdvanceToDelivered && order.status !== "delivered") {
          await reconcileMoneyEventsOnOrderStatusChange(tx, cleanOrderId, order.status as any, "delivered");
        }

        let earning: Decimal | null = null;
        let earningFor: string | null = null;
        if (courierRow && order.deliveryPrice != null) {
          earning = computeCourierDeliveryEarningDinar(
            courierRow.vehicleType,
            order.deliveryPrice,
            courierRow.zeroEarning,
          );
          earningFor = earning != null ? v.courierId : null;
        }

        await tx.order.update({
          where: { id: cleanOrderId },
          data: {
            ...(attachCourierGpsAsCustomer && mapsUrl && uploadedBy
              ? {
                  customerLocationUrl: mapsUrl,
                  customerLocationUploadedByName: uploadedBy,
                  customerLocationSetByCourierAt: new Date(),
                }
              : {}),
            ...(shouldAdvanceToDelivered
              ? {
                  status: "delivered",
                  courierEarningDinar: earning,
                  courierEarningForCourierId: earningFor,
                }
              : {}),
          },
        });

        return ev;
      });

      if (shouldAdvanceToDelivered) {
        void (async () => {
          try {
            const { handleOrderDelivered } = await import("@/lib/order-delivery-hook");
            await handleOrderDelivered(cleanOrderId);
          } catch (err) {
            console.error("[Background handleOrderDelivered error]:", err);
          }
        })();
        void notifyStaffOrderDelivered(cleanOrderId).catch(() => {});
      }

      const courierInfo = await prisma.courier.findUnique({
        where: { id: v.courierId },
        select: { name: true },
      });

      void notifyTelegramMoneyEvent({
        orderId: cleanOrderId,
        kind: MONEY_KIND_DELIVERY,
        amountDinar,
        expectedDinar: expected,
        matchesExpected: matches,
        courierName: courierInfo?.name ?? "—",
      }).catch(() => {});

      revalidateMandoubPaths(cleanOrderId);
      return NextResponse.json({ ok: true, success: true, eventId: createdEvent.id, status: "delivered" });
    }

    return NextResponse.json({ ok: false, error: "نوع العملية غير معروف." }, { status: 400 });
  } catch (error: any) {
    console.error("[POST /api/mandoub/record-money error]:", error);
    return NextResponse.json({ ok: false, error: error?.message || "حدث خطأ أثناء حفظ المعاملة." }, { status: 500 });
  }
}
