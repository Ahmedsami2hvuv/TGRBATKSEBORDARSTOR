import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type Props = { params: Promise<{ shopId: string; type: string }> };

export async function GET(request: NextRequest, { params }: Props) {
  const { shopId, type } = await params;

  let base64Data: string | null | undefined = null;

  if (type === "photo") {
    const shop = await prisma.shop.findUnique({
      where: { id: shopId },
      select: { photoUrl: true },
    });
    base64Data = shop?.photoUrl;
  }

  if (!base64Data || !base64Data.startsWith("data:image/")) {
    return new NextResponse("Not Found", { status: 404 });
  }

  const matches = base64Data.match(/^data:(image\/[a-zA-Z0-9]+);base64,(.+)$/);
  if (!matches || matches.length !== 3) {
    return new NextResponse("Invalid Image Format", { status: 500 });
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
