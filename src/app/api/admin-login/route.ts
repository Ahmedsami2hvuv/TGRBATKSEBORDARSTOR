import { NextResponse } from "next/server";
import { signAdminToken, verifyAdminToken } from "@/lib/auth";

export async function POST(request: Request) {
  try {
    const { password } = await request.json();
    const expectedRaw = process.env.ADMIN_PASSWORD;
    const expected = expectedRaw?.trim();
    if (!expected) {
      return NextResponse.json(
        { error: "ADMIN_PASSWORD غير مضبوط في الخادم" },
        { status: 500 }
      );
    }
    if (!password || password.trim() !== expected) {
      return NextResponse.json(
        { error: "كلمة المرور غير صحيحة" },
        { status: 401 }
      );
    }
    const token = await signAdminToken();
    return NextResponse.json({ success: true, token });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get("token") ?? "";
    if (!token) {
      return NextResponse.json({ valid: false }, { status: 400 });
    }
    const valid = await verifyAdminToken(token);
    return NextResponse.json({ valid });
  } catch (error: any) {
    return NextResponse.json({ valid: false, error: error.message }, { status: 500 });
  }
}
