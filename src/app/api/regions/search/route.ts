import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/** بحث مناطق للإكمال (حرفان على الأقل) — يُستخدم في صفحة العميل */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) {
    return NextResponse.json({ regions: [] });
  }

  const regions = await prisma.region.findMany({
    where: {
      name: { contains: q, mode: "insensitive" },
    },
    orderBy: { name: "asc" },
    take: 25,
    select: { id: true, name: true, deliveryPrice: true },
  });

  return NextResponse.json({
    regions: regions.map((r) => ({
      id: r.id,
      name: r.name,
      deliveryPrice: r.deliveryPrice.toString(),
    })),
  });
}
