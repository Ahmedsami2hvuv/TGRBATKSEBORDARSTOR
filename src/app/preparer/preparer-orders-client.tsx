"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ad } from "@/lib/admin-ui";
import {
  mandoubOrderMatchesSmartQuery,
  type MandoubOrderSearchFields,
} from "@/lib/mandoub-order-smart-filter";
import type { MandoubRow } from "@/app/mandoub/mandoub-order-table";
import { PreparerOrderTable } from "./preparer-order-table";
import { DynamicIcon } from "@/components/dynamic-icon";
import { GlobalIconsConfig } from "@/lib/icon-settings";

export function PreparerOrdersSection({
  allRows,
  searchFields,
  auth,
  tab,
  initialQuery = "",
  couriersForBulkAssign = [],
  icons,
}: {
  allRows: MandoubRow[];
  searchFields: MandoubOrderSearchFields[];
  auth: { p: string; exp: string; s: string };
  tab: string;
  /** من عنوان الصفحة (?q=) عند العودة من تفاصيل الطلب */
  initialQuery?: string;
  /** مندوبون متاحون للإسناد — يفعّل التحديد المتعدد في الجدول */
  couriersForBulkAssign?: { id: string; name: string }[];
  icons?: GlobalIconsConfig | null;
}) {
  const [query, setQuery] = useState(initialQuery);
  const [searchOpen, setSearchOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setQuery(initialQuery);
    if (initialQuery.trim()) setSearchOpen(true);
  }, [initialQuery]);

  // تركيز الحقل تلقائياً عند فتحه عبر الأيقونة
  useEffect(() => {
    if (searchOpen) {
      const t = window.setTimeout(() => inputRef.current?.focus(), 50);
      return () => window.clearTimeout(t);
    }
  }, [searchOpen]);

  // الاستماع لحدث «طلب فتح البحث» المُرسل من ترويسة الصفحة (الأيقونة بجانب اسم المجهز)
  useEffect(() => {
    const handler = () => setSearchOpen(true);
    window.addEventListener("preparer:open-search", handler);
    return () => window.removeEventListener("preparer:open-search", handler);
  }, []);

  const filteredRows = useMemo(() => {
    const paired = allRows.map((r, i) => ({ r, f: searchFields[i] }));
    if (!query.trim()) return paired.map((p) => p.r);
    return paired
      .filter(({ f }) => !!f && mandoubOrderMatchesSmartQuery(query, f!))
      .map((p) => p.r);
  }, [allRows, searchFields, query]);

  return (
    <>
      {searchOpen ? (
        <div className="border-b border-sky-100 px-2 py-2.5 sm:px-4 sm:py-3">
          <div className="relative flex items-stretch gap-2" dir="rtl">
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <DynamicIcon
                iconKey="ui_search"
                config={icons}
                className="h-4 w-4 text-slate-400"
                fallback={null}
              />
            </div>
            <input
              ref={inputRef}
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="بحث — محل، رقم، هاتف…"
              className="min-h-[44px] min-w-0 flex-1 rounded-xl border border-sky-200 bg-white pr-9 pl-3 py-2 text-base text-slate-800 outline-none placeholder:text-slate-400 focus:border-sky-500 focus:ring-2 focus:ring-sky-200 sm:min-h-[48px] sm:text-lg"
              dir="rtl"
              autoComplete="off"
              enterKeyHint="search"
            />
            <button
              type="button"
              onClick={() => {
                setSearchOpen(false);
                setQuery("");
              }}
              className="shrink-0 rounded-xl border border-red-500 bg-red-600 px-3 text-sm font-bold text-white shadow-sm hover:bg-red-700"
              aria-label="إغلاق البحث"
            >
              ✕
            </button>
          </div>
        </div>
      ) : null}

      <PreparerOrderTable
        rows={filteredRows}
        auth={auth}
        tab={tab}
        qSearch={query}
        couriers={couriersForBulkAssign}
        icons={icons}
      />

      <p className={`${ad.orderListCountFooter} px-3 pb-3 sm:px-4`}>
        عدد الطلبات في هذا العرض:{" "}
        <span className="font-bold text-sky-900">{filteredRows.length}</span>
      </p>
    </>
  );
}
