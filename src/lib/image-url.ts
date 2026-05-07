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

 // إذا كان رابط API محلي نتركه كما هو
 if (raw.startsWith("/api/")) return raw;

 // معالجة الروابط المطلقة (R2 أو غيرها) لتمر عبر البروكسي
 if (raw.startsWith("http://") || raw.startsWith("https://")) {
 try {
 const urlObj = new URL(raw);
 const path = decodeURIComponent(urlObj.pathname);
 const uploadsIdx = path.toLowerCase().indexOf("/uploads/");
 if (uploadsIdx >= 0) return path.slice(uploadsIdx) + urlObj.search;

 const cleanPath = path.startsWith("/") ? path.slice(1) : path;
 return `/uploads/${cleanPath}${urlObj.search}`;
 } catch {
 return raw;
 }
 }

 // الروابط النسبية
 if (raw.toLowerCase().startsWith("/uploads/")) return raw;
 if (raw.toLowerCase().startsWith("uploads/")) return `/${raw}`;

 const finalPath = raw.startsWith("/") ? raw.slice(1) : raw;
 return `/uploads/${finalPath}`;
}

export function resolvePublicImageSrc(url: string | null | undefined): string | null {
 return resolvePublicAssetSrc(url);
}
