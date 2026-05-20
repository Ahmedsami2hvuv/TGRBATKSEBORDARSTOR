"use client";

import { useEffect, useRef } from "react";
import type { Map as LeafletMap } from "leaflet";
import "leaflet/dist/leaflet.css";

export type CourierMapPoint = {
  id: string;
  name: string;
  phone: string;
  lat: number;
  lng: number;
  updatedAt: string | null;
  type: "courier" | "preparer";
};

export function CouriersMapClient({ points }: { points: CourierMapPoint[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    let cancelled = false;

    void import("leaflet").then((L) => {
      if (cancelled || !containerRef.current) return;
      const el = containerRef.current;

      const map = L.map(el).setView([33.3152, 44.3661], 11);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: "© OpenStreetMap",
      }).addTo(map);
      mapRef.current = map;

      const markers: ReturnType<typeof L.circleMarker>[] = [];
      for (const p of points) {
        let color = "#0369a1"; // courier (blue)
        let fillColor = "#38bdf8";
        let typeLabel = "مندوب";

        if (p.type === "preparer") {
          color = "#b45309"; // amber
          fillColor = "#fbbf24";
          typeLabel = "مجهز";
        }

        const m = L.circleMarker([p.lat, p.lng], {
          radius: 11,
          color,
          weight: 2,
          fillColor,
          fillOpacity: 0.85,
        }).addTo(map);
        const when = p.updatedAt
          ? new Date(p.updatedAt).toLocaleString("ar-IQ-u-nu-latn", {
              dateStyle: "short",
              timeStyle: "short",
            })
          : "—";
        m.bindPopup(
          `<div dir="rtl" style="min-width:140px;font-family:system-ui,sans-serif">
            <strong>${escapeHtml(p.name)}</strong> <span style="font-size:11px;background:#eee;padding:2px 4px;border-radius:4px">${typeLabel}</span><br/>
            <span style="font-size:12px;opacity:.85">${escapeHtml(p.phone)}</span><br/>
            <span style="font-size:11px;color:#64748b">آخر تحديث: ${escapeHtml(when)}</span>
          </div>`,
        );
        markers.push(m);
      }

      if (markers.length > 0) {
        const b = L.featureGroup(markers).getBounds();
        map.fitBounds(b.pad(0.15));
      }
    });

    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [points]);

  return (
    <div className="relative">
      <div
        ref={containerRef}
        className="z-0 h-[min(70vh,560px)] w-full rounded-xl border border-sky-200 bg-sky-50/40"
        dir="ltr"
      />
      {points.length === 0 ? (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-xl bg-white/80 px-4 text-center text-slate-600">
          لا توجد مواقع مسجّلة بعد. افتح رابط المندوب أو المجهز، وامنح إذن الموقع، ثم يبقى الموقع يُرسل كل ~20 ثانية.
        </div>
      ) : null}
    </div>
  );
}

function escapeHtml(s: string): string {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
