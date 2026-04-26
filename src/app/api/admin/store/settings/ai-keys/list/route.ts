import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const keys = await prisma.aIConfig.findMany({
      where: { provider: "removebg" },
      orderBy: { createdAt: "asc" }
    });
    return NextResponse.json(keys);
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch keys" }, { status: 500 });
  }
}
