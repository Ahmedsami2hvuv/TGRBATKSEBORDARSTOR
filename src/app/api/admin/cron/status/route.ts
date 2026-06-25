import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const key = searchParams.get("key");
    const cronSecret = process.env.CRON_SECRET || "AboAkbarCronSecret2026";

    if (key !== cronSecret) {
      return NextResponse.json({ error: "غير مصرح بالدخول" }, { status: 401 });
    }

    const records = await prisma.schemaPlaceholder.findMany({
      where: {
        note: {
          startsWith: "scheduled_alert:",
        },
      },
    });

    const alerts = records.map((rec) => {
      try {
        const jsonStr = rec.note.substring("scheduled_alert:".length);
        return {
          recordId: rec.id,
          createdAt: rec.createdAt,
          ...JSON.parse(jsonStr)
        };
      } catch (e) {
        return { recordId: rec.id, error: "corrupted data" };
      }
    });

    // الحصول على الوقت الحالي في العراق لمقارنته
    const nowIraq = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Baghdad" }));
    const currentDateStr = `${nowIraq.getFullYear()}-${String(nowIraq.getMonth() + 1).padStart(2, '0')}-${String(nowIraq.getDate()).padStart(2, '0')}`;
    const currentTimeStr = `${String(nowIraq.getHours()).padStart(2, '0')}:${String(nowIraq.getMinutes()).padStart(2, '0')}`;

    return NextResponse.json({
      success: true,
      currentIraqTime: currentTimeStr,
      currentIraqDate: currentDateStr,
      dayOfWeek: nowIraq.getDay(),
      alerts
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
