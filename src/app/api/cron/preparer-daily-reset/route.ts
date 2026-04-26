import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * تصفير قائمة المجهز اليومية — يُستدعى يومياً الساعة 6 صباحاً (Cron خارجي أو جدولة منصة).
 * يحدّث orderListResetAt لكل مجهز؛ الطلبات تبقى في قاعدة البيانات ولوحة الإدارة.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  const url = new URL(req.url);
  const q = url.searchParams.get("secret")?.trim();
  const auth = req.headers.get("authorization");
  const bearer = auth?.startsWith("Bearer ") ? auth.slice(7).trim() : "";

  if (!secret || (q !== secret && bearer !== secret)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const result = await prisma.companyPreparer.updateMany({
    data: { orderListResetAt: now },
  });

  return NextResponse.json({ ok: true, updated: result.count, resetAt: now.toISOString() });
}
