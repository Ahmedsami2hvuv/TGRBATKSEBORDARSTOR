import { NextResponse } from "next/server";
import { executeAutonomousGeminiAgent, askGeminiFreeChat } from "@/lib/ai-autonomous-agent";
import { resetChatSessionContext } from "@/lib/ai-admin-agent";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const text = (searchParams.get("text") || searchParams.get("prompt") || searchParams.get("message") || "").trim();
    const action = searchParams.get("action");

    if (action === "reset" || action === "clear_session" || text === "reset" || text === "مسح") {
      await resetChatSessionContext(searchParams.get("userId") || undefined);
      return NextResponse.json({ ok: true, message: "تم تصفير سياق الذاكرة والبدء بدردشة جديدة ناصعة." });
    }

    if (!text) {
      return NextResponse.json({
        ok: true,
        message: "أهلاً بك يا أبو الأكبر! مساعد الذكاء الاصطناعي Gemini جاهز للعمل."
      });
    }

    const userId = searchParams.get("userId") || "admin_ai_page";

    let geminiRes = await executeAutonomousGeminiAgent(text, userId);
    if (!geminiRes || !geminiRes.reply) {
      const freeText = await askGeminiFreeChat(text);
      geminiRes = { reply: freeText || "تدلل يا أبو الأكبر، أنا أسمعك وجاهز لأي استفسار أو أمر بالخدمة دائماً 🌸" };
    }

    return NextResponse.json({
      ok: true,
      prompt: text,
      reply: geminiRes.reply,
      buttons: geminiRes.buttons || []
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
    const action = body.action;

    if (action === "reset" || action === "clear_session" || text === "reset" || text === "مسح") {
      await resetChatSessionContext(body.userId || undefined);
      return NextResponse.json({ ok: true, message: "تم تصفير سياق الذاكرة والبدء بدردشة جديدة ناصعة." });
    }

    if (!text) {
      return NextResponse.json({ ok: false, message: "يرجى تزويد النص أو الأمر المطلوب تنفيذه." }, { status: 400 });
    }

    const userId = body.userId || "admin_ai_page";

    let geminiRes = await executeAutonomousGeminiAgent(text, userId);
    if (!geminiRes || !geminiRes.reply) {
      const freeText = await askGeminiFreeChat(text);
      geminiRes = { reply: freeText || "تدلل يا أبو الأكبر، أنا وياك وبخدمتك لأي سؤال أو استشارة أو تحليل 🚀" };
    }

    return NextResponse.json({
      ok: true,
      prompt: text,
      reply: geminiRes.reply,
      buttons: geminiRes.buttons || []
    });
  } catch (error: any) {
    console.error("[admin-voice-api POST] Error:", error);
    return NextResponse.json({ ok: false, error: error.message || "حدث خطأ أثناء المعالجة" }, { status: 500 });
  }
}
