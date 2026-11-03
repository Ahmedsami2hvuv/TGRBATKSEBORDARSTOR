import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdminSession } from "@/lib/admin-session";
import { setGlobalNoProfitKeywords } from "@/lib/auto-pricing";
import { revalidatePath } from "next/cache";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const setting = await prisma.uISystemSetting.findUnique({
    where: {
      target_section: { target: "system", section: "pricing_config" }
    }
  });
  const config = (setting?.config && typeof setting.config === "object")
    ? (setting.config as Record<string, unknown>)
    : {};

  // تنظيف ذاتي: أي أسعار لحوم ثابتة قديمة تُمسح من قاعدة البيانات فوراً
  const meatPrices = config.meat_prices;
  const hasLegacyMeatPrices =
    meatPrices &&
    typeof meatPrices === "object" &&
    !Array.isArray(meatPrices) &&
    Object.keys(meatPrices as object).length > 0;

  if (hasLegacyMeatPrices) {
    const cleaned = { ...config, meat_prices: {} };
    await prisma.uISystemSetting.upsert({
      where: { target_section: { target: "system", section: "pricing_config" } },
      update: { config: cleaned },
      create: { target: "system", section: "pricing_config", config: cleaned },
    });
    return NextResponse.json(cleaned, {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
      },
    });
  }

  return NextResponse.json({ ...config, meat_prices: {} }, {
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
    }
  });
}

export async function POST(req: Request) {
  if (!(await isAdminSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const raw = await req.json();

  // إلغاء دائم لأسعار اللحوم الثابتة/التلقائية — نفرّغها حتى لو وصلت من الواجهة أو بيانات قديمة
  const config = {
    ...(raw && typeof raw === "object" ? raw : {}),
    meat_prices: {},
  };

  if (Array.isArray(config?.no_profit_keywords)) {
    setGlobalNoProfitKeywords(config.no_profit_keywords);
  }

  await prisma.uISystemSetting.upsert({
    where: {
      target_section: { target: "system", section: "pricing_config" }
    },
    update: { config },
    create: { target: "system", section: "pricing_config", config }
  });

  revalidatePath("/preparer", "layout");
  revalidatePath("/abo1stor3hlaa2kbr8-47/settings");

  return NextResponse.json({ ok: true });
}
