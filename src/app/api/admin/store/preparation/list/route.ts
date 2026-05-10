import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const drafts = await prisma.companyPreparerShoppingDraft.findMany({
      where: {
        status: "draft"
      },
      orderBy: { createdAt: "desc" },
      include: {
        preparer: { select: { name: true } },
        customerRegion: { select: { name: true } }
      }
    });

    const formatted = drafts.map(d => ({
      id: d.id,
      title: d.titleLine,
      preparerName: d.preparer?.name || "غير محدد",
      customerName: d.customerName || "زبون",
      regionName: d.customerRegion?.name || "غير محدد",
      createdAt: d.createdAt.toISOString(),
      status: d.status
    }));

    return NextResponse.json(formatted);
  } catch (error) {
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
