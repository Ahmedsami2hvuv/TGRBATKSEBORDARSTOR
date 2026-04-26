import { createHmac, timingSafeEqual } from "crypto";

function getSecret(): string {
  const a = process.env.STAFF_EMPLOYEE_PORTAL_SECRET?.trim();
  const b = process.env.ADMIN_SESSION_SECRET?.trim();
  const s = a || b;
  if (s && s.length >= 16) return s;
  if (process.env.NODE_ENV === "development") return "dev-staff-portal-secret!";
  throw new Error("STAFF_EMPLOYEE_PORTAL_SECRET أو ADMIN_SESSION_SECRET مطلوب (16 حرفاً على الأقل)");
}

function payloadFor(staffEmployeeId: string, token: string): string {
  return `staff:${staffEmployeeId}.${token}`;
}

export function buildStaffEmployeePortalUrl(staffEmployeeId: string, token: string, baseUrl: string): string {
  const secret = getSecret();
  const payload = payloadFor(staffEmployeeId, token);
  const sig = createHmac("sha256", secret).update(payload).digest("hex");
  const root = baseUrl.replace(/\/+$/, "");
  const u = new URL("/staff/portal", `${root}/`);
  u.searchParams.set("se", staffEmployeeId);
  u.searchParams.set("exp", token);
  u.searchParams.set("s", sig);
  return u.toString();
}

export type StaffEmployeePortalVerifyReason = "missing" | "bad_signature" | "no_secret";

export function verifyStaffEmployeePortalQuery(
  se: string | undefined,
  exp: string | undefined,
  s: string | undefined,
):
  | { ok: true; staffEmployeeId: string; token: string }
  | { ok: false; reason: StaffEmployeePortalVerifyReason } {
  if (!se || !exp || !s) return { ok: false, reason: "missing" };
  if (!/^[a-f0-9]{64}$/i.test(s)) return { ok: false, reason: "bad_signature" };
  let secret: string;
  try {
    secret = getSecret();
  } catch {
    return { ok: false, reason: "no_secret" };
  }
  const token = String(exp).trim();
  if (!token) return { ok: false, reason: "missing" };
  const payload = payloadFor(se, token);
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
  return { ok: true, staffEmployeeId: se, token };
}

