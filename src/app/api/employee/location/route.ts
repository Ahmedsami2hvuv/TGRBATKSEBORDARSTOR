import { NextResponse } from "next/server";
import { verifyEmployeeOrderPortalQuery } from "@/lib/employee-order-portal-link";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function POST(req: Request) {
  let body: { e?: string; exp?: string; s?: string; lat?: number; lng?: number };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ ok: false, error: "body" }, { status: 400 });
  }

  const e = String(body.e ?? "").trim();
  const exp = body.exp != null ? String(body.exp) : undefined;
  const s = String(body.s ?? "").trim();
  const lat = typeof body.lat === "number" ? body.lat : Number(body.lat);
  const lng = typeof body.lng === "number" ? body.lng : Number(body.lng);

  const v = verifyEmployeeOrderPortalQuery(e, exp, s);
  if (!v.ok) {
    return NextResponse.json({ ok: false, error: "auth" }, { status: 401 });
  }
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return NextResponse.json({ ok: false, error: "coords" }, { status: 400 });
  }
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return NextResponse.json({ ok: false, error: "range" }, { status: 400 });
  }

  const serverTime = new Date();
  await prisma.employee.update({
    where: { id: v.employeeId },
    data: {
      lastEmployeeLat: lat,
      lastEmployeeLng: lng,
      lastEmployeeLocationAt: serverTime,
    },
  });

  return NextResponse.json({ ok: true, serverTime: serverTime.toISOString() });
}
