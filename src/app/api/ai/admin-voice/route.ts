import { NextResponse } from "next/server";
import { processAdminAiMessage } from "@/lib/ai-admin-agent";

/**
 * نقطة الاتصال البرمجية لاستقبال الأوامر الصوتية والنصية المباشرة (سواء GET أو POST)
 */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const text = (searchParams.get("text") || searchParams.get("prompt") || searchParams.get("message") || "").trim();

    if (!text) {
      return NextResponse.json({
        ok: true,
        message: "أهلاً بك! نقطة الاتصال الذكية تعمل بنجاح. يمكنك إرسال الأوامر عبر طلب POST أو إضافة ?text= للأمر في الرابط."
      });
    }

    const aiReply = await processAdminAiMessage(text, "voice_admin_get");

    return NextResponse.json({
      ok: true,
      prompt: text,
      reply: aiReply
    });
  } catch (error: any) {
    console.error("[admin-voice-api GET] Error:", error);
    return NextResponse.json({ ok: false, error: error.message || "حدث خطأ أثناء معالجة الطلب" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const text = (body.text || body.prompt || body.message || "").trim();

    if (!text) {
      return NextResponse.json({ ok: false, message: "يرجى تزويد النص أو الأمر الصوتي المطلوب تنفيذه." }, { status: 400 });
    }

    const userId = body.userId || "voice_admin";
    const aiReply = await processAdminAiMessage(text, userId);

    return NextResponse.json({
      ok: true,
      prompt: text,
      reply: aiReply
    });
  } catch (error: any) {
    console.error("[admin-voice-api POST] Error:", error);
    return NextResponse.json({ ok: false, error: error.message || "حدث خطأ أثناء معالجة الطلب الصوتي" }, { status: 500 });
  }
}
