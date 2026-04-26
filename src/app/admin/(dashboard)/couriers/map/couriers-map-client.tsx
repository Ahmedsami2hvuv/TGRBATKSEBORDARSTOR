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
};

export function CouriersMapClient({ points }: { points: CourierMapPoint[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);

  useEffect(() => {
    if (points.length === 0) return;
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
        const m = L.circleMarker([p.lat, p.lng], {
          radius: 11,
          color: "#0369a1",
          weight: 2,
          fillColor: "#38bdf8",
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
            <strong>${escapeHtml(p.name)}</strong><br/>
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

  if (points.length === 0) {
    return (
      <div
        className="flex min-h-[280px] items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-slate-600"
        dir="rtl"
      >
        لا توجد مواقع مسجّلة بعد. عندما يفتح المندوب رابط لوحته ويمنح إذن الموقع، يُرسل الموقع كل ~20
        ثانية طالما تبقى الصفحة مفتوحة.
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="z-0 h-[min(70vh,560px)] w-full rounded-xl border border-sky-200 bg-sky-50/40"
      dir="ltr"
    />
  );
}

function escapeHtml(s: string): string {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
