import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { startOfDay, endOfDay } from "date-fns";
import { toZonedTime } from "date-fns-tz";

export async function GET() {
  try {
    const timeZone = "Asia/Baghdad";
    const now = toZonedTime(new Date(), timeZone);
    const start = startOfDay(now);
    const end = endOfDay(now);

    // حساب عدد طلبات اليوم
    const todayOrdersCount = await prisma.order.count({
      where: {
        createdAt: {
          gte: start,
          lte: end,
        },
      },
    });

    // حساب إجمالي المبيعات لليوم
    const salesAggregation = await prisma.order.aggregate({
      where: {
        createdAt: {
          gte: start,
          lte: end,
        },
        status: {
          not: "cancelled",
        },
      },
      _sum: {
        totalAmount: true,
      },
    });

    const todaySalesTotal = Number(salesAggregation._sum.totalAmount || 0);

    return NextResponse.json({
      todayOrdersCount,
      todaySalesTotal,
    });
  } catch (error) {
    console.error("Dashboard Stats Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
