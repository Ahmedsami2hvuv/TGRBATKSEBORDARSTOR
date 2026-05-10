import type { Decimal } from "@prisma/client/runtime/library";
import { MONEY_KIND_DELIVERY, MONEY_KIND_PICKUP } from "@/lib/mandoub-money-events";

/** مجموع حركات الوارد (استلام من الزبون) غير المحذوفة — يدعم دفعات جزئية متعددة */
export function sumDeliveryInFromOrderMoneyEvents(
  moneyEvents: Array<{
    kind: string;
    amountDinar: any;
    deletedAt: Date | null | string;
  }>,
): number | null {
  let sum: number | null = null;
  for (const e of moneyEvents) {
    if (e.kind === MONEY_KIND_DELIVERY && e.deletedAt == null) {
      const val = typeof e.amountDinar === 'object' && e.amountDinar !== null && 'toNumber' in e.amountDinar ? e.amountDinar.toNumber() : Number(e.amountDinar);
      if (!Number.isNaN(val)) {
        sum = sum == null ? val : sum + val;
      }
    }
  }
  return sum;
}

/** مجموع حركات الصادر (دفع للمحل) غير المحذوفة */
export function sumPickupOutFromOrderMoneyEvents(
  moneyEvents: Array<{
    kind: string;
    amountDinar: any;
    deletedAt: Date | null | string;
  }>,
): number | null {
  let sum: number | null = null;
  for (const e of moneyEvents) {
    if (e.kind === MONEY_KIND_PICKUP && e.deletedAt == null) {
      const val = typeof e.amountDinar === 'object' && e.amountDinar !== null && 'toNumber' in e.amountDinar ? e.amountDinar.toNumber() : Number(e.amountDinar);
      if (!Number.isNaN(val)) {
        sum = sum == null ? val : sum + val;
      }
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
  totalAmount: Decimal | number | string | null,
  deliveryEventsSum: Decimal | number | string | null | undefined,
): { hasMismatch: boolean; type: "excess" | "deficit" | null } {
  // أزلنا قيد الحالة "delivered" لكي يظهر التنبيه بمجرد تسجيل مبلغ مختلف حتى لو لم يكتمل الطلب
  if (status === "pending" || status === "cancelled") return { hasMismatch: false, type: null };

  const actual = deliveryEventsSum;
  if (actual == null || totalAmount == null) return { hasMismatch: false, type: null };

  const actualNum = typeof actual === 'object' && 'toNumber' in actual ? actual.toNumber() : Number(actual);
  const totalNum = typeof totalAmount === 'object' && 'toNumber' in totalAmount ? totalAmount.toNumber() : Number(totalAmount);
  
  if (Number.isNaN(actualNum) || Number.isNaN(totalNum)) return { hasMismatch: false, type: null };

  const diff = actualNum - totalNum;
  if (Math.abs(diff) < 0.01) return { hasMismatch: false, type: null };
  return {
    hasMismatch: true,
    type: diff > 0 ? "excess" : "deficit"
  };
}

/** فحص الصادر: هل هناك اختلاف في ما دفعه المندوب للمحل؟ */
export function isSaderMismatch(
  status: string,
  orderSubtotal: Decimal | number | string | null,
  pickupEventsSum: Decimal | number | string | null | undefined,
): { hasMismatch: boolean; type: "excess" | "deficit" | null } {
  if (status === "pending" || status === "cancelled") return { hasMismatch: false, type: null };

  const actual = pickupEventsSum;
  if (actual == null || orderSubtotal == null) return { hasMismatch: false, type: null };

  const actualNum = typeof actual === 'object' && 'toNumber' in actual ? actual.toNumber() : Number(actual);
  const subtotalNum = typeof orderSubtotal === 'object' && 'toNumber' in orderSubtotal ? orderSubtotal.toNumber() : Number(orderSubtotal);

  if (Number.isNaN(actualNum) || Number.isNaN(subtotalNum)) return { hasMismatch: false, type: null };

  const diff = actualNum - subtotalNum;
  if (Math.abs(diff) < 0.01) return { hasMismatch: false, type: null };
  return {
    hasMismatch: true,
    type: diff > 0 ? "excess" : "deficit"
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
