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

export function getIraqTime(date: Date): { year: number; month: number; day: number; hours: number; minutes: number } {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Baghdad",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    hour12: false,
  });
  const parts = formatter.formatToParts(date);
  const getPart = (type: string) => parseInt(parts.find(p => p.type === type)?.value || "0");
  return {
    year: getPart("year"),
    month: getPart("month"),
    day: getPart("day"),
    hours: getPart("hour"),
    minutes: getPart("minute")
  };
}

export function formatBaghdadMoneyRecordedAt(dateInput: Date | string): { dateStr: string; timeStr: string; fullStr: string } {
  const dateObj = dateInput instanceof Date ? dateInput : new Date(dateInput);
  if (Number.isNaN(dateObj.getTime())) return { dateStr: "—", timeStr: "—", fullStr: "—" };

  const iraq = getIraqTime(dateObj);
  const y = iraq.year;
  const m = String(iraq.month).padStart(2, "0");
  const d = String(iraq.day).padStart(2, "0");
  const hh = String(iraq.hours).padStart(2, "0");
  const mm = String(iraq.minutes).padStart(2, "0");

  const dateStr = `${y}/${m}/${d}`;
  const timeStr = `${hh}:${mm}`;
  return { dateStr, timeStr, fullStr: `${dateStr}  ${timeStr}` };
}


