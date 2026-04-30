"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  bulkSetMandoubOrdersStatus,
  type MandoubBulkStatusState,
} from "./actions";
import { UnifiedOrderListTable } from "@/components/unified-order-list-table";

export type MandoubRow = {
  id: string;
  shortId: string;
  /** حالة الطلب في الخادم — لا تُعرض في «كل الطلبات» إن كانت مؤرشفة */
  orderStatus: string;
  /** اسم المندوب المسند (للإدارة/المجهز) */
  assignedCourierName?: string;
  shopName: string;
  /** فئات Tailwind لاسم المحل حسب حالة الطلب (أحمر / برتقالي / أخضر) */
  shopNameHighlightClass: string;
  regionLine: string;
  orderType: string;
  priceStr: string;
  delStr: string;
  customerPhone: string;
  timeLine: string;
  statusAr: string;
  statusClass: string;
  hasCustomerLocation: boolean;
  /** لوكيشن الزبون مرفوع من المندوب بزر GPS (customerLocationSetByCourierAt) */
  hasCourierUploadedLocation: boolean;
  /** معاملة مالية حُذفت يدوياً — شارة صغيرة بجانب رقم الطلب */
  hasMoneyDeletedBadge?: boolean;
  /** كل شي واصل — لا نقد من الزبون للمندوب */
  prepaidAll?: boolean;
  /** طلب عكسي — تنبيه: استلام من الزبون وتسليم للعميل */
  reversePickup?: boolean;
  /** دفع للعميل (المجهز للطلب) مكتمل */
  pickupComplete?: boolean;
  /** معرف المندوب المسند */
  assignedCourierId?: string | null;
  /** سعر الطلب (بدون توصيل) بالدينار */
  orderSubtotalDinar?: number | null;
  /** مجموع ما تم دفعه للعميل بالدينار */
  pickupSumDinar?: number;
  /** تنبيهات مالية */
  wardMismatchType?: "excess" | "deficit" | null;
  saderMismatchType?: "excess" | "deficit" | null;
  /** لم يتم تسجيل أي وارد (مهم للتسليم) */
  noWardRecorded?: boolean;
  /** لم يتم تسجيل أي صادر (مهم للاستلام) */
  noSaderRecorded?: boolean;
  createdAt?: Date | string;
  /** ميزات الوصول السريع من خارج الطلب */
  audioUrl?: string | null;
  summary?: string | null;
  shopPhone?: string | null;
  alternatePhone?: string | null;
  secondCustomerPhone?: string | null;
  shopLocationUrl?: string | null;
  customerLocationUrl?: string | null;
  secondCustomerLocationUrl?: string | null;
  shopDoorPhotoUrl?: string | null;
  customerDoorPhotoUrl?: string | null;
  secondCustomerDoorPhotoUrl?: string | null;
  routeMode?: "single" | "double";
  /** تسجيل صوتي من العميل (المجهز) */
  preparerAudioUrl?: string | null;
  /** تسجيل صوتي من الإدارة */
  adminAudioUrl?: string | null;
};

function buildOrderDetailHref(
  auth: { c: string; exp: string; s: string },
  tab: string,
  q: string,
  orderId: string,
) {
  const p = new URLSearchParams();
  if (auth.c) p.set("c", auth.c);
  if (auth.exp) p.set("exp", auth.exp);
  if (auth.s) p.set("s", auth.s);
  p.set("tab", tab);
  if (q.trim()) p.set("q", q.trim());
  return `/mandoub/order/${orderId}?${p.toString()}`;
}

const initialBulk: MandoubBulkStatusState = {};

export function MandoubOrderTable({
  rows,
  auth,
  tab,
  qSearch,
  onSearchChange,
}: {
  rows: MandoubRow[];
  auth: { c: string; exp: string; s: string };
  tab: string;
  qSearch: string;
  onSearchChange: (q: string) => void;
}) {
  const router = useRouter();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showQuickSelect, setShowQuickSelect] = useState(false);
  const [bulkState, bulkAction, bulkPending] = useActionState(
    bulkSetMandoubOrdersStatus,
    initialBulk,
  );
  const rowIds = useMemo(() => rows.map((r) => r.id), [rows]);
  const allSelected = rowIds.length > 0 && rowIds.every((id) => selectedIds.has(id));

  useEffect(() => {
    if (bulkState.ok) {
      setSelectedIds(new Set());
      router.refresh();
    }
  }, [bulkState.ok, router]);

  useEffect(() => {
    setSelectedIds((prev) => {
      const next = new Set<string>();
      for (const id of prev) {
        if (rowIds.includes(id)) next.add(id);
      }
      return next;
    });
  }, [rowIds]);

  function toggleOne(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(rowIds));
    }
  }

  function selectByVisibleStatus(status: "all" | "assigned" | "delivering" | "delivered") {
    if (status === "all") {
      setSelectedIds(new Set(rowIds));
      return;
    }
    setSelectedIds(
      new Set(rows.filter((r) => r.orderStatus === status).map((r) => r.id)),
    );
  }

  const quickBtnClass =
    "min-h-[40px] shrink-0 rounded-lg border border-red-200 bg-white px-2.5 py-1.5 text-xs font-bold text-red-950 shadow-sm hover:bg-red-50 sm:px-3 sm:text-sm";

  return (
    <div>
      {bulkState.error ? (
        <div className="mb-3 rounded-xl border border-rose-300 bg-rose-50 px-3 py-2 text-sm font-bold text-rose-900">
          {bulkState.error}
        </div>
      ) : null}

      <div className="px-2 py-2 sm:px-3">
        <div className="flex flex-wrap items-center gap-2">
          {rowIds.length > 0 && (
            <button
              type="button"
              onClick={() => setShowQuickSelect((v) => !v)}
              className="flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-bold text-red-900 hover:bg-red-100"
            >
              ⚡ تحديد سريع
              <span className="text-red-400">{showQuickSelect ? "▲" : "▼"}</span>
            </button>
          )}
          <div className="min-w-0 flex-1 relative">
            <input
              type="search"
              value={qSearch}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="بحث — محل، رقم، هاتف…"
              className="h-[40px] w-full rounded-xl border border-sky-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none placeholder:text-slate-400 focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
              dir="rtl"
              autoComplete="off"
              enterKeyHint="search"
            />
          </div>
        </div>

        {showQuickSelect && rowIds.length > 0 && (
          <div className="mt-2 rounded-xl border border-red-100 bg-red-50/40 px-2 py-2 sm:px-3">
            <p className="mb-1.5 text-[11px] font-bold text-red-900/90 sm:text-xs">
              اختر طلبات بحالة معيّنة ثم غيّر الحالة من الشريط السفلي
            </p>
            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
              <button
                type="button"
                onClick={() => selectByVisibleStatus("all")}
                className={quickBtnClass}
              >
                تحديد الكل
              </button>
              <button
                type="button"
                onClick={() => selectByVisibleStatus("assigned")}
                className={quickBtnClass}
              >
                بانتظار المندوب
              </button>
              <button
                type="button"
                onClick={() => selectByVisibleStatus("delivering")}
                className={quickBtnClass}
              >
                تم الاستلام
              </button>
              <button
                type="button"
                onClick={() => selectByVisibleStatus("delivered")}
                className={quickBtnClass}
              >
                تم التسليم
              </button>
              <button
                type="button"
                onClick={() => setSelectedIds(new Set())}
                className="min-h-[44px] rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-50 sm:text-sm"
              >
                إفراغ
              </button>
            </div>
          </div>
        )}
      </div>

      <UnifiedOrderListTable
        rows={rows}
        colCount={9}
        showSelectColumn={showQuickSelect}
        isRowSelectable={() => true}
        isSelected={(id) => selectedIds.has(id)}
        allSelected={allSelected}
        onToggleAll={toggleAll}
        onToggleOne={toggleOne}
        onOpenRow={(id) => router.push(buildOrderDetailHref(auth, tab, qSearch, id))}
        selectAllTitle="تحديد الكل"
        selectAllAriaLabel="تحديد كل الطلبات الظاهرة"
        selectedTitle="تحديد"
        selectedAriaPrefix="تحديد الطلب"
        showStatusDotInSelectCol={false}
        renderOrderIdBadge={() => null}
      />

      {selectedIds.size > 0 ? (
        <form
          action={bulkAction}
          className="fixed bottom-0 left-0 right-0 z-40 border-t border-red-200 bg-gradient-to-t from-red-50/98 to-white px-3 py-3 shadow-[0_-4px_20px_rgba(127,29,29,0.12)] sm:px-4"
        >
          <input type="hidden" name="c" value={auth.c} />
          <input type="hidden" name="exp" value={auth.exp} />
          <input type="hidden" name="s" value={auth.s} />
          <input type="hidden" name="orderIds" value={Array.from(selectedIds).join(",")} />
          <div className="mx-auto flex max-w-6xl flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
            <p className="text-center text-sm font-bold text-red-950 sm:text-right">
              تم تحديد{" "}
              <span className="tabular-nums text-red-800">{selectedIds.size}</span> طلباً — اضغط اللون
              المناسب:
            </p>
            <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-end">
              <button
                type="submit"
                name="targetStatus"
                value="assigned"
                disabled={bulkPending}
                className="shrink-0 rounded-xl border-2 border-red-600 bg-red-50 px-4 py-2 text-xs font-bold text-red-900 shadow-sm transition hover:bg-red-100 disabled:opacity-50 sm:text-sm"
              >
                بانتظار المندوب
              </button>
              <button
                type="submit"
                name="targetStatus"
                value="delivering"
                disabled={bulkPending}
                className="shrink-0 rounded-xl border-2 border-amber-500 bg-amber-50 px-4 py-2 text-xs font-bold text-amber-950 shadow-sm transition hover:bg-amber-100 disabled:opacity-50 sm:text-sm"
              >
                تم الاستلام
              </button>
              <button
                type="submit"
                name="targetStatus"
                value="delivered"
                disabled={bulkPending}
                className="shrink-0 rounded-xl border-2 border-emerald-600 bg-emerald-50 px-4 py-2 text-xs font-bold text-emerald-950 shadow-sm transition hover:bg-emerald-100 disabled:opacity-50 sm:text-sm"
              >
                تم التسليم
              </button>
              <button
                type="button"
                onClick={() => setSelectedIds(new Set())}
                className="min-h-[44px] rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50"
              >
                ✕
              </button>
            </div>
          </div>
          {bulkPending ? (
            <p className="mt-2 text-center text-xs font-semibold text-red-800">جارٍ التحديث…</p>
          ) : null}
        </form>
      ) : null}
    </div>
  );
}
