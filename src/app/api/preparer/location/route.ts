import { NextResponse } from "next/server";
import { verifyCompanyPreparerPortalQuery } from "@/lib/company-preparer-portal-link";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

/**
 * المجهز يرفع إحداثياته من بوابة /preparer كل ~20 ثانية (نبض للإدارة).
 */
export async function POST(req: Request) {
  let body: { p?: string; exp?: string; s?: string; lat?: number; lng?: number };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ ok: false, error: "body" }, { status: 400 });
  }

  const p = String(body.p ?? "").trim();
  const exp = body.exp != null ? String(body.exp) : undefined;
  const s = String(body.s ?? "").trim();
  const lat = typeof body.lat === "number" ? body.lat : Number(body.lat);
  const lng = typeof body.lng === "number" ? body.lng : Number(body.lng);

  const v = verifyCompanyPreparerPortalQuery(p, exp, s);
  if (!v.ok) {
    return NextResponse.json({ ok: false, error: "auth" }, { status: 401 });
  }
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return NextResponse.json({ ok: false, error: "coords" }, { status: 400 });
  }
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return NextResponse.json({ ok: false, error: "range" }, { status: 400 });
  }

  const row = await prisma.companyPreparer.findFirst({
    where: { id: v.preparerId, active: true },
    select: { id: true },
  });
  if (!row) {
    return NextResponse.json({ ok: false, error: "preparer" }, { status: 404 });
  }

  const serverTime = new Date();
  await prisma.companyPreparer.update({
    where: { id: v.preparerId },
    data: {
      lastPreparerLat: lat,
      lastPreparerLng: lng,
      lastPreparerLocationAt: serverTime,
    },
  });

  return NextResponse.json({ ok: true, serverTime: serverTime.toISOString() });
}

/**
 * آخر وقت وصل فيه موقع للخادم (للمزامنة مع العميل).
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const p = url.searchParams.get("p")?.trim() ?? "";
  const exp = url.searchParams.get("exp") ?? undefined;
  const s = url.searchParams.get("s")?.trim() ?? "";

  const v = verifyCompanyPreparerPortalQuery(p, exp, s);
  if (!v.ok) {
    return NextResponse.json({ ok: false, error: "auth" }, { status: 401 });
  }

  const row = await prisma.companyPreparer.findFirst({
    where: { id: v.preparerId, active: true },
    select: { lastPreparerLocationAt: true },
  });
  if (!row) {
    return NextResponse.json({ ok: false, error: "preparer" }, { status: 404 });
  }

  return NextResponse.json({
    ok: true,
    lastReceivedAt: row.lastPreparerLocationAt?.toISOString() ?? null,
  });
}
