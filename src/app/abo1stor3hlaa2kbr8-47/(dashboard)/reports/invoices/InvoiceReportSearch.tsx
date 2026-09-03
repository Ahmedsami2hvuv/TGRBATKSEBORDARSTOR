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
import type { InvoiceReportRow, PerformerRole } from "./page";

type Props = {
  rows: InvoiceReportRow[];
  initialQuery?: string;
  selectedDayIso: string;
};

type CategoryFilter = "all" | "courier" | "preparer" | "supplier" | "order" | "transfer" | "admin";

function normalizeSearchValue(value?: string): string {
  if (!value) return "";
  return value
    .toString()
    .replace(/[٠-٩]/g, (d) => "٠١٢٣٤٥٦٧٨٩".indexOf(d).toString())
    .trim()
    .toLowerCase();
}

export default function InvoiceReportSearch({ rows, initialQuery, selectedDayIso }: Props) {
  const [selectedCategory, setSelectedCategory] = useState<CategoryFilter>("all");
  const [selectedPerformerName, setSelectedPerformerName] = useState<string>("");
  const [query, setQuery] = useState(initialQuery ?? "");
  const normalizedQuery = useMemo(() => normalizeSearchValue(query), [query]);
  const [softState, softAction, softPending] = useActionState(softDeleteWalletLedgerRow, {} as WalletLedgerDeleteState);
  const [hardState, hardAction, hardPending] = useActionState(hardDeleteWalletLedgerRow, {} as WalletLedgerDeleteState);
  const [batchHardState, batchHardAction, batchHardPending] = useActionState(batchHardDeleteWalletLedgerRows, {} as WalletLedgerDeleteState);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // إحصائيات الأعداد حسب الفئات
  const countsByCategory = useMemo(() => {
    const counts: Record<CategoryFilter, number> = {
      all: 0,
      courier: 0,
      preparer: 0,
      supplier: 0,
      order: 0,
      transfer: 0,
      admin: 0,
    };
    for (const r of rows) {
      if (r.deleted) continue;
      counts.all++;
      if (r.performerRole === "courier") counts.courier++;
      if (r.performerRole === "preparer") counts.preparer++;
      if (r.performerRole === "supplier") counts.supplier++;
      if (r.source === "order") counts.order++;
      if (r.performerRole === "transfer") counts.transfer++;
      if (r.performerRole === "admin" || r.performerRole === "shop") counts.admin++;
    }
    return counts;
  }, [rows]);

  // قائمة أسماء المنفذين الفريدة حسب الفئة المختارة
  const performerNamesForCategory = useMemo(() => {
    const names = new Set<string>();
    for (const r of rows) {
      if (r.deleted) continue;
      if (selectedCategory === "courier" && r.performerRole !== "courier") continue;
      if (selectedCategory === "preparer" && r.performerRole !== "preparer") continue;
      if (selectedCategory === "supplier" && r.performerRole !== "supplier") continue;
      if (selectedCategory === "order" && r.source !== "order") continue;
      if (selectedCategory === "transfer" && r.performerRole !== "transfer") continue;
      if (selectedCategory === "admin" && r.performerRole !== "admin" && r.performerRole !== "shop") continue;
      if (r.courierName && r.courierName !== "غير معروف" && r.courierName !== "الإدارة") {
        names.add(r.courierName);
      }
    }
    return Array.from(names).sort();
  }, [rows, selectedCategory]);

  const filteredRows = useMemo(() => {
    return rows.filter((row) => {
      // 1. فلتر الفئة
      if (selectedCategory === "courier" && row.performerRole !== "courier") return false;
      if (selectedCategory === "preparer" && row.performerRole !== "preparer") return false;
      if (selectedCategory === "supplier" && row.performerRole !== "supplier") return false;
      if (selectedCategory === "order" && row.source !== "order") return false;
      if (selectedCategory === "transfer" && row.performerRole !== "transfer") return false;
      if (selectedCategory === "admin" && row.performerRole !== "admin" && row.performerRole !== "shop") return false;

      // 2. فلتر اختيار الاسم المحدد من القائمة
      if (selectedPerformerName && row.courierName !== selectedPerformerName) {
        return false;
      }

      // 3. فلتر البحث النصي الفوري
      if (normalizedQuery) {
        const tokens = normalizedQuery.split(/\s+/).filter(Boolean);
        const match = tokens.every((token) => row.searchText.includes(token));
        if (!match) return false;
      }

      return true;
    });
  }, [rows, selectedCategory, selectedPerformerName, normalizedQuery]);

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

  const categoryTabs: { id: CategoryFilter; label: string; icon: string }[] = [
    { id: "all", label: "الكل", icon: "📋" },
    { id: "courier", label: "المندوبين", icon: "🛵" },
    { id: "preparer", label: "المجهزين", icon: "📦" },
    { id: "supplier", label: "الموردين", icon: "🚚" },
    { id: "order", label: "فواتير الطلبات", icon: "🏪" },
    { id: "transfer", label: "التحويلات", icon: "🔄" },
    { id: "admin", label: "الإدارة والمحلات", icon: "⚙️" },
  ];

  return (
    <>
      {/* تبويبات الفلترة حسب النوع */}
      <div className="flex flex-wrap gap-2 items-center">
        {categoryTabs.map((tab) => {
          const count = countsByCategory[tab.id];
          const isSelected = selectedCategory === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                setSelectedCategory(tab.id);
                setSelectedPerformerName("");
              }}
              className={`inline-flex items-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-black transition-all shadow-sm ${
                isSelected
                  ? "bg-slate-900 text-white shadow-md scale-105"
                  : "bg-white text-slate-700 border border-slate-200 hover:bg-slate-50"
              }`}
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-black ${
                  isSelected ? "bg-slate-700 text-white" : "bg-slate-100 text-slate-600"
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      <div className={`${ad.section} rounded-3xl border border-slate-200 bg-white p-6 shadow-sm`}>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-[1fr_220px_auto] items-end">
          <label className="flex flex-col gap-2">
            <span className={ad.label}>بحث فوري في المعاملات</span>
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="ابحث بالاسم، المبلغ، رقم الطلب، الحالة، التاريخ..."
              className={ad.input}
            />
          </label>

          {performerNamesForCategory.length > 0 ? (
            <label className="flex flex-col gap-2">
              <span className={ad.label}>تحديد الاسم مباشرة</span>
              <select
                value={selectedPerformerName}
                onChange={(e) => setSelectedPerformerName(e.target.value)}
                className={ad.input}
              >
                <option value="">جميع الأسماء ({performerNamesForCategory.length})</option>
                {performerNamesForCategory.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <div className="hidden lg:block" />
          )}

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
