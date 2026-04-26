import { createHmac, timingSafeEqual } from "crypto";

function getSecret(): string {
  const a = process.env.DELEGATE_PORTAL_SECRET?.trim();
  const b = process.env.ADMIN_SESSION_SECRET?.trim();
  const s = a || b;
  if (s && s.length >= 16) return s;
  if (process.env.NODE_ENV === "development") {
    return "dev-delegate-portal-secret!";
  }
  throw new Error(
    "DELEGATE_PORTAL_SECRET أو ADMIN_SESSION_SECRET مطلوب (16 حرفاً على الأقل) لتوقيع روابط المندوب",
  );
}

/** مدة صلاحية رابط موظف المحل `/client/order` (بالأيام). روابط المندوب `/mandoub` أصبحت دائمة ولا تستخدم هذا. */
export function delegatePortalTtlSeconds(): number {
  const raw = process.env.DELEGATE_PORTAL_LINK_TTL_DAYS?.trim();
  const n = raw ? parseInt(raw, 10) : 90;
  const days = Number.isFinite(n) && n > 0 && n <= 3650 ? n : 90;
  return days * 86400;
}

function hmacSha256Hex(secret: string, payload: string): string {
  return createHmac("sha256", secret).update(payload).digest("hex");
}

function timingSafeSigEqual(s: string, expectedHex: string): boolean {
  try {
    const sigBuf = Buffer.from(s, "hex");
    const expBuf = Buffer.from(expectedHex, "hex");
    return sigBuf.length === expBuf.length && timingSafeEqual(sigBuf, expBuf);
  } catch {
    return false;
  }
}

/**
 * رابط لوحة المندوب دائم: `?c=<courierId>&s=<hmac>` فقط.
 * الروابط القديمة التي تحتوي `exp` ما زالت تعمل (نفس التوقيع السابق، دون فحص انتهاء الصلاحية).
 */
export function buildDelegatePortalUrl(courierId: string, baseUrl: string): string {
  const secret = getSecret();
  const sig = hmacSha256Hex(secret, courierId);
  const root = baseUrl.replace(/\/+$/, "");
  const u = new URL("/mandoub", `${root}/`);
  u.searchParams.set("c", courierId);
  u.searchParams.set("s", sig);
  return u.toString();
}

export type DelegatePortalVerifyReason =
  | "missing"
  | "bad_signature"
  | "no_secret";

export function verifyDelegatePortalQuery(
  c: string | undefined,
  exp: string | undefined,
  s: string | undefined,
): { ok: true; courierId: string } | { ok: false; reason: DelegatePortalVerifyReason } {
  if (!c?.trim() || !s?.trim()) return { ok: false, reason: "missing" };
  if (!/^[a-f0-9]{64}$/i.test(s)) return { ok: false, reason: "bad_signature" };
  let secret: string;
  try {
    secret = getSecret();
  } catch {
    return { ok: false, reason: "no_secret" };
  }

  const expTrim = exp?.trim() ?? "";
  if (expTrim) {
    const expN = parseInt(expTrim, 10);
    if (!Number.isNaN(expN)) {
      const legacyPayload = `${c}.${expN}`;
      if (timingSafeSigEqual(s, hmacSha256Hex(secret, legacyPayload))) {
        return { ok: true, courierId: c };
      }
    }
  }

  if (timingSafeSigEqual(s, hmacSha256Hex(secret, c))) {
    return { ok: true, courierId: c };
  }

  return { ok: false, reason: "bad_signature" };
}
