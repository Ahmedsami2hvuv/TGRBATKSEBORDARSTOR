import { NextResponse } from "next/server";
import { getGlobalIcons, saveGlobalIcons } from "@/lib/icon-settings";
import { isAdminSession } from "@/lib/admin-session";

export async function GET() {
  try {
    const icons = await getGlobalIcons();
    return NextResponse.json(icons);
  } catch (error) {
    console.error("Failed to fetch global icons:", error);
    return NextResponse.json({ error: "Failed to fetch icons" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  if (!(await isAdminSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const config = await req.json();
    await saveGlobalIcons(config);
    return NextResponse.json({ ok: true, message: "Icons saved successfully" });
  } catch (error) {
    console.error("Failed to save global icons:", error);
    return NextResponse.json({ error: "Failed to save icons" }, { status: 500 });
  }
}
