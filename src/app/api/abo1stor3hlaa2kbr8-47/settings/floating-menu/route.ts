import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdminSession } from "@/lib/admin-session";

export async function GET() {
  const setting = await prisma.uISystemSetting.findUnique({
    where: {
      target_section: { target: "admin", section: "floating_menu" }
    }
  });
  return NextResponse.json(setting?.config || { categories: [], isLocked: false, menuScale: 1 });
}

export async function POST(req: Request) {
  if (!(await isAdminSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { categories, isLocked, menuScale } = body;

    const config = {
      categories,
      isLocked,
      menuScale,
    };

    await prisma.uISystemSetting.upsert({
      where: {
        target_section: { target: "admin", section: "floating_menu" }
      },
      update: { config },
      create: { target: "admin", section: "floating_menu", config }
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Failed to save floating menu settings:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
