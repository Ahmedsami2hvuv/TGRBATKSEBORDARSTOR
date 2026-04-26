"use client";

import { useMemo, useState, useCallback, useActionState, type MouseEvent } from "react";
import Link from "next/link";
import { ad } from "@/lib/admin-ui";
import { formatDinarAsAlfWithUnit } from "@/lib/money-alf";
import { ADMIN_MONEY_HARD_DELETE_CONFIRM_PHRASE } from "@/lib/mandoub-cash-constants";
import {
  hardDeleteWalletLedgerRow,
  softDeleteWalletLedgerRow,
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

  const filteredRows = useMemo(() => {
    if (!normalizedQuery) return rows;
    return rows.filter((row) => row.searchText.includes(normalizedQuery));
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
  const returnUrl = typeof window !== "undefined" ? window.location.pathname + window.location.search : "/admin/reports/invoices";

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
              placeholder="مبلغ، رقم طلب، اسم مندوب، حالة، وقت، تاريخ"
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
              <th className="px-4 py-3 border-b border-slate-200">الوقت</th>
              <th className="px-4 py-3 border-b border-slate-200">النوع</th>
              <th className="px-4 py-3 border-b border-slate-200">الحالة</th>
              <th className="px-4 py-3 border-b border-slate-200">الطلب / الطرف</th>
              <th className="px-4 py-3 border-b border-slate-200">مندوب / مجز</th>
              <th className="px-4 py-3 border-b border-slate-200">المبلغ</th>
              <th className="px-4 py-3 border-b border-slate-200">تفاصيل</th>
              <th className="px-4 py-3 border-b border-slate-200">إجراءات</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredRows.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-14 text-center text-slate-400 font-bold">
                  لا توجد فواتير لهذا اليوم.
                </td>
              </tr>
            ) : (
              filteredRows.map((row) => {
                const orderLink = row.orderId ? `/admin/orders/${row.orderId}` : undefined;

                return (
                  <tr key={row.id} className={`transition hover:bg-slate-50 ${row.rowColorClass}`}>
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
                      {row.deleted ? null : row.id.startsWith("wt:") ? null : (
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
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
