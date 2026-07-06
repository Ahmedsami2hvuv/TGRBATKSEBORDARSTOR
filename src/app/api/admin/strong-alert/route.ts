import { NextResponse } from "next/server";
import { verifyAdminToken } from "@/lib/auth";
import { sendOneSignalNotification } from "@/lib/onesignal-server";

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get("Authorization");
    const token = authHeader?.split(" ")[1];
    
    if (!token || !(await verifyAdminToken(token))) {
      return NextResponse.json({ error: "غير مصرح لك" }, { status: 401 });
    }

    const body = await request.json();
    const { action, targetRole, userIds, alertId, customTitle, customBody, showWhatsapp, showOpenApp, showDismiss, theme } = body;

    if (!action || !targetRole || !userIds || !Array.isArray(userIds) || userIds.length === 0 || !alertId) {
      return NextResponse.json({ error: "المعطيات غير مكتملة" }, { status: 400 });
    }

    if (action !== "start" && action !== "stop") {
      return NextResponse.json({ error: "الإجراء غير صالح" }, { status: 400 });
    }

    if (targetRole !== "mandob" && targetRole !== "preparer" && targetRole !== "employee") {
      return NextResponse.json({ error: "الدور غير صالح" }, { status: 400 });
    }

    // إرسال الإشعار عبر ون سجنل
    const title = action === "start"
      ? (typeof customTitle === "string" ? customTitle : "🚨 استدعاء عاجل من الإدارة! 🚨")
      : "⏹️ إلغاء الاستدعاء القوي";

    const message = action === "start"
      ? (typeof customBody === "string" ? customBody : "يرجى فتح التطبيق فوراً، هناك أمر طارئ!")
      : "تم إلغاء التنبيه من قبل الإدارة.";

    const result = await sendOneSignalNotification({
      title: title || " ", // نضع مسافة فارغة إذا كان فارغاً لكي لا يظهر نص
      body: message || " ", // نضع مسافة فارغة إذا كان فارغاً
      url: "",
      externalIds: userIds,
      targetApp: targetRole,
      isSilent: true,
      data: {
        type: "strong_alert",
        action: action,
        alertId: alertId,
        customTitle: typeof customTitle === "string" ? customTitle : "",
        customBody: typeof customBody === "string" ? customBody : "",
        showWhatsapp: showWhatsapp === true ? "true" : "false",
        showOpenApp: showOpenApp === true ? "true" : "false",
        showDismiss: showDismiss === false ? "false" : "true",
        theme: typeof theme === "string" ? theme : "red"
      }
    });

    if (result.success) {
      // حفظ التنبيه الفوري في السجل عند البدء بنجاح
      if (action === "start") {
        try {
          const { prisma } = await import('@/lib/prisma');
          const historyPayload = {
            alertId,
            targetRole,
            targetIds: userIds.join(","),
            customTitle: customTitle || "",
            customBody: customBody || "",
            showWhatsapp: showWhatsapp === true,
            showOpenApp: showOpenApp === true,
            showDismiss: showDismiss !== false,
            theme: theme || "red",
            sentAt: new Date().toISOString()
          };

          await prisma.schemaPlaceholder.create({
            data: {
              note: `instant_alert_history:${JSON.stringify(historyPayload)}`
            }
          });
        } catch (dbErr) {
          console.error("Error saving alert history to database:", dbErr);
        }
      }

      return NextResponse.json({ success: true });
    } else {
      return NextResponse.json({ error: result.error || "فشل إرسال الإشعار عبر ون سجنل" }, { status: 500 });
    }
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const alertId = searchParams.get("alertId");
    const history = searchParams.get("history");

    // جلب سجل التنبيهات الفورية
    if (history === "true") {
      const authHeader = request.headers.get("Authorization");
      const token = authHeader?.split(" ")[1];
      
      if (!token || !(await verifyAdminToken(token))) {
        return NextResponse.json({ error: "غير مصرح لك" }, { status: 401 });
      }

      const { prisma } = await import('@/lib/prisma');
      const records = await prisma.schemaPlaceholder.findMany({
        where: {
          note: {
            startsWith: "instant_alert_history:"
          }
        },
        orderBy: {
          createdAt: "desc"
        },
        take: 50
      });

      const list = records.map((rec) => {
        try {
          const jsonStr = rec.note.substring("instant_alert_history:".length);
          const data = JSON.parse(jsonStr);
          return {
            recordId: rec.id,
            createdAt: rec.createdAt,
            ...data
          };
        } catch (e) {
          return null;
        }
      }).filter(Boolean);

      return NextResponse.json({ success: true, history: list });
    }

    if (!alertId) {
      return NextResponse.json({ error: "معرف التنبيه مفقود" }, { status: 400 });
    }

    const { prisma } = await import('@/lib/prisma');
    
    // البحث عن ملاحظة الاستلام في قاعدة البيانات
    const ackRecord = await prisma.schemaPlaceholder.findFirst({
      where: {
        note: {
          startsWith: `strong_alert_ack:${alertId}:`
        }
      }
    });

    if (ackRecord) {
      // note format: strong_alert_ack:alertId:role:userId:timestamp
      const parts = ackRecord.note.split(":");
      const role = parts[2] || "preparer";
      const userId = parts[3] || "";
      
      return NextResponse.json({ responded: true, role, userId });
    }

    return NextResponse.json({ responded: false });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const authHeader = request.headers.get("Authorization");
    const token = authHeader?.split(" ")[1];
    
    if (!token || !(await verifyAdminToken(token))) {
      return NextResponse.json({ error: "غير مصرح لك" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const recordId = searchParams.get("recordId");

    if (!recordId) {
      return NextResponse.json({ error: "معرف السجل مفقود" }, { status: 400 });
    }

    const { prisma } = await import('@/lib/prisma');
    
    const record = await prisma.schemaPlaceholder.findUnique({
      where: { id: recordId }
    });

    if (!record || !record.note.startsWith("instant_alert_history:")) {
      return NextResponse.json({ error: "التنبيه في السجل غير موجود" }, { status: 404 });
    }

    await prisma.schemaPlaceholder.delete({
      where: { id: recordId }
    });

    return NextResponse.json({ success: true, message: "تم حذف التنبيه من السجل بنجاح" });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
