import { NextResponse } from "next/server";
import { verifyDelegatePortalQuery } from "@/lib/delegate-link";
import { prisma } from "@/lib/prisma";

/** للمندوب: طابع تحديث طلب واحد (للمقارنة بدون إعادة تحميل كامل من المتصفح). */
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
    select: { updatedAt: true },
  });

  if (!order) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  return NextResponse.json(
    { updatedAt: order.updatedAt.toISOString() },
    { headers: { "Cache-Control": "no-store" } },
  );
}
