/** تطبيع بسيط لمطابقة اسم المنطقة مع عنوان القائمة (عربي). */
export function normalizeRegionNameForMatch(s: string): string {
  return s
    .trim()
    .replace(/[\u064B-\u065F]/g, "")
    .replace(/أ|إ|آ/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/\s+/g, " ")
    .toLowerCase();
}
