"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { deleteMandoubWaButton, duplicateMandoubWaButton } from "./actions";
import {
  parseLocationRulesCsv,
  parseStatusesCsv,
  parseVisibilityScopesCsv,
  ORDER_STATUS_OPTIONS,
  VISIBILITY_OPTIONS,
} from "./wa-buttons-constants";
import { splitMandoubWaTemplateVariants } from "@/lib/mandoub-wa-button-template";

type Row = {
  id: string;
  name: string;
  label: string;
  iconKey: string;
  templateText: string;
  statusesCsv: string;
  visibilityScope: string;
  customerLocationRule: string;
  recipient?: string;
  showNextToLocation?: boolean;
  isActive: boolean;
};

const STATUS_LABEL_MAP = Object.fromEntries(
  ORDER_STATUS_OPTIONS.map((o) => [o.value, o.label.split(" (")[0]])
);

const VISIBILITY_LABEL_MAP = Object.fromEntries(
  VISIBILITY_OPTIONS.map((o) => [o.value, o.label])
);

const RECIPIENT_LABEL_MAP: Record<string, string> = {
  customer: "الزبون الأول",
  customer2: "الزبون الثاني",
  shop: "المحل (العميل)",
};

export function WaButtonsList({ rows }: { rows: Row[] }) {
  const [searchTerm, setSearchTerm] = useState("");
  const [filterScope, setFilterScope] = useState<string>("all");
  const [expandedPreviewId, setExpandedPreviewId] = useState<string | null>(null);

  // إحصائيات سريعة
  const stats = useMemo(() => {
    let totalTemplates = 0;
    let nextToLocationCount = 0;
    rows.forEach((r) => {
      const v = splitMandoubWaTemplateVariants(r.templateText);
      totalTemplates += v.length;
      if (r.showNextToLocation) nextToLocationCount++;
    });
    return {
      totalButtons: rows.length,
      totalTemplates,
      nextToLocationCount,
    };
  }, [rows]);

  // تصفية الأزرار
  const filteredRows = useMemo(() => {
    return rows.filter((r) => {
      const matchSearch =
        !searchTerm.trim() ||
        r.label.toLowerCase().includes(searchTerm.toLowerCase().trim()) ||
        r.name.toLowerCase().includes(searchTerm.toLowerCase().trim()) ||
        r.templateText.toLowerCase().includes(searchTerm.toLowerCase().trim());

      if (!matchSearch) return false;

      if (filterScope === "all") return true;
      if (filterScope === "location") return !!r.showNextToLocation;
      const scopes = parseVisibilityScopesCsv(r.visibilityScope);
      if (filterScope === "mandoub") return scopes.includes("all") || scopes.includes("mandoub");
      if (filterScope === "admin") return scopes.includes("all") || scopes.includes("admin");
      if (filterScope === "preparer") return scopes.includes("all") || scopes.includes("preparer");

      return true;
    });
  }, [rows, searchTerm, filterScope]);

  return (
    <div className="space-y-6">
      {/* بطاقات الإحصائيات العلوية */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-sky-100 bg-gradient-to-br from-white to-sky-50/50 p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">إجمالي أزرار الواتساب</span>
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-sky-100 text-base">💬</span>
          </div>
          <p className="mt-2 text-2xl font-extrabold text-sky-950">{stats.totalButtons}</p>
        </div>

        <div className="rounded-2xl border border-emerald-100 bg-gradient-to-br from-white to-emerald-50/50 p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">إجمالي نماذج الرسائل المكتوبة</span>
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-100 text-base">📝</span>
          </div>
          <p className="mt-2 text-2xl font-extrabold text-emerald-950">{stats.totalTemplates}</p>
        </div>

        <div className="rounded-2xl border border-indigo-100 bg-gradient-to-br from-white to-indigo-50/50 p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">مربوطة بجانب زر اللوكيشن</span>
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-100 text-base">📍</span>
          </div>
          <p className="mt-2 text-2xl font-extrabold text-indigo-950">{stats.nextToLocationCount}</p>
        </div>
      </div>

      {/* شريط البحث والفلترة */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200/80 bg-white p-3 shadow-sm">
        <div className="relative flex-1 min-w-[240px]">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="🔍 ابحث عن زر، نص نموذج، أو تسمية..."
            className="w-full rounded-xl border border-slate-200 bg-slate-50/60 px-3.5 py-2 text-sm text-slate-800 outline-none placeholder:text-slate-400 focus:border-sky-500 focus:bg-white focus:ring-2 focus:ring-sky-100 transition"
          />
          {searchTerm ? (
            <button
              onClick={() => setSearchTerm("")}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 hover:text-slate-600"
            >
              ✕ مسح
            </button>
          ) : null}
        </div>

        {/* فلاتر سريعة */}
        <div className="flex flex-wrap items-center gap-1.5 text-xs font-bold">
          <button
            onClick={() => setFilterScope("all")}
            className={`rounded-xl px-3 py-1.5 transition ${
              filterScope === "all"
                ? "bg-sky-600 text-white shadow-sm"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            الكل ({rows.length})
          </button>
          <button
            onClick={() => setFilterScope("location")}
            className={`rounded-xl px-3 py-1.5 transition ${
              filterScope === "location"
                ? "bg-indigo-600 text-white shadow-sm"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            📍 بجانب اللوكيشن
          </button>
          <button
            onClick={() => setFilterScope("mandoub")}
            className={`rounded-xl px-3 py-1.5 transition ${
              filterScope === "mandoub"
                ? "bg-sky-600 text-white shadow-sm"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            ظهور للمندوب
          </button>
        </div>
      </div>

      {/* قائمة الأزرار بتصميم بطاقات عصرية فخمة */}
      {filteredRows.length ? (
        <div className="grid gap-4">
          {filteredRows.map((r, idx) => {
            const variants = splitMandoubWaTemplateVariants(r.templateText);
            const statuses = parseStatusesCsv(r.statusesCsv);
            const scopes = parseVisibilityScopesCsv(r.visibilityScope);
            const locationRules = parseLocationRulesCsv(r.customerLocationRule);
            const recipients = (r.recipient ?? "customer")
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean);

            const isExpanded = expandedPreviewId === r.id;

            return (
              <div
                key={r.id}
                className="group relative overflow-hidden rounded-2xl border border-sky-100 bg-white p-5 shadow-sm transition duration-200 hover:border-sky-300 hover:shadow-md"
              >
                {/* شريط جانبي ملون جمالي */}
                <div className="absolute right-0 top-0 bottom-0 w-1.5 bg-gradient-to-b from-sky-400 to-cyan-500 group-hover:w-2 transition-all" />

                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  {/* القسم الرئيسي: الأيقونة والتفاصيل */}
                  <div className="flex flex-1 items-start gap-4">
                    {/* أيقونة الزر */}
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-sky-200 bg-gradient-to-br from-sky-50 to-cyan-50 text-2xl shadow-inner shadow-sky-100">
                      {r.iconKey || "💬"}
                    </div>

                    {/* معلومات الزر */}
                    <div className="space-y-2 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-bold text-slate-400">#{idx + 1}</span>
                        <h3 className="text-lg font-extrabold text-slate-900">
                          {r.label}
                        </h3>

                        {/* شارات إضافية مميزة */}
                        {r.showNextToLocation ? (
                          <span className="inline-flex items-center gap-1 rounded-lg bg-indigo-50 px-2 py-0.5 text-xs font-extrabold text-indigo-700 border border-indigo-200">
                            📍 يظهر بجانب زر اللوكيشن
                          </span>
                        ) : null}

                        <span className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 px-2 py-0.5 text-xs font-extrabold text-emerald-700 border border-emerald-200">
                          📝 {variants.length} {variants.length === 1 ? "نموذج" : "نماذج"}
                        </span>
                      </div>

                      {/* شارات الشروط والظهور */}
                      <div className="flex flex-wrap items-center gap-1.5 pt-1 text-xs">
                        {/* الظهور */}
                        <div className="inline-flex items-center gap-1 rounded-lg bg-sky-50 px-2 py-1 text-sky-850 font-medium border border-sky-150">
                          <span className="text-slate-500 font-bold">الظهور:</span>
                          <span>
                            {scopes.map((s) => VISIBILITY_LABEL_MAP[s] || s).join("، ")}
                          </span>
                        </div>

                        {/* حالات الطلب */}
                        <div className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2 py-1 text-slate-700 font-medium border border-slate-200">
                          <span className="text-slate-500 font-bold">الحالات:</span>
                          <span>
                            {statuses.length
                              ? statuses.map((st) => STATUS_LABEL_MAP[st] || st).join("، ")
                              : "جميع الحالات"}
                          </span>
                        </div>

                        {/* لوكيشن الزبون */}
                        <div className="inline-flex items-center gap-1 rounded-lg bg-amber-50 px-2 py-1 text-amber-900 font-medium border border-amber-200">
                          <span className="text-amber-700 font-bold">حالة اللوكيشن:</span>
                          <span>
                            {locationRules
                              .map((lr) =>
                                lr === "any"
                                  ? "الكل"
                                  : lr === "exists"
                                  ? "موجود"
                                  : lr === "missing"
                                  ? "بدون لوكيشن"
                                  : "GPS"
                              )
                              .join(" / ")}
                          </span>
                        </div>

                        {/* المستلم */}
                        <div className="inline-flex items-center gap-1 rounded-lg bg-purple-50 px-2 py-1 text-purple-900 font-medium border border-purple-200">
                          <span className="text-purple-700 font-bold">المستلم:</span>
                          <span>
                            {recipients
                              .map((rec) => RECIPIENT_LABEL_MAP[rec] || rec)
                              .join(" + ")}
                          </span>
                        </div>
                      </div>

                      {/* معاينة نماذج الرسائل المكتوبة */}
                      <div className="mt-3">
                        {variants.length === 0 ? (
                          <div className="rounded-xl bg-amber-50/70 border border-amber-200 p-3 text-xs font-semibold text-amber-900">
                            ⚠️ لا توجد نماذج رسائل مكتوبة لهذا الزر بعد. انقر على «تعديل وإدارة النماذج» لكتابة النماذج.
                          </div>
                        ) : (
                          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5">
                            <div className="flex items-center justify-between pb-2 border-b border-slate-200/60 text-xs font-bold text-slate-600">
                              <span>معاينة النموذج الأول (من إجمالي {variants.length}):</span>
                              {variants.length > 1 ? (
                                <button
                                  type="button"
                                  onClick={() => setExpandedPreviewId(isExpanded ? null : r.id)}
                                  className="text-sky-600 hover:text-sky-800 underline font-bold"
                                >
                                  {isExpanded ? "▲ إخفاء باقي النماذج" : `▼ عرض جميع النماذج (${variants.length})`}
                                </button>
                              ) : null}
                            </div>

                            {/* النموذج الأول */}
                            <div className="mt-2.5 rounded-lg bg-white p-3 border border-slate-200/80 text-sm leading-relaxed text-slate-800 font-medium whitespace-pre-wrap">
                              {variants[0]}
                            </div>

                            {/* باقي النماذج عند التوسيع */}
                            {isExpanded && variants.length > 1 ? (
                              <div className="mt-3 space-y-2.5 pt-2 border-t border-slate-200/60">
                                {variants.slice(1).map((v, vIdx) => (
                                  <div key={vIdx} className="space-y-1">
                                    <span className="text-[11px] font-bold text-slate-500">النموذج #{vIdx + 2}:</span>
                                    <div className="rounded-lg bg-white p-3 border border-slate-200/80 text-sm leading-relaxed text-slate-800 font-medium whitespace-pre-wrap">
                                      {v}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            ) : null}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* أزرار الإجراءات على اليسار */}
                  <div className="flex flex-row lg:flex-col items-center lg:items-stretch gap-2 shrink-0 pt-2 lg:pt-0 border-t lg:border-t-0 border-slate-100">
                    <Link
                      href={`/abo1stor3hlaa2kbr8-47/wa-buttons/${r.id}`}
                      className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-sky-600 to-cyan-600 px-4 py-2.5 text-xs sm:text-sm font-bold text-white shadow-sm shadow-sky-200 transition hover:from-sky-700 hover:to-cyan-700"
                    >
                      <span>✏️</span>
                      <span>تعديل وإدارة النماذج</span>
                    </Link>

                    <div className="flex items-center gap-2">
                      <form action={duplicateMandoubWaButton} className="flex-1">
                        <input type="hidden" name="id" value={r.id} />
                        <button
                          type="submit"
                          className="w-full inline-flex items-center justify-center gap-1 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition"
                          title="نسخ ومضاعفة هذا الزر"
                        >
                          <span>📋</span>
                          <span>نسخ</span>
                        </button>
                      </form>

                      <form
                        action={deleteMandoubWaButton}
                        onSubmit={(e) => {
                          if (!window.confirm(`هل أنت متأكد من حذف زر "${r.label}" نهائياً؟`)) {
                            e.preventDefault();
                          }
                        }}
                        className="flex-1"
                      >
                        <input type="hidden" name="id" value={r.id} />
                        <button
                          type="submit"
                          className="w-full inline-flex items-center justify-center gap-1 rounded-xl border border-rose-200 bg-white px-3 py-2 text-xs font-bold text-rose-600 hover:bg-rose-50 transition"
                          title="حذف هذا الزر"
                        >
                          <span>🗑️</span>
                          <span>حذف</span>
                        </button>
                      </form>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-white p-12 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-sky-50 text-3xl">
            💬
          </div>
          <h3 className="mt-4 text-base font-bold text-slate-800">
            {searchTerm ? "لا توجد أزرار تطابق بحثك" : "لا توجد أزرار واتساب حتى الآن"}
          </h3>
          <p className="mt-1 text-sm text-slate-500">
            {searchTerm
              ? "جرّب تغيير كلمات البحث أو مسح الفلاتر."
              : "ابدأ بإنشاء أول زر واتساب لتسهيل إرسال الرسائل للمناديب والزبائن والمجهزين."}
          </p>
          <div className="mt-5">
            <Link
              href="/abo1stor3hlaa2kbr8-47/wa-buttons/new"
              className="inline-flex items-center gap-2 rounded-xl bg-sky-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-sky-700 transition shadow-sm"
            >
              ➕ إضافة زر واتساب جديد
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
