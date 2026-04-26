/** عنوان الموقع العلني (بدون شرطة مائلة أخيرة) — للروابط في واتساب والمشاركة خارج الصفحة */
export function getPublicAppUrl(): string {
  const raw = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (raw) {
    return raw.replace(/\/+$/, "");
  }
  // الأولوية لـ Vercel
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL.replace(/\/+$/, "")}`;
  }
  // ثم Railway كخيار ثانٍ
  const rail = process.env.RAILWAY_PUBLIC_DOMAIN?.trim();
  if (rail) {
    return rail.startsWith("http") ? rail.replace(/\/+$/, "") : `https://${rail}`;
  }
<<<<<<< HEAD
  return "https://aboakbar.vercel.app";
=======
  return "https://tgrbatksebordarstor.vercel.app";
>>>>>>> b7070ca5d6d669896f97dc26039c2c78b4152e0a
}
