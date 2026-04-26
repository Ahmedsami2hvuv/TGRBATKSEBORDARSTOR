/** حدود «يوم تقويمي» في بغداد (UTC+3 ثابت) كـ Date للفلترة في قاعدة البيانات */

/** تاريخ اليوم بتنسيق YYYY-MM-DD حسب منطقة بغداد */
export function baghdadYmdToday(): string {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Baghdad",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = fmt.formatToParts(new Date());
  const y = parts.find((p) => p.type === "year")?.value ?? "";
  const m = parts.find((p) => p.type === "month")?.value ?? "";
  const d = parts.find((p) => p.type === "day")?.value ?? "";
  return `${y}-${m}-${d}`;
}

export function baghdadDayRangeUtc(ymd: string): { gte: Date; lt: Date } | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return null;
  const [y, m, d] = ymd.split("-").map(Number);
  if (!y || m < 1 || m > 12 || d < 1 || d > 31) return null;
  const gte = new Date(Date.UTC(y, m - 1, d, 21, 0, 0, 0));
  gte.setUTCDate(gte.getUTCDate() - 1);
  const lt = new Date(Date.UTC(y, m - 1, d, 21, 0, 0, 0));
  return { gte, lt };
}

export function formatBaghdadDateLabel(ymd: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return ymd;
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d, 12, 0, 0, 0));
  return dt.toLocaleDateString("ar-IQ-u-nu-latn", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}
