import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const samples = await prisma.customerPhoneProfile.findMany({
    where: { photoUrl: { not: "" } },
    take: 10
  });

  return NextResponse.json({ samples });
}
