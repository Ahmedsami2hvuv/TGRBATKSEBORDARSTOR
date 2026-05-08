import { NextResponse } from "next/server";
import { verifyDelegatePortalQuery } from "@/lib/delegate-link";
import { prisma } from "@/lib/prisma";

type OrderSnapshot = {
  status: string;
  totalAmount: string;
  deliveryPrice: string;
  summary: string;
  orderType: string;
  customerLocationUrl: string;
  customerLandmark: string;
  customerDoorPhotoUrl: string;
  adminVoiceNoteUrl: string;
  shopDoorPhotoUrl: string;
  secondCustomerPhone: string;
  secondCustomerLocationUrl: string;
  secondCustomerLandmark: string;
  secondCustomerDoorPhotoUrl: string;
};

function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function toSnapshot(order: {
  status: string;
  totalAmount: unknown;
  deliveryPrice: unknown;
  summary: string | null;
  orderType: string | null;
  customerLocationUrl: string | null;
  customerLandmark: string | null;
  customerDoorPhotoUrl: string | null;
  adminVoiceNoteUrl: string | null;
  shopDoorPhotoUrl: string | null;
  secondCustomerPhone: string | null;
  secondCustomerLocationUrl: string | null;
  secondCustomerLandmark: string | null;
  secondCustomerDoorPhotoUrl: string | null;
}): OrderSnapshot {
  return {
    status: str(order.status),
    totalAmount: order.totalAmount != null ? String(order.totalAmount) : "",
    deliveryPrice: order.deliveryPrice != null ? String(order.deliveryPrice) : "",
    summary: str(order.summary),
    orderType: str(order.orderType),
    customerLocationUrl: str(order.customerLocationUrl),
    customerLandmark: str(order.customerLandmark),
    customerDoorPhotoUrl: str(order.customerDoorPhotoUrl),
    adminVoiceNoteUrl: str(order.adminVoiceNoteUrl),
    shopDoorPhotoUrl: str(order.shopDoorPhotoUrl),
    secondCustomerPhone: str(order.secondCustomerPhone),
    secondCustomerLocationUrl: str(order.secondCustomerLocationUrl),
    secondCustomerLandmark: str(order.secondCustomerLandmark),
    secondCustomerDoorPhotoUrl: str(order.secondCustomerDoorPhotoUrl),
  };
}

/** للمندوب: فحص تحديثات طلب واحد مع تفاصيل التغيير الأساسية. */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const orderId = searchParams.get("orderId")?.trim() ?? "";
  const c = searchParams.get("c") ?? "";
  const exp = searchParams.get("exp") ?? undefined;
  const s = searchParams.get("s") ?? "";

  const v = verifyDelegatePortalQuery(c, exp, s);
  if (!v.ok || !orderId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const order = await prisma.order.findFirst({
    where: {
      id: orderId,
      status: { in: ["assigned", "delivering", "delivered"] },
      OR: [
        { assignedCourierId: v.courierId },
        { courierEarningForCourierId: v.courierId },
      ],
    },
    select: {
      updatedAt: true,
      status: true,
      totalAmount: true,
      deliveryPrice: true,
      summary: true,
      orderType: true,
      customerLocationUrl: true,
      customerLandmark: true,
      customerDoorPhotoUrl: true,
      adminVoiceNoteUrl: true,
      shopDoorPhotoUrl: true,
      secondCustomerPhone: true,
      secondCustomerLocationUrl: true,
      secondCustomerLandmark: true,
      secondCustomerDoorPhotoUrl: true,
    },
  });

  if (!order) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  return NextResponse.json(
    {
      updatedAt: order.updatedAt.toISOString(),
      snapshot: toSnapshot(order),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
