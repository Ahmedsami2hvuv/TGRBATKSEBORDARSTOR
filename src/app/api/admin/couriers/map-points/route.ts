import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { adminCookieName, verifyAdminToken } from "@/lib/auth";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

export async function GET() {
  const jar = await cookies();
  const token = jar.get(adminCookieName)?.value ?? "";
  if (!token || !(await verifyAdminToken(token))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const couriers = await prisma.courier.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true, phone: true, lastCourierLat: true, lastCourierLng: true, lastCourierLocationAt: true },
  });

  const preparers = await prisma.companyPreparer.findMany({
    where: { active: true },
    select: { id: true, name: true, phone: true, lastPreparerLat: true, lastPreparerLng: true, lastPreparerLocationAt: true }
  });

  const courierPoints = couriers
    .filter((c) => c.lastCourierLat != null && c.lastCourierLng != null && Number.isFinite(c.lastCourierLat) && Number.isFinite(c.lastCourierLng))
    .map((c) => ({
      id: c.id, name: c.name, phone: c.phone, lat: c.lastCourierLat as number, lng: c.lastCourierLng as number,
      updatedAt: c.lastCourierLocationAt?.toISOString() ?? null, type: "courier"
    }));

  const preparerPoints = preparers
    .filter((p) => p.lastPreparerLat != null && p.lastPreparerLng != null && Number.isFinite(p.lastPreparerLat) && Number.isFinite(p.lastPreparerLng))
    .map((p) => ({
      id: p.id, name: p.name, phone: p.phone, lat: p.lastPreparerLat as number, lng: p.lastPreparerLng as number,
      updatedAt: p.lastPreparerLocationAt?.toISOString() ?? null, type: "preparer"
    }));

  return NextResponse.json({
    points: [...courierPoints, ...preparerPoints],
    withoutLoc: [
        ...couriers.filter(c => c.lastCourierLat == null || c.lastCourierLng == null).map(c => ({id: c.id, name: c.name, phone: c.phone, typeName: "مندوب"})),
        ...preparers.filter(p => p.lastPreparerLat == null || p.lastPreparerLng == null).map(p => ({id: p.id, name: p.name, phone: p.phone, typeName: "مجهز"})),
    ]
  });
}
