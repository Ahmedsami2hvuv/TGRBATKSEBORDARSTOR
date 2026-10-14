import { prisma } from "@/lib/prisma";
import { getIraqTime } from "@/lib/baghdad-time";
import { ensureCourierWorkLogTableIfMissing } from "@/lib/db-self-heal-employee-location";
import { notifyTelegramPresenceChange } from "@/lib/telegram-notify";
import { pushNotifyAdminsPresenceChange } from "@/lib/web-push-server";

export type CourierShiftInfo = {
  shouldShowButton: boolean;
  shiftKey: "morning" | "evening" | null;
  shiftLabel: string;
  dateKey: string;
  alreadyRecorded: boolean;
};

/**
 * فحص الشفت الحالي وحالة تسجيل حضور المندوب بتوقيت العراق
 * - الشفت الصباحي: يظهر من 8:00 صباحاً حتى 15:59
 * - الشفت المسائي: يظهر من 4:00 عصراً (16:00) حتى 23:59
 * - قبل 8:00 صباحاً: يختفي الزر
 */
export async function getCourierShiftStatus(courierId: string): Promise<CourierShiftInfo> {
  const iraq = getIraqTime(new Date());
  const dateKey = `${iraq.year}-${String(iraq.month).padStart(2, "0")}-${String(iraq.day).padStart(2, "0")}`;

  let shiftKey: "morning" | "evening" | null = null;
  let shiftLabel = "";

  if (iraq.hours >= 8 && iraq.hours < 16) {
    shiftKey = "morning";
    shiftLabel = "الصباحي";
  } else if (iraq.hours >= 16) {
    shiftKey = "evening";
    shiftLabel = "المسائي";
  }

  // إذا لم نكن في وقت ظهور أي شفت (مثلاً قبل 8 صباحاً)
  if (!shiftKey) {
    return {
      shouldShowButton: false,
      shiftKey: null,
      shiftLabel: "",
      dateKey,
      alreadyRecorded: false,
    };
  }

  await ensureCourierWorkLogTableIfMissing();

  // فحص هل المندوب سجّل في هذا الشفت اليوم
  let alreadyRecorded = false;
  try {
    const existing = await prisma.courierWorkLog.findFirst({
      where: {
        courierId,
        dateKey,
        shiftName: shiftKey,
      },
      select: { id: true },
    });
    alreadyRecorded = !!existing;
  } catch (err) {
    // احتياطي استعلام مباشر إذا حدث أي تأخير في العميل
    try {
      const rows = await prisma.$queryRawUnsafe<any[]>(
        `SELECT id FROM "CourierWorkLog" WHERE "courierId" = $1 AND "dateKey" = $2 AND "shiftName" = $3 LIMIT 1`,
        courierId,
        dateKey,
        shiftKey
      );
      alreadyRecorded = rows && rows.length > 0;
    } catch {
      alreadyRecorded = false;
    }
  }

  return {
    shouldShowButton: !alreadyRecorded,
    shiftKey,
    shiftLabel,
    dateKey,
    alreadyRecorded,
  };
}

/**
 * تسجيل حضور المندوب في الشفت الحالي
 */
export async function recordCourierShiftPresence(courierId: string): Promise<{ ok: boolean; error?: string }> {
  const status = await getCourierShiftStatus(courierId);

  if (!status.shiftKey) {
    return { ok: false, error: "وقت تسجيل الحضور غير متاح حالياً (يبدأ 8:00 صباحاً و 4:00 عصراً)." };
  }

  if (status.alreadyRecorded) {
    return { ok: true };
  }

  await ensureCourierWorkLogTableIfMissing();

  const courier = await prisma.courier.findUnique({
    where: { id: courierId },
    select: { id: true, name: true, availableForAssignment: true, blocked: true },
  });

  if (!courier || courier.blocked) {
    return { ok: false, error: "حساب المندوب غير متاح." };
  }

  try {
    await prisma.courierWorkLog.create({
      data: {
        courierId,
        shiftName: status.shiftKey,
        dateKey: status.dateKey,
      },
    });
  } catch {
    await prisma.$executeRawUnsafe(
      `INSERT INTO "CourierWorkLog" ("id", "courierId", "shiftName", "dateKey", "createdAt") 
       VALUES ($1, $2, $3, $4, NOW())`,
      `cw_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      courierId,
      status.shiftKey,
      status.dateKey
    );
  }

  // تفعيل توفر المندوب للإسناد إذا لم يكن مفعلاً
  if (!courier.availableForAssignment) {
    await prisma.courier.update({
      where: { id: courierId },
      data: { availableForAssignment: true },
    });
  }

  // إشعار تليجرام وبوش للمسؤولين
  void notifyTelegramPresenceChange({
    kind: "courier",
    name: `${courier.name} (حضور الشفت ${status.shiftLabel})`,
    available: true,
  });

  void pushNotifyAdminsPresenceChange({
    kind: "courier",
    name: `${courier.name} (حضور الشفت ${status.shiftLabel})`,
    available: true,
  });

  return { ok: true };
}
