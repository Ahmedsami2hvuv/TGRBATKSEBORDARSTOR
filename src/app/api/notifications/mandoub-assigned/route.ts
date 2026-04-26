import { NextResponse } from "next/server";
import { verifyDelegatePortalQuery } from "@/lib/delegate-link";
import { audienceSettings, getOrCreateNotificationSettings } from "@/lib/notification-settings";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const c = searchParams.get("c") ?? "";
  const exp = searchParams.get("exp") ?? undefined;
  const s = searchParams.get("s") ?? "";
  const v = verifyDelegatePortalQuery(c, exp, s);
  if (!v.ok) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const whereActive = {
    assignedCourierId: v.courierId,
    status: { in: ["assigned", "delivering"] as string[] },
  };

  const [assignedCount, latest, settingsRow] = await Promise.all([
    prisma.order.count({
      where: {
        assignedCourierId: v.courierId,
        status: "assigned",
      },
    }),
    prisma.order.findFirst({
      where: whereActive,
      orderBy: { orderNumber: "desc" },
      select: { orderNumber: true },
    }),
    getOrCreateNotificationSettings(),
  ]);
  const settings = audienceSettings(settingsRow, "mandoub");

  return NextResponse.json({
    assignedCount,
    latestActiveOrderNumber: latest?.orderNumber ?? 0,
    settings,
  });
}
