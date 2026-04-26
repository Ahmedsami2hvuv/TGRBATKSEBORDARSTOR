import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdminSession } from "@/lib/admin-session";

export async function GET() {
  const setting = await prisma.uISystemSetting.findUnique({
    where: {
      target_section: { target: "system", section: "pricing_config" }
    }
  });
  return NextResponse.json(setting?.config || {});
}

export async function POST(req: Request) {
  if (!(await isAdminSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const config = await req.json();

  await prisma.uISystemSetting.upsert({
    where: {
      target_section: { target: "system", section: "pricing_config" }
    },
    update: { config },
    create: { target: "system", section: "pricing_config", config }
  });

  return NextResponse.json({ ok: true });
}
