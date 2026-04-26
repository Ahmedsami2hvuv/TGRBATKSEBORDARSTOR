import { Decimal } from "@prisma/client/runtime/library";
import type { OrderCourierMoneyDeletionReason } from "@prisma/client";

export const MONEY_KIND_PICKUP = "pickup_out";
export const MONEY_KIND_DELIVERY = "delivery_in";

/** سجل محفظة: معاملة «أخذت» خارج الطلبات — تُحسب كوارد */
export const MISC_LEDGER_KIND_TAKE = "misc_take";
/** سجل محفظة: معاملة «أعطيت» خارج الطلبات — تُحسب كصادر */
export const MISC_LEDGER_KIND_GIVE = "misc_give";

/** تحويل أموال معلّق — صادر (بانتظار موافقة المستلم) */
export const LEDGER_KIND_TRANSFER_PENDING_OUT = "transfer_pending_out";
/** تحويل أموال معلّق — وارد (يظهر في الأعلى مع أزرار الموافقة) */
export const LEDGER_KIND_TRANSFER_PENDING_IN = "transfer_pending_in";

export function dinarAmountsMatchExpected(amount: Decimal, expected: Decimal | null): boolean {
  if (expected == null) return false;
  return amount.toDecimalPlaces(2).equals(expected.toDecimalPlaces(2));
}

export function isManualDeletionReason(
  r: OrderCourierMoneyDeletionReason | null | undefined,
): boolean {
  return r === "manual_admin" || r === "manual_courier" || r === "manual_preparer";
}
