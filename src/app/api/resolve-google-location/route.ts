import { NextResponse } from "next/server";
import { resolveGoogleShortMapsUrl } from "@/lib/order-location";

export async function GET(req: Request) {
  const url = new URL(req.url).searchParams.get("url")?.trim() || "";
  if (!url) {
    return NextResponse.json({ error: "missing_url" }, { status: 400 });
  }

  const resolved = await resolveGoogleShortMapsUrl(url);
  if (!resolved) {
    return NextResponse.json({ error: "could_not_resolve" }, { status: 422 });
  }

  return NextResponse.json({ latitude: resolved.latitude, longitude: resolved.longitude });
}
