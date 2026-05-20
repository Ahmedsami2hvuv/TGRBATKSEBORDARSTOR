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

  const numberPattern = "([+-]?\\d+(?:\\.\\d+)?)";
  const direct = value.match(new RegExp(`${numberPattern}\\s*[,،]\\s*${numberPattern}`));
  if (direct) {
    return buildLatLng(Number(direct[1]), Number(direct[2]));
  }

  const atPattern = value.match(new RegExp(`@${numberPattern},\\s*${numberPattern}`));
  if (atPattern) {
    return buildLatLng(Number(atPattern[1]), Number(atPattern[2]));
  }

  const dataPattern = value.match(new RegExp(`!3d${numberPattern}!4d${numberPattern}`));
  if (dataPattern) {
    return buildLatLng(Number(dataPattern[1]), Number(dataPattern[2]));
  }

  // صيغة Google DMS مثل: 30°26'47.6"N 48°01'24.6"E
  const decoded = decodeURIComponent(value);
  const dmsPattern =
    /(\d+(?:\.\d+)?)°\s*(\d+(?:\.\d+)?)['’]\s*(\d+(?:\.\d+)?)["”]?\s*([NS]).*?(\d+(?:\.\d+)?)°\s*(\d+(?:\.\d+)?)['’]\s*(\d+(?:\.\d+)?)["”]?\s*([EW])/i;
  const dms = decoded.match(dmsPattern);
  if (dms) {
    const latDeg = Number(dms[1]);
    const latMin = Number(dms[2]);
    const latSec = Number(dms[3]);
    const latHem = String(dms[4]).toUpperCase();
    const lngDeg = Number(dms[5]);
    const lngMin = Number(dms[6]);
    const lngSec = Number(dms[7]);
    const lngHem = String(dms[8]).toUpperCase();

    let latitude = latDeg + latMin / 60 + latSec / 3600;
    let longitude = lngDeg + lngMin / 60 + lngSec / 3600;
    if (latHem === "S") latitude *= -1;
    if (lngHem === "W") longitude *= -1;
    const result = buildLatLng(latitude, longitude);
    if (result) return result;
  }

  try {
    const url = new URL(value);
    const queryKeys = ["q", "query", "ll"];
    for (const key of queryKeys) {
      const candidate = url.searchParams.get(key);
      if (!candidate) continue;
      const m = candidate.match(new RegExp(`${numberPattern}\\s*[,،]\\s*${numberPattern}`));
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

export async function resolveGoogleShortMapsUrl(raw: string | null | undefined): Promise<LatLng | null> {
  const value = String(raw ?? "").trim();
  if (!value || !isGoogleShortMapsUrl(value)) return null;

  try {
    // محاولة سريعة لقراءة رأس Location عند وجود إعادة توجيه (302)
    try {
      const headRes = await fetch(value, {
        method: "GET",
        redirect: "manual",
        cache: "no-store",
        headers: {
          "user-agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
          "accept-language": "en-US,en;q=0.9",
        },
      });

      const locationHeader = headRes.headers && (headRes.headers.get ? headRes.headers.get("location") : null);
      if (locationHeader) {
        const parsedFinal = extractLatLngFromLocationInput(locationHeader);
        if (parsedFinal) return parsedFinal;
      }
    } catch {
      // تجاهل أخطاء الرأس، سنجرب التحميل الكامل كحل احتياطي
    }

    // تحميل كامل الصفحة ومحاولة العثور على روابط أو إحداثيات ضمن المحتوى
    const res = await fetch(value, {
      method: "GET",
      redirect: "follow",
      cache: "no-store",
      headers: {
        "user-agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "accept-language": "en-US,en;q=0.9",
      },
    });
    const finalUrl = res.url || "";
    if (finalUrl) {
      const parsedFinal = extractLatLngFromLocationInput(finalUrl);
      if (parsedFinal) return parsedFinal;
    }

    const body = await res.text();
    if (!body) return null;

    const decodedBody = body
      .replace(/\\u003d/g, "=")
      .replace(/\\u0026/g, "&")
      .replace(/\\\//g, "/");

    const mapsUrlPattern = /https?:\/\/(?:www\.)?google\.[^"'\s<>]+\/maps\/[^"'\s<>]+/gi;
    const links = decodedBody.match(mapsUrlPattern) ?? [];
    for (const link of links) {
      const parsed = extractLatLngFromLocationInput(link);
      if (parsed) return parsed;
    }

    const pair = decodedBody.match(/([+-]?\d{1,2}\.\d{4,})\s*[,،]\s*([+-]?\d{1,3}\.\d{4,})/);
    if (pair) {
      const parsed = buildLatLng(Number(pair[1]), Number(pair[2]));
      if (parsed) return parsed;
    }

    return null;
  } catch {
    return null;
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
  if (!value) return null;

  if (typeof window === "undefined") {
    return resolveGoogleShortMapsUrl(value);
  }

  if (!isGoogleShortMapsUrl(value)) return null;

  try {
    const apiUrl = `/api/resolve-google-location?url=${encodeURIComponent(value)}`;
    const response = await fetch(apiUrl, {
      method: "GET",
      cache: "no-store",
    });
    if (!response.ok) return null;
    const data = await response.json();
    if (typeof data?.latitude === "number" && typeof data?.longitude === "number") {
      return buildLatLng(data.latitude, data.longitude);
    }
    return null;
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
