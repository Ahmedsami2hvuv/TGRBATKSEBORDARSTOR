import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q");

  if (!q) return NextResponse.json([]);

  const products = await prisma.storeProduct.findMany({
    where: {
      active: true,
      name: { contains: q, mode: "insensitive" }
    },
    select: {
      id: true,
      name: true,
      salePrice: true,
      description: true,
      photoUrls: true
    },
    take: 5
  });

  return NextResponse.json(products);
}
