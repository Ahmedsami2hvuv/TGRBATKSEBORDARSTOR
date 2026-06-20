import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { dinarDecimalToAlfInputString } from "@/lib/money-alf";
import { withoutReversePickupPrefix } from "@/lib/order-type-flags";

export async function GET(
  request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const { id: shopId } = await props.params;

    if (!shopId) {
      return NextResponse.json({ error: "Shop ID is required" }, { status: 400 });
    }

    // جلب آخر 50 طلباً للمحل لاستخراج الاقتراحات منها
    const orders = await prisma.order.findMany({
      where: { shopId },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        orderType: true,
        orderSubtotal: true,
        orderNoteTime: true,
      },
    });

    // استخراج آخر 5 قيم فريدة غير فارغة لكل حقل
    const types = Array.from(
      new Set(
        orders
          .map((o) => withoutReversePickupPrefix(o.orderType))
          .filter(Boolean)
      )
    ).slice(0, 5);

    const subtotals = Array.from(
      new Set(
        orders
          .map((o) => dinarDecimalToAlfInputString(o.orderSubtotal))
          .filter(Boolean)
      )
    ).slice(0, 5);

    const times = Array.from(
      new Set(
        orders
          .map((o) => o.orderNoteTime?.trim() || "")
          .filter(Boolean)
      )
    ).slice(0, 5);

    return NextResponse.json({
      types,
      subtotals,
      times,
    });
  } catch (error) {
    console.error("Error fetching shop suggestions:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
