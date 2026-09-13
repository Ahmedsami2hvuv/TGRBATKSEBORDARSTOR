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
  customWaButtons,
  initialCustomSortIds,
  courierSettings,
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
  customWaButtons?: any[];
  initialCustomSortIds?: string[];
  courierSettings?: any;
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
      {/* شريط التحكم العلوي الملكي الفاخر للمندوب بنانو بنانا */}
      <header
        className="mb-3 flex flex-nowrap items-center justify-between gap-1.5 sm:gap-2 px-2.5 sm:px-3.5 py-2 rounded-2xl border-2 border-[#C9A86A] bg-gradient-to-r from-[#0F4D3A] via-[#0A3D2E] to-[#0F4D3A] shadow-[0_4px_20px_rgba(10,61,46,0.35)] select-none text-white"
        dir="rtl"
      >
        {/* الجانب الأيمن: أزرار التحكم الفاخرة والقائمة */}
        <div className="flex flex-nowrap items-center gap-1.5 sm:gap-2 shrink-0">
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
              className={`flex h-9 w-9 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-xl border-2 transition-all hover:scale-105 active:scale-95 shadow-md cursor-pointer ${
                showQuickSelect
                  ? "bg-rose-600 border-[#F5D77F] text-white shadow-inner animate-pulse"
                  : "bg-[#132A26] border-[#C9A86A]/60 text-[#F5D77F] hover:border-[#C9A86A] hover:bg-[#1E3E39]"
              }`}
              title="تحديد سريع"
            >
              <DynamicIcon iconKey="ui_success" config={icons} className="w-4 h-4 sm:w-5 sm:h-5" fallback="✅" />
            </button>
          )}

          {allRows.length > 1 && (
            <button
              type="button"
              onClick={() => setIsSortingMode((v) => !v)}
              className={`flex h-9 w-9 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-xl border-2 transition-all hover:scale-105 active:scale-95 shadow-md cursor-pointer ${
                isSortingMode
                  ? "bg-amber-600 border-[#F5D77F] text-white shadow-inner animate-pulse"
                  : "bg-[#132A26] border-[#C9A86A]/60 text-[#F5D77F] hover:border-[#C9A86A] hover:bg-[#1E3E39]"
              }`}
              title="ترتيب المسار"
            >
              <DynamicIcon iconKey="ui_sort" config={icons} className="w-4 h-4 sm:w-5 sm:h-5" fallback="⇅" />
            </button>
          )}

          {allRows.length > 0 && (
            <button
              type="button"
              onClick={() => setShowSearch((v) => !v)}
              className={`flex h-9 w-9 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-xl border-2 transition-all hover:scale-105 active:scale-95 shadow-md cursor-pointer ${
                showSearch
                  ? "bg-[#C9A86A] border-white text-[#0A1A18] shadow-inner font-black"
                  : "bg-[#132A26] border-[#C9A86A]/60 text-[#F5D77F] hover:border-[#C9A86A] hover:bg-[#1E3E39]"
              }`}
              title="البحث"
            >
              <DynamicIcon iconKey="ui_search" config={icons} className="w-4 h-4 sm:w-5 sm:h-5" fallback="🔍" />
            </button>
          )}

          <button
            type="button"
            onClick={() => window.location.reload()}
            className="flex h-9 w-9 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-xl border-2 border-[#C9A86A]/60 bg-[#132A26] text-[#F5D77F] transition-all hover:scale-105 hover:border-[#C9A86A] hover:bg-[#1E3E39] active:scale-95 shadow-md cursor-pointer"
            title="تحديث الصفحة"
          >
            <DynamicIcon iconKey="ui_refresh" config={icons} className="w-4 h-4 sm:w-5 sm:h-5" fallback="🔄" />
          </button>

          {/* كبسولة اسم المندوب الملكية */}
          <div className="flex h-9 sm:h-10 shrink-0 items-center gap-1.5 px-2.5 sm:px-3 bg-[#0A1A18]/80 border-2 border-[#C9A86A]/60 rounded-xl text-xs sm:text-sm font-black text-[#F5D77F] shadow-inner">
            <span className="text-[#C9A86A]">👤</span>
            <span className="truncate max-w-[80px] sm:max-w-[120px] drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
              {courierName}
            </span>
          </div>
        </div>

        {/* الجانب الأيسر: زر المحفظة الملكي المذهب */}
        <div className="flex shrink-0 items-center gap-1.5 ms-auto">
          <FullscreenWalletLauncher
            href={`/mandoub/wallet?${baseQuery.toString()}`}
            className="inline-flex h-9 sm:h-10 shrink-0 items-center justify-center gap-1.5 rounded-xl border-2 border-[#F5D77F] bg-gradient-to-r from-[#D97706] to-[#B45309] px-2.5 sm:px-3 text-center text-xs sm:text-sm font-black text-white shadow-lg transition-transform hover:scale-105 active:scale-95 cursor-pointer min-w-[65px] sm:min-w-[85px]"
            title="محفظة المندوب"
          >
            <span className="text-sm">💰</span>
            <span className="text-xs sm:text-sm font-black text-[#FFFDF0] font-mono drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]" dir="ltr">
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
        customWaButtons={customWaButtons}
        initialCustomSortIds={initialCustomSortIds}
        courierSettings={courierSettings}
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
