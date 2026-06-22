"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  bulkSetMandoubOrdersStatus,
} from "./actions";
import {
  MandoubBulkStatusState,
  MandoubCashState,
} from "./types";
import { UnifiedOrderListTable } from "@/components/unified-order-list-table";
import { PickupMoneyForm, DeliveryMoneyForm } from "./mandoub-order-money-flow";
import { submitMandoubDeliveryMoney, submitMandoubPickupMoney } from "./cash-actions";
import { dinarDecimalToAlfInputString } from "@/lib/money-alf";
import { createPortal } from "react-dom";
import { getGlobalIcons, GlobalIconsConfig } from "@/lib/icon-settings";
import { DynamicIcon } from "@/components/dynamic-icon";
import { toast } from "sonner";
import { useRef } from "react";
import { OrderDetailSection } from "./order-detail-section";
import { MandoubWalletClient } from "./mandoub-wallet-client";

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
  shopRegionName?: string | null;
  submitterName?: string | null;
  customerName?: string | null;
  /** أقرب نقطة دالة (يدوي/موجودة في الطلب) */
  landmarkLine?: string | null;
  /** سطر ذكي مشتق من أقرب مدخل داخل المنطقة */
  smartHintLine?: string | null;
  /** سطر ذكي مشتق من أقرب مدخل للوجهة الثانية */
  secondSmartHintLine?: string | null;
  orderType: string;
  priceStr: string;
  delStr: string;
  customerPhone: string;
  timeLine: string;
  orderNoteTime?: string | null;
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
  /** سعر التوصيل بالدينار */
  deliveryPriceDinar?: number | null;
  /** سعر الطلب الكلي (مع التوصيل) بالدينار */
  totalAmountDinar?: number | null;
  /** مجموع ما تم دفعه للعميل بالدينار */
  pickupSumDinar?: number;
  /** مجموع ما تم دفعه من قبل المجهز بالدينار */
  preparerPickupSumDinar?: number | null;
  /** مجموع ما تم دفعه من قبل الإدارة بالدينار */
  adminPickupSumDinar?: number | null;
  /** مجموع ما تم استلامه من الزبون بالدينار */
  deliverySumDinar?: number;
  /** تنبيهات مالية */
  wardMismatchType?: "excess" | "deficit" | null;
  saderMismatchType?: "excess" | "deficit" | null;
  /** لم يتم تسجيل أي وارد (مهم للتسليم) */
  noWardRecorded?: boolean;
  /** لم يتم تسجيل أي صادر (مهم للاستلام) */
  noSaderRecorded?: boolean;
  createdAt?: Date | string;
  moneyEvents?: any[];
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
  secondCustomerRegionName?: string | null;
  secondCustomerLandmark?: string | null;
  /** تسجيل صوتي من العميل (المجهز) */
  preparerAudioUrl?: string | null;
  /** تسجيل صوتي من الإدارة */
  adminAudioUrl?: string | null;
  /** تفضيل نوع المركبة (Bike/Car) */
  vehiclePreference?: string | null;
  /** إعدادات ظهور الأزرار للمندوب */
  showDoorBtn?: boolean;
  showLocationBtn?: boolean;
  showCallBtn?: boolean;
  showWhatsAppBtn?: boolean;
  showNotesBtn?: boolean;
  showVoiceNotesBtn?: boolean;
  showMoneyBoxes?: boolean;
  imageUrl?: string | null;
  submissionSource?: string | null;
  phoneProfile?: any;
  secondPhoneProfile?: any;
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
const initialCash: MandoubCashState = {};

export function MandoubOrderTable({
  rows,
  auth,
  tab,
  qSearch,
  onSearchChange,
  listOrdersStampSig,
  walletData,
  courierName,
  showQuickSelect,
  setShowQuickSelect,
  isSortingMode,
  setIsSortingMode,
  showSearch,
  setShowSearch,
}: {
  rows: MandoubRow[];
  auth: { c: string; exp: string; s: string };
  tab: string;
  qSearch: string;
  onSearchChange: (q: string) => void;
  listOrdersStampSig: string;
  walletData: any;
  courierName: string;
  showQuickSelect: boolean;
  setShowQuickSelect: (v: boolean) => void;
  isSortingMode: boolean;
  setIsSortingMode: (v: boolean) => void;
  showSearch: boolean;
  setShowSearch: (v: boolean) => void;
}) {
  const router = useRouter();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const searchParams = useSearchParams();
  const activeOrderParam = searchParams.get("activeOrderId");
  const [activeOrderId, setActiveOrderId] = useState<string | null>(activeOrderParam || null);

  useEffect(() => {
    setActiveOrderId(activeOrderParam);
  }, [activeOrderParam]);
  const [showWallet, setShowWallet] = useState(false);
  const [bulkState, bulkAction, bulkPending] = useActionState(
    bulkSetMandoubOrdersStatus,
    initialBulk,
  );
  const [pickupOrder, setPickupOrder] = useState<MandoubRow | null>(null);
  const [deliveryOrder, setDeliveryOrder] = useState<MandoubRow | null>(null);
  const [rowStatusOverrides, setRowStatusOverrides] = useState<Record<string, string>>({});
  const [localPending, setLocalPending] = useState(false);
  const pickupSubmitInFlightRef = useRef(false);
  const deliverySubmitInFlightRef = useRef(false);

  const [pickupState, pickupAction, pickupPending] = useActionState(
    submitMandoubPickupMoney,
    initialCash,
  );
  const [deliveryState, deliveryAction, deliveryPending] = useActionState(
    submitMandoubDeliveryMoney,
    initialCash,
  );
  const [icons, setIcons] = useState<GlobalIconsConfig | null>(null);
  const [customSortIds, setCustomSortIds] = useState<string[]>([]);

  // تحميل الترتيب المخصص من التخزين المحلي
  useEffect(() => {
    const saved = localStorage.getItem(`mandoub_sort_${auth.c}`);
    if (saved) {
      try {
        setCustomSortIds(JSON.parse(saved));
      } catch (e) {}
    }
  }, [auth.c]);

  // حفظ الترتيب المخصص
  const saveSortOrder = (newOrder: string[]) => {
    setCustomSortIds(newOrder);
    localStorage.setItem(`mandoub_sort_${auth.c}`, JSON.stringify(newOrder));
  };

  const resetSortOrder = () => {
    setCustomSortIds([]);
    localStorage.removeItem(`mandoub_sort_${auth.c}`);
    toast.success("تمت العودة للترتيب الأصلي");
  };

  const smartSortByRegion = () => {
    const sorted = [...displayRows].sort((a, b) => {
      // أولاً حسب الحالة (المستلم أولاً)
      const statusOrder: Record<string, number> = { "delivering": 0, "assigned": 1, "delivered": 2 };
      const statusDiff = (statusOrder[a.orderStatus] ?? 9) - (statusOrder[b.orderStatus] ?? 9);
      if (statusDiff !== 0) return statusDiff;

      // ثانياً حسب المنطقة
      return a.regionLine.localeCompare(b.regionLine, 'ar');
    });

    const newIds = sorted.map(r => r.id);
    saveSortOrder(newIds);
    toast.success("تم الترتيب ذكياً حسب الحالة والمنطقة");
  };

  const handleRowReorder = (draggedId: string, targetId: string) => {
    // نأخذ الطلبات النشطة فقط للترتيب (المستلمة وبانتظار المندوب)
    const activeRows = displayRows.filter(r => r.orderStatus !== "delivered");
    const activeIds = activeRows.map(r => r.id);

    const draggedIdx = activeIds.indexOf(draggedId);
    const targetIdx = activeIds.indexOf(targetId);

    if (draggedIdx === -1 || targetIdx === -1) return;

    const newIds = [...activeIds];
    const [movedItem] = newIds.splice(draggedIdx, 1);
    newIds.splice(targetIdx, 0, movedItem!);

    saveSortOrder(newIds);
  };

  const moveRow = (id: string, direction: 'up' | 'down') => {
    const activeRows = displayRows.filter(r => r.orderStatus !== "delivered");
    const activeIds = activeRows.map(r => r.id);
    const index = activeIds.indexOf(id);
    if (index === -1) return;

    const newIds = [...activeIds];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;

    if (targetIndex >= 0 && targetIndex < newIds.length) {
      const temp = newIds[index];
      newIds[index] = newIds[targetIndex];
      newIds[targetIndex] = temp!;
      saveSortOrder(newIds);

      // تغذية راجعة للاهتزاز على الموبايل
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate(10);
      }
    }
  };

  const handleActionSubmit = async (formData: FormData, type: 'pickup' | 'delivery') => {
    if (type === 'pickup') {
      pickupAction(formData);
    } else {
      deliveryAction(formData);
    }
  };

  useEffect(() => {
    getGlobalIcons().then(setIcons);
  }, []);

  useEffect(() => {
    const handlePopState = () => {
      if (activeOrderId) setActiveOrderId(null);
      if (showWallet) setShowWallet(false);
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [activeOrderId, showWallet]);

  useEffect(() => {
    const handleWalletLauncherClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const launcher = target.closest('.fullscreen-wallet-launcher');
      if (launcher) {
        e.preventDefault();
        setShowWallet(true);
        window.history.pushState({ wallet: true }, "");
      }
    };
    document.addEventListener('click', handleWalletLauncherClick);
    return () => document.removeEventListener('click', handleWalletLauncherClick);
  }, []);

  const displayRows = useMemo(() => {
    const base = rows.map((r) =>
      rowStatusOverrides[r.id]
        ? { ...r, orderStatus: rowStatusOverrides[r.id] }
        : r,
    );

    const active = base.filter(r => r.orderStatus !== "delivered");
    const delivered = base.filter(r => r.orderStatus === "delivered");

    // نطبق الترتيب المخصص على الطلبات النشطة فقط
    const sortedActive = customSortIds.length > 0
      ? [...active].sort((a, b) => {
          const idxA = customSortIds.indexOf(a.id);
          const idxB = customSortIds.indexOf(b.id);
          if (idxA !== -1 && idxB !== -1) return idxA - idxB;
          if (idxA !== -1) return -1;
          if (idxB !== -1) return 1;
          return 0;
        })
      : active;

    // الطلبات المسلمة تبقى دائماً في النهاية ولا تتأثر بالترتيب اليدوي للنشطة
    return [...sortedActive, ...delivered];
  }, [rows, rowStatusOverrides, customSortIds]);

  const tableRowsToRender = displayRows;

  const rowIds = useMemo(() => displayRows.map((r) => r.id), [displayRows]);

  const activeOrderData = useMemo(() => {
    if (!activeOrderId) return null;
    return displayRows.find(r => r.id === activeOrderId);
  }, [activeOrderId, displayRows]);

  const detailsNextUrl = useMemo(() => {
    const p = new URLSearchParams();
    if (auth.c) p.set("c", auth.c);
    if (auth.exp) p.set("exp", auth.exp);
    if (auth.s) p.set("s", auth.s);
    p.set("tab", tab);
    if (qSearch.trim()) p.set("q", qSearch.trim());
    if (activeOrderId) p.set("activeOrderId", activeOrderId);
    return `/mandoub?${p.toString()}`;
  }, [auth, tab, qSearch, activeOrderId]);

  const rowDetailHrefs = useMemo(
    () => displayRows.map((r) => buildOrderDetailHref(auth, tab, qSearch, r.id)),
    [displayRows, auth, tab, qSearch],
  );

  useEffect(() => {
    if (bulkState.ok) {
      setSelectedIds(new Set());
      router.refresh();
    }
  }, [bulkState.ok, router]);

  useEffect(() => {
    if (pickupPending) {
      pickupSubmitInFlightRef.current = true;
      return;
    }
    if (!pickupSubmitInFlightRef.current) return;
    pickupSubmitInFlightRef.current = false;
    if (!pickupState.ok || !pickupOrder) return;
    setRowStatusOverrides((prev) => ({ ...prev, [pickupOrder.id]: "delivering" }));
    setPickupOrder(null);
  }, [pickupPending, pickupState.ok, pickupOrder]);

  useEffect(() => {
    if (deliveryPending) {
      deliverySubmitInFlightRef.current = true;
      return;
    }
    if (!deliverySubmitInFlightRef.current) return;
    deliverySubmitInFlightRef.current = false;
    if (!deliveryState.ok || !deliveryOrder) return;
    setRowStatusOverrides((prev) => ({ ...prev, [deliveryOrder.id]: "delivered" }));
    setDeliveryOrder(null);
  }, [deliveryPending, deliveryState.ok, deliveryOrder]);

  const allSelected = useMemo(() => rowIds.length > 0 && rowIds.every((id) => selectedIds.has(id)), [rowIds, selectedIds]);

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

  return (
    <div>
      {bulkState.error ? (
        <div className="mb-3 rounded-xl border border-rose-300 bg-rose-50 px-3 py-2 text-sm font-bold text-rose-900">
          {bulkState.error}
        </div>
      ) : null}

      {showSearch && (
        <div className="px-2 py-2 sm:px-3 mb-2 animate-in fade-in slide-in-from-top-2">
          <div className="relative">
            <input
              type="search"
              value={qSearch}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="بحث — محل، رقم، هاتف…"
              className="h-[42px] w-full rounded-xl border border-sky-200 bg-white pl-10 pr-3 py-2 text-sm text-slate-800 outline-none placeholder:text-slate-400 focus:border-sky-500 focus:ring-2 focus:ring-sky-200 shadow-sm"
              dir="rtl"
              autoComplete="off"
              enterKeyHint="search"
            />
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-sky-400 pointer-events-none">
              <DynamicIcon icon={icons?.ui_search} fallback="🔍" width={18} height={18} />
            </div>
          </div>
        </div>
      )}

      {isSortingMode && rowIds.length > 1 && (
        <div className="px-2 py-2 sm:px-3 mb-2 flex items-center gap-2 animate-in fade-in slide-in-from-top-2">
          <button
            type="button"
            onClick={smartSortByRegion}
            className="flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-900 hover:bg-emerald-100 shadow-sm"
          >
            <DynamicIcon iconKey="ui_flash" config={icons} className="w-3.5 h-3.5 text-emerald-600" fallback="✨" />
            ترتيب ذكي للمسار
          </button>
          <button
            type="button"
            onClick={resetSortOrder}
            className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 shadow-sm"
          >
            <DynamicIcon iconKey="ui_refresh" config={icons} className="w-3.5 h-3.5 text-slate-500" fallback="🔄" />
            الترتيب الأصلي
          </button>
        </div>
      )}

      <UnifiedOrderListTable
        rows={tableRowsToRender}
        colCount={9}
        showSelectColumn={showQuickSelect}
        isRowSelectable={() => true}
        isSelected={(id) => selectedIds.has(id)}
        allSelected={allSelected}
        onToggleAll={toggleAll}
        onToggleOne={toggleOne}
        onOpenRow={(id) => {
          if (isSortingMode) return;
          setActiveOrderId(id);
          const p = new URLSearchParams(window.location.search);
          p.set("activeOrderId", id);
          window.history.pushState({ orderId: id }, "", `?${p.toString()}`);
        }}
        onRowReorder={isSortingMode ? handleRowReorder : undefined}
        canDragRow={(o) => o.orderStatus !== "delivered"}
        canDropOnRow={(o) => o.orderStatus !== "delivered"}
        selectAllTitle="تحديد الكل"
        selectAllAriaLabel="تحديد كل الطلبات الظاهرة"
        selectedTitle="تحديد"
        selectedAriaPrefix="تحديد الطلب"
        showStatusDotInSelectCol={false}
        renderOrderIdBadge={(o) => {
          if (!isSortingMode || o.orderStatus === "delivered") return null;
          return (
            <div className="flex flex-col items-center gap-1.5 py-1.5" onClick={e => e.stopPropagation()}>
              <button
                type="button"
                onClick={() => moveRow(o.id, 'up')}
                className="flex size-8 items-center justify-center rounded-lg bg-white text-indigo-500 border border-indigo-100 hover:bg-indigo-600 hover:text-white transition-all active:scale-90 shadow-sm"
                title="تحريك للأعلى"
              >
                <DynamicIcon iconKey="ui_chevron_up" config={icons} fallback="▲" className="w-4 h-4" />
              </button>

              <div
                className="cursor-grab active:cursor-grabbing flex size-10 items-center justify-center bg-indigo-50 text-indigo-600 rounded-xl border border-indigo-100 hover:bg-indigo-600 hover:text-white transition-all shadow-md group/handle"
                title="اضغط واسحب للترتيب"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
                  <circle cx="9" cy="5" r="1.5" fill="currentColor"></circle>
                  <circle cx="9" cy="12" r="1.5" fill="currentColor"></circle>
                  <circle cx="9" cy="19" r="1.5" fill="currentColor"></circle>
                  <circle cx="15" cy="5" r="1.5" fill="currentColor"></circle>
                  <circle cx="15" cy="12" r="1.5" fill="currentColor"></circle>
                  <circle cx="15" cy="19" r="1.5" fill="currentColor"></circle>
                </svg>
              </div>

              <button
                type="button"
                onClick={() => moveRow(o.id, 'down')}
                className="flex size-8 items-center justify-center rounded-lg bg-white text-indigo-500 border border-indigo-100 hover:bg-indigo-600 hover:text-white transition-all active:scale-90 shadow-sm"
                title="تحريك للأسفل"
              >
                <DynamicIcon iconKey="ui_chevron_down" config={icons} fallback="▼" className="w-4 h-4" />
              </button>
            </div>
          );
        }}
        renderBelowOrderId={(o) => {
          if (isSortingMode) return null;
          if (o.orderStatus === "assigned") {
            return (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setPickupOrder(o);
                }}
                className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-white border-2 border-emerald-100 shadow-sm transition hover:bg-emerald-50 active:scale-90 p-1.5"
                title="تم الاستلام (تسجيل دفع للعميل)"
              >
                <DynamicIcon
                  icon={icons?.order_received}
                  className="w-full h-full"
                  fallback={<span className="text-xl">💵</span>}
                />
              </button>
            );
          }
          if (o.orderStatus === "delivering") {
            return (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setDeliveryOrder(o);
                }}
                className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-white border-2 border-rose-100 shadow-sm transition hover:bg-rose-50 active:scale-90 p-1.5"
                title="تم التسليم (تسجيل استلام من الزبون)"
              >
                <DynamicIcon
                  icon={icons?.order_delivered}
                  className="w-full h-full"
                  fallback={<span className="text-xl">🚚</span>}
                />
              </button>
            );
          }
          return null;
        }}
      />

      {pickupOrder &&
        createPortal(
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm overflow-y-auto sm:p-6">
            <div className="my-auto w-full max-w-md animate-in fade-in zoom-in-95 rounded-2xl bg-white p-5 shadow-2xl" dir="rtl">
              <div className="mb-4 flex items-center justify-between border-b pb-3">
                <h3 className="text-lg font-bold text-slate-900">تسجيل استلام - طلب #{pickupOrder.shortId}</h3>
                <button
                  onClick={() => setPickupOrder(null)}
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200"
                >
                  <DynamicIcon iconKey="ui_close" config={icons} fallback="✕" className="w-4 h-4" />
                </button>
              </div>
              <PickupMoneyForm
                orderId={pickupOrder.id}
                auth={auth}
                nextUrl={`/mandoub?tab=${tab}&q=${qSearch}`}
                expectedAlfHint={pickupOrder.orderSubtotalDinar != null ? dinarDecimalToAlfInputString(pickupOrder.orderSubtotalDinar) : ""}
                remainingAlfHint={
                  pickupOrder.orderSubtotalDinar != null
                    ? dinarDecimalToAlfInputString(pickupOrder.orderSubtotalDinar - (pickupOrder.pickupSumDinar || 0))
                    : ""
                }
                advanceToDelivering={true}
                pickupRemainingDinar={
                  pickupOrder.orderSubtotalDinar != null ? pickupOrder.orderSubtotalDinar - (pickupOrder.pickupSumDinar || 0) : null
                }
                pickupSumDinar={pickupOrder.pickupSumDinar || 0}
                orderSubtotalDinar={pickupOrder.orderSubtotalDinar ?? null}
                formAction={(fd) => pickupAction(fd)}
                pending={pickupPending || localPending}
                error={pickupState.error}
                onClose={() => setPickupOrder(null)}
                noRedirect
              />
            </div>
          </div>,
          document.body,
        )}

      {deliveryOrder &&
        createPortal(
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm overflow-y-auto sm:p-6">
            <div className="my-auto w-full max-w-md animate-in fade-in zoom-in-95 rounded-2xl bg-white p-5 shadow-2xl" dir="rtl">
              <div className="mb-4 flex items-center justify-between border-b pb-3">
                <h3 className="text-lg font-bold text-slate-900">تسجيل تسليم - طلب #{deliveryOrder.shortId}</h3>
                <button
                  onClick={() => setDeliveryOrder(null)}
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200"
                >
                  <DynamicIcon iconKey="ui_close" config={icons} fallback="✕" className="w-4 h-4" />
                </button>
              </div>
              <DeliveryMoneyForm
                orderId={deliveryOrder.id}
                auth={auth}
                nextUrl={`/mandoub?tab=${tab}&q=${qSearch}`}
                expectedAlfHint={deliveryOrder.totalAmountDinar != null ? dinarDecimalToAlfInputString(deliveryOrder.totalAmountDinar) : ""}
                remainingAlfHint={
                  deliveryOrder.totalAmountDinar != null
                    ? dinarDecimalToAlfInputString(deliveryOrder.totalAmountDinar - (deliveryOrder.deliverySumDinar || 0))
                    : ""
                }
                advanceToDelivered={true}
                deliveryRemainingDinar={
                  deliveryOrder.totalAmountDinar != null ? deliveryOrder.totalAmountDinar - (deliveryOrder.deliverySumDinar || 0) : null
                }
                deliverySumDinar={deliveryOrder.deliverySumDinar || 0}
                totalAmountDinar={deliveryOrder.totalAmountDinar ?? null}
                formAction={(fd) => deliveryAction(fd)}
                pending={deliveryPending || localPending}
                error={deliveryState.error}
                onClose={() => setDeliveryOrder(null)}
                missingCustomerLocation={!deliveryOrder.hasCustomerLocation}
                noRedirect
              />
            </div>
          </div>,
          document.body,
        )}

      {/* نافذة تفاصيل الطلب الكاملة - تعمل أوفلاين */}
      {activeOrderData &&
        createPortal(
          <div className="fixed inset-0 z-[110] bg-slate-50 dark:bg-slate-950 overflow-y-auto">
            <div className="sticky top-0 z-[120] flex items-center gap-3 bg-white/90 dark:bg-slate-900/90 p-3 shadow-md backdrop-blur-md">
              <button
                onClick={() => {
                  const p = new URLSearchParams(window.location.search);
                  p.delete("activeOrderId");
                  // نستخدم window.location.href لضمان العودة الحقيقية للصفحة الرئيسية وتجنب إغلاق التطبيق في المتصفحات المساعدة
                  window.location.href = window.location.pathname + "?" + p.toString();
                }}
                className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
              >
                <DynamicIcon iconKey="ui_close" config={icons} fallback="✕" className="w-5 h-5" />
              </button>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-black text-slate-900 dark:text-white truncate">تفاصيل طلب #{activeOrderData.shortId}</p>
                <p className="text-[10px] font-bold text-slate-500">{activeOrderData.shopName}</p>
              </div>
            </div>

            <div className="pb-20">
              <OrderDetailSection
                order={{
                  ...activeOrderData as any,
                  orderNoteTime: activeOrderData.orderNoteTime || activeOrderData.timeLine,
                  orderSubtotal: activeOrderData.orderSubtotalDinar,
                  deliveryPrice: activeOrderData.deliveryPriceDinar,
                  totalAmount: activeOrderData.totalAmountDinar,
                  status: activeOrderData.orderStatus,
                  orderNumber: Number(activeOrderData.shortId), // استخدام shortId كرقم عرض
                  customerLandmark: activeOrderData.landmarkLine,
                  secondCustomerLandmark: activeOrderData.secondCustomerLandmark,
                  moneyEvents: activeOrderData.moneyEvents || [],
                  shop: {
                     name: activeOrderData.shopName,
                     phone: activeOrderData.shopPhone,
                     photoUrl: activeOrderData.shopDoorPhotoUrl,
                     locationUrl: activeOrderData.shopLocationUrl,
                     region: { name: activeOrderData.shopRegionName || "—" },
                     ownerName: activeOrderData.submitterName,
                  } as any,
                  customerRegion: { name: activeOrderData.regionLine } as any,
                  secondCustomerRegion: { name: activeOrderData.secondCustomerRegionName || "—" } as any,
                  customer: {
                     name: activeOrderData.customerName,
                  } as any,
                  submittedBy: { name: activeOrderData.submitterName } as any,
                  routeMode: activeOrderData.routeMode,
                  submissionSource: activeOrderData.submissionSource,
                  secondCustomerPhone: activeOrderData.secondCustomerPhone,
                }}
                auth={auth}
                closeHref="#"
                nextUrl={detailsNextUrl}
                viewerCourierId={auth.c}
                phoneProfile={activeOrderData.phoneProfile}
                secondPhoneProfile={activeOrderData.secondPhoneProfile}
                smartHintLine={activeOrderData.smartHintLine}
                secondSmartHintLine={activeOrderData.secondSmartHintLine}
                icons={icons}
                courierSettings={{
                  showDoorBtn: true,
                  showLocationBtn: true,
                  showCallBtn: true,
                  showWhatsAppBtn: true,
                  showNotesBtn: true,
                  showVoiceNotesBtn: true,
                }}
              />
            </div>
          </div>,
          document.body
        )
      }

      {/* نافذة المحفظة - تعمل أوفلاين */}
      {showWallet &&
        createPortal(
          <div className="fixed inset-0 z-[110] bg-slate-50 dark:bg-slate-950 overflow-y-auto">
            <div className="sticky top-0 z-[120] flex items-center gap-3 bg-white/90 dark:bg-slate-900/90 p-3 shadow-md backdrop-blur-md">
              <button
                onClick={() => {
                  setShowWallet(false);
                  window.history.back();
                }}
                className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
              >
                <DynamicIcon iconKey="ui_close" config={icons} fallback="✕" className="w-5 h-5" />
              </button>
              <div className="flex-1 min-w-0 text-right" dir="rtl">
                <p className="text-sm font-black text-slate-900 dark:text-white">محفظة المندوب</p>
                <p className="text-[10px] font-bold text-slate-500">سجل المعاملات والتحويلات</p>
              </div>
            </div>

            <div className="pb-20">
              <MandoubWalletClient
                {...walletData}
                auth={auth}
                ledgerFilter="all"
              />
            </div>
          </div>,
          document.body
        )
      }


      {selectedIds.size > 0 && typeof document !== "undefined" ? (
        createPortal(
          <form
            action={bulkAction}
            className="fixed bottom-4 left-4 right-4 z-[105] rounded-3xl border-2 border-red-200 bg-white/95 backdrop-blur-md px-4 py-3 shadow-2xl animate-in slide-in-from-bottom duration-300 md:left-auto md:right-4 md:w-full md:max-w-md"
            dir="rtl"
          >
            <input type="hidden" name="c" value={auth.c} />
            <input type="hidden" name="exp" value={auth.exp} />
            <input type="hidden" name="s" value={auth.s} />
            <input type="hidden" name="orderIds" value={Array.from(selectedIds).join(",")} />
            
            <div className="flex flex-col gap-2.5">
              {/* Row 1: Text and Close button */}
              <div className="flex items-center justify-between gap-4 border-b border-red-50 pb-2">
                <p className="text-sm font-black text-red-950">
                  تم تحديد{" "}
                  <span className="tabular-nums text-red-800 text-base">{selectedIds.size}</span> طلباً — اضغط اللون المناسب:
                </p>
                <button
                  type="button"
                  onClick={() => setSelectedIds(new Set())}
                  className="w-7 h-7 flex items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-rose-100 hover:text-rose-600 transition-all font-black text-xs border-0 cursor-pointer shadow-sm shrink-0"
                  title="إلغاء التحديد"
                >
                  ✕
                </button>
              </div>

              {/* Row 2: Status action buttons */}
              <div className="flex items-center justify-between gap-2">
                <button
                  type="submit"
                  name="targetStatus"
                  value="assigned"
                  disabled={bulkPending}
                  className="flex-1 min-h-[38px] rounded-xl border-2 border-red-600 bg-red-50 hover:bg-red-100 py-1 px-1.5 text-xs font-black text-red-900 shadow-sm transition active:scale-95 disabled:opacity-50"
                >
                  بانتظار المندوب
                </button>
                <button
                  type="submit"
                  name="targetStatus"
                  value="delivering"
                  disabled={bulkPending}
                  className="flex-1 min-h-[38px] rounded-xl border-2 border-amber-500 bg-amber-50 hover:bg-amber-100 py-1 px-1.5 text-xs font-black text-amber-950 shadow-sm transition active:scale-95 disabled:opacity-50"
                >
                  تم الاستلام
                </button>
                <button
                  type="submit"
                  name="targetStatus"
                  value="delivered"
                  disabled={bulkPending}
                  className="flex-1 min-h-[38px] rounded-xl border-2 border-emerald-600 bg-emerald-50 hover:bg-emerald-100 py-1 px-1.5 text-xs font-black text-emerald-950 shadow-sm transition active:scale-95 disabled:opacity-50"
                >
                  تم التسليم
                </button>
              </div>
            </div>
            
            {bulkPending ? (
              <p className="mt-2 text-center text-xs font-bold text-red-800 animate-pulse">جارٍ التحديث…</p>
            ) : null}
          </form>,
          document.body
        )
      ) : null}
    </div>
  );
}
