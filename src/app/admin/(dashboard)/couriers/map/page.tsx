import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { ad } from "@/lib/admin-ui";
import type { CourierMapPoint } from "./couriers-map-client";
import { CouriersMapDynamic } from "./couriers-map-dynamic";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "خريطة المندوبين — أبو الأكبر للتوصيل",
};

export default async function AdminCouriersMapPage() {
  const couriers = await prisma.courier.findMany({
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      phone: true,
      lastCourierLat: true,
      lastCourierLng: true,
      lastCourierLocationAt: true,
    },
  });

  const points: CourierMapPoint[] = couriers
    .filter(
      (c) =>
        c.lastCourierLat != null &&
        c.lastCourierLng != null &&
        Number.isFinite(c.lastCourierLat) &&
        Number.isFinite(c.lastCourierLng),
    )
    .map((c) => ({
      id: c.id,
      name: c.name,
      phone: c.phone,
      lat: c.lastCourierLat as number,
      lng: c.lastCourierLng as number,
      updatedAt: c.lastCourierLocationAt?.toISOString() ?? null,
    }));

  const withoutLoc = couriers.filter(c => c.lastCourierLat == null || c.lastCourierLng == null);

  return (
    <div className="space-y-6" dir="rtl">
      <p className={ad.muted}>
        <Link href="/admin/couriers" className={ad.link}>
          ← المندوبين
        </Link>
      </p>
      <div>
        <h1 className={ad.h1}>خريطة مواقع المندوبين</h1>
        <p className={`mt-2 max-w-3xl ${ad.lead}`}>
          تُحدَّث المواقع عندما يفتح المندوب رابط لوحته (<code className="rounded bg-slate-100 px-1">/mandoub</code>{" "}
          مع رابط موقّع) ويمنح المتصفح إذن الموقع؛ يُرسل الموقع كل ~20 ثانية طالما تبقى الصفحة مفتوحة.
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
          <h2 className={ad.h2}>مندوبون بلا موقع بعد</h2>
          <ul className={`${ad.listDivide} mt-3`}>
            {withoutLoc.map((c) => (
              <li key={c.id} className="py-2">
                <span className="font-bold text-slate-800">{c.name}</span>
                <span className="text-slate-500"> — {c.phone}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
