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

export type LatLng = { latitude: number; longitude: number };

function isValidLatLng(latitude: number, longitude: number): boolean {
  return (
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180
  );
}

function buildLatLng(latitude: number, longitude: number): LatLng | null {
  return isValidLatLng(latitude, longitude) ? { latitude, longitude } : null;
}

/**
 * يحاول استخراج إحداثيات الزبون من نص/رابط Google Maps.
 * يدعم صيغ:
 * - "30.44, 48.01"
 * - @lat,lng
 * - q=lat,lng / query=lat,lng / ll=lat,lng
 * - !3dlat!4dlng
 */
export function extractLatLngFromLocationInput(raw: string | null | undefined): LatLng | null {
  const value = String(raw ?? "").trim();
  if (!value) return null;

  const direct = value.match(/(-?\d+(?:\.\d+)?)\s*[,،]\s*(-?\d+(?:\.\d+)?)/);
  if (direct) {
    return buildLatLng(Number(direct[1]), Number(direct[2]));
  }

  const atPattern = value.match(/@(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/);
  if (atPattern) {
    return buildLatLng(Number(atPattern[1]), Number(atPattern[2]));
  }

  const dataPattern = value.match(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/);
  if (dataPattern) {
    return buildLatLng(Number(dataPattern[1]), Number(dataPattern[2]));
  }

  try {
    const url = new URL(value);
    const queryKeys = ["q", "query", "ll"];
    for (const key of queryKeys) {
      const candidate = url.searchParams.get(key);
      if (!candidate) continue;
      const m = candidate.match(/(-?\d+(?:\.\d+)?)\s*[,،]\s*(-?\d+(?:\.\d+)?)/);
      if (!m) continue;
      const result = buildLatLng(Number(m[1]), Number(m[2]));
      if (result) return result;
    }
  } catch {
    // ليست URL صالحة؛ تجاهل.
  }

  return null;
}

function isGoogleShortMapsUrl(value: string): boolean {
  try {
    const u = new URL(value);
    const host = u.hostname.toLowerCase();
    return host === "maps.app.goo.gl" || host === "goo.gl";
  } catch {
    return false;
  }
}

/**
 * نسخة ذكية: إذا الرابط مختصر (maps.app.goo.gl) نحاول فكّه أولاً ثم نستخرج lat/lng.
 */
export async function extractLatLngFromLocationInputSmart(
  raw: string | null | undefined,
): Promise<LatLng | null> {
  const direct = extractLatLngFromLocationInput(raw);
  if (direct) return direct;

  const value = String(raw ?? "").trim();
  if (!value || !isGoogleShortMapsUrl(value)) return null;

  try {
    const res = await fetch(value, {
      method: "GET",
      redirect: "follow",
      cache: "no-store",
    });
    const finalUrl = res.url || "";
    if (!finalUrl) return null;
    return extractLatLngFromLocationInput(finalUrl);
  } catch {
    return null;
  }
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
