import { NextResponse } from "next/server";
import { isAdminSession } from "@/lib/admin-session";
import { prisma } from "@/lib/prisma";

export async function GET() {
  if (!(await isAdminSession())) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  const couriers = await prisma.courier.findMany({
    where: { blocked: false },
    select: {
      id: true,
      name: true,
      showDoorBtn: true,
      showLocationBtn: true,
      showCallBtn: true,
      showWhatsAppBtn: true,
      showNotesBtn: true,
      showVoiceNotesBtn: true,
    },
    orderBy: { name: "asc" },
  });

  return NextResponse.json(couriers);
}
