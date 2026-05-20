"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import type { Map as LeafletMap, Marker, CircleMarker } from "leaflet";
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

type WithoutLoc = {
  id: string;
  name: string;
  phone: string;
  typeName: string;
};

export function CouriersMapClient({ points: initialPoints }: { points: CourierMapPoint[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const markersRef = useRef<{ [key: string]: CircleMarker }>({});
  const [points, setPoints] = useState(initialPoints);
  const [withoutLoc, setWithoutLoc] = useState<WithoutLoc[]>([]);
  const [lastSync, setLastSync] = useState<Date>(new Date());
  const [isSyncing, setIsSyncing] = useState(false);

  const updateMarkers = useCallback((newPoints: CourierMapPoint[], L: any) => {
    if (!mapRef.current) return;
    const map = mapRef.current;

    // Remove markers that are no longer in points
    const newPointIds = new Set(newPoints.map(p => p.id));
    Object.keys(markersRef.current).forEach(id => {
      if (!newPointIds.has(id)) {
        markersRef.current[id].remove();
        delete markersRef.current[id];
      }
    });

    for (const p of newPoints) {
      let color = "#0369a1"; // courier (blue)
      let fillColor = "#38bdf8";
      let typeLabel = "مندوب";

      if (p.type === "preparer") {
        color = "#b45309"; // amber
        fillColor = "#fbbf24";
        typeLabel = "مجهز";
      }

      const when = p.updatedAt
        ? new Date(p.updatedAt).toLocaleString("ar-IQ-u-nu-latn", {
            dateStyle: "short",
            timeStyle: "short",
          })
        : "—";

      const popupContent = `<div dir="rtl" style="min-width:140px;font-family:system-ui,sans-serif">
            <strong>${escapeHtml(p.name)}</strong> <span style="font-size:11px;background:#eee;padding:2px 4px;border-radius:4px">${typeLabel}</span><br/>
            <span style="font-size:12px;opacity:.85">${escapeHtml(p.phone)}</span><br/>
            <span style="font-size:11px;color:#64748b">آخر تحديث: ${escapeHtml(when)}</span>
          </div>`;

      if (markersRef.current[p.id]) {
        markersRef.current[p.id].setLatLng([p.lat, p.lng]);
        markersRef.current[p.id].setPopupContent(popupContent);
      } else {
        const m = L.circleMarker([p.lat, p.lng], {
          radius: 11,
          color,
          weight: 2,
          fillColor,
          fillOpacity: 0.85,
        }).addTo(map);
        m.bindPopup(popupContent);
        markersRef.current[p.id] = m;
      }
    }
  }, []);

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

      updateMarkers(points, L);

      const markers = Object.values(markersRef.current);
      if (markers.length > 0) {
        const b = L.featureGroup(markers).getBounds();
        map.fitBounds(b.pad(0.15));
      }
    });

    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
      markersRef.current = {};
    };
  }, []);

  useEffect(() => {
    const interval = setInterval(async () => {
      setIsSyncing(true);
      try {
        const res = await fetch("/api/admin/couriers/map-points");
        if (res.ok) {
          const data = await res.json();
          setPoints(data.points);
          setWithoutLoc(data.withoutLoc);
          setLastSync(new Date());
          const L = await import("leaflet");
          updateMarkers(data.points, L);
        }
      } catch (e) {
        console.error("Failed to sync map points", e);
      } finally {
        setIsSyncing(false);
      }
    }, 15000);

    return () => clearInterval(interval);
  }, [updateMarkers]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between text-xs font-bold text-slate-500">
        <span>تحديث تلقائي كل 15 ثانية</span>
        <span className="flex items-center gap-2">
          {isSyncing && <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-emerald-500" />}
          آخر مزامنة: {lastSync.toLocaleTimeString("ar-IQ-u-nu-latn")}
        </span>
      </div>
      <div className="relative">
        <div
          ref={containerRef}
          className="z-0 h-[min(70vh,560px)] w-full rounded-xl border border-sky-200 bg-sky-50/40"
          dir="ltr"
        />
        {points.length === 0 && !isSyncing ? (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-xl bg-white/80 px-4 text-center text-slate-600">
            لا توجد مواقع مسجّلة بعد. افتح رابط المندوب أو المجهز، وامنح إذن الموقع، ثم يبقى الموقع يُرسل كل ~20 ثانية.
          </div>
        ) : null}
      </div>

      {withoutLoc.length > 0 && (
        <section className="rounded-xl border border-amber-200 bg-amber-50/40 p-4">
          <h2 className="text-sm font-black text-amber-900">مندوبون ومجهزون بلا موقع بعد</h2>
          <ul className="mt-2 divide-y divide-amber-100">
            {withoutLoc.map((c) => (
              <li key={c.id} className="py-2 flex items-center gap-2">
                <span className="font-bold text-slate-800">{c.name}</span>
                <span className="text-[10px] px-2 py-0.5 bg-white border border-slate-200 rounded-md text-slate-600">{c.typeName}</span>
                <span className="text-slate-500 text-xs"> — {c.phone}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
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

function escapeHtml(s: string): string {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
