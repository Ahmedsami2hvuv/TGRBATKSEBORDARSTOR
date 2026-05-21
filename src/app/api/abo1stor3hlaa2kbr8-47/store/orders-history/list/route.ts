import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") || "all";
    const q = searchParams.get("q") || "";

    const where: any = {};

    // فلترة حسب الحالة (معلق، تم الإرسال، مؤرشف)
    if (status === "pending") {
        where.status = "pending";
        where.archivedAt = null;
    } else if (status === "submitted") {
        where.status = "submitted";
        where.archivedAt = null;
    } else if (status === "archived") {
        where.archivedAt = { not: null };
    }

    // دعم البحث برقم الهاتف أو المعرف
    if (q) {
        where.OR = [
            { customerPhone: { contains: q } },
            { id: { contains: q } }
        ];
    }

    const orders = await prisma.order.findMany({
      where,
      take: 50,
      orderBy: { createdAt: "desc" },
      include: {
        customer: { select: { name: true } },
        customerRegion: { select: { name: true } }
      },
    });

    const formatted = orders.map(o => ({
      id: o.id,
      customerName: o.customer?.name || "زبون مجهول",
      customerPhone: o.customerPhone,
      totalAmount: Number(o.totalAmount || 0),
      status: o.status,
      summary: o.summary,
      regionName: o.customerRegion?.name || "غير محدد",
      date: o.createdAt.toISOString(),
      isArchived: !!o.archivedAt
    }));

    return NextResponse.json(formatted);
  } catch (error) {
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
