import { NextResponse } from "next/server";
import { verifyStaffEmployeePortalQuery } from "@/lib/staff-employee-portal-link";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function POST(req: Request) {
  let body: { se?: string; exp?: string; s?: string; lat?: number; lng?: number };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ ok: false, error: "body" }, { status: 400 });
  }

  const se = String(body.se ?? "").trim();
  const exp = body.exp != null ? String(body.exp) : undefined;
  const s = String(body.s ?? "").trim();
  const lat = typeof body.lat === "number" ? body.lat : Number(body.lat);
  const lng = typeof body.lng === "number" ? body.lng : Number(body.lng);

  const v = verifyStaffEmployeePortalQuery(se, exp, s);
  if (!v.ok) {
    return NextResponse.json({ ok: false, error: "auth" }, { status: 401 });
  }
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return NextResponse.json({ ok: false, error: "coords" }, { status: 400 });
  }
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return NextResponse.json({ ok: false, error: "range" }, { status: 400 });
  }

  const row = await prisma.staffEmployee.findFirst({
    where: { id: v.staffEmployeeId, active: true },
    select: { id: true }
  });
  if (!row) {
    return NextResponse.json({ ok: false, error: "staff_not_found" }, { status: 404 });
  }

  const serverTime = new Date();
  await prisma.staffEmployee.update({
    where: { id: v.staffEmployeeId },
    data: {
      lastStaffLat: lat,
      lastStaffLng: lng,
      lastStaffLocationAt: serverTime,
    },
  });

  return NextResponse.json({ ok: true, serverTime: serverTime.toISOString() });
}
