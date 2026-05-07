/**
 * مسارات من `public/` (صور، صوت، …) للعرض داخل المتصفح.
 * تُبقى نسبية من جذر الموقع (`/uploads/...`) — تُخدم من `app/uploads/[[...path]]/route.ts` أو من `public/uploads`.
 */
export function resolvePublicAssetSrc(url: string | null | undefined): string | null {
  if (!url?.trim()) return null;
  const raw = url.trim().replace(/^['"]+|['"]+$/g, "");
  const normalized = raw.replace(/\\/g, "/");
  if (raw.startsWith("data:")) return raw;

  const folderPatterns = /^\/?(customers|profiles|orders|shops|branches|categories|products|voice-notes|attachments)\//i;

  // 1. التعامل مع الروابط المطلقة (http/https)
  if (normalized.startsWith("http://") || normalized.startsWith("https://") || normalized.startsWith("//")) {
    try {
      const urlObj = new URL(normalized.startsWith("//") ? `https:${normalized}` : normalized);
      const decodedPath = decodeURIComponent(urlObj.pathname).replace(/\\/g, "/");

      // إذا كان الرابط يحتوي على /uploads/ مسبقاً
      const uploadsAt = decodedPath.toLowerCase().indexOf("/uploads/");
      if (uploadsAt >= 0) {
        return `${decodedPath.slice(uploadsAt)}${urlObj.search}`;
      }

      // إذا كان الرابط يشير لمجلد معروف مباشرة
      if (folderPatterns.test(decodedPath)) {
        const match = decodedPath.match(folderPatterns);
        if (match) {
          const startAt = decodedPath.indexOf(match[1]);
          return `/uploads/${decodedPath.slice(startAt)}${urlObj.search}`;
        }
      }

      // دعم الصور في جذر الموقع
      if (/\.(jpg|jpeg|png|webp|gif|svg)$/i.test(decodedPath) && decodedPath.split('/').length <= 2) {
        return `/uploads${decodedPath}${urlObj.search}`;
      }

      return normalized;
    } catch {
      return normalized;
    }
  }

  // 2. التعامل مع الروابط النسبية
  let path = normalized;

  // إذا كان يبدأ بـ /uploads/ أو uploads/
  if (path.toLowerCase().startsWith("/uploads/")) return path;
  if (path.toLowerCase().startsWith("uploads/")) return `/${path}`;

  // إزالة /public/ إذا وجدت في البداية
  if (path.toLowerCase().startsWith("/public/")) path = path.slice(7);
  if (path.toLowerCase().startsWith("public/")) path = path.slice(6);

  // إذا كان المسار يبدأ بمجلد معروف (مع أو بدون /)
  if (folderPatterns.test(path)) {
    const cleanPath = path.startsWith("/") ? path.slice(1) : path;
    return `/uploads/${cleanPath}`;
  }

  // إذا كان مجرد اسم ملف في جذر الصور
  if (/\.(jpg|jpeg|png|webp|gif|svg)$/i.test(path) && !path.includes("/")) {
    return `/uploads/${path}`;
  }

  return path.startsWith("/") ? path : `/${path}`;
}

/** اسم متوافق مع الكود القديم — نفس `resolvePublicAssetSrc`. */
export function resolvePublicImageSrc(url: string | null | undefined): string | null {
  return resolvePublicAssetSrc(url);
}
