import { prisma } from "@/lib/prisma";
import { getIraqTime } from "@/lib/baghdad-time";
import {
  ensurePreparerSalaryConfigColumnsIfMissing,
  ensurePreparerWorkLogShiftNameColumnIfMissing
} from "@/lib/db-self-heal-employee-location";

export type PreparerShiftStatus = {
  shouldShowButton: boolean;
  shiftKey: "shift1" | "shift2" | null;
  shiftLabel: string;
  alreadyRecorded: boolean;
};

/**
 * تحويل نص الوقت إلى دقائق من بداية اليوم بدقة
 * يدعم نظام 24 ساعة ونظام 12 ساعة والشفت المسائي
 */
export function parseShiftTimeToMinutes(timeStr: string, isEveningShift = false): number {
  if (!timeStr) return 0;
  const trimmed = timeStr.trim().toLowerCase();
  const isPM = trimmed.includes("pm") || trimmed.includes("م");
  const isAM = trimmed.includes("am") || trimmed.includes("ص");

  const clean = trimmed.replace(/[^\d:]/g, "");
  const [rawH, rawM] = clean.split(":").map(Number);
  let h = rawH || 0;
  const m = rawM || 0;

  if (isPM && h < 12) {
    h += 12;
  } else if (isAM && h === 12) {
    h = 0;
  } else if (!isPM && !isAM && isEveningShift) {
    // إذا كان شفت مسائي، والساعة أقل من 12 نعتبرها مساءً تلقائياً (مثل 04:00 عصراً تصبح 16:00)
    if (h > 0 && h < 12) {
      h += 12;
    }
  }

  return h * 60 + m;
}

/**
 * فحص الشفت الحالي للمجهز وحالة تسجيل الشفت بتوقيت العراق
 * - يعتمد على أوقات الشفتات المحددة للمجهز من قبل الإدارة بدقة متناهية
 * - يظهر الزر في الشفت الصباحي إذا لم يسجل، ويختفي بعد تسجيله
 * - يظهر الزر في الشفت المسائي إذا لم يسجل، ويختفي بعد تسجيله
 * - خارج أوقات الشفتين يختفي الزر كلياً
 */
export async function getPreparerShiftStatus(preparerId: string): Promise<PreparerShiftStatus> {
  await ensurePreparerSalaryConfigColumnsIfMissing();
  await ensurePreparerWorkLogShiftNameColumnIfMissing();

  const preparer = await prisma.companyPreparer.findUnique({
    where: { id: preparerId },
    select: {
      id: true,
      shift1Start: true,
      shift1End: true,
      shift2Start: true,
      shift2End: true,
    },
  });

  if (!preparer) {
    return { shouldShowButton: false, shiftKey: null, shiftLabel: "", alreadyRecorded: false };
  }

  const iraq = getIraqTime(new Date());
  const currentMinutes = iraq.hours * 60 + iraq.minutes;

  const s1Start = parseShiftTimeToMinutes(preparer.shift1Start || "08:00", false);
  const s1End = parseShiftTimeToMinutes(preparer.shift1End || "13:00", false);
  const s2Start = parseShiftTimeToMinutes(preparer.shift2Start || "15:30", true);
  const s2End = parseShiftTimeToMinutes(preparer.shift2End || "23:59", true);

  let shiftKey: "shift1" | "shift2" | null = null;
  let shiftLabel = "";

  // 1. فحص الشفت الأول (الصباحي) بدقة حسب وقت الإدارة
  if (currentMinutes >= s1Start && currentMinutes <= s1End) {
    shiftKey = "shift1";
    shiftLabel = "الصباحي";
  }
  // 2. فحص الشفت الثاني (المسائي) بدقة حسب وقت الإدارة
  else if (
    (s2Start <= s2End && currentMinutes >= s2Start && currentMinutes <= s2End) ||
    (s2Start > s2End && (currentMinutes >= s2Start || currentMinutes <= s2End))
  ) {
    shiftKey = "shift2";
    shiftLabel = "المسائي";
  }

  // إذا كان خارج وقت الشفتين المحدد من الإدارة، يختفي الزر نهائياً
  if (!shiftKey) {
    return { shouldShowButton: false, shiftKey: null, shiftLabel: "", alreadyRecorded: false };
  }

  // فحص هل سجّل المجهز حضور هذا الشفت المحدد اليوم بتوقيت العراق
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const recentLogs = await prisma.companyPreparerWorkLog.findMany({
    where: {
      preparerId,
      shiftName: shiftKey,
      createdAt: { gte: twentyFourHoursAgo },
    },
    select: { createdAt: true },
    orderBy: { createdAt: "desc" },
  });

  const alreadyRecorded = recentLogs.some((log) => {
    const logIraq = getIraqTime(log.createdAt);
    return (
      logIraq.year === iraq.year &&
      logIraq.month === iraq.month &&
      logIraq.day === iraq.day
    );
  });

  return {
    shouldShowButton: !alreadyRecorded,
    shiftKey,
    shiftLabel,
    alreadyRecorded,
  };
}

/**
 * تسجيل شفت المجهز يدوياً وحفظ السجل واحتساب استحقاقه
 */
export async function recordPreparerShiftPresence(preparerId: string): Promise<{ ok: boolean; error?: string }> {
  const status = await getPreparerShiftStatus(preparerId);
  if (!status.shiftKey) {
    return { ok: false, error: "وقت الشفت غير متاح حالياً حسب توقيت الإدارة." };
  }

  if (status.alreadyRecorded) {
    return { ok: true };
  }

  await ensurePreparerWorkLogShiftNameColumnIfMissing();

  await prisma.companyPreparerWorkLog.create({
    data: {
      preparerId,
      shiftName: status.shiftKey,
      actionType: "manual_shift_presence",
    },
  });

  return { ok: true };
}
