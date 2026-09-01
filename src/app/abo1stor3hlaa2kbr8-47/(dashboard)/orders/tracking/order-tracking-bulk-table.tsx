"use client";

import Link from "next/link";
import { useActionState, useEffect, useMemo, useState } from "react";
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
import { formatBaghdadDateFriendly, getBaghdadDateString } from "@/lib/baghdad-time";
import { formatDinarAsAlf } from "@/lib/money-alf";

const STATUS_UI: Record<string, { ar: string; dot: string }> = {
  pending: { ar: "جديد", dot: "bg-red-500 ring-2 ring-red-200/70" },
  assigned: { ar: "بانتظار المندوب", dot: "bg-amber-400 ring-2 ring-amber-200/80" },
  delivering: { ar: "عند المندوب", dot: "bg-cyan-500 ring-2 ring-cyan-200/80" },
  delivered: { ar: "تم التسليم", dot: "bg-emerald-500 ring-2 ring-emerald-200/80" },
  cancelled: { ar: "مرفوض", dot: "bg-slate-500 ring-2 ring-slate-200/80" },
  archived: { ar: "مؤرشف", dot: "bg-violet-500 ring-2 ring-violet-200/80" },
};

const SECRET_ADMIN_PATH = "/abo1stor3hlaa2kbr8-47";

const QUICK_STATUS_VALUES = [
  { value: "all", label: "أي حالة" },
  { value: "pending", label: "جديد" },
  { value: "assigned", label: "بانتظار المندوب" },
  { value: "delivering", label: "عند المندوب" },
  { value: "delivered", label: "تم التسليم" },
  { value: "cancelled", label: "مرفوض" },
  { value: "archived", label: "مؤرشف" },
] as const;

function TrackingCardMoneyBadges({ o }: { o: TrackingTableRow }) {
  const pickup = o.pickupSumDinar ?? null;
  const preparerPickup = o.preparerPickupSumDinar ?? null;
  const adminPickup = o.adminPickupSumDinar ?? null;
  const delivery = o.deliverySumDinar ?? null;
  const preparerDelivery = o.preparerDeliverySumDinar ?? null;

  const showPickup = pickup != null && Number.isFinite(pickup) && pickup > 0;
  const showPreparerPickup = preparerPickup != null && Number.isFinite(preparerPickup) && preparerPickup > 0;
  const showAdminPickup = adminPickup != null && Number.isFinite(adminPickup) && adminPickup > 0;
  const showDelivery = delivery != null && Number.isFinite(delivery) && delivery > 0;
  const showPreparerDelivery = preparerDelivery != null && Number.isFinite(preparerDelivery) && preparerDelivery > 0;

  const hasAnyBadge =
    showPickup ||
    showPreparerPickup ||
    showAdminPickup ||
    showDelivery ||
    showPreparerDelivery ||
    o.wardMismatchType ||
    o.saderMismatchType ||
    (o.noWardRecorded && o.orderStatus === "delivered");

  if (!hasAnyBadge) return null;

  const pillBase =
    "inline-flex items-center justify-center rounded-lg px-2 py-0.5 text-xs font-black leading-none tabular-nums shadow-xs border shrink-0";

  return (
    <div className="flex items-center gap-1 flex-wrap shrink-0" onClick={(e) => e.stopPropagation()}>
      {showPickup && (
        <span className={`${pillBase} bg-emerald-600 text-white border-emerald-700`} title="صادر المندوب">
          {formatDinarAsAlf(pickup)}
        </span>
      )}
      {showPreparerPickup && (
        <span className={`${pillBase} bg-amber-500 text-white border-amber-600`} title="صادر المجهز">
          {formatDinarAsAlf(preparerPickup)}
        </span>
      )}
      {showAdminPickup && (
        <span className={`${pillBase} bg-blue-600 text-white border-blue-700`} title="صادر الإدارة">
          {formatDinarAsAlf(adminPickup)}
        </span>
      )}
      {showDelivery && (
        <span className={`${pillBase} bg-rose-600 text-white border-rose-700`} title="وارد المندوب">
          {formatDinarAsAlf(delivery)}
        </span>
      )}
      {showPreparerDelivery && (
        <span className={`${pillBase} bg-purple-600 text-white border-purple-700`} title="وارد المجهز">
          {formatDinarAsAlf(preparerDelivery)}
        </span>
      )}

      {o.wardMismatchType === "deficit" && (
        <span className={`${pillBase} bg-red-700 text-white border-red-800`} title="نقص بالوارد">
          نقص بالوارد
        </span>
      )}
      {o.saderMismatchType === "deficit" && (
        <span className={`${pillBase} bg-amber-700 text-white border-amber-800`} title="نقص بالصادر">
          نقص بالصادر
        </span>
      )}
      {o.wardMismatchType === "excess" && (
        <span className={`${pillBase} bg-emerald-800 text-white border-emerald-900`} title="زيادة بالوارد">
          زيادة بالوارد
        </span>
      )}
      {o.saderMismatchType === "excess" && (
        <span className={`${pillBase} bg-emerald-800 text-white border-emerald-900`} title="زيادة بالصادر">
          زيادة بالصادر
        </span>
      )}
      {o.noWardRecorded && o.orderStatus === "delivered" && (
        <span className={`${pillBase} bg-slate-700 text-white border-slate-800`} title="بدون وارد">
          بدون وارد
        </span>
      )}
    </div>
  );
}

function TrackingCardsView({
  rows,
  onOpenRow,
  onAssignOrder,
  icons,
  showSelectColumn,
  isSelected,
  onToggleOne,
}: {
  rows: TrackingTableRow[];
  onOpenRow: (id: string) => void;
  onAssignOrder: (row: TrackingTableRow) => void;
  icons: GlobalIconsConfig | null;
  showSelectColumn?: boolean;
  isSelected?: (id: string) => boolean;
  onToggleOne?: (id: string) => void;
}) {
  if (!rows.length) {
    return (
      <div className="py-12 text-center text-slate-500 font-bold bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm text-sm sm:text-base">
        لا توجد طلبات للعرض في هذه القائمة
      </div>
    );
  }

  // تجميع الطلبات حسب اليوم بالتاريخ البغدادي الدقيق
  const groupedByDate: { dateKey: string; dateLabel: string; items: TrackingTableRow[] }[] = [];
  rows.forEach((row) => {
    const rawDate = row.createdAt ? (typeof row.createdAt === 'string' ? new Date(row.createdAt) : row.createdAt) : null;
    const dateKey = rawDate ? getBaghdadDateString(rawDate) : "unknown";
    const dateLabel = rawDate ? formatBaghdadDateFriendly(rawDate) : "طلبات أخرى";

    const lastGroup = groupedByDate[groupedByDate.length - 1];
    if (lastGroup && lastGroup.dateKey === dateKey) {
      lastGroup.items.push(row);
    } else {
      groupedByDate.push({ dateKey, dateLabel, items: [row] });
    }
  });

  return (
    <div className="space-y-6 pb-12">
      {groupedByDate.map((group) => (
        <div key={group.dateKey} className="space-y-3">
          {/* شريط الفاصل الزمني البارز بين الأيام باللون الأحمر العنابي */}
          <div className="flex items-center gap-3 pt-3 pb-1">
            <div className="h-0.5 flex-1 bg-gradient-to-r from-transparent via-red-400 dark:via-red-800 to-red-600 dark:to-red-700 rounded-full" />
            <div className="flex items-center gap-2 rounded-2xl border-2 border-red-500 dark:border-red-700 bg-gradient-to-r from-red-600 to-rose-700 px-4 py-1.5 text-xs sm:text-sm font-black text-white shadow-md">
              <span className="text-base">📅</span>
              <span>{group.dateLabel}</span>
              <span className="rounded-full bg-white/20 px-2.5 py-0.5 text-[11px] font-black text-white border border-white/30 backdrop-blur-xs">
                {group.items.length} طلب
              </span>
            </div>
            <div className="h-0.5 flex-1 bg-gradient-to-r from-red-600 dark:from-red-700 via-red-400 dark:via-red-800 to-transparent rounded-full" />
          </div>

          {/* قائمة الكروت التابعة لهذا اليوم */}
          <div className="flex flex-col gap-3">
            {group.items.map((o) => {
              const isPending = o.orderStatus === "pending";
              const isAssigned = o.orderStatus === "assigned";
              const isDelivering = o.orderStatus === "delivering";
              const isDelivered = o.orderStatus === "delivered";
              const isCancelled = o.orderStatus === "cancelled";

              const selected = isSelected ? isSelected(o.id) : false;

              // تحديد لون بلوك اسم المحل والمنطقة بحسب حالة الطلب
              const headerBlockBg = isPending
                ? "bg-gradient-to-r from-red-600 to-rose-700 text-white border-red-500 shadow-sm"
                : isAssigned || isDelivering
                ? "bg-gradient-to-r from-amber-500 to-amber-600 text-white border-amber-400 shadow-sm"
                : isDelivered
                ? "bg-gradient-to-r from-emerald-600 to-teal-700 text-white border-emerald-500 shadow-sm"
                : isCancelled
                ? "bg-slate-700 text-white border-slate-600 shadow-sm"
                : "bg-slate-800 text-white border-slate-700 shadow-sm";

              const cardBgStyle = selected
                ? "border-sky-500 ring-2 ring-sky-400 bg-white dark:bg-slate-900"
                : "border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-900";

              const displayTotal = o.hasDebt && o.priceWithDebtLabel
                ? o.priceWithDebtLabel
                : o.totalLabel || "—";

              const displayGoodsType = o.orderType && o.orderType !== "عام" && o.orderType !== "—"
                ? o.orderType
                : o.summary && o.summary.trim()
                ? o.summary
                : o.orderType || "—";

              const isDoubleRouteOrder = o.routeModeLabel === "وجهتين" && Boolean(o.secondCustomerRegionName);

              const headerTextStr = isDoubleRouteOrder
                ? `${o.regionName || "المرسل"} إلى ${o.secondCustomerRegionName || "المستلم"}`
                : `${o.shopCustomerLabel || "المحل"} إلى ${o.regionName || "المنطقة"}`;

              const textLen = headerTextStr.length;

              const dynamicHeaderFont = textLen > 35
                ? "text-[11px] xs:text-xs sm:text-sm md:text-base tracking-tighter"
                : textLen > 26
                ? "text-xs xs:text-sm sm:text-base md:text-lg tracking-tight font-black"
                : textLen > 18
                ? "text-sm xs:text-base sm:text-lg md:text-xl font-black"
                : "text-base xs:text-lg sm:text-xl md:text-2xl font-black";

              const hasAssignedCourier = Boolean(o.courierName && o.courierName !== "—" && o.courierName.trim() !== "");

              // حالات الطلب الخاصة (كتابات الحالات)
              const isPrepaid = Boolean(o.prepaidAll || o.totalLabel === "كل شي واصل" || o.totalLabel === "واصل");
              const isReverse = Boolean(isReversePickupOrderType(o.orderType) || o.orderType?.includes("عكسي") || o.orderType?.includes("راجع"));
              const hasGps = Boolean(o.hasCourierUploadedLocation || o.customerLocationUrl || !o.missingCustomerLocation);
              const isDoubleRoute = Boolean(o.routeModeLabel === "وجهتين");
              const hasPreparerPricing = Boolean(
                o.preparerShoppingJson &&
                  (typeof o.preparerShoppingJson === "object"
                    ? Object.keys(o.preparerShoppingJson).length > 0
                    : typeof o.preparerShoppingJson === "string"
                    ? (o.preparerShoppingJson as string).trim().length > 2
                    : false)
              );

              return (
                <div
                  key={o.id}
                  onClick={() => {
                    if (showSelectColumn && onToggleOne) {
                      onToggleOne(o.id);
                    } else {
                      onOpenRow(o.id);
                    }
                  }}
                  className={`group relative flex flex-col justify-between rounded-2xl border-2 ${cardBgStyle} p-3 shadow-sm hover:shadow-md transition-all active:scale-[0.99] cursor-pointer space-y-2.5`}
                >
                  {/* البادجات المالية العائمة أعلى الكرت */}
                  <div className="absolute -top-3.5 right-16 z-20 pointer-events-none flex items-center gap-1 shrink-0">
                    <TrackingCardMoneyBadges o={o} />
                  </div>

                  {/* السطر العلوي: زر الإسناد + اسم المحل إلى المنطقة + رقم الطلب */}
                  <div className="flex items-center justify-between gap-1.5 border-b border-slate-200/60 dark:border-slate-800 pb-1.5 min-w-0 w-full overflow-hidden whitespace-nowrap">
                    {/* أقصى اليمين: زر الإسناد للمندوبين أو التحديد */}
                    <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                      {showSelectColumn && (
                        <input
                          type="checkbox"
                          checked={selected}
                          onChange={() => onToggleOne && onToggleOne(o.id)}
                          className="size-5 rounded border-2 border-sky-400 text-sky-600 focus:ring-sky-500 cursor-pointer"
                        />
                      )}

                      {/* زر الإسناد للمندوبين */}
                      {!isCancelled && (
                        <button
                          type="button"
                          onClick={() => onAssignOrder(o)}
                          className={`flex items-center justify-center gap-1.5 h-10 px-3 sm:px-3.5 rounded-2xl border-2 text-xs font-black shadow-md transition active:scale-90 shrink-0 ${
                            hasAssignedCourier
                              ? "bg-gradient-to-r from-violet-600 to-indigo-700 hover:from-violet-700 hover:to-indigo-800 border-violet-400 text-white"
                              : "bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 border-emerald-400 text-white animate-pulse"
                          }`}
                          title={hasAssignedCourier ? `تغيير المندوب (${o.courierName})` : "إسناد لمندوب"}
                        >
                          <span className="text-sm shrink-0">🛵</span>
                          <span className="max-w-[80px] sm:max-w-[110px] truncate text-[11px] sm:text-xs">
                            {hasAssignedCourier ? o.courierName : "إسناد للمندوب"}
                          </span>
                        </button>
                      )}

                      {isCancelled && (
                        <span className="h-10 px-3 rounded-2xl bg-slate-600 border-2 border-slate-400 text-white font-black text-xs shadow-sm flex items-center justify-center shrink-0">
                          مرفوض
                        </span>
                      )}
                    </div>

                    {/* المنتصف: اسم المحل إلى منطقة الزبون داخل بلوك ملون أنيق بحسب الحالة */}
                    {isDoubleRouteOrder ? (
                      <div className={`flex items-center justify-center gap-1 flex-1 min-w-0 px-2 py-1 rounded-xl border ${headerBlockBg} overflow-hidden whitespace-nowrap text-center font-black ${dynamicHeaderFont}`} title="طلب وجهتين: منطقة المرسل إلى منطقة المستلم">
                        <span className="font-black whitespace-nowrap text-white">{o.regionName || "المرسل"}</span>
                        <span className="shrink-0 text-[10px] sm:text-xs text-white/80 font-bold">إلى</span>
                        <span className="font-black whitespace-nowrap text-white">{o.secondCustomerRegionName || "المستلم"}</span>
                      </div>
                    ) : (
                      <div className={`flex items-center justify-center gap-1 flex-1 min-w-0 px-2 py-1 rounded-xl border ${headerBlockBg} overflow-hidden whitespace-nowrap text-center font-black ${dynamicHeaderFont}`}>
                        <span className="font-black whitespace-nowrap text-white">{o.shopCustomerLabel}</span>
                        <span className="shrink-0 text-[10px] sm:text-xs text-white/80 font-bold">إلى</span>
                        <span className="font-black whitespace-nowrap text-white">{o.regionName}</span>
                      </div>
                    )}

                    {/* أقصى اليسار: رقم الطلب */}
                    <div className="flex items-center gap-1 shrink-0">
                      <span className="text-base sm:text-lg font-black text-slate-900 dark:text-white tabular-nums tracking-tight">
                        #{o.orderNumber}
                      </span>
                    </div>
                  </div>

                  {/* سطر التفاصيل: نوع البضاعة ← السعر ← وقت الطلب واسم الزبون */}
                  <div className="space-y-1.5 overflow-hidden">
                    <div className="flex items-center justify-between gap-1.5 text-sm font-black text-slate-800 dark:text-slate-100 flex-wrap min-w-0">
                      <div className="flex items-center gap-1.5 min-w-0 truncate flex-wrap">
                        <span className="text-indigo-800 dark:text-indigo-300 font-black bg-indigo-50 dark:bg-indigo-950/40 px-2.5 py-0.5 rounded-lg border border-indigo-100 dark:border-indigo-900/30 truncate text-xs sm:text-sm">
                          {displayGoodsType}
                        </span>
                        <span className="text-slate-400 font-bold shrink-0">←</span>
                        <span className="text-emerald-700 dark:text-emerald-400 font-black tabular-nums bg-emerald-50 dark:bg-emerald-950/40 px-3 py-0.5 rounded-lg border border-emerald-200 dark:border-emerald-900/40 shrink-0 text-sm sm:text-base">
                          {displayTotal}
                        </span>
                        <span className="text-slate-400 font-bold shrink-0">←</span>
                        <span className="text-rose-600 dark:text-rose-400 font-black text-xs sm:text-sm shrink-0">
                          {o.orderNoteTime || "فوري"}
                        </span>
                      </div>

                      {o.customerName && (
                        <span className="text-xs text-slate-600 dark:text-slate-400 font-bold truncate shrink-0">
                          👤 {o.customerName}
                        </span>
                      )}
                    </div>

                    {/* سطر كتابات الحالات (واصل، عكسي، gps، وجهتين) ورقم الهاتف */}
                    <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-100 dark:border-slate-800/60" onClick={(e) => e.stopPropagation()}>
                      {/* كتابات الحالات الأنيقة: واصل و عكسي و gps و وجهتين + إيموجي قلم التعديل */}
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <Link
                          href={`${SECRET_ADMIN_PATH}/orders/${o.id}/edit`}
                          onClick={(e) => e.stopPropagation()}
                          className="inline-flex items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-950/60 hover:bg-amber-200 dark:hover:bg-amber-900/80 text-amber-800 dark:text-amber-200 border border-amber-300 dark:border-amber-700 px-1.5 py-0.5 text-xs font-black shadow-2xs transition-all active:scale-90"
                          title="تعديل الطلب من الخارج ✏️"
                        >
                          ✏️
                        </Link>
                        {hasPreparerPricing && (
                          <Link
                            href={`${SECRET_ADMIN_PATH}/orders/${o.id}/price`}
                            onClick={(e) => e.stopPropagation()}
                            className="inline-flex items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-950/60 hover:bg-emerald-200 dark:hover:bg-emerald-900/80 text-emerald-800 dark:text-emerald-200 border border-emerald-300 dark:border-emerald-700 px-1.5 py-0.5 text-xs font-black shadow-2xs transition-all active:scale-90"
                            title="تعديل أسعار التجهيز 💰"
                          >
                            💰
                          </Link>
                        )}
                        {isPrepaid && (
                          <span className="inline-flex items-center justify-center rounded-lg bg-emerald-600 px-2.5 py-0.5 text-[11px] sm:text-xs font-black text-white shadow-xs border border-emerald-700" title="كل شي واصل">
                            واصل
                          </span>
                        )}
                        {isReverse && (
                          <span className="inline-flex items-center justify-center rounded-lg bg-rose-600 px-2.5 py-0.5 text-[11px] sm:text-xs font-black text-white shadow-xs border border-rose-700" title="طلب راجع / عكسي">
                            عكسي
                          </span>
                        )}
                        {hasGps && (
                          <span className="inline-flex items-center justify-center rounded-lg bg-violet-600 px-2.5 py-0.5 text-[11px] sm:text-xs font-black text-white shadow-xs border border-violet-700" title="لوكيشن GPS متوفر">
                            GPS
                          </span>
                        )}
                        {isDoubleRoute && (
                          <span className="inline-flex items-center justify-center rounded-lg bg-sky-600 px-2.5 py-0.5 text-[11px] sm:text-xs font-black text-white shadow-xs border border-sky-700" title="طلب وجهتين">
                            وجهتين
                          </span>
                        )}
                      </div>

                      {/* رقم الهاتف الظاهر */}
                      <div className="flex items-center gap-1.5 text-xs font-mono font-bold text-slate-700 dark:text-slate-200">
                        {o.customerAlternatePhone && o.customerAlternatePhone !== "—" && (
                          <span className="text-slate-400">
                            {o.customerAlternatePhone} /
                          </span>
                        )}
                        <span>
                          📞 {o.customerPhone || "—"}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

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
  const [viewMode, setViewMode] = useState<"cards" | "table">("cards");

  const selectedCount = selected.size;
  const allSelected = selectedCount > 0 && visibleIds.every((id) => selected.has(id));
  const showSelectColumn = showQuickSelect;

  const [bulkState, bulkAction, bulkPending] = useActionState(
    bulkUpdateOrdersStatus,
    {} as BulkOrdersState,
  );

  const [targetStatus, setTargetStatus] = useState<string>("assigned");
  const [courierId, setCourierId] = useState<string>("");
  const [assignOrder, setAssignOrder] = useState<TrackingTableRow | null>(null);
  const [icons, setIcons] = useState<GlobalIconsConfig | null>(null);

  useEffect(() => {
    getGlobalIcons().then(setIcons);
  }, []);

  const needsCourier =
    targetStatus === "assigned" ||
    targetStatus === "delivering" ||
    targetStatus === "delivered";

  const selectedIdsArr = useMemo(() => Array.from(selected), [selected]);

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
          priceStr: r.hasDebt && r.priceWithDebtLabel ? r.priceWithDebtLabel : r.totalLabel,
          hasDebt: r.hasDebt,
          calculatedDebt: r.calculatedDebt,
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
          pickupSumDinar: r.pickupSumDinar ?? 0,
          preparerPickupSumDinar: r.preparerPickupSumDinar ?? null,
          adminPickupSumDinar: r.adminPickupSumDinar ?? null,
          deliverySumDinar: r.deliverySumDinar ?? 0,
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
          routeMode: r.routeModeLabel === "وجهتين" ? "double" : "single",
          secondCustomerRegionName: r.secondCustomerRegionName,
        };
      }),
    [rows],
  );

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
      <div className="flex flex-wrap items-center justify-between gap-2">
        {visibleIds.length > 0 ? (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() =>
                setShowQuickSelect((v) => {
                  if (v) setSelected(new Set());
                  return !v;
                })
              }
              className={`flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-bold transition ${
                showQuickSelect
                  ? "bg-sky-600 border-sky-700 text-white shadow-sm"
                  : "border-sky-200 bg-sky-50 text-sky-900 hover:bg-sky-100"
              }`}
            >
              ⚡ تحديد سريع
              <span className={showQuickSelect ? "text-white" : "text-sky-400"}>
                {showQuickSelect ? "▲" : "▼"}
              </span>
            </button>
          </div>
        ) : <div />}

        {/* أزرار التبديل بين عرض الكروت وعرض الجدول */}
        <div className="flex items-center gap-1 rounded-xl bg-slate-100 p-1 border border-slate-200">
          <button
            type="button"
            onClick={() => setViewMode("cards")}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-black transition ${
              viewMode === "cards"
                ? "bg-white text-sky-900 shadow-xs ring-1 ring-slate-200"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <span>📱</span>
            <span>عرض البطاقات</span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode("table")}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-black transition ${
              viewMode === "table"
                ? "bg-white text-sky-900 shadow-xs ring-1 ring-slate-200"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <span>📋</span>
            <span>عرض الجدول</span>
          </button>
        </div>
      </div>

      {showQuickSelect && visibleIds.length > 0 && (
        <div className="rounded-2xl border border-sky-200 bg-sky-50/70 p-3 shadow-xs animate-in fade-in slide-in-from-top-2">
          <p className="mb-2 text-xs font-bold text-slate-700">
            اختر حالة و/أو مندوباً ثم اضغط «تحديد المطابقين»
          </p>
          <div className="flex flex-wrap items-end gap-2">
            <label className="flex flex-col gap-0.5 text-xs font-bold text-slate-600">
              الحالة الحالية
              <select
                value={quickStatus}
                onChange={(e) => setQuickStatus(e.target.value)}
                className="min-h-[40px] rounded-xl border border-sky-200 bg-white px-2.5 py-1.5 text-sm font-bold text-slate-800 outline-none"
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
                className="min-h-[40px] min-w-[10rem] rounded-xl border border-sky-200 bg-white px-2.5 py-1.5 text-sm font-bold text-slate-800 outline-none"
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
              className="min-h-[40px] rounded-xl bg-sky-700 px-3.5 py-2 text-sm font-bold text-white shadow-sm hover:bg-sky-800 active:scale-95"
            >
              تحديد المطابقين
            </button>
            <button
              type="button"
              onClick={selectAllVisible}
              className="min-h-[40px] rounded-xl border border-sky-300 bg-white px-3.5 py-2 text-sm font-bold text-slate-800 hover:bg-sky-50 active:scale-95"
            >
              تحديد الكل الظاهر
            </button>
            <button
              type="button"
              onClick={clearSelection}
              className="min-h-[40px] rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm font-bold text-slate-600 hover:bg-slate-50 active:scale-95"
            >
              إفراغ التحديد
            </button>
          </div>
        </div>
      )}

      {selectedCount ? (
        <div className="fixed bottom-5 left-4 right-4 md:left-1/2 md:right-auto md:-translate-x-1/2 z-50 w-auto max-w-[calc(100vw-2rem)] md:max-w-5xl rounded-3xl border-2 border-sky-300 bg-white/95 backdrop-blur-md px-4 py-3.5 shadow-[0_15px_40px_rgba(14,165,233,0.22)] animate-in fade-in slide-in-from-bottom-8 duration-300" dir="rtl">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="flex items-center justify-between lg:justify-start gap-3 border-b lg:border-b-0 pb-2 lg:pb-0 border-slate-100">
              <div>
                <p className="text-sm font-black text-slate-800">
                  تم اختيار <span className="text-lg font-extrabold text-sky-700">{selectedCount}</span> طلبية
                </p>
                {bulkState.error ? (
                  <p className="mt-0.5 text-xs font-bold text-rose-600">
                    {bulkState.error}
                  </p>
                ) : null}
                {bulkPending ? (
                  <p className="mt-0.5 text-[11px] font-bold text-sky-850 animate-pulse">جارٍ حفظ التعديلات… ⏳</p>
                ) : null}
              </div>
              <button
                type="button"
                onClick={clearSelection}
                className="lg:hidden flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 text-sm font-bold"
                title="إلغاء التحديد"
              >
                ✕
              </button>
            </div>

            <form action={bulkAction} className="flex flex-wrap items-end justify-center lg:justify-end gap-2.5">
              {selectedIdsArr.map((id) => (
                <input key={id} type="hidden" name="orderIds" value={id} />
              ))}

              <label className="flex flex-col gap-0.5 text-xs font-bold text-slate-500">
                الحالة الجديدة
                <select
                  name="targetStatus"
                  value={targetStatus}
                  onChange={(e) => setTargetStatus(e.target.value)}
                  className="h-10 rounded-xl border border-sky-200 bg-white px-2.5 py-1 text-xs font-black text-slate-850 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                >
                  <option value="pending">قيد الانتظار (جديد)</option>
                  <option value="assigned">مسند للمندوب</option>
                  <option value="delivering">عند المندوب (بالتوصيل)</option>
                  <option value="delivered">تم التسليم</option>
                  <option value="cancelled">مرفوض</option>
                  <option value="archived">مؤرشف</option>
                </select>
              </label>

              {needsCourier ? (
                <label className="flex flex-col gap-0.5 text-xs font-bold text-slate-500">
                  المندوب المسند
                  <select
                    name="courierId"
                    value={courierId}
                    onChange={(e) => setCourierId(e.target.value)}
                    className="h-10 min-w-[9.5rem] rounded-xl border border-sky-200 bg-white px-2.5 py-1 text-xs font-black text-slate-850 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                  >
                    <option value="">اختر مندوب للطلب…</option>
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
                <div className="flex h-10 items-center gap-2 bg-sky-50 px-3 rounded-xl border border-sky-200">
                  <input type="checkbox" id="bulk-direct-tracking" name="directReceipt" className="h-4.5 w-4.5 rounded border-sky-400 text-sky-600 focus:ring-sky-400" />
                  <label htmlFor="bulk-direct-tracking" className="text-[10px] font-black text-sky-950 cursor-pointer select-none">استلام مباشر ⚡</label>
                </div>
              )}

              <button
                type="submit"
                disabled={bulkPending || (needsCourier && !courierId)}
                className="h-10 rounded-xl bg-gradient-to-r from-sky-600 to-cyan-600 px-5 text-xs font-black text-white shadow-md shadow-sky-200/80 ring-1 ring-sky-400/30 transition hover:from-sky-700 hover:to-cyan-700 active:scale-95 disabled:opacity-50"
              >
                تطبيق الإجراء
              </button>

              <button
                type="button"
                onClick={clearSelection}
                className="hidden lg:flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-600 transition"
                title="إلغاء التحديد وإفراغ القائمة"
              >
                ✕
              </button>
            </form>
          </div>
        </div>
      ) : null}

      {/* المحتوى الرئيسي: عرض البطاقات (مثل المندوبين) أو عرض الجدول */}
      {viewMode === "cards" ? (
        <TrackingCardsView
          rows={rows}
          onOpenRow={(id) => router.push(`${SECRET_ADMIN_PATH}/orders/${id}`)}
          onAssignOrder={(r) => setAssignOrder(r)}
          icons={icons}
          showSelectColumn={showSelectColumn}
          isSelected={(id) => selected.has(id)}
          onToggleOne={toggleOne}
        />
      ) : (
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
            router.push(`${SECRET_ADMIN_PATH}/orders/${id}`);
          }}
          selectAllTitle="تحديد الكل"
          selectAllAriaLabel="تحديد كل الطلبات الظاهرة"
          selectedTitle="تحديد"
          selectedAriaPrefix="تحديد الطلب"
          showStatusDotInSelectCol={false}
          renderOrderIdBadge={() => null}
          renderBelowOrderId={(row) => {
            if (row.orderStatus === "cancelled" || row.orderStatus === "archived") return null;
            const originalRow = rows.find((r) => r.id === row.id);
            const isAssigned = row.orderStatus !== "pending" || Boolean(row.assignedCourierName && row.assignedCourierName !== "—");
            return (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  if (originalRow) setAssignOrder(originalRow);
                }}
                className={`flex h-11 px-3 items-center justify-center gap-1 rounded-2xl bg-white border-2 shadow-sm transition hover:bg-emerald-50 active:scale-90 text-xs font-black ${
                  isAssigned ? "border-violet-300 text-violet-700 hover:border-violet-500" : "border-emerald-200 text-emerald-700 hover:border-emerald-400"
                }`}
                title={isAssigned ? "تغيير المندوب" : "إسناد لمندوب"}
              >
                <span>🛵</span>
                <span>{isAssigned ? (row.assignedCourierName || "تغيير") : "إسناد"}</span>
              </button>
            );
          }}
        />
      )}

      {/* نافذة الإسناد السريع للمندوبين */}
      {assignOrder && (
        <div className="fixed inset-0 z-[100] flex items-start justify-center bg-slate-900/50 p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="mt-8 w-full max-w-md animate-in slide-in-from-top-4 rounded-3xl bg-white p-5 shadow-2xl ring-1 ring-slate-200" dir="rtl">
            <div className="mb-4 flex items-center justify-between border-b pb-3">
              <div>
                <h3 className="text-xl font-black text-slate-900">إسناد لمندوب</h3>
                <p className="text-sm font-bold text-slate-500">الطلب #{assignOrder.orderNumber}</p>
              </div>
              <button
                type="button"
                onClick={() => setAssignOrder(null)}
                className="h-10 w-10 rounded-full bg-slate-100 text-xl font-bold text-slate-500 hover:bg-slate-200 flex items-center justify-center"
              >
                ✕
              </button>
            </div>

            <div className="max-h-[60vh] overflow-y-auto pt-1 space-y-3">
              <div className="flex items-center gap-2 bg-emerald-50 p-3 rounded-2xl border border-emerald-200">
                <input type="checkbox" id="direct-receipt-tracking-modal" className="h-5 w-5 rounded border-emerald-400 text-emerald-600 focus:ring-emerald-400" />
                <label htmlFor="direct-receipt-tracking-modal" className="text-sm font-black text-emerald-950 cursor-pointer select-none">
                  استلام مباشر للمندوب (تخطي الموافقة) ⚡
                </label>
              </div>

              <div className="grid grid-cols-2 gap-2">
                {couriers.map((c) => {
                  const isCurrent = assignOrder.assignedCourierId === c.id || (assignOrder.courierName && assignOrder.courierName === c.name);
                  return (
                    <button
                      key={c.id}
                      type="button"
                      disabled={bulkPending}
                      onClick={async () => {
                        const direct = (document.getElementById('direct-receipt-tracking-modal') as HTMLInputElement)?.checked;
                        const fd = new FormData();
                        fd.append("orderIds", assignOrder.id);
                        fd.append("targetStatus", direct ? "delivering" : "assigned");
                        fd.append("courierId", c.id);
                        if (direct) fd.append("directReceipt", "on");
                        setAssignOrder(null);
                        const res = await bulkUpdateOrdersStatus({}, fd);
                        if (res.error) alert(res.error);
                        else router.refresh();
                      }}
                      className={`w-full rounded-2xl border-2 px-3.5 py-3 text-right text-sm sm:text-base font-bold transition active:scale-[0.98] disabled:opacity-60 ${
                        isCurrent
                          ? "border-emerald-500 bg-emerald-50 text-emerald-950 ring-2 ring-emerald-400"
                          : "border-slate-100 bg-slate-50 text-slate-900 hover:border-emerald-500 hover:bg-emerald-50"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-black truncate">{c.name}</span>
                        {isCurrent && <span className="text-emerald-600 font-bold text-xs">✓</span>}
                      </div>
                      {isCurrent && (
                        <span className="block text-[11px] font-bold text-emerald-700 mt-0.5">مسند حالياً</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
