/** القيم المخزّنة في قاعدة البيانات بالدينار الكامل؛ العرض والإدخال بالألف (10 = 10000 دينار). */

export const ALF_PER_DINAR = 1000;

const ARABIC_NUMERAL_MAP: Record<string, string> = {
  "٠": "0",
  "١": "1",
  "٢": "2",
  "٣": "3",
  "٤": "4",
  "٥": "5",
  "٦": "6",
  "٧": "7",
  "٨": "8",
  "٩": "9",
  "۰": "0",
  "۱": "1",
  "۲": "2",
  "۳": "3",
  "۴": "4",
  "۵": "5",
  "۶": "6",
  "۷": "7",
  "۸": "8",
  "۹": "9",
  "٫": ".",
  "،": ",",
  "ٮ": ".",
};

/** تحويل الأرقام العربية/الهندية (١٢٣) إلى أرقام إنجليزية (123) وضبط فواصل الأرقام العربية */
export function normalizeNumerals(v: any): string {
  const str = (v ?? "").toString();
  return Array.from(str)
    .map((ch) => ARABIC_NUMERAL_MAP[ch as string] ?? ch)
    .join("");
}

export function normalizeDigits(v: unknown): string {
  return normalizeNumerals(v).replace(/[^0-9]/g, "");
}

function toNumber(v: unknown): number | null {
  if (v == null) return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  const normalized = normalizeNumerals(v).replace(/,/g, ".").trim();
  const n = parseFloat(normalized);
  return Number.isFinite(n) ? n : null;
}

function trimTrailingZeros(s: string): string {
  return s.replace(/\.?0+$/, "") || "0";
}

/** عرض مبلغ مخزّن بالدينار كرقم بالألف (بدون كلمة «ألف»). */
export function formatDinarAsAlf(v: unknown): string {
  const n = toNumber(v);
  if (n == null) return "—";
  const alf = n / ALF_PER_DINAR;
  return trimTrailingZeros(alf.toFixed(2));
}

/** عرض مع ذكر الوحدة */
export function formatDinarAsAlfWithUnit(v: unknown): string {
  if (toNumber(v) == null) return "—";
  return `${formatDinarAsAlf(v)} ألف`;
}

/** قيمة افتراضية لحقول الإدخال (نص بالألف) من رقم دينار */
export function dinarDecimalToAlfInputString(v: unknown): string {
  const n = toNumber(v);
  if (n == null) return "";
  const alf = n / ALF_PER_DINAR;
  return trimTrailingZeros(alf.toFixed(2));
}

/** تحويل ما يكتبه المستخدم (بالألف) إلى دينار (رقم) للتخزين */
export function parseAlfInputToDinarNumber(raw: string): number | null {
  const normalized = normalizeNumerals(raw).replace(/,/g, ".").trim();
  if (!normalized) return null;
  const n = parseFloat(normalized);
  if (!Number.isFinite(n) || n < 0) return null;
  return n * ALF_PER_DINAR;
}

export function parseAlfInputToDinarDecimalRequired(
  raw: string,
): { ok: true; value: number } | { ok: false } {
  const v = parseAlfInputToDinarNumber(raw);
  if (v == null) return { ok: false };
  return { ok: true, value: v };
}

/** حقل مبلغ اختياري فارغ = null */
export function parseOptionalAlfInputToDinar(
  raw: string,
): { ok: true; value: number | null } | { ok: false } {
  const normalized = normalizeNumerals(raw).replace(/,/g, ".").trim();
  if (!normalized) return { ok: true, value: null };
  const n = parseFloat(normalized);
  if (!Number.isFinite(n) || n < 0) return { ok: false };
  return { ok: true, value: n * ALF_PER_DINAR };
}

/** للحسابات الداخلية: نص ألف → دينار، فارغ = 0 */
export function parseAlfInputToDinarOrZero(raw: string): number {
  return parseAlfInputToDinarNumber(raw) ?? 0;
}

/** فلاتر البحث: المستخدم يدخل المبلغ بالألف → حدّ دينار في الاستعلام */
export function alfAmountToDinarFilter(n: number): number {
  if (!Number.isFinite(n)) return n;
  return n * ALF_PER_DINAR;
}
