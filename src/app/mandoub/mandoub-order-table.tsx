"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  bulkSetMandoubOrdersStatus,
  saveMandoubOrderSortAction,
  resetMandoubOrderSortAction,
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
import { MandoubOrderDetailActions } from "./mandoub-order-detail-actions";
import { MandoubWalletClient } from "./mandoub-wallet-client";
import { MandoubModalContainer } from "./mandoub-modal-container";
import { formatBaghdadDateTime } from "@/lib/baghdad-time";
import { orderStatusBadgeClass } from "@/lib/order-status-style";

const STATUS_AR: Record<string, string> = {
  assigned: "بانتظار المندوب",
  delivering: "مستلم",
  delivered: "تم التسليم",
};

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
  calculatedDebt?: number | null;
  hasDebt?: boolean;
  priceWithDebtLabel?: string;
  /** دفع للعميل (المجهز للطلب) مكتمل */
  pickupComplete?: boolean;
  /** هل هذا طلب تجهيز وتسعير (طلب تجهيز) */
  isPreparationOrder?: boolean;
  /** هل تم تسجيل عملية دفع من قبل المجهز في هذا الطلب */
  hasPreparerPaid?: boolean;
  /** معرف المندوب المسند */
  assignedCourierId?: string | null;
  /** سعر الشراء بالدينار (إن وجد) */
  purchasePriceDinar?: number | null;
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
  /** مجموع ما تم استلامه من الزبون بواسطة المجهز بالدينار */
  preparerDeliverySumDinar?: number | null;
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
  customerRegionId?: string | null;
  secondCustomerRegionName?: string | null;
  secondCustomerRegionId?: string | null;
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
  otherRegionsProfiles?: any[];
  customWaButtons?: any[];
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

function MandoubFullBlockCardGrid({
  rows,
  onOpenRow,
  setPickupOrder,
  setDeliveryOrder,
  icons,
}: {
  rows: OrderTableRowData[];
  onOpenRow: (id: string) => void;
  setPickupOrder: (row: any) => void;
  setDeliveryOrder: (row: any) => void;
  icons: GlobalIconsConfig | null;
}) {
  if (!rows.length) {
    return (
      <div className="py-8 text-center text-slate-500 font-bold bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm text-xs">
        لا توجد طلبات للعرض في هذه القائمة
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-2.5 pb-12">
      {rows.map((o) => {
        const isAssigned = o.orderStatus === "assigned";
        const isDelivering = o.orderStatus === "delivering";
        const isDelivered = o.orderStatus === "delivered";

        // تحديد اللون حسب الحالة (الأحمر بانتظار المندوب، الأصفر مستلم، الأخضر مسلم)
        const statusBorderColor = isAssigned
          ? "border-red-500 bg-red-50/20 dark:bg-red-950/10"
          : isDelivering
          ? "border-amber-400 bg-amber-50/20 dark:bg-amber-950/10"
          : "border-emerald-500 bg-emerald-50/20 dark:bg-emerald-950/10";

        const statusBadgeBg = isAssigned
          ? "bg-red-600 text-white"
          : isDelivering
          ? "bg-amber-500 text-white"
          : "bg-emerald-600 text-white";

        // حساب المبلغ الكلي الظاهر بدقة
        const displayTotal = o.totalAmountDinar != null
          ? `${o.totalAmountDinar} ألف`
          : o.priceStr || "—";

        return (
          <div
            key={o.id}
            onClick={() => onOpenRow(o.id)}
            className={`group relative flex flex-col justify-between rounded-2xl border-2 ${statusBorderColor} bg-white dark:bg-slate-900 p-3 shadow-sm hover:shadow-md transition-all active:scale-[0.98] cursor-pointer overflow-hidden text-xs`}
          >
            <div>
              {/* هيدر الكارت: الزر على اليمين ورقم الطلب على اليسار */}
              <div className="flex items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-2 mb-2">
                {/* اليمين: زر استلام / تسليم أو الشارة */}
                <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                  {isAssigned && (
                    <button
                      type="button"
                      onClick={() => setPickupOrder(o)}
                      className="px-3 py-1 rounded-xl bg-red-600 hover:bg-red-700 text-white font-black text-xs shadow-sm transition active:scale-95 flex items-center gap-1"
                    >
                      <span>استلام</span>
                    </button>
                  )}
                  {isDelivering && (
                    <button
                      type="button"
                      onClick={() => setDeliveryOrder(o)}
                      className="px-3 py-1 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-black text-xs shadow-sm transition active:scale-95 flex items-center gap-1"
                    >
                      <span>تسليم</span>
                    </button>
                  )}
                  {isDelivered && (
                    <span className="rounded-lg bg-emerald-600 px-2.5 py-0.5 text-[11px] font-black text-white">
                      تم التسليم
                    </span>
                  )}
                  {!isAssigned && !isDelivering && !isDelivered && (
                    <span className={`rounded-lg px-2.5 py-0.5 text-[11px] font-black ${statusBadgeBg}`}>
                      {STATUS_AR[o.orderStatus] ?? o.orderStatus}
                    </span>
                  )}
                </div>

                {/* اليسار: رقم الطلب */}
                <span className="text-sm font-black text-slate-900 dark:text-white tabular-nums tracking-tight">
                  #{o.shortId}
                </span>
              </div>

              {/* سطر المسار التسلسلي: اسم المحل ⬅️ المنطقة ⬅️ نوع الطلب ⬅️ السعر الكلي */}
              <div className="bg-slate-50 dark:bg-slate-800/80 rounded-xl p-2 border border-slate-100 dark:border-slate-800 space-y-1.5">
                <div className="flex items-center gap-1.5 flex-wrap text-[11px] font-black text-slate-800 dark:text-slate-100">
                  <span className="text-emerald-700 dark:text-emerald-400 font-black">🏬 {o.shopName}</span>
                  <span className="text-slate-400 font-bold">⬅️</span>
                  <span className="text-sky-700 dark:text-sky-300 font-black">📍 {o.regionLine}</span>
                  <span className="text-slate-400 font-bold">⬅️</span>
                  <span className="text-indigo-700 dark:text-indigo-300 font-bold bg-indigo-50 dark:bg-indigo-950/40 px-1.5 py-0.5 rounded">
                    📦 {o.goodsTypeLine || "عام"}
                  </span>
                  <span className="text-slate-400 font-bold">⬅️</span>
                  <span className="text-emerald-600 dark:text-emerald-400 font-black text-xs tabular-nums bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-900/40">
                    💵 {displayTotal}
                  </span>
                </div>

                {/* تفاصيل إضافية مدمجة للزبون والهاتف والوقت */}
                <div className="flex items-center justify-between gap-1 text-[10px] font-bold text-slate-500 pt-1 border-t border-slate-200/50 dark:border-slate-700/50">
                  <div className="flex items-center gap-1 truncate">
                    {o.customerName && <span className="truncate">👤 {o.customerName}</span>}
                    {o.phoneLine && <span className="font-mono text-slate-600 dark:text-slate-400">📞 {o.phoneLine}</span>}
                  </div>
                  <span className="text-rose-600 dark:text-rose-400 shrink-0 font-black">⏰ {o.orderNoteTime || o.timeLine || "فوري"}</span>
                </div>
              </div>
            </div>

            {/* الوقت والتاريخ بالشريط السفلي الناعم */}
            <div className="mt-1.5 flex items-center justify-between text-[10px] font-bold text-slate-400">
              <span>📅 {o.dateLine}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

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
  customWaButtons,
  initialCustomSortIds,
  courierSettings,
}: {
  rows: MandoubRow[];
  auth: { c: string; exp: string; s: string };
  tab: string;
  qSearch: string;
  onSearchChange: (q: string) => void;
  listOrdersStampSig: string;
  walletData: any;
  courierName: string;
  showQuickSelect?: boolean;
  setShowQuickSelect?: (b: boolean) => void;
  isSortingMode?: boolean;
  setIsSortingMode?: (b: boolean) => void;
  showSearch?: boolean;
  setShowSearch?: (b: boolean) => void;
  customWaButtons?: any[];
  initialCustomSortIds?: string[];
  courierSettings?: any;
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
  const [customSortIds, setCustomSortIds] = useState<string[]>(initialCustomSortIds || []);

  // تحميل الترتيب المخصص من السيرفر أو التخزين المحلي
  useEffect(() => {
    if (initialCustomSortIds && initialCustomSortIds.length > 0) {
      setCustomSortIds(initialCustomSortIds);
      try {
        localStorage.setItem(`mandoub_sort_${auth.c}`, JSON.stringify(initialCustomSortIds));
      } catch (e) {}
    } else {
      const saved = localStorage.getItem(`mandoub_sort_${auth.c}`);
      if (saved) {
        try {
          setCustomSortIds(JSON.parse(saved));
        } catch (e) {}
      }
    }
  }, [initialCustomSortIds, auth.c]);

  // حماية وتجميد الـ Pull-To-Refresh لمنع رفرش الصفحة عند سحب النوافذ المنبثقة للأجهزة الذكية
  useEffect(() => {
    const isAnyModalOpen = Boolean(pickupOrder || deliveryOrder || activeOrderId);
    if (!isAnyModalOpen) return;

    document.body.style.overflow = "hidden";
    document.body.style.overscrollBehaviorY = "none";

    return () => {
      document.body.style.overflow = "";
      document.body.style.overscrollBehaviorY = "";
    };
  }, [pickupOrder, deliveryOrder, activeOrderId]);

  // حفظ الترتيب المخصص محلياً وفي قاعدة البيانات للمزامنة
  const saveSortOrder = (newOrder: string[]) => {
    setCustomSortIds(newOrder);
    try {
      localStorage.setItem(`mandoub_sort_${auth.c}`, JSON.stringify(newOrder));
    } catch (e) {}
    // مزامنة فورية في السيرفر وقاعدة البيانات
    saveMandoubOrderSortAction({
      c: auth.c,
      exp: auth.exp,
      s: auth.s,
      orderIds: newOrder,
    }).catch((err) => console.error("Error saving sort order:", err));
  };

  const resetSortOrder = () => {
    setCustomSortIds([]);
    try {
      localStorage.removeItem(`mandoub_sort_${auth.c}`);
    } catch (e) {}
    resetMandoubOrderSortAction({
      c: auth.c,
      exp: auth.exp,
      s: auth.s,
    }).catch((err) => console.error("Error resetting sort order:", err));
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
    const handlePopState = (e: PopStateEvent) => {
      if (activeOrderId) {
        if (e.state?.orderId === activeOrderId) {
          return;
        }
        setActiveOrderId(null);
      }
      if (showWallet) {
        if (e.state?.wallet) {
          return;
        }
        setShowWallet(false);
      }
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

      {courierSettings?.useFullBlockView && !isSortingMode ? (
        <MandoubFullBlockCardGrid
          rows={tableRowsToRender}
          onOpenRow={(id) => {
            if (isSortingMode) return;
            setActiveOrderId(id);
            const p = new URLSearchParams(window.location.search);
            p.set("activeOrderId", id);
            window.history.pushState({ orderId: id }, "", `?${p.toString()}`);
          }}
          setPickupOrder={(o) => setPickupOrder(o)}
          setDeliveryOrder={(o) => setDeliveryOrder(o)}
          icons={icons}
        />
      ) : (
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
                  className="inline-flex h-11 w-11 sm:h-12 sm:w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 border-2 border-amber-300 text-white font-black text-xs shadow-md transition active:scale-90"
                  title="استلام الشحنة"
                >
                  استلام
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
                  className="inline-flex h-11 w-11 sm:h-12 sm:w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 border-2 border-emerald-400 text-white font-black text-xs shadow-md transition active:scale-90"
                  title="تسليم الشحنة"
                >
                  تسليم
                </button>
              );
            }
            return null;
          }}
        />
      )}

      {pickupOrder &&
        createPortal(
          <MandoubModalContainer onClose={() => setPickupOrder(null)}>
            <div className="my-auto w-full max-w-md animate-in fade-in zoom-in-95 rounded-2xl bg-white p-5 shadow-2xl" dir="rtl" onClick={(e) => e.stopPropagation()}>
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
          </MandoubModalContainer>,
          document.body,
        )}

      {deliveryOrder &&
        createPortal(
          <MandoubModalContainer onClose={() => setDeliveryOrder(null)}>
            <div className="my-auto w-full max-w-md animate-in fade-in zoom-in-95 rounded-2xl bg-white p-5 shadow-2xl" dir="rtl" onClick={(e) => e.stopPropagation()}>
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
          </MandoubModalContainer>,
          document.body,
        )}

      {/* نافذة تفاصيل الطلب الكاملة - تعمل أوفلاين */}
      {activeOrderData &&
        createPortal(
          <div className="fixed inset-0 z-[110] bg-slate-50 dark:bg-slate-950 overflow-y-auto">
            {/* الهيدر العلوي المثبت للطلب */}
            <div className="sticky top-0 z-30 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 p-3 sm:p-4 shadow-sm">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setActiveOrderId(null);
                    const p = new URLSearchParams(window.location.search);
                    p.delete("activeOrderId");
                    const newPath = window.location.pathname + (p.toString() ? "?" + p.toString() : "");
                    window.history.pushState({}, "", newPath);
                  }}
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-red-600 hover:bg-red-700 text-white font-black shadow-lg border-2 border-white dark:border-slate-800 active:scale-90 transition-all cursor-pointer"
                  title="إغلاق النافذة"
                >
                  <span className="text-lg font-black leading-none">✕</span>
                </button>

                <div className="flex flex-col min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-base font-black text-slate-900 dark:text-white">#{activeOrderData.shortId}</span>
                    <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${orderStatusBadgeClass(activeOrderData.orderStatus)}`}>
                      {STATUS_AR[activeOrderData.orderStatus] ?? activeOrderData.orderStatus}
                    </span>
                    <MandoubOrderDetailActions closeHref="#" orderId={activeOrderData.id} />
                  </div>
                  <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500 flex-wrap">
                    {activeOrderData.createdAt && (
                      <span className="text-sky-700 dark:text-sky-400">📅 {formatBaghdadDateTime(activeOrderData.createdAt)}</span>
                    )}
                    <span>•</span>
                    <span className="text-rose-700 dark:text-rose-400">⏰ {activeOrderData.orderNoteTime || activeOrderData.timeLine || "فوري"}</span>
                  </div>
                </div>
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
                  otherRegionsProfiles: activeOrderData.otherRegionsProfiles,
                }}
                auth={auth}
                closeHref="#"
                onCloseModal={() => {
                  setActiveOrderId(null);
                  const p = new URLSearchParams(window.location.search);
                  p.delete("activeOrderId");
                  const newPath = window.location.pathname + (p.toString() ? "?" + p.toString() : "");
                  window.history.pushState({}, "", newPath);
                }}
                nextUrl={detailsNextUrl}
                viewerCourierId={auth.c}
                phoneProfile={activeOrderData.phoneProfile}
                secondPhoneProfile={activeOrderData.secondPhoneProfile}
                smartHintLine={activeOrderData.smartHintLine}
                secondSmartHintLine={activeOrderData.secondSmartHintLine}
                icons={icons}
                courierSettings={courierSettings || {
                  showDoorBtn: true,
                  showLocationBtn: true,
                  showCallBtn: true,
                  showWhatsAppBtn: true,
                  showNotesBtn: true,
                  showVoiceNotesBtn: true,
                }}
                isModal={true}
                customWaButtons={customWaButtons}
                courierName={courierName}
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
