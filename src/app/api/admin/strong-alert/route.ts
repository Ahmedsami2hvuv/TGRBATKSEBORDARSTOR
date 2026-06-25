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
      // استخراج البيانات من الملاحظة
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
