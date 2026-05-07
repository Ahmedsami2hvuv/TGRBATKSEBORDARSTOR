/**
 * مسارات من `public/` (صور، صوت، …) للعرض داخل المتصفح.
 * تُبقى نسبية من جذر الموقع (`/uploads/...`) — تُخدم من `app/uploads/[[...path]]/route.ts` أو من `public/uploads`.
 */
export function resolvePublicAssetSrc(url: string | null | undefined): string | null {
  if (!url) return null;
  const trimmed = url.trim();
  if (!trimmed || trimmed === "undefined" || trimmed === "null" || trimmed === "NaN") return null;

  // تنظيف الرابط من الاقتباسات والسلاش المزدوج المتكرر (إلا في البروتوكول)
  let raw = trimmed.replace(/^['"]+|['"]+$/g, "");
  if (raw.startsWith("data:")) return raw;

  // معالجة الروابط التي تبدأ بـ // (بدون بروتوكول)
  if (raw.startsWith("//")) raw = `https:${raw}`;

  const normalized = raw.replace(/\\/g, "/").replace(/([^:])\/\//g, "$1/");

  // قائمة المجلدات المعروفة في R2
  const folders = [
    "customers", "customer", "profiles", "profile", "orders", "order",
    "shops", "shop", "branches", "branch", "attachments", "attachment",
    "customer-photos", "door-photos", "door-photo", "categories", "products", "voice-notes"
  ];

  // 1. روابط API المحلية (يتم إرجاعها كما هي)
  if (normalized.startsWith("/api/")) return normalized;

  // 2. الروابط المطلقة
  if (normalized.startsWith("http://") || normalized.startsWith("https://")) {
    try {
      const urlObj = new URL(normalized);
      const decodedPath = decodeURIComponent(urlObj.pathname).replace(/\\/g, "/");
      const lowerDecoded = decodedPath.toLowerCase();

      // البحث عن /uploads/ في المسار
      const uploadsAt = lowerDecoded.indexOf("/uploads/");
      if (uploadsAt >= 0) return `${decodedPath.slice(uploadsAt)}${urlObj.search}`;

      // البحث عن مجلد معروف في المسار المطلق
      for (const f of folders) {
        const idx = lowerDecoded.indexOf(`/${f}/`);
        if (idx >= 0) return `/uploads${decodedPath.slice(idx)}${urlObj.search}`;
        if (lowerDecoded.startsWith(`${f}/`)) return `/uploads/${decodedPath}${urlObj.search}`;
      }

      // إذا كان ملفاً معروفاً، نمرره للبروكسي ليبحث عنه
      if (/\.(jpg|jpeg|png|webp|gif|svg|mp3|wav|m4a)$/i.test(decodedPath)) {
        const parts = decodedPath.split('/');
        const fileName = parts.pop();
        if (fileName) return `/uploads/${fileName}${urlObj.search}`;
      }

      return normalized;
    } catch {
      return normalized;
    }
  }

  // 3. الروابط النسبية
  let path = normalized;
  if (path.toLowerCase().startsWith("/uploads/")) return path;
  if (path.toLowerCase().startsWith("uploads/")) return `/${path}`;

  // إزالة /public/ إذا وجدت
  if (path.toLowerCase().startsWith("/public/")) path = path.slice(7);
  else if (path.toLowerCase().startsWith("public/")) path = path.slice(6);

  const cleanPath = path.startsWith("/") ? path.slice(1) : path;
  const lowerPath = cleanPath.toLowerCase();

  // هل يبدأ بمجلد معروف أو يحتوي على امتداد؟
  for (const f of folders) {
    if (lowerPath.startsWith(`${f}/`)) return `/uploads/${cleanPath}`;
  }

  if (/\.(jpg|jpeg|png|webp|gif|svg|mp3|wav|m4a)$/i.test(cleanPath)) {
    return `/uploads/${cleanPath}`;
  }

  return path.startsWith("/") ? path : `/${path}`;
}

export function resolvePublicImageSrc(url: string | null | undefined): string | null {
  return resolvePublicAssetSrc(url);
}
