import { NextResponse } from "next/server";
import { processAdminAiMessage } from "@/lib/ai-admin-agent";

/**
 * نقطة الاتصال البرمجية لاستقبال الأوامر الصوتية والنصية المباشرة من تطبيق Gemini أو اختصارات الهاتف
 */
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
    console.error("[admin-voice-api] Error:", error);
    return NextResponse.json({ ok: false, error: error.message || "حدث خطأ أثناء معالجة الطلب الصوتي" }, { status: 500 });
  }
}
