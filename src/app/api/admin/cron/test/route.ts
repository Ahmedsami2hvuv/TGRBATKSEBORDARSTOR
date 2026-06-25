import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendOneSignalNotification } from "@/lib/onesignal-server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const logs: string[] = [];
  try {
    logs.push("Starting manual scheduled alerts test...");

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

      // التحقق من الجدولة
      const [schedHStr, schedMStr] = data.scheduledTime.split(":");
      const schedH = parseInt(schedHStr, 10);
      const schedM = parseInt(schedMStr, 10);
      
      const currentTotalMinutes = currentHour * 60 + currentMinute;
      const schedTotalMinutes = schedH * 60 + schedM;
      const diffMinutes = currentTotalMinutes - schedTotalMinutes;
      
      alertLog.push(`Time difference: ${diffMinutes} minutes (CurrentTotal: ${currentTotalMinutes}, SchedTotal: ${schedTotalMinutes})`);

      // التحقق من النافذة الزمنية
      const isWithinTimeWindow = diffMinutes >= 0 && diffMinutes <= 9;
      alertLog.push(`Is within 9-min window: ${isWithinTimeWindow}`);

      let shouldTrigger = false;
      if (data.isActive && isWithinTimeWindow) {
        if (data.alertType === "once") {
          alertLog.push(`Once alert date matching: Sched: ${data.scheduledDate}, Current: ${currentDateStr}`);
          if (data.scheduledDate === currentDateStr && !data.lastSentAt) {
            shouldTrigger = true;
          }
        } else if (data.alertType === "recurring") {
          const days = data.daysOfWeek ? data.daysOfWeek.split(",") : [];
          alertLog.push(`Recurring alert days: ${days.join(",")}, Current DayOfWeek: ${currentDayOfWeek}`);
          if (days.includes(String(currentDayOfWeek))) {
            if (!data.lastSentAt) {
              shouldTrigger = true;
            } else {
              const lastSentDate = new Date(data.lastSentAt);
              const lastSentIraq = new Date(lastSentDate.toLocaleString("en-US", { timeZone: "Asia/Baghdad" }));
              const lastSentDateStr = `${lastSentIraq.getFullYear()}-${String(lastSentIraq.getMonth() + 1).padStart(2, '0')}-${String(lastSentIraq.getDate()).padStart(2, '0')}`;
              alertLog.push(`LastSentDate: ${lastSentDateStr}, CurrentDate: ${currentDateStr}`);
              if (lastSentDateStr !== currentDateStr) {
                shouldTrigger = true;
              } else {
                alertLog.push("Skipped because already sent today.");
              }
            }
          } else {
            alertLog.push("Skipped because current day is not selected.");
          }
        }
      } else {
        alertLog.push("Skipped because alert is inactive or not in time window.");
      }

      alertLog.push(`Should trigger: ${shouldTrigger}`);

      processedAlerts.push({
        id: data.id,
        recordId: rec.id,
        targetRole: data.targetRole,
        targetIds: data.targetIds,
        shouldTrigger,
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
