function normalizeArabicAndLatin(s: string): string {
  // توحيد بسيط: إزالة التشكيل/الرموز ثم تحويل المسافات لشرطة
  const trimmed = s.trim().toLowerCase();
  const noDiacritics = trimmed.normalize("NFKD").replace(/[\u0300-\u036f]/g, "");
  return noDiacritics;
}

export function slugify(raw: string): string {
  const n = normalizeArabicAndLatin(raw);
  // السماح بالحروف العربية/اللاتينية والأرقام فقط، وتحويل الباقي إلى "-"
  const cleaned = n
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/-+/g, "-")
    .replace(/(^-|-$)/g, "");
  return cleaned || "item";
}

export function uniqueSlug(base: string, suffix: string): string {
  const b = slugify(base);
  const s = slugify(suffix);
  return `${b}-${s}`.replace(/-+/g, "-");
}

