import { NextRequest, NextResponse } from "next/server";
import {
  getOrderCardsDesignerConfig,
  saveOrderCardsDesignerConfig,
  type OrderCardDesignerConfig,
} from "@/lib/order-card-customizer";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const scopeParam = searchParams.get("scope");
    const scope: "admin" | "mandoub" = scopeParam === "mandoub" ? "mandoub" : "admin";

    const config = await getOrderCardsDesignerConfig(scope);
    return NextResponse.json(config);
  } catch (error) {
    console.error("Error fetching order cards designer config:", error);
    return NextResponse.json({ error: "Failed to load config" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const scope: "admin" | "mandoub" = body?.scope === "mandoub" ? "mandoub" : "admin";
    const config: Partial<OrderCardDesignerConfig> = body?.config || body;

    const ok = await saveOrderCardsDesignerConfig(config, scope);
    if (!ok) {
      return NextResponse.json({ error: "Failed to save config" }, { status: 500 });
    }

    const updated = await getOrderCardsDesignerConfig(scope);
    return NextResponse.json({ success: true, config: updated });
  } catch (error) {
    console.error("Error saving order cards designer config via API:", error);
    return NextResponse.json({ error: "Failed to save config" }, { status: 500 });
  }
}
