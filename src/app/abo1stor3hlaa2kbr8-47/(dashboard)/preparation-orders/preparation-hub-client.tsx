"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { AdminPreparationClient } from "./drafts/new/admin-preparation-client";
import { ReportsFilterForm } from "../reports/_components/reports-filter-form";
import { ReportSectionIntro, ReportsTable } from "../reports/_components/reports-table";
import type { ReportTableRow } from "@/lib/report-types";

const tabs = [
  { key: "draft", label: "إضافة طلب", description: "الصق رسالة الطلب لتكوين مسودة تجهيز وإرسالها للمجهزين." },
  { key: "new", label: "طلب جديد", description: "إنشاء طلب جديد في النظام بسرعة." },
  { key: "assigned", label: "بالتجهيز", description: "عرض الطلبات الموجودة حالياً في حالة التجهيز والترتيب حسب وقت الرفع." },
  { key: "delivered", label: "كامل", description: "عرض الطلبات المكتملة مع فاتورة كل طلب." },
] as const;

type TabKey = (typeof tabs)[number]["key"];

export function PreparationOrdersHubClient({
  initialTab,
  rows,
  fromInput,
  toInput,
  preparers,
  couriers,
  preparerId,
}: {
  initialTab: string;
  rows: ReportTableRow[];
  fromInput: string;
  toInput: string;
  preparers: Array<{ id: string; name: string; available: boolean }>;
  couriers: Array<{ id: string; name: string }>;
  preparerId: string;
}) {
  const [active, setActive] = useState<TabKey>(
    tabs.some((tab) => tab.key === initialTab) ? (initialTab as TabKey) : "draft",
  );

  const assignedRows = useMemo(
    () => rows.filter((row) => row.status === "assigned"),
    [rows],
  );
  const deliveredRows = useMemo(
    () => rows.filter((row) => row.status === "delivered"),
    [rows],
  );

  const activeTab = tabs.find((tab) => tab.key === active);

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-stretch gap-2">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActive(tab.key)}
              className={`min-h-[44px] rounded-2xl px-4 py-2 text-sm font-bold transition ${
                active === tab.key
                  ? "bg-slate-900 text-white shadow-lg"
                  : "border border-slate-300 bg-white text-slate-700 hover:border-slate-400 hover:bg-slate-50"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50/80 p-4 text-sm leading-relaxed text-slate-700">
          {activeTab?.description}
        </div>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        {active === "draft" ? (
          <AdminPreparationClient preparers={preparers} />
        ) : active === "new" ? (
          <div className="space-y-4" dir="rtl">
            <div>
              <h2 className="text-xl font-black text-slate-900">إنشاء طلب جديد</h2>
              <p className="mt-2 text-sm text-slate-600">
                استخدم النموذج الموجود في النظام لإنشاء طلب جديد بسرعة وتسجيله في قسم التجهيز.
              </p>
            </div>
            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
              <p className="text-sm text-slate-700">اضغط الزر أدناه للانتقال إلى صفحة إنشاء طلب جديد.</p>
              <Link
                href="/abo1stor3hlaa2kbr8-47/orders/new"
                className="mt-4 inline-flex items-center justify-center rounded-xl bg-violet-600 px-5 py-3 text-sm font-black text-white shadow-sm hover:bg-violet-700 transition"
              >
                فتح نموذج طلب جديد
              </Link>
            </div>
          </div>
        ) : active === "assigned" || active === "delivered" ? (
          <div className="space-y-5" dir="rtl">
            <ReportsFilterForm fromInput={fromInput} toInput={toInput}>
              <input type="hidden" name="status" value={active} />
              <label className="flex min-w-[12rem] flex-col gap-1">
                <span className="text-sm font-bold text-slate-800">المجهز</span>
                <select name="preparerId" defaultValue={preparerId} className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100">
                  <option value="">كل المجهزين</option>
                  {preparers.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </label>
            </ReportsFilterForm>

            <ReportSectionIntro>
              عدد السجلات: <strong className="text-slate-800">{active === "assigned" ? assignedRows.length : deliveredRows.length}</strong>
            </ReportSectionIntro>

            <ReportsTable rows={active === "assigned" ? assignedRows : deliveredRows} couriers={couriers} />
          </div>
        ) : null}
      </div>
    </div>
  );
}
