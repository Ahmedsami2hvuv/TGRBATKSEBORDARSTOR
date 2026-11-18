import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;

  const startUrl = searchParams.get("start_url") || "/";
  const name = searchParams.get("name") || "وصلي";
  const shortName = searchParams.get("short_name") || "وصلي";
  const description = searchParams.get("description") || "وصلي_ نتسوق اي شي تريده_ونوصلك كل طلباتك";

  const manifestData = {
    name,
    short_name: shortName,
    description,
    id: startUrl,
    start_url: startUrl,
    scope: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#0ea5e9",
    orientation: "portrait-primary",
    icons: [
      {
        src: "/icon.png",
        sizes: "any",
        type: "image/png",
        purpose: "any maskable",
      },
      {
        src: "/apple-icon.png",
        sizes: "any",
        type: "image/png",
      },
    ],
  };

  return new NextResponse(JSON.stringify(manifestData, null, 2), {
    headers: {
      "Content-Type": "application/manifest+json; charset=utf-8",
      "Cache-Control": "public, max-age=60, stale-while-revalidate=600",
    },
  });
}
