"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import type { Map as LeafletMap, CircleMarker } from "leaflet";
import "leaflet/dist/leaflet.css";

export type CourierMapPoint = {
  id: string;
  name: string;
  phone: string;
  lat: number;
  lng: number;
  updatedAt: string | null;
  type: "courier" | "preparer" | "employee";
};

type WithoutLoc = {
  id: string;
  name: string;
  phone: string;
  typeName: string;
  type: "courier" | "preparer" | "employee";
};

const SECRET_ADMIN_PATH = "/abo1stor3hlaa2kbr8-47";

export function CouriersMapClient({ points: initialPoints, trackingEnabled }: { points: CourierMapPoint[], trackingEnabled: boolean }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const markersRef = useRef<{ [key: string]: CircleMarker }>({});
  
  const [points, setPoints] = useState<CourierMapPoint[]>(initialPoints);
  const [withoutLoc, setWithoutLoc] = useState<WithoutLoc[]>([]);
  const [lastSync, setLastSync] = useState<Date>(new Date());
  const [isSyncing, setIsSyncing] = useState(false);
  const [requestingId, setRequestingId] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // تحديث العلامات على الخريطة
  const updateMarkers = useCallback((newPoints: CourierMapPoint[], L: any) => {
    if (!mapRef.current) return;
    const map = mapRef.current;

    // إزالة العلامات التي لم تعد موجودة في النقاط الجديدة
    const newPointIds = new Set(newPoints.map(p => p.id));
    Object.keys(markersRef.current).forEach(id => {
      if (!newPointIds.has(id)) {
        markersRef.current[id].remove();
        delete markersRef.current[id];
      }
    });

    for (const p of newPoints) {
      let color = "#0284c7"; // courier (blue)
      let fillColor = "#38bdf8";
      let typeLabel = "مندوب";

      if (p.type === "preparer") {
        color = "#d97706"; // amber
        fillColor = "#fbbf24";
        typeLabel = "مجهز";
      } else if (p.type === "employee") {
        color = "#7c3aed"; // purple
        fillColor = "#a78bfa";
        typeLabel = "موظف";
      }

      const when = p.updatedAt
        ? new Date(p.updatedAt).toLocaleString("ar-IQ-u-nu-latn", {
            dateStyle: "short",
            timeStyle: "short",
          })
        : "—";

      const popupContent = `<div dir="rtl" style="min-width:160px;font-family:system-ui,sans-serif;text-align:right">
            <strong style="font-size:14px;color:#1e293b">${escapeHtml(p.name)}</strong> 
            <span style="font-size:10px;background:#f1f5f9;padding:2px 6px;border-radius:4px;font-weight:bold;margin-right:4px">${typeLabel}</span><br/>
            <span style="font-size:12px;color:#475569;display:block;margin-top:4px">📞 ${escapeHtml(p.phone)}</span>
            <span style="font-size:11px;color:#64748b;display:block;margin-top:4px;border-top:1px solid #e2e8f0;padding-top:4px">آخر تحديث: ${escapeHtml(when)}</span>
          </div>`;

      if (markersRef.current[p.id]) {
        markersRef.current[p.id].setLatLng([p.lat, p.lng]);
        markersRef.current[p.id].setPopupContent(popupContent);
      } else {
        const m = L.circleMarker([p.lat, p.lng], {
          radius: 12,
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

  // جلب البيانات من السيرفر
  const fetchPointsFromServer = useCallback(async () => {
    setIsSyncing(true);
    try {
      const res = await fetch(`/api${SECRET_ADMIN_PATH}/couriers/map-points`);
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
  }, [updateMarkers]);

  // تهيئة الخريطة عند تحميل المكون
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

      // جلب القائمة الكاملة للأشخاص بلا موقع عند البداية
      void fetchPointsFromServer();
    });

    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
      markersRef.current = {};
    };
  }, []);

  // دالة سحب الموقع عند نقر الزر
  const handleRequestLocation = async (userId: string, userType: "courier" | "preparer" | "employee", userName: string) => {
    setRequestingId(userId);
    setStatusMessage(`جارٍ إرسال طلب سحب الموقع إلى ${userName}...`);
    
    try {
      const res = await fetch("/api/admin/request-location", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, userType })
      });

      if (res.ok) {
        setStatusMessage(`تم إرسال الطلب! بانتظار استجابة هاتف ${userName}...`);
        
        // تفعيل تحديث سريع متكرر كل 3 ثوانٍ ولمدة 24 ثانية لسحب الموقع الجديد فور تحديثه
        let count = 0;
        const interval = setInterval(async () => {
          count++;
          await fetchPointsFromServer();
          if (count >= 8) {
            clearInterval(interval);
            setRequestingId(null);
            setStatusMessage(null);
          }
        }, 3000);
      } else {
        const data = await res.json();
        setStatusMessage(`⚠️ فشل الطلب: ${data.error || "خطأ غير معروف"}`);
        setTimeout(() => {
          setRequestingId(null);
          setStatusMessage(null);
        }, 4000);
      }
    } catch (e) {
      setStatusMessage("⚠️ فشل الاتصال بالسيرفر لإرسال الطلب.");
      setTimeout(() => {
        setRequestingId(null);
        setStatusMessage(null);
      }, 4000);
    }
  };

  // تصفية وعرض القائمة الكاملة للأشخاص المتصلين لتسهيل سحب الموقع
  const allUsersList = [
    ...points.map(p => ({ id: p.id, name: p.name, phone: p.phone, type: p.type, hasLoc: true, updatedAt: p.updatedAt })),
    ...withoutLoc.map(w => ({ id: w.id, name: w.name, phone: w.phone, type: w.type, hasLoc: false, updatedAt: null }))
  ].sort((a, b) => a.name.localeCompare(b.name, "ar"));

  return (
    <div className="space-y-4">
      {statusMessage && (
        <div className="p-3 bg-sky-50 border border-sky-200 text-sky-900 rounded-xl font-bold text-sm animate-pulse flex items-center justify-between">
          <span>{statusMessage}</span>
          <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-sky-800 border-t-transparent" />
        </div>
      )}

      <div className="flex items-center justify-between text-xs font-bold text-slate-500">
        <button 
          onClick={() => void fetchPointsFromServer()} 
          disabled={isSyncing}
          className="px-3 py-1 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-lg transition active:scale-95 disabled:opacity-50"
        >
          🔄 تحديث الخريطة يدوياً
        </button>
        <span className="flex items-center gap-2">
          {isSyncing && <span className="inline-block h-2.5 w-2.5 animate-pulse rounded-full bg-emerald-500" />}
          آخر تحديث: {lastSync.toLocaleTimeString("ar-IQ-u-nu-latn")}
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* الخريطة */}
        <div className="lg:col-span-2 relative">
          <div
            ref={containerRef}
            className="z-0 h-[min(70vh,560px)] w-full rounded-2xl border border-sky-200 bg-sky-50/40 shadow-sm"
            dir="ltr"
          />
          {points.length === 0 && !isSyncing ? (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-2xl bg-white/80 px-4 text-center text-slate-600 font-bold">
              لا توجد علامات مواقع مسجّلة على الخريطة حالياً. انقر على "سحب الموقع" لأي شخص في القائمة الجانبية لجلب موقعه.
            </div>
          ) : null}
        </div>

        {/* القائمة الجانبية لسحب المواقع */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm flex flex-col h-[min(70vh,560px)]">
          <h3 className="text-sm font-black text-slate-800 border-b pb-2 mb-3">قائمة المندوبين، المجهزين والموظفين</h3>
          <div className="overflow-y-auto flex-1 space-y-2 pr-1">
            {allUsersList.length === 0 ? (
              <p className="text-center py-8 text-slate-400 text-xs">لا يوجد مستخدمون مسجلون في النظام.</p>
            ) : (
              allUsersList.map((user) => {
                let typeLabel = "مندوب";
                let badgeClass = "bg-sky-50 text-sky-700 border-sky-200";
                if (user.type === "preparer") {
                  typeLabel = "مجهز";
                  badgeClass = "bg-amber-50 text-amber-700 border-amber-200";
                } else if (user.type === "employee") {
                  typeLabel = "موظف";
                  badgeClass = "bg-purple-50 text-purple-700 border-purple-200";
                }

                const when = user.updatedAt
                  ? new Date(user.updatedAt).toLocaleTimeString("ar-IQ-u-nu-latn", { hour: "2-digit", minute: "2-digit" })
                  : null;

                return (
                  <div key={user.id} className="p-3 border rounded-xl bg-slate-50 hover:bg-slate-100/70 transition flex items-center justify-between gap-2 text-xs">
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5">
                        <span className="font-black text-slate-800">{user.name}</span>
                        <span className={`text-[9px] px-1.5 py-0.5 border rounded-md font-bold ${badgeClass}`}>{typeLabel}</span>
                      </div>
                      <p className="text-slate-500 text-[11px]">{user.phone}</p>
                      {user.hasLoc ? (
                        <p className="text-emerald-600 text-[10px] font-bold">📍 متوفر (آخر تحديث: {when})</p>
                      ) : (
                        <p className="text-rose-500 text-[10px] font-bold">❌ لا يوجد موقع حالي</p>
                      )}
                    </div>

                    <button
                      onClick={() => handleRequestLocation(user.id, user.type, user.name)}
                      disabled={requestingId !== null}
                      className="px-2.5 py-1.5 bg-sky-600 hover:bg-sky-700 text-white rounded-lg font-bold shadow-sm transition active:scale-95 disabled:opacity-50 disabled:pointer-events-none"
                    >
                      {requestingId === user.id ? "جاري السحب..." : "سحب الموقع"}
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
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
