"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

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

export default function SmartHintsClient({
  allWaypoints: initialWaypoints,
  processedOrders,
  stats,
}: SmartHintsClientProps) {
  const [allWaypoints, setAllWaypoints] = useState<Waypoint[]>(initialWaypoints);

  // للبحث والفلترة
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  // مزامنة النقاط المحدثة من السيرفر
  useEffect(() => {
    setAllWaypoints(initialWaypoints);
  }, [initialWaypoints]);

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
      (order.statusText || "").toLowerCase().includes(term) ||
      (order.hintText || "").toLowerCase().includes(term) ||
      (order.nearestWaypoint?.name || "").toLowerCase().includes(term) ||
      (order.nearestWaypoint?.regionName || "").toLowerCase().includes(term)
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
          <Link
            href="/abo1stor3hlaa2kbr8-47/smart-hints/add"
            className="flex-1 md:flex-none inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-sky-600 to-indigo-600 text-white font-bold hover:shadow-lg hover:shadow-sky-500/20 transition active:scale-95 text-sm"
          >
            ➕ إضافة استدلال جديد
          </Link>
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
          <div className="text-sm font-bold text-amber-700 dark:text-emerald-400">خارج النطاق (&gt; 100م)</div>
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
    </div>
  );
}
