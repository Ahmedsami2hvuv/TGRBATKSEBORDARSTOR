import { NextResponse } from "next/server";
import { verifyCompanyPreparerPortalQuery } from "@/lib/company-preparer-portal-link";
import { audienceSettings, getOrCreateNotificationSettings } from "@/lib/notification-settings";
import { prisma } from "@/lib/prisma";
import { withEphemeralCache } from "@/lib/ephemeral-cache";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const p = searchParams.get("p") ?? "";
  const exp = searchParams.get("exp") ?? undefined;
  const s = searchParams.get("s") ?? "";
  const v = verifyCompanyPreparerPortalQuery(p, exp, s);
  if (!v.ok) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const [count, latest, settingsRow, latestShopOrder] = await withEphemeralCache(
    `notif:preparer:${v.preparerId}:notices`,
    4000,
    () =>
      Promise.all([
        prisma.companyPreparerPrepNotice.count({
          where: { preparerId: v.preparerId, dismissedAt: null },
        }),
        prisma.companyPreparerPrepNotice.findFirst({
          where: { preparerId: v.preparerId, dismissedAt: null },
          orderBy: { createdAt: "desc" },
          select: { id: true, title: true, body: true },
        }),
        getOrCreateNotificationSettings(),
        prisma.order.findFirst({
          where: {
            status: { in: ["pending", "assigned", "delivering"] },
            shop: {
              preparerLinks: {
                some: { preparerId: v.preparerId, canSubmitOrders: true },
              },
            },
          },
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            orderNumber: true,
            createdAt: true,
            shop: { select: { name: true } },
            customerRegion: { select: { name: true } },
          },
        }),
      ]),
  );
  const settings = audienceSettings(settingsRow, "preparer");

  return NextResponse.json({
    noticesCount: count,
    latestTitle: latest?.title ?? "",
    latestBody: latest?.body ?? "",
    latestNoticeId: latest?.id ?? "",
    latestShopOrderId: latestShopOrder?.id ?? "",
    latestShopOrderNumber: latestShopOrder?.orderNumber ?? null,
    latestShopOrderCreatedAt: latestShopOrder?.createdAt ?? null,
    latestShopOrderShopName: latestShopOrder?.shop?.name ?? "",
    latestShopOrderRegionName: latestShopOrder?.customerRegion?.name ?? "",
    settings,
  });
}
