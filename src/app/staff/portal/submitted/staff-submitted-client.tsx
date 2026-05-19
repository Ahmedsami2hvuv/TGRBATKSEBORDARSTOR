"use client";

import { UnifiedOrderListTable } from "@/components/unified-order-list-table";
import type { MandoubRow } from "@/app/mandoub/mandoub-order-table";
import { cancelStaffPreparationDraft } from "../actions";
import { useFormState } from "react-dom";
import { useEffect, useState } from "react";
import Link from "next/link";

export function StaffSubmittedClient({
  rows,
  authQ,
}: {
  rows: MandoubRow[];
  authQ: string;
}) {
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [state, formAction] = useFormState(cancelStaffPreparationDraft, {});

  const params = new URLSearchParams(authQ);

  useEffect(() => {
    if (state.ok || state.error) {
      setCancellingId(null);
      if (state.error) alert(state.error);
    }
  }, [state]);

  return (
    <div className="space-y-4">
      <UnifiedOrderListTable
        rows={rows}
        colCount={9}
        showSelectColumn={true}
        isRowSelectable={() => true}
        isSelected={() => false}
        allSelected={false}
        onToggleAll={() => {}}
        onToggleOne={() => {}}
        onOpenRow={(id) => {
          window.location.href = `/staff/portal/submitted/${id}?${authQ}`;
        }}
        selectAllTitle=""
        selectAllAriaLabel=""
        selectedTitle=""
        selectedAriaPrefix=""
        showStatusDotInSelectCol={true}
        renderBelowOrderId={(row) => {
          if (row.orderStatus === "sent" || row.orderStatus === "archived") return null;
          return (
            <div className="flex flex-col gap-1 mt-1">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (!confirm("هل أنت متأكد من رفض هذا الطلب؟")) return;
                  setCancellingId(row.id);
                  const fd = new FormData();
                  fd.set("draftId", row.id);
                  fd.set("se", params.get("se") || "");
                  fd.set("exp", params.get("exp") || "");
                  fd.set("s", params.get("s") || "");
                  formAction(fd);
                }}
                disabled={cancellingId === row.id}
                className="rounded-full bg-rose-600 px-2 py-1 text-[10px] font-bold text-white shadow-sm hover:bg-rose-700 disabled:opacity-50"
              >
                {cancellingId === row.id ? "..." : "رفض"}
              </button>
            </div>
          );
        }}
        renderSelectActions={(row) => {
          if (row.orderStatus === "sent" || row.orderStatus === "archived") return null;
          return (
            <div className="flex flex-col gap-1 mt-1">
              <Link
                href={`/staff/portal/submitted/${row.id}?${authQ}`}
                onClick={(e) => e.stopPropagation()}
                className="rounded bg-sky-50 px-1 py-0.5 text-[10px] font-bold text-sky-600 border border-sky-200 text-center hover:bg-sky-100"
              >
                تعديل
              </Link>
            </div>
          );
        }}
      />
    </div>
  );
}

