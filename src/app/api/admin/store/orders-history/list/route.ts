import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") || "all"; // pending, submitted, archived
    const q = searchParams.get("q") || "";

    const where: any = {};
    if (status !== "all") {
        if (status === "archived") {
            where.archivedAt = { not: null };
        } else {
            where.status = status;
            where.archivedAt = null;
        }
    }

    if (q) {
        where.OR = [
            { customerPhone: { contains: q } },
            { id: { contains: q } }
        ];
    }

    const orders = await prisma.order.findMany({
      where,
      take: 100,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        customerPhone: true,
        totalAmount: true,
        status: true,
        summary: true,
        createdAt: true,
        customer: { select: { name: true } },
        customerRegion: { select: { name: true } }
      },
    });

    const formattedOrders = orders.map((order) => ({
      id: order.id,
      customerName: order.customer?.name || "زبون مجهول",
      customerPhone: order.customerPhone,
      totalAmount: Number(order.totalAmount || 0),
      status: order.status,
      summary: order.summary,
      regionName: order.customerRegion?.name || "غير محدد",
      date: order.createdAt.toISOString()
    }));

    return NextResponse.json(formattedOrders);
  } catch (error) {
    console.error("Orders List Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
