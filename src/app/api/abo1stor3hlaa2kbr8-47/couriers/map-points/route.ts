import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { adminCookieName, verifyAdminToken } from "@/lib/auth";
import { cookies } from "next/headers";
import { assertTrackingEnabled, handleResourceDisabledError } from "@/lib/portal-chat-settings";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await assertTrackingEnabled();

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

    const staffEmployees = await prisma.staffEmployee.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, phone: true, lastStaffLat: true, lastStaffLng: true, lastStaffLocationAt: true }
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

    const staffPoints = staffEmployees
      .filter((s) => s.lastStaffLat != null && s.lastStaffLng != null && Number.isFinite(s.lastStaffLat) && Number.isFinite(s.lastStaffLng))
      .map((s) => ({
        id: s.id, name: s.name, phone: s.phone, lat: s.lastStaffLat as number, lng: s.lastStaffLng as number,
        updatedAt: s.lastStaffLocationAt?.toISOString() ?? null, type: "employee"
      }));

    return NextResponse.json({
      points: [...courierPoints, ...preparerPoints, ...staffPoints],
      withoutLoc: [
          ...couriers.filter(c => c.lastCourierLat == null || c.lastCourierLng == null).map(c => ({id: c.id, name: c.name, phone: c.phone, typeName: "مندوب", type: "courier"})),
          ...preparers.filter(p => p.lastPreparerLat == null || p.lastPreparerLng == null).map(p => ({id: p.id, name: p.name, phone: p.phone, typeName: "مجهز", type: "preparer"})),
          ...staffEmployees.filter(s => s.lastStaffLat == null || s.lastStaffLng == null).map(s => ({id: s.id, name: s.name, phone: s.phone, typeName: "موظف", type: "employee"})),
      ]
    });
  } catch (error) {
    return handleResourceDisabledError(error);
  }
}
