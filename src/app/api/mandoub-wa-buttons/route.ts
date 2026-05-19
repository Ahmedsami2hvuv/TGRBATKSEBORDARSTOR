import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const rows = await prisma.mandoubWaButtonSetting.findMany({
      where: { isActive: true },
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        label: true,
        iconKey: true,
        templateText: true,
        visibilityScope: true,
        statusesCsv: true,
        customerLocationRule: true,
      },
    });

    return NextResponse.json(rows, {
      headers: {
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("Failed to load mandoub wa buttons", error);
    return NextResponse.json({ error: "Unable to load wa buttons" }, { status: 500 });
  }
}
