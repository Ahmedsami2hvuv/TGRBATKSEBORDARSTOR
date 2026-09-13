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
import { isReversePickupOrderType } from "@/lib/order-type-flags";
import { MandoubActionMenuModal } from "./mandoub-action-menu-modal";

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

function MandoubSaderSideBadge({ o }: { o: any }) {
  const pickup = o.pickupSumDinar ?? null; // صادر المندوب
  const preparerPickup = o.preparerPickupSumDinar ?? null; // صادر المجهز
  const adminPickup = o.adminPickupSumDinar ?? null; // صادر الإدارة

  const showPickup = pickup != null && Number.isFinite(pickup) && pickup > 0;
  const showPreparerPickup = preparerPickup != null && Number.isFinite(preparerPickup) && preparerPickup > 0;
  const showAdminPickup = adminPickup != null && Number.isFinite(adminPickup) && adminPickup > 0;

  let text = "";
  let tooltip = "";
  let isPreparer = false;

  if (showPickup) {
    text = formatDinarAsAlf(pickup);
    tooltip = `صادر المندوب: ${text}`;
  } else if (showPreparerPickup) {
    text = formatDinarAsAlf(preparerPickup);
    tooltip = `صادر المجهز: ${text}`;
    isPreparer = true;
  } else if (showAdminPickup) {
    text = formatDinarAsAlf(adminPickup);
    tooltip = `صادر الإدارة: ${text}`;
  } else if (o.saderMismatchType === "deficit") {
    text = "نقص";
    tooltip = "نقص بالصادر";
  } else if (o.saderMismatchType === "excess") {
    text = "زيادة";
    tooltip = "زيادة بالصادر";
  }

  if (!text) return null;

  return (
    <div
      className="w-13 h-8 sm:w-14.5 sm:h-9 bg-contain bg-no-repeat bg-center flex items-center justify-center select-none shrink-0"
      style={{
        backgroundImage: `url('${isPreparer ? "/images/order-luxury/badge-preparer-sader.webp" : "/images/order-luxury/badge-sader.webp"}')`,
      }}
      title={tooltip}
    >
      <span className="text-[10px] sm:text-[11.5px] font-black font-mono leading-none tracking-tighter text-[#F5D77F] drop-shadow-[0_1px_2px_rgba(0,0,0,0.95)] pt-0.5 px-0.5 truncate max-w-full text-center">
        {text}
      </span>
    </div>
  );
}

function MandoubWardSideBadge({ o }: { o: any }) {
  const delivery = o.deliverySumDinar ?? null; // وارد المندوب
  const preparerDelivery = o.preparerDeliverySumDinar ?? null; // وارد المجهز

  const showDelivery = delivery != null && Number.isFinite(delivery) && delivery > 0;
  const showPreparerDelivery = preparerDelivery != null && Number.isFinite(preparerDelivery) && preparerDelivery > 0;

  let text = "";
  let tooltip = "";
  let isPreparer = false;

  if (showDelivery) {
    text = formatDinarAsAlf(delivery);
    tooltip = `وارد المندوب: ${text}`;
  } else if (showPreparerDelivery) {
    text = formatDinarAsAlf(preparerDelivery);
    tooltip = `وارد المجهز: ${text}`;
    isPreparer = true;
  } else if (o.wardMismatchType === "deficit") {
    text = "نقص";
    tooltip = "نقص بالوارد";
  } else if (o.wardMismatchType === "excess") {
    text = "زيادة";
    tooltip = "زيادة بالوارد";
  } else if (o.noWardRecorded && o.orderStatus === "delivered") {
    text = "بدون";
    tooltip = "بدون وارد مسجل";
  }

  if (!text) return null;

  return (
    <div
      className="w-13 h-8 sm:w-14.5 sm:h-9 bg-contain bg-no-repeat bg-center flex items-center justify-center select-none shrink-0"
      style={{
        backgroundImage: `url('${isPreparer ? "/images/order-luxury/badge-preparer-ward.webp" : "/images/order-luxury/badge-ward.webp"}')`,
      }}
      title={tooltip}
    >
      <span className="text-[10px] sm:text-[11.5px] font-black font-mono leading-none tracking-tighter text-[#F5D77F] drop-shadow-[0_1px_2px_rgba(0,0,0,0.95)] pt-0.5 px-0.5 truncate max-w-full text-center">
        {text}
      </span>
    </div>
  );
}

function RoyalScallopedCardBorder() {
  return (
    <div className="pointer-events-none absolute inset-0 z-0 overflow-visible">
      <svg
        className="w-full h-full"
        viewBox="0 0 400 200"
        preserveAspectRatio="none"
        fill="none"
      >
        {/* المسار الخارجي ذو الزوايا المقعرة الملكية المنحوتة */}
        <path
          d="M 28 6 
             L 372 6 
             C 378 6, 384 10, 386 16 
             C 388 22, 388 24, 394 28 
             L 394 172 
             C 388 176, 388 178, 386 184 
             C 384 190, 378 194, 372 194 
             L 28 194 
             C 22 194, 16 190, 14 184 
             C 12 178, 12 176, 6 172 
             L 6 28 
             C 12 24, 12 22, 14 16 
             C 16 10, 22 6, 28 6 Z"
          stroke="#C9A86A"
          strokeWidth="2.2"
          vectorEffect="non-scaling-stroke"
        />
        {/* المسار الداخلي المزدوج المتوازي */}
        <path
          d="M 32 12 
             L 368 12 
             C 373 12, 378 15, 380 20 
             C 382 24, 382 26, 388 29 
             L 388 171 
             C 382 174, 382 176, 380 180 
             C 378 185, 373 188, 368 188 
             L 32 188 
             C 27 188, 22 185, 20 180 
             C 18 176, 18 174, 12 171 
             L 12 29 
             C 18 26, 18 24, 20 20 
             C 22 15, 27 12, 32 12 Z"
          stroke="#D4AF37"
          strokeWidth="1"
          strokeOpacity="0.8"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
    </div>
  );
}

function GlassOrbButton3D({
  children,
  onClick,
  title,
  size = "md",
  className = "",
}: {
  children: React.ReactNode;
  onClick?: (e: React.MouseEvent) => void;
  title?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const sizeClasses =
    size === "sm"
      ? "w-7.5 h-7.5 text-xs"
      : size === "lg"
      ? "w-12 h-12 text-sm"
      : "w-10 h-10 sm:w-11 sm:h-11 text-xs";

  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`relative rounded-full shrink-0 flex items-center justify-center font-black select-none transition-all duration-150 hover:scale-105 active:scale-95 cursor-pointer overflow-hidden ${sizeClasses} ${className}`}
      style={{
        background: "radial-gradient(circle at 40% 30%, #157347 0%, #0D4A36 50%, #042116 100%)",
        border: "2.5px solid #C9A86A",
        boxShadow: "0 4px 10px rgba(4,33,22,0.45), inset 0 2px 3px rgba(255,255,255,0.6), inset 0 -3px 5px rgba(0,0,0,0.6)",
      }}
    >
      <div
        className="pointer-events-none absolute top-0.5 inset-x-1.5 h-[40%] rounded-t-full opacity-75"
        style={{
          background: "linear-gradient(180deg, rgba(255,255,255,0.85) 0%, rgba(255,255,255,0.1) 80%, transparent 100%)",
        }}
      />
      <span className="relative z-10 text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)] flex items-center justify-center">
        {children}
      </span>
    </button>
  );
}

function RedGlassOrbButton3D({
  onClick,
  title,
  href,
}: {
  onClick?: (e: React.MouseEvent) => void;
  title?: string;
  href?: string | null;
}) {
  if (href) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => e.stopPropagation()}
        title={title || "فتح موقع الزبون 📍"}
        className="w-5.5 h-5.5 sm:w-6 sm:h-6 rounded-full bg-no-repeat bg-contain select-none shrink-0 hover:scale-110 active:scale-95 transition cursor-pointer"
        style={{
          backgroundImage: "url('/images/order-luxury/btn-open-location.webp')",
        }}
      />
    );
  }

  return (
    <div
      onClick={onClick}
      title={title || "بدون لوكيشن"}
      className="w-5.5 h-5.5 sm:w-6 sm:h-6 rounded-full bg-no-repeat bg-contain select-none shrink-0 opacity-80 cursor-default"
      style={{
        backgroundImage: "url('/images/order-luxury/btn-no-location.webp')",
      }}
    />
  );
}

function GoldOrbButton3D({
  children,
  onClick,
  title,
  href,
  variant = "gold",
}: {
  children: React.ReactNode;
  onClick?: (e: React.MouseEvent) => void;
  title?: string;
  href?: string;
  variant?: "gold" | "green" | "purple";
}) {
  const bgGrad =
    variant === "green"
      ? "radial-gradient(circle at 38% 28%, #2ECC71 0%, #27AE60 55%, #145A32 100%)"
      : variant === "purple"
      ? "radial-gradient(circle at 38% 28%, #A855F7 0%, #9333EA 55%, #581C87 100%)"
      : "radial-gradient(circle at 38% 28%, #FFE599 0%, #E6BA65 45%, #9E7420 100%)";

  const textColor = variant === "gold" ? "text-[#3D2800]" : "text-white";

  const content = (
    <>
      <div
        className="pointer-events-none absolute top-0.5 inset-x-1 h-[40%] rounded-t-full opacity-75"
        style={{
          background: "linear-gradient(180deg, rgba(255,255,255,0.9) 0%, rgba(255,255,255,0.1) 80%, transparent 100%)",
        }}
      />
      <span className={`relative z-10 text-[11px] sm:text-xs font-black drop-shadow-[0_1px_1px_rgba(255,255,255,0.4)] flex items-center justify-center ${textColor}`}>
        {children}
      </span>
    </>
  );

  const styleObj = {
    background: bgGrad,
    border: "1.8px solid #C9A86A",
    boxShadow: "0 2px 6px rgba(0,0,0,0.25), inset 0 1.5px 2px rgba(255,255,255,0.6), inset 0 -2px 3px rgba(0,0,0,0.4)",
  };

  if (href) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => e.stopPropagation()}
        title={title}
        className="relative w-7 h-7 sm:w-7.5 sm:h-7.5 rounded-full shrink-0 flex items-center justify-center select-none transition hover:scale-105 active:scale-95 cursor-pointer overflow-hidden"
        style={styleObj}
      >
        {content}
      </a>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className="relative w-7 h-7 sm:w-7.5 sm:h-7.5 rounded-full shrink-0 flex items-center justify-center select-none transition hover:scale-105 active:scale-95 cursor-pointer overflow-hidden"
      style={styleObj}
    >
      {content}
    </button>
  );
}

function getHeaderBannerWebpMandoub(orderStatus: string) {
  switch (orderStatus) {
    case "pending":
      return "/images/order-luxury/header-new.webp";
    case "assigned":
      return "/images/order-luxury/header-assigned.webp";
    case "delivering":
      return "/images/order-luxury/header-received.webp";
    case "delivered":
      return "/images/order-luxury/header-delivered.webp";
    default:
      return "/images/order-luxury/header-assigned.webp";
  }
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
  courierSettings,
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
  courierSettings?: any;
}) {
  const [actionModalState, setActionModalState] = useState<{
    isOpen: boolean;
    title: string;
    subtitle?: string;
    type: "call" | "chat" | "location" | "door";
    options: any[];
    previewImageUrl?: string | null;
  }>({
    isOpen: false,
    title: "",
    type: "chat",
    options: [],
    previewImageUrl: null,
  });

  const handleOpenActionModal = (o: OrderTableRowData, type: "call" | "chat" | "location" | "door") => {
    const custPhone = o.customerPhone || o.phoneLine || "";
    const shopPh = o.shopPhone || "";
    const secPhone = o.secondCustomerPhone || o.alternatePhone || "";

    const custLoc = o.customerLocationUrl || "";
    const shopLoc = o.shopLocationUrl || "";
    const secLoc = o.secondCustomerLocationUrl || "";

    const custDoor = o.customerDoorPhotoUrl || "";
    const shopDoor = o.shopDoorPhotoUrl || "";
    const secDoor = o.secondCustomerDoorPhotoUrl || "";

    if (type === "chat") {
      const options: any[] = [];
      if (custPhone) {
        options.push({
          title: "مراسلة الزبون عبر واتساب",
          subtitle: custPhone,
          icon: "💬",
          badge: "الزبون",
          colorVariant: "emerald",
          actionUrl: `https://wa.me/${custPhone.replace(/[^0-9]/g, "").replace(/^0/, "964")}`,
        });
      }
      if (shopPh) {
        options.push({
          title: `مراسلة العميل (${o.shopName || "المحل"})`,
          subtitle: shopPh,
          icon: "🏪",
          badge: "العميل",
          colorVariant: "amber",
          actionUrl: `https://wa.me/${shopPh.replace(/[^0-9]/g, "").replace(/^0/, "964")}`,
        });
      }
      if (secPhone) {
        options.push({
          title: "مراسلة الزبون الثاني",
          subtitle: secPhone,
          icon: "💬",
          badge: "الزبون الثاني",
          colorVariant: "emerald",
          actionUrl: `https://wa.me/${secPhone.replace(/[^0-9]/g, "").replace(/^0/, "964")}`,
        });
      }
      if (options.length === 0 && custPhone) {
        window.open(`https://wa.me/${custPhone.replace(/[^0-9]/g, "").replace(/^0/, "964")}`, "_blank");
        return;
      }
      setActionModalState({
        isOpen: true,
        title: "اختر جهة المراسلة عبر واتساب",
        subtitle: `طلب رقم: ${o.shortId} - ${o.shopName || ""}`,
        type: "chat",
        options,
      });
    } else if (type === "call") {
      const options: any[] = [];
      if (custPhone) {
        options.push({
          title: "اتصال هاتفي بالزبون",
          subtitle: custPhone,
          icon: "📞",
          badge: "الزبون",
          colorVariant: "emerald",
          actionUrl: `tel:${custPhone}`,
        });
      }
      if (shopPh) {
        options.push({
          title: `اتصال بالعميل (${o.shopName || "المحل"})`,
          subtitle: shopPh,
          icon: "🏪",
          badge: "العميل",
          colorVariant: "amber",
          actionUrl: `tel:${shopPh}`,
        });
      }
      if (secPhone) {
        options.push({
          title: "اتصال بالزبون الثاني",
          subtitle: secPhone,
          icon: "📞",
          badge: "الزبون الثاني",
          colorVariant: "emerald",
          actionUrl: `tel:${secPhone}`,
        });
      }
      if (options.length <= 1 && custPhone) {
        window.location.href = `tel:${custPhone}`;
        return;
      }
      setActionModalState({
        isOpen: true,
        title: "اختر جهة الاتصال الهاتفي",
        subtitle: `طلب رقم: ${o.shortId} - ${o.shopName || ""}`,
        type: "call",
        options,
      });
    } else if (type === "location") {
      const options: any[] = [];
      if (custLoc) {
        options.push({
          title: "موقع الزبون على الخريطة",
          subtitle: o.regionLine || "المنطقة",
          icon: "📍",
          badge: "الزبون",
          colorVariant: "emerald",
          actionUrl: custLoc,
        });
      }
      if (shopLoc) {
        options.push({
          title: `موقع العميل (${o.shopName || "المحل"})`,
          subtitle: o.shopRegionName || "موقع المحل",
          icon: "🏪",
          badge: "العميل",
          colorVariant: "amber",
          actionUrl: shopLoc,
        });
      }
      if (secLoc) {
        options.push({
          title: "موقع الزبون الثاني",
          subtitle: o.secondCustomerRegionName || "الوجهة الثانية",
          icon: "📍",
          badge: "الزبون الثاني",
          colorVariant: "emerald",
          actionUrl: secLoc,
        });
      }
      if (options.length === 1) {
        window.open(options[0].actionUrl, "_blank");
        return;
      }
      setActionModalState({
        isOpen: true,
        title: "اختر الموقع المطلوب على الخريطة",
        subtitle: `طلب رقم: ${o.shortId} - ${o.shopName || ""}`,
        type: "location",
        options,
      });
    } else if (type === "door") {
      const options: any[] = [];
      if (custDoor) {
        options.push({
          title: "عرض صورة باب الزبون",
          subtitle: o.regionLine || "باب المنزل",
          icon: "🚪",
          badge: "الزبون",
          colorVariant: "emerald",
          onClick: () => {
            setActionModalState((prev) => ({ ...prev, previewImageUrl: custDoor }));
          },
        });
      }
      if (shopDoor) {
        options.push({
          title: `عرض صورة باب العميل (${o.shopName || "المحل"})`,
          subtitle: "باب المحل",
          icon: "🏪",
          badge: "العميل",
          colorVariant: "amber",
          onClick: () => {
            setActionModalState((prev) => ({ ...prev, previewImageUrl: shopDoor }));
          },
        });
      }
      if (secDoor) {
        options.push({
          title: "عرض صورة باب الزبون الثاني",
          subtitle: o.secondCustomerRegionName || "الوجهة الثانية",
          icon: "🚪",
          badge: "الزبون الثاني",
          colorVariant: "emerald",
          onClick: () => {
            setActionModalState((prev) => ({ ...prev, previewImageUrl: secDoor }));
          },
        });
      }
      setActionModalState({
        isOpen: true,
        title: "اختر صورة الباب المطلوبة",
        subtitle: `طلب رقم: ${o.shortId} - ${o.shopName || ""}`,
        type: "door",
        options,
        previewImageUrl: options.length === 1 ? (custDoor || shopDoor || secDoor) : null,
      });
    }
  };

  if (!rows.length) {
    return (
      <div className="py-12 text-center text-[#0A3D2E] font-bold bg-white dark:bg-slate-900 rounded-3xl border-2 border-dashed border-[#C9A86A]/40 shadow-sm text-sm sm:text-base">
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
      {groupedByDate.map((group) => {
        const dateDayNumber = group.items[0]?.createdAt
          ? new Date(group.items[0].createdAt).getDate()
          : 17;

        return (
          <div key={group.dateKey} className="space-y-3.5">
            {/* شريط الفاصل الزمني البارز بين الأيام بالزخرفة الدمشقية الأرابيسك */}
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#06281D] via-[#0A3D2E] to-[#06281D] border-y border-[#C9A86A] px-4 py-2 text-[#FFF8F0] shadow-md flex items-center justify-between">
              {/* زخرفة دمشقية يمنى */}
              <div className="flex items-center gap-1.5 opacity-90">
                <span className="text-[#F5D77F] text-sm">❧</span>
                <span className="text-[#C9A86A] text-xs">⚜️</span>
              </div>

              {/* تاريخ اليوم بالمنتصف */}
              <div className="text-center font-black text-xs sm:text-sm tracking-wide text-white drop-shadow-sm">
                {group.dateLabel} <span className="text-[#F5D77F] font-normal">({group.items.length} طلب)</span>
              </div>

              {/* أيقونة التقويم المذهبة في اليسار */}
              <div className="flex items-center gap-1.5">
                <div className="w-7 h-7 rounded-lg bg-gradient-to-b from-[#E67E22] to-[#D35400] text-white flex flex-col items-center justify-center border border-[#FFF0D0] shadow-xs leading-none">
                  <span className="text-[7px] font-bold opacity-80">📅</span>
                  <span className="text-[11px] font-black">{dateDayNumber}</span>
                </div>
                <span className="text-[#F5D77F] text-sm">☙</span>
              </div>
            </div>

            {/* قائمة الكروت الملكية التابعة لهذا اليوم للمندوب مع ملفات WEBP المكيشة */}
            <div className="flex flex-col gap-4">
              {group.items.map((o) => {
                const isPending = o.orderStatus === "pending";
                const isAssigned = o.orderStatus === "assigned";
                const isDelivering = o.orderStatus === "delivering";
                const isDelivered = o.orderStatus === "delivered";

                const selected = isSelected ? isSelected(o.id) : false;

                const displayTotal = o.totalAmountDinar != null
                  ? `${o.totalAmountDinar} ألف`
                  : (o.priceStr || "—");

                const numericPrice = displayTotal
                  .replace(/ألف|دينار|الف/g, "")
                  .replace(/,/g, ".")
                  .replace(/[^\d.]/g, "")
                  .replace(/\.$/, "")
                  .trim() || displayTotal;

                const displayGoodsType = o.orderType && o.orderType !== "عام" && o.orderType !== "—"
                  ? o.orderType
                  : o.summary && o.summary.trim()
                  ? o.summary
                  : o.orderType || "—";

                const isDoubleRouteOrder = o.routeMode === "double" || !!o.secondCustomerPhone || !!o.secondCustomerRegionName;

                const headerTextStr = isDoubleRouteOrder
                  ? `${o.regionLine || "المرسل"} إلى ${o.secondCustomerRegionName || "المستلم"}`
                  : `${o.shopName || "المحل"} إلى ${o.regionLine || "المنطقة"}`;

                const isPrepaid = Boolean(o.prepaidAll || displayTotal === "كل شي واصل" || displayTotal === "واصل");
                const isAllPaid = Boolean(
                  o.prepaidAll ||
                  displayTotal === "كل شي واصل" ||
                  displayTotal === "واصل" ||
                  displayTotal?.includes("واصل") ||
                  o.priceStr === "كل شي واصل" ||
                  o.priceStr === "واصل" ||
                  o.priceStr?.includes("واصل")
                );
                const isReverse = Boolean(isReversePickupOrderType(o.orderType) || o.orderType?.includes("عكسي") || o.orderType?.includes("راجع"));
                const hasGps = Boolean(o.customerLocationUrl || o.hasCustomerLocation);

                const headerWebpBg = getHeaderBannerWebpMandoub(o.orderStatus);

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
                    className={`group relative rounded-[20px] px-2.5 sm:px-6 pt-3.5 pb-3 transition-all active:scale-[0.99] cursor-pointer flex flex-col justify-between gap-2 bg-transparent bg-no-repeat bg-[length:100%_100%] w-full ${
                      selected ? "ring-2 ring-[#0A3D2E]" : ""
                    }`}
                    style={{
                      backgroundImage: "url('/images/order-luxury/order-card-frame.webp')",
                      minHeight: "220px",
                    }}
                  >
                    {/* 1. السطر العلوي: كبسولة رقم الطلب وبلوك اسم المحل كلاهما داخل الإطار بدقة */}
                    <div className="relative z-10 flex items-center justify-between gap-2 min-w-0 w-full" onClick={(e) => e.stopPropagation()}>
                      {/* اليمين: بلوك اسم المحل (مزاح لليسار ومنزل للأسفل ليتوسط الكرت ومحمي من خروج النص) */}
                      <div className="relative flex-1 min-w-0 max-w-[75%] sm:max-w-[78%]">
                        <div
                          className="w-full h-12.5 sm:h-13.5 rounded-full flex items-center justify-center px-4 sm:px-8 mr-1 sm:mr-3 mt-3 sm:mt-3.5 bg-no-repeat bg-[length:100%_100%] select-none overflow-hidden"
                          style={{
                            backgroundImage: `url('${headerWebpBg}')`,
                          }}
                        >
                          <span className="font-black text-[12px] sm:text-[13px] md:text-[15px] text-[#FFF8F0] truncate max-w-full text-center drop-shadow-[0_1px_2px_rgba(0,0,0,0.85)] px-1">
                            {headerTextStr}
                          </span>
                        </div>

                        {/* أيقونة الطلب العكسي مسحوبة لليمين وملتصقة ببلوك اسم المحل بدقة بعيداً عن رقم الطلب */}
                        {isReverse && (
                          <div
                            className="absolute -bottom-1 right-4 sm:right-6 z-20 w-7.5 h-7.5 sm:w-8.5 sm:h-8.5 rounded-full flex items-center justify-center select-none bg-center bg-contain bg-no-repeat drop-shadow-md transition-transform hover:scale-110 cursor-pointer"
                            style={{
                              backgroundImage: "url('/images/order-luxury/icon-reverse.webp')",
                            }}
                            title="طلب عكسي 📦⤺"
                          />
                        )}
                      </div>

                      {/* اليسار: كبسولة رقم الطلب مسحوبة لليمين باتجاه الداخل لتستقر داخل الإطار تماماً */}
                      <div className="relative shrink-0 flex items-center gap-1.5 sm:gap-2 ml-0.5 sm:ml-2 -mt-0.5 sm:-mt-1">
                        {showSelectColumn && (
                          <input
                            type="checkbox"
                            checked={selected}
                            onChange={() => onToggleOne && onToggleOne(o.id)}
                            className="size-5 rounded border-2 border-[#C9A86A] text-[#0A3D2E] focus:ring-[#C9A86A] cursor-pointer"
                          />
                        )}

                        {isSortingMode && moveRow && !isDelivered && (
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => moveRow(o.id, "up")}
                              className="flex size-6 sm:size-7 items-center justify-center rounded-md bg-[#FFF8F0] dark:bg-slate-800 text-[#0A3D2E] dark:text-[#F5D77F] border border-[#C9A86A] hover:bg-[#0A3D2E] hover:text-[#F5D77F] font-bold transition text-xs"
                              title="تحريك للأعلى"
                            >
                              ▲
                            </button>
                            <button
                              type="button"
                              onClick={() => moveRow(o.id, "down")}
                              className="flex size-6 sm:size-7 items-center justify-center rounded-md bg-[#FFF8F0] dark:bg-slate-800 text-[#0A3D2E] dark:text-[#F5D77F] border border-[#C9A86A] hover:bg-[#0A3D2E] hover:text-[#F5D77F] font-bold transition text-xs"
                              title="تحريك للأسفل"
                            >
                              ▼
                            </button>
                          </div>
                        )}

                        <div className="relative shrink-0">
                          {/* كبسولة رقم الطلب بصورة الخلفية المكيشة والنص متمركز وكبير في قلبها */}
                          <div
                            className="min-w-[82px] sm:min-w-[98px] h-11 sm:h-12.5 px-2.5 rounded-lg flex items-center justify-center text-center font-black font-mono text-lg sm:text-xl md:text-2xl tracking-wider select-none bg-no-repeat bg-[length:100%_100%] leading-none"
                            style={{
                              backgroundImage: "url('/images/order-luxury/order-number-bg.webp')",
                              color: "#F5D77F",
                              textShadow: "0 1px 3px rgba(0,0,0,0.85)",
                            }}
                          >
                            <span className="drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)] pt-0.5">
                              {o.shortId}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* 2. القسم الأوسط: نوع البضاعة يميناً + بلوك الصادر والوارد بجانبي دائرة السعر + التوقيت يساراً */}
                    <div className="relative z-10 flex items-center justify-between gap-1 sm:gap-2 -mt-3 sm:-mt-3.5 py-0 px-0.5 sm:px-1 w-full">
                      {/* النص الأيمن (نوع البضاعة فقط بدون اسم الزبون) */}
                      <div className="text-xs sm:text-sm font-black text-slate-900 dark:text-[#F5D77F] text-center flex-1 min-w-0 max-w-[95px] sm:max-w-[125px] leading-snug truncate">
                        {displayGoodsType}
                      </div>

                      {/* كتلة السعر في المنتصف مع بلوك الصادر على اليمين وبلوك الوارد على اليسار */}
                      <div className="flex items-center justify-center gap-1 sm:gap-1.5 shrink-0">
                        {/* بلوك الصادر (يمين دائرة السعر) */}
                        <MandoubSaderSideBadge o={o} />

                        {/* دائرة السعر المركزية */}
                        <div className="relative shrink-0 flex items-center justify-center">
                          <div
                            className="w-18.5 h-18.5 sm:w-21 sm:h-21 rounded-full flex items-center justify-center relative select-none bg-no-repeat bg-contain"
                            style={{
                              backgroundImage: "url('/images/order-luxury/price-circle.webp')",
                            }}
                          >
                            {isAllPaid ? (
                              <div className="flex flex-col items-center justify-center leading-[1.05] select-none text-center px-1">
                                <span
                                  className="text-[14px] sm:text-[16px] font-black tracking-tight drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]"
                                  style={{ color: "#F5D77F" }}
                                >
                                  كلشي
                                </span>
                                <span
                                  className="text-[13px] sm:text-[15px] font-black tracking-tight drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]"
                                  style={{ color: "#F5D77F" }}
                                >
                                  واصل
                                </span>
                              </div>
                            ) : (
                              <span
                                className={`${
                                  numericPrice.length >= 5
                                    ? "text-[19px] sm:text-[22px]"
                                    : numericPrice.length >= 4
                                    ? "text-[23px] sm:text-[27px]"
                                    : numericPrice.length === 3
                                    ? "text-[29px] sm:text-[34px]"
                                    : "text-[36px] sm:text-[42px]"
                                } font-black leading-none font-mono drop-shadow-[0_1px_3px_rgba(0,0,0,0.85)] tracking-tight pt-0.5`}
                                style={{
                                  color: "#F5D77F",
                                }}
                              >
                                {numericPrice || "—"}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* بلوك الوارد (يسار دائرة السعر) */}
                        <MandoubWardSideBadge o={o} />
                      </div>

                      {/* النص الأيسر الأحمر العنابي (وقت الطلب) */}
                      <div className="text-[11px] sm:text-xs font-black text-[#8B0000] dark:text-rose-400 text-center flex-1 min-w-0 max-w-[95px] sm:max-w-[125px] leading-snug">
                        {o.orderNoteTime || o.timeLine || "فوري"}
                      </div>
                    </div>

                    {/* 3. القسم السفلي للكرت: كبسولة هاتف الزبون يميناً + أزرار الاستلام والتسليم يساراً في سطر واحد بدون التفاف */}
                    <div className="relative z-10 flex flex-nowrap items-center justify-between gap-1 sm:gap-2 -mt-3 sm:-mt-4 pt-0 w-full" onClick={(e) => e.stopPropagation()}>
                      {/* الجهة اليمنى: كبسولة هاتف الزبون العاجية المذهبة بالترتيب المطابق للصورة المرجعية */}
                      <div
                        className="flex items-center gap-1 sm:gap-1.5 rounded-full px-2 sm:px-3 py-0.5 bg-no-repeat bg-[length:100%_100%] h-9 sm:h-10.5 shrink min-w-0"
                        style={{
                          backgroundImage: "url('/images/order-luxury/customer-phone-pill.webp')",
                        }}
                      >
                        {/* 1. زر الاتصال 📞 (أقصى اليمين - يغطي دائرة الهاتف المذهبة المدمجة بالكبسولة) */}
                        {o.shopPhone || o.secondCustomerPhone ? (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenActionModal(o, "call");
                            }}
                            className="w-6 h-6 sm:w-7.5 sm:h-7.5 rounded-full flex items-center justify-center select-none shrink-0 hover:scale-110 active:scale-95 transition cursor-pointer -mr-0.5"
                            title="خيارات الاتصال الهاتفي 📞"
                          />
                        ) : o.customerPhone || o.phoneLine ? (
                          <a
                            href={`tel:${o.customerPhone || o.phoneLine}`}
                            onClick={(e) => e.stopPropagation()}
                            className="w-6 h-6 sm:w-7.5 sm:h-7.5 rounded-full flex items-center justify-center select-none shrink-0 hover:scale-110 active:scale-95 transition cursor-pointer -mr-0.5"
                            title={`اتصال بالزبون: ${o.customerPhone || o.phoneLine}`}
                          />
                        ) : (
                          <div className="w-6 h-6 sm:w-7.5 sm:h-7.5 rounded-full shrink-0 -mr-0.5 opacity-50" />
                        )}

                        {/* 2. رقم هاتف الزبون */}
                        <div className="flex items-center px-0.5 min-w-0 truncate">
                          <span className="text-[10.5px] sm:text-xs font-mono font-black text-slate-900 tracking-tight select-all truncate">
                            {o.customerPhone || o.phoneLine || "—"}
                          </span>
                        </div>

                        {/* 3. زر اللوكيشن 📍 */}
                        {((o.customerLocationUrl && o.shopLocationUrl) || o.secondCustomerLocationUrl) ? (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenActionModal(o, "location");
                            }}
                            className="w-5.5 h-5.5 sm:w-6.5 sm:h-6.5 rounded-full bg-no-repeat bg-contain select-none shrink-0 hover:scale-110 active:scale-95 transition cursor-pointer"
                            style={{
                              backgroundImage: "url('/images/order-luxury/btn-open-location.webp')",
                            }}
                            title="خيارات الموقع على الخريطة 📍"
                          />
                        ) : hasGps ? (
                          <RedGlassOrbButton3D
                            href={o.customerLocationUrl || "#"}
                            title="فتح موقع الزبون 📍"
                          />
                        ) : (
                          <div
                            className="w-5.5 h-5.5 sm:w-6.5 sm:h-6.5 rounded-full bg-no-repeat bg-contain select-none shrink-0"
                            style={{
                              backgroundImage: "url('/images/order-luxury/btn-no-location.webp')",
                            }}
                            title="الزبون لا يملك لوكيشن ⚠️"
                          />
                        )}

                        {/* 4. زر مراسلة عبر واتساب الفاخر 💬 */}
                        {(o.customerPhone || o.phoneLine || o.shopPhone || o.secondCustomerPhone) && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenActionModal(o, "chat");
                            }}
                            className="w-5.5 h-5.5 sm:w-6.5 sm:h-6.5 rounded-full bg-no-repeat bg-contain select-none shrink-0 hover:scale-110 active:scale-95 transition cursor-pointer"
                            style={{
                              backgroundImage: "url('/images/order-luxury/btn-chat.webp')",
                            }}
                            title="خيارات المراسلة عبر واتساب 💬"
                          />
                        )}

                        {/* 5. زر صورة الباب الفاخر 🚪 */}
                        {(o.customerDoorPhotoUrl || o.shopDoorPhotoUrl || o.secondCustomerDoorPhotoUrl) && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenActionModal(o, "door");
                            }}
                            className="w-5.5 h-5.5 sm:w-6.5 sm:h-6.5 rounded-full bg-no-repeat bg-contain select-none shrink-0 hover:scale-110 active:scale-95 transition cursor-pointer"
                            style={{
                              backgroundImage: "url('/images/order-luxury/btn-door.webp')",
                            }}
                            title="عرض صور الأبواب 🚪"
                          />
                        )}

                        {/* 6. زر البصمة الصوتية إن وجد 🎤 */}
                        {(o.audioUrl || o.preparerAudioUrl || o.adminAudioUrl) && (
                          <GoldOrbButton3D
                            onClick={() => {
                              const sound = new Audio(o.audioUrl || o.preparerAudioUrl || o.adminAudioUrl);
                              sound.play().catch(() => {});
                            }}
                            title="تشغيل البصمة الصوتية"
                            variant="purple"
                          >
                            🎤
                          </GoldOrbButton3D>
                        )}
                      </div>

                      {/* الجهة اليسرى: أزرار الاستلام والتسليم والوجهتين متناسقة الحجم ومسحوبة لليمين */}
                      <div className="flex items-center gap-1.5 sm:gap-2 -translate-y-1 sm:-translate-y-2 translate-x-2 sm:translate-x-3 shrink-0">
                        {/* زر استلام ⚡ */}
                        {!isSortingMode && isAssigned && (
                          <button
                            type="button"
                            onClick={() => setPickupOrder(o)}
                            className="w-12.5 h-12.5 sm:w-15 sm:h-15 rounded-full text-xs sm:text-sm font-black text-white hover:scale-105 active:scale-95 transition flex items-center justify-center bg-no-repeat bg-contain cursor-pointer shrink-0"
                            style={{
                              backgroundImage: "url('/images/order-luxury/btn-pickup.webp')",
                            }}
                            title="استلام الشحنة من المحل ⚡"
                          />
                        )}

                        {/* زر تسليم 🫴 */}
                        {!isSortingMode && isDelivering && (
                          <button
                            type="button"
                            onClick={() => setDeliveryOrder(o)}
                            className="w-12.5 h-12.5 sm:w-15 sm:h-15 rounded-full text-xs sm:text-sm font-black text-white hover:scale-105 active:scale-95 transition flex items-center justify-center bg-no-repeat bg-contain cursor-pointer shrink-0"
                            style={{
                              backgroundImage: "url('/images/order-luxury/btn-delivery.webp')",
                            }}
                            title="تسليم الشحنة للزبون 🫴"
                          />
                        )}

                        {/* زر وجهتين 📦➔ */}
                        {isDoubleRouteOrder && (
                          <GlassOrbButton3D title="طلب وجهتين" size="lg">
                            <span className="text-sm">📦➔</span>
                          </GlassOrbButton3D>
                        )}
                      </div>
                    </div>

                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {/* النافذة المنبثقة العائمة الفاخرة لخيارات الاتصال والمراسلة واللوكيشن والأبواب */}
      <MandoubActionMenuModal
        isOpen={actionModalState.isOpen}
        onClose={() => setActionModalState((prev) => ({ ...prev, isOpen: false, previewImageUrl: null }))}
        title={actionModalState.title}
        subtitle={actionModalState.subtitle}
        type={actionModalState.type}
        options={actionModalState.options}
        previewImageUrl={actionModalState.previewImageUrl}
      />

      {/* شريط عدد الطلبات في هذه الصفحة في الأسفل */}
      <div className="pt-4 text-center font-black text-sm text-[#0A3D2E]">
        عدد الطلبات في هذه الصفحة: {rows.length}
      </div>
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

      {showQuickSelect && (
        <div className="px-2 py-2 sm:px-3 mb-3 flex items-center justify-between gap-2 rounded-2xl border-2 border-red-200 bg-gradient-to-r from-red-50 via-rose-50 to-white dark:bg-slate-800 shadow-sm animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={toggleAll}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-black shadow-xs transition active:scale-95 ${
                allSelected
                  ? "bg-red-600 border-red-700 text-white hover:bg-red-700"
                  : "bg-white border-red-300 text-red-900 hover:bg-red-50"
              }`}
            >
              <span className="text-sm">{allSelected ? "❎" : "☑️"}</span>
              <span>{allSelected ? "إلغاء تحديد الكل" : `تحديد الكل (${rowIds.length})`}</span>
            </button>

            <span className="text-xs font-black text-slate-700 dark:text-slate-200 bg-white/80 dark:bg-slate-900 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700">
              {selectedIds.size > 0 ? `تم تحديد (${selectedIds.size}) من أصل (${rowIds.length})` : `إجمالي الطلبات: (${rowIds.length})`}
            </span>
          </div>

          {setShowQuickSelect && (
            <button
              type="button"
              onClick={() => setShowQuickSelect(false)}
              className="flex size-7 items-center justify-center rounded-lg bg-slate-200/70 hover:bg-slate-300 text-slate-700 text-xs font-black transition shrink-0"
              title="إغلاق التحديد السريع"
            >
              ✖
            </button>
          )}
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
          courierSettings={courierSettings}
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
