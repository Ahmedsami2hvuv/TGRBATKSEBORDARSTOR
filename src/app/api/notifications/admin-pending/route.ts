import { NextResponse } from "next/server";
import { isAdminSession } from "@/lib/admin-session";
import { audienceSettings, getOrCreateNotificationSettings } from "@/lib/notification-settings";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET() {
  if (!(await isAdminSession())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const [pendingCount, latest, settingsRow] = await Promise.all([
    prisma.order.count({ where: { status: "pending" } }),
    prisma.order.findFirst({
      where: { status: "pending" },
      orderBy: { orderNumber: "desc" },
      select: { orderNumber: true },
    }),
    getOrCreateNotificationSettings(),
  ]);
  const settings = audienceSettings(settingsRow, "admin");

  return NextResponse.json({
    pendingCount,
    latestOrderNumber: latest?.orderNumber ?? 0,
    settings,
  });
}
