/**
 * دوال مساعدة فائقة الدقة للأيقونات لضمان عملها في المتصفح
 */

export function cleanIconUrl(url: string): string {
  if (!url) return "";
  let cleaned = url.trim();
  // استخراج الرابط فقط وتجاهل أي نصوص أو رموز تعبيرية ملتصقة به
  const match = cleaned.match(/https?:\/\/[^\s"'<>{}|\\^~[\]`]+/);
  return match ? match[0] : cleaned;
}

export function isLottieDirectAssetUrl(url: string): boolean {
  if (!url) return false;
  const cleaned = cleanIconUrl(url).toLowerCase();

  // أي رابط يحتوي على lottie أو ينتهي بـ .json هو أنيميشن ولا يجب معاملته كصورة أبداً
  return (
    cleaned.includes("lottie") ||
    cleaned.endsWith(".json") ||
    cleaned.includes("dotlottie")
  );
}

export function getLottieDisplayUrl(url: string): string {
  const cleaned = cleanIconUrl(url);
  if (!cleaned) return "";

  if (isLottieDirectAssetUrl(cleaned)) return cleaned;

  if (cleaned.includes("lottiefiles.com/animations")) {
    return cleaned.replace("lottiefiles.com/animations/", "https://embed.lottiefiles.com/animation/");
  }

  return cleaned;
}
