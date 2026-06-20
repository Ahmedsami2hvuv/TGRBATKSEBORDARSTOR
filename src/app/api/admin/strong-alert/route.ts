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
    const { action, targetRole, userIds } = body;

    if (!action || !targetRole || !userIds || !Array.isArray(userIds) || userIds.length === 0) {
      return NextResponse.json({ error: "المعطيات غير مكتملة" }, { status: 400 });
    }

    if (action !== "start" && action !== "stop") {
      return NextResponse.json({ error: "الإجراء غير صالح" }, { status: 400 });
    }

    if (targetRole !== "mandob" && targetRole !== "preparer" && targetRole !== "employee") {
      return NextResponse.json({ error: "الدور غير صالح" }, { status: 400 });
    }

    // إرسال الإشعار عبر ون سجنل
    const title = action === "start" ? "🚨 استدعاء عاجل من الإدارة! 🚨" : "⏹️ إلغاء الاستدعاء القوي";
    const message = action === "start" ? "يرجى فتح التطبيق فوراً، هناك أمر طارئ!" : "تم إلغاء التنبيه من قبل الإدارة.";

    const success = await sendOneSignalNotification({
      title,
      body: message,
      url: "",
      externalIds: userIds,
      targetApp: targetRole,
      isSilent: true,
      data: {
        type: "strong_alert",
        action: action
      }
    });

    if (success) {
      return NextResponse.json({ success: true });
    } else {
      return NextResponse.json({ error: "فشل إرسال الإشعار عبر ون سجنل" }, { status: 500 });
    }
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
