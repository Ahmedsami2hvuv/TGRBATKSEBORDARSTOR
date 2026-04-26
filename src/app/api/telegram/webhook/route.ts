import { NextResponse } from "next/server";
import { answerCallbackQuery, verifyTelegramWebhookSecret } from "@/lib/telegram";
import {
  handleTelegramWebhook,
} from "@/lib/telegram-webhook-handler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!verifyTelegramWebhookSecret(request.headers)) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  try {
    await handleTelegramWebhook(body);
  } catch (e) {
    console.error("[telegram webhook] handler error:", e);
    if (body.callback_query?.id) {
      await answerCallbackQuery(body.callback_query.id, "خطأ في الخادم — راجع السجلات.", true).catch(
        () => {},
      );
    }
  }
  return NextResponse.json({ ok: true });
}
