/**
 * مسارات من `public/` (صور، صوت، …) للعرض داخل المتصفح.
 * تُبقى نسبية من جذر الموقع (`/uploads/...`) — تُخدم من `app/uploads/[[...path]]/route.ts` أو من `public/uploads`.
 */
export function resolvePublicAssetSrc(url: string | null | undefined): string | null {
  if (!url) return null;
  let trimmed = url.trim();
  if (!trimmed || ["undefined", "null", "NaN"].includes(trimmed)) return null;

  // تنظيف علامات الاقتباس والأقواس المحيطة
  trimmed = trimmed.replace(/^['"]+|['"]+$/g, "").trim();

  // فحص ما إذا كان الرابط هو رابط موقع جغرافي/خريطة (وليس صورة/ملف)
  if (
    trimmed.includes("maps.google.com") ||
    trimmed.includes("goo.gl/maps") ||
    trimmed.includes("maps.app.goo.gl") ||
    trimmed.includes("waze.com") ||
    trimmed.startsWith("geo:")
  ) {
    // روابط الخرائط ليست أصول صور ويجب عدم محاولة عرضها كوسائط
    return null;
  }

  if (trimmed.startsWith("data:")) return trimmed;

  // توحيد السلاش
  let raw = trimmed.replace(/\\/g, "/");
  if (raw.startsWith("//")) raw = `https:${raw}`;

  // إذا كان الرابط من Cloudflare R2، نقوم بتحويله ليمر عبر البروكسي المحلي لتجنب الـ 401
  if (raw.includes("r2.dev") || raw.includes("cloudflare")) {
    try {
      const urlObj = new URL(raw);
      const path = urlObj.pathname.startsWith("/") ? urlObj.pathname.slice(1) : urlObj.pathname;
      return `/uploads/${path}${urlObj.search}`;
    } catch {
      return raw;
    }
  }

  // إذا كان رابط API محلي نتركه كما هو
  if (raw.startsWith("/api/")) return raw;

  // معالجة الروابط المطلقة الأخرى (الخارجية)
  if (raw.startsWith("http://") || raw.startsWith("https://")) {
    try {
      const urlObj = new URL(raw);
      const path = decodeURIComponent(urlObj.pathname);
      const uploadsIdx = path.toLowerCase().indexOf("/uploads/");
      if (uploadsIdx >= 0) return path.slice(uploadsIdx) + urlObj.search;

      // إذا كان رابط خارجي مباشر نتركه كما هو
      return raw;
    } catch {
      return raw;
    }
  }

  // الروابط النسبية
  if (raw.toLowerCase().startsWith("/uploads/")) return raw;
  if (raw.toLowerCase().startsWith("uploads/")) return `/${raw}`;

  // مسارات الأصول الثابتة من images/
  if (raw.toLowerCase().startsWith("/images/") || raw.toLowerCase().startsWith("images/")) {
    return raw.startsWith("/") ? raw : `/${raw}`;
  }

  const finalPath = raw.startsWith("/") ? raw.slice(1) : raw;
  return `/uploads/${finalPath}`;
}

export function resolvePublicImageSrc(url: string | null | undefined): string | null {
  return resolvePublicAssetSrc(url);
}
