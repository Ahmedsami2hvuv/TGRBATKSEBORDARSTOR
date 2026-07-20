/** نطاق تواريخ للتقارير — تخزين محلي (تقويم) */

function parseYMD(s: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s.trim());
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]) - 1;
  const d = Number(m[3]);
  const dt = new Date(`${s.trim()}T00:00:00+03:00`);
  if (Number.isNaN(dt.getTime())) return null;
  return dt;
}

export function formatYMDLocal(d: Date): string {
  return d.toLocaleDateString("en-CA", { timeZone: "Asia/Baghdad" });
}

function startOfDayLocal(d: Date): Date {
  const ymd = formatYMDLocal(d);
  return new Date(`${ymd}T00:00:00+03:00`);
}

function endOfDayLocal(d: Date): Date {
  const ymd = formatYMDLocal(d);
  return new Date(`${ymd}T23:59:59.999+03:00`);
}

function startOfShiftDayLocal(d: Date, hour: number): Date {
  const ymd = formatYMDLocal(d);
  const shiftStart = new Date(`${ymd}T${String(hour).padStart(2, "0")}:00:00+03:00`);
  if (d < shiftStart) {
    return new Date(shiftStart.getTime() - 24 * 60 * 60 * 1000);
  }
  return shiftStart;
}

function endOfShiftDayLocal(d: Date, hour: number): Date {
  const shiftStart = startOfShiftDayLocal(d, hour);
  return new Date(shiftStart.getTime() + 24 * 60 * 60 * 1000 - 1);
}

function startOfShiftDateLocal(d: Date, hour: number): Date {
  const ymd = formatYMDLocal(d);
  return new Date(`${ymd}T${String(hour).padStart(2, "0")}:00:00+03:00`);
}

function endOfShiftDateLocal(d: Date, hour: number): Date {
  const shiftStart = startOfShiftDateLocal(d, hour);
  return new Date(shiftStart.getTime() + 24 * 60 * 60 * 1000 - 1);
}

export type ReportDateRangeDefaults = "last30" | "today" | "month";

function normalizeSearchValue(value?: string | string[]): string | undefined {
  if (!value) return undefined;
  return Array.isArray(value) ? value[0] : value;
}

export function parseDateRangeFromSearchParams(
  sp: {
    from?: string | string[];
    to?: string | string[];
  },
  opts?: { defaults?: ReportDateRangeDefaults; shiftHour?: number },
): { from: Date; to: Date; fromInput: string; toInput: string } {
  const today = new Date();
  const defaults = opts?.defaults ?? "last30";
  const shiftHour = typeof opts?.shiftHour === "number" ? opts.shiftHour : 0;

  const fromParam = normalizeSearchValue(sp.from)?.trim();
  const toParam = normalizeSearchValue(sp.to)?.trim();

  const shiftFromDefault = shiftHour > 0 ? startOfShiftDayLocal(today, shiftHour) : startOfDayLocal(today);
  const shiftToDefault = shiftHour > 0 ? startOfShiftDayLocal(today, shiftHour) : startOfDayLocal(today);

  let fromInput = fromParam || formatYMDLocal(shiftFromDefault);
  let toInput = toParam || formatYMDLocal(shiftToDefault);

  if (!fromParam) {
    if (defaults === "month") {
      const todayYmd = formatYMDLocal(today);
      const [y, m] = todayYmd.split("-");
      const monthStart = new Date(`${y}-${m}-01T00:00:00+03:00`);
      fromInput = formatYMDLocal(shiftHour > 0 ? startOfShiftDateLocal(monthStart, shiftHour) : startOfDayLocal(monthStart));
    } else if (defaults === "last30") {
      const todayBaghdadStr = today.toLocaleString("en-US", { timeZone: "Asia/Baghdad" });
      const todayBaghdad = new Date(todayBaghdadStr);
      const prior = new Date(todayBaghdad);
      prior.setDate(prior.getDate() - 29);
      fromInput = formatYMDLocal(shiftHour > 0 ? startOfShiftDateLocal(prior, shiftHour) : startOfDayLocal(prior));
    }
  }

  if (!toParam) {
    toInput = formatYMDLocal(shiftToDefault);
  }

  const parsedFrom = parseYMD(fromInput);
  const parsedTo = parseYMD(toInput);

  let from = parsedFrom
    ? shiftHour > 0
      ? startOfShiftDateLocal(parsedFrom, shiftHour)
      : startOfDayLocal(parsedFrom)
    : shiftFromDefault;
  let to = parsedTo
    ? shiftHour > 0
      ? endOfShiftDateLocal(parsedTo, shiftHour)
      : endOfDayLocal(parsedTo)
    : shiftToDefault;

  if (from > to) {
    const t = from;
    from = shiftHour > 0 ? startOfShiftDayLocal(to, shiftHour) : startOfDayLocal(to);
    to = shiftHour > 0 ? endOfShiftDayLocal(t, shiftHour) : endOfDayLocal(t);
    fromInput = formatYMDLocal(startOfDayLocal(from));
    toInput = formatYMDLocal(startOfDayLocal(to));
  }

  return {
    from,
    to,
    fromInput,
    toInput,
  };
}
