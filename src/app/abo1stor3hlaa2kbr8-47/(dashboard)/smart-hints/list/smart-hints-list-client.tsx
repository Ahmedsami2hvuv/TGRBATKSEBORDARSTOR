"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { deleteSmartHintAction, updateSmartHintAction, addSmartHintAction } from "../actions";

interface Waypoint {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  radiusMeters: number;
  region?: {
    name: string;
  } | null;
}

interface SmartHintsListClientProps {
  allWaypoints: Waypoint[];
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

export default function SmartHintsListClient({ allWaypoints: initialWaypoints }: SmartHintsListClientProps) {
  const [allWaypoints, setAllWaypoints] = useState<Waypoint[]>(initialWaypoints);
  const [searchTerm, setSearchTerm] = useState("");
  
  // -----------------------------------------
  // حالة ونشاط الخرائط للتعديل
  // -----------------------------------------
  const [editingWaypoint, setEditingWaypoint] = useState<Waypoint | null>(null);
  const [editName, setEditName] = useState("");
  const [editCoords, setEditCoords] = useState("");
  const [editMapRadius, setEditMapRadius] = useState(100);
  const [errorMsg, setErrorMsg] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const editNameInputRef = useRef<HTMLInputElement>(null);
  const editCoordsInputRef = useRef<HTMLInputElement>(null);

  const editMapRef = useRef<any>(null);
  const editMarkerRef = useRef<any>(null);
  const editCircleRef = useRef<any>(null);

  // -----------------------------------------
  // حالة ونشاط الخرائط للإضافة
  // -----------------------------------------
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newCoords, setNewCoords] = useState("");
  const [addMapRadius, setAddMapRadius] = useState(100);
  const [addErrorMsg, setAddErrorMsg] = useState("");
  const [isAddingSubmitting, setIsAddingSubmitting] = useState(false);

  const addNameInputRef = useRef<HTMLInputElement>(null);
  const addCoordsInputRef = useRef<HTMLInputElement>(null);

  const addMapRef = useRef<any>(null);
  const addMarkerRef = useRef<any>(null);
  const addCircleRef = useRef<any>(null);

  // مزامنة النقاط المحدثة من السيرفر
  useEffect(() => {
    setAllWaypoints(initialWaypoints);
  }, [initialWaypoints]);

  // التركيز التلقائي عند فتح نافذة التعديل
  useEffect(() => {
    if (editingWaypoint) {
      setTimeout(() => editNameInputRef.current?.focus(), 150);
    }
  }, [editingWaypoint]);

  // التركيز التلقائي عند فتح نافذة الإضافة
  useEffect(() => {
    if (isAddOpen) {
      setTimeout(() => addNameInputRef.current?.focus(), 150);
    }
  }, [isAddOpen]);

  // -----------------------------------------
  // دوال الخرائط التفاعلية
  // -----------------------------------------
  const initMap = async (
    elementId: string,
    lat: number,
    lng: number,
    radius: number,
    isEdit: boolean,
    onCoordsChange: (lat: number, lng: number) => void
  ) => {
    const L = await loadLeaflet();
    if (!L) return;

    // تنظيف المرجع السابق
    const currentMapRef = isEdit ? editMapRef : addMapRef;
    if (currentMapRef.current) {
      currentMapRef.current.remove();
      currentMapRef.current = null;
      if (isEdit) {
        editMarkerRef.current = null;
        editCircleRef.current = null;
      } else {
        addMarkerRef.current = null;
        addCircleRef.current = null;
      }
    }

    const container = document.getElementById(elementId);
    if (!container) return;

    const map = L.map(elementId, {
      zoomControl: true,
      scrollWheelZoom: true
    }).setView([lat, lng], 15);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);

    const marker = L.marker([lat, lng], { draggable: true }).addTo(map);

    const circle = L.circle([lat, lng], {
      color: "#2563eb",
      fillColor: "#3b82f6",
      fillOpacity: 0.15,
      radius: radius
    }).addTo(map);

    marker.on("dragend", () => {
      const position = marker.getLatLng();
      circle.setLatLng(position);
      onCoordsChange(position.lat, position.lng);
    });

    if (isEdit) {
      editMapRef.current = map;
      editMarkerRef.current = marker;
      editCircleRef.current = circle;
    } else {
      addMapRef.current = map;
      addMarkerRef.current = marker;
      addCircleRef.current = circle;
    }

    setTimeout(() => {
      map.invalidateSize();
    }, 200);
  };

  const updateMapRadius = (radius: number, isEdit: boolean) => {
    const circle = isEdit ? editCircleRef.current : addCircleRef.current;
    if (circle) {
      circle.setRadius(radius);
    }
  };

  const updateMapPosition = (lat: number, lng: number, isEdit: boolean) => {
    const map = isEdit ? editMapRef.current : addMapRef.current;
    const marker = isEdit ? editMarkerRef.current : addMarkerRef.current;
    const circle = isEdit ? editCircleRef.current : addCircleRef.current;

    if (map && marker && circle) {
      const pos = [lat, lng];
      map.setView(pos, map.getZoom());
      marker.setLatLng(pos);
      circle.setLatLng(pos);
    }
  };

  // -----------------------------------------
  // مراقبة حالات الإحداثيات وتحديث الخرائط
  // -----------------------------------------
  const addCoordsParsed = parseLatLngLocal(newCoords);
  const editCoordsParsed = parseLatLngLocal(editCoords);

  // خريطة الإضافة
  useEffect(() => {
    if (isAddOpen && addCoordsParsed) {
      initMap("add-list-map", addCoordsParsed.latitude, addCoordsParsed.longitude, addMapRadius, false, (lat, lng) => {
        setNewCoords(`${lat.toFixed(6)}, ${lng.toFixed(6)}`);
      });
    }
    return () => {
      if (addMapRef.current) {
        addMapRef.current.remove();
        addMapRef.current = null;
        addMarkerRef.current = null;
        addCircleRef.current = null;
      }
    };
  }, [isAddOpen, !!addCoordsParsed]);

  useEffect(() => {
    if (isAddOpen && addCoordsParsed && addMapRef.current) {
      updateMapPosition(addCoordsParsed.latitude, addCoordsParsed.longitude, false);
    }
  }, [newCoords]);

  useEffect(() => {
    if (isAddOpen && addMapRef.current) {
      updateMapRadius(addMapRadius, false);
    }
  }, [addMapRadius]);

  // خريطة التعديل
  useEffect(() => {
    if (editingWaypoint && editCoordsParsed) {
      initMap("edit-list-map", editCoordsParsed.latitude, editCoordsParsed.longitude, editMapRadius, true, (lat, lng) => {
        setEditCoords(`${lat.toFixed(6)}, ${lng.toFixed(6)}`);
      });
    }
    return () => {
      if (editMapRef.current) {
        editMapRef.current.remove();
        editMapRef.current = null;
        editMarkerRef.current = null;
        editCircleRef.current = null;
      }
    };
  }, [!!editingWaypoint, !!editCoordsParsed]);

  useEffect(() => {
    if (editingWaypoint && editCoordsParsed && editMapRef.current) {
      updateMapPosition(editCoordsParsed.latitude, editCoordsParsed.longitude, true);
    }
  }, [editCoords]);

  useEffect(() => {
    if (editingWaypoint && editMapRef.current) {
      updateMapRadius(editMapRadius, true);
    }
  }, [editMapRadius]);

  // حذف الاستدلال
  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`هل أنت متأكد من رغبتك في حذف النقطة الدالة (${name})؟`)) {
      return;
    }

    try {
      const res = await deleteSmartHintAction(id);
      if (res.success) {
        setAllWaypoints((prev) => prev.filter((wp) => wp.id !== id));
      }
    } catch (err: any) {
      alert(err.message || "فشل حذف النقطة");
    }
  };

  // فتح التعديل
  const startEdit = (wp: Waypoint) => {
    setEditingWaypoint(wp);
    setEditName(wp.name);
    setEditCoords(`${wp.latitude.toFixed(6)}, ${wp.longitude.toFixed(6)}`);
    setEditMapRadius(wp.radiusMeters || 100);
    setErrorMsg("");
  };

  // حفظ التعديل
  const handleEditSubmit = async () => {
    if (!editingWaypoint) return;
    if (!editName.trim() || !editCoords.trim()) {
      setErrorMsg("يرجى ملء جميع الحقول المطلوبة");
      return;
    }

    setIsSubmitting(true);
    setErrorMsg("");

    try {
      const res = await updateSmartHintAction(editingWaypoint.id, editName, editCoords, editMapRadius);
      if (res.success) {
        // تحديث البيانات محلياً
        const cleanCoords = editCoords.replace(/[()]/g, "").trim();
        const parts = cleanCoords.split(/[,\s]+/);
        const lat = parseFloat(parts[0]);
        const lng = parseFloat(parts[1]);

        setAllWaypoints((prev) =>
          prev.map((wp) =>
            wp.id === editingWaypoint.id
              ? { ...wp, name: editName.trim(), latitude: lat, longitude: lng, radiusMeters: editMapRadius }
              : wp
          )
        );
        setEditingWaypoint(null);
      }
    } catch (err: any) {
      setErrorMsg(err.message || "حدث خطأ غير متوقع أثناء الحفظ");
    } finally {
      setIsSubmitting(false);
    }
  };

  // حفظ الاستدلال الجديد
  const handleAddSubmit = async () => {
    if (!newName.trim() || !newCoords.trim()) {
      setAddErrorMsg("يرجى ملء جميع الحقول المطلوبة");
      return;
    }

    setIsAddingSubmitting(true);
    setAddErrorMsg("");

    try {
      const res = await addSmartHintAction(newName, newCoords, addMapRadius);
      if (res.success && res.waypoint) {
        // إضافة الاستدلال للحالة المحلية
        setAllWaypoints((prev) => [res.waypoint as Waypoint, ...prev]);
        setNewName("");
        setNewCoords("");
        setAddErrorMsg("");
        setAddMapRadius(100);
        // إبقاء النافذة مفتوحة مع إعادة التركيز على حقل الاسم
        setTimeout(() => addNameInputRef.current?.focus(), 50);
      }
    } catch (err: any) {
      setAddErrorMsg(err.message || "حدث خطأ غير متوقع أثناء الحفظ");
    } finally {
      setIsAddingSubmitting(false);
    }
  };

  // تصفية الاستدلالات بالبحث
  const filteredWaypoints = allWaypoints.filter((wp) => {
    const term = searchTerm.toLowerCase();
    return (
      wp.name.toLowerCase().includes(term) ||
      (wp.region?.name || "").toLowerCase().includes(term) ||
      wp.latitude.toString().includes(term) ||
      wp.longitude.toString().includes(term)
    );
  });

  return (
    <div className="space-y-6 pb-12" dir="rtl">
      {/* رأس الصفحة */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-800 dark:text-slate-100 flex items-center gap-2">
            🧭 كل الاستدلالات المخزنة في النظام
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            إدارة وتعديل وحذف النقاط الدالة (الاستدلالات الذكية) للطلب المباشر
          </p>
        </div>

        <div className="flex gap-2 w-full md:w-auto">
          <button
            onClick={() => setIsAddOpen(true)}
            className="flex-1 md:flex-none inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-sky-600 to-indigo-600 text-white font-bold hover:shadow-lg hover:shadow-sky-500/20 transition active:scale-95 text-sm"
          >
            ➕ إضافة استدلال جديد
          </button>
          <Link
            href="/abo1stor3hlaa2kbr8-47/smart-hints"
            className="flex-1 md:flex-none inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131418] text-slate-700 dark:text-slate-200 font-bold hover:bg-slate-50 dark:hover:bg-slate-900 transition active:scale-95 text-sm shadow-sm"
          >
            🔙 العودة للوحة الاستدلالات
          </Link>
        </div>
      </div>

      {/* شريط البحث */}
      <div className="relative w-full">
        <input
          type="text"
          placeholder="ابحث باسم الاستدلال، اسم المنطقة، أو خطوط الطول والعرض..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#09090b] px-4 py-3 text-sm outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 shadow-inner"
        />
        {searchTerm && (
          <button
            onClick={() => setSearchTerm("")}
            className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-sm"
          >
            ✕ مسح
          </button>
        )}
      </div>

      {/* جدول الاستدلالات */}
      <div className="bg-white dark:bg-[#09090b] rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-900/30">
          <span className="text-sm font-black text-slate-700 dark:text-slate-300">
            قائمة الاستدلالات ({filteredWaypoints.length} استدلال معروض)
          </span>
        </div>
        <div className="overflow-x-auto">
          {filteredWaypoints.length === 0 ? (
            <div className="p-12 text-center text-slate-400 dark:text-slate-500 font-bold">
              لا توجد استدلالات تطابق معايير البحث الحالية.
            </div>
          ) : (
            <table className="w-full text-start border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400 font-bold bg-slate-50/50 dark:bg-slate-900/10">
                  <th className="p-3 text-start">الاسم</th>
                  <th className="p-3 text-start">المنطقة الأصلية</th>
                  <th className="p-3 text-start">نطاق التغطية</th>
                  <th className="p-3 text-start">خط العرض (Lat)</th>
                  <th className="p-3 text-start">خط الطول (Lng)</th>
                  <th className="p-3 text-center">إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {filteredWaypoints.map((wp) => (
                  <tr
                    key={wp.id}
                    className="border-b border-slate-100 dark:border-slate-800/40 hover:bg-slate-50 dark:hover:bg-slate-900/20"
                  >
                    <td className="p-3 font-bold text-slate-800 dark:text-slate-200">{wp.name}</td>
                    <td className="p-3 text-slate-500">{wp.region?.name || "عامة (غير محددة)"}</td>
                    <td className="p-3 font-bold text-sky-600 dark:text-sky-400">{wp.radiusMeters} متر</td>
                    <td className="p-3 font-mono text-slate-600 dark:text-slate-400">{wp.latitude.toFixed(6)}</td>
                    <td className="p-3 font-mono text-slate-600 dark:text-slate-400">{wp.longitude.toFixed(6)}</td>
                    <td className="p-3 text-center">
                      <div className="inline-flex gap-2">
                        <button
                          onClick={() => startEdit(wp)}
                          className="inline-flex items-center gap-1 rounded-xl bg-sky-50 dark:bg-sky-950/40 px-3 py-1.5 text-xs font-bold text-sky-600 hover:bg-sky-100 dark:hover:bg-sky-900 transition"
                        >
                          ✏️ تعديل
                        </button>
                        <button
                          onClick={() => handleDelete(wp.id, wp.name)}
                          className="inline-flex items-center gap-1 rounded-xl bg-rose-50 dark:bg-rose-950/20 px-3 py-1.5 text-xs font-bold text-rose-600 hover:bg-rose-100 dark:hover:bg-rose-900 transition"
                        >
                          🗑️ حذف
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* نافذة التعديل المنبثقة */}
      {editingWaypoint && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="relative w-full max-w-lg rounded-3xl bg-white dark:bg-[#0f1115] border border-slate-200 dark:border-slate-800 p-6 shadow-2xl animate-in zoom-in-95 duration-200 my-8">
            <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-200 dark:border-slate-800">
              <h3 className="text-lg font-black text-slate-800 dark:text-slate-100">
                ✏️ تعديل الاستدلال الذكي
              </h3>
              <button
                onClick={() => setEditingWaypoint(null)}
                className="rounded-full bg-slate-100 dark:bg-slate-800 p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">
                  اسم المدخل (مثال: جسر ابو فلوس)
                </label>
                <input
                  ref={editNameInputRef}
                  type="text"
                  placeholder="اكتب اسم المدخل"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  disabled={isSubmitting}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#09090b] px-4 py-2.5 text-sm outline-none focus:border-sky-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">
                  الصق الإحداثية (مثال: 30.4410, 48.0137)
                </label>
                <input
                  ref={editCoordsInputRef}
                  type="text"
                  placeholder="الصق الإحداثية لتظهر الخريطة"
                  value={editCoords}
                  onChange={(e) => setEditCoords(e.target.value)}
                  disabled={isSubmitting}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#09090b] px-4 py-2.5 text-sm outline-none focus:border-sky-500"
                />
              </div>

              {editCoordsParsed && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1 flex justify-between">
                      <span>📏 مسافة التغطية: {editMapRadius} متر</span>
                      <span className="text-slate-400"> اسحب لتغيير الحجم</span>
                    </label>
                    <input
                      type="range"
                      min="10"
                      max="500"
                      step="5"
                      value={editMapRadius}
                      onChange={(e) => setEditMapRadius(parseInt(e.target.value))}
                      disabled={isSubmitting}
                      className="w-full h-2 bg-slate-200 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-sky-600"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">
                      🗺️ تموضع الاستدلال على الخريطة (اسحب الدبوس للتعديل)
                    </label>
                    <div
                      id="edit-list-map"
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
                  onClick={handleEditSubmit}
                  disabled={isSubmitting}
                  className="flex-1 rounded-xl bg-gradient-to-r from-sky-600 to-indigo-600 py-3 text-sm font-bold text-white transition hover:shadow-lg active:scale-95 disabled:opacity-50"
                >
                  {isSubmitting ? "جاري الحفظ..." : "حفظ التعديلات"}
                </button>
                <button
                  onClick={() => setEditingWaypoint(null)}
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

      {/* نافذة إضافة استدلال جديد */}
      {isAddOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="relative w-full max-w-lg rounded-3xl bg-white dark:bg-[#0f1115] border border-slate-200 dark:border-slate-800 p-6 shadow-2xl animate-in zoom-in-95 duration-200 my-8">
            <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-200 dark:border-slate-800">
              <h3 className="text-lg font-black text-slate-800 dark:text-slate-100">
                ➕ إضافة استدلال جديد
              </h3>
              <button
                onClick={() => setIsAddOpen(false)}
                className="rounded-full bg-slate-100 dark:bg-slate-800 p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">
                  اسم المدخل الجديد (مثال: جسر ابو فلوس)
                </label>
                <input
                  ref={addNameInputRef}
                  type="text"
                  placeholder="اكتب اسم المدخل واضغط Enter"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addCoordsInputRef.current?.focus()}
                  disabled={isAddingSubmitting}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#09090b] px-4 py-2.5 text-sm outline-none focus:border-sky-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">
                  الصق الإحداثية (مثال: 30.4410, 48.0137)
                </label>
                <input
                  ref={addCoordsInputRef}
                  type="text"
                  placeholder="الصق الإحداثية لتظهر الخريطة فوراً"
                  value={newCoords}
                  onChange={(e) => setNewCoords(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAddSubmit()}
                  disabled={isAddingSubmitting}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#09090b] px-4 py-2.5 text-sm outline-none focus:border-sky-500"
                />
              </div>

              {addCoordsParsed && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1 flex justify-between">
                      <span>📏 مسافة التغطية: {addMapRadius} متر</span>
                      <span className="text-slate-400"> اسحب لتغيير الحجم</span>
                    </label>
                    <input
                      type="range"
                      min="10"
                      max="500"
                      step="5"
                      value={addMapRadius}
                      onChange={(e) => setAddMapRadius(parseInt(e.target.value))}
                      disabled={isAddingSubmitting}
                      className="w-full h-2 bg-slate-200 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-sky-600"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">
                      🗺️ تموضع الاستدلال على الخريطة (اسحب الدبوس للتعديل)
                    </label>
                    <div
                      id="add-list-map"
                      className="h-60 w-full rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-inner z-10"
                    ></div>
                  </div>
                </div>
              )}

              {addErrorMsg && (
                <div className="text-xs font-bold text-rose-600 bg-rose-50 dark:bg-rose-950/20 p-2.5 rounded-lg">
                  ⚠️ {addErrorMsg}
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <button
                  onClick={handleAddSubmit}
                  disabled={isAddingSubmitting}
                  className="flex-1 rounded-xl bg-gradient-to-r from-sky-600 to-indigo-600 py-3 text-sm font-bold text-white transition hover:shadow-lg active:scale-95 disabled:opacity-50"
                >
                  {isAddingSubmitting ? "جاري الحفظ..." : "حفظ النقطة"}
                </button>
                <button
                  onClick={() => setIsAddOpen(false)}
                  disabled={isAddingSubmitting}
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
