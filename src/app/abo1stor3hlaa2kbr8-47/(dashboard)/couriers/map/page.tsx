import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { ad } from "@/lib/admin-ui";
import type { CourierMapPoint, WithoutLoc } from "./couriers-map-client";
import { CouriersMapDynamic } from "./couriers-map-dynamic";
import { isTrackingEnabledGlobally } from "@/lib/portal-chat-settings";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "خريطة المندوبين والمجهزين والموظفين — أبو الأكبر للتوصيل",
};

export default async function AdminCouriersMapPage() {
  const trackingEnabled = await isTrackingEnabledGlobally();

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

  let points: CourierMapPoint[] = couriers
    .filter((c) => c.lastCourierLat != null && c.lastCourierLng != null && Number.isFinite(c.lastCourierLat) && Number.isFinite(c.lastCourierLng))
    .map((c) => ({
      id: c.id, name: c.name, phone: c.phone, lat: c.lastCourierLat as number, lng: c.lastCourierLng as number,
      updatedAt: c.lastCourierLocationAt?.toISOString() ?? null, type: "courier"
    }));

  points = points.concat(preparers
    .filter((p) => p.lastPreparerLat != null && p.lastPreparerLng != null && Number.isFinite(p.lastPreparerLat) && Number.isFinite(p.lastPreparerLng))
    .map((p) => ({
      id: p.id, name: p.name, phone: p.phone, lat: p.lastPreparerLat as number, lng: p.lastPreparerLng as number,
      updatedAt: p.lastPreparerLocationAt?.toISOString() ?? null, type: "preparer"
    })));

  points = points.concat(staffEmployees
    .filter((s) => s.lastStaffLat != null && s.lastStaffLng != null && Number.isFinite(s.lastStaffLat) && Number.isFinite(s.lastStaffLng))
    .map((s) => ({
      id: s.id, name: s.name, phone: s.phone, lat: s.lastStaffLat as number, lng: s.lastStaffLng as number,
      updatedAt: s.lastStaffLocationAt?.toISOString() ?? null, type: "employee"
    })));

  const withoutLoc: WithoutLoc[] = [
    ...couriers.filter(c => c.lastCourierLat == null || c.lastCourierLng == null).map(c => ({ id: c.id, name: c.name, phone: c.phone, typeName: "مندوب", type: "courier" as const })),
    ...preparers.filter(p => p.lastPreparerLat == null || p.lastPreparerLng == null).map(p => ({ id: p.id, name: p.name, phone: p.phone, typeName: "مجهز", type: "preparer" as const })),
    ...staffEmployees.filter(s => s.lastStaffLat == null || s.lastStaffLng == null).map(s => ({ id: s.id, name: s.name, phone: s.phone, typeName: "موظف", type: "employee" as const })),
  ];

  return (
    <div className="space-y-6" dir="rtl">
      <p className={ad.muted}>
        <Link href="/abo1stor3hlaa2kbr8-47/couriers" className={ad.link}>
          ← المندوبين
        </Link>
      </p>
      <div>
        <h1 className={ad.h1}>خريطة مواقع المندوبين، المجهزين والموظفين</h1>
        {!trackingEnabled && (
          <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-xl text-red-800 font-bold">
            ⚠️ تتبع المواقع معطل حالياً من الإعدادات العامة.
          </div>
        )}
        <p className={`mt-2 max-w-3xl ${ad.lead}`}>
          تُعرض المواقع الحالية للمندوبين، المجهزين والموظفين على الخريطة. يمكنك طلب تحديث موقع أي شخص في أي وقت وسيقوم هاتفه بسحب موقعه وإرساله فوراً.
        </p>
      </div>

      <section className={ad.section}>
        <h2 className={ad.h2}>الخريطة التفاعلية</h2>
        <div className="mt-4">
          <CouriersMapDynamic points={points} initialWithoutLoc={withoutLoc} trackingEnabled={trackingEnabled} />
        </div>
      </section>
    </div>
  );
}
