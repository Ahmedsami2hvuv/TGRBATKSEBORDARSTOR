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
 * فحص الشفت الحالي للمجهز وحالة تسجيل الشفت بتوقيت العراق
 * - يعتمد على أوقات الشفتات المحددة للمجهز في الإدارة (shift1Start/End, shift2Start/End)
 * - يظهر الزر أثناء وقت الشفت إذا لم يسجل بعد، ويختفي بعد التسجيل
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

  const parseTimeToMinutes = (timeStr: string, isEvening?: boolean) => {
    let [h, m] = (timeStr || "00:00").split(":").map(Number);
    h = h || 0;
    m = m || 0;
    if (isEvening && h > 0 && h < 12) {
      h += 12;
    }
    return h * 60 + m;
  };

  const iraq = getIraqTime(new Date());
  const currentMinutes = iraq.hours * 60 + iraq.minutes;

  const s1Start = parseTimeToMinutes(preparer.shift1Start || "08:00", false);
  const s1End = parseTimeToMinutes(preparer.shift1End || "13:00", false);
  const s2Start = parseTimeToMinutes(preparer.shift2Start || "15:30", true);
  const s2End = parseTimeToMinutes(preparer.shift2End || "23:59", true);

  let shiftKey: "shift1" | "shift2" | null = null;
  let shiftLabel = "";

  // فحص الشفت 1
  if (currentMinutes >= s1Start && currentMinutes <= s1End) {
    shiftKey = "shift1";
    shiftLabel = "الصباحي";
  }
  // فحص الشفت 2
  else if (currentMinutes >= s2Start && currentMinutes <= s2End) {
    shiftKey = "shift2";
    shiftLabel = "المسائي";
  }

  // إذا كان خارج وقت الشفتين
  if (!shiftKey) {
    return { shouldShowButton: false, shiftKey: null, shiftLabel: "", alreadyRecorded: false };
  }

  // فحص هل سجّل المجهز حضور هذا الشفت يدوياً اليوم
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const recentLogs = await prisma.companyPreparerWorkLog.findMany({
    where: {
      preparerId,
      shiftName: shiftKey,
      actionType: "manual_shift_presence",
      createdAt: { gte: twentyFourHoursAgo },
    },
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
    return { ok: false, error: "وقت الشفت غير متاح حالياً." };
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
