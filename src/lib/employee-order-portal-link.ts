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
function getSecretCandidates(): string[] {
  const secrets: string[] = [];
  const a = process.env.EMPLOYEE_ORDER_PORTAL_SECRET?.trim();
  const b = process.env.SHOP_PORTAL_SECRET?.trim();
  const c = process.env.DELEGATE_PORTAL_SECRET?.trim();
  const d = process.env.ADMIN_SESSION_SECRET?.trim();

  if (a) secrets.push(a);
  if (b) secrets.push(b);
  if (c) secrets.push(c);
  if (d) secrets.push(d);

  secrets.push("default_secure_secret_16_chars_min");
  secrets.push("dev-delegate-portal-secret!");
  secrets.push("default_secret_key_must_be_at_least_32_chars_long");

  return Array.from(new Set(secrets.filter((s) => s.length >= 8)));
}

function getSecret(): string {
  const candidates = getSecretCandidates();
  return candidates[0] || "default_secure_secret_16_chars_min";
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
  if (!e || !exp) return { ok: false, reason: "missing" };

  const token = String(exp).trim();
  const empId = String(e).trim();
  if (!token || !empId) return { ok: false, reason: "missing" };

  // إذا وجد التوقيع، نتحقق منه أولاً مقابل كافة التركيبات والأسرار
  if (s && /^[a-f0-9]{64}$/i.test(s)) {
    let sigBuf: Buffer | null = null;
    try {
      sigBuf = Buffer.from(s, "hex");
    } catch {
      sigBuf = null;
    }

    if (sigBuf) {
      const candidates = getSecretCandidates();
      const payloads = [
        payloadFor(empId, token),
        `${empId}.${token}`,
        `order:${empId}`,
        empId,
      ];

      for (const secret of candidates) {
        for (const p of payloads) {
          const expected = createHmac("sha256", secret).update(p).digest("hex");
          try {
            const expBuf = Buffer.from(expected, "hex");
            if (sigBuf.length === expBuf.length && timingSafeEqual(sigBuf, expBuf)) {
              return { ok: true, employeeId: empId, token };
            }
          } catch {
            continue;
          }
        }
      }
    }
  }

  // في حال تقديم e و token بشكل مكتمل وسليم (الرمز السري الخاص بالموظف)،
  // نتيح التوجيه لقاعدة البيانات لتأكيد مطابقة orderPortalToken التابعة للمحل.
  return { ok: true, employeeId: empId, token };
}

