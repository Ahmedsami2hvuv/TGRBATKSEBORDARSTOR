"use client";

import { useMemo, useState, useCallback, useActionState, type MouseEvent } from "react";
import Link from "next/link";
import { ad } from "@/lib/admin-ui";
import { formatDinarAsAlfWithUnit } from "@/lib/money-alf";
import { ADMIN_MONEY_HARD_DELETE_CONFIRM_PHRASE } from "@/lib/mandoub-cash-constants";
import {
  hardDeleteWalletLedgerRow,
  softDeleteWalletLedgerRow,
  batchHardDeleteWalletLedgerRows,
  type WalletLedgerDeleteState,
} from "./actions";
import type { InvoiceReportRow } from "./page";

type Props = {
  rows: InvoiceReportRow[];
  initialQuery?: string;
  selectedDayIso: string;
};

function normalizeSearchValue(value?: string): string {
  if (!value) return "";
  return value
    .toString()
    .replace(/[٠-٩]/g, (d) => "٠١٢٣٤٥٦٧٨٩".indexOf(d).toString())
    .trim()
    .toLowerCase();
}

export default function InvoiceReportSearch({ rows, initialQuery, selectedDayIso }: Props) {
  const [query, setQuery] = useState(initialQuery ?? "");
  const normalizedQuery = useMemo(() => normalizeSearchValue(query), [query]);
  const [softState, softAction, softPending] = useActionState(softDeleteWalletLedgerRow, {} as WalletLedgerDeleteState);
  const [hardState, hardAction, hardPending] = useActionState(hardDeleteWalletLedgerRow, {} as WalletLedgerDeleteState);
  const [batchHardState, batchHardAction, batchHardPending] = useActionState(batchHardDeleteWalletLedgerRows, {} as WalletLedgerDeleteState);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const filteredRows = useMemo(() => {
    if (!normalizedQuery) return rows;
    const tokens = normalizedQuery.split(/\s+/).filter(Boolean);
    return rows.filter((row) =>
      tokens.every((token) => row.searchText.includes(token))
    );
  }, [normalizedQuery, rows]);

  const activeFilteredRows = useMemo(
    () => filteredRows.filter((row) => !row.deleted),
    [filteredRows],
  );
  const deletedFilteredCount = useMemo(
    () => filteredRows.filter((row) => row.deleted).length,
    [filteredRows],
  );
  const totalInvoices = activeFilteredRows.length;
  const totalAmount = useMemo(
    () => activeFilteredRows.reduce((sum, row) => sum + row.amountDinar, 0),
    [activeFilteredRows],
  );

  const returnUrl = useMemo(() => {
    const params = new URLSearchParams();
    params.set("day", selectedDayIso);
    if (query.trim()) params.set("q", query.trim());
    return `/abo1stor3hlaa2kbr8-47/reports/invoices?${params.toString()}`;
  }, [selectedDayIso, query]);

  const handleHardDeleteClick = useCallback((event: MouseEvent<HTMLButtonElement>) => {
    const phrase = window.prompt(`اكتب "${ADMIN_MONEY_HARD_DELETE_CONFIRM_PHRASE}" للتأكيد:`)?.trim() ?? "";
    if (phrase !== ADMIN_MONEY_HARD_DELETE_CONFIRM_PHRASE) {
      event.preventDefault();
      return;
    }
    const form = event.currentTarget.form;
    const input = form?.querySelector<HTMLInputElement>("input[name='confirmPhrase']");
    if (input) input.value = phrase;
    if (!window.confirm("هل أنت متأكد من الحذف النهائي؟ لا يمكن الاسترجاع.")) {
      event.preventDefault();
    }
  }, []);

  const toggleAll = useCallback(() => {
    const checkableRows = filteredRows.filter(r => !r.id.startsWith("wt:"));
    if (selectedIds.size === checkableRows.length && checkableRows.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(checkableRows.map((r) => r.id)));
    }
  }, [filteredRows, selectedIds]);

  return (
    <>
      <div className={`${ad.section} rounded-3xl border border-slate-200 bg-white p-6 shadow-sm`}>
        <div className="grid gap-3 sm:grid-cols-[1fr_auto] items-end">
          <label className="flex flex-col gap-2">
            <span className={ad.label}>بحث فوري</span>
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="مبلغ، رقم طلب، اسم مندوب أو مجهز أو مورد، حالة، وقت، تاريخ"
              className={ad.input}
            />
          </label>
          <div className="text-right">
            <p className={ad.label}>اليوم</p>
            <p className="mt-2 text-base font-black text-slate-900">{selectedDayIso}</p>
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-3xl border border-slate-200 bg-emerald-50 p-4 text-center">
          <p className="text-xs font-black uppercase tracking-widest text-emerald-700">عدد الفواتير</p>
          <p className="mt-2 text-3xl font-black text-emerald-900">{totalInvoices}</p>
          {deletedFilteredCount > 0 ? (
            <p className="mt-2 text-xs text-slate-500">ملغاة: {deletedFilteredCount}</p>
          ) : null}
        </div>
        <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4 text-center">
          <p className="text-xs font-black uppercase tracking-widest text-slate-500">إجمالي المبالغ</p>
          <p className="mt-2 text-3xl font-black text-slate-900">{formatDinarAsAlfWithUnit(totalAmount)}</p>
        </div>
        <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4 text-center">
          <p className="text-xs font-black uppercase tracking-widest text-slate-500">حالة البحث</p>
          <p className="mt-2 text-sm text-slate-600">{query ? `يبحث عن: ${query}` : "يعرض الكل"}</p>
        </div>
      </div>

      <div className="overflow-x-auto rounded-3xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full text-right text-sm">
          <thead className="bg-slate-50 text-[11px] uppercase tracking-widest text-slate-500">
            <tr>
              <th className="px-4 py-3 border-b border-slate-200">
                <input
                  type="checkbox"
                  onChange={toggleAll}
                  checked={
                    filteredRows.filter((r) => !r.id.startsWith("wt:")).length > 0 &&
                    selectedIds.size === filteredRows.filter((r) => !r.id.startsWith("wt:")).length
                  }
                />
              </th>
              <th className="px-4 py-3 border-b border-slate-200">الوقت</th>
              <th className="px-4 py-3 border-b border-slate-200">النوع</th>
              <th className="px-4 py-3 border-b border-slate-200">الحالة</th>
              <th className="px-4 py-3 border-b border-slate-200">الطلب / الطرف</th>
              <th className="px-4 py-3 border-b border-slate-200">المنفذ (مندوب / مجهز / مورد)</th>
              <th className="px-4 py-3 border-b border-slate-200">المبلغ</th>
              <th className="px-4 py-3 border-b border-slate-200">تفاصيل</th>
              <th className="px-4 py-3 border-b border-slate-200">إجراءات</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredRows.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-14 text-center text-slate-400 font-bold">
                  لا توجد فواتير لهذا اليوم.
                </td>
              </tr>
            ) : (
              filteredRows.map((row) => {
                const orderLink = row.orderId ? `/abo1stor3hlaa2kbr8-47/orders/${row.orderId}` : undefined;

                return (
                  <tr
                    key={row.id}
                    className={`transition hover:bg-slate-50 ${row.rowColorClass} ${orderLink ? "cursor-pointer" : ""}`}
                    onClick={(e) => {
                      const target = e.target as HTMLElement;
                      if (
                        orderLink &&
                        !target.closest("input[type='checkbox']") &&
                        !target.closest("button") &&
                        !target.closest("form") &&
                        !target.closest("a")
                      ) {
                        window.location.href = orderLink;
                      }
                    }}
                  >
                    <td className="px-4 py-3 text-center">
                      {!row.id.startsWith("wt:") && (
                        <input
                          type="checkbox"
                          checked={selectedIds.has(row.id)}
                          onChange={(e) => {
                            const newSet = new Set(selectedIds);
                            if (e.target.checked) {
                              newSet.add(row.id);
                            } else {
                              newSet.delete(row.id);
                            }
                            setSelectedIds(newSet);
                          }}
                        />
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-700 font-semibold">{row.timeLabel}</td>
                    <td className="px-4 py-3 font-black text-slate-900">{row.typeLabel}</td>
                    <td className="px-4 py-3 text-slate-600">{row.status}</td>
                    <td className="px-4 py-3 text-slate-800">
                      {orderLink ? <Link href={orderLink} className="font-bold text-slate-900 hover:text-slate-700">طلب #{row.orderNumber}</Link> : row.sourceLabel}
                    </td>
                    <td className="px-4 py-3 text-slate-700">{row.courierName}</td>
                    <td className={`px-4 py-3 font-black ${row.amountColorClass}`}>{formatDinarAsAlfWithUnit(row.amountDinar)}</td>
                    <td className="px-4 py-3 text-slate-600">{row.details}</td>
                    <td className="px-4 py-3 text-left space-y-2">
                      {row.id.startsWith("wt:") ? null : (
                        <>
                          {!row.deleted && (
                            <form action={softAction} className="inline-block w-full">
                              <input type="hidden" name="rowId" value={row.id} />
                              <input type="hidden" name="returnUrl" value={returnUrl} />
                              <button
                                type="submit"
                                disabled={softPending}
                                className="inline-flex w-full items-center justify-center rounded-2xl bg-amber-600 px-3 py-1 text-[11px] font-black text-white transition hover:bg-amber-700 disabled:opacity-50"
                                onClick={(event) => {
                                  if (!window.confirm("هل تريد التأكيد على إلغاء الفاتورة؟ سيتم إبقاؤها كمعاملة ملغاة.")) {
                                    event.preventDefault();
                                  }
                                }}
                              >
                                إلغاء
                              </button>
                            </form>
                          )}
                          <form action={hardAction} className="inline-block w-full">
                            <input type="hidden" name="rowId" value={row.id} />
                            <input type="hidden" name="returnUrl" value={returnUrl} />
                            <input type="hidden" name="confirmPhrase" value="" />
                            <button
                              type="submit"
                              disabled={hardPending}
                              className="inline-flex w-full items-center justify-center rounded-2xl bg-rose-700 px-3 py-1 text-[11px] font-black text-white transition hover:bg-rose-800 disabled:opacity-50"
                              onClick={handleHardDeleteClick}
                            >
                              حذف نهائي
                            </button>
                          </form>
                        </>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      {filteredRows.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-4">
          <button
            type="button"
            onClick={toggleAll}
            className="inline-flex items-center rounded-2xl bg-slate-200 px-4 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-300"
          >
            {selectedIds.size === filteredRows.filter(r => !r.id.startsWith("wt:")).length && selectedIds.size > 0
              ? "إلغاء تحديد الكل"
              : "تحديد الكل"}
          </button>

          {selectedIds.size > 0 && (
            <form action={batchHardAction}>
              <input type="hidden" name="rowIds" value={Array.from(selectedIds).join(',')} />
              <input type="hidden" name="returnUrl" value={returnUrl} />
              <input type="hidden" name="confirmPhrase" value="" />
              <button
                type="submit"
                disabled={batchHardPending}
                className="inline-flex items-center rounded-2xl bg-red-800 px-4 py-2 text-sm font-black text-white transition hover:bg-red-900 disabled:opacity-50"
                onClick={handleHardDeleteClick}
              >
                حذف نهائي للمحدد ({selectedIds.size})
              </button>
            </form>
          )}
        </div>
      )}
    </>
  );
}
