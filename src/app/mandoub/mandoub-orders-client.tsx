"use client";

import { useMemo, useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { ad } from "@/lib/admin-ui";
import {
  mandoubOrderMatchesSmartQuery,
  type MandoubOrderSearchFields,
} from "@/lib/mandoub-order-smart-filter";
import { MandoubOrderTable, type MandoubRow } from "./mandoub-order-table";
import { MandoubSettingsDropdown } from "./mandoub-settings-dropdown";
import { FullscreenWalletLauncher } from "@/components/fullscreen-wallet-launcher";
import { DynamicIcon } from "@/components/dynamic-icon";
import { getGlobalIcons } from "@/lib/icon-settings";

function isMandoubActiveRowStatus(status: string | undefined): boolean {
  const s = String(status ?? "")
    .trim()
    .toLowerCase();
  return s === "assigned" || s === "delivering" || s === "delivered";
}

export function MandoubOrdersSection({
  allRows,
  searchFields,
  auth,
  tab,
  listOrdersStampSig,
  walletData,
  courierName,
  availableForAssignment,
  telegramLink,
  cashInHandStr,
}: {
  allRows: MandoubRow[];
  searchFields: MandoubOrderSearchFields[];
  auth: { c: string; exp: string; s: string };
  tab: string;
  listOrdersStampSig: string;
  walletData: any;
  courierName: string;
  availableForAssignment: boolean;
  telegramLink: string | null;
  cashInHandStr: string;
}) {
  const [query, setQuery] = useState("");
  const searchParams = useSearchParams();
  const activeOrderId = searchParams.get("activeOrderId");

  const [showQuickSelect, setShowQuickSelect] = useState(false);
  const [isSortingMode, setIsSortingMode] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [icons, setIcons] = useState<any>(null);

  useEffect(() => {
    getGlobalIcons().then(setIcons);
  }, []);

  const filteredRows = useMemo(() => {
    const paired = allRows
      .map((r, i) => ({ r, f: searchFields[i] }))
      .filter(({ r }) => isMandoubActiveListStatus(r.orderStatus, tab));
    
    let result: MandoubRow[];
    if (!query.trim()) {
      result = paired.map((p) => p.r);
    } else {
      result = paired
        .filter(({ f }) => !!f && mandoubOrderMatchesSmartQuery(query, f!))
        .map((p) => p.r);
    }

    // Force active order to be in filteredRows to prevent details modal from closing
    if (activeOrderId) {
      const activeRow = allRows.find((r) => r.id === activeOrderId);
      if (activeRow && !result.some((r) => r.id === activeOrderId)) {
        result = [activeRow, ...result];
      }
    }
    return result;
  }, [allRows, searchFields, query, tab, activeOrderId]);

  const baseQuery = new URLSearchParams();
  if (auth.c) baseQuery.set("c", auth.c);
  if (auth.exp) baseQuery.set("exp", auth.exp);
  if (auth.s) baseQuery.set("s", auth.s);

  return (
    <>
      <header className="kse-glass-dark mb-3 flex items-center justify-between gap-2 border border-sky-200/90 px-3 py-2.5 shadow-sm rounded-2xl">
        <div className="flex flex-wrap items-center gap-2">
          <MandoubSettingsDropdown
            auth={auth}
            availableForAssignment={availableForAssignment}
            telegramLink={telegramLink}
            baseQueryString={baseQuery.toString()}
          />

          {allRows.length > 0 && (
            <button
              type="button"
              onClick={() => setShowQuickSelect((v) => !v)}
              className={`flex h-10 w-10 items-center justify-center rounded-xl border transition-all hover:scale-105 active:scale-95 ${
                showQuickSelect
                  ? "bg-red-600 border-red-700 text-white shadow-inner animate-pulse"
                  : "bg-red-50 border-red-200 text-red-900 hover:bg-red-100"
              }`}
              title="تحديد سريع"
            >
              <DynamicIcon iconKey="ui_success" config={icons} className="w-5 h-5" fallback="✅" />
            </button>
          )}

          {allRows.length > 1 && (
            <button
              type="button"
              onClick={() => setIsSortingMode((v) => !v)}
              className={`flex h-10 w-10 items-center justify-center rounded-xl border transition-all hover:scale-105 active:scale-95 ${
                isSortingMode
                  ? "bg-indigo-600 border-indigo-700 text-white shadow-inner"
                  : "bg-indigo-50 border-indigo-200 text-indigo-900 hover:bg-indigo-100"
              }`}
              title="ترتيب المسار"
            >
              <DynamicIcon iconKey="ui_sort" config={icons} className="w-5 h-5" fallback="⇅" />
            </button>
          )}

          {allRows.length > 0 && (
            <button
              type="button"
              onClick={() => setShowSearch((v) => !v)}
              className={`flex h-10 w-10 items-center justify-center rounded-xl border transition-all hover:scale-105 active:scale-95 ${
                showSearch
                  ? "bg-sky-600 border-sky-700 text-white shadow-inner"
                  : "bg-sky-50 border-sky-200 text-sky-900 hover:bg-sky-100"
              }`}
              title="البحث"
            >
              <DynamicIcon iconKey="ui_search" config={icons} className="w-5 h-5" fallback="🔍" />
            </button>
          )}

          <div className="flex items-center gap-1.5 px-3 bg-slate-100 dark:bg-[rgba(255,255,255,0.05)] border border-slate-200 dark:border-[#00f3ff]/30 rounded-xl h-10 text-sm font-black text-slate-800 dark:text-[#00f3ff]">
            <DynamicIcon iconKey="ui_user" config={icons} className="w-4 h-4 text-sky-600" fallback="👤" />
            <span className="truncate max-w-[120px]">{courierName}</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <FullscreenWalletLauncher
            href={`/mandoub/wallet?${baseQuery.toString()}`}
            className="inline-flex shrink-0 items-center justify-center rounded-xl border-2 border-violet-500 bg-violet-600 px-2 py-1.5 text-center text-sm font-black text-white shadow-sm hover:bg-violet-700 h-10 min-w-[60px]"
            title="محفظة المندوب"
          >
            <span className="text-sm font-black text-white" dir="ltr">
              {cashInHandStr}
            </span>
          </FullscreenWalletLauncher>
        </div>
      </header>

      <MandoubOrderTable
        rows={filteredRows}
        auth={auth}
        tab={tab}
        qSearch={query}
        onSearchChange={setQuery}
        listOrdersStampSig={listOrdersStampSig}
        walletData={walletData}
        courierName={courierName}
        showQuickSelect={showQuickSelect}
        setShowQuickSelect={setShowQuickSelect}
        isSortingMode={isSortingMode}
        setIsSortingMode={setIsSortingMode}
        showSearch={showSearch}
        setShowSearch={setShowSearch}
      />

      <p className={`${ad.orderListCountFooter} px-3 pb-3 sm:px-4`}>
        عدد الطلبات في هذا العرض:{" "}
        <span className="font-bold text-sky-900">{filteredRows.length}</span>
      </p>
    </>
  );
}

function isMandoubActiveListStatus(status: string, tab: string): boolean {
  if (tab === "archived") return status === "archived";
  return status === "assigned" || status === "delivering" || status === "delivered";
}
