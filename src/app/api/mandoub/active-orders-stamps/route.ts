import { NextResponse } from "next/server";
import { verifyDelegatePortalQuery } from "@/lib/delegate-link";
import { prisma } from "@/lib/prisma";
import { mandoubOrdersStampSig } from "@/lib/mandoub-order-stamps";

/**
 * طوابع updatedAt لكل الطلبات النشطة للمندوب — لمقارنة خفيفة وتحديث قائمة الطلبات عند تغيّر أي طلب (مثلاً من الإدارة).
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const c = searchParams.get("c") ?? "";
  const exp = searchParams.get("exp") ?? undefined;
  const s = searchParams.get("s") ?? "";

  const v = verifyDelegatePortalQuery(c, exp, s);
  if (!v.ok) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const rows = await prisma.order.findMany({
    where: {
      status: { in: ["assigned", "delivering", "delivered"] },
      OR: [
        { assignedCourierId: v.courierId },
        { courierEarningForCourierId: v.courierId },
      ],
    },
    select: { id: true, updatedAt: true },
    orderBy: { createdAt: "desc" },
    take: 150,
  });

  const stamps: Record<string, string> = {};
  for (const r of rows) {
    stamps[r.id] = r.updatedAt.toISOString();
  }

  return NextResponse.json(
    { stamps, stampSig: mandoubOrdersStampSig(rows) },
    { headers: { "Cache-Control": "no-store" } },
  );
}
