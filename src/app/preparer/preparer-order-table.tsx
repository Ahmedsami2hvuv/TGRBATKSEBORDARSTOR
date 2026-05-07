"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { MandoubRow } from "@/app/mandoub/mandoub-order-table";
import {
  bulkAssignOrdersByPreparer,
  type PreparerActionState,
} from "./actions";
import { UnifiedOrderListTable } from "@/components/unified-order-list-table";
import { PickupMoneyForm } from "./preparer-order-money-flow";
import { submitPreparerPickupMoney } from "./preparer-cash-actions";
import { dinarDecimalToAlfInputString } from "@/lib/money-alf";
import { createPortal } from "react-dom";
import { getGlobalIcons, GlobalIconsConfig } from "@/lib/icon-settings";
import { DynamicIcon } from "@/components/dynamic-icon";

function buildPreparerOrderDetailHref(
  auth: { p: string; exp: string; s: string },
  tab: string,
  q: string,
  orderId: string,
) {
  const p = new URLSearchParams();
  if (auth.p) p.set("p", auth.p);
  if (auth.exp) p.set("exp", auth.exp);
  if (auth.s) p.set("s", auth.s);
  p.set("tab", tab);
  if (q.trim()) p.set("q", q.trim());
  return `/preparer/order/${orderId}?${p.toString()}`;
}

function isAssignableBeforeCourierReceipt(status: string | undefined): boolean {
  const s = String(status ?? "").trim().toLowerCase();
  return s === "pending" || s === "assigned";
}

const bulkInitial: PreparerActionState = {};

export function PreparerOrderTable({
  rows,
  auth,
  tab,
  qSearch,
  couriers = [],
  icons,
}: {
  rows: MandoubRow[];
  auth: { p: string; exp: string; s: string };
  tab: string;
  qSearch: string;
  couriers?: { id: string; name: string }[];
  icons?: GlobalIconsConfig | null;
}) {
  const router = useRouter();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showQuickSelect, setShowQuickSelect] = useState(false);
  const [bulkState, bulkAction, bulkPending] = useActionState(
    bulkAssignOrdersByPreparer,
    bulkInitial,
  );
  const [payOrder, setPayOrder] = useState<MandoubRow | null>(null);
  const [assignOrder, setAssignOrder] = useState<MandoubRow | null>(null);
  const [payState, payAction, payPending] = useActionState(
    submitPreparerPickupMoney,
    {},
  );

  const prevBulkPending = useRef(false);

  const pendingIds = useMemo(
    () => rows.filter((r) => isAssignableBeforeCourierReceipt(r.orderStatus)).map((r) => r.id),
    [rows],
  );

  const showBulkRow = couriers.length > 0 && pendingIds.length > 0;
  const allPendingSelected = pendingIds.length > 0 && pendingIds.every((id) => selectedIds.has(id));

  useEffect(() => {
    if (prevBulkPending.current && !bulkPending && bulkState.ok) {
      setSelectedIds(new Set());
      router.refresh();
    }
    prevBulkPending.current = bulkPending;
  }, [bulkPending, bulkState.ok, router]);

  function toggleOne(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAllPending() {
    if (allPendingSelected) setSelectedIds(new Set());
    else setSelectedIds(new Set(pendingIds));
  }

  const prepQuickBtn =
    "min-h-[38px] shrink-0 rounded-lg border border-red-200 bg-white px-2.5 py-1.5 text-[11px] font-bold text-red-950 hover:bg-red-50 sm:text-xs";

  return (
    <div>
      {bulkState.error ? (
        <div className="mb-3 rounded-xl border border-rose-300 bg-rose-50 px-3 py-2 text-sm font-bold text-rose-900">
          {bulkState.error}
        </div>
      ) : null}

      {showBulkRow && (
        <div className="mb-2 px-2 sm:px-4">
          <button
            type="button"
            onClick={() => setShowQuickSelect((v) => !v)}
            className="mb-1.5 flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-bold text-red-900 hover:bg-red-100"
          >
            <DynamicIcon
              iconKey="ui_flash"
              config={icons}
              className="h-4 w-4"
              fallback={<span>⚡</span>}
            />
            تحديد سريع
            <DynamicIcon
              iconKey={showQuickSelect ? "ui_chevron_up" : "ui_chevron_down"}
              config={icons}
              className="h-3 w-3 text-red-400"
              fallback={<span>{showQuickSelect ? "▲" : "▼"}</span>}
            />
          </button>

          {showQuickSelect && (
            <div className="rounded-xl border border-red-100 bg-red-50/40 px-2 py-2 sm:px-3">
              <p className="mb-1.5 text-[11px] font-bold text-red-900/90 sm:text-xs">
                تحديد سريع — جديد أو بانتظار المندوب فقط
              </p>
              <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                <button type="button" onClick={toggleAllPending} className={prepQuickBtn}>
                  تحديد كل القابل للإسناد
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedIds(new Set())}
                  className="min-h-[38px] rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-[11px] font-bold text-slate-600 hover:bg-slate-50 sm:text-xs"
                >
                  إفراغ التحديد
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      <UnifiedOrderListTable
        rows={rows}
        colCount={showBulkRow ? 9 : 8}
        hideShopColumnLocationAndDoorPhotoButtons
        showSelectColumn={showQuickSelect}
        isRowSelectable={(r) => isAssignableBeforeCourierReceipt(r.orderStatus)}
        isSelected={(id) => selectedIds.has(id)}
        allSelected={allPendingSelected}
        onToggleAll={toggleAllPending}
        onToggleOne={toggleOne}
        onOpenRow={(id) => router.push(buildPreparerOrderDetailHref(auth, tab, qSearch, id))}
        selectAllTitle="تحديد الكل"
        selectAllAriaLabel="تحديد الكل"
        selectedTitle="تحديد"
        selectedAriaPrefix="تحديد"
        showStatusDotInSelectCol={false}
        hideLocationAlert={true}
        hideShortIdInBadgeCol={true}
        hidePhoneColumn={true}
        renderInShopNameCol={(o: any) => (
          <div className="mb-1 text-[11px] font-black text-slate-400">
            #{o.shortId}
          </div>
        )}
        renderOrderIdBadge={(o) => {
          if (!isAssignableBeforeCourierReceipt(o.orderStatus) || couriers.length === 0) return null;
          return (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setAssignOrder(o);
              }}
              className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-white border-2 border-emerald-100 shadow-sm transition hover:bg-emerald-50 active:scale-90 p-1.5"
              title="إسناد لمندوب"
            >
              <DynamicIcon
                iconKey="preparer_delegate"
                config={icons}
                className="w-full h-full"
                fallback={<span className="text-xl">👤</span>}
              />
            </button>
          );
        }}
        renderBelowOrderId={(o) => {
          const showPay = o.orderSubtotalDinar != null && !o.pickupComplete;
          if (!showPay) return null;
          return (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setPayOrder(o);
              }}
              className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-white border-2 border-amber-100 shadow-sm transition hover:bg-amber-50 active:scale-90 p-1.5"
              title="تسجيل دفع"
            >
              <DynamicIcon
                iconKey="order_received"
                config={icons}
                className="w-full h-full"
                fallback={<span className="text-xl">💵</span>}
              />
            </button>
          );
        }}
      />

      {assignOrder &&
        createPortal(
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm overflow-y-auto sm:p-6">
            <div className="my-auto w-full max-w-md animate-in fade-in zoom-in-95 rounded-2xl bg-white p-5 shadow-2xl">
              <div className="mb-4 flex items-center justify-between border-b pb-3">
                <h3 className="text-lg font-bold text-slate-900">إسناد طلب #{assignOrder.shortId}</h3>
                <button
                  onClick={() => setAssignOrder(null)}
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200"
                >
                  <DynamicIcon iconKey="ui_close" config={icons} className="h-4 w-4" fallback={<span>✕</span>} />
                </button>
              </div>
              <div className="max-h-[70vh] overflow-y-auto pt-1 px-1">
                <form
                  action={bulkAction}
                  onSubmit={() => {
                    setTimeout(() => setAssignOrder(null), 100);
                  }}
                  className="space-y-3"
                >
                  <input type="hidden" name="p" value={auth.p} />
                  <input type="hidden" name="exp" value={auth.exp} />
                  <input type="hidden" name="s" value={auth.s} />
                  <input type="hidden" name="orderIds" value={assignOrder.id} />

                  <div className="grid grid-cols-1 gap-2">
                    {couriers.map((c) => (
                      <button
                        key={c.id}
                        type="submit"
                        name="courierId"
                        value={c.id}
                        disabled={bulkPending}
                        className="w-full rounded-xl border-2 border-slate-100 bg-slate-50 px-4 py-3.5 text-right text-base font-bold text-slate-900 transition hover:border-emerald-500 hover:bg-emerald-50 active:scale-[0.98] disabled:opacity-60"
                      >
                        {c.name}
                      </button>
                    ))}
                  </div>
                </form>
              </div>
            </div>
          </div>,
          document.body,
        )}

      {payOrder &&
        createPortal(
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm overflow-y-auto sm:p-6">
            <div className="my-auto w-full max-w-md animate-in fade-in zoom-in-95 rounded-2xl border border-transparent bg-white p-5 text-slate-900 shadow-2xl dark:border-neutral-600 dark:bg-neutral-950 dark:text-white">
              <div className="mb-4 flex items-center justify-between border-b border-slate-200 pb-3 dark:border-neutral-700">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">دفع للعميل - طلب #{payOrder.shortId}</h3>
                <button
                  type="button"
                  onClick={() => setPayOrder(null)}
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 dark:bg-neutral-800 dark:text-neutral-200 dark:hover:bg-neutral-700"
                >
                  <DynamicIcon iconKey="ui_close" config={icons} className="h-4 w-4" fallback={<span>✕</span>} />
                </button>
              </div>
              <PickupMoneyForm
                orderId={payOrder.id}
                auth={auth}
                nextUrl={`/preparer?tab=${tab}&q=${qSearch}`}
                forDarkModalSurface
                expectedAlfHint={payOrder.orderSubtotalDinar != null ? dinarDecimalToAlfInputString(payOrder.orderSubtotalDinar) : ""}
                remainingAlfHint={
                  payOrder.orderSubtotalDinar != null
                    ? dinarDecimalToAlfInputString(payOrder.orderSubtotalDinar - (payOrder.pickupSumDinar || 0))
                    : ""
                }
                advanceToDelivering={false}
                pickupRemainingDinar={
                  payOrder.orderSubtotalDinar != null ? payOrder.orderSubtotalDinar - (payOrder.pickupSumDinar || 0) : null
                }
                pickupSumDinar={payOrder.pickupSumDinar || 0}
                orderSubtotalDinar={payOrder.orderSubtotalDinar}
                formAction={payAction}
                pending={payPending}
                error={payState.error}
                onClose={() => setPayOrder(null)}
                // الخيارات الجديدة
                couriers={couriers}
                currentCourierId={payOrder.assignedCourierId}
                orderStatus={payOrder.orderStatus}
              />
            </div>
          </div>,
          document.body,
        )}

      {showQuickSelect && selectedIds.size > 0 && (
        <form
          action={bulkAction}
          className="fixed top-0 left-0 right-0 z-[110] border-b border-emerald-200 bg-white/95 px-3 py-3 shadow-lg backdrop-blur-md sm:px-4"
        >
          <input type="hidden" name="p" value={auth.p} /><input type="hidden" name="exp" value={auth.exp} /><input type="hidden" name="s" value={auth.s} />
          <input type="hidden" name="orderIds" value={Array.from(selectedIds).join(",")} />
          <div className="mx-auto flex max-w-6xl flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-col gap-1">
              <p className="text-sm font-bold text-emerald-950">إسناد ({selectedIds.size}) طلب لمندوب:</p>
            </div>
            <div className="flex gap-2">
              <select name="courierId" required className="rounded-xl border-2 border-slate-200 bg-white px-3 py-2 text-sm font-semibold">
                <option value="" disabled>— اختر مندوب —</option>
                {couriers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <button type="submit" disabled={bulkPending} className="rounded-xl bg-emerald-600 px-5 py-2 text-sm font-black text-white shadow-sm hover:bg-emerald-700">إسناد</button>
            </div>
          </div>
        </form>
      )}
    </div>
  );
}
