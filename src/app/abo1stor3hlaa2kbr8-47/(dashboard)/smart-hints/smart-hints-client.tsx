"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { addSmartHintAction, deleteSmartHintAction } from "./actions";

interface Waypoint {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  radiusMeters: number;
  polygonCoords?: any;
  region?: {
    name: string;
  } | null;
}

interface ProcessedOrder {
  id: string;
  orderNumber: number;
  status: string;
  customerLocationUrl: string;
  customerLandmark: string | null;
  customerRegion: { name: string } | null;
  shop: { name: string } | null;
  createdAt: Date;
  hasLocation: boolean;
  statusText: string;
  nearestWaypoint: { name: string; regionName: string; distanceM: number } | null;
  distanceM: number | null;
  hintText: string;
}

interface SmartHintsClientProps {
  allWaypoints: Waypoint[];
  processedOrders: ProcessedOrder[];
  stats: {
    totalOrders: number;
    successfullyInferred: number;
    outOfRange: number;
    noLocation: number;
  };
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

export default function SmartHintsClient({
  allWaypoints: initialWaypoints,
  processedOrders,
  stats,
}: SmartHintsClientProps) {
  const [allWaypoints, setAllWaypoints] = useState<Waypoint[]>(initialWaypoints);
  const [isAddOpen, setIsAddOpen] = useState(false);

  // حقول النموذج الجديد
  const [newName, setNewName] = useState("");
  const [newCoords, setNewCoords] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // نوع الاستدلال الجديد: دائري أو مضلع
  const [hintType, setHintType] = useState<"circle" | "polygon">("circle");
  const [polygonCoords, setPolygonCoords] = useState<Array<{ latitude: number; longitude: number }>>([]);

  // للبحث والفلترة
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const nameInputRef = useRef<HTMLInputElement>(null);
  const coordsInputRef = useRef<HTMLInputElement>(null);

  // الخرائط
  const [mapRadius, setMapRadius] = useState(100);
  const mapRef = useRef<any>(null);
  const markerRef = useRef<any>(null); // الدبوس الفردي (للدائري)
  const circleRef = useRef<any>(null); // الدائرة (للدائري)
  
  const polyRef = useRef<any>(null); // المضلع (للمربعات السكنية)
  const polyMarkersRef = useRef<any[]>([]); // الدبابيس الفرعية لزوايا المضلع

  // مزامنة النقاط المحدثة من السيرفر
  useEffect(() => {
    setAllWaypoints(initialWaypoints);
  }, [initialWaypoints]);

  // إدارة الكيبورد - التركيز التلقائي عند فتح نافذة الإضافة
  useEffect(() => {
    if (isAddOpen) {
      setTimeout(() => nameInputRef.current?.focus(), 150);
    }
  }, [isAddOpen]);

  // تهيئة الخريطة وتحديثها
  const initMap = async (elementId: string, lat: number, lng: number) => {
    const L = await loadLeaflet();
    if (!L) return;

    // تنظيف تام للخريطة وأي عناصر سابقة
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
    }).setView([lat, lng], 16);

    // تحميل قمر صناعي Esri
    L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", {
      attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS'
    }).addTo(map);

    mapRef.current = map;

    // وضع الدائرة (النظام الدائري)
    if (hintType === "circle") {
      const marker = L.marker([lat, lng], { draggable: true }).addTo(map);
      const circle = L.circle([lat, lng], {
        color: "#2563eb",
        fillColor: "#3b82f6",
        fillOpacity: 0.15,
        radius: mapRadius
      }).addTo(map);

      marker.on("dragend", () => {
        const position = marker.getLatLng();
        circle.setLatLng(position);
        setNewCoords(`${position.lat.toFixed(6)}, ${position.lng.toFixed(6)}`);
      });

      markerRef.current = marker;
      circleRef.current = circle;
    } 
    // وضع المربعات والمضلعات السكنية
    else {
      // إعداد المضلع الأولي بالاعتماد على النقطة الأساسية كنواة مركزية
      const polyPoints = [
        { latitude: lat + 0.0006, longitude: lng - 0.0006 },
        { latitude: lat + 0.0006, longitude: lng + 0.0006 },
        { latitude: lat - 0.0006, longitude: lng + 0.0006 },
        { latitude: lat - 0.0006, longitude: lng - 0.0006 },
      ];
      setPolygonCoords(polyPoints);
      renderPolygon(L, map, polyPoints);
    }

    setTimeout(() => {
      map.invalidateSize();
    }, 200);
  };

  // رندرة ورسم المضلع وزواياه
  const renderPolygon = (L: any, map: any, points: Array<{ latitude: number; longitude: number }>) => {
    // إزالة المضلع والدبابيس السابقة
    if (polyRef.current) map.removeLayer(polyRef.current);
    polyMarkersRef.current.forEach((m) => map.removeLayer(m));
    polyMarkersRef.current = [];

    const latLngs = points.map((p) => [p.latitude, p.longitude]);

    // رسم المضلع باللون الأزرق الشفاف
    const polygon = L.polygon(latLngs, {
      color: "#f59e0b", // لون برتقالي جذاب للتمييز
      fillColor: "#fbbf24",
      fillOpacity: 0.25,
      weight: 3
    }).addTo(map);

    polyRef.current = polygon;

    // إضافة دبابيس صغيرة قابلة للسحب عند كل زاوية لتعديلها يدوياً
    points.forEach((pt, index) => {
      // استخدام أيقونة دبابيس زرقاء دائرية
      const icon = L.divIcon({
        className: "bg-amber-500 border-2 border-white rounded-full w-4 h-4 shadow-md cursor-pointer",
        iconSize: [16, 16]
      });

      const marker = L.marker([pt.latitude, pt.longitude], {
        draggable: true,
        icon: icon
      }).addTo(map);

      marker.on("drag", () => {
        const pos = marker.getLatLng();
        const updated = [...points];
        updated[index] = { latitude: pos.lat, longitude: pos.lng };
        
        // تحديث إحداثيات المضلع على الخريطة لحظياً أثناء السحب
        polygon.setLatLngs(updated.map((p) => [p.latitude, p.longitude]));
      });

      marker.on("dragend", () => {
        const pos = marker.getLatLng();
        const updated = [...points];
        updated[index] = { latitude: pos.lat, longitude: pos.lng };
        setPolygonCoords(updated);
      });

      polyMarkersRef.current.push(marker);
    });
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

  const coordsParsed = parseLatLngLocal(newCoords);

  useEffect(() => {
    if (isAddOpen && coordsParsed) {
      initMap("add-map", coordsParsed.latitude, coordsParsed.longitude);
    }
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
  }, [isAddOpen, !!coordsParsed, hintType]);

  useEffect(() => {
    if (isAddOpen && coordsParsed && mapRef.current && hintType === "circle") {
      updateMapPosition(coordsParsed.latitude, coordsParsed.longitude);
    }
  }, [newCoords]);

  useEffect(() => {
    if (isAddOpen && mapRef.current && hintType === "circle") {
      updateMapRadius(mapRadius);
    }
  }, [mapRadius]);

  // الضغط على Enter في حقل الاسم
  const handleNameKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      coordsInputRef.current?.focus();
    }
  };

  // الضغط على Enter في حقل الإحداثيات
  const handleCoordsKeyDown = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      await handleSubmit();
    }
  };

  // حفظ الاستدلال
  const handleSubmit = async () => {
    if (!newName.trim() || !newCoords.trim()) {
      setErrorMsg("يرجى ملء جميع الحقول المطلوبة");
      return;
    }

    setIsSubmitting(true);
    setErrorMsg("");

    try {
      // تمرير المضلع السكني كمعامل رابع إذا كان المود مضلع
      const polyToSend = hintType === "polygon" ? polygonCoords : null;
      const res = await addSmartHintAction(newName, newCoords, mapRadius, polyToSend);
      if (res.success) {
        setNewName("");
        setNewCoords("");
        setErrorMsg("");
        setMapRadius(100);
        setPolygonCoords([]);
        setTimeout(() => nameInputRef.current?.focus(), 50);
      }
    } catch (err: any) {
      setErrorMsg(err.message || "حدث خطأ غير متوقع أثناء الحفظ");
    } finally {
      setIsSubmitting(false);
    }
  };

  // حذف الاستدلال
  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`هل أنت متأكد من حذف النقطة (${name})؟`)) {
      return;
    }

    try {
      const res = await deleteSmartHintAction(id);
      if (res.success) {
        setAllWaypoints((prev) => prev.filter((wp) => wp.id !== id));
      }
    } catch (err: any) {
      alert(err.message || "حدث خطأ أثناء الحذف");
    }
  };

  // تصفية الطلبات المعروضة
  const filteredOrders = processedOrders.filter((order) => {
    if (statusFilter === "success") {
      if (order.statusText.includes("خارج النطاق") || order.statusText === "—") return false;
    } else if (statusFilter === "out_of_range") {
      if (!order.statusText.includes("خارج النطاق")) return false;
    } else if (statusFilter === "no_location") {
      if (order.statusText !== "—") return false;
    }

    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    return (
      order.orderNumber.toString().includes(term) ||
      (order.customerLandmark || "").toLowerCase().includes(term) ||
      (order.customerRegion?.name || "").toLowerCase().includes(term) ||
      (order.shop?.name || "").toLowerCase().includes(term) ||
      order.statusText.toLowerCase().includes(term) ||
      order.hintText.toLowerCase().includes(term)
    );
  });

  return (
    <div className="space-y-6 pb-12" dir="rtl">
      {/* رأس الصفحة */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-800 dark:text-slate-100 flex items-center gap-2">
            💡 لوحة الاستدلال الذكي للطلبات
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            مراقبة وتحليل الاستدلال الذكي التلقائي للطلبات في محيط 100 متر مستقل عن المنطقة
          </p>
        </div>

        {/* أزرار التحكم الفوقية */}
        <div className="flex flex-wrap gap-2 w-full md:w-auto">
          <Link
            href="/abo1stor3hlaa2kbr8-47/smart-hints/list"
            className="flex-1 md:flex-none inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131418] text-slate-700 dark:text-slate-200 font-bold hover:bg-slate-50 dark:hover:bg-slate-900 transition active:scale-95 text-sm"
          >
            🧭 عرض كل الاستدلالات ({allWaypoints.length})
          </Link>
          <button
            onClick={() => setIsAddOpen(true)}
            className="flex-1 md:flex-none inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-sky-600 to-indigo-600 text-white font-bold hover:shadow-lg hover:shadow-sky-500/20 transition active:scale-95 text-sm"
          >
            ➕ إضافة استدلال جديد
          </button>
        </div>
      </div>

      {/* الكروت الإحصائية */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white/80 dark:bg-[#131418]/80 backdrop-blur-md border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm">
          <div className="text-sm font-bold text-slate-500">إجمالي الطلبات النشطة</div>
          <div className="text-2xl font-black text-slate-800 dark:text-slate-100 mt-1">
            {stats.totalOrders}
          </div>
        </div>

        <button
          onClick={() => setStatusFilter("success")}
          className="text-start bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/40 rounded-2xl p-4 shadow-sm hover:scale-[1.02] transition"
        >
          <div className="text-sm font-bold text-emerald-700 dark:text-emerald-400">مستدل بنجاح (≤ 100م)</div>
          <div className="text-2xl font-black text-emerald-800 dark:text-emerald-300 mt-1">
            {stats.successfullyInferred}
          </div>
        </button>

        <button
          onClick={() => setStatusFilter("out_of_range")}
          className="text-start bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 rounded-2xl p-4 shadow-sm hover:scale-[1.02] transition"
        >
          <div className="text-sm font-bold text-amber-700 dark:text-amber-400">خارج النطاق (&gt; 100م)</div>
          <div className="text-2xl font-black text-amber-800 dark:text-amber-300 mt-1">
            {stats.outOfRange}
          </div>
        </button>

        <button
          onClick={() => setStatusFilter("no_location")}
          className="text-start bg-rose-50/50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/40 rounded-2xl p-4 shadow-sm hover:scale-[1.02] transition"
        >
          <div className="text-sm font-bold text-rose-700 dark:text-rose-400">بدون إحداثيات / لوكيشن</div>
          <div className="text-2xl font-black text-rose-800 dark:text-rose-300 mt-1">
            {stats.noLocation}
          </div>
        </button>
      </div>

      {/* البحث والتصفية للطلبات */}
      <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-white dark:bg-[#0f1115] rounded-2xl border border-slate-200 dark:border-slate-800 p-4">
        <div className="relative w-full md:max-w-md">
          <input
            type="text"
            placeholder="البحث برقم الطلب، المتجر، أو حالة الاستدلال..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#09090b] px-4 py-2.5 text-sm outline-none focus:border-sky-500"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm("")}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs"
            >
              ✕
            </button>
          )}
        </div>

        <div className="flex gap-2 w-full md:w-auto">
          {statusFilter !== "all" && (
            <button
              onClick={() => setStatusFilter("all")}
              className="px-4 py-2 text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-xl"
            >
              عرض الكل ✕
            </button>
          )}
          <span className="text-xs text-slate-400 self-center font-bold">
            عدد الصفوف المصفاة: {filteredOrders.length}
          </span>
        </div>
      </div>

      {/* جدول الطلبات واستدلالاتها */}
      <div className="bg-white dark:bg-[#0f1115] rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          {filteredOrders.length === 0 ? (
            <div className="p-12 text-center text-slate-400 font-bold">
              لا توجد طلبات تطابق الفلاتر المحددة حالياً.
            </div>
          ) : (
            <table className="w-full text-start border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400 font-bold bg-slate-50/50 dark:bg-slate-900/10">
                  <th className="p-3 text-start">رقم الطلب</th>
                  <th className="p-3 text-start">المحل</th>
                  <th className="p-3 text-start">المنطقة الأصلية للزبون</th>
                  <th className="p-3 text-start">حالة إحداثيات الطلب</th>
                  <th className="p-3 text-start">الاستدلال المحسوب (الأقرب)</th>
                  <th className="p-3 text-start">النتيجة النهائية للاستدلال</th>
                </tr>
              </thead>
              <tbody>
                {filteredOrders.map((order) => {
                  const isSuccess =
                    order.statusText !== "—" && !order.statusText.includes("خارج النطاق");
                  const isOutOfRange = order.statusText.includes("خارج النطاق");

                  return (
                    <tr
                      key={order.id}
                      className="border-b border-slate-100 dark:border-slate-800/40 hover:bg-slate-50/50 dark:hover:bg-slate-900/20"
                    >
                      <td className="p-3 font-bold text-slate-800 dark:text-slate-200">
                        #{order.orderNumber}
                      </td>
                      <td className="p-3 text-slate-600 dark:text-slate-300 font-bold">
                        {order.shop?.name || "—"}
                      </td>
                      <td className="p-3 text-slate-500">
                        {order.customerRegion?.name || "—"}
                      </td>
                      <td className="p-3">
                        {isSuccess ? (
                          <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/20 px-2 py-1 rounded-lg">
                            🟢 مستدل بنجاح ({Math.round(order.distanceM ?? 0)}م)
                          </span>
                        ) : isOutOfRange ? (
                          <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-600 bg-amber-50 dark:bg-amber-950/10 px-2 py-1 rounded-lg">
                            🟡 خارج النطاق ({Math.round(order.distanceM ?? 0)}م)
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs font-bold text-rose-600 bg-rose-50 dark:bg-rose-950/10 px-2 py-1 rounded-lg">
                            🔴 لا توجد إحداثيات
                          </span>
                        )}
                      </td>
                      <td className="p-3 font-mono text-slate-600 dark:text-slate-400 font-bold">
                        {order.nearestWaypoint ? (
                          <span className="text-slate-800 dark:text-slate-200">
                            {order.nearestWaypoint.name}{" "}
                            <span className="text-xs text-slate-400">
                              ({order.nearestWaypoint.regionName})
                            </span>
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="p-3 font-bold text-indigo-600 dark:text-indigo-400">
                        {order.hintText}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* نافذة إضافة استدلال جديد */}
      {isAddOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="relative w-full max-w-lg rounded-3xl bg-white dark:bg-[#0f1115] border border-slate-200 dark:border-slate-800 p-6 shadow-2xl animate-in zoom-in-95 duration-200 my-8">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-black text-slate-800 dark:text-slate-100">
                ➕ إضافة نقطة استدلال جديدة
              </h3>
              <button
                onClick={() => setIsAddOpen(false)}
                className="rounded-full bg-slate-100 dark:bg-slate-800 p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              {/* اختيار نوع النطاق الجغرافي */}
              <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 dark:bg-slate-900 rounded-xl">
                <button
                  type="button"
                  onClick={() => setHintType("circle")}
                  className={`py-2 text-xs font-bold rounded-lg transition ${
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
                  className={`py-2 text-xs font-bold rounded-lg transition ${
                    hintType === "polygon"
                      ? "bg-white dark:bg-[#18181b] text-amber-600 shadow-sm"
                      : "text-slate-500"
                  }`}
                >
                  🟩 مربع سكني (مضلع)
                </button>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">
                  اسم المدخل الجديد (مثال: جسر ابو فلوس أو بلوك 4)
                </label>
                <input
                  ref={nameInputRef}
                  type="text"
                  placeholder="اكتب اسم المدخل واضغط Enter"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={handleNameKeyDown}
                  disabled={isSubmitting}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#09090b] px-4 py-2.5 text-sm outline-none focus:border-sky-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">
                  الصق الإحداثية لتحديد المركز (مثال: 30.4410, 48.0137)
                </label>
                <input
                  ref={coordsInputRef}
                  type="text"
                  placeholder="الصق الإحداثية لتظهر الخريطة فوراً"
                  value={newCoords}
                  onChange={(e) => setNewCoords(e.target.value)}
                  onKeyDown={handleCoordsKeyDown}
                  disabled={isSubmitting}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#09090b] px-4 py-2.5 text-sm outline-none focus:border-sky-500"
                />
              </div>

              {coordsParsed && (
                <div className="space-y-4">
                  {hintType === "circle" ? (
                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1 flex justify-between">
                        <span>📏 مسافة التغطية: {mapRadius} متر</span>
                        <span className="text-slate-400"> اسحب لتغيير الحجم</span>
                      </label>
                      <input
                        type="range"
                        min="10"
                        max="500"
                        step="5"
                        value={mapRadius}
                        onChange={(e) => setMapRadius(parseInt(e.target.value))}
                        disabled={isSubmitting}
                        className="w-full h-2 bg-slate-200 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-sky-600"
                      />
                    </div>
                  ) : (
                    <div className="text-xs text-amber-600 dark:text-amber-400 font-bold bg-amber-50 dark:bg-amber-950/20 p-2.5 rounded-xl border border-amber-100 dark:border-amber-900/30">
                      💡 اسحب الدوائر البرتقالية الصغيرة على خريطة القمر الصناعي لتشكيل وتعديل حدود المربع السكني بدقة حول البيوت.
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">
                      🗺️ تموضع الاستدلال على الخريطة
                    </label>
                    <div
                      id="add-map"
                      className="h-60 w-full rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-inner z-10"
                    ></div>
                  </div>
                </div>
              )}

              {errorMsg && (
                <div className="text-xs font-bold text-rose-600 bg-rose-50 dark:bg-rose-950/20 p-2.5 rounded-lg">
                  ⚠️ {errorMsg}
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <button
                  onClick={handleSubmit}
                  disabled={isSubmitting}
                  className="flex-1 rounded-xl bg-gradient-to-r from-sky-600 to-indigo-600 py-3 text-sm font-bold text-white transition hover:shadow-lg active:scale-95 disabled:opacity-50"
                >
                  {isSubmitting ? "جاري الحفظ..." : "حفظ النقطة (Enter)"}
                </button>
                <button
                  onClick={() => setIsAddOpen(false)}
                  disabled={isSubmitting}
                  className="flex-1 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131418] py-3 text-sm font-bold text-slate-700 dark:text-slate-200 transition active:scale-95"
                >
                  إلغاء
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
