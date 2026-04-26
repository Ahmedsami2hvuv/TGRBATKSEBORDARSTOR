"use client";

import { useEffect, useMemo, useState } from "react";
import { ad } from "@/lib/admin-ui";
import {
  mandoubOrderMatchesSmartQuery,
  type MandoubOrderSearchFields,
} from "@/lib/mandoub-order-smart-filter";
import type { MandoubRow } from "@/app/mandoub/mandoub-order-table";
import { PreparerOrderTable } from "./preparer-order-table";

export function PreparerOrdersSection({
  allRows,
  searchFields,
  auth,
  tab,
  initialQuery = "",
  couriersForBulkAssign = [],
}: {
  allRows: MandoubRow[];
  searchFields: MandoubOrderSearchFields[];
  auth: { p: string; exp: string; s: string };
  tab: string;
  /** من عنوان الصفحة (?q=) عند العودة من تفاصيل الطلب */
  initialQuery?: string;
  /** مندوبون متاحون للإسناد — يفعّل التحديد المتعدد في الجدول */
  couriersForBulkAssign?: { id: string; name: string }[];
}) {
  const [query, setQuery] = useState(initialQuery);

  useEffect(() => {
    setQuery(initialQuery);
  }, [initialQuery]);

  const filteredRows = useMemo(() => {
    const paired = allRows.map((r, i) => ({ r, f: searchFields[i] }));
    if (!query.trim()) return paired.map((p) => p.r);
    return paired
      .filter(({ f }) => !!f && mandoubOrderMatchesSmartQuery(query, f!))
      .map((p) => p.r);
  }, [allRows, searchFields, query]);

  return (
    <>
      <div className="flex flex-col gap-2 border-b border-sky-100 px-2 py-2.5 sm:flex-row sm:items-center sm:justify-between sm:gap-3 sm:px-4 sm:py-3">
        <h2 className="order-2 shrink-0 text-center text-base font-black text-slate-900 sm:order-1 sm:text-end sm:text-lg">
          الطلبات
        </h2>
        <div
          className="order-1 flex w-full flex-row items-stretch gap-2 sm:order-2 sm:max-w-2xl sm:flex-1"
          dir="rtl"
        >
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="بحث — محل، رقم، هاتف…"
            className="min-h-[44px] min-w-0 flex-1 rounded-xl border border-sky-200 bg-white px-3 py-2 text-base text-slate-800 outline-none placeholder:text-slate-400 focus:border-sky-500 focus:ring-2 focus:ring-sky-200 sm:min-h-[48px] sm:text-lg"
            dir="rtl"
            autoComplete="off"
            enterKeyHint="search"
          />
        </div>
      </div>

      <PreparerOrderTable
        rows={filteredRows}
        auth={auth}
        tab={tab}
        qSearch={query}
        couriers={couriersForBulkAssign}
      />

      <p className={`${ad.orderListCountFooter} px-3 pb-3 sm:px-4`}>
        عدد الطلبات في هذا العرض:{" "}
        <span className="font-bold text-sky-900">{filteredRows.length}</span>
      </p>
    </>
  );
}
