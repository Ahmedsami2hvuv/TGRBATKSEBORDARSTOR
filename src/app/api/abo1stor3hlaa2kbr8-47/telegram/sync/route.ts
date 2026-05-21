import { NextRequest, NextResponse } from "next/server";
import { ensureAllBotsWebhooksConfigured } from "@/lib/telegram-bots";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    // جلب الرابط الحالي من المتصفح تلقائياً
    const { origin } = new URL(req.url);

    await ensureAllBotsWebhooksConfigured(true, origin);

    return NextResponse.json({
      ok: true,
      message: "All webhooks re-configured forcefully.",
      configuredUrl: origin
    });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}
