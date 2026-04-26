import { NextResponse } from "next/server";
import { isCourierPortalBlocked } from "@/lib/courier-delegate-access";
import { verifyDelegatePortalQuery } from "@/lib/delegate-link";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

/**
 * المندوب يرفع إحداثياته من صفحة /mandoub كل ~20 ثانية (نبض للإدارة).
 * تُخزَّن في Courier.lastCourier* لتعرض للإدارة (خريطة المندوبين / التتبع).
 */
export async function POST(req: Request) {
  let body: { c?: string; exp?: string; s?: string; lat?: number; lng?: number };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ ok: false, error: "body" }, { status: 400 });
  }

  const c = String(body.c ?? "").trim();
  const exp = body.exp != null ? String(body.exp) : undefined;
  const s = String(body.s ?? "").trim();
  const lat = typeof body.lat === "number" ? body.lat : Number(body.lat);
  const lng = typeof body.lng === "number" ? body.lng : Number(body.lng);

  const v = verifyDelegatePortalQuery(c, exp, s);
  if (!v.ok) {
    return NextResponse.json({ ok: false, error: "auth" }, { status: 401 });
  }
  if (await isCourierPortalBlocked(v.courierId)) {
    return NextResponse.json({ ok: false, error: "blocked" }, { status: 403 });
  }
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return NextResponse.json({ ok: false, error: "coords" }, { status: 400 });
  }
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return NextResponse.json({ ok: false, error: "range" }, { status: 400 });
  }

  const row = await prisma.courier.findUnique({
    where: { id: v.courierId },
    select: { id: true },
  });
  if (!row) {
    return NextResponse.json({ ok: false, error: "courier" }, { status: 404 });
  }

  const serverTime = new Date();
  await prisma.courier.update({
    where: { id: v.courierId },
    data: {
      lastCourierLat: lat,
      lastCourierLng: lng,
      lastCourierLocationAt: serverTime,
    },
  });

  return NextResponse.json({ ok: true, serverTime: serverTime.toISOString() });
}

/**
 * آخر وقت وصل فيه موقع للخادم (للمزامنة مع العميل).
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const c = url.searchParams.get("c")?.trim() ?? "";
  const exp = url.searchParams.get("exp") ?? undefined;
  const s = url.searchParams.get("s")?.trim() ?? "";

  const v = verifyDelegatePortalQuery(c, exp, s);
  if (!v.ok) {
    return NextResponse.json({ ok: false, error: "auth" }, { status: 401 });
  }
  if (await isCourierPortalBlocked(v.courierId)) {
    return NextResponse.json({ ok: false, error: "blocked" }, { status: 403 });
  }

  const row = await prisma.courier.findUnique({
    where: { id: v.courierId },
    select: { lastCourierLocationAt: true },
  });
  if (!row) {
    return NextResponse.json({ ok: false, error: "courier" }, { status: 404 });
  }

  return NextResponse.json({
    ok: true,
    lastReceivedAt: row.lastCourierLocationAt?.toISOString() ?? null,
  });
}
