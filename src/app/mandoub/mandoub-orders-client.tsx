"use client";

import { useMemo, useState } from "react";
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
}: {
  allRows: MandoubRow[];
  searchFields: MandoubOrderSearchFields[];
  auth: { c: string; exp: string; s: string };
  tab: string;
}) {
  const [query, setQuery] = useState("");

  const filteredRows = useMemo(() => {
    const paired = allRows
      .map((r, i) => ({ r, f: searchFields[i] }))
      .filter(({ r }) => isMandoubActiveListStatus(r.orderStatus, tab));
    if (!query.trim()) return paired.map((p) => p.r);
    return paired
      .filter(({ f }) => !!f && mandoubOrderMatchesSmartQuery(query, f!))
      .map((p) => p.r);
  }, [allRows, searchFields, query, tab]);

  return (
    <>
      <MandoubOrderTable
        rows={filteredRows}
        auth={auth}
        tab={tab}
        qSearch={query}
        onSearchChange={setQuery}
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
