import { NextResponse } from "next/server";
import { answerCallbackQuery, verifyTelegramWebhookSecret } from "@/lib/telegram";
import { handleTelegramWebhook } from "@/lib/telegram-webhook-handler";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: { botId: string } }
) {
  if (!verifyTelegramWebhookSecret(request.headers)) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const botId = params.botId;
  const bot = await prisma.telegramBot.findUnique({
    where: { id: botId },
  });

  if (!bot || !bot.active) {
    return NextResponse.json({ ok: false, error: "Bot not found or inactive" }, { status: 404 });
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  try {
    // نمرر البوت للمعالج ليعرف أي توكن يستخدم وأي صلاحيات يطبق
    await handleTelegramWebhook(body, bot);
  } catch (e) {
    console.error(`[telegram webhook] handler error for bot ${bot.name}:`, e);
    if (body.callback_query?.id) {
      await answerCallbackQuery(body.callback_query.id, "خطأ في الخادم — راجع السجلات.", true, bot.token).catch(
        () => {},
      );
    }
  }

  return NextResponse.json({ ok: true });
}
