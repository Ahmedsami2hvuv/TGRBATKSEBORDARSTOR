"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Map as LeafletMap, LatLngExpression } from "leaflet";
import "leaflet/dist/leaflet.css";
import { extractLatLngFromLocationInput } from "@/lib/order-location";

const STORAGE_KEY_PREFIX = "mandoub-order-route-settings";

type LocationPoint = {
  lat: number;
  lng: number;
  label: string;
  description: string;
  color: string;
};

type Props = {
  orderNumber: number;
  shopLocationUrl: string;
  customerLocationUrl: string;
  secondCustomerLocationUrl: string;
  routeMode: string | null | undefined;
  courierLat: number | null;
  courierLng: number | null;
};

function formatDistance(meters: number | null) {
  if (meters == null || !Number.isFinite(meters)) return "—";
  if (meters >= 1000) return `${(meters / 1000).toFixed(1)} كم`;
  return `${Math.round(meters)} م`;
}

function formatDuration(seconds: number | null) {
  if (seconds == null || !Number.isFinite(seconds)) return "—";
  const minutes = Math.round(seconds / 60);
  if (minutes >= 60) {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `${h} س ${m} د`;
  }
  return `${minutes} د`;
}

function bearingBetween(lat1: number, lng1: number, lat2: number, lng2: number) {
  const rad = Math.PI / 180;
  const y = Math.sin((lng2 - lng1) * rad) * Math.cos(lat2 * rad);
  const x =
    Math.cos(lat1 * rad) * Math.sin(lat2 * rad) -
    Math.sin(lat1 * rad) * Math.cos(lat2 * rad) * Math.cos((lng2 - lng1) * rad);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

function createArrowIcon(L: typeof import("leaflet"), angle: number) {
  return L.divIcon({
    html: `<div style="font-size:14px;line-height:1;transform:rotate(${angle}deg);color:#0f766e;">➤</div>`,
    className: "route-arrow-icon",
    iconSize: [18, 18],
    iconAnchor: [9, 9],
  });
}

function buildLocationPoints(props: Props): LocationPoint[] {
  const points: LocationPoint[] = [];
  const shopLoc = extractLatLngFromLocationInput(props.shopLocationUrl);
  const customerLoc = extractLatLngFromLocationInput(props.customerLocationUrl);
  const secondLoc = extractLatLngFromLocationInput(props.secondCustomerLocationUrl);

  if (props.courierLat != null && props.courierLng != null) {
    points.push({
      lat: props.courierLat,
      lng: props.courierLng,
      label: "المندوب الآن",
      description: "آخر موقع مسجل للمندوب",
      color: "#0f766e",
    });
  }

  if (shopLoc) {
    points.push({
      lat: shopLoc.latitude,
      lng: shopLoc.longitude,
      label: "المحل",
      description: "موقع المحل على الخريطة",
      color: "#2563eb",
    });
  }

  if (customerLoc) {
    points.push({
      lat: customerLoc.latitude,
      lng: customerLoc.longitude,
      label: "الزبون",
      description: "وجهة التسليم الأساسية",
      color: "#0ea5e9",
    });
  }

  if (props.routeMode === "double" && secondLoc) {
    points.push({
      lat: secondLoc.latitude,
      lng: secondLoc.longitude,
      label: "المستلم",
      description: "الوجهة الثانية للطلب",
      color: "#f97316",
    });
  }

  return points;
}

export function MandoubOrderRouteMap(props: Props) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const [routeStatus, setRouteStatus] = useState("جارٍ تجهيز الخريطة...");
  const [routeDistance, setRouteDistance] = useState<number | null>(null);
  const [routeDuration, setRouteDuration] = useState<number | null>(null);
  const [showArrows, setShowArrows] = useState(true);
  const [voiceGuidance, setVoiceGuidance] = useState(false);
  const [issue, setIssue] = useState<string | null>(null);
  const [lastSpokenRoute, setLastSpokenRoute] = useState<string | null>(null);

  const points = useMemo(() => buildLocationPoints(props), [props]);
  const origin = useMemo(() => {
    if (props.courierLat != null && props.courierLng != null) {
      return { lat: props.courierLat, lng: props.courierLng };
    }
    const shopLoc = extractLatLngFromLocationInput(props.shopLocationUrl);
    return shopLoc ? { lat: shopLoc.latitude, lng: shopLoc.longitude } : null;
  }, [props.courierLat, props.courierLng, props.shopLocationUrl]);

  const primaryDestination = useMemo(() => {
    const customerLoc = extractLatLngFromLocationInput(props.customerLocationUrl);
    if (customerLoc) return { lat: customerLoc.latitude, lng: customerLoc.longitude, label: "الزبون" };
    if (props.routeMode === "double") {
      const secondLoc = extractLatLngFromLocationInput(props.secondCustomerLocationUrl);
      if (secondLoc) return { lat: secondLoc.latitude, lng: secondLoc.longitude, label: "المستلم" };
    }
    return null;
  }, [props.customerLocationUrl, props.secondCustomerLocationUrl, props.routeMode]);

  const localStorageKey = `${STORAGE_KEY_PREFIX}:${props.orderNumber}`;

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(localStorageKey);
      if (saved) {
        const parsed = JSON.parse(saved) as { showArrows?: boolean; voiceGuidance?: boolean };
        if (typeof parsed.showArrows === "boolean") setShowArrows(parsed.showArrows);
        if (typeof parsed.voiceGuidance === "boolean") setVoiceGuidance(parsed.voiceGuidance);
      }
    } catch {
      // ignore
    }
  }, [localStorageKey]);

  useEffect(() => {
    try {
      window.localStorage.setItem(localStorageKey, JSON.stringify({ showArrows, voiceGuidance }));
    } catch {
      // ignore
    }
  }, [showArrows, voiceGuidance, localStorageKey]);

  useEffect(() => {
    if (!mapContainerRef.current) return;
    let cancelled = false;
    let routeLayer: any = null;
    const arrowMarkers: any[] = [];

    const initializeMap = async () => {
      setIssue(null);
      setRouteStatus("جارٍ تحميل خريطة OpenStreetMap...");
      const L = await import("leaflet");
      if (cancelled || !mapContainerRef.current) return;

      mapRef.current?.remove();
      const map = L.map(mapContainerRef.current, {
        zoomControl: false,
        attributionControl: false,
      });
      mapRef.current = map;
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: "© OpenStreetMap",
      }).addTo(map);

      const markers: any[] = [];
      const bounds: any[] = [];

      for (const point of points) {
        const marker = L.circleMarker([point.lat, point.lng] as LatLngExpression, {
          radius: 10,
          color: point.color,
          fillColor: point.color,
          fillOpacity: 0.85,
          weight: 2,
        }).addTo(map);
        marker.bindPopup(`<div dir="rtl" style="font-family:system-ui,sans-serif;min-width:120px"><strong>${point.label}</strong><br/><span style="font-size:12px;color:#334155">${point.description}</span></div>`);
        markers.push(marker);
        bounds.push([point.lat, point.lng]);
      }

      if (bounds.length > 0) {
        map.fitBounds(bounds as [number, number][], { padding: [22, 22], maxZoom: 15 });
      }

      if (!origin) {
        setIssue("لا يوجد نقطة بداية صالحة؛ تأكد من تسجيل موقع المندوب أو إضافة موقع المحل.");
        setRouteStatus("لم يتم العثور على مسار.");
        return;
      }

      if (!primaryDestination) {
        setIssue("لا يوجد لوكيشن زبون صالح لعرض المسار.");
        setRouteStatus("لم يتم العثور على مسار.");
        return;
      }

      setRouteStatus("جارٍ حساب المسار... يمكنك الانتظار قليلاً.");
      const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${origin.lng},${origin.lat};${primaryDestination.lng},${primaryDestination.lat}?overview=full&geometries=geojson&steps=false&annotations=duration,distance`;

      try {
        const response = await fetch(osrmUrl);
        if (!response.ok) {
          throw new Error(`OSRM ${response.status}`);
        }
        const data = await response.json();
        const route = data?.routes?.[0];
        if (!route || !route.geometry?.coordinates || !Array.isArray(route.geometry.coordinates)) {
          throw new Error("تعذر قراءة المسار من الخادم.");
        }

        const coords = route.geometry.coordinates.map((pair: [number, number]) => [pair[1], pair[0]] as [number, number]);
        setRouteDistance(route.distance);
        setRouteDuration(route.duration);

        routeLayer = L.polyline(coords, {
          color: "#0f766e",
          weight: 6,
          opacity: 0.85,
          dashArray: showArrows ? "16,12" : undefined,
          lineJoin: "round",
        }).addTo(map);

        if (showArrows) {
          for (let i = 0; i + 1 < coords.length; i += Math.max(1, Math.floor(coords.length / 10))) {
            const [latA, lngA] = coords[i];
            const [latB, lngB] = coords[i + 1];
            const angle = bearingBetween(latA, lngA, latB, lngB);
            const arr = L.marker([latA, lngA], {
              icon: createArrowIcon(L, angle),
              interactive: false,
            }).addTo(map);
            arrowMarkers.push(arr);
          }
        }

        const routeBounds = L.latLngBounds(coords as [number, number][]);
        const allBounds = bounds.length > 0 ? routeBounds.extend(bounds as [number, number][]) : routeBounds;
        map.fitBounds(allBounds, { padding: [22, 22], maxZoom: 15 });

        setRouteDistance(route.distance);
        setRouteDuration(route.duration);
        setRouteStatus("المسار جاهز.");

        if (voiceGuidance) {
          const message = `الطريق إلى ${primaryDestination.label} ${formatDistance(route.distance)}، تقريباً ${formatDuration(route.duration)}.`;
          if (message !== lastSpokenRoute) {
            window.speechSynthesis.cancel();
            window.speechSynthesis.speak(new SpeechSynthesisUtterance(message));
            setLastSpokenRoute(message);
          }
        }
      } catch (error) {
        console.error("Route fetch error", error);
        setIssue("تعذر الحصول على مسار. يرجى المحاولة لاحقاً أو استخدام تطبيق الخرائط المحلي.");
        setRouteStatus("فشل في تحميل المسار.");
      }
    };

    void initializeMap();

    return () => {
      cancelled = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
      arrowMarkers.forEach((marker) => marker.remove && marker.remove());
      if (routeLayer && routeLayer.remove) routeLayer.remove();
    };
  }, [origin, primaryDestination, points, showArrows, voiceGuidance, lastSpokenRoute]);

  return (
    <div className="space-y-3" dir="rtl">
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_max-content]">
        <div className="grid gap-2 rounded-2xl border border-slate-200 bg-white p-3 text-sm text-slate-700 shadow-sm">
          <div className="flex flex-wrap items-center gap-2">
            <strong className="font-black text-slate-900">حالة المسار</strong>
            <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600">{routeStatus}</span>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <div>
              <p className="text-[11px] uppercase tracking-[.18em] text-slate-500">المسافة</p>
              <p className="font-black text-slate-900">{formatDistance(routeDistance)}</p>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-[.18em] text-slate-500">الوقت المتوقع</p>
              <p className="font-black text-slate-900">{formatDuration(routeDuration)}</p>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setShowArrows((prev) => !prev)}
            className="inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-black text-slate-700 shadow-sm hover:bg-slate-50"
          >
            {showArrows ? "إخفاء الأسهم" : "إظهار الأسهم"}
          </button>
          <button
            type="button"
            onClick={() => setVoiceGuidance((prev) => !prev)}
            className="inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-black text-slate-700 shadow-sm hover:bg-slate-50"
          >
            {voiceGuidance ? "إيقاف الصوت" : "تشغيل التوجيه الصوتي"}
          </button>
        </div>
      </div>

      {issue ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{issue}</div>
      ) : null}

      <div className="h-[340px] overflow-hidden rounded-3xl border border-slate-200 bg-slate-100" ref={mapContainerRef} dir="ltr" />

      <div className="grid gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700 sm:grid-cols-2">
        {points.map((point) => (
          <div key={`${point.label}-${point.lat}-${point.lng}`}>
            <p className="text-xs uppercase tracking-[.18em] text-slate-500">{point.label}</p>
            <p className="font-black text-slate-900">{point.description}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
