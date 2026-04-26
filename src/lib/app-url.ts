/** عنوان الموقع العلني (بدون شرطة مائلة أخيرة) — للروابط في واتساب والمشاركة خارج الصفحة */
export function getPublicAppUrl(): string {
  const raw = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (raw) {
    return raw.replace(/\/+$/, "");
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL.replace(/\/+$/, "")}`;
  }
  const rail = process.env.RAILWAY_PUBLIC_DOMAIN?.trim();
  if (rail) {
    return rail.startsWith("http") ? rail.replace(/\/+$/, "") : `https://${rail}`;
  }
  return "http://localhost:3000";
}
