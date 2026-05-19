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

/** تحويل أموال مرفوض — صادر */
export const LEDGER_KIND_TRANSFER_REJECTED_OUT = "transfer_rejected_out";
/** تحويل أموال مرفوض — وارد */
export const LEDGER_KIND_TRANSFER_REJECTED_IN = "transfer_rejected_in";

/**
 * A browser-safe way to represent a Decimal-like value.
 * We avoid importing from @prisma/client to prevent browser runtime errors.
 */
export interface DecimalLike {
  toNumber?(): number;
  toFixed?(decimalPlaces: number): string;
  // Prisma's Decimal has these, we can use them if present
  toDecimalPlaces?(places: number): {
    equals(other: any): boolean;
  };
}

/**
 * Checks if two dinar amounts match, considering 2 decimal places.
 * Works with both Prisma Decimal and standard JavaScript numbers.
 */
export function dinarAmountsMatchExpected(
  amount: number | DecimalLike,
  expected: number | DecimalLike | null | undefined,
): boolean {
  if (expected == null) return false;

  const a = typeof amount === "number" ? amount : (amount.toNumber?.() ?? 0);
  const e = typeof expected === "number" ? expected : (expected.toNumber?.() ?? 0);

  // Use a small epsilon for float comparison after rounding to 2 decimal places
  const factor = 100;
  return Math.round(a * factor) === Math.round(e * factor);
}

export function isManualDeletionReason(
  r: string | null | undefined,
): boolean {
  return r === "manual_admin" || r === "manual_courier" || r === "manual_preparer";
}
