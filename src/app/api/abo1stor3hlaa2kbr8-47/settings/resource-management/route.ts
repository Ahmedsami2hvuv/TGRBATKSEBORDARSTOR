import { NextResponse } from "next/server";
import { isChatEnabledGlobally, isTrackingEnabledGlobally } from "@/lib/portal-chat-settings";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const [chatEnabled, trackingEnabled] = await Promise.all([
      isChatEnabledGlobally(),
      isTrackingEnabledGlobally(),
    ]);
    return NextResponse.json({ chatEnabled, trackingEnabled });
  } catch (error) {
    return NextResponse.json({ chatEnabled: true, trackingEnabled: true });
  }
}
