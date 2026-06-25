import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendOneSignalNotification } from "@/lib/onesignal-server";

export const dynamic = "force-dynamic";

// التحقق من الحماية للـ Cron Job
function verifyCronRequest(request: Request): boolean {
  // 1. السماح في بيئة التطوير محلياً دون قيود للتجربة
  if (process.env.NODE_ENV === "development") {
    return true;
  }

  // 2. التحقق من ترويسة Vercel Cron (مضمونة ومحمية من قبل فيرسل ولا يمكن تزييفها من الخارج)
  const vercelCronHeader = request.headers.get("x-vercel-cron");
  if (vercelCronHeader !== null && vercelCronHeader !== undefined) {
    return true;
  }

  // 3. التحقق من مفتاح الحماية في الترويسات (إذا كان مهيأً)
  const authHeader = request.headers.get("Authorization");
  const cronSecret = process.env.CRON_SECRET || "AboAkbarCronSecret2026";
  if (authHeader === `Bearer ${cronSecret}`) {
    return true;
  }

  // 4. التحقق من رمز سري في عنوان URL كخيار احتياطي ومريح
  const { searchParams } = new URL(request.url);
  const key = searchParams.get("key");
  if (key === cronSecret) {
    return true;
  }

  return false;
}

export async function GET(request: Request) {
  return handleCron(request);
}

export async function POST(request: Request) {
  return handleCron(request);
}

async function handleCron(request: Request) {
  try {
    // 1. التحقق من حماية الـ Cron
    if (!verifyCronRequest(request)) {
      return NextResponse.json({ error: "غير مصرح بالدخول" }, { status: 401 });
    }

    console.log("[Cron] Starting scheduled alerts check...");

    // 2. الحصول على الوقت الحالي لجمهورية العراق (GMT+3) بدقة
    const nowIraq = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Baghdad" }));
    const currentHour = nowIraq.getHours();
    const currentMinute = nowIraq.getMinutes();
    const currentDayOfWeek = nowIraq.getDay(); // 0 الأحد، 1 الاثنين، ... 6 السبت
    
    const currentDateStr = `${nowIraq.getFullYear()}-${String(nowIraq.getMonth() + 1).padStart(2, '0')}-${String(nowIraq.getDate()).padStart(2, '0')}`;
    const currentTimeStr = `${String(currentHour).padStart(2, '0')}:${String(currentMinute).padStart(2, '0')}`;

    console.log(`[Cron] Current Iraq Time: ${currentTimeStr}, Date: ${currentDateStr}, DayOfWeek: ${currentDayOfWeek}`);

    // 3. جلب كافة التنبيهات المجدولة المخزنة في SchemaPlaceholder
    const records = await prisma.schemaPlaceholder.findMany({
      where: {
        note: {
          startsWith: "scheduled_alert:",
        },
      },
    });

    const sentAlertsInfo: string[] = [];

    // 4. معالجة كل تنبيه
    for (const rec of records) {
      let data: any;
      try {
        const jsonStr = rec.note.substring("scheduled_alert:".length);
        data = JSON.parse(jsonStr);
      } catch (e) {
        continue; // تجاهل التنبيه التالف
      }

      // التحقق من نشاط التنبيه
      if (!data.isActive) {
        continue;
      }

      // مقارنة الوقت المجدول (صيغة HH:mm) مع الوقت الحالي بنافذة مرنة قدرها 9 دقائق
      const [schedHStr, schedMStr] = data.scheduledTime.split(":");
      const schedH = parseInt(schedHStr, 10);
      const schedM = parseInt(schedMStr, 10);
      
      const currentTotalMinutes = currentHour * 60 + currentMinute;
      const schedTotalMinutes = schedH * 60 + schedM;
      
      // حساب الفرق بالدقائق
      const diffMinutes = currentTotalMinutes - schedTotalMinutes;
      
      // إذا كان الوقت الحالي يقع في نفس دقيقة التنبيه أو بعدها بـ 9 دقائق كحد أقصى
      const isWithinTimeWindow = diffMinutes >= 0 && diffMinutes <= 9;
      
      if (!isWithinTimeWindow) {
        continue; // ليس وقت هذا التنبيه أو انتهت نافذة تشغيله
      }

      // التحقق من التكرار أو التاريخ
      let shouldTrigger = false;

      if (data.alertType === "once") {
        // تنبيه لمرة واحدة: يجب تطابق التاريخ
        if (data.scheduledDate === currentDateStr) {
          // التحقق من أنه لم يرسل مسبقاً (lastSentAt يجب أن يكون فارغاً أو في يوم مختلف)
          if (!data.lastSentAt) {
            shouldTrigger = true;
          }
        }
      } else if (data.alertType === "recurring") {
        // تنبيه متكرر: يجب أن يكون اليوم الحالي من ضمن الأيام المحددة
        const days = data.daysOfWeek ? data.daysOfWeek.split(",") : [];
        if (days.includes(String(currentDayOfWeek))) {
          // التحقق من عدم تكرار الإرسال اليوم
          if (!data.lastSentAt) {
            shouldTrigger = true;
          } else {
            // مقارنة تاريخ آخر إرسال باليوم الحالي
            const lastSentDate = new Date(data.lastSentAt);
            const lastSentIraq = new Date(lastSentDate.toLocaleString("en-US", { timeZone: "Asia/Baghdad" }));
            const lastSentDateStr = `${lastSentIraq.getFullYear()}-${String(lastSentIraq.getMonth() + 1).padStart(2, '0')}-${String(lastSentIraq.getDate()).padStart(2, '0')}`;
            
            if (lastSentDateStr !== currentDateStr) {
              shouldTrigger = true;
            }
          }
        }
      }

      if (shouldTrigger) {
        console.log(`[Cron] Triggering scheduled alert: ${data.id} - ${data.customTitle}`);

        // الحصول على معرفات المستخدمين
        let userIds: string[] = [];
        if (data.targetIds === "all") {
          // جلب كل المستخدمين النشطين بحسب الدور
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

        if (userIds.length > 0) {
          // توليد معرف تنبيه فريد جديد
          const alertInstanceId = "sched_alert_" + Date.now().toString() + "_" + Math.random().toString(36).substring(7);

          // إرسال الإشعار القوي عبر OneSignal
          const title = data.customTitle || "🚨 استدعاء عاجل من الإدارة! 🚨";
          const bodyMessage = data.customBody || "يرجى فتح التطبيق فوراً، هناك أمر طارئ!";

          const result = await sendOneSignalNotification({
            title: title || " ",
            body: bodyMessage || " ",
            url: "",
            externalIds: userIds,
            targetApp: data.targetRole,
            isSilent: true,
            data: {
              type: "strong_alert",
              action: "start",
              alertId: alertInstanceId,
              customTitle: title,
              customBody: bodyMessage,
              showWhatsapp: data.showWhatsapp === true ? "true" : "false",
              showOpenApp: data.showOpenApp === true ? "true" : "false",
              showDismiss: data.showDismiss === false ? "false" : "true",
              theme: data.theme || "red"
            }
          });

          if (result.success) {
            console.log(`[Cron] Scheduled alert ${data.id} sent successfully to ${userIds.length} users.`);
            sentAlertsInfo.push(`تم إرسال التنبيه "${title}" بنجاح لـ ${userIds.length} مستخدم.`);
            
            // تحديث تاريخ ووقت آخر إرسال فقط عند النجاح لمنع ضياع التنبيه في حال فشل OneSignal المؤقت
            data.lastSentAt = new Date().toISOString();
            
            await prisma.schemaPlaceholder.update({
              where: { id: rec.id },
              data: {
                note: "scheduled_alert:" + JSON.stringify(data),
              },
            });
          } else {
            console.error(`[Cron] Failed to send scheduled alert ${data.id}:`, result.error);
            sentAlertsInfo.push(`فشل إرسال التنبيه "${title}": ${result.error}`);
          }
        } else {
          console.warn(`[Cron] No active users found for scheduled alert ${data.id}`);
          sentAlertsInfo.push(`لم يتم العثور على مستخدمين نشطين للتنبيه "${data.customTitle}".`);
        }
      }
    }

    return NextResponse.json({
      success: true,
      processedCount: records.length,
      sentAlerts: sentAlertsInfo,
      timeChecked: currentTimeStr
    });

  } catch (error: any) {
    console.error("[Cron] Error processing scheduled alerts:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
