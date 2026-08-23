import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const preparers = await prisma.companyPreparer.findMany({
      where: { active: true },
      select: {
        id: true,
        name: true,
        phone: true,
        availableForAssignment: true
      },
      orderBy: { name: "asc" }
    });

    return NextResponse.json({
      success: true,
      preparers: preparers.map((p) => ({
        id: p.id,
        name: p.name,
        phone: p.phone,
        available: p.availableForAssignment
      }))
    });
  } catch (error: any) {
    console.error("Employee preparers GET error:", error);
    return NextResponse.json({ error: error.message || "فشل جلب المجهزين" }, { status: 500 });
  }
}
