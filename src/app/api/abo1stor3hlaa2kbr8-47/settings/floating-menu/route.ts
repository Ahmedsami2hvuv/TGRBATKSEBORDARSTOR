import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdminSession } from "@/lib/admin-session";

export async function GET() {
  try {
    const setting = await prisma.uISystemSetting.findUnique({
      where: {
        target_section: { target: "admin", section: "floating_menu" }
      }
    });
    return NextResponse.json(setting?.config || { categories: [], isLocked: false, menuScale: 1, menuFontSize: 8 });
  } catch (err) {
    console.error("Failed to get floating menu settings:", err);
    return NextResponse.json({ categories: [], isLocked: false, menuScale: 1, menuFontSize: 8 });
  }
}

export async function POST(req: Request) {
  if (!(await isAdminSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { categories, isLocked, menuScale, menuFontSize } = body;

    const config = {
      categories,
      isLocked,
      menuScale,
      menuFontSize: menuFontSize !== undefined ? Number(menuFontSize) : 8,
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
