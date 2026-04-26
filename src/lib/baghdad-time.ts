export function formatBaghdadDateTime(
  date: Date,
  opts: { dateStyle?: "short" | "medium"; timeStyle?: "short" | "medium" } = {
    dateStyle: "short",
    timeStyle: "short",
  },
): string {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("ar-IQ-u-nu-latn", {
    ...opts,
    timeZone: "Asia/Baghdad",
  });
}

export function isTodayBaghdad(date: Date): boolean {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return false;
  const baghdadDate = date.toLocaleDateString("en-US", { timeZone: "Asia/Baghdad" });
  const nowBaghdad = new Date().toLocaleDateString("en-US", { timeZone: "Asia/Baghdad" });
  return baghdadDate === nowBaghdad;
}

export function getBaghdadDateString(date: Date): string {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-US", { timeZone: "Asia/Baghdad" });
}

export function formatBaghdadDateFriendly(date: Date): string {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return "";

  if (isTodayBaghdad(date)) return "طلبيات اليوم";

  return date.toLocaleDateString("ar-IQ-u-nu-latn", {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: "Asia/Baghdad",
  });
}
