import { NextResponse } from "next/server";
import { verifyAdminToken } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendOneSignalNotification, cancelOneSignalNotification } from "@/lib/onesignal-server";

// التحقق من صلاحيات الأدمن
async function checkAuth(request: Request): Promise<boolean> {
  const authHeader = request.headers.get("Authorization");
  const token = authHeader?.split(" ")[1];
  if (!token) return false;
  return await verifyAdminToken(token);
}

// دالة مساعدة لحساب الوقت القادم للتنبيه المجدول بتوقيت العراق
function calculateNextScheduledDate(alertType: string, scheduledTime: string, scheduledDate?: string | null, daysOfWeek?: string | null): string {
  const [schedHStr, schedMStr] = scheduledTime.split(":");
  const schedH = parseInt(schedHStr, 10);
  const schedM = parseInt(schedMStr, 10);

  // الحصول على الوقت الحالي لجمهورية العراق (GMT+3)
  const nowIraq = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Baghdad" }));
  
  if (alertType === "once" && scheduledDate) {
    // لمرة واحدة: نستخدم التاريخ والوقت المحددين
    const [year, month, day] = scheduledDate.split("-").map(Number);
    const targetDate = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Baghdad" }));
    targetDate.setFullYear(year);
    targetDate.setMonth(month - 1);
    targetDate.setDate(day);
    targetDate.setHours(schedH);
    targetDate.setMinutes(schedM);
    targetDate.setSeconds(0);
    targetDate.setMilliseconds(0);

    const pad = (n: number) => String(n).padStart(2, '0');
    return `${targetDate.getFullYear()}-${pad(targetDate.getMonth() + 1)}-${pad(targetDate.getDate())} ${pad(targetDate.getHours())}:${pad(targetDate.getMinutes())}:00 GMT+0300`;
  } else {
    // متكرر: نحسب أقرب يوم متطابق من الأيام المحددة
    const days = daysOfWeek ? daysOfWeek.split(",").map(Number) : [0, 1, 2, 3, 4, 5, 6];
    let closestDate: Date | null = null;
    
    for (let i = 0; i < 8; i++) {
      const checkDate = new Date(nowIraq.getTime() + i * 24 * 60 * 60 * 1000);
      const dayOfWeek = checkDate.getDay();
      
      if (days.includes(dayOfWeek)) {
        const candidateDate = new Date(checkDate);
        candidateDate.setHours(schedH);
        candidateDate.setMinutes(schedM);
        candidateDate.setSeconds(0);
        candidateDate.setMilliseconds(0);
        
        if (i === 0 && candidateDate.getTime() <= nowIraq.getTime()) {
          continue; // الوقت مضى لليوم الحالي، ننتقل للأيام القادمة
        }
        
        closestDate = candidateDate;
        break;
      }
    }
    
    if (!closestDate) {
      closestDate = new Date(nowIraq.getTime() + 24 * 60 * 60 * 1000);
      closestDate.setHours(schedH);
      closestDate.setMinutes(schedM);
      closestDate.setSeconds(0);
      closestDate.setMilliseconds(0);
    }

    const pad = (n: number) => String(n).padStart(2, '0');
    return `${closestDate.getFullYear()}-${pad(closestDate.getMonth() + 1)}-${pad(closestDate.getDate())} ${pad(closestDate.getHours())}:${pad(closestDate.getMinutes())}:00 GMT+0300`;
  }
}

// دالة مساعدة لجدولة التنبيهات في ون سجنل (جدولة 4 مناسبات قادمة للمتكرر لضمان استمراره)
async function scheduleOneSignalAlert(data: any, userIds: string[]): Promise<string[]> {
  const notificationIds: string[] = [];

  const [schedHStr, schedMStr] = data.scheduledTime.split(":");
  const schedH = parseInt(schedHStr, 10);
  const schedM = parseInt(schedMStr, 10);

  const nowIraq = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Baghdad" }));

  if (data.alertType === "once") {
    const sendAfterStr = calculateNextScheduledDate("once", data.scheduledTime, data.scheduledDate);
    console.log(`[Scheduled Alert] Scheduling ONCE for date: ${sendAfterStr}`);

    const result = await sendOneSignalNotification({
      title: data.customTitle || "🚨 استدعاء عاجل من الإدارة! 🚨",
      body: data.customBody || "يرجى فتح التطبيق فوراً، هناك أمر طارئ!",
      url: "",
      externalIds: userIds,
      targetApp: data.targetRole,
      isSilent: true,
      sendAfter: sendAfterStr,
      data: {
        type: "strong_alert",
        action: "start",
        alertId: "sched_alert_" + Date.now(),
        customTitle: data.customTitle,
        customBody: data.customBody,
        showWhatsapp: data.showWhatsapp === true ? "true" : "false",
        showOpenApp: data.showOpenApp === true ? "true" : "false",
        showDismiss: data.showDismiss === false ? "false" : "true",
        theme: data.theme || "red"
      }
    });

    if (result.success && result.id) {
      notificationIds.push(result.id);
    }
  } else {
    // متكرر: نجدول أقرب 4 مناسبات في ون سجنل مباشرة
    const days = data.daysOfWeek ? data.daysOfWeek.split(",").map(Number) : [0, 1, 2, 3, 4, 5, 6];
    let foundCount = 0;
    
    for (let dayOffset = 0; dayOffset < 30 && foundCount < 4; dayOffset++) {
      const checkDate = new Date(nowIraq.getTime() + dayOffset * 24 * 60 * 60 * 1000);
      const dayOfWeek = checkDate.getDay();
      
      if (days.includes(dayOfWeek)) {
        const candidateDate = new Date(checkDate);
        candidateDate.setHours(schedH);
        candidateDate.setMinutes(schedM);
        candidateDate.setSeconds(0);
        candidateDate.setMilliseconds(0);
        
        if (dayOffset === 0 && candidateDate.getTime() <= nowIraq.getTime()) {
          continue; // وقت مضى لليوم الحالي
        }

        const pad = (n: number) => String(n).padStart(2, '0');
        const sendAfterStr = `${candidateDate.getFullYear()}-${pad(candidateDate.getMonth() + 1)}-${pad(candidateDate.getDate())} ${pad(candidateDate.getHours())}:${pad(candidateDate.getMinutes())}:00 GMT+0300`;
        
        console.log(`[Scheduled Alert] Scheduling RECURRING [${foundCount}] for date: ${sendAfterStr}`);

        const result = await sendOneSignalNotification({
          title: data.customTitle || "🚨 استدعاء عاجل من الإدارة! 🚨",
          body: data.customBody || "يرجى فتح التطبيق فوراً، هناك أمر طارئ!",
          url: "",
          externalIds: userIds,
          targetApp: data.targetRole,
          isSilent: true,
          sendAfter: sendAfterStr,
          data: {
            type: "strong_alert",
            action: "start",
            alertId: "sched_alert_" + Date.now() + "_" + foundCount,
            customTitle: data.customTitle,
            customBody: data.customBody,
            showWhatsapp: data.showWhatsapp === true ? "true" : "false",
            showOpenApp: data.showOpenApp === true ? "true" : "false",
            showDismiss: data.showDismiss === false ? "false" : "true",
            theme: data.theme || "red"
          }
        });

        if (result.success && result.id) {
          notificationIds.push(result.id);
        }
        foundCount++;
      }
    }
  }

  return notificationIds;
}

// دالة مساعدة لإلغاء جميع التنبيهات المجدولة السابقة في ون سجنل
async function cancelScheduledOneSignalAlerts(oneSignalIdsStr: string | null | undefined, targetApp: "admin" | "mandob" | "preparer" | "employee") {
  if (!oneSignalIdsStr) return;
  const ids = oneSignalIdsStr.split(",").map(s => s.trim()).filter(Boolean);
  for (const id of ids) {
    try {
      await cancelOneSignalNotification({
        notificationId: id,
        targetApp
      });
    } catch (e) {
      console.error(`[Scheduled Alert] Failed to cancel OneSignal notification ${id}:`, e);
    }
  }
}

// GET: جلب كافة التنبيهات المجدولة
export async function GET(request: Request) {
  try {
    if (!(await checkAuth(request))) {
      return NextResponse.json({ error: "غير مصرح لك" }, { status: 401 });
    }

    const records = await prisma.schemaPlaceholder.findMany({
      where: {
        note: {
          startsWith: "scheduled_alert:",
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    const scheduledAlerts = records.map((rec) => {
      try {
        const jsonStr = rec.note.substring("scheduled_alert:".length);
        const data = JSON.parse(jsonStr);
        return {
          recordId: rec.id, 
          createdAt: rec.createdAt,
          ...data,
        };
      } catch (e) {
        return null;
      }
    }).filter(Boolean);

    return NextResponse.json({ success: true, alerts: scheduledAlerts });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST: إضافة تنبيه مجدول جديد
export async function POST(request: Request) {
  try {
    if (!(await checkAuth(request))) {
      return NextResponse.json({ error: "غير مصرح لك" }, { status: 401 });
    }

    const body = await request.json();
    const {
      id,
      targetRole,
      targetIds,
      customTitle,
      customBody,
      showWhatsapp,
      showOpenApp,
      showDismiss,
      theme,
      alertType,
      scheduledTime,
      scheduledDate,
      daysOfWeek,
    } = body;

    if (!targetRole || !targetIds || !alertType || !scheduledTime) {
      return NextResponse.json({ error: "المعطيات الأساسية غير مكتملة" }, { status: 400 });
    }

    const alertId = id || "sched_" + Date.now().toString() + "_" + Math.random().toString(36).substring(7);

    // 1. الحصول على معرفات المستخدمين في ون سجنل
    let userIds: string[] = [];
    if (targetIds === "all") {
      if (targetRole === "mandob") {
        const list = await prisma.courier.findMany({ where: { hiddenFromReports: false }, select: { id: true } });
        userIds = list.map(u => u.id);
      } else if (targetRole === "preparer") {
        const list = await prisma.companyPreparer.findMany({ where: { active: true }, select: { id: true } });
        userIds = list.map(u => u.id);
      } else if (targetRole === "employee") {
        const list = await prisma.staffEmployee.findMany({ where: { active: true }, select: { id: true } });
        userIds = list.map(u => u.id);
      }
    } else {
      userIds = targetIds.split(",").map((s: string) => s.trim()).filter(Boolean);
    }

    // 2. جدولة الإرسال مباشرة في ون سجنل
    const alertData = {
      targetRole,
      targetIds,
      customTitle: customTitle || "",
      customBody: customBody || "",
      showWhatsapp: !!showWhatsapp,
      showOpenApp: !!showOpenApp,
      showDismiss: showDismiss !== false,
      theme: theme || "red",
      alertType,
      scheduledTime,
      scheduledDate: scheduledDate || null,
      daysOfWeek: daysOfWeek || "",
    };

    const oneSignalIds = await scheduleOneSignalAlert(alertData, userIds);

    // 3. حفظ السجل مع معرفات ون سجنل المجدولة
    const alertPayload = {
      id: alertId,
      ...alertData,
      isActive: true,
      oneSignalIds: oneSignalIds.join(","),
      lastSentAt: null,
    };

    const noteContent = "scheduled_alert:" + JSON.stringify(alertPayload);

    const newRecord = await prisma.schemaPlaceholder.create({
      data: {
        note: noteContent,
      },
    });

    return NextResponse.json({
      success: true,
      alert: {
        recordId: newRecord.id,
        createdAt: newRecord.createdAt,
        ...alertPayload,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PUT: تعديل التنبيه المجدول (تحديث البيانات بالكامل أو تغيير الحالة)
export async function PUT(request: Request) {
  try {
    if (!(await checkAuth(request))) {
      return NextResponse.json({ error: "غير مصرح لك" }, { status: 401 });
    }

    const body = await request.json();
    const { 
      recordId, 
      isActive, 
      targetRole,
      targetIds,
      customTitle,
      customBody,
      showWhatsapp,
      showOpenApp,
      showDismiss,
      theme,
      alertType,
      scheduledTime,
      scheduledDate,
      daysOfWeek
    } = body;

    if (!recordId) {
      return NextResponse.json({ error: "معرف السجل مفقود" }, { status: 400 });
    }

    const record = await prisma.schemaPlaceholder.findUnique({
      where: { id: recordId },
    });

    if (!record || !record.note.startsWith("scheduled_alert:")) {
      return NextResponse.json({ error: "التنبيه المجدول غير موجود" }, { status: 404 });
    }

    const jsonStr = record.note.substring("scheduled_alert:".length);
    const data = JSON.parse(jsonStr);

    // 1. إلغاء التنبيهات المجدولة القديمة في ون سجنل أولاً
    if (data.oneSignalIds) {
      await cancelScheduledOneSignalAlerts(data.oneSignalIds, data.targetRole);
    }

    // 2. تحديث الحقول في كائن البيانات المحلي
    if (isActive !== undefined) data.isActive = !!isActive;
    if (targetRole !== undefined) data.targetRole = targetRole;
    if (targetIds !== undefined) data.targetIds = targetIds;
    if (customTitle !== undefined) data.customTitle = customTitle;
    if (customBody !== undefined) data.customBody = customBody;
    if (showWhatsapp !== undefined) data.showWhatsapp = !!showWhatsapp;
    if (showOpenApp !== undefined) data.showOpenApp = !!showOpenApp;
    if (showDismiss !== undefined) data.showDismiss = showDismiss !== false;
    if (theme !== undefined) data.theme = theme;
    if (alertType !== undefined) data.alertType = alertType;
    if (scheduledTime !== undefined) data.scheduledTime = scheduledTime;
    if (scheduledDate !== undefined) data.scheduledDate = scheduledDate;
    if (daysOfWeek !== undefined) data.daysOfWeek = daysOfWeek;

    // تصفير معرفات ون سجنل مؤقتاً
    data.oneSignalIds = "";

    // 3. إذا كان التنبيه نشطاً بعد التحديث، نجدوله مجدداً في ون سجنل
    if (data.isActive) {
      let userIds: string[] = [];
      if (data.targetIds === "all") {
        if (data.targetRole === "mandob") {
          const list = await prisma.courier.findMany({ where: { hiddenFromReports: false }, select: { id: true } });
          userIds = list.map(u => u.id);
        } else if (data.targetRole === "preparer") {
          const list = await prisma.companyPreparer.findMany({ where: { active: true }, select: { id: true } });
          userIds = list.map(u => u.id);
        } else if (data.targetRole === "employee") {
          const list = await prisma.staffEmployee.findMany({ where: { active: true }, select: { id: true } });
          userIds = list.map(u => u.id);
        }
      } else {
        userIds = data.targetIds.split(",").map((s: string) => s.trim()).filter(Boolean);
      }

      const oneSignalIds = await scheduleOneSignalAlert(data, userIds);
      data.oneSignalIds = oneSignalIds.join(",");
    }

    // 4. حفظ التحديث النهائي في قاعدة البيانات
    const updatedRecord = await prisma.schemaPlaceholder.update({
      where: { id: recordId },
      data: {
        note: "scheduled_alert:" + JSON.stringify(data),
      },
    });

    return NextResponse.json({
      success: true,
      alert: {
        recordId: updatedRecord.id,
        createdAt: updatedRecord.createdAt,
        ...data,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE: حذف التنبيه المجدول
export async function DELETE(request: Request) {
  try {
    if (!(await checkAuth(request))) {
      return NextResponse.json({ error: "غير مصرح لك" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const recordId = searchParams.get("recordId");

    if (!recordId) {
      return NextResponse.json({ error: "معرف السجل مفقود" }, { status: 400 });
    }

    const record = await prisma.schemaPlaceholder.findUnique({
      where: { id: recordId },
    });

    if (!record || !record.note.startsWith("scheduled_alert:")) {
      return NextResponse.json({ error: "التنبيه المجدول غير موجود" }, { status: 404 });
    }

    const jsonStr = record.note.substring("scheduled_alert:".length);
    const data = JSON.parse(jsonStr);

    // 1. إلغاء التنبيهات المجدولة في ون سجنل
    if (data.oneSignalIds) {
      await cancelScheduledOneSignalAlerts(data.oneSignalIds, data.targetRole);
    }

    // 2. حذف السجل من قاعدة البيانات
    await prisma.schemaPlaceholder.delete({
      where: { id: recordId },
    });

    return NextResponse.json({ success: true, message: "تم حذف التنبيه المجدول بنجاح" });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
