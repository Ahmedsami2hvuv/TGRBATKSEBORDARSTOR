"use client";

import { Suspense, useEffect, useRef, useState, useContext } from "react";
import Link from "next/link";
import { ImageZoomModal } from "@/components/pinch-zoom-image";
import { formatDinarAsAlf, formatDinarAsAlfWithUnit } from "@/lib/money-alf";
import { resolvePublicAssetSrc } from "@/lib/image-url";
import { extractLatLngFromLocationInput, hasCustomerLocationUrl } from "@/lib/order-location";
import { VoiceNoteAudio } from "@/components/voice-note-audio";
import { isReversePickupOrderType } from "@/lib/order-type-flags";
import { formatBaghdadDateTime } from "@/lib/baghdad-time";
import { telHref, whatsappMeUrl } from "@/lib/whatsapp";
import type { MandoubOrderDetailPayload } from "@/lib/mandoub-order-queries";
import { MandoubCustomerEditForm } from "./mandoub-customer-edit-form";
import { MandoubOrderMoneyFlow } from "./mandoub-order-money-flow";
import { ClickableNotesCard } from "@/components/clickable-notes-card";
import { normalizeOrderSummaryText } from "@/lib/preparation-invoice";
import { UISectionConfig } from "@/lib/ui-settings";
import { ADMIN_PHONE_FROM_SHOP_LOCAL } from "@/lib/admin-order-from-admin-constants";
import { GlobalIconsConfig } from "@/lib/icon-settings";
import { OtherRegionsCustomerDetails } from "@/components/other-regions-customer-details";
import { TwoWayOrderActionButtons } from "@/components/two-way-order-action-buttons";
import { AdminLuxuryShopCard } from "@/app/abo1stor3hlaa2kbr8-47/(dashboard)/orders/[orderId]/admin-luxury-shop-card";
import { AdminLuxuryCustomerCard } from "@/app/abo1stor3hlaa2kbr8-47/(dashboard)/orders/[orderId]/admin-luxury-customer-card";
import { AdminLuxuryOrderInfoCard } from "@/app/abo1stor3hlaa2kbr8-47/(dashboard)/orders/[orderId]/admin-luxury-order-info-card";
import { AdminCustomerLocationQuick } from "@/app/abo1stor3hlaa2kbr8-47/(dashboard)/orders/[orderId]/admin-customer-location-quick";
import { QuickOrderCardsDesignerModal } from "@/components/quick-order-cards-designer-modal";
import { type OrderCardDesignerConfig } from "@/lib/order-card-customizer";
import { MANDOUB_ORDER_EDIT_TOGGLE } from "./mandoub-order-detail-actions";
import { FloatingOrderActionButton } from "@/components/floating-order-action-button";

const STATUS_AR: Record<string, string> = {
  assigned: "بانتظار المجهز",
  delivering: "مستلم",
  delivered: "تسليم",
};

function contactLine(phone: string): string {
  const t = (phone || "").trim();
  if (!t || t === "—" || t === "undefined") return "";
  return t;
}

function getCleanValue(...values: (string | null | undefined)[]) {
  for (const v of values) {
    if (!v) continue;
    const t = v.trim();
    if (t && t !== "—" && t !== "undefined" && t !== "null") return t;
  }
  return "";
}

type PhoneProfileFallback = {
  locationUrl: string;
  landmark: string;
  photoUrl: string;
  alternatePhone: string | null;
} | null;

export function OrderDetailSection({
  order,
  closeHref,
  onCloseModal,
  auth,
  nextUrl,
  viewerCourierId,
  courierName,
  phoneProfile,
  secondPhoneProfile,
  smartHintLine,
  secondSmartHintLine,
  uiSettings,
  icons,
  routeHistory,
  courierSettings,
  isModal = false,
  customWaButtons,
}: {
  order: MandoubOrderDetailPayload;
  closeHref: string;
  onCloseModal?: () => void;
  auth: { c: string; exp: string; s: string };
  nextUrl: string;
  viewerCourierId?: string;
  courierName?: string | null;
  phoneProfile?: any;
  secondPhoneProfile?: PhoneProfileFallback;
  smartHintLine?: string | null;
  secondSmartHintLine?: string | null;
  uiSettings?: UISectionConfig | null;
  icons?: GlobalIconsConfig | null;
  routeHistory?: { lat: number; lng: number; recordedAt: string }[];
  courierSettings?: {
    showDoorBtn?: boolean;
    showLocationBtn?: boolean;
    showCallBtn?: boolean;
    showWhatsAppBtn?: boolean;
    showNotesBtn?: boolean;
    showVoiceNotesBtn?: boolean;
    showFloatingBar?: boolean;
    hideShopInfoOnPickup?: boolean;
    guidedDeliverySteps?: boolean;
    orderViewTheme?: string;
  };
  isModal?: boolean;
  customWaButtons?: any[];
}) {
  const [isMounted, setIsMounted] = useState(false);
  const [designerConfig, setDesignerConfig] = useState<OrderCardDesignerConfig | null>(null);
  const [showMandoubStudioModal, setShowMandoubStudioModal] = useState(false);
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
  const [previewUploadedByName, setPreviewUploadedByName] = useState<string | null>(null);
  const [isSenderExpanded, setIsSenderExpanded] = useState(false);
  const [customerDebt, setCustomerDebt] = useState<number | null>(null);

  useEffect(() => {
    setIsMounted(true);
    fetch("/api/order-cards-designer-config?scope=mandoub", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) setDesignerConfig(data);
      })
      .catch(() => null);
  }, []);

  useEffect(() => {
    if (order.customerPhone) {
      import("@/app/abo1stor3hlaa2kbr8-47/(dashboard)/credit-book/actions")
        .then(({ getCustomerDebtByPhone }) => {
          getCustomerDebtByPhone(order.customerPhone)
            .then(setCustomerDebt)
            .catch(() => setCustomerDebt(null));
        })
        .catch(() => setCustomerDebt(null));
    }
  }, [order.customerPhone]);

  // حل مشكلة السحب للتحديث مع السماح الكامل بالتمرير الحر صعوداً ونزولاً
  useEffect(() => {
    let lastTouchY = 0;

    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 1) {
        lastTouchY = e.touches[0].clientY;
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;
      const touchY = e.touches[0].clientY;
      const touchYDelta = touchY - lastTouchY;

      if (isModal) {
        const scrollTarget = e.target as HTMLElement | null;
        const scrollableParent = scrollTarget?.closest('.overflow-y-auto, .overflow-auto');
        const isAtTop = scrollableParent ? scrollableParent.scrollTop <= 0 : true;

        if (isAtTop && touchYDelta > 0) {
          if (e.cancelable) {
            try { e.preventDefault(); } catch {}
          }
        }
        return;
      }

      if (window.scrollY <= 0 && touchYDelta > 0) {
        if (e.cancelable) {
          try { e.preventDefault(); } catch {}
        }
      }
    };

    window.addEventListener("touchstart", handleTouchStart, { passive: false });
    window.addEventListener("touchmove", handleTouchMove, { passive: false });

    if (isModal) {
      document.body.style.overflow = "hidden";
    }

    return () => {
      window.removeEventListener("touchstart", handleTouchStart);
      window.removeEventListener("touchmove", handleTouchMove);
      if (isModal) {
        document.body.style.overflow = "";
      }
    };
  }, [isModal]);

  const isAdminPortal = order.submissionSource === "admin_portal";
  const submitterName =
    order.shop.ownerName?.trim() ||
    order.submittedByCompanyPreparer?.name?.trim() ||
    order.submittedBy?.name?.trim() ||
    (isAdminPortal && !order.submittedBy ? "الإدارة" : "—");
  const shopContactPhone = order.submittedByCompanyPreparer?.phone?.trim() || order.submittedBy?.phone?.trim() || (isAdminPortal && !order.submittedBy ? ADMIN_PHONE_FROM_SHOP_LOCAL : order.shop.phone?.trim() || "");

  const isPreparerOrAdminOrder =
    (order.shop?.name && (order.shop.name.trim() === "الإدارة" || order.shop.name.trim() === "طلبات الإدارة العامة")) ||
    (isAdminPortal && (!order.shop?.name || order.shop.name.trim() === "الإدارة"));

  const effectiveShopName = isPreparerOrAdminOrder
    ? "الإدارة"
    : (order.shop?.name || "المحل");

  const isDoubleRoute = order.routeMode === "double" || !!order.secondCustomerPhone;
  const isSenderPickedUp = isDoubleRoute && (order.status === "delivering" || order.status === "delivered");
  const shouldCollapseSender = isDoubleRoute && isSenderPickedUp && !isSenderExpanded;

  const mergedCustomerLocationUrl = getCleanValue(
    order.customerLocationUrl,
    order.customer?.customerLocationUrl,
    phoneProfile?.locationUrl
  );
  const mergedLandmark = getCleanValue(
    order.customerLandmark,
    order.customer?.customerLandmark,
    phoneProfile?.landmark
  );
  const mergedAlternate = isDoubleRoute
    ? getCleanValue(
        order.alternatePhone,
        order.customer?.alternatePhone,
        phoneProfile?.alternatePhone
      )
    : getCleanValue(
        order.secondCustomerPhone,
        order.alternatePhone,
        order.customer?.alternatePhone,
        phoneProfile?.alternatePhone
      );

  const secondLocMerged = getCleanValue(order.secondCustomerLocationUrl, secondPhoneProfile?.locationUrl);
  const secondDoorMerged = getCleanValue(order.secondCustomerDoorPhotoUrl, secondPhoneProfile?.photoUrl);
  const secondLandmarkMerged = getCleanValue(order.secondCustomerLandmark, secondPhoneProfile?.landmark);
  const mergedSecondAlternate = getCleanValue(
    order.secondCustomerAlternatePhone,
    secondPhoneProfile?.alternatePhone
  );

  const imgShopDoor = resolvePublicAssetSrc(order.shopPhotoUrl || order.shopDoorPhotoUrl || null);
  const imgCustDoor = resolvePublicAssetSrc(order.customerDoorPhotoUrl || phoneProfile?.photoUrl || null);
  const imgCustDoor2 = resolvePublicAssetSrc(order.secondCustomerDoorPhotoUrl || secondPhoneProfile?.photoUrl || null);
  const voiceSrc = resolvePublicAssetSrc(order.voiceNoteUrl);
  const adminVoiceSrc = resolvePublicAssetSrc(order.adminVoiceNoteUrl);

  const prepJson = order.preparerShoppingJson as any;
  const hideSubtotalInfo = prepJson?.hidePricesFromCourier === true;
  const reversePickup = isReversePickupOrderType(order.orderType);

  const currentCourierName = courierName || order.courier?.name || (order as any).courierName || (courierSettings as any)?.name || "";
  const currentTotalPriceStr = String(order.totalAmount || order.totalPrice || "");

  const parsedShoppingJson = prepJson && typeof prepJson === "object" ? prepJson : null;
  const cartItems =
    parsedShoppingJson && Array.isArray(parsedShoppingJson.webStoreCart)
      ? (parsedShoppingJson.webStoreCart as any[])
      : [];
  const hasCart = cartItems.length > 0;
  const hasNotes = Boolean(order.summary?.trim());

  const isSmartHintValid = (s: string | null | undefined) => {
    if (!s) return false;
    const t = s.trim();
    if (!t || t === "—" || t.startsWith("—")) return false;
    return true;
  };

  const handleClose = () => {
    if (onCloseModal) {
      onCloseModal();
      return;
    }
    if (closeHref && closeHref !== "#") {
      window.location.href = closeHref;
    } else {
      const p = new URLSearchParams(window.location.search);
      p.delete("activeOrderId");
      const newPath = window.location.pathname + (p.toString() ? "?" + p.toString() : "");
      window.history.pushState({}, "", newPath);
    }
  };

  return (
    <>
      <div className="relative mt-2 rounded-[28px] border-[1.5px] border-[#C9A86A]/50 bg-gradient-to-b from-[#FAF6EE] via-[#F4EDE0] to-[#FAF6EE] p-2.5 sm:p-5 pb-24 sm:pb-32 text-[#0A3D2E] shadow-[0_10px_35px_rgba(201,168,106,0.15)] text-base leading-relaxed select-none" dir="rtl">

        {/* زخرفة دمشقية مذهبة في أعلى الصفحة */}
        <div className="absolute top-0 right-0 left-0 h-[2px] bg-gradient-to-r from-transparent via-[#C9A86A] to-transparent opacity-90 pointer-events-none" />

        {/* قواعد التصميم الملكي الزمردي الإسلامي */}
        <style>{`
          .gold-foil {
            background: linear-gradient(180deg, #E8C77E 0%, #C9A86A 45%, #9C7D46 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
            filter: drop-shadow(0 1px 0 rgba(156,125,70,0.3));
          }
          .gold-grad {
            background: linear-gradient(180deg, #F1D99A 0%, #E8C77E 15%, #C9A86A 55%, #A8864A 100%);
          }
          .emerald-pattern {
            background-image: url("data:image/svg+xml,%3Csvg width='80' height='80' viewBox='0 0 80 80' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23C9A86A' fill-opacity='0.08'%3E%3Cpath d='M40 0L42.5 15.5L55 10L45 20L60 28L45 30L55 45L42.5 36L40 52L37.5 36L25 45L35 30L20 28L35 20L25 10L37.5 15.5L40 0Z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E");
          }
          .islamic-border {
            background-image: 
              linear-gradient(90deg, transparent 0%, #C9A86A 50%, transparent 100%),
              url("data:image/svg+xml,%3Csvg width='24' height='6' viewBox='0 0 24 6' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M0 3 L6 0 L12 3 L18 0 L24 3 L18 6 L12 3 L6 6 Z' fill='%23C9A86A' fill-opacity='0.6'/%3E%3C/svg%3E");
          }
          @keyframes animated-gradient {
            0% { background-position: 0% 50%; }
            50% { background-position: 100% 50%; }
            100% { background-position: 0% 50%; }
          }
          .prepaid-rgb-block {
            background: linear-gradient(120deg, #059669, #0891b2, #2563eb, #7c3aed, #db2777, #059669);
            background-size: 300% 300%;
            animation: animated-gradient 8s ease infinite;
          }
        `}</style>

        {/* --- بلوك كلشي واصل المشع والمتحرك (RGB) --- */}
        {order.prepaidAll && (
          <div className="relative mb-4 overflow-hidden rounded-2xl p-5 shadow-xl text-white prepaid-rgb-block border-2 border-[#F5D77F]/60">
            <div className="relative flex flex-col items-center gap-4 sm:flex-row sm:items-start z-10">
              <div className="flex size-[4rem] shrink-0 items-center justify-center rounded-2xl bg-white/20 backdrop-blur-md shadow-md border border-white/20">
                <svg className="size-10 text-white animate-pulse" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                </svg>
              </div>
              <div className="text-center sm:text-right">
                <p className="text-xl font-black sm:text-2xl drop-shadow-md">الطلب واصل اخذ التوصيل من العميل</p>
                <p className="text-xs font-bold text-white/90 mt-1 drop-shadow-sm">تنبيه: لا تقبض سعر البضاعة من العميل، فقط أجور التوصيل.</p>
              </div>
            </div>
            <div className="absolute inset-0 bg-gradient-to-tr from-white/10 to-transparent pointer-events-none" />
          </div>
        )}

        {customerDebt !== null && customerDebt > 0 && (
          <div className="mb-4 rounded-2xl border-2 border-[#C9A86A] bg-gradient-to-r from-[#B45309] to-[#78350F] p-4 text-right shadow-xl animate-pulse text-white">
            <p className="text-base font-black text-[#F5D77F] flex items-center gap-2 drop-shadow-md">
              <span>⚠️ تنبيه مالي للزبون:</span>
              نطلب هذا الزبون مبلغاً معلقاً بذمته وقدره: ({formatDinarAsAlfWithUnit(customerDebt)}) في دفتر الديون.
            </p>
          </div>
        )}

        {order.isBlocked && (
          <div
            className="mb-4 animate-pulse rounded-2xl border-2 border-rose-500 bg-rose-950/90 p-4 text-center text-xl font-black text-rose-200 shadow-xl"
            role="alert"
          >
            🛑 تنبيه: هذا الزبون محظور من التوصيل (Blocklist)
          </div>
        )}

        {reversePickup && (
          <div className="mb-4 rounded-2xl border-2 border-violet-500 bg-violet-950/90 p-3 text-center text-sm font-black text-violet-200 shadow-xl">
            🔄 تنبيه: طلب عكسي (استلام من الزبون وتسليم للعميل)
          </div>
        )}

        {/* --- بطاقة ترويسة الطلبية الملكية الثابتة في الأعلى (Sticky Header) --- */}
        <div className="sticky top-0 z-40 rounded-[22px] border-[1.5px] border-[#C9A86A] bg-[#FFFEFB]/95 backdrop-blur-md px-3.5 py-2.5 shadow-[0_6px_20px_rgba(201,168,106,0.18)] select-none mb-3" dir="rtl">
          {/* معينات الزوايا الذهبية الأربعة */}
          <div className="absolute top-[8px] right-[8px] w-[6px] h-[6px] rotate-45 bg-[#C9A86A] opacity-80 pointer-events-none" />
          <div className="absolute top-[8px] left-[8px] w-[6px] h-[6px] rotate-45 bg-[#C9A86A] opacity-80 pointer-events-none" />
          <div className="absolute bottom-[8px] right-[8px] w-[6px] h-[6px] rotate-45 bg-[#C9A86A] opacity-80 pointer-events-none" />
          <div className="absolute bottom-[8px] left-[8px] w-[6px] h-[6px] rotate-45 bg-[#C9A86A] opacity-80 pointer-events-none" />

          {/* سطر موحد فاخر: رقم الطلب + شارة الحالة الخضراء عند التسليم + زر تعديل الطلب الفاخر */}
          <div className="flex items-center justify-between gap-2 flex-wrap sm:flex-nowrap">
            {/* جهة اليمين: رقم الطلب + شارة الحالة */}
            <div className="flex items-center gap-[8px] flex-nowrap shrink-0">
              {/* صندوق رقم الطلب الذهبي */}
              <div
                className="inline-flex items-center justify-center rounded-[10px] border-[2px] border-[#C9A86A] px-[12px] shadow-[0_2px_8px_rgba(201,168,106,0.25),inset_0_1px_0_white] shrink-0"
                style={{ background: "linear-gradient(135deg, #FDF6E3 0%, #F7E9B0 100%)", height: "32px", minWidth: "64px" }}
              >
                <span className="font-mono text-[18px] font-black leading-none text-[#8B6A2A] tracking-wide [direction:ltr]">
                  #{order.orderNumber}
                </span>
              </div>

              {/* شارة حالة الطلب (أخضر زمردي فاخر عند التسليم) */}
              <div
                className={`inline-flex items-center gap-1.5 px-[10px] rounded-full font-black shadow-[inset_0_1px_0_white] shrink-0 ${
                  order.status === "delivered"
                    ? "bg-[#E6F4EF] border border-[#0A3D2E]/30 text-[#0A3D2E]"
                    : "bg-[#FFF8E0] border border-[#E8C77E]/60 text-[#8B6A2A]"
                }`}
                style={{ whiteSpace: "nowrap", height: "30px", fontSize: "11px" }}
              >
                <div
                  className={`w-[6px] h-[6px] rounded-full animate-pulse shrink-0 ${
                    order.status === "delivered"
                      ? "bg-[#0A3D2E] shadow-[0_0_6px_#0A3D2E]"
                      : "bg-[#D4A017] shadow-[0_0_6px_#E8C77E]"
                  }`}
                />
                <span style={{ whiteSpace: "nowrap" }}>
                  {STATUS_AR[order.status] ?? order.status}
                </span>
              </div>
            </div>

            {/* جهة اليسار: زر تعديل الطلب الفاخر وزر الإغلاق عند الحاجة */}
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                id={`edit-order-btn-${order.id}`}
                onClick={() => {
                  window.dispatchEvent(new CustomEvent(MANDOUB_ORDER_EDIT_TOGGLE, { detail: { orderId: order.id } }));
                }}
                className="h-[32px] rounded-full bg-white border-[1.5px] border-[#C9A86A] flex items-center justify-center gap-[6px] px-[12px] shadow-[0_2px_8px_rgba(201,168,106,0.15),inset_0_1px_0_white] active:scale-[0.97] shrink-0 hover:bg-[#FDF6E3] transition cursor-pointer"
                title="تعديل بيانات الطلب"
              >
                <span className="text-[12px] font-black text-[#0A3D2E] leading-none whitespace-nowrap">تعديل الطلب</span>
                <span
                  className="w-[18px] h-[18px] rounded-full flex items-center justify-center border border-[#0A3D2E]/15 shadow-[inset_0_1px_0_rgba(255,255,255,0.7),0_1px_3px_rgba(201,168,106,0.3)] shrink-0"
                  style={{ background: "linear-gradient(180deg, #F1D99A 0%, #E8C77E 50%, #C9A86A 100%)" }}
                >
                  <svg className="w-[9px] h-[9px] text-[#0A3D2E]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 20h9" />
                    <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                  </svg>
                </span>
              </button>

              {/* زر الإغلاق يظهر فقط عند فتح الطلب في صفحة مستقلة وليس داخل المودال */}
              {!isModal && (
                <button
                  type="button"
                  onClick={handleClose}
                  className="w-[28px] h-[28px] rounded-full bg-white border border-[#FF8A8A]/50 flex items-center justify-center shadow-[0_1px_4px_rgba(197,48,48,0.12)] active:scale-90 shrink-0 cursor-pointer hover:bg-rose-50 transition"
                  title="إغلاق عرض الطلب"
                >
                  <svg className="w-[13px] h-[13px] text-[#C53030]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* نموذج تعديل بيانات الزبون للمندوب */}
        <MandoubCustomerEditForm
          orderId={order.id}
          defaultOrderStatus={order.status}
          defaultCustomerPhone={order.customerPhone}
          defaultCustomerLocationUrl={mergedCustomerLocationUrl}
          defaultCustomerLandmark={mergedLandmark}
          defaultAlternatePhone={mergedAlternate}
          isDoubleRoute={isDoubleRoute}
          defaultSecondCustomerPhone={order.secondCustomerPhone || ""}
          defaultSecondCustomerLocationUrl={secondLocMerged || ""}
          defaultSecondCustomerLandmark={secondLandmarkMerged || ""}
          defaultSecondAlternatePhone={mergedSecondAlternate || ""}
          auth={auth}
          nextUrl={nextUrl}
        />

        {/* بصمات الصوت المسجلة إن وجدت بتصميم دمشقي مذهب */}
        {(voiceSrc || adminVoiceSrc) && (
          <div className="mb-4 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            {voiceSrc && (
              <div className="rounded-2xl border-2 border-[#C9A86A]/70 bg-[#0A241C]/90 p-3 shadow-md">
                <div className="mb-1.5 flex items-center justify-between">
                  <span className="text-xs font-black text-[#F5D77F] flex items-center gap-1"><span>🗣️</span> بصمة الزبون (المحل)</span>
                </div>
                <VoiceNoteAudio src={voiceSrc} streamKey={`${order.id}-voice`} className="w-full" />
              </div>
            )}
            {adminVoiceSrc && (
              <div className="rounded-2xl border-2 border-[#C9A86A]/70 bg-[#0A241C]/90 p-3 shadow-md">
                <div className="mb-1.5 flex items-center justify-between">
                  <span className="text-xs font-black text-rose-300 flex items-center gap-1"><span>🎧</span> بصمة المدير (المسجلة)</span>
                </div>
                <VoiceNoteAudio src={adminVoiceSrc} streamKey={`${order.id}-admin-voice`} className="w-full" />
              </div>
            )}
          </div>
        )}

        <div className="mt-1.5 space-y-3 sm:space-y-4">
          {/* --- بطاقات الطلب الفاخرة --- */}
          <div className="flex flex-col gap-0 w-full">
            {!isDoubleRoute && (
              <AdminLuxuryShopCard
                order={order}
                submitterName={submitterName}
                submitterPhone={shopContactPhone}
                imgShopDoor={imgShopDoor}
                setPreviewImageUrl={setPreviewImageUrl}
                isSystemAdminOrder={isPreparerOrAdminOrder}
                designerConfig={designerConfig}
              />
            )}

            {/* الفاصل الأرابيسك المذهب بين كارت المحل وكارت الزبون */}
            {!isDoubleRoute && !shouldCollapseSender && (
              <div className="flex items-center justify-center gap-2 py-2 my-0.5">
                <div className="h-[1px] w-[36px] bg-gradient-to-l from-[#C9A86A]/40 to-transparent" />
                <div className="w-[22px] h-[22px] rounded-full border border-[#C9A86A]/30 bg-[#FDF6E3] flex items-center justify-center shadow-[0_2px_8px_rgba(201,168,106,0.15)]">
                  <div className="w-[12px] h-[12px] relative">
                    <div className="absolute inset-0 rotate-45 border border-[#C9A86A]/60" />
                    <div className="absolute inset-[3px] rotate-45 bg-[#C9A86A]/80" />
                  </div>
                </div>
                <div className="h-[1px] w-[36px] bg-gradient-to-r from-[#C9A86A]/40 to-transparent" />
              </div>
            )}

            {shouldCollapseSender && (
              <div
                onClick={() => setIsSenderExpanded(true)}
                className="bg-[#0A3D2E]/90 border-2 border-[#C9A86A] rounded-[1.5rem] p-3.5 shadow-lg flex items-center justify-between cursor-pointer hover:bg-[#0F4D3A] transition-all mb-1 active:scale-[0.99]"
              >
                <div className="flex items-center gap-2.5">
                  <span className="h-9 w-9 rounded-full bg-gradient-to-br from-[#F5D77F] to-[#C9A86A] text-[#06281D] flex items-center justify-center font-black text-sm shadow-md">✓</span>
                  <div>
                    <h4 className="text-sm font-black text-[#F5D77F]">
                      المرسل (الوجهة الأولى) - تم الاستلام بنجاح ✅
                    </h4>
                    <p className="text-xs font-bold text-emerald-200">
                      📍 {order.customerRegion?.name || "منطقة المرسل"} {order.customerPhone ? `| 📞 ${contactLine(order.customerPhone)}` : ""}
                    </p>
                  </div>
                </div>
                <button type="button" className="px-3.5 py-1.5 bg-gradient-to-r from-[#0F4D3A] to-[#164E3D] rounded-xl text-xs font-black text-[#F5D77F] shadow-sm border border-[#C9A86A]">
                  عرض التفاصيل 🔽
                </button>
              </div>
            )}

            {!shouldCollapseSender && (
              <div className="w-full">
                <AdminLuxuryCustomerCard
                  order={order}
                  customerName={(order as any).customerName || order.customer?.name || "الزبون"}
                  customerPhone={order.customerPhone}
                  customerPhone2={order.customerPhone2 || order.alternatePhone || phoneProfile?.alternatePhone}
                  alternatePhone={order.alternatePhone || order.customerPhone2 || phoneProfile?.alternatePhone}
                  imgCustomerDoor={imgCustDoor}
                  setPreviewImageUrl={setPreviewImageUrl}
                  isDoubleRoute={isDoubleRoute}
                  designerConfig={designerConfig || undefined}
                  phoneProfile={phoneProfile}
                  headerAction={
                    <OtherRegionsCustomerDetails
                      phone={order.customerPhone}
                      currentRegionId={order.customerRegionId}
                      currentRegionName={order.customerRegion?.name}
                      orderId={order.id}
                      isSecondDestination={false}
                      designerConfig={designerConfig || undefined}
                    />
                  }
                  smartHintNode={
                    isSmartHintValid(smartHintLine) ? (
                      <div className="bg-gradient-to-r from-[#0F4D3A] via-[#1B4D3E] to-[#0F4D3A] border-2 border-[#C9A86A] rounded-2xl p-2.5 sm:p-3 flex items-center justify-between shadow-lg">
                        <div className="flex-1 text-right">
                          <p className="text-[10px] font-black text-[#F5D77F] flex items-center gap-1 justify-end">
                            <span>💡 الاستدلال الذكي</span>
                          </p>
                          <p className="text-xs font-black text-white mt-1">
                            {smartHintLine!.trim()}
                          </p>
                        </div>
                        <div className="h-9 w-9 bg-[#06281D] border border-[#C9A86A] rounded-xl flex items-center justify-center text-white font-bold text-base shadow-md shrink-0 mr-2">
                          💡
                        </div>
                      </div>
                    ) : null
                  }
                >
                  {/* أزرار اللوكيشن السريعة المذهبة */}
                  <div className="w-full">
                    <AdminCustomerLocationQuick
                      orderId={order.id}
                      customerPhone={order.customerPhone}
                      customerPhone2={order.customerPhone2 || undefined}
                      shopPhone={shopContactPhone || undefined}
                      orderStatus={order.status}
                      hasCustomerLocation={Boolean(mergedCustomerLocationUrl)}
                      hasCourierUploadedLocation={Boolean(order.customerLocationSetByCourierAt)}
                      userRole="mandoub"
                      templateVars={{
                        clientshop: effectiveShopName,
                        city: order.customerRegion?.name || "—",
                        total_price: currentTotalPriceStr,
                        total: currentTotalPriceStr,
                        delivery: currentCourierName,
                        courier: currentCourierName,
                        courierName: currentCourierName,
                        deliveryName: currentCourierName,
                        location_url: mergedCustomerLocationUrl || "",
                        landmark: mergedLandmark || "",
                        order_number: String(order.orderNumber || ""),
                        customer_phone: order.customerPhone || "",
                        customer_phone2: order.customerPhone2 || "",
                        shop_phone: shopContactPhone || "",
                      }}
                      customButtons={customWaButtons}
                      designerConfig={designerConfig || undefined}
                    />
                  </div>
                </AdminLuxuryCustomerCard>
              </div>
            )}

            {/* في حالة الطلب ذو الوجهتين: بطاقة المستلم */}
            {isDoubleRoute && (
              <>
                {/* فاصل أرابيسك مذهب ملكي بين المرسل والمستلم */}
                <div className="flex items-center justify-center gap-2 py-2.5 my-1">
                  <div className="h-[1.5px] w-[45px] bg-gradient-to-l from-[#C9A86A] to-transparent" />
                  <div className="px-3 py-1 rounded-full border border-[#C9A86A]/40 bg-gradient-to-r from-[#FFF8E1] via-[#FFFEF8] to-[#FFF8E1] shadow-[0_2px_8px_rgba(201,168,106,0.18)] flex items-center gap-1.5">
                    <span className="text-[11px] font-black text-[#8B6A2A]">⮯ الوجهة الثانية للتسليم (المستلم)</span>
                  </div>
                  <div className="h-[1.5px] w-[45px] bg-gradient-to-r from-[#C9A86A] to-transparent" />
                </div>

                <div className="w-full">
                  <AdminLuxuryCustomerCard
                    order={order}
                    customerName={order.secondCustomerName || "المستلم"}
                    customerPhone={order.secondCustomerPhone || order.customerPhone}
                    customerPhone2={order.secondCustomerPhone2 || order.secondCustomerAlternatePhone || order.customerPhone2}
                    imgCustomerDoor={imgCustDoor2}
                    setPreviewImageUrl={setPreviewImageUrl}
                    isDoubleRoute={true}
                    isSecondDestination={true}
                    cardTitle="المستلم (الوجهة الثانية)"
                    customerRegionName={order.secondCustomerRegion?.name}
                    customerRegionId={order.secondCustomerRegionId}
                    landmark={secondLandmarkMerged}
                    locationUrl={secondLocMerged}
                    alternatePhone={mergedSecondAlternate || order.secondCustomerAlternatePhone || order.secondCustomerPhone2}
                    designerConfig={designerConfig || undefined}
                    phoneProfile={secondPhoneProfile}
                    headerAction={
                      <OtherRegionsCustomerDetails
                        phone={order.secondCustomerPhone || order.customerPhone}
                        currentRegionId={order.secondCustomerRegionId}
                        currentRegionName={order.secondCustomerRegion?.name}
                        orderId={order.id}
                        isSecondDestination={true}
                        designerConfig={designerConfig || undefined}
                      />
                    }
                    smartHintNode={
                      isSmartHintValid(secondSmartHintLine) ? (
                        <div className="bg-gradient-to-r from-[#0F4D3A] via-[#1B4D3E] to-[#0F4D3A] border-2 border-[#C9A86A] rounded-2xl p-2.5 sm:p-3 flex items-center justify-between shadow-lg mt-2">
                          <div className="flex-1 text-right">
                            <p className="text-[10px] font-black text-[#F5D77F] flex items-center gap-1 justify-end">
                              <span>💡 الاستدلال الذكي (المستلم)</span>
                            </p>
                            <p className="text-xs font-black text-white mt-1">
                              {secondSmartHintLine!.trim()}
                            </p>
                          </div>
                          <div className="h-9 w-9 bg-[#06281D] border border-[#C9A86A] rounded-xl flex items-center justify-center text-white font-bold text-base shadow-md shrink-0 mr-2">
                            💡
                          </div>
                        </div>
                      ) : null
                    }
                  >
                    <div className="w-full">
                      <AdminCustomerLocationQuick
                        orderId={order.id}
                        target="second"
                        customerPhone={order.secondCustomerPhone || order.customerPhone}
                        customerPhone2={order.customerPhone2 || undefined}
                        shopPhone={shopContactPhone || undefined}
                        orderStatus={order.status}
                        hasCustomerLocation={Boolean(secondLocMerged)}
                        userRole="mandoub"
                        templateVars={{
                          clientshop: effectiveShopName,
                          city: order.secondCustomerRegion?.name || "—",
                          total_price: currentTotalPriceStr,
                          total: currentTotalPriceStr,
                          delivery: currentCourierName,
                          courier: currentCourierName,
                          courierName: currentCourierName,
                          deliveryName: currentCourierName,
                          location_url: secondLocMerged || "",
                          landmark: secondLandmarkMerged || "",
                          order_number: String(order.orderNumber || ""),
                          customer_phone: order.secondCustomerPhone || order.customerPhone || "",
                          customer_phone2: order.customerPhone2 || "",
                          shop_phone: shopContactPhone || "",
                        }}
                        customButtons={customWaButtons}
                        designerConfig={designerConfig || undefined}
                      />
                    </div>
                  </AdminLuxuryCustomerCard>
                </div>
              </>
            )}

            {/* فاصل أرابيسك مذهب قبل كارت تفاصيل الطلب */}
            <div className="flex items-center justify-center gap-2 py-2 my-0.5">
              <div className="h-[1px] w-[36px] bg-gradient-to-l from-[#C9A86A]/40 to-transparent" />
              <div className="w-[22px] h-[22px] rounded-full border border-[#C9A86A]/30 bg-[#FDF6E3] flex items-center justify-center shadow-[0_2px_8px_rgba(201,168,106,0.15)]">
                <div className="w-[12px] h-[12px] relative">
                  <div className="absolute inset-0 rotate-45 border border-[#C9A86A]/60" />
                  <div className="absolute inset-[3px] rotate-45 bg-[#C9A86A]/80" />
                </div>
              </div>
              <div className="h-[1px] w-[36px] bg-gradient-to-r from-[#C9A86A]/40 to-transparent" />
            </div>

            {/* كارت تفاصيل الطلب الملكي الفاخر */}
            <div className="w-full">
              <AdminLuxuryOrderInfoCard
                order={order}
                setPreviewImageUrl={setPreviewImageUrl}
                designerConfig={designerConfig || undefined}
                hideSubtotalInfo={hideSubtotalInfo}
                isMandoubPortal={true}
                auth={auth}
                nextUrl={nextUrl}
              />
            </div>

            {/* فاصل أرابيسك مذهب قبل كارت المعاملات المالية */}
            <div className="flex items-center justify-center gap-2 py-2 my-0.5">
              <div className="h-[1px] w-[36px] bg-gradient-to-l from-[#C9A86A]/40 to-transparent" />
              <div className="w-[22px] h-[22px] rounded-full border border-[#C9A86A]/30 bg-[#FDF6E3] flex items-center justify-center shadow-[0_2px_8px_rgba(201,168,106,0.15)]">
                <div className="w-[12px] h-[12px] relative">
                  <div className="absolute inset-0 rotate-45 border border-[#C9A86A]/60" />
                  <div className="absolute inset-[3px] rotate-45 bg-[#C9A86A]/80" />
                </div>
              </div>
              <div className="h-[1px] w-[36px] bg-gradient-to-r from-[#C9A86A]/40 to-transparent" />
            </div>

            {/* كارت المعاملات المالية الفاخر */}
            <div className="w-full">
              <MandoubOrderMoneyFlow
                designerConfig={designerConfig || undefined}
                orderId={order.id}
                orderNumber={order.orderNumber}
                courierName={order.courier?.name ?? "—"}
                orderStatus={order.status}
                missingCustomerLocation={!hasCustomerLocationUrl(mergedCustomerLocationUrl, undefined)}
                canRecordMoney={order.assignedCourierId === viewerCourierId}
                orderSubtotalDinar={order.orderSubtotal != null ? Number(order.orderSubtotal) : null}
                totalAmountDinar={order.totalAmount != null ? Number(order.totalAmount) : null}
                prepaidAll={order.prepaidAll}
                moneyEvents={order.moneyEvents.map((e) => ({
                  id: e.id,
                  kind: e.kind,
                  amountDinar: Number(e.amountDinar),
                  expectedDinar: e.expectedDinar != null ? Number(e.expectedDinar) : null,
                  matchesExpected: e.matchesExpected,
                  mismatchReason: e.mismatchReason,
                  mismatchNote: e.mismatchNote,
                  recordedAt: (e.createdAt instanceof Date ? e.createdAt : new Date(e.createdAt)).toISOString(),
                  deletedAt: e.deletedAt ? (e.deletedAt instanceof Date ? e.deletedAt : new Date(e.deletedAt)).toISOString() : null,
                  deletedReason: e.deletedReason,
                  deletedByDisplayName: e.deletedByDisplayName,
                  performedByDisplayName:
                    e.recordedByCompanyPreparer?.name || e.courier?.name || "—",
                  recordedByCompanyPreparerId: e.recordedByCompanyPreparerId ?? null,
                }))}
                auth={auth}
                nextUrl={nextUrl}
                totalsBaseline={order.courier?.mandoubTotalsResetAt ? (order.courier.mandoubTotalsResetAt instanceof Date ? order.courier.mandoubTotalsResetAt.toISOString() : String(order.courier.mandoubTotalsResetAt)) : null}
              />
            </div>
          </div>

          {/* تفاصيل السلة والملاحظات إن وجدت */}
          {(hasNotes || hasCart) && (
            <div className="mt-6 border-t-2 border-[#C9A86A]/30 pt-5">
              <p className="text-xs font-black text-[#F5D77F] mb-3 uppercase tracking-widest flex items-center gap-2">
                <span>📜</span>
                <span>قائمة المواد والملاحظات</span>
              </p>

              {hasCart && (
                <div className="mb-4 space-y-2.5">
                  <p className="text-[11px] font-black text-[#06281D] bg-gradient-to-r from-[#F5D77F] to-[#C9A86A] px-2.5 py-1 rounded-xl shadow-md w-fit">تفاصيل السلة (المتجر)</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {cartItems.map((item: any, idx: number) => (
                      <div key={idx} className="flex justify-between items-center p-3.5 rounded-2xl border-2 border-[#C9A86A]/60 bg-gradient-to-r from-[#0A3D2E] to-[#06281D] shadow-lg">
                        <div className="flex flex-col">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-black text-white">{item.name} ×{item.quantity}</span>
                            {item.quantity > 1 && (
                              <span className="text-xs font-black text-rose-300 bg-rose-950/80 px-1.5 py-0.5 rounded-lg border border-rose-500/80 animate-pulse">
                                ×{item.quantity}
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] font-bold text-[#F5D77F]/80">{item.price?.toLocaleString()} د.ع × {item.quantity}</span>
                        </div>
                        <span className="text-sm font-mono font-black text-[#F5D77F]">{(item.price * item.quantity).toLocaleString()} د.ع</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {hasNotes && (
                <ClickableNotesCard text={order.summary ?? ""}>
                  <div className="whitespace-pre-wrap p-4 pt-9 text-sm font-bold text-white leading-relaxed bg-gradient-to-br from-[#0A3D2E]/90 to-[#06281D]/90 rounded-2xl border-2 border-[#C9A86A]/60 shadow-lg">
                    {normalizeOrderSummaryText(order.summary)}
                  </div>
                </ClickableNotesCard>
              )}
            </div>
          )}
        </div>

        {/* مودال معاينة الصور التفاعلي الداعم للتكبير بالإصبعين والسحب */}
        {previewImageUrl && (
          <ImageZoomModal
            imageUrl={previewImageUrl}
            uploadedByName={previewUploadedByName}
            onClose={() => {
              setPreviewImageUrl(null);
              setPreviewUploadedByName(null);
            }}
          />
        )}

        {/* استوديو ترتيب وتخصيص الكروت السريع للمندوب */}
        <QuickOrderCardsDesignerModal
          isOpen={showMandoubStudioModal}
          onClose={() => setShowMandoubStudioModal(false)}
          currentScope="mandoub"
          canSwitchScope={false}
          initialConfig={designerConfig}
          onConfigSaved={(savedConfig) => {
            setDesignerConfig(savedConfig);
          }}
          orderSample={order}
        />

        {/* الزر العائم القابل للتحريك لعمليتي الاستلام والتسليم الفاخر مع الترقية التلقائية للحالة */}
        <FloatingOrderActionButton
          orderId={order.id}
          status={order.status}
          isMandoub={true}
        />
      </div>
    </>
  );
}
