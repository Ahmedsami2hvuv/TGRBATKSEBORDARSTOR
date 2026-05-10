import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    // حساب بداية ونهاية اليوم الحالي بتوقيت العراق (UTC+3) يدوياً لتجنب المكتبات الخارجية
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    const [
      totalOrders,
      pendingOrders,
      activeMandoubs,
      todayOrders
    ] = await Promise.all([
      prisma.order.count(),
      prisma.order.count({ where: { status: "pending" } }),
      prisma.companyCourier.count({ where: { active: true } }),
      prisma.order.count({
        where: {
          createdAt: {
            gte: startOfDay,
            lte: endOfDay,
          },
        },
      }),
    ]);

    return NextResponse.json({
      totalOrders,
      pendingOrders,
      activeMandoubs,
      todayOrders,
    });
  } catch (error) {
    console.error("Dashboard Stats Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
