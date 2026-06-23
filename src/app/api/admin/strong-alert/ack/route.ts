import { NextResponse } from "next/server";
import { supabaseClient } from "@/lib/supabase-client";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { alertId, role, userId } = body;

    if (!alertId) {
      return NextResponse.json({ error: "معرف التنبيه مفقود" }, { status: 400 });
    }

    // الاعتماد على قاعدة البيانات بدلاً من البث المباشر (Broadcast) لضمان الوصول 100%
    const { prisma } = await import('@/lib/prisma');
    
    await prisma.schemaPlaceholder.create({
      data: {
        note: `strong_alert_ack:${alertId}:${role}:${userId}:${new Date().getTime()}`
      }
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
