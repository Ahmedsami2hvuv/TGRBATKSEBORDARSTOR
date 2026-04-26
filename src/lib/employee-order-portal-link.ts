import { createHmac, timingSafeEqual } from "crypto";

/**
 * رابط إدخال الطلب لموظف المحل (عميل المحل / مُدخل الطلب) — موقّع بمعرّف الموظف.
 * الزبون (مستلم التوصيل) يُذكر داخل نموذج الطلب، وليس صاحب هذا الرابط.
 * التوقيع مختلف عن /mandoub (المندوب) حتى لا يُستبدل الرابطان.
 * الحمولة: order:{employeeId}.{token}
 *
 * ملاحظة: نُبقي اسم بارامتر الرابط `exp` لأسباب توافقية/تاريخية، لكنه هنا يحمل قيمة token
 * وليس تاريخ انتهاء.
 */
function getSecret(): string {
  const a = process.env.EMPLOYEE_ORDER_PORTAL_SECRET?.trim();
  const b = process.env.SHOP_PORTAL_SECRET?.trim();
  const c = process.env.DELEGATE_PORTAL_SECRET?.trim();
  const d = process.env.ADMIN_SESSION_SECRET?.trim();
  const s = a || b || c || d;
  if (s && s.length >= 16) return s;
  if (process.env.NODE_ENV === "development") {
    return "dev-delegate-portal-secret!";
  }
  throw new Error(
    "EMPLOYEE_ORDER_PORTAL_SECRET أو أحد أسرار البوابات مطلوب (16 حرفاً على الأقل)",
  );
}

function payloadFor(employeeId: string, token: string): string {
  return `order:${employeeId}.${token}`;
}

/** رابط يفتحه موظف المحل ليعبّي تفاصيل الطلب — مرتبط بالموظف (المحل من جهته) */
export function buildEmployeeOrderPortalUrl(
  employeeId: string,
  token: string,
  baseUrl: string,
): string {
  const secret = getSecret();
  const payload = payloadFor(employeeId, token);
  const sig = createHmac("sha256", secret).update(payload).digest("hex");
  const root = baseUrl.replace(/\/+$/, "");
  const u = new URL("/client/order", `${root}/`);
  u.searchParams.set("e", employeeId);
  u.searchParams.set("exp", token);
  u.searchParams.set("s", sig);
  return u.toString();
}

/** رابط تجهيز طلبيات للموظف (تحليل وتحويل للمجهّز) — نفس توقيع بوابة الموظف */
export function buildEmployeePreparationPortalUrl(
  employeeId: string,
  token: string,
  baseUrl: string,
): string {
  const orderUrl = buildEmployeeOrderPortalUrl(employeeId, token, baseUrl);
  // نفس بارامترات التوقيع؛ فقط تغيير المسار
  return orderUrl.replace("/client/order?", "/client/order/preparation?");
}

export type EmployeeOrderPortalVerifyReason =
  | "expired"
  | "missing"
  | "bad_signature"
  | "no_secret";

export function verifyEmployeeOrderPortalQuery(
  e: string | undefined,
  exp: string | undefined,
  s: string | undefined,
):
  | { ok: true; employeeId: string; token: string }
  | { ok: false; reason: EmployeeOrderPortalVerifyReason } {
  if (!e || !exp || !s) return { ok: false, reason: "missing" };
  if (!/^[a-f0-9]{64}$/i.test(s)) return { ok: false, reason: "bad_signature" };
  let secret: string;
  try {
    secret = getSecret();
  } catch {
    return { ok: false, reason: "no_secret" };
  }
  const token = String(exp).trim();
  if (!token) return { ok: false, reason: "missing" };
  const payload = payloadFor(e, token);
  const expected = createHmac("sha256", secret).update(payload).digest("hex");
  let sigBuf: Buffer;
  let expBuf: Buffer;
  try {
    sigBuf = Buffer.from(s, "hex");
    expBuf = Buffer.from(expected, "hex");
  } catch {
    return { ok: false, reason: "bad_signature" };
  }
  if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) {
    return { ok: false, reason: "bad_signature" };
  }
  return { ok: true, employeeId: e, token };
}
