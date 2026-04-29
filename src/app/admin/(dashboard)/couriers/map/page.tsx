import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { ad } from "@/lib/admin-ui";
import type { CourierMapPoint } from "./couriers-map-client";
import { CouriersMapDynamic } from "./couriers-map-dynamic";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "خريطة المواقع — أبو الأكبر للتوصيل",
};

export default async function AdminCouriersMapPage() {
  const couriers = await prisma.courier.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true, phone: true, lastCourierLat: true, lastCourierLng: true, lastCourierLocationAt: true },
  });

  const preparers = await prisma.companyPreparer.findMany({
    where: { active: true },
    select: { id: true, name: true, phone: true, lastPreparerLat: true, lastPreparerLng: true, lastPreparerLocationAt: true }
  });

  const staff = await prisma.staffEmployee.findMany({
    where: { active: true },
    select: { id: true, name: true, phone: true, lastStaffLat: true, lastStaffLng: true, lastStaffLocationAt: true }
  });

  const employees = await prisma.employee.findMany({
    select: { id: true, name: true, phone: true, lastEmployeeLat: true, lastEmployeeLng: true, lastEmployeeLocationAt: true }
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

  points = points.concat(staff
    .filter((s) => s.lastStaffLat != null && s.lastStaffLng != null && Number.isFinite(s.lastStaffLat) && Number.isFinite(s.lastStaffLng))
    .map((s) => ({
      id: s.id, name: s.name, phone: s.phone, lat: s.lastStaffLat as number, lng: s.lastStaffLng as number,
      updatedAt: s.lastStaffLocationAt?.toISOString() ?? null, type: "staff"
    })));

  points = points.concat(employees
    .filter((e) => e.lastEmployeeLat != null && e.lastEmployeeLng != null && Number.isFinite(e.lastEmployeeLat) && Number.isFinite(e.lastEmployeeLng))
    .map((e) => ({
      id: e.id, name: e.name, phone: e.phone, lat: e.lastEmployeeLat as number, lng: e.lastEmployeeLng as number,
      updatedAt: e.lastEmployeeLocationAt?.toISOString() ?? null, type: "employee"
    })));

  const withoutLoc = [
    ...couriers.filter(c => c.lastCourierLat == null || c.lastCourierLng == null).map(c => ({...c, typeName: "مندوب"})),
    ...preparers.filter(p => p.lastPreparerLat == null || p.lastPreparerLng == null).map(p => ({...p, typeName: "مجهز"})),
    ...staff.filter(s => s.lastStaffLat == null || s.lastStaffLng == null).map(s => ({...s, typeName: "موظف إدارة"})),
    ...employees.filter(e => e.lastEmployeeLat == null || e.lastEmployeeLng == null).map(e => ({...e, typeName: "موظف محل"}))
  ];

  return (
    <div className="space-y-6" dir="rtl">
      <p className={ad.muted}>
        <Link href="/admin/couriers" className={ad.link}>
          ← المندوبين
        </Link>
      </p>
      <div>
        <h1 className={ad.h1}>خريطة مواقع جميع المستخدمين</h1>
        <p className={`mt-2 max-w-3xl ${ad.lead}`}>
          تُحدَّث المواقع عندما يفتح المندوب، أو المجهز، أو الموظف رابط لوحته
          ويمنح المتصفح إذن الموقع؛ يُرسل الموقع كل ~20 ثانية طالما تبقى الصفحة مفتوحة.
        </p>
      </div>

      <section className={ad.section}>
        <h2 className={ad.h2}>الخريطة</h2>
        <div className="mt-4">
          <CouriersMapDynamic points={points} />
        </div>
      </section>

      {withoutLoc.length > 0 ? (
        <section className={`${ad.section} border-amber-200 bg-amber-50/40`}>
          <h2 className={ad.h2}>مستخدمون بلا موقع بعد</h2>
          <ul className={`${ad.listDivide} mt-3`}>
            {withoutLoc.map((c) => (
              <li key={c.id} className="py-2">
                <span className="font-bold text-slate-800">{c.name}</span>
                <span className="text-xs mr-2 px-2 py-0.5 bg-white border border-slate-200 rounded-md text-slate-600">{c.typeName}</span>
                <span className="text-slate-500"> — {c.phone}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
