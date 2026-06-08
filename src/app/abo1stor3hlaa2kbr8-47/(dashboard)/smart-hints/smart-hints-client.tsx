"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { addSmartHintAction, deleteSmartHintAction } from "./actions";

interface Waypoint {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
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
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isListOpen, setIsListOpen] = useState(false);

  // حقول النموذج الجديد
  const [newName, setNewName] = useState("");
  const [newCoords, setNewCoords] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // للبحث والفلترة
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const nameInputRef = useRef<HTMLInputElement>(null);
  const coordsInputRef = useRef<HTMLInputElement>(null);

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
      const res = await addSmartHintAction(newName, newCoords);
      if (res.success) {
        // تفريغ المدخلات وإغلاق النافذة
        setNewName("");
        setNewCoords("");
        setIsAddOpen(false);
      }
    } catch (err: any) {
      setErrorMsg(err.message || "حدث خطأ غير متوقع أثناء الحفظ");
    } finally {
      setIsSubmitting(false);
    }
  };

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

  // تصفية الطلبات المعروضة
  const filteredOrders = processedOrders.filter((o) => {
    const matchesSearch =
      o.orderNumber.toString().includes(searchTerm) ||
      (o.shop?.name || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (o.customerRegion?.name || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      o.hintText.toLowerCase().includes(searchTerm.toLowerCase());

    if (statusFilter === "all") return matchesSearch;
    if (statusFilter === "success") return matchesSearch && o.statusText === "مستدل بنجاح";
    if (statusFilter === "out_of_range") return matchesSearch && o.statusText.startsWith("خارج النطاق");
    if (statusFilter === "no_location") return matchesSearch && !o.hasLocation;
    return matchesSearch;
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
            مراقبة وتحليل الاستدلال الذكي التلقائي للطلبات في محيط 300 متر مستقل عن المنطقة
          </p>
        </div>

        {/* أزرار التحكم الفوقية */}
        <div className="flex flex-wrap gap-2 w-full md:w-auto">
          <button
            onClick={() => setIsListOpen(true)}
            className="flex-1 md:flex-none inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131418] text-slate-700 dark:text-slate-200 font-bold hover:bg-slate-50 dark:hover:bg-slate-900 transition active:scale-95 text-sm"
          >
            🧭 عرض كل الاستدلالات ({allWaypoints.length})
          </button>
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
          <div className="text-sm font-bold text-emerald-700 dark:text-emerald-400">مستدل بنجاح (≤ 300م)</div>
          <div className="text-2xl font-black text-emerald-800 dark:text-emerald-300 mt-1">
            {stats.successfullyInferred}
          </div>
        </button>

        <button
          onClick={() => setStatusFilter("out_of_range")}
          className="text-start bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 rounded-2xl p-4 shadow-sm hover:scale-[1.02] transition"
        >
          <div className="text-sm font-bold text-amber-700 dark:text-amber-400">خارج النطاق (&gt; 300م)</div>
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

      {/* قسم البحث والتصفية */}
      <div className="flex flex-col sm:flex-row gap-3 items-center">
        <div className="relative w-full sm:flex-1">
          <input
            type="text"
            placeholder="ابحث برقم الطلب، المحل، المنطقة، أو نص الاستدلال..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#09090b] px-4 py-2.5 text-sm outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm("")}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
            >
              ✕ مسح
            </button>
          )}
        </div>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="w-full sm:w-[200px] rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#09090b] px-3 py-2.5 text-sm outline-none focus:border-sky-500"
        >
          <option value="all">كل الحالات الحسابية</option>
          <option value="success">مستدل بنجاح</option>
          <option value="out_of_range">خارج النطاق</option>
          <option value="no_location">بدون لوكيشن</option>
        </select>
      </div>

      {/* جدول الطلبات */}
      <div className="bg-white dark:bg-[#09090b] rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-900/30">
          <span className="text-sm font-black text-slate-700 dark:text-slate-300">
            الطلبات الحالية ({filteredOrders.length} طلب معروض)
          </span>
        </div>
        <div className="overflow-x-auto">
          {filteredOrders.length === 0 ? (
            <div className="p-8 text-center text-slate-400 dark:text-slate-500 font-bold">
              لا توجد طلبات تطابق معايير البحث والفلترة الحالية.
            </div>
          ) : (
            <table className="w-full text-start border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400 font-bold bg-slate-50/50 dark:bg-slate-900/10">
                  <th className="p-3 text-start">رقم الطلب</th>
                  <th className="p-3 text-start">المحل</th>
                  <th className="p-3 text-start">المنطقة المحددة</th>
                  <th className="p-3 text-start">اللوكيشن الأصلي</th>
                  <th className="p-3 text-start">أقرب نقطة دالة في النظام</th>
                  <th className="p-3 text-start">الاستدلال الذكي الناتج</th>
                  <th className="p-3 text-start">الحالة الحسابية</th>
                </tr>
              </thead>
              <tbody>
                {filteredOrders.map((o) => (
                  <tr
                    key={o.id}
                    className="border-b border-slate-100 dark:border-slate-800/60 hover:bg-slate-50 dark:hover:bg-slate-900/20 transition-colors"
                  >
                    <td className="p-3">
                      <Link
                        href={`/abo1stor3hlaa2kbr8-47/orders/${o.id}`}
                        className="text-sky-600 dark:text-[#00f3ff] hover:underline font-bold"
                      >
                        #{o.orderNumber}
                      </Link>
                    </td>
                    <td className="p-3 font-semibold">{o.shop?.name || "—"}</td>
                    <td className="p-3 text-slate-500">{o.customerRegion?.name || "—"}</td>
                    <td className="p-3">
                      {o.customerLocationUrl ? (
                        <a
                          href={o.customerLocationUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-sky-600 dark:text-sky-400 bg-sky-50 dark:bg-sky-950/40 px-2 py-1 rounded-lg border border-sky-200 dark:border-sky-900/40"
                        >
                          📍 فتح الرابط
                        </a>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="p-3">
                      {o.nearestWaypoint ? (
                        <div className="flex flex-col">
                          <span className="font-bold text-slate-700 dark:text-slate-300">
                            {o.nearestWaypoint.name}
                          </span>
                          <span className="text-xs text-slate-400">
                            بمنطقة: {o.nearestWaypoint.regionName} ({Math.round(o.nearestWaypoint.distanceM)}م)
                          </span>
                        </div>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="p-3 font-bold text-slate-800 dark:text-slate-200">{o.hintText}</td>
                    <td className="p-3">
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-bold ${
                          o.statusText === "مستدل بنجاح"
                            ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
                            : o.statusText?.startsWith("خارج النطاق")
                            ? "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300"
                            : "bg-slate-100 text-slate-600 dark:bg-slate-900 dark:text-slate-400"
                        }`}
                      >
                        {o.statusText}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* نافذة إضافة استدلال جديد (منبثقة من الأسفل) */}
      {isAddOpen && (
        <div className="fixed inset-0 z-[200] flex items-end justify-center bg-black/60 backdrop-blur-sm transition-opacity">
          <div className="relative w-full max-w-lg rounded-t-3xl bg-white dark:bg-[#0f1115] border-t border-slate-200 dark:border-slate-800 p-6 shadow-2xl animate-in slide-in-from-bottom duration-300">
            {/* مقبض السحب الشكلي */}
            <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-slate-300 dark:bg-slate-700" />

            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-black text-slate-800 dark:text-slate-100">
                ➕ إضافة نقطة استدلال ذكي جديدة
              </h3>
              <button
                onClick={() => setIsAddOpen(false)}
                className="rounded-full bg-slate-100 dark:bg-slate-800 p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4 bg-slate-50 dark:bg-slate-900/40 p-3 rounded-xl border border-slate-100 dark:border-slate-800/80 leading-relaxed">
              💡 ضيف أكثر من نقطة للمنطقة (خط العرض/خط الطول)، والفرز الذكي يختار الأقرب للمندوب.
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">
                  اسم المدخل الجديد (مثال: جسر ابو فلوس)
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
                  الصق الإحداثية (مثال: 30.4410, 48.0137)
                </label>
                <input
                  ref={coordsInputRef}
                  type="text"
                  placeholder="الصق الإحداثية واضغط Enter للحفظ مباشرة"
                  value={newCoords}
                  onChange={(e) => setNewCoords(e.target.value)}
                  onKeyDown={handleCoordsKeyDown}
                  disabled={isSubmitting}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#09090b] px-4 py-2.5 text-sm outline-none focus:border-sky-500"
                />
              </div>

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

      {/* نافذة عرض كل الاستدلالات المخزنة */}
      {isListOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="relative w-full max-w-2xl rounded-2xl bg-white dark:bg-[#0f1115] border border-slate-200 dark:border-slate-800 p-6 shadow-2xl flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-200 dark:border-slate-800">
              <h3 className="text-lg font-black text-slate-800 dark:text-slate-100">
                🧭 كل النقاط الدالة (الاستدلالات) المخزنة في النظام ({allWaypoints.length})
              </h3>
              <button
                onClick={() => setIsListOpen(false)}
                className="rounded-full bg-slate-100 dark:bg-slate-800 p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto min-h-0">
              <table className="w-full text-start border-collapse text-xs sm:text-sm">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400 font-bold bg-slate-50/50 dark:bg-slate-900/10">
                    <th className="p-2.5 text-start">الاسم</th>
                    <th className="p-2.5 text-start">المنطقة الأصلية</th>
                    <th className="p-2.5 text-start">خط العرض (Lat)</th>
                    <th className="p-2.5 text-start">خط الطول (Lng)</th>
                    <th className="p-2.5 text-center">إجراءات</th>
                  </tr>
                </thead>
                <tbody>
                  {allWaypoints.map((wp) => (
                    <tr
                      key={wp.id}
                      className="border-b border-slate-100 dark:border-slate-800/40 hover:bg-slate-50 dark:hover:bg-slate-900/20"
                    >
                      <td className="p-2.5 font-bold">{wp.name}</td>
                      <td className="p-2.5 text-slate-500">{wp.region?.name || "عامة (غير محددة)"}</td>
                      <td className="p-2.5 font-mono text-slate-600 dark:text-slate-400">{wp.latitude.toFixed(6)}</td>
                      <td className="p-2.5 font-mono text-slate-600 dark:text-slate-400">{wp.longitude.toFixed(6)}</td>
                      <td className="p-2.5 text-center">
                        <button
                          onClick={() => handleDelete(wp.id, wp.name)}
                          className="rounded-lg bg-rose-50 dark:bg-rose-950/20 p-1.5 text-rose-600 hover:bg-rose-100 hover:text-rose-800 transition"
                          title="حذف الاستدلال"
                        >
                          🗑️ حذف
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex justify-end">
              <button
                onClick={() => setIsListOpen(false)}
                className="px-6 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131418] text-sm font-bold text-slate-700 dark:text-slate-200 transition active:scale-95"
              >
                إغلاق النافذة
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
