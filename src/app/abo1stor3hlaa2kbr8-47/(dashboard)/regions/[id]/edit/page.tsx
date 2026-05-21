import Link from "next/link";
import { notFound } from "next/navigation";
import { dinarDecimalToAlfInputString } from "@/lib/money-alf";
import { prisma } from "@/lib/prisma";
import { ad } from "@/lib/admin-ui";
import { RegionEditForm } from "./edit-form";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export default async function EditRegionPage({ params }: Props) {
  const { id } = await params;
  const region = await prisma.region.findUnique({
    where: { id },
  });
  if (!region) {
    notFound();
  }

  /** منفصل عن Region لتجنب تعطل الصفحة إذا لم يُطبَّق جدول RegionWaypoint بعد. */
  let waypoints: Array<{ name: string; latitude: number; longitude: number }> = [];
  let waypointsTableMissing = false;
  try {
    const rows = await prisma.regionWaypoint.findMany({
      where: { regionId: id },
      orderBy: { sortOrder: "asc" },
      select: { name: true, latitude: true, longitude: true },
    });
    waypoints = rows.map((w) => ({
      name: w.name,
      latitude: w.latitude,
      longitude: w.longitude,
    }));
  } catch {
    waypointsTableMissing = true;
  }

  const priceStr = dinarDecimalToAlfInputString(region.deliveryPrice);

  return (
    <div className="space-y-6">
      <p className={ad.muted}>
        <Link href="/abo1stor3hlaa2kbr8-47/regions" className={ad.link}>
          ← العودة للمناطق
        </Link>
      </p>
      <div>
        <h1 className={ad.h1}>تعديل المنطقة</h1>
        <p className={`mt-1 ${ad.lead}`}>{region.name}</p>
      </div>
      {waypointsTableMissing ? (
        <div
          role="alert"
          className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950"
        >
          <p className="font-bold">تحديث قاعدة البيانات لم يُطبَّق بعد على هذا السيرفر.</p>
          <p className="mt-1">
            جدول مداخل المناطق غير جاهز؛ بعد إعادة نشر التطبيق يُنفَّذ التحديث تلقائيًا عند التشغيل.
            إذا استمرت المشكلة، من يدير السيرفر يشغّل مرة واحدة:{" "}
            <code className="rounded bg-amber-100 px-1 py-0.5 text-xs">npm run db:migrate:deploy</code>
          </p>
        </div>
      ) : null}
      <section className={ad.section}>
        <RegionEditForm
          id={region.id}
          defaultName={region.name}
          defaultPrice={priceStr}
          defaultWaypoints={waypoints}
          waypointsPersistDisabled={waypointsTableMissing}
        />
      </section>
    </div>
  );
}
