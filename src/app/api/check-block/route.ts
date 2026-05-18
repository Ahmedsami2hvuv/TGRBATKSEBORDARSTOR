import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { normalizeIraqMobileLocal11 } from "@/lib/whatsapp";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const phoneRaw = searchParams.get("phone")?.trim() ?? "";
  const phone = normalizeIraqMobileLocal11(phoneRaw) || phoneRaw;

  if (!phone) {
    return NextResponse.json({ blocked: false });
  }

  const globalBlock = await prisma.globalBlockedPhone.findUnique({
    where: { phone },
  });

  return NextResponse.json({
    blocked: !!globalBlock,
    phone,
  });
}
