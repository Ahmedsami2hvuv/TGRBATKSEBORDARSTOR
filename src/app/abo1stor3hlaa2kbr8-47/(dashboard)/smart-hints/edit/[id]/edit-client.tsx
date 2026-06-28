"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { updateSmartHintAction } from "../../actions";

interface Waypoint {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  radiusMeters: number;
  polygonCoords?: any;
}

let leafletPromise: Promise<any> | null = null;

function loadLeaflet(): Promise<any> {
  if (leafletPromise) return leafletPromise;

  leafletPromise = new Promise((resolve) => {
    if (typeof window === "undefined") {
      resolve(null);
      return;
    }

    if ((window as any).L) {
      resolve((window as any).L);
      return;
    }

    // تحميل الـ CSS
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
    document.head.appendChild(link);

    // تحميل الـ JS
    const script = document.createElement("script");
    script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
    script.onload = () => {
      const L = (window as any).L;
      delete L.Icon.Default.prototype._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
        iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
      });
      resolve(L);
    };
    script.onerror = () => {
      resolve(null);
    };
    document.head.appendChild(script);
  });

  return leafletPromise;
}

function parseLatLngLocal(input: string): { latitude: number; longitude: number } | null {
  const clean = input.replace(/[()]/g, "").trim();
  const parts = clean.split(/[,\s]+/);
  if (parts.length >= 2) {
    const lat = parseFloat(parts[0]);
    const lng = parseFloat(parts[1]);
    if (!isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
      return { latitude: lat, longitude: lng };
    }
  }
  return null;
}

function polygonCoordsToString(coords: Array<{ latitude: number; longitude: number }>): string {
  if (!coords || !Array.isArray(coords)) return "";
  return coords.map(c => `${c.latitude.toFixed(6)}, ${c.longitude.toFixed(6)}`).join("\n");
}

function parsePolygonCoordsString(str: string): Array<{ latitude: number; longitude: number }> {
  const lines = str.split(/[\n;]+/);
  const parsed: Array<{ latitude: number; longitude: number }> = [];
  for (const line of lines) {
    const clean = line.trim();
    if (!clean) continue;
    const parts = clean.split(/[,\s]+/);
    if (parts.length >= 2) {
      const lat = parseFloat(parts[0]);
      const lng = parseFloat(parts[1]);
      if (!isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
        parsed.push({ latitude: lat, longitude: lng });
      }
    }
  }
  return parsed;
}

function getDefaultMapCenter(): { latitude: number; longitude: number } {
  if (typeof window !== "undefined") {
    try {
      const saved = localStorage.getItem("last_map_center");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed.latitude === "number" && typeof parsed.longitude === "number") {
          return parsed;
        }
      }
    } catch (e) {
      console.error(e);
    }
  }
  return { latitude: 30.5082, longitude: 47.7835 };
}

function getDistanceToSegment(
  p: { latitude: number; longitude: number },
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number }
): number {
  const x = p.latitude;
  const y = p.longitude;
  const x1 = a.latitude;
  const y1 = a.longitude;
  const x2 = b.latitude;
  const y2 = b.longitude;

  const A = x - x1;
  const B = y - y1;
  const C = x2 - x1;
  const D = y2 - y1;

  const dot = A * C + B * D;
  const lenSq = C * C + D * D;
  let param = -1;
  
  if (lenSq !== 0) {
    param = dot / lenSq;
  }

  let xx, yy;

  if (param < 0) {
    xx = x1;
    yy = y1;
  } else if (param > 1) {
    xx = x2;
    yy = y2;
  } else {
    xx = x1 + param * C;
    yy = y1 + param * D;
  }

  const dx = x - xx;
  const dy = y - yy;
  return Math.sqrt(dx * dx + dy * dy);
}

function findBestInsertIndex(
  clickPt: { latitude: number; longitude: number },
  points: Array<{ latitude: number; longitude: number }>
): number {
  if (points.length < 3) return points.length;

  let minDistance = Infinity;
  let bestInsertIndex = points.length;

  for (let i = 0; i < points.length; i++) {
    const p1 = points[i];
    const p2 = points[(i + 1) % points.length];

    const dist = getDistanceToSegment(clickPt, p1, p2);
    if (dist < minDistance) {
      minDistance = dist;
      bestInsertIndex = i + 1;
    }
  }

  return bestInsertIndex;
}

export default function EditSmartHintClient({ waypoint }: { waypoint: Waypoint }) {
  const router = useRouter();

  // جلب البيانات الأولية للاستدلال
  const [name, setName] = useState(waypoint.name);
  const isInitialPolygon = waypoint.polygonCoords && Array.isArray(waypoint.polygonCoords) && waypoint.polygonCoords.length >= 3;
  const [coords, setCoords] = useState(
    isInitialPolygon && waypoint.polygonCoords
      ? polygonCoordsToString(waypoint.polygonCoords as any[])
      : `${waypoint.latitude.toFixed(6)}, ${waypoint.longitude.toFixed(6)}`
  );
  const [radiusMeters, setRadiusMeters] = useState(waypoint.radiusMeters || 100);
  const [hintType, setHintType] = useState<"circle" | "polygon">(isInitialPolygon ? "polygon" : "circle");
  const [polygonCoords, setPolygonCoords] = useState<Array<{ latitude: number; longitude: number }>>(
    isInitialPolygon ? (waypoint.polygonCoords as any[]) : []
  );

  const [errorMsg, setErrorMsg] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");

  const nameInputRef = useRef<HTMLInputElement>(null);
  const coordsInputRef = useRef<HTMLInputElement>(null);

  // الخرائط
  const mapRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const circleRef = useRef<any>(null);
  const polyRef = useRef<any>(null);
  const polyMarkersRef = useRef<any[]>([]);

  // مرجع لتخزين أحدث نقاط المضلع النشطة لتفادي مشكلة ثبات الخطوط عند السحب
  const activePointsRef = useRef<Array<{ latitude: number; longitude: number }>>(
    isInitialPolygon ? (waypoint.polygonCoords as any[]) : []
  );

  // تهيئة الخريطة وتحديثها
  const initMap = async (elementId: string, lat: number, lng: number) => {
    const L = await loadLeaflet();
    if (!L) return;

    if (mapRef.current) {
      mapRef.current.remove();
      mapRef.current = null;
      markerRef.current = null;
      circleRef.current = null;
      polyRef.current = null;
      polyMarkersRef.current = [];
    }

    const container = document.getElementById(elementId);
    if (!container) return;

    const map = L.map(elementId, {
      zoomControl: true,
      scrollWheelZoom: true
    }).setView([lat, lng], 17);

    // قمر صناعي
    L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", {
      attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS'
    }).addTo(map);

    // حفظ آخر موقع خريطة تم الوصول إليه
    map.on("moveend", () => {
      const center = map.getCenter();
      try {
        localStorage.setItem("last_map_center", JSON.stringify({ latitude: center.lat, longitude: center.lng }));
      } catch (e) {
        console.error(e);
      }
    });

    mapRef.current = map;

    // مستمع نقر الخريطة لوضع وتحديث المواقع تلقائياً
    map.on("click", (e: any) => {
      const clickedLat = e.latlng.lat;
      const clickedLng = e.latlng.lng;

      if (hintType === "circle") {
        setCoords(`${clickedLat.toFixed(6)}, ${clickedLng.toFixed(6)}`);
        const marker = markerRef.current;
        const circle = circleRef.current;

        if (marker && circle) {
          marker.setLatLng([clickedLat, clickedLng]);
          circle.setLatLng([clickedLat, clickedLng]);
        } else {
          const newMarker = L.marker([clickedLat, clickedLng], { draggable: true }).addTo(map);
          const newCircle = L.circle([clickedLat, clickedLng], {
            color: "#2563eb",
            fillColor: "#3b82f6",
            fillOpacity: 0.15,
            radius: radiusMeters
          }).addTo(map);

          newMarker.on("dragend", () => {
            const position = newMarker.getLatLng();
            newCircle.setLatLng(position);
            setCoords(`${position.lat.toFixed(6)}, ${position.lng.toFixed(6)}`);
          });

          markerRef.current = newMarker;
          circleRef.current = newCircle;
        }
      } else {
        const offset = 0.0004;
        const newPoints = [
          { latitude: clickedLat + offset, longitude: clickedLng - offset },
          { latitude: clickedLat + offset, longitude: clickedLng + offset },
          { latitude: clickedLat - offset, longitude: clickedLng + offset },
          { latitude: clickedLat - offset, longitude: clickedLng - offset },
        ];
        setPolygonCoords(newPoints);
        activePointsRef.current = newPoints;
        renderPolygon(L, map, newPoints);
        setCoords(polygonCoordsToString(newPoints));
      }
    });

    // وضع الدائرة الابتدائي
    if (hintType === "circle") {
      const marker = L.marker([lat, lng], { draggable: true }).addTo(map);
      const circle = L.circle([lat, lng], {
        color: "#2563eb",
        fillColor: "#3b82f6",
        fillOpacity: 0.15,
        radius: radiusMeters
      }).addTo(map);

      marker.on("dragend", () => {
        const position = marker.getLatLng();
        circle.setLatLng(position);
        setCoords(`${position.lat.toFixed(6)}, ${position.lng.toFixed(6)}`);
      });

      markerRef.current = marker;
      circleRef.current = circle;
    } 
    // وضع المضلع الابتدائي
    else {
      const initialPoints = polygonCoords.length >= 3 
        ? polygonCoords
        : [
            { latitude: lat + 0.0004, longitude: lng - 0.0004 },
            { latitude: lat + 0.0004, longitude: lng + 0.0004 },
            { latitude: lat - 0.0004, longitude: lng + 0.0004 },
            { latitude: lat - 0.0004, longitude: lng - 0.0004 },
          ];

      setPolygonCoords(initialPoints);
      activePointsRef.current = initialPoints;
      renderPolygon(L, map, initialPoints);
    }

    setTimeout(() => {
      map.invalidateSize();
    }, 200);
  };

  // رسم المضلع والزوايا
  const renderPolygon = (L: any, map: any, points: Array<{ latitude: number; longitude: number }>) => {
    if (polyRef.current) map.removeLayer(polyRef.current);
    polyMarkersRef.current.forEach((m) => map.removeLayer(m));
    polyMarkersRef.current = [];

    activePointsRef.current = points;
    const latLngs = points.map((p) => [p.latitude, p.longitude]);

    const polygon = L.polygon(latLngs, {
      color: "#f59e0b",
      fillColor: "#fbbf24",
      fillOpacity: 0.25,
      weight: 3,
      interactive: false
    }).addTo(map);

    polyRef.current = polygon;

    points.forEach((pt, index) => {
      const icon = L.divIcon({
        className: "bg-amber-500 border-2 border-white rounded-full w-5 h-5 shadow-lg cursor-pointer flex items-center justify-center text-[10px] text-white font-bold",
        html: `${index + 1}`,
        iconSize: [20, 20],
        iconAnchor: [10, 10]
      });

      const marker = L.marker([pt.latitude, pt.longitude], {
        draggable: true,
        icon: icon
      }).addTo(map);

      marker.on("drag", () => {
        const pos = marker.getLatLng();
        activePointsRef.current[index] = { latitude: pos.lat, longitude: pos.lng };
        polygon.setLatLngs(activePointsRef.current.map((p) => [p.latitude, p.longitude]));
        setPolygonCoords([...activePointsRef.current]);
      });

      marker.on("dragend", () => {
        const pos = marker.getLatLng();
        activePointsRef.current[index] = { latitude: pos.lat, longitude: pos.lng };
        setPolygonCoords([...activePointsRef.current]);
        setCoords(polygonCoordsToString(activePointsRef.current));
      });

      marker.on("click", (e: any) => {
        L.DomEvent.stopPropagation(e);
        const current = activePointsRef.current;
        if (current.length <= 3) {
          alert("لا يمكن أن يقل المضلع السكني عن 3 زوايا!");
          return;
        }

        const popupDelContent = document.createElement("div");
        popupDelContent.className = "p-2 text-center space-y-2 dark:text-slate-200";
        popupDelContent.dir = "rtl";
        popupDelContent.innerHTML = `
          <p class="text-xs font-bold text-slate-700 dark:text-slate-350">هل تريد إزالة هذه الزاوية؟</p>
          <div class="flex gap-2 justify-center mt-1">
            <button id="leaflet-del-btn" class="bg-rose-500 hover:bg-rose-600 text-white text-[11px] font-bold px-3 py-1.5 rounded-lg shadow-sm transition active:scale-95">نعم، احذف</button>
            <button id="leaflet-del-close-btn" class="bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[11px] font-bold px-3 py-1.5 rounded-lg transition active:scale-95">إلغاء</button>
          </div>
        `;

        L.popup()
          .setLatLng(marker.getLatLng())
          .setContent(popupDelContent)
          .openOn(map);

        setTimeout(() => {
          const delBtn = document.getElementById("leaflet-del-btn");
          const delCloseBtn = document.getElementById("leaflet-del-close-btn");

          delBtn?.addEventListener("click", () => {
            const updated = activePointsRef.current.filter((_, i) => i !== index);
            setPolygonCoords(updated);
            activePointsRef.current = updated;
            renderPolygon(L, map, updated);
            setCoords(polygonCoordsToString(updated));
            map.closePopup();
          });

          delCloseBtn?.addEventListener("click", () => {
            map.closePopup();
          });
        }, 50);
      });

      polyMarkersRef.current.push(marker);
    });
  };

  // إضافة زاوية
  const addPoint = () => {
    const L = (window as any).L;
    if (!L || !mapRef.current) return;

    const current = activePointsRef.current.length > 0 ? activePointsRef.current : polygonCoords;
    if (current.length === 0) return;

    const last = current[current.length - 1];
    const newPt = { latitude: last.latitude + 0.0002, longitude: last.longitude + 0.0002 };
    const updated = [...current, newPt];

    setPolygonCoords(updated);
    activePointsRef.current = updated;
    renderPolygon(L, mapRef.current, updated);
    setCoords(polygonCoordsToString(updated));
  };

  // تقليل زاوية
  const removePoint = () => {
    const L = (window as any).L;
    if (!L || !mapRef.current) return;

    const current = activePointsRef.current.length > 0 ? activePointsRef.current : polygonCoords;
    if (current.length <= 3) {
      alert("لا يمكن أن يقل المضلع السكني عن 3 زوايا!");
      return;
    }

    const updated = current.slice(0, -1);
    setPolygonCoords(updated);
    activePointsRef.current = updated;
    renderPolygon(L, mapRef.current, updated);
    setCoords(polygonCoordsToString(updated));
  };

  const updateMapRadius = (radius: number) => {
    if (circleRef.current) {
      circleRef.current.setRadius(radius);
    }
  };

  const updateMapPosition = (lat: number, lng: number) => {
    if (mapRef.current && hintType === "circle" && markerRef.current && circleRef.current) {
      const pos = [lat, lng];
      mapRef.current.setView(pos, mapRef.current.getZoom());
      markerRef.current.setLatLng(pos);
      circleRef.current.setLatLng(pos);
    }
  };

  const coordsParsed = parseLatLngLocal(coords) || (polygonCoords.length > 0 ? polygonCoords[0] : null);

  // توليد مضلع تلقائي للتعديل عند تبديل النوع إلى polygon
  useEffect(() => {
    if (hintType === "polygon" && polygonCoords.length === 0) {
      const center = parseLatLngLocal(coords) || { latitude: 30.5082, longitude: 47.7835 };
      const offset = 0.0005; // حوالي 50 متر
      const defaultPoly = [
        { latitude: center.latitude + offset, longitude: center.longitude - offset },
        { latitude: center.latitude + offset, longitude: center.longitude + offset },
        { latitude: center.latitude - offset, longitude: center.longitude + offset },
        { latitude: center.latitude - offset, longitude: center.longitude - offset },
      ];
      setPolygonCoords(defaultPoly);
      activePointsRef.current = defaultPoly;
      setCoords(polygonCoordsToString(defaultPoly));
    }
  }, [hintType]);

  useEffect(() => {
    const center = coordsParsed || getDefaultMapCenter();
    initMap("edit-full-map", center.latitude, center.longitude);
    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        markerRef.current = null;
        circleRef.current = null;
        polyRef.current = null;
        polyMarkersRef.current = [];
      }
    };
  }, [hintType]);

  useEffect(() => {
    if (coordsParsed && mapRef.current && hintType === "circle") {
      updateMapPosition(coordsParsed.latitude, coordsParsed.longitude);
    }
  }, [coords]);

  useEffect(() => {
    if (mapRef.current && hintType === "circle") {
      updateMapRadius(radiusMeters);
    }
  }, [radiusMeters]);

  // حفظ التعديلات
  const handleSubmit = async () => {
    if (!name.trim() || !coords.trim()) {
      setErrorMsg("يرجى ملء جميع الحقول المطلوبة");
      return;
    }

    setIsSubmitting(true);
    setErrorMsg("");
    setSuccessMsg("");

    try {
      const polyToSend = hintType === "polygon" ? polygonCoords : null;
      const res = await updateSmartHintAction(waypoint.id, name, coords, radiusMeters, polyToSend);
      if (res.success) {
        setSuccessMsg("تم تعديل وحفظ الاستدلال بنجاح!");
        setTimeout(() => {
          router.push("/abo1stor3hlaa2kbr8-47/smart-hints/list");
          router.refresh();
        }, 1200);
      }
    } catch (err: any) {
      setErrorMsg(err.message || "حدث خطأ غير متوقع أثناء الحفظ");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#09090b] p-6 flex flex-col justify-between" dir="rtl">
      <div className="space-y-6">
        
        {/* رأس الصفحة */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white dark:bg-[#0f1115] border border-slate-200 dark:border-slate-800 p-5 rounded-3xl shadow-sm">
          <div>
            <h1 className="text-2xl font-black text-slate-800 dark:text-slate-100 flex items-center gap-2">
              ✏️ تعديل الاستدلال الذكي ({waypoint.name})
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              تحديث إحداثيات ومربعات الاستدلال السكنية بدقة على خريطة القمر الصناعي
            </p>
          </div>
          <Link
            href="/abo1stor3hlaa2kbr8-47/smart-hints/list"
            className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131418] text-slate-700 dark:text-slate-200 font-bold hover:bg-slate-50 dark:hover:bg-slate-900 transition active:scale-95 text-sm shadow-sm"
          >
            🔙 العودة لقائمة الاستدلالات
          </Link>
        </div>

        {/* عمودين */}
        <div className="flex flex-col lg:flex-row gap-6">
          
          {/* الأيمن */}
          <div className="w-full lg:w-4/12 bg-white dark:bg-[#0f1115] border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm space-y-5">
            
            {/* اختيار نوع النطاق */}
            <div>
              <label className="block text-xs font-bold text-slate-400 mb-2">اختر طريقة التحديد الجغرافي</label>
              <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 dark:bg-slate-900/60 rounded-xl">
                <button
                  type="button"
                  onClick={() => setHintType("circle")}
                  className={`py-3 text-xs font-bold rounded-lg transition ${
                    hintType === "circle"
                      ? "bg-white dark:bg-[#18181b] text-sky-600 shadow-sm"
                      : "text-slate-500"
                  }`}
                >
                  📍 نطاق دائري (دبوس)
                </button>
                <button
                  type="button"
                  onClick={() => setHintType("polygon")}
                  className={`py-3 text-xs font-bold rounded-lg transition ${
                    hintType === "polygon"
                      ? "bg-white dark:bg-[#18181b] text-amber-600 shadow-sm"
                      : "text-slate-500"
                  }`}
                >
                  🟩 مربع سكني (مضلع)
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1.5">
                اسم المدخل (مثال: جسر ابو فلوس)
              </label>
              <input
                ref={nameInputRef}
                type="text"
                placeholder="اكتب اسم المدخل واضغط Enter"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && coordsInputRef.current?.focus()}
                disabled={isSubmitting}
                className="w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#09090b] px-4 py-3 text-sm outline-none focus:border-sky-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1.5">
                {hintType === "polygon" 
                  ? "📍 إحداثيات زوايا المربع السكني (كل سطر: خط العرض, خط الطول)" 
                  : "📍 الصق الإحداثية لتحديث الموضع (مثال: 30.4410, 48.0137)"}
              </label>
              {hintType === "polygon" ? (
                <textarea
                  rows={5}
                  placeholder={"30.4410, 48.0137\n30.4420, 48.0138\n..."}
                  value={coords}
                  onChange={(e) => {
                    const val = e.target.value;
                    setCoords(val);
                    const parsed = parsePolygonCoordsString(val);
                    if (parsed.length >= 3) {
                      setPolygonCoords(parsed);
                      activePointsRef.current = parsed;
                      const L = (window as any).L;
                      if (mapRef.current && L) {
                        renderPolygon(L, mapRef.current, parsed);
                      }
                    }
                  }}
                  disabled={isSubmitting}
                  className="w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#09090b] px-4 py-3 text-xs outline-none focus:border-sky-500 font-mono"
                />
              ) : (
                <input
                  ref={coordsInputRef}
                  type="text"
                  placeholder="الصق الإحداثية لتحديث الخريطة"
                  value={coords}
                  onChange={(e) => setCoords(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                  disabled={isSubmitting}
                  className="w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#09090b] px-4 py-3 text-sm outline-none focus:border-sky-500"
                />
              )}
            </div>

            {coordsParsed && hintType === "circle" && (
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1.5 flex justify-between">
                  <span>📏 مسافة التغطية: {radiusMeters} متر</span>
                  <span className="text-slate-400"> اسحب لتغيير الحجم</span>
                </label>
                <input
                  type="range"
                  min="10"
                  max="500"
                  step="5"
                  value={radiusMeters}
                  onChange={(e) => setRadiusMeters(parseInt(e.target.value))}
                  disabled={isSubmitting}
                  className="w-full h-2 bg-slate-200 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-sky-600"
                />
              </div>
            )}

            {coordsParsed && hintType === "polygon" && (
              <div className="text-xs text-amber-600 dark:text-amber-400 font-bold bg-amber-50 dark:bg-amber-950/20 p-4 rounded-2xl border border-amber-100 dark:border-amber-900/30 space-y-2">
                <div>💡 يمكنك سحب الدبابيس البرتقالية المرقمة على الخريطة لتعديل ورسم حدود المنطقة السكنية بدقة.</div>
                <div>استخدم الأزرار الموجودة بالأسفل لإضافة زوايا أو إنقاصها للتحكم الكامل.</div>
              </div>
            )}

            {errorMsg && (
              <div className="text-xs font-bold text-rose-600 bg-rose-50 dark:bg-rose-950/20 p-3.5 rounded-xl border border-rose-100 dark:border-rose-900/30">
                ⚠️ {errorMsg}
              </div>
            )}

            {successMsg && (
              <div className="text-xs font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/20 p-3.5 rounded-xl border border-emerald-100 dark:border-emerald-900/30">
                ✅ {successMsg}
              </div>
            )}

            <div className="pt-2">
              <button
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="w-full rounded-2xl bg-gradient-to-r from-sky-600 to-indigo-600 py-3.5 text-sm font-bold text-white transition hover:shadow-lg active:scale-95 disabled:opacity-50"
              >
                {isSubmitting ? "جاري الحفظ..." : "حفظ التعديلات"}
              </button>
            </div>
          </div>

          {/* الأيسر: الخريطة القمرية */}
          <div className="w-full lg:w-8/12 bg-white dark:bg-[#0f1115] border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm flex flex-col space-y-4">
            <div className="flex flex-col h-full justify-between">
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-2 flex justify-between items-center">
                  <span>🗺️ خريطة القمر الصناعي التفاعلية للبيوت والمباني</span>
                  {hintType === "polygon" && (
                    <span className="text-amber-500 text-xs font-black">عدد الزوايا الحالية: {polygonCoords.length}</span>
                  )}
                </label>
                <div
                  id="edit-full-map"
                  className="h-[550px] w-full rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-inner z-10"
                ></div>
              </div>

              {/* أزرار زيادة وتقليل النقاط */}
              {hintType === "polygon" && (
                <div className="flex gap-4 justify-center mt-4">
                  <button
                    type="button"
                    onClick={addPoint}
                    disabled={isSubmitting}
                    className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-2xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-sm shadow-md transition active:scale-95 disabled:opacity-50"
                  >
                    ➕ إضافة زاوية جديدة للمربع
                  </button>
                  <button
                    type="button"
                    onClick={removePoint}
                    disabled={isSubmitting}
                    className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-2xl bg-rose-500 hover:bg-rose-600 text-white font-bold text-sm shadow-md transition active:scale-95 disabled:opacity-50"
                  >
                    ➖ حذف آخر زاوية للمربع
                  </button>
                </div>
              )}

              {/* كروت عرض الإحداثيات الحية */}
              {hintType === "polygon" && polygonCoords.length > 0 && (
                <div className="mt-4 border-t border-slate-100 dark:border-slate-800/60 pt-4 space-y-3">
                  <label className="block text-xs font-bold text-slate-500">
                    📍 إحداثيات زوايا المربع السكني الحالي (تتحرك حياً ومباشرة أثناء تحريك الدبوس)
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                    {polygonCoords.map((pt, idx) => (
                      <div
                        key={idx}
                        className="bg-slate-50 dark:bg-[#0c0d10] border border-slate-200 dark:border-slate-850 rounded-xl p-3 flex items-center justify-between shadow-sm"
                      >
                        <div className="space-y-1">
                          <div className="text-[10px] font-black text-slate-400">الزاوية رقم {idx + 1}</div>
                          <div className="font-mono text-xs text-slate-700 dark:text-slate-355 font-bold space-y-0.5">
                            <div>خط العرض: {pt.latitude.toFixed(6)}</div>
                            <div>خط الطول: {pt.longitude.toFixed(6)}</div>
                          </div>
                        </div>
                        <span className="w-6 h-6 rounded-full bg-amber-500/10 text-amber-500 text-xs font-black flex items-center justify-center border border-amber-500/20">
                          {idx + 1}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
