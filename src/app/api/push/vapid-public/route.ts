import { NextResponse } from "next/server";
import { getVapidPublicKeyForClient, isWebPushConfigured } from "@/lib/web-push-server";

export const runtime = "nodejs";

export async function GET() {
  if (!isWebPushConfigured()) {
    return NextResponse.json({ publicKey: null, configured: false });
  }
  return NextResponse.json({
    publicKey: getVapidPublicKeyForClient(),
    configured: true,
  });
}
