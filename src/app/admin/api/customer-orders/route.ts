import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

const regionKey = (id: string | null) => id ?? "__none";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const phone = String(url.searchParams.get("phone") ?? "").trim();
  const regionId = String(url.searchParams.get("regionId") ?? "").trim();
  const currentOrderId = String(url.searchParams.get("currentOrderId") ?? "").trim();
  const limit = Number(url.searchParams.get("limit") ?? "10");

  if (!phone) {
    return NextResponse.json({ error: "phone is required" }, { status: 400 });
  }

  const baseWhere: Prisma.OrderWhereInput = {
    customerPhone: phone,
  };

  const orderWhere: Prisma.OrderWhereInput = {
    ...baseWhere,
    ...(regionId && regionId !== "all"
      ? regionId === "__none"
        ? { customerRegionId: null }
        : { customerRegionId: regionId }
      : {}),
    ...(currentOrderId ? { NOT: { id: currentOrderId } } : {}),
  };

  const orders = await prisma.order.findMany({
    where: orderWhere,
    orderBy: { createdAt: "desc" },
    take: Number.isFinite(limit) && limit > 0 ? limit : 10,
    select: {
      id: true,
      orderNumber: true,
      status: true,
      createdAt: true,
      orderType: true,
      orderSubtotal: true,
      deliveryPrice: true,
      totalAmount: true,
      shop: { select: { name: true } },
      customerRegion: { select: { name: true } },
      customerLandmark: true,
      alternatePhone: true,
      customerDoorPhotoUrl: true,
      customerLocationUrl: true,
    },
  });

  const regionRows = await prisma.order.findMany({
    where: baseWhere,
    select: {
      customerRegionId: true,
      customerRegion: { select: { name: true } },
    },
    orderBy: { customerRegionId: "asc" },
  });

  const regionCounts = regionRows.reduce<Record<string, { id: string | null; key: string; name: string; count: number }>>((acc, row) => {
    const key = regionKey(row.customerRegionId);
    if (!acc[key]) {
      acc[key] = {
        id: row.customerRegionId,
        key,
        name: row.customerRegion?.name || "غير محددة",
        count: 0,
      };
    }
    acc[key].count += 1;
    return acc;
  }, {});

  const regions = Object.values(regionCounts);

  return NextResponse.json({ orders, regions });
}
