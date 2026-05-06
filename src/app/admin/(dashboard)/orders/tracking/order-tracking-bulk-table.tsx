"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { BulkOrdersState } from "../bulk-actions";
import { bulkUpdateOrdersStatus } from "../bulk-actions";
import type { TrackingTableRow } from "./order-tracking-table-body";
import { UnifiedOrderListTable } from "@/components/unified-order-list-table";
import type { MandoubRow } from "@/app/mandoub/mandoub-order-table";
import { isReversePickupOrderType } from "@/lib/order-type-flags";
import { mandoubShopNameVividClass } from "@/lib/order-status-style";
import { getGlobalIcons, GlobalIconsConfig } from "@/lib/icon-settings";
import { DynamicIcon } from "@/components/dynamic-icon";

const STATUS_UI: Record<string, { ar: string; dot: string }> = {
  pending: { ar: "جديد", dot: "bg-red-500 ring-2 ring-red-200/70" },
  assigned: { ar: "بانتظار المندوب", dot: "bg-amber-400 ring-2 ring-amber-200/80" },
  delivering: { ar: "عند المندوب", dot: "bg-cyan-500 ring-2 ring-cyan-200/80" },
  delivered: { ar: "تم التسليم", dot: "bg-emerald-500 ring-2 ring-emerald-200/80" },
  cancelled: { ar: "ملغي", dot: "bg-slate-500 ring-2 ring-slate-200/80" },
  archived: { ar: "مؤرشف", dot: "bg-violet-500 ring-2 ring-violet-200/80" },
};

const QUICK_STATUS_VALUES = [
  { value: "all", label: "أي حالة" },
  { value: "pending", label: "جديد" },
  { value: "assigned", label: "بانتظار المندوب" },
  { value: "delivering", label: "عند المندوب" },
  { value: "delivered", label: "تم التسليم" },
  { value: "cancelled", label: "ملغي" },
  { value: "archived", label: "مؤرشف" },
] as const;

export function OrderTrackingBulkTable({
  rows,
  couriers,
}: {
  rows: TrackingTableRow[];
  couriers: Array<{ id: string; name: string }>;
}) {
  const router = useRouter();
  const visibleIds = useMemo(() => rows.map((r) => r.id), [rows]);
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [showQuickSelect, setShowQuickSelect] = useState(false);
  const [quickStatus, setQuickStatus] = useState<string>("all");
  const [quickCourier, setQuickCourier] = useState<string>("any");

  const selectedCount = selected.size;
  const allSelected = selectedCount > 0 && visibleIds.every((id) => selected.has(id));
  const showSelectColumn = true; // نجعله دائماً ظاهراً بدلاً من الاعتماد على showQuickSelect

  const [bulkState, bulkAction, bulkPending] = useActionState(
    bulkUpdateOrdersStatus,
    {} as BulkOrdersState,
  );

  const [targetStatus, setTargetStatus] = useState<string>("assigned");
  const [courierId, setCourierId] = useState<string>("");
  const [assignOrder, setAssignOrder] = useState<MandoubRow | null>(null);
  const [orderDetailHref, setOrderDetailHref] = useState<string | null>(null);
  const [cachedOrderHrefs, setCachedOrderHrefs] = useState<string[]>([]);
  const [loadedOrderHrefs, setLoadedOrderHrefs] = useState<Record<string, boolean>>({});
  const [preloadQueue, setPreloadQueue] = useState<string[]>([]);
  const [icons, setIcons] = useState<GlobalIconsConfig | null>(null);

  useEffect(() => {
    getGlobalIcons().then(setIcons);
  }, []);

  const needsCourier =
    targetStatus === "assigned" ||
    targetStatus === "delivering" ||
    targetStatus === "delivered";

  const selectedIdsArr = useMemo(() => Array.from(selected), [selected]);
  const rowDetailHrefs = useMemo(() => rows.map((r) => `/admin/orders/${r.id}?view=modal`), [rows]);
  const unifiedRows: MandoubRow[] = useMemo(
    () =>
      rows.map((r) => {
        const ui = STATUS_UI[r.orderStatus] ?? {
          ar: r.orderStatus,
          dot: "bg-slate-500 ring-2 ring-slate-200/80",
        };
        return {
          id: r.id,
          shortId: String(r.orderNumber),
          orderStatus: r.orderStatus,
          assignedCourierName: r.courierName?.trim() || "",
          shopName: r.shopCustomerLabel,
          shopNameHighlightClass: mandoubShopNameVividClass(r.orderStatus, false),
          regionLine: r.regionName,
          orderType: r.routeModeLabel
            ? `${r.orderType} • ${r.routeModeLabel}`
            : r.orderType,
          priceStr: r.totalLabel,
          delStr: r.deliveryLabel,
          customerPhone: r.customerPhone,
          timeLine: r.orderNoteTime || "—",
          statusAr: ui.ar,
          statusClass: ui.dot,
          hasCustomerLocation: !r.missingCustomerLocation,
          hasCourierUploadedLocation: r.hasCourierUploadedLocation,
          hasMoneyDeletedBadge: false,
          prepaidAll: false,
          reversePickup: isReversePickupOrderType(r.orderType),
          wardMismatchType: r.wardMismatchType,
          saderMismatchType: r.saderMismatchType,
          noWardRecorded: r.noWardRecorded,
          noSaderRecorded: r.noSaderRecorded,
          createdAt: r.createdAt,
          pickupSumDinar: r.pickupSumDinar ?? null,
          deliverySumDinar: r.deliverySumDinar ?? null,
          // بيانات الوصول السريع
          audioUrl: r.audioUrl,
          adminAudioUrl: r.adminAudioUrl,
          shopPhone: r.shopPhone,
          shopLocationUrl: r.shopLocationUrl,
          customerLocationUrl: r.customerLocationUrl,
          secondCustomerLocationUrl: r.secondCustomerLocationUrl,
          shopDoorPhotoUrl: r.shopDoorPhotoUrl,
          customerDoorPhotoUrl: r.customerDoorPhotoUrl,
          secondCustomerDoorPhotoUrl: r.secondCustomerDoorPhotoUrl,
        };
      }),
    [rows],
  );

  useEffect(() => {
    if (rowDetailHrefs.length === 0) return;
    setPreloadQueue((prev) => {
      const seen = new Set(prev);
      const cached = new Set(cachedOrderHrefs);
      const next = [...prev];
      for (const href of rowDetailHrefs) {
        if (!seen.has(href) && !cached.has(href)) {
          seen.add(href);
          next.push(href);
        }
      }
      return next;
    });
  }, [rowDetailHrefs, cachedOrderHrefs]);

  useEffect(() => {
    if (preloadQueue.length === 0) return;
    if (orderDetailHref && !loadedOrderHrefs[orderDetailHref]) return;
    const nextHref = preloadQueue.find((href) => !cachedOrderHrefs.includes(href));
    if (!nextHref) {
      setPreloadQueue([]);
      return;
    }
    const timer = window.setTimeout(() => {
      setCachedOrderHrefs((prev) => (prev.includes(nextHref) ? prev : [...prev, nextHref]));
      setPreloadQueue((prev) => prev.filter((href) => href !== nextHref));
    }, 500);
    return () => window.clearTimeout(timer);
  }, [preloadQueue, cachedOrderHrefs, orderDetailHref, loadedOrderHrefs]);

  const openOrderModal = (href: string) => {
    if (!orderDetailHref) {
      window.history.pushState({ orderModalOpen: true }, "", window.location.href);
    }
    setOrderDetailHref(href);
    setCachedOrderHrefs((prev) => (prev.includes(href) ? prev : [...prev, href]));
    setPreloadQueue((prev) => prev.filter((h) => h !== href));
  };

  const closeOrderModal = () => {
    if (!orderDetailHref) return;
    if (window.history.state?.orderModalOpen) {
      window.history.back();
      return;
    }
    setOrderDetailHref(null);
  };

  useEffect(() => {
    const onPopState = () => {
      setOrderDetailHref((prev) => (prev ? null : prev));
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type === "ORDER_MODAL_CLOSE") {
        closeOrderModal();
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [orderDetailHref]);

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allSelected) {
        visibleIds.forEach((id) => next.delete(id));
      } else {
        visibleIds.forEach((id) => next.add(id));
      }
      return next;
    });
  }

  function selectByVisibleStatus(status: string) {
    const next = new Set<string>();
    for (const r of rows) {
      if (status !== "all" && r.orderStatus !== status) continue;
      next.add(r.id);
    }
    setSelected(next);
  }

  function selectMatchingQuickFilters() {
    const next = new Set<string>();
    for (const r of rows) {
      if (quickStatus !== "all" && r.orderStatus !== quickStatus) continue;
      if (quickCourier !== "any") {
        if (r.assignedCourierId !== quickCourier) continue;
      }
      next.add(r.id);
    }
    setSelected(next);
  }

  function selectAllVisible() {
    setSelected(new Set(visibleIds));
  }

  function clearSelection() {
    setSelected(new Set());
  }

  useEffect(() => {
    if (bulkState.ok) setSelected(new Set());
  }, [bulkState.ok]);

  return (
    <div className="space-y-3">
      {visibleIds.length > 0 ? (
        <div>
          <button
            type="button"
            onClick={() =>
              setShowQuickSelect((v) => {
                if (v) setSelected(new Set());
                return !v;
              })
            }
            className="mb-1.5 flex items-center gap-1.5 rounded-lg border border-sky-200 bg-sky-50 px-3 py-1.5 text-xs font-bold text-sky-900 hover:bg-sky-100"
          >
            ⚡ تحديد سريع
            <span className="text-sky-400">{showQuickSelect ? "▲" : "▼"}</span>
          </button>

          {showQuickSelect && (
            <div className="rounded-xl border border-sky-200 bg-sky-50/60 px-3 py-2.5">
              <p className="mb-2 text-xs font-bold text-slate-700">
                اختر حالة و/أو مندوباً ثم اضغط «تحديد المطابقين»
              </p>
              <div className="flex flex-wrap items-end gap-2">
                <label className="flex flex-col gap-0.5 text-xs font-bold text-slate-600">
                  الحالة الحالية
                  <select
                    value={quickStatus}
                    onChange={(e) => setQuickStatus(e.target.value)}
                    className="min-h-[40px] rounded-lg border border-sky-200 bg-white px-2 py-1.5 text-sm font-bold text-slate-800 outline-none"
                  >
                    {QUICK_STATUS_VALUES.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-0.5 text-xs font-bold text-slate-600">
                  المندوب المسند
                  <select
                    value={quickCourier}
                    onChange={(e) => setQuickCourier(e.target.value)}
                    className="min-h-[40px] min-w-[10rem] rounded-lg border border-sky-200 bg-white px-2 py-1.5 text-sm font-bold text-slate-800 outline-none"
                  >
                    <option value="any">أي مندوب</option>
                    {couriers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  type="button"
                  onClick={selectMatchingQuickFilters}
                  className="min-h-[40px] rounded-lg bg-sky-700 px-3 py-2 text-sm font-bold text-white shadow-sm hover:bg-sky-800"
                >
                  تحديد المطابقين
                </button>
                <button
                  type="button"
                  onClick={selectAllVisible}
                  className="min-h-[40px] rounded-lg border border-sky-300 bg-white px-3 py-2 text-sm font-bold text-slate-800 hover:bg-sky-50"
                >
                  تحديد الكل الظاهر
                </button>
                <button
                  type="button"
                  onClick={clearSelection}
                  className="min-h-[40px] rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-bold text-slate-600 hover:bg-slate-50"
                >
                  إفراغ التحديد
                </button>
              </div>
            </div>
          )}
        </div>
      ) : null}

      {selectedCount ? (
        <div className="rounded-2xl border border-sky-200 bg-white/70 p-3">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-sm font-bold text-slate-800">
                تم اختيار {selectedCount} طلب
              </p>
              {bulkState.error ? (
                <p className="mt-1 text-sm font-bold text-rose-600">
                  {bulkState.error}
                </p>
              ) : null}
              {bulkPending ? (
                <p className="mt-1 text-xs font-bold text-sky-800">جارٍ التطبيق…</p>
              ) : null}
            </div>

            <form action={bulkAction} className="flex flex-wrap items-end gap-2">
              {selectedIdsArr.map((id) => (
                <input key={id} type="hidden" name="orderIds" value={id} />
              ))}

              <label className="flex flex-col gap-1 text-sm">
                <span className="text-xs font-bold text-slate-600">الحالة الجديدة</span>
                <select
                  name="targetStatus"
                  value={targetStatus}
                  onChange={(e) => setTargetStatus(e.target.value)}
                  className="rounded-xl border border-sky-200 bg-white px-3 py-2 text-sm font-bold text-slate-800 outline-none"
                >
                  <option value="pending">قيد الانتظار</option>
                  <option value="assigned">مسند للمندوب</option>
                  <option value="delivering">بالتوصيل</option>
                  <option value="delivered">تم التسليم</option>
                  <option value="cancelled">ملغي/مرفوض</option>
                  <option value="archived">مؤرشف</option>
                </select>
              </label>

              {needsCourier ? (
                <label className="flex flex-col gap-1 text-sm">
                  <span className="text-xs font-bold text-slate-600">المندوب</span>
                  <select
                    name="courierId"
                    value={courierId}
                    onChange={(e) => setCourierId(e.target.value)}
                    className="rounded-xl border border-sky-200 bg-white px-3 py-2 text-sm font-bold text-slate-800 outline-none"
                  >
                    <option value="">اختر مندوب…</option>
                    {couriers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </label>
              ) : (
                <input type="hidden" name="courierId" value="" />
              )}

              {needsCourier && (
                <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-xl border border-sky-200">
                  <input type="checkbox" id="bulk-direct-tracking" name="directReceipt" className="h-4 w-4 rounded border-sky-400" />
                  <label htmlFor="bulk-direct-tracking" className="text-[10px] font-black text-sky-950 cursor-pointer select-none">استلام مباشر ⚡</label>
                </div>
              )}

              <button
                type="submit"
                disabled={bulkPending || (needsCourier && !courierId)}
                className="rounded-xl bg-gradient-to-r from-sky-600 to-cyan-600 px-4 py-2.5 text-sm font-bold text-white shadow-md shadow-sky-200/80 ring-1 ring-sky-400/30 transition hover:from-sky-700 hover:to-cyan-700 disabled:opacity-60"
              >
                تطبيق
              </button>
            </form>
          </div>
        </div>
      ) : null}

      <UnifiedOrderListTable
        rows={unifiedRows}
        colCount={9}
        showSelectColumn={showSelectColumn}
        isRowSelectable={() => true}
        isSelected={(id) => selected.has(id)}
        allSelected={allSelected}
        onToggleAll={toggleAll}
        onToggleOne={toggleOne}
        onOpenRow={(id) => {
          const href = `/admin/orders/${id}?view=modal`;
          openOrderModal(href);
        }}
        selectAllTitle="تحديد الكل"
        selectAllAriaLabel="تحديد كل الطلبات الظاهرة"
        selectedTitle="تحديد"
        selectedAriaPrefix="تحديد الطلب"
        showStatusDotInSelectCol={false}
        renderOrderIdBadge={() => null}
        renderBelowOrderId={(row) => {
          if (row.orderStatus !== "pending") return null;
          return (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setAssignOrder(row);
              }}
              className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white border-2 border-emerald-100 shadow-sm transition hover:bg-emerald-50 active:scale-90 p-1.5"
              title="إسناد سريع"
            >
              <DynamicIcon
                iconKey="preparer_delegate"
                config={icons}
                className="w-full h-full object-contain"
                fallback={
                  <div className="w-full h-full" />
                }
              />
            </button>
          );
        }}
      />

      {assignOrder && (
        <div className="fixed inset-0 z-[100] flex items-start justify-center bg-slate-900/40 p-4 backdrop-blur-sm">
          <div className="mt-4 w-full max-w-md animate-in slide-in-from-top-4 rounded-3xl bg-white p-5 shadow-2xl ring-1 ring-slate-200">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="text-xl font-black text-slate-900">إسناد لمندوب</h3>
                <p className="text-sm font-bold text-slate-500">الطلب #{assignOrder.shortId}</p>
              </div>
              <button
                onClick={() => setAssignOrder(null)}
                className="h-10 w-10 rounded-full bg-slate-100 text-xl font-bold text-slate-500 hover:bg-slate-200"
              >
                ✕
              </button>
            </div>

              <div className="max-h-[60vh] overflow-y-auto pt-2">
                <div className="mb-4 flex items-center gap-2 bg-emerald-50 p-3 rounded-xl border border-emerald-100">
                  <input type="checkbox" id="direct-receipt-tracking-modal" className="h-5 w-5 rounded border-emerald-400" />
                  <label htmlFor="direct-receipt-tracking-modal" className="text-sm font-black text-emerald-950 cursor-pointer select-none">
                    استلام مباشر للمندوب (تخطي الموافقة) ⚡
                  </label>
                </div>
                <div className="grid grid-cols-1 gap-2">
                  {couriers.map((c) => (
                    <button
                      key={c.id}
                      disabled={bulkPending}
                      onClick={async () => {
                        const direct = (document.getElementById('direct-receipt-tracking-modal') as HTMLInputElement)?.checked;
                        const fd = new FormData();
                        fd.append("orderIds", assignOrder.id);
                        fd.append("targetStatus", "assigned");
                        fd.append("courierId", c.id);
                        if (direct) fd.append("directReceipt", "on");
                        setAssignOrder(null);
                        const res = await bulkUpdateOrdersStatus({}, fd);
                        if (res.error) alert(res.error);
                        else router.refresh();
                      }}
                      className="w-full rounded-xl border-2 border-slate-100 bg-slate-50 px-4 py-3.5 text-right text-base font-bold text-slate-900 transition hover:border-emerald-500 hover:bg-emerald-50 active:scale-[0.98] disabled:opacity-60"
                    >
                      {c.name}
                    </button>
                  ))}
                </div>
              </div>
          </div>
        </div>
      )}

      {cachedOrderHrefs.length > 0 ? (
        <div className={`fixed inset-0 z-[120] ${orderDetailHref ? "" : "pointer-events-none"}`}>
          <div
            className={`absolute inset-0 bg-slate-900/50 backdrop-blur-sm transition-opacity ${orderDetailHref ? "opacity-100" : "opacity-0"}`}
            onClick={closeOrderModal}
          />
          <div
            className={`absolute inset-0 flex items-center justify-center transition-opacity ${orderDetailHref ? "opacity-100" : "opacity-0"}`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative h-full w-full overflow-hidden bg-white">
              <div className="flex items-center justify-between border-b bg-slate-50 px-4 py-3">
                <div className="font-black text-slate-900">عرض الطلب</div>
                <button
                  type="button"
                  onClick={closeOrderModal}
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200"
                  aria-label="إغلاق نافذة الطلب"
                >
                  ✕
                </button>
              </div>
              <div className="relative h-[calc(100vh-57px)] w-full bg-white">
                {cachedOrderHrefs.map((href) => (
                  <iframe
                    key={href}
                    title={`صفحة الطلب داخل نافذة ${href}`}
                    src={href}
                    loading="eager"
                    onLoad={() => setLoadedOrderHrefs((prev) => ({ ...prev, [href]: true }))}
                    className={`absolute inset-0 h-full w-full border-0 bg-white transition-opacity ${orderDetailHref === href ? "opacity-100" : "pointer-events-none opacity-0"}`}
                  />
                ))}
                {orderDetailHref && !loadedOrderHrefs[orderDetailHref] ? (
                  <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/80 text-sm font-bold text-slate-700">
                    جارٍ تحميل الطلب...
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      ) : null}

    </div>
  );
}
