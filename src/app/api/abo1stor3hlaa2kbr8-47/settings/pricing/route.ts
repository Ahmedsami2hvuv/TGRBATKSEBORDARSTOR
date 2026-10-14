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
  return NextResponse.json(setting?.config || {}, {
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
    }
  });
}

export async function POST(req: Request) {
  if (!(await isAdminSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const config = await req.json();

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
