import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { ad } from "@/lib/admin-ui";
import type { CourierMapPoint } from "./couriers-map-client";
import { CouriersMapDynamic } from "./couriers-map-dynamic";
import { isTrackingEnabledGlobally } from "@/lib/portal-chat-settings";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "خريطة المندوبين والمجهزين — أبو الأكبر للتوصيل",
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

  return (
    <div className="space-y-6" dir="rtl">
      <p className={ad.muted}>
        <Link href="/admin/couriers" className={ad.link}>
          ← المندوبين
        </Link>
      </p>
      <div>
        <h1 className={ad.h1}>خريطة مواقع المندوبين والمجهزين</h1>
        {!trackingEnabled && (
          <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-xl text-red-800 font-bold">
            ⚠️ التتبع معطل حالياً من الإعدادات العامة. الخريطة لن تُحدّث تلقائياً.
          </div>
        )}
        <p className={`mt-2 max-w-3xl ${ad.lead}`}>
          تُحدَّث مواقع المندوبين والمجهزين فقط عندما يفتح المندوب أو المجهز رابط لوحته ويمنح
          المتصفح إذن الموقع؛ يُرسل الموقع كل ~20 ثانية طالما تبقى الصفحة مفتوحة.
        </p>
      </div>

      <section className={ad.section}>
        <h2 className={ad.h2}>الخريطة</h2>
        <div className="mt-4">
          <CouriersMapDynamic points={points} trackingEnabled={trackingEnabled} />
        </div>
      </section>
    </div>
  );
}
