/** نطاق تواريخ للتقارير — تخزين محلي (تقويم) */

function parseYMD(s: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s.trim());
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]) - 1;
  const d = Number(m[3]);
  const dt = new Date(y, mo, d);
  if (dt.getFullYear() !== y || dt.getMonth() !== mo || dt.getDate() !== d) return null;
  return dt;
}

export function formatYMDLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function startOfDayLocal(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
}

function endOfDayLocal(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
}

function startOfShiftDayLocal(d: Date, hour: number): Date {
  const shiftStart = new Date(d.getFullYear(), d.getMonth(), d.getDate(), hour, 0, 0, 0);
  if (d < shiftStart) {
    shiftStart.setDate(shiftStart.getDate() - 1);
  }
  return shiftStart;
}

function endOfShiftDayLocal(d: Date, hour: number): Date {
  const shiftStart = startOfShiftDayLocal(d, hour);
  const nextShiftStart = new Date(shiftStart);
  nextShiftStart.setDate(nextShiftStart.getDate() + 1);
  return new Date(nextShiftStart.getTime() - 1);
}

function startOfShiftDateLocal(d: Date, hour: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), hour, 0, 0, 0);
}

function endOfShiftDateLocal(d: Date, hour: number): Date {
  const shiftStart = startOfShiftDateLocal(d, hour);
  const nextShiftStart = new Date(shiftStart);
  nextShiftStart.setDate(nextShiftStart.getDate() + 1);
  return new Date(nextShiftStart.getTime() - 1);
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
      const monthStart = new Date(today.getFullYear(), today.getMonth(), 1, 0, 0, 0, 0);
      fromInput = formatYMDLocal(shiftHour > 0 ? startOfShiftDateLocal(monthStart, shiftHour) : startOfDayLocal(monthStart));
    } else if (defaults === "last30") {
      const prior = new Date(today);
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
