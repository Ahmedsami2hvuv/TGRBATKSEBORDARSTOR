import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const [preparers, suppliers] = await Promise.all([
      prisma.companyPreparer.findMany({
        where: { active: true },
        select: {
          id: true,
          name: true,
          phone: true,
          availableForAssignment: true
        },
        orderBy: { name: "asc" }
      }),
      prisma.storeSupplier.findMany({
        where: { active: true },
        select: {
          id: true,
          name: true,
          phone: true
        },
        orderBy: { name: "asc" }
      })
    ]);

    const formattedList = [
      ...preparers.map(p => ({
        id: p.id,
        name: p.name,
        phone: p.phone,
        type: "preparer",
        displayLabel: `📦 مجهز: ${p.name}`
      })),
      ...suppliers.map(s => ({
        id: s.id,
        name: s.name,
        phone: s.phone,
        type: "supplier",
        displayLabel: `🏬 مورد: ${s.name}`
      }))
    ];

    return NextResponse.json({
      success: true,
      list: formattedList,
      preparers: preparers,
      suppliers: suppliers
    });
  } catch (error: any) {
    console.error("Suppliers and preparers GET error:", error);
    return NextResponse.json({ error: error.message || "فشل جلب قائمة المجهزين والموردين" }, { status: 500 });
  }
}
