import type { Decimal } from "@prisma/client/runtime/library";
import { MONEY_KIND_DELIVERY, MONEY_KIND_PICKUP } from "@/lib/mandoub-money-events";

/** مجموع حركات الوارد (استلام من الزبون) غير المحذوفة — يدعم دفعات جزئية متعددة */
export function sumDeliveryInFromOrderMoneyEvents(
  moneyEvents: Array<{
    kind: string;
    amountDinar: Decimal;
    deletedAt: Date | null;
  }>,
): Decimal | null {
  let sum: Decimal | null = null;
  for (const e of moneyEvents) {
    if (e.kind === MONEY_KIND_DELIVERY && e.deletedAt == null) {
      sum = sum == null ? e.amountDinar : sum.plus(e.amountDinar);
    }
  }
  return sum;
}

/** مجموع حركات الصادر (دفع للمحل) غير المحذوفة */
export function sumPickupOutFromOrderMoneyEvents(
  moneyEvents: Array<{
    kind: string;
    amountDinar: Decimal;
    deletedAt: Date | null;
  }>,
): Decimal | null {
  let sum: Decimal | null = null;
  for (const e of moneyEvents) {
    if (e.kind === MONEY_KIND_PICKUP && e.deletedAt == null) {
      sum = sum == null ? e.amountDinar : sum.plus(e.amountDinar);
    }
  }
  return sum;
}

/** المجموع المتوقع = سعر الطلب + التوصيل */
export function orderExpectedTotal(
  orderSubtotal: Decimal | null,
  deliveryPrice: Decimal | null,
): Decimal | null {
  if (orderSubtotal == null || deliveryPrice == null) return null;
  return orderSubtotal.plus(deliveryPrice);
}

/** فحص الوارد: هل هناك اختلاف في ما استلمه المندوب من الزبون؟ */
export function isWardMismatch(
  status: string,
  totalAmount: Decimal | null,
  deliveryEventsSum: Decimal | null | undefined,
): { hasMismatch: boolean; type: "excess" | "deficit" | null } {
  // أزلنا قيد الحالة "delivered" لكي يظهر التنبيه بمجرد تسجيل مبلغ مختلف حتى لو لم يكتمل الطلب
  if (status === "pending" || status === "cancelled") return { hasMismatch: false, type: null };

  const actual = deliveryEventsSum;
  if (actual == null || totalAmount == null) return { hasMismatch: false, type: null };

  const diff = actual.minus(totalAmount);
  if (diff.abs().lessThan(0.01)) return { hasMismatch: false, type: null };
  return {
    hasMismatch: true,
    type: diff.greaterThan(0) ? "excess" : "deficit"
  };
}

/** فحص الصادر: هل هناك اختلاف في ما دفعه المندوب للمحل؟ */
export function isSaderMismatch(
  status: string,
  orderSubtotal: Decimal | null,
  pickupEventsSum: Decimal | null | undefined,
): { hasMismatch: boolean; type: "excess" | "deficit" | null } {
  if (status === "pending" || status === "cancelled") return { hasMismatch: false, type: null };

  const actual = pickupEventsSum;
  if (actual == null || orderSubtotal == null) return { hasMismatch: false, type: null };

  const diff = actual.minus(orderSubtotal);
  if (diff.abs().lessThan(0.01)) return { hasMismatch: false, type: null };
  return {
    hasMismatch: true,
    type: diff.greaterThan(0) ? "excess" : "deficit"
  };
}

/** فحص الصادر: المبلغ المُسلَّم أكبر من المجموع المتوقع (للتوافق مع الكود القديم) */
export function deliveredSaderMismatch(
  status: string,
  totalAmount: Decimal | null,
  orderSubtotal: Decimal | null,
  deliveryPrice: Decimal | null,
  deliveryEventAmount?: Decimal | null,
): boolean {
  return isWardMismatch(status, totalAmount, deliveryEventAmount).type === "excess";
}

/** فحص الوارد: المبلغ المُسلَّم أقل من المجموع المتوقع (للتوافق مع الكود القديم) */
export function deliveredWardMismatch(
  status: string,
  totalAmount: Decimal | null,
  orderSubtotal: Decimal | null,
  deliveryPrice: Decimal | null,
  deliveryEventAmount?: Decimal | null,
): boolean {
  return isWardMismatch(status, totalAmount, deliveryEventAmount).type === "deficit";
}
