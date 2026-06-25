import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendOneSignalNotification } from "@/lib/onesignal-server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const logs: string[] = [];
  try {
    const { searchParams } = new URL(request.url);
    const runForce = searchParams.get("run") === "true";

    logs.push(`Starting manual scheduled alerts test... Force Run: ${runForce}`);

    // 1. الحصول على الوقت الحالي لجمهورية العراق (GMT+3)
    const nowIraq = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Baghdad" }));
    const currentHour = nowIraq.getHours();
    const currentMinute = nowIraq.getMinutes();
    const currentDayOfWeek = nowIraq.getDay();
    
    const currentDateStr = `${nowIraq.getFullYear()}-${String(nowIraq.getMonth() + 1).padStart(2, '0')}-${String(nowIraq.getDate()).padStart(2, '0')}`;
    const currentTimeStr = `${String(currentHour).padStart(2, '0')}:${String(currentMinute).padStart(2, '0')}`;

    logs.push(`Current Iraq Time: ${currentTimeStr}, Date: ${currentDateStr}, DayOfWeek: ${currentDayOfWeek}`);

    // 2. جلب كافة التنبيهات المجدولة
    const records = await prisma.schemaPlaceholder.findMany({
      where: {
        note: {
          startsWith: "scheduled_alert:",
        },
      },
    });

    logs.push(`Found ${records.length} scheduled alert records in database.`);

    const processedAlerts: any[] = [];

    for (const rec of records) {
      let data: any;
      try {
        const jsonStr = rec.note.substring("scheduled_alert:".length);
        data = JSON.parse(jsonStr);
      } catch (e) {
        logs.push(`Record ${rec.id} is corrupted.`);
        continue;
      }

      const alertLog: string[] = [];
      alertLog.push(`Checking alert ID: ${data.id}, TargetRole: ${data.targetRole}, TargetIds: ${data.targetIds}`);
      alertLog.push(`Scheduled Time: ${data.scheduledTime}, AlertType: ${data.alertType}, IsActive: ${data.isActive}`);

      // التحقق من الجدولة الزمنية
      const [schedHStr, schedMStr] = data.scheduledTime.split(":");
      const schedH = parseInt(schedHStr, 10);
      const schedM = parseInt(schedMStr, 10);
      
      const currentTotalMinutes = currentHour * 60 + currentMinute;
      const schedTotalMinutes = schedH * 60 + schedM;
      const diffMinutes = currentTotalMinutes - schedTotalMinutes;
      
      alertLog.push(`Time difference: ${diffMinutes} minutes`);

      // التحقق من النافذة الزمنية
      const isWithinTimeWindow = diffMinutes >= 0 && diffMinutes <= 9;
      
      let shouldTrigger = false;
      if (data.isActive) {
        if (runForce) {
          // في التشغيل القسري، نتجاوز شرط الوقت والتاريخ تماماً
          shouldTrigger = true;
          alertLog.push("Force triggering enabled (bypassing time/date checks).");
        } else {
          if (isWithinTimeWindow) {
            if (data.alertType === "once") {
              if (data.scheduledDate === currentDateStr && !data.lastSentAt) {
                shouldTrigger = true;
              }
            } else if (data.alertType === "recurring") {
              const days = data.daysOfWeek ? data.daysOfWeek.split(",") : [];
              if (days.includes(String(currentDayOfWeek))) {
                if (!data.lastSentAt) {
                  shouldTrigger = true;
                } else {
                  const lastSentDate = new Date(data.lastSentAt);
                  const lastSentIraq = new Date(lastSentDate.toLocaleString("en-US", { timeZone: "Asia/Baghdad" }));
                  const lastSentDateStr = `${lastSentIraq.getFullYear()}-${String(lastSentIraq.getMonth() + 1).padStart(2, '0')}-${String(lastSentIraq.getDate()).padStart(2, '0')}`;
                  if (lastSentDateStr !== currentDateStr) {
                    shouldTrigger = true;
                  } else {
                    alertLog.push("Skipped because already sent today.");
                  }
                }
              }
            }
          }
        }
      }

      alertLog.push(`Should trigger: ${shouldTrigger}`);

      let sendResult: any = null;
      let userIds: string[] = [];

      if (shouldTrigger) {
        // الحصول على معرفات المستخدمين
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

        alertLog.push(`Target users count: ${userIds.length} (${userIds.join(", ")})`);

        if (userIds.length > 0 && runForce) {
          // إجراء إرسال فعلي وتخزين الاستجابة
          const title = data.customTitle || "🚨 استدعاء تجريبي قسري! 🚨";
          const bodyMessage = data.customBody || "هذا إشعار فحص مجدول قسري.";
          const alertInstanceId = "test_sched_" + Date.now();

          sendResult = await sendOneSignalNotification({
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
          alertLog.push(`OneSignal response success: ${sendResult.success}`);
          if (sendResult.error) {
            alertLog.push(`OneSignal error: ${sendResult.error}`);
          }
        }
      }

      processedAlerts.push({
        id: data.id,
        recordId: rec.id,
        targetRole: data.targetRole,
        targetIds: data.targetIds,
        shouldTrigger,
        userIds,
        sendResult,
        logs: alertLog
      });
    }

    return NextResponse.json({
      success: true,
      logs,
      processedAlerts
    });

  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message,
      logs
    });
  }
}

