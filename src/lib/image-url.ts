/**
 * مسارات من `public/` (صور، صوت، …) للعرض داخل المتصفح.
 * تُبقى نسبية من جذر الموقع (`/uploads/...`) — تُخدم من `app/uploads/[[...path]]/route.ts` أو من `public/uploads`.
 */
export function resolvePublicAssetSrc(url: string | null | undefined): string | null {
  if (!url) return null;
  const trimmed = url.trim();
  if (!trimmed || ["undefined", "null", "NaN"].includes(trimmed)) return null;

  if (trimmed.startsWith("data:")) return trimmed;

  // تنظيف الرابط وتوحيد السلاش
  let raw = trimmed.replace(/^['"]+|['"]+$/g, "").replace(/\\/g, "/");
  if (raw.startsWith("//")) raw = `https:${raw}`;

  // تحديد رابط R2 العام
  const r2Domain = process.env.NEXT_PUBLIC_R2_PUBLIC_URL || "https://pub-2f7b4947937d4575971a8f949826a575.r2.dev";
  const cleanDomain = r2Domain.replace(/\/$/, "");

  // إذا كان الرابط من Cloudflare R2، نقوم بإرجاعه بالنطاق العام المباشر
  if (raw.includes("r2.dev") || raw.includes("cloudflare")) {
    try {
      const urlObj = new URL(raw);
      const path = urlObj.pathname.startsWith("/") ? urlObj.pathname.slice(1) : urlObj.pathname;
      return `${cleanDomain}/${path}${urlObj.search}`;
    } catch {
      return raw;
    }
  }

  // إذا كان رابط API محلي نتركه كما هو
  if (raw.startsWith("/api/")) return raw;

  // معالجة الروابط المطلقة الأخرى
  if (raw.startsWith("http://") || raw.startsWith("https://")) {
    try {
      const urlObj = new URL(raw);
      const path = decodeURIComponent(urlObj.pathname);
      const uploadsIdx = path.toLowerCase().indexOf("/uploads/");
      if (uploadsIdx >= 0) {
        const cleanPath = path.slice(uploadsIdx + 9).replace(/^\/+/, "");
        return `${cleanDomain}/${cleanPath}${urlObj.search}`;
      }

      const cleanPath = path.startsWith("/") ? path.slice(1) : path;
      return `${cleanDomain}/${cleanPath}${urlObj.search}`;
    } catch {
      return raw;
    }
  }

  // الروابط النسبية
  let relativePath = raw;
  if (relativePath.toLowerCase().startsWith("/uploads/")) {
    relativePath = relativePath.slice(9);
  } else if (relativePath.toLowerCase().startsWith("uploads/")) {
    relativePath = relativePath.slice(8);
  }

  const finalPath = relativePath.startsWith("/") ? relativePath.slice(1) : relativePath;
  return `${cleanDomain}/${finalPath}`;
}

export function resolvePublicImageSrc(url: string | null | undefined): string | null {
  return resolvePublicAssetSrc(url);
}
