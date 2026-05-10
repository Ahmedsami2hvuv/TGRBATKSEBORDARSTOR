import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    // جلب أرقام حقيقية لكن بطريقة سريعة جداً لا تسبب Timeout
    const [pendingOrders, prepDrafts, archivedOrders, totalProducts, activeCouriers] = await Promise.all([
      prisma.order.count({ where: { status: "PENDING" } }),
      prisma.preparationDraft.count(),
      prisma.order.count({ where: { status: "COMPLETED" } }),
      prisma.product.count(),
      prisma.courier.count({ where: { status: "ACTIVE" } })
    ]);

    return NextResponse.json({
      success: true,
      stats: {
        pendingOrders,
        prepDrafts,
        archivedOrders,
        totalProducts,
        activeCouriers,
        assignedOrders: 0
      }
    });
  } catch (error: any) {
    console.error("Stats API Error:", error);
    return NextResponse.json({ success: false, message: "حدث خطأ في جلب البيانات" }, { status: 500 });
  }
}
