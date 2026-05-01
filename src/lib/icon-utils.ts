/**
 * تنظيف الروابط وتجهيزها للعرض المستقر 100%
 */
export function cleanIconUrl(url: string): string {
  if (!url) return "";
  let cleaned = url.trim();

  // 1. حذف الرموز المخفية والمسافات الصفرية (Zero-width)
  cleaned = cleaned.replace(/[\u200B-\u200D\uFEFF]/g, "");

  // 2. إصلاح البروتوكول إذا كان ناقصاً (مثل // التي تظهر في صورتك)
  if (cleaned.startsWith("//")) {
    cleaned = "https:" + cleaned;
  } else if (cleaned.startsWith("lottie.host")) {
    cleaned = "https://" + cleaned;
  }

  // 3. استخراج الرابط الحقيقي فقط
  const urlRegex = /(https?:\/\/[^\s"'<>{}|\\^~[\]`]+)/g;
  const matches = cleaned.match(urlRegex);

  if (matches && matches.length > 0) {
    return matches[0];
  }

  return cleaned;
}

export function isLottieDirectAssetUrl(url: string): boolean {
  if (!url) return false;
  const cleaned = cleanIconUrl(url).toLowerCase();
  return cleaned.includes("lottie") || cleaned.endsWith(".json");
}

/**
 * تحويل رابط lottie.host إلى رابط Embed المضمون الذي لا يختفي أبداً
 */
export function getLottieDisplayUrl(url: string): string {
  const cleaned = cleanIconUrl(url);

  // لروابط lottie.host، نحولها لرابط الـ Embed المستقر جداً
  if (cleaned.includes("lottie.host") && !cleaned.includes("/embed/")) {
    // يحول من: https://lottie.host/xxxx/yyyy.json
    // إلى: https://lottie.host/embed/xxxx/yyyy.json
    return cleaned.replace("lottie.host/", "lottie.host/embed/");
  }

  return cleaned;
}
