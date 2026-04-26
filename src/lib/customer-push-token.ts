import { createHmac, timingSafeEqual } from "crypto";

function getSecret(): string {
  const a = process.env.CUSTOMER_PUSH_SECRET?.trim();
  const b = process.env.ADMIN_SESSION_SECRET?.trim();
  const s = a || b;
  if (s && s.length >= 16) return s;
  throw new Error("CUSTOMER_PUSH_SECRET أو ADMIN_SESSION_SECRET مطلوب لتوقيع رابط العميل");
}

/** توقيع ثابت لكل عميل — للتحقق من رابط تفعيل الإشعارات فقط */
export function signCustomerPush(customerId: string): string {
  return createHmac("sha256", getSecret()).update(`customer-push:${customerId}`).digest("hex");
}

export function verifyCustomerPushSignature(customerId: string, sig: string): boolean {
  try {
    const expected = signCustomerPush(customerId);
    const a = Buffer.from(sig.trim(), "hex");
    const b = Buffer.from(expected, "hex");
    return a.length === b.length && timingSafeEqual(a, b);
  } catch {
    return false;
  }
}
