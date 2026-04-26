"use client";

import dynamic from "next/dynamic";
import type { CourierMapPoint } from "./couriers-map-client";

const CouriersMapClient = dynamic(
  () => import("./couriers-map-client").then((m) => m.CouriersMapClient),
  {
    ssr: false,
    loading: () => (
      <p className="py-12 text-center text-slate-500">جارٍ تحميل الخريطة…</p>
    ),
  },
);

export function CouriersMapDynamic({ points }: { points: CourierMapPoint[] }) {
  return <CouriersMapClient points={points} />;
}
