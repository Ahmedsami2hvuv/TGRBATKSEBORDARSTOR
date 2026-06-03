"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { ad } from "@/lib/admin-ui";
import { deleteEmployee, renewEmployeeOrderPortalToken } from "./actions";
import { getGlobalIcons, GlobalIconsConfig } from "@/lib/icon-settings";
import { DynamicIcon } from "@/components/dynamic-icon";
import { EmployeeForm } from "./employee-form";

export type EmployeeRow = {
  id: string;
  name: string;
  phone: string;
  orderPortalUrl: string;
  whatsappLink: string;
};

function normalizeArabic(s: string): string {
  return s
    .trim()
    .replace(/[\u064B-\u065F]/g, "")
    .replace(/أ|إ|آ/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .toLowerCase();
}

export function EmployeesList({
  shopId,
  shopName,
  locationUrl,
  employees,
  icons,
  allShops,
}: {
  shopId: string;
  shopName: string;
  locationUrl: string;
  employees: EmployeeRow[];
  icons: GlobalIconsConfig | null;
  allShops?: { id: string; name: string }[];
}) {
  const [query, setQuery] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);

  const normalizedQuery = normalizeArabic(query);

  const filtered = (employees || []).filter((e) => {
    if (!normalizedQuery) return true;
    const nameNorm = normalizeArabic(e.name || "");
    const phoneNorm = (e.phone || "").toLowerCase();
    return nameNorm.includes(normalizedQuery) || phoneNorm.includes(normalizedQuery);
  });

  const matchingShops = query.trim()
    ? (allShops || []).filter((s) => {
        if (s.id === shopId) return false;
        const shopNorm = normalizeArabic(s.name || "");
        return shopNorm.includes(normalizedQuery);
      })
    : [];

  const copyToClipboard = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  return (
    <div className="space-y-4">
      {/* الهيدر الجديد البسيط مع أزرار الإجراءات السريعة */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
        <div className="flex items-center gap-3">
          <Link href="/abo1stor3hlaa2kbr8-47/shops" className={`${ad.link} flex items-center gap-1 text-sm font-bold`}>
            <DynamicIcon iconKey="ui_shops" config={icons} fallback="←" className="w-4 h-4" />
            المحلات
          </Link>
          <span className="text-slate-300">/</span>
          <h1 className="text-xl font-black text-slate-800">{shopName}</h1>
        </div>

        <div className="flex items-center gap-2">
          {locationUrl && locationUrl.trim().length > 5 && (
            <a
              href={locationUrl.trim()}
              target="_blank"
              rel="noopener noreferrer"
              title="فتح موقع المحل على الخريطة"
              className="inline-flex items-center justify-center p-2.5 rounded-xl bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-all border border-emerald-100 hover:scale-105 active:scale-95"
            >
              <DynamicIcon iconKey="ui_map" config={icons} fallback="📍" className="w-5 h-5" />
            </a>
          )}
          <button
            type="button"
            onClick={() => setShowAddForm((v) => !v)}
            title="إضافة عميل جديد"
            className={`inline-flex items-center justify-center p-2.5 rounded-xl transition-all border hover:scale-105 active:scale-95 ${
              showAddForm
                ? "bg-rose-50 text-rose-700 border-rose-100 hover:bg-rose-100"
                : "bg-sky-50 text-sky-700 border-sky-100 hover:bg-sky-100"
            }`}
          >
            {showAddForm ? (
              <DynamicIcon iconKey="ui_close" config={icons} fallback="✕" className="w-5 h-5" />
            ) : (
              <DynamicIcon iconKey="ui_plus" config={icons} fallback="＋" className="w-5 h-5" />
            )}
          </button>
          <Link
            href={`/abo1stor3hlaa2kbr8-47/shops/${shopId}/edit`}
            title="تعديل بيانات المحل"
            className="inline-flex items-center justify-center p-2.5 rounded-xl bg-slate-50 text-slate-700 hover:bg-slate-100 transition-all border border-slate-200 hover:scale-105 active:scale-95"
          >
            <DynamicIcon iconKey="ui_edit" config={icons} fallback="✏️" className="w-5 h-5" />
          </Link>
        </div>
      </div>

      {showAddForm && (
        <div className="bg-sky-50/50 p-6 rounded-2xl border border-sky-100/50 shadow-inner animate-in slide-in-from-top-2 duration-300">
          <h3 className="font-black text-sky-950 mb-4 flex items-center gap-2">
            <DynamicIcon iconKey="ui_plus" config={icons} className="w-5 h-5 text-sky-700" />
            إضافة موظف (عميل) جديد للمحل
          </h3>
          <EmployeeForm
            shopId={shopId}
            submitLabel="حفظ بيانات العميل"
            successLabel="تمت إضافة العميل بنجاح."
          />
        </div>
      )}

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between bg-slate-50 p-3 rounded-xl">
        <span className="text-sm font-bold text-slate-600">بحث في العملاء:</span>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="ابحث بالاسم أو الرقم..."
          className="w-full max-w-xs rounded-lg border border-slate-200 p-2 text-sm outline-none focus:ring-2 focus:ring-sky-500"
        />
      </div>

      {matchingShops.length > 0 && (
        <div className="rounded-2xl border border-sky-100 bg-sky-50/50 p-4 shadow-sm space-y-2">
          <p className="flex items-center gap-2 text-xs font-bold text-sky-800">
            <DynamicIcon iconKey="ui_shops" config={icons} fallback="🏪" className="w-4 h-4 text-sky-600 animate-pulse" />
            هل تبحث عن محل آخر؟ الانتقال لعملاء:
          </p>
          <div className="flex flex-wrap gap-2">
            {matchingShops.map((s) => (
              <Link
                key={s.id}
                href={`/abo1stor3hlaa2kbr8-47/shops/${s.id}/employees`}
                className="inline-flex items-center gap-1.5 rounded-xl bg-white px-3.5 py-2 text-xs font-black text-slate-700 shadow-sm border border-slate-200/80 hover:bg-sky-100 hover:text-sky-800 hover:border-sky-300 transition-all hover:scale-[1.02] active:scale-[0.98]"
              >
                <DynamicIcon iconKey="ui_user" config={icons} fallback="👤" className="w-3.5 h-3.5 text-slate-400" />
                {s.name}
              </Link>
            ))}
          </div>
        </div>
      )}

      {filtered.length === 0 ? (
        <p className="py-10 text-center text-slate-400">لا توجد نتائج مطابقة.</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {filtered.map((emp) => (
            <li key={emp.id} className="py-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-black text-slate-800 text-lg">{emp.name}</p>
                <p className="text-slate-500 font-mono text-sm">{emp.phone}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {emp.whatsappLink && emp.whatsappLink.trim().length > 10 ? (
                    <a
                      href={emp.whatsappLink.trim()}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-1.5 text-[11px] font-bold text-white hover:bg-emerald-700 transition-colors"
                    >
                      <DynamicIcon iconKey="ui_whatsapp" config={icons} fallback="💬" className="w-3.5 h-3.5" /> إرسال الرابط للواتساب
                    </a>
                  ) : (
                    <span className="text-[10px] text-rose-500 bg-rose-50 px-2 py-1 rounded">
                      ⚠️ الرابط غير جاهز (رقم غير صالح)
                    </span>
                  )}
                  {emp.orderPortalUrl && emp.orderPortalUrl.trim().length > 5 && (
                    <a
                      href={emp.orderPortalUrl.trim()}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 rounded-lg bg-sky-100 px-3 py-1.5 text-[11px] font-bold text-sky-700 hover:bg-sky-200 transition-colors"
                    >
                      <DynamicIcon iconKey="ui_link" config={icons} fallback="🔗" className="w-3.5 h-3.5" /> فتح الرابط المباشر
                    </a>
                  )}
                  {emp.orderPortalUrl && emp.orderPortalUrl.trim().length > 5 && (
                    <button
                      onClick={() => copyToClipboard(emp.orderPortalUrl, emp.id)}
                      className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-[11px] font-bold text-slate-600 hover:bg-slate-50 transition-colors"
                    >
                      {copiedId === emp.id ? (
                        <>
                          <DynamicIcon iconKey="ui_success" config={icons} fallback="✅" className="w-3.5 h-3.5" /> تم النسخ
                        </>
                      ) : (
                        <>
                          <DynamicIcon iconKey="ui_copy" config={icons} fallback="📋" className="w-3.5 h-3.5" /> نسخ الرابط
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 border-t pt-3 sm:border-0 sm:pt-0">
                <Link
                  href={`/abo1stor3hlaa2kbr8-47/shops/${shopId}/employees/${emp.id}/edit`}
                  className="flex items-center gap-1.5 rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-bold text-white hover:bg-slate-900"
                >
                  <DynamicIcon iconKey="ui_edit" config={icons} fallback="" className="w-3.5 h-3.5" />
                  تعديل
                </Link>
                <form action={renewEmployeeOrderPortalToken}>
                  <input type="hidden" name="id" value={emp.id} />
                  <input type="hidden" name="shopId" value={shopId} />
                  <button
                    type="submit"
                    className="flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-700 hover:bg-amber-100"
                  >
                    <DynamicIcon iconKey="ui_refresh" config={icons} fallback="" className="w-3.5 h-3.5" />
                    تجديد
                  </button>
                </form>
                <form action={deleteEmployee} onSubmit={(ev) => !confirm(`حذف الموظف "${emp.name}" نهائياً؟`) && ev.preventDefault()}>
                  <input type="hidden" name="id" value={emp.id} />
                  <input type="hidden" name="shopId" value={shopId} />
                  <button
                    type="submit"
                    className="flex items-center gap-1.5 rounded-lg bg-rose-50 px-3 py-1.5 text-xs font-bold text-rose-600 hover:bg-rose-100"
                  >
                    <DynamicIcon iconKey="ui_delete" config={icons} fallback="" className="w-3.5 h-3.5" />
                    حذف
                  </button>
                </form>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}