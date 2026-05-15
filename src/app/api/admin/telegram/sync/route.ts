import { NextResponse } from "next/server";
import { ensureAllBotsWebhooksConfigured } from "@/lib/telegram-bots";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await ensureAllBotsWebhooksConfigured();
    return NextResponse.json({ ok: true, message: "All webhooks configured successfully." });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}
