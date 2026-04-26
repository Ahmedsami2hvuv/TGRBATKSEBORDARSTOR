/** هل يوجد رابط لوكيشن للزبون (على الطلب) */
export type CustomerLocationRule = "any" | "exists" | "missing" | "courier_gps";

export function mergeCustomerLocationUrl(
  orderLocation: string | null | undefined,
  ...fallbackLocations: Array<string | null | undefined>
): string {
  if (orderLocation?.trim()) return orderLocation.trim();
  for (const fallback of fallbackLocations) {
    if (fallback?.trim()) return fallback.trim();
  }
  return "";
}

export function hasCustomerLocationUrl(
  orderLocation: string | null | undefined,
  ...fallbackLocations: Array<string | null | undefined>
): boolean {
  return Boolean(mergeCustomerLocationUrl(orderLocation, ...fallbackLocations));
}

export function hasCourierUploadedLocation(
  customerLocationSetByCourierAt?: Date | string | null,
): boolean {
  return Boolean(customerLocationSetByCourierAt);
}

export function parseCustomerLocationRules(raw: string): CustomerLocationRule[] {
  const parts = (raw ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .filter((p): p is CustomerLocationRule =>
      p === "any" || p === "exists" || p === "missing" || p === "courier_gps",
    );

  return parts.length ? parts : ["any"];
}

export function matchesCustomerLocationRules(
  rules: CustomerLocationRule[],
  hasCustomerLocation: boolean,
  hasCourierLocation: boolean,
): boolean {
  if (rules.includes("any")) return true;
  return rules.some((rule) => {
    if (rule === "exists") return hasCustomerLocation;
    if (rule === "missing") return !hasCustomerLocation;
    if (rule === "courier_gps") return hasCourierLocation;
    return false;
  });
}
