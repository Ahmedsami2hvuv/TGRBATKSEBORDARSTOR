"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { deleteSmartHintAction } from "../actions";

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

interface SmartHintsListClientProps {
  allWaypoints: Waypoint[];
}

export default function SmartHintsListClient({ allWaypoints: initialWaypoints }: SmartHintsListClientProps) {
  const [allWaypoints, setAllWaypoints] = useState<Waypoint[]>(initialWaypoints);
  const [searchTerm, setSearchTerm] = useState("");

  // مزامنة النقاط المحدثة من السيرفر
  useEffect(() => {
    setAllWaypoints(initialWaypoints);
  }, [initialWaypoints]);

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
          <Link
            href="/abo1stor3hlaa2kbr8-47/smart-hints/add"
            className="flex-1 md:flex-none inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-sky-600 to-indigo-600 text-white font-bold hover:shadow-lg hover:shadow-sky-500/20 transition active:scale-95 text-sm"
          >
            ➕ إضافة استدلال جديد
          </Link>
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
                  <th className="p-3 text-start">نوع الاستدلال</th>
                  <th className="p-3 text-start">نطاق التغطية</th>
                  <th className="p-3 text-start">خط العرض (Lat)</th>
                  <th className="p-3 text-start">خط الطول (Lng)</th>
                  <th className="p-3 text-center">إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {filteredWaypoints.map((wp) => {
                  const isPolygon = wp.polygonCoords && Array.isArray(wp.polygonCoords) && wp.polygonCoords.length >= 3;
                  return (
                    <tr
                      key={wp.id}
                      className="border-b border-slate-100 dark:border-slate-800/40 hover:bg-slate-50 dark:hover:bg-slate-900/20"
                    >
                      <td className="p-3 font-bold text-slate-800 dark:text-slate-200">{wp.name}</td>
                      <td className="p-3 text-slate-500">{wp.region?.name || "عامة (غير محددة)"}</td>
                      <td className="p-3">
                        {isPolygon ? (
                          <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-600 bg-amber-50 dark:bg-amber-950/20 px-2.5 py-1 rounded-lg">
                            🟩 مربع سكني
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs font-bold text-sky-600 bg-sky-50 dark:bg-sky-950/20 px-2.5 py-1 rounded-lg">
                            📍 دائري (نطاق)
                          </span>
                        )}
                      </td>
                      <td className="p-3 font-bold text-slate-700 dark:text-slate-300">
                        {isPolygon ? "محدّد جغرافياً" : `${wp.radiusMeters} متر`}
                      </td>
                      <td className="p-3 font-mono text-slate-600 dark:text-slate-400">{wp.latitude.toFixed(6)}</td>
                      <td className="p-3 font-mono text-slate-600 dark:text-slate-400">{wp.longitude.toFixed(6)}</td>
                      <td className="p-3 text-center">
                        <div className="inline-flex gap-2">
                          <Link
                            href={`/abo1stor3hlaa2kbr8-47/smart-hints/edit/${wp.id}`}
                            className="inline-flex items-center gap-1 rounded-xl bg-sky-50 dark:bg-sky-950/40 px-3 py-1.5 text-xs font-bold text-sky-600 hover:bg-sky-100 dark:hover:bg-sky-900 transition"
                          >
                            ✏️ تعديل
                          </Link>
                          <button
                            onClick={() => handleDelete(wp.id, wp.name)}
                            className="inline-flex items-center gap-1 rounded-xl bg-rose-50 dark:bg-rose-950/20 px-3 py-1.5 text-xs font-bold text-rose-600 hover:bg-rose-100 dark:hover:bg-rose-900 transition"
                          >
                            🗑️ حذف
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
