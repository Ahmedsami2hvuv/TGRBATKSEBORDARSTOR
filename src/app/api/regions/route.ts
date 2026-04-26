import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET() {
  const regions = await prisma.region.findMany({
    orderBy: { name: "asc" },
  });
  return NextResponse.json(regions);
}
