/**
 * أدوات بحث الطلبات بالتاريخ والوقت.
 *
 * - `generateDateSearchTokens` تُنتج كل التهجئات الممكنة لتاريخ ووقت الطلب
 *   ليُلصقها مكوّن البحث الفوري داخل سلسلة المطابقة (haystack)، فيتطابق
 *   كل ما يكتبه المستخدم (يوم، شهر، سنة، يوم/شهر، وقت بصيغ مختلفة).
 *
 * - `parseBaghdadDateRange` تُحوّل ما يكتبه المستخدم في حقل البحث على الخادم
 *   إلى مدى زمني (`gte`/`lt`) لتمريره لـ Prisma عند الاستعلام بقاعدة البيانات.
 *
 * كل المنطق يعتمد على توقيت بغداد (UTC+3) لأنّ التطبيق عراقيّ.
 */

import { normalizeDigits } from "@/lib/money-alf";

// مفتاح الإزاحة الزمنية لبغداد بالميلي ثانية. لا توجد ساعة صيفية في العراق منذ 2008.
const BAGHDAD_OFFSET_MS = 3 * 60 * 60 * 1000;

const ARABIC_WEEKDAYS = [
  "الأحد",
  "الإثنين",
  "الاثنين",
  "الثلاثاء",
  "الأربعاء",
  "الخميس",
  "الجمعة",
  "السبت",
];

const ARABIC_MONTH_NAMES = [
  "يناير",
  "فبراير",
  "مارس",
  "أبريل",
  "ابريل",
  "مايو",
  "يونيو",
  "يوليو",
  "أغسطس",
  "اغسطس",
  "سبتمبر",
  "أكتوبر",
  "اكتوبر",
  "نوفمبر",
  "ديسمبر",
];

/** يُحوّل تاريخاً (UTC) إلى مكوّناته بتوقيت بغداد. */
function toBaghdadParts(d: Date): {
  year: number;
  month: number;
  day: number;
  hour24: number;
  hour12: number;
  minute: number;
  weekdayIndex: number;
  isPm: boolean;
} {
  const shifted = new Date(d.getTime() + BAGHDAD_OFFSET_MS);
  const year = shifted.getUTCFullYear();
  const month = shifted.getUTCMonth() + 1;
  const day = shifted.getUTCDate();
  const hour24 = shifted.getUTCHours();
  const minute = shifted.getUTCMinutes();
  const weekdayIndex = shifted.getUTCDay();
  const isPm = hour24 >= 12;
  const hour12Raw = hour24 % 12;
  const hour12 = hour12Raw === 0 ? 12 : hour12Raw;
  return { year, month, day, hour24, hour12, minute, weekdayIndex, isPm };
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

/**
 * تُنتج قائمة من المقاطع النصّية المرتبطة بتاريخ/وقت الطلب لتلصقها بسلسلة البحث.
 *
 * المقاطع تشمل:
 *  - YYYY-MM-DD / YYYY/MM/DD
 *  - DD/MM/YYYY / D/M/YYYY / DD-MM-YYYY
 *  - DD/MM (بدون السنة)
 *  - YY/MM/DD (السنة المختصرة)
 *  - أسماء اليوم والشهر بالعربية
 *  - الوقت بصيغ HH:MM و H:MM (٢٤ ساعة) وصيغة ١٢ ساعة مع ص/م
 */
export function generateDateSearchTokens(
  createdAtIso?: string | null,
  orderNoteTime?: string | null,
): string {
  const out: string[] = [];

  if (orderNoteTime && orderNoteTime.trim()) {
    out.push(orderNoteTime.trim());
  }

  if (createdAtIso && createdAtIso.trim()) {
    const d = new Date(createdAtIso);
    if (!Number.isNaN(d.getTime())) {
      const { year, month, day, hour24, hour12, minute, weekdayIndex, isPm } =
        toBaghdadParts(d);

      const yyyy = String(year);
      const yy = String(year % 100).padStart(2, "0");
      const mm = pad2(month);
      const m = String(month);
      const dd = pad2(day);
      const dn = String(day);
      const hh = pad2(hour24);
      const h = String(hour24);
      const min = pad2(minute);
      const h12 = String(hour12);
      const ampm = isPm ? "م" : "ص";

      out.push(
        // التواريخ بصيغة الأرقام
        `${yyyy}-${mm}-${dd}`,
        `${yyyy}/${mm}/${dd}`,
        `${yyyy}.${mm}.${dd}`,
        `${dd}/${mm}/${yyyy}`,
        `${dn}/${m}/${yyyy}`,
        `${dd}-${mm}-${yyyy}`,
        `${dn}-${m}-${yyyy}`,
        `${yy}/${mm}/${dd}`,
        `${dd}/${mm}/${yy}`,
        `${dn}/${m}/${yy}`,
        `${dd}/${mm}`,
        `${dn}/${m}`,
        `${dd}-${mm}`,

        // الوقت بصيغة ٢٤ ساعة
        `${hh}:${min}`,
        `${h}:${min}`,

        // الوقت بصيغة ١٢ ساعة + ص/م
        `${h12}:${min} ${ampm}`,
        `${h12}:${min}${ampm}`,
        `${h12} ${ampm}`,
        `${h12}${ampm}`,

        // مكوّنات منفردة
        yyyy,
        yy,
        mm,
        dd,
        dn,
      );

      const weekday = ARABIC_WEEKDAYS[weekdayIndex] ?? "";
      if (weekday) out.push(weekday);

      const monthName = ARABIC_MONTH_NAMES[month - 1] ?? "";
      if (monthName) out.push(monthName);
    }
  }

  return out.join(" ");
}

/** يُنشئ Date مطابقاً لـ "yyyy-MM-dd 00:00 بتوقيت بغداد" بصيغة UTC. */
function baghdadMidnightUtc(year: number, month: number, day: number): Date {
  // 00:00 بغداد = اليوم السابق 21:00 UTC
  const utcMs = Date.UTC(year, month - 1, day, 0, 0, 0, 0) - BAGHDAD_OFFSET_MS;
  return new Date(utcMs);
}

function isValidDate(year: number, month: number, day: number): boolean {
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return false;
  if (month < 1 || month > 12) return false;
  if (day < 1 || day > 31) return false;
  // تحقّق منطقي بسيط (شباط 30 مثلاً)
  const probe = new Date(Date.UTC(year, month - 1, day));
  return (
    probe.getUTCFullYear() === year &&
    probe.getUTCMonth() === month - 1 &&
    probe.getUTCDate() === day
  );
}

/**
 * يحاول استخراج تاريخ من نص يكتبه المستخدم في حقل البحث، ويعيد مدى زمنياً
 * (`gte` يوم البحث 00:00 بغداد، `lt` اليوم التالي 00:00 بغداد).
 *
 * يدعم:
 *  - "اليوم" / "أمس" / "امس"
 *  - YYYY-MM-DD، YYYY/MM/DD، YYYY.MM.DD
 *  - DD/MM/YYYY، DD-MM-YYYY
 *  - DD/MM (بدون سنة → السنة الحالية في بغداد)
 *  - YY/MM/DD (سنة من رقمين)
 *
 * إذا لم يستطع التعرّف على شكل التاريخ يعيد `null`.
 */
export function parseBaghdadDateRange(query: string): { gte: Date; lt: Date } | null {
  const raw = normalizeDigits(query.trim());
  if (!raw) return null;

  // اختصارات نصّية
  const lc = raw.toLowerCase();
  if (lc === "اليوم" || lc === "اليوم.") {
    const now = toBaghdadParts(new Date());
    const gte = baghdadMidnightUtc(now.year, now.month, now.day);
    const lt = new Date(gte.getTime() + 24 * 60 * 60 * 1000);
    return { gte, lt };
  }
  if (lc === "امس" || lc === "أمس") {
    const now = toBaghdadParts(new Date());
    const today = baghdadMidnightUtc(now.year, now.month, now.day);
    const gte = new Date(today.getTime() - 24 * 60 * 60 * 1000);
    const lt = today;
    return { gte, lt };
  }

  const sep = "[\\/\\-\\.]"; // فاصل: شَرطة، شُرطة، نقطة

  // YYYY-MM-DD أو YYYY/MM/DD أو YYYY.MM.DD
  let m = raw.match(new RegExp(`^(\\d{4})${sep}(\\d{1,2})${sep}(\\d{1,2})$`));
  if (m) {
    const year = Number(m[1]);
    const month = Number(m[2]);
    const day = Number(m[3]);
    if (isValidDate(year, month, day)) {
      const gte = baghdadMidnightUtc(year, month, day);
      const lt = new Date(gte.getTime() + 24 * 60 * 60 * 1000);
      return { gte, lt };
    }
    return null;
  }

  // DD-MM-YYYY أو DD/MM/YYYY أو DD.MM.YYYY
  m = raw.match(new RegExp(`^(\\d{1,2})${sep}(\\d{1,2})${sep}(\\d{4})$`));
  if (m) {
    const day = Number(m[1]);
    const month = Number(m[2]);
    const year = Number(m[3]);
    if (isValidDate(year, month, day)) {
      const gte = baghdadMidnightUtc(year, month, day);
      const lt = new Date(gte.getTime() + 24 * 60 * 60 * 1000);
      return { gte, lt };
    }
    return null;
  }

  // YY/MM/DD أو DD/MM/YY (سنة من رقمين)
  m = raw.match(new RegExp(`^(\\d{2})${sep}(\\d{1,2})${sep}(\\d{1,2})$`));
  if (m) {
    const a = Number(m[1]);
    const b = Number(m[2]);
    const c = Number(m[3]);
    // حاول تفسيرها على الصيغة YY/MM/DD أوّلاً (التي تظهر في عمود التاريخ)
    const yearGuess1 = 2000 + a;
    if (isValidDate(yearGuess1, b, c)) {
      const gte = baghdadMidnightUtc(yearGuess1, b, c);
      const lt = new Date(gte.getTime() + 24 * 60 * 60 * 1000);
      return { gte, lt };
    }
    // ثم DD/MM/YY
    const yearGuess2 = 2000 + c;
    if (isValidDate(yearGuess2, b, a)) {
      const gte = baghdadMidnightUtc(yearGuess2, b, a);
      const lt = new Date(gte.getTime() + 24 * 60 * 60 * 1000);
      return { gte, lt };
    }
    return null;
  }

  // DD/MM (بدون سنة)
  m = raw.match(new RegExp(`^(\\d{1,2})${sep}(\\d{1,2})$`));
  if (m) {
    const a = Number(m[1]);
    const b = Number(m[2]);
    const now = toBaghdadParts(new Date());
    if (isValidDate(now.year, b, a)) {
      const gte = baghdadMidnightUtc(now.year, b, a);
      const lt = new Date(gte.getTime() + 24 * 60 * 60 * 1000);
      return { gte, lt };
    }
    return null;
  }

  return null;
}
