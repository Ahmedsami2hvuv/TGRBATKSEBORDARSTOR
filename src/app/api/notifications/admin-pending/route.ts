import { NextResponse } from "next/server";
import { isAdminSession } from "@/lib/admin-session";
import { audienceSettings, getOrCreateNotificationSettings } from "@/lib/notification-settings";
import { prisma } from "@/lib/prisma";
import { withEphemeralCache } from "@/lib/ephemeral-cache";

export const runtime = "nodejs";

export async function GET() {
  if (!(await isAdminSession())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const [pendingCount, latest, settingsRow] = await withEphemeralCache(
    "notif:admin:pending",
    4000,
    () =>
      Promise.all([
        prisma.order.count({ where: { status: "pending" } }),
        prisma.order.findFirst({
          where: { status: "pending" },
          orderBy: { orderNumber: "desc" },
          select: {
            orderNumber: true,
            orderType: true,
            orderNoteTime: true,
            orderSubtotal: true,
            shop: { select: { name: true } },
            customerRegion: { select: { name: true } },
          },
        }),
        getOrCreateNotificationSettings(),
      ]),
  );
  const settings = audienceSettings(settingsRow, "admin");

  return NextResponse.json({
    pendingCount,
    latestOrderNumber: latest?.orderNumber ?? 0,
    latestOrderDetails: latest ? {
      shopName: latest.shop?.name ?? "—",
      regionName: latest.customerRegion?.name ?? "—",
      orderTime: latest.orderNoteTime ?? "فوري",
      orderType: latest.orderType ?? "—",
      subtotal: latest.orderSubtotal ? Number(latest.orderSubtotal) : 0,
    } : null,
    settings,
  });
}
