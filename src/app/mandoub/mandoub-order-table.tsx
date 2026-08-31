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
import { dinarDecimalToAlfInputString, formatDinarAsAlf } from "@/lib/money-alf";
import { createPortal } from "react-dom";
import { getGlobalIcons, GlobalIconsConfig } from "@/lib/icon-settings";
import { DynamicIcon } from "@/components/dynamic-icon";
import { toast } from "sonner";
import { useRef } from "react";
import { OrderDetailSection } from "./order-detail-section";
import { MandoubOrderDetailActions } from "./mandoub-order-detail-actions";
import { MandoubWalletClient } from "./mandoub-wallet-client";
import { MandoubModalContainer } from "./mandoub-modal-container";
import { formatBaghdadDateTime, formatBaghdadDateFriendly, getBaghdadDateString } from "@/lib/baghdad-time";
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

function MandoubCardMoneyBadges({ o }: { o: any }) {
  const pickup = o.pickupSumDinar ?? null; // صادر المندوب
  const preparerPickup = o.preparerPickupSumDinar ?? null; // صادر المجهز
  const adminPickup = o.adminPickupSumDinar ?? null; // صادر الإدارة
  const delivery = o.deliverySumDinar ?? null; // وارد المندوب
  const preparerDelivery = o.preparerDeliverySumDinar ?? null; // وارد المجهز

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
      {/* صادر المندوب - أخضر */}
      {showPickup && (
        <span className={`${pillBase} bg-emerald-600 text-white border-emerald-700`} title="صادر المندوب">
          {formatDinarAsAlf(pickup)}
        </span>
      )}
      {/* صادر المجهز - أصفر */}
      {showPreparerPickup && (
        <span className={`${pillBase} bg-amber-500 text-white border-amber-600`} title="صادر المجهز">
          {formatDinarAsAlf(preparerPickup)}
        </span>
      )}
      {/* صادر الإدارة - أزرق */}
      {showAdminPickup && (
        <span className={`${pillBase} bg-blue-600 text-white border-blue-700`} title="صادر الإدارة">
          {formatDinarAsAlf(adminPickup)}
        </span>
      )}
      {/* وارد المندوب - أحمر */}
      {showDelivery && (
        <span className={`${pillBase} bg-rose-600 text-white border-rose-700`} title="وارد المندوب">
          {formatDinarAsAlf(delivery)}
        </span>
      )}
      {/* وارد المجهز - بنفسجي */}
      {showPreparerDelivery && (
        <span className={`${pillBase} bg-purple-600 text-white border-purple-700`} title="وارد المجهز">
          {formatDinarAsAlf(preparerDelivery)}
        </span>
      )}

      {/* شارات النقص والوارد */}
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

function MandoubFullBlockCardGrid({
  rows,
  onOpenRow,
  setPickupOrder,
  setDeliveryOrder,
  icons,
  showSelectColumn,
  isSelected,
  onToggleOne,
  isSortingMode,
  moveRow,
}: {
  rows: OrderTableRowData[];
  onOpenRow: (id: string) => void;
  setPickupOrder: (row: any) => void;
  setDeliveryOrder: (row: any) => void;
  icons: GlobalIconsConfig | null;
  showSelectColumn?: boolean;
  isSelected?: (id: string) => boolean;
  onToggleOne?: (id: string) => void;
  isSortingMode?: boolean;
  moveRow?: (id: string, direction: "up" | "down") => void;
}) {
  if (!rows.length) {
    return (
      <div className="py-6 text-center text-slate-500 font-bold bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm text-sm">
        لا توجد طلبات للعرض في هذه القائمة
      </div>
    );
  }

  // تجميع الطلبات حسب اليوم بالتاريخ البغدادي الدقيق
  const groupedByDate: { dateKey: string; dateLabel: string; items: OrderTableRowData[] }[] = [];
  rows.forEach((row) => {
    const rawDate = row.createdAt ? (typeof row.createdAt === 'string' ? new Date(row.createdAt) : row.createdAt) : null;
    const dateKey = rawDate ? getBaghdadDateString(rawDate) : (row.dateLine || "unknown");
    const dateLabel = rawDate ? formatBaghdadDateFriendly(rawDate) : (row.dateLine || "طلبات أخرى");

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
          {/* شريط الفاصل الزمني البارز والمميز بين الأيام باللون الأحمر العنابي */}
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

          {/* قائمة الكروت التابعة لهذا اليوم (طلبية تحت الأخرى بعرض كامل ومريح) */}
          <div className="flex flex-col gap-3">
            {group.items.map((o) => {
              const isAssigned = o.orderStatus === "assigned";
              const isDelivering = o.orderStatus === "delivering";
              const isDelivered = o.orderStatus === "delivered";

              const selected = isSelected ? isSelected(o.id) : false;

              // تحديد اللون والخلفية الخفيفة الناعمة لكل كرت بحسب لون إطاره
              const statusBorderColor = selected
                ? "border-indigo-600 ring-2 ring-indigo-500 bg-indigo-50/80 dark:bg-indigo-950/40"
                : isAssigned
                ? "border-red-500 bg-red-50/60 dark:bg-red-950/30"
                : isDelivering
                ? "border-amber-400 bg-amber-50/60 dark:bg-amber-950/30"
                : "border-emerald-500 bg-emerald-50/60 dark:bg-emerald-950/30";

              const statusBadgeBg = isAssigned
                ? "bg-red-600 text-white"
                : isDelivering
                ? "bg-amber-500 text-white"
                : "bg-emerald-600 text-white";

              // حساب المبلغ الكلي الظاهر بدقة
              const displayTotal = o.totalAmountDinar != null
                ? `${o.totalAmountDinar} ألف`
                : o.priceStr || "—";

              // قراءة نوع البضاعة الحقيقي المباشر بدلاً من كلمة "عام"
              const displayGoodsType = o.orderType && o.orderType !== "عام"
                ? o.orderType
                : o.summary && o.summary.trim()
                ? o.summary
                : o.orderType || "—";

              const isDoubleRouteOrder = o.routeMode === "double" || !!o.secondCustomerPhone || !!o.secondCustomerRegionName;

              const headerTextStr = isDoubleRouteOrder
                ? `${o.regionLine || "المرسل"} إلى ${o.secondCustomerRegionName || "المستلم"}`
                : `${o.shopName || ""} إلى ${o.regionLine || ""}`;

              const textLen = headerTextStr.length;

              // سلّم تكيّفي ذكي متناسب: يكبر للنصوص القصيرة ويصغر تلقائياً للنصوص الطويلة لعدم الاقتطاع
              const dynamicHeaderFont = textLen > 34
                ? "text-[10px] xs:text-[11px] sm:text-xs md:text-sm tracking-tighter"
                : textLen > 27
                ? "text-[11.5px] xs:text-xs sm:text-sm md:text-base tracking-tight"
                : textLen > 20
                ? "text-xs xs:text-sm sm:text-base md:text-lg tracking-tight font-black"
                : textLen > 14
                ? "text-sm xs:text-base sm:text-lg md:text-xl font-black"
                : "text-base xs:text-lg sm:text-xl md:text-2xl font-black";

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
                  className={`group relative flex flex-col justify-between rounded-2xl border-2 ${statusBorderColor} p-3 shadow-sm hover:shadow-md transition-all active:scale-[0.98] cursor-pointer space-y-2`}
                >
                  {/* البلوكات المالية الملونة عائمة بشكل مستقل فوق الطرف العلوي للكرت دون أخذ أي مساحة أو مكان من العناصر */}
                  <div className="absolute -top-3.5 right-16 z-20 pointer-events-none flex items-center gap-1 shrink-0">
                    <MandoubCardMoneyBadges o={o} />
                  </div>

                  {/* السطر العلوي الموحد: زر الإجراء الدائري + اسم المحل إلى المنطقة (مستغل كامل الحيز البيني ومتحكم بحجمه تلقائياً) + رقم الطلب */}
                  <div className="flex items-center justify-between gap-1.5 border-b border-slate-200/60 dark:border-slate-800 pb-1.5 min-w-0 w-full overflow-hidden whitespace-nowrap">
                    {/* أقصى اليمين: زر استلام / تسليم أو الشارة أو التحديد / الترتيب */}
                    <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                      {showSelectColumn && (
                        <input
                          type="checkbox"
                          checked={selected}
                          onChange={() => onToggleOne && onToggleOne(o.id)}
                          className="size-5 rounded border-2 border-slate-400 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                        />
                      )}

                      {isSortingMode && moveRow && !isDelivered && (
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => moveRow(o.id, "up")}
                            className="flex size-7 items-center justify-center rounded-lg bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-600 hover:text-white font-bold transition shadow-xs"
                            title="تحريك للأعلى"
                          >
                            ▲
                          </button>
                          <button
                            type="button"
                            onClick={() => moveRow(o.id, "down")}
                            className="flex size-7 items-center justify-center rounded-lg bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-600 hover:text-white font-bold transition shadow-xs"
                            title="تحريك للأسفل"
                          >
                            ▼
                          </button>
                        </div>
                      )}

                      {!isSortingMode && isAssigned && (
                        <button
                          type="button"
                          onClick={() => setPickupOrder(o)}
                          className="size-10 sm:size-11 rounded-full bg-gradient-to-br from-red-600 to-rose-700 hover:from-red-700 hover:to-rose-800 border-2 border-red-400 text-white font-black text-xs shadow-md transition active:scale-90 flex items-center justify-center shrink-0"
                          title="استلام الشحنة"
                        >
                          استلام
                        </button>
                      )}
                      {!isSortingMode && isDelivering && (
                        <button
                          type="button"
                          onClick={() => setDeliveryOrder(o)}
                          className="size-10 sm:size-11 rounded-full bg-gradient-to-br from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 border-2 border-amber-300 text-white font-black text-xs shadow-md transition active:scale-90 flex items-center justify-center shrink-0"
                          title="تسليم الشحنة"
                        >
                          تسليم
                        </button>
                      )}
                      {!isSortingMode && isDelivered && (
                        <span className="size-10 sm:size-11 rounded-full bg-emerald-600 border-2 border-emerald-400 text-white font-black text-[10px] shadow-sm flex items-center justify-center text-center shrink-0 leading-tight p-0.5" title="تم تسليم الطلب">
                          تم التسليم
                        </span>
                      )}
                      {!isSortingMode && !isAssigned && !isDelivering && !isDelivered && (
                        <span className={`size-10 sm:size-11 rounded-full border-2 border-white/50 font-black text-[10px] shadow-sm flex items-center justify-center text-center shrink-0 leading-tight p-0.5 ${statusBadgeBg}`}>
                          {STATUS_AR[o.orderStatus] ?? o.orderStatus}
                        </span>
                      )}
                    </div>

                    {/* المنتصف: اسم المحل إلى المنطقة (يكبر أو يصغر ديناميكياً ليظهر كاملاً دون أي قطع بالنقاط) */}
                    {isDoubleRouteOrder ? (
                      <div className={`flex items-center justify-center gap-1 flex-1 min-w-0 px-1 overflow-hidden whitespace-nowrap text-center font-black ${dynamicHeaderFont}`} title="طلب وجهتين: منطقة المرسل إلى منطقة المستلم">
                        <span className="text-amber-800 dark:text-amber-400 font-black whitespace-nowrap">{o.regionLine || "المرسل"}</span>
                        <span className="text-rose-600 dark:text-rose-400 font-black shrink-0 text-[10px] sm:text-xs">إلى</span>
                        <span className="text-purple-800 dark:text-purple-300 font-black whitespace-nowrap">{o.secondCustomerRegionName || "المستلم"}</span>
                      </div>
                    ) : (
                      <div className={`flex items-center justify-center gap-1 flex-1 min-w-0 px-1 overflow-hidden whitespace-nowrap text-center font-black ${dynamicHeaderFont}`}>
                        <span className="text-emerald-800 dark:text-emerald-400 font-black whitespace-nowrap">{o.shopName}</span>
                        <span className="text-slate-500 dark:text-slate-400 font-black shrink-0 text-[10px] sm:text-xs">إلى</span>
                        <span className="text-sky-800 dark:text-sky-300 font-black whitespace-nowrap">{o.regionLine}</span>
                      </div>
                    )}

                    {/* أقصى اليسار: رقم الطلب بخط بارز محدد */}
                    <div className="flex items-center gap-1 shrink-0">
                      {!o.hasCustomerLocation && (
                        <span
                          className="inline-flex size-5 sm:size-6 items-center justify-center rounded-full bg-rose-600 text-white font-black text-[10px] sm:text-xs shadow-sm animate-pulse"
                          title="بدون لوكيشن للزبون"
                          aria-label="بدون لوكيشن"
                        >
                          !
                        </span>
                      )}
                      <span className="text-base sm:text-lg font-black text-slate-900 dark:text-white tabular-nums tracking-tight">
                        #{o.shortId}
                      </span>
                    </div>
                  </div>

                  {/* سطر التفاصيل المالية والنوع والوقت بخطوط ضخمة وبارزة جداً */}
                  <div className="space-y-1 overflow-hidden whitespace-nowrap">
                    <div className="flex items-center justify-between gap-1.5 text-sm font-black text-slate-800 dark:text-slate-100 whitespace-nowrap min-w-0">
                      <div className="flex items-center gap-1.5 min-w-0 truncate whitespace-nowrap">
                        <span className="text-indigo-800 dark:text-indigo-300 font-black bg-indigo-50 dark:bg-indigo-950/40 px-2.5 py-0.5 rounded-lg border border-indigo-100 dark:border-indigo-900/30 truncate shrink-1 text-xs sm:text-sm">
                          {displayGoodsType}
                        </span>
                        <span className="text-slate-400 font-bold shrink-0">←</span>
                        <span className="text-emerald-700 dark:text-emerald-400 font-black tabular-nums bg-emerald-50 dark:bg-emerald-950/40 px-3 py-0.5 rounded-lg border border-emerald-200 dark:border-emerald-900/40 shrink-0 text-sm sm:text-base">
                          {displayTotal}
                        </span>
                        <span className="text-slate-400 font-bold shrink-0">←</span>
                        <span className="text-rose-600 dark:text-rose-400 font-black text-xs sm:text-sm shrink-0">
                          {o.orderNoteTime || o.timeLine || "فوري"}
                        </span>
                      </div>

                      {o.customerName && <span className="text-xs text-slate-600 dark:text-slate-400 font-bold truncate shrink-0">👤 {o.customerName}</span>}
                    </div>

                    {o.phoneLine && (
                      <div className="flex items-center justify-end text-xs font-mono font-bold text-slate-500 whitespace-nowrap">
                        📞 {o.phoneLine}
                      </div>
                    )}
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

      {courierSettings?.useFullBlockView ? (
        <MandoubFullBlockCardGrid
          rows={tableRowsToRender}
          onOpenRow={(id) => {
            if (isSortingMode) return;
            if (showQuickSelect) {
              toggleOne(id);
              return;
            }
            setActiveOrderId(id);
            const p = new URLSearchParams(window.location.search);
            p.set("activeOrderId", id);
            window.history.pushState({ orderId: id }, "", `?${p.toString()}`);
          }}
          setPickupOrder={(o) => setPickupOrder(o)}
          setDeliveryOrder={(o) => setDeliveryOrder(o)}
          icons={icons}
          showSelectColumn={showQuickSelect}
          isSelected={(id) => selectedIds.has(id)}
          onToggleOne={toggleOne}
          isSortingMode={isSortingMode}
          moveRow={moveRow}
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
