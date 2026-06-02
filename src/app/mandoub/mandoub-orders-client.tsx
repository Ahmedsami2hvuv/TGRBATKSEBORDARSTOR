"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ad } from "@/lib/admin-ui";
import {
  mandoubOrderMatchesSmartQuery,
  type MandoubOrderSearchFields,
} from "@/lib/mandoub-order-smart-filter";
import { MandoubOrderTable, type MandoubRow } from "./mandoub-order-table";

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
}: {
  allRows: MandoubRow[];
  searchFields: MandoubOrderSearchFields[];
  auth: { c: string; exp: string; s: string };
  tab: string;
  /** توقيع طوابع الطلبات من الخادم — للكشف عن تعديل الإدارة وتحديث القائمة */
  listOrdersStampSig: string;
  walletData: any;
}) {
  const [query, setQuery] = useState("");
  const searchParams = useSearchParams();
  const activeOrderId = searchParams.get("activeOrderId");

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

  return (
    <>
      <MandoubOrderTable
        rows={filteredRows}
        auth={auth}
        tab={tab}
        qSearch={query}
        onSearchChange={setQuery}
        listOrdersStampSig={listOrdersStampSig}
        walletData={walletData}
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
