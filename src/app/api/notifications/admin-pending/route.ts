import { NextRequest, NextResponse } from "next/server";
import { isAdminSession } from "@/lib/admin-session";
import { verifyAdminToken } from "@/lib/auth";
import { audienceSettings, getOrCreateNotificationSettings } from "@/lib/notification-settings";
import { prisma } from "@/lib/prisma";
import { withEphemeralCache } from "@/lib/ephemeral-cache";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const tokenParam = request.nextUrl.searchParams.get("token");

  let authorized = false;
  if (tokenParam) {
    authorized = await verifyAdminToken(tokenParam);
  } else {
    authorized = await isAdminSession();
  }

  if (!authorized) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const [shopPendingCount, storePendingCount, latestShop, latestStore, settingsRow] = await withEphemeralCache(
      "notif:admin:pending",
      3000,
      () =>
        Promise.all([
          prisma.order.count({ where: { status: "pending" } }),
          prisma.companyPreparerShoppingDraft.count({
            where: {
              status: "draft",
              preparerId: null
            }
          }),
          prisma.order.findFirst({
            where: { status: "pending" },
            orderBy: { orderNumber: "desc" },
            select: {
              orderNumber: true,
              orderType: true,
              orderNoteTime: true,
              orderSubtotal: true,
              createdAt: true,
              shop: { select: { name: true } },
              customerRegion: { select: { name: true } },
            },
          }),
          prisma.companyPreparerShoppingDraft.findFirst({
            where: { status: "draft", preparerId: null },
            orderBy: { createdAt: "desc" },
            include: { customerRegion: { select: { name: true } } }
          }),
          getOrCreateNotificationSettings(),
        ]),
    );
    const settings = audienceSettings(settingsRow, "admin");

    const totalPending = shopPendingCount + storePendingCount;
  let latestDetails: any = null;
  let latestOrderNum = 0;

  if (latestStore && (!latestShop || new Date(latestStore.createdAt).getTime() > new Date(latestShop.createdAt).getTime())) {
    latestOrderNum = latestStore.draftNumber;
    latestDetails = {
      shopName: "المتجر الإلكتروني",
      regionName: latestStore.customerRegion?.name || "منطقة عامة",
      orderTime: latestStore.orderTime || "فوري",
      orderType: "متجر حازم 🛒",
      subtotal: Number((latestStore.data as any)?.orderSubtotalAlf || 0),
      isStoreOrder: true,
      isHasimAlert: true,
    };
  } else if (latestShop) {
    latestOrderNum = latestShop.orderNumber;
    latestDetails = {
      shopName: latestShop.shop?.name ?? "—",
      regionName: latestShop.customerRegion?.name ?? "—",
      orderTime: latestShop.orderNoteTime ?? "فوري",
      orderType: latestShop.orderType ?? "—",
      subtotal: latestShop.orderSubtotal ? Number(latestShop.orderSubtotal) : 0,
      isStoreOrder: false,
      isHasimAlert: true,
    };
  }

    return NextResponse.json({
      pendingCount: totalPending,
      latestOrderNumber: latestOrderNum,
      latestOrderDetails: latestDetails,
      settings,
    });
  } catch (error) {
    console.error("[Admin Pending API Error]", error);
    return NextResponse.json({
      pendingCount: 0,
      latestOrderNumber: 0,
      latestOrderDetails: null,
      settings: {},
    });
  }
}
