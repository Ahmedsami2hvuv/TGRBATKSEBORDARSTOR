"use client";

import dynamic from "next/dynamic";
import type { CourierMapPoint, WithoutLoc } from "./couriers-map-client";

const CouriersMapClient = dynamic(
  () => import("./couriers-map-client").then((m) => m.CouriersMapClient),
  {
    ssr: false,
    loading: () => (
      <p className="py-12 text-center text-slate-500 font-bold">جارٍ تحميل الخريطة…</p>
    ),
  },
);

export function CouriersMapDynamic({ points, initialWithoutLoc, trackingEnabled }: { points: CourierMapPoint[], initialWithoutLoc: WithoutLoc[], trackingEnabled: boolean }) {
  return <CouriersMapClient points={points} initialWithoutLoc={initialWithoutLoc} trackingEnabled={trackingEnabled} />;
}
