import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type Props = { params: Promise<{ orderId: string; type: string }> };

export async function GET(request: NextRequest, { params }: Props) {
  const { orderId, type } = await params;

  let base64Data: string | null | undefined = null;
  let expectedMimePrefix = "image/";

  if (type === "image") {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: { imageUrl: true },
    });
    base64Data = order?.imageUrl;
  } else if (type === "shopDoor") {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: { shopDoorPhotoUrl: true },
    });
    base64Data = order?.shopDoorPhotoUrl;
  } else if (type === "customerDoor") {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: { customerDoorPhotoUrl: true },
    });
    base64Data = order?.customerDoorPhotoUrl;
  } else if (type === "secondCustomerDoor") {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: { secondCustomerDoorPhotoUrl: true },
    });
    base64Data = order?.secondCustomerDoorPhotoUrl;
  } else if (type === "voice") {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: { voiceNoteUrl: true },
    });
    base64Data = order?.voiceNoteUrl;
    expectedMimePrefix = "audio/";
  } else if (type === "admin-voice") {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: { adminVoiceNoteUrl: true },
    });
    base64Data = order?.adminVoiceNoteUrl;
    expectedMimePrefix = "audio/";
  }

  if (!base64Data || !base64Data.startsWith(`data:${expectedMimePrefix}`)) {
    return new NextResponse("Not Found", { status: 404 });
  }

  const matches = base64Data.match(/^data:([a-zA-Z0-9/+.-]+);base64,(.+)$/);
  if (!matches || matches.length !== 3) {
    return new NextResponse("Invalid Media Format", { status: 500 });
  }

  const mimeType = matches[1];
  const b64 = matches[2];
  const buffer = Buffer.from(b64, "base64");

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": mimeType,
      "Cache-Control": "public, max-age=86400, immutable",
    },
  });
}
