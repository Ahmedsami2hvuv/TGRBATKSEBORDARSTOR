import { NextResponse } from "next/server";
import { answerCallbackQuery, verifyTelegramWebhookSecret } from "@/lib/telegram";
import {
  handleTelegramWebhook,
} from "@/lib/telegram-webhook-handler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  return NextResponse.json({
    ok: false,
    error: "This endpoint is deprecated. Please use /api/telegram/webhook/[botId] for dynamic bot routing."
  }, { status: 410 });
}
