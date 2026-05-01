/**
 * دوال مساعدة فائقة الدقة للأيقونات لضمان عملها في المتصفح
 */

/**
 * تنظيف الرابط من أي نصوص أو رموز تعبيرية زائدة (مثل Emojis التي تلتصق بالرابط)
 */
export function cleanIconUrl(url: string): string {
  if (!url) return "";

  // 1. إزالة المسافات من البداية والنهاية
  let cleaned = url.trim();

  // 2. البحث عن أول رابط يبدأ بـ http أو https وينتهي عند أول مسافة أو حرف غير صالح في الروابط
  const match = cleaned.match(/https?:\/\/[^\s"'<>{}|\\^~[\]`]+/);
  if (match) {
    cleaned = match[0];
  }

  return cleaned;
}

/**
 * التحقق مما إذا كان الرابط هو ملف Lottie مباشر
 */
export function isLottieDirectAssetUrl(url: string): boolean {
  const cleaned = cleanIconUrl(url).toLowerCase();
  if (!cleaned) return false;

  return (
    cleaned.includes("lottie.host") ||
    cleaned.endsWith(".json") ||
    cleaned.includes("assets.lottiefiles.com") ||
    cleaned.includes("storage.lottiefiles.com")
  );
}

/**
 * تجهيز الرابط للعرض الصحيح وتجنب الـ 404
 */
export function getLottieDisplayUrl(url: string): string {
  const cleaned = cleanIconUrl(url);
  if (!cleaned) return "";

  // إذا كان الرابط lottie.host، فهو دائماً مباشر ولا يجب وضعه في iframe
  if (isLottieDirectAssetUrl(cleaned)) return cleaned;

  // تحويل روابط lottiefiles التقليدية إلى embed إذا لزم الأمر
  if (cleaned.includes("lottiefiles.com/animations") && !cleaned.endsWith(".json")) {
    return cleaned.replace("lottiefiles.com/animations/", "https://embed.lottiefiles.com/animation/");
  }

  return cleaned;
}
