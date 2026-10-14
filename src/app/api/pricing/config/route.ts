import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { DEFAULT_NO_PROFIT_KEYWORDS } from "@/lib/auto-pricing";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    const setting = await prisma.uISystemSetting.findUnique({
      where: {
        target_section: { target: "system", section: "pricing_config" }
      }
    });
    const config = (setting?.config as any) || {};
    const no_profit_keywords = Array.isArray(config.no_profit_keywords) && config.no_profit_keywords.length > 0
      ? Array.from(new Set([...DEFAULT_NO_PROFIT_KEYWORDS, ...config.no_profit_keywords]))
      : DEFAULT_NO_PROFIT_KEYWORDS;

    return NextResponse.json({
      ...config,
      no_profit_keywords,
    }, {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
      }
    });
  } catch (error) {
    console.error("Failed to load public pricing config:", error);
    return NextResponse.json({
      no_profit_keywords: DEFAULT_NO_PROFIT_KEYWORDS,
    });
  }
}
