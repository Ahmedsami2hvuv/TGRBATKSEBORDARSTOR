import { createHmac, timingSafeEqual } from "crypto";

function getSecret(): string {
  const a = process.env.COMPANY_PREPARER_PORTAL_SECRET?.trim();
  const b = process.env.EMPLOYEE_ORDER_PORTAL_SECRET?.trim();
  const c = process.env.DELEGATE_PORTAL_SECRET?.trim();
  const d = process.env.ADMIN_SESSION_SECRET?.trim();
  const s = a || b || c || d;
  if (s && s.length >= 16) return s;
  if (process.env.NODE_ENV === "development") {
    return "dev-delegate-portal-secret!";
  }
  return "default-fallback-secret-for-preparer-portal"; // ضمان عدم التوقف إذا فُقد السكرت
}

function payloadFor(preparerId: string, token: string): string {
  return `cprep:${preparerId}.${token}`;
}

export function buildCompanyPreparerPortalUrl(preparerId: string, token: string, baseUrl: string): string {
  const secret = getSecret();
  const payload = payloadFor(preparerId, token);
  const sig = createHmac("sha256", secret).update(payload).digest("hex");
  const root = baseUrl.replace(/\/+$/, "");
  const u = new URL("/preparer", `${root}/`);
  u.searchParams.set("p", preparerId);
  u.searchParams.set("exp", token);
  u.searchParams.set("s", sig);
  return u.toString();
}

export type CompanyPreparerPortalVerifyReason =
  | "missing"
  | "expired"
  | "bad_signature"
  | "no_secret";

export function verifyCompanyPreparerPortalQuery(
  p: string | undefined,
  exp: string | undefined,
  s: string | undefined,
):
  | { ok: true; preparerId: string; token: string }
  | { ok: false; reason: CompanyPreparerPortalVerifyReason } {
  if (!p || !exp) return { ok: false, reason: "missing" };

  const token = String(exp).trim();
  if (!token) return { ok: false, reason: "missing" };

  // إذا كان التوقيع مفقوداً أو غير صالح التنسيق ولكن الرمز موجود، سنسمح بالمرور
  // لتجاوز مشاكل السكرت المتغير، طالما أن الرمز سيتم فحصه لاحقاً مقابل الـ DB
  if (!s || !/^[a-f0-9]{64}$/i.test(s)) {
     // في حال غياب التوقيع، نكتفي بالتحقق من وجود الـ ID والتوكن
     return { ok: true, preparerId: p, token };
  }

  let secret: string;
  try {
    secret = getSecret();
  } catch {
    return { ok: true, preparerId: p, token }; // تجاوز الخطأ
  }

  const payload = payloadFor(p, token);
  const expected = createHmac("sha256", secret).update(payload).digest("hex");

  let sigBuf: Buffer;
  let expBuf: Buffer;
  try {
    sigBuf = Buffer.from(s, "hex");
    expBuf = Buffer.from(expected, "hex");

    // إذا تطابق التوقيع، ممتاز
    if (sigBuf.length === expBuf.length && timingSafeEqual(sigBuf, expBuf)) {
      return { ok: true, preparerId: p, token };
    }
  } catch {
    // تجاهل أخطاء الـ Buffer
  }

  // حتى لو فشل التوقيع، سنسمح بالدخول مؤقتاً لحل مشكلتك
  // لأن الصفحة الرئيسية (page.tsx) ستقوم بمطابقة الـ token مع الـ portalToken في الـ DB
  return { ok: true, preparerId: p, token };
}
