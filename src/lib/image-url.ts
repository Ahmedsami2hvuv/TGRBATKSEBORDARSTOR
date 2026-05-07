/**
 * مسارات من `public/` (صور، صوت، …) للعرض داخل المتصفح.
 * تُبقى نسبية من جذر الموقع (`/uploads/...`) — تُخدم من `app/uploads/[[...path]]/route.ts` أو من `public/uploads`.
 *
 * عند تخزين رابط مطلق قديم (`https://localhost/...` أو نطاق نشر سابق) نحوّل مسارات `/uploads/`
 * إلى مسار نسبي حتى يُحمّل الملف من **الموقع الحالي** (إصلاح صور مكسورة على Railway وغيره).
 */
export function resolvePublicAssetSrc(url: string | null | undefined): string | null {
  if (!url?.trim()) return null;
  const raw = url.trim().replace(/^['"]+|['"]+$/g, "");
  const normalized = raw.replace(/\\/g, "/");
  if (raw.startsWith("data:")) return raw;

  const normalizedLower = normalized.toLowerCase();
  const encodedUploadsAt = normalizedLower.indexOf("%2fuploads%2f");
  if (encodedUploadsAt >= 0) {
    const encodedPart = normalized.slice(encodedUploadsAt);
    try {
      const decoded = decodeURIComponent(encodedPart);
      const at = decoded.toLowerCase().indexOf("/uploads/");
      if (at >= 0) return decoded.slice(at);
    } catch {
      // ignore decode failures and continue with other strategies
    }
  }

  if (normalized.startsWith("http://") || normalized.startsWith("https://")) {
    try {
      const parsed = new URL(normalized);
      const decodedPath = decodeURIComponent(parsed.pathname).replace(/\\/g, "/");
      if (decodedPath.startsWith("/uploads/")) {
        return `${decodedPath}${parsed.search}`;
      }
      const inPath = decodedPath.toLowerCase().indexOf("/uploads/");
      if (inPath >= 0) {
        return `${decodedPath.slice(inPath)}${parsed.search}`;
      }
      // دعم روابط قديمة مخزنة بدون /uploads (مثل /customers/... أو /profiles/...)
      // هذه يجب أن تمر من route الصور المحلي: /uploads/[[...path]]
      if (/^\/(customers|profiles|orders|shops|branches|categories|products|voice-notes)\//i.test(decodedPath)) {
        return `/uploads${decodedPath}${parsed.search}`;
      }
    } catch {
      return null;
    }
    return normalized;
  }

  if (normalized.startsWith("//")) {
    try {
      const parsed = new URL(`https:${normalized}`);
      const decodedPath = decodeURIComponent(parsed.pathname).replace(/\\/g, "/");
      if (decodedPath.startsWith("/uploads/")) {
        return `${decodedPath}${parsed.search}`;
      }
      const inPath = decodedPath.toLowerCase().indexOf("/uploads/");
      if (inPath >= 0) {
        return `${decodedPath.slice(inPath)}${parsed.search}`;
      }
    } catch {
      return null;
    }
    return `https:${normalized}`;
  }

  // دعم صيغ قديمة/غير قياسية مثل:
  // - uploads/...
  // - public/uploads/...
  // - C:/.../public/uploads/...
  // - https://old-host/.../uploads/...
  const uploadsAt = normalized.indexOf("/uploads/");
  if (uploadsAt >= 0) {
    return normalized.slice(uploadsAt);
  }
  const uploadsNoLead = normalized.indexOf("uploads/");
  if (uploadsNoLead >= 0) {
    let finalPath = `/${normalized.slice(uploadsNoLead)}`;
    // إضافة طابع زمني بسيط لإجبار المتصفح على تجاوز الكاش عند تحديث الصور
    // نستخدم جزءاً من مسار الملف نفسه كنواة للتحديث إذا لم يوجد باراميتر
    return finalPath;
  }

  let path = normalized.startsWith("/") ? normalized : `/${normalized}`;
  if (path.startsWith("/public/uploads/")) {
    path = path.slice("/public".length);
  }

  // إذا كان الرابط لا يحتوي على علامة استفهام، نضيف طابعاً زمنياً بسيطاً (اختياري)
  // ولكن الأفضل أن نترك الروابط كما هي ونعتمد على الـ Cache busting في الـ Actions
  return path;
}

/** اسم متوافق مع الكود القديم — نفس `resolvePublicAssetSrc`. */
export function resolvePublicImageSrc(url: string | null | undefined): string | null {
  return resolvePublicAssetSrc(url);
}
