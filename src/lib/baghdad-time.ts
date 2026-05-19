export function formatBaghdadDateTime(
  dateInput: Date | string | number,
  opts: { dateStyle?: "short" | "medium"; timeStyle?: "short" | "medium" } = {
    dateStyle: "short",
    timeStyle: "short",
  },
): string {
  const date = dateInput instanceof Date ? dateInput : new Date(dateInput);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("ar-IQ-u-nu-latn", {
    ...opts,
    timeZone: "Asia/Baghdad",
  });
}

export function isTodayBaghdad(dateInput: Date | string | number): boolean {
  const date = dateInput instanceof Date ? dateInput : new Date(dateInput);
  if (Number.isNaN(date.getTime())) return false;
  const baghdadDate = date.toLocaleDateString("en-US", { timeZone: "Asia/Baghdad" });
  const nowBaghdad = new Date().toLocaleDateString("en-US", { timeZone: "Asia/Baghdad" });
  return baghdadDate === nowBaghdad;
}

export function getBaghdadDateString(dateInput: Date | string | number): string {
  const date = dateInput instanceof Date ? dateInput : new Date(dateInput);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-US", { timeZone: "Asia/Baghdad" });
}

export function formatBaghdadDateFriendly(dateInput: Date | string | number): string {
  const date = dateInput instanceof Date ? dateInput : new Date(dateInput);
  if (Number.isNaN(date.getTime())) return "";

  if (isTodayBaghdad(date)) return "طلبيات اليوم";

  return date.toLocaleDateString("ar-IQ-u-nu-latn", {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: "Asia/Baghdad",
  });
}
