import { NextResponse } from "next/server";
import { supabaseClient } from "@/lib/supabase-client";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { alertId, role, userId } = body;

    if (!alertId) {
      return NextResponse.json({ error: "معرف التنبيه مفقود" }, { status: 400 });
    }

    // إرسال رسالة بث (Broadcast) إلى لوحة التحكم
    const channel = supabaseClient.channel('strong-alert-events');
    await channel.send({
      type: 'broadcast',
      event: 'strong-alert-ack',
      payload: {
        alertId,
        role,
        userId,
        timestamp: new Date().toISOString()
      }
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
