import { NextResponse } from "next/server";
import { verifyAdminToken } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// التحقق من صلاحيات الأدمن
async function checkAuth(request: Request): Promise<boolean> {
  const authHeader = request.headers.get("Authorization");
  const token = authHeader?.split(" ")[1];
  if (!token) return false;
  return await verifyAdminToken(token);
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

    const alertPayload = {
      id: alertId,
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
      isActive: true,
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
      lastSentAt,
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

    // تحديث الحقول المطلوبة (دعم التعديل الكامل وتحديث الحالة السريع)
    if (isActive !== undefined) data.isActive = !!isActive;
    if (lastSentAt !== undefined) data.lastSentAt = lastSentAt;
    
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

    // حفظ التحديث
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

    await prisma.schemaPlaceholder.delete({
      where: { id: recordId },
    });

    return NextResponse.json({ success: true, message: "تم حذف التنبيه المجدول بنجاح" });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
