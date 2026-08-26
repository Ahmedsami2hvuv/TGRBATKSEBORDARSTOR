/** تطبيع بسيط لمطابقة اسم المنطقة مع عنوان القائمة (عربي). */
export function normalizeRegionNameForMatch(s: string): string {
  if (!s) return "";
  return s
    .trim()
    .replace(/[\u064B-\u065F]/g, "")
    .replace(/أ|إ|آ|ء/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/\s+/g, " ")
    .toLowerCase();
}

/** تطبيع النص العربي الشامل للبحث المرن */
export function normalizeArabicSearchText(s: string): string {
  if (!s) return "";
  return s
    .trim()
    .toLowerCase()
    .replace(/[\u064B-\u065F]/g, "")
    .replace(/[أإآء]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/[^\w\s\u0600-\u06FF]/g, " ")
    .replace(/\s+/g, " ");
}

