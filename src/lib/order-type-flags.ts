const REVERSE_ORDER_PREFIX = "طلب عكسي:";

/** يُخزَّن في `order.orderType` عند تفعيل «طلب عكسي» من رابط العميل */
export function isReversePickupOrderType(orderType: string | null | undefined): boolean {
  return String(orderType ?? "")
    .trim()
    .startsWith(REVERSE_ORDER_PREFIX);
}

export function withReversePickupPrefix(orderType: string, reversePickup: boolean): string {
  const cleaned = withoutReversePickupPrefix(orderType);
  if (!reversePickup) return cleaned;
  return `${REVERSE_ORDER_PREFIX} ${cleaned}`.trim();
}

export function withoutReversePickupPrefix(orderType: string | null | undefined): string {
  return String(orderType ?? "")
    .trim()
    .replace(/^طلب عكسي:\s*/u, "")
    .trim();
}
