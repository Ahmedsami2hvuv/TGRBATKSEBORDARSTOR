"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ImageZoomModal } from "@/components/pinch-zoom-image";
import { ad } from "@/lib/admin-ui";
import { InlineLandmarkEditor } from "@/components/inline-landmark-editor";
import { OtherRegionsCustomerDetails } from "@/components/other-regions-customer-details";
import { quickAssignOrderCourier } from "../actions";
import { LuxuryAssignCourierModal } from "@/components/luxury-assign-courier-modal";

const SECRET_ADMIN_PATH = "/abo1stor3hlaa2kbr8-47";

import { resolvePublicAssetSrc } from "@/lib/image-url";
import { normalizeOrderSummaryText } from "@/lib/preparation-invoice";
import { TwoWayOrderActionButtons } from "@/components/two-way-order-action-buttons";
import { WaLocationCustomButtons, type WaButtonNextItem } from "@/components/wa-location-custom-buttons";
import { OrderTypeDetailBlock } from "@/components/order-type-line";
import { isReversePickupOrderType } from "@/lib/order-type-flags";
import { formatBaghdadDateTime } from "@/lib/baghdad-time";
import { telHref, whatsappMeUrl } from "@/lib/whatsapp";
import {
  orderStatusBadgeClass,
  orderStatusBadgeClassPrepaid,
  orderStatusDetailSurfaceClass,
  orderStatusStartStripeClass,
} from "@/lib/order-status-style";
import { CustomerDoorPhotoQuick } from "./customer-door-photo-quick";
import { AdminOrderPhotoQuick } from "./admin-order-photo-quick";
import { AdminCustomerLocationQuick } from "./admin-customer-location-quick";
import { ImageUploaderCaption } from "@/components/image-uploader-caption";
import { VoiceNoteAudio } from "@/components/voice-note-audio";
import { AdminVoiceNoteSection } from "./edit/admin-voice-note-section";
import { DeleteAdminVoiceNoteButton } from "./edit/delete-admin-voice-note-button";
import { AdminCustomerOrderHistory, AdminCustomerPhoneInteractive } from "./admin-customer-order-history";
import { OrderFabDock } from "@/components/order-fab-dock";
import { ClickableNotesCard } from "@/components/clickable-notes-card";
import { AdminPricingPanel } from "../pending/pending-orders-client";
import { isAdminShopName } from "@/lib/admin-order-from-admin-constants";
import { formatDinarAsAlfWithUnit } from "@/lib/money-alf";

const squarePhotoFrame = "aspect-square w-full overflow-hidden rounded-2xl border-2 border-slate-200 shadow-sm bg-slate-50 relative";
const squarePhotoImg = "h-full w-full object-cover";
const squarePhotoContain = "h-full w-full object-contain";
const gridInfoPhoto = "grid grid-cols-[minmax(0,1fr)_minmax(0,12rem)] items-start gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.32fr)] sm:gap-6";
const compactPhoneText = "font-mono text-base font-black text-emerald-900 tabular-nums sm:text-lg [direction:ltr] break-all";

const STATUS_AR: Record<string, string> = {
  pending: "قيد الانتظار", assigned: "مسند للمندوب", delivering: "قيد التوصيل",
  delivered: "تم التسليم", cancelled: "ملغى", archived: "مؤرشف",
};

const SYSTEM_ADMIN_PHONE = "07733921568";

function contactLine(phone: string): string {
  const t = (phone || "").trim();
  if (!t || t === "—" || t === "undefined") return "";
  return t;
}

/** بيانات JSON للتسعير/المتجر — قد تكون نصاً غير صالح أو شكلاً غير متوقع بعد التخزين */
function parsePreparerShoppingJson(raw: unknown): Record<string, unknown> | null {
  if (raw == null) return null;
  if (Array.isArray(raw)) return raw.length > 0 ? ({ products: raw } as Record<string, unknown>) : null;
  if (typeof raw === "object") {
    const obj = raw as Record<string, unknown>;
    if (Array.isArray(obj.products)) return obj.products.length > 0 ? obj : null;
    if (Array.isArray(obj.items)) return obj.items.length > 0 ? obj : null;
    return Object.keys(obj).length > 0 ? obj : null;
  }
  if (typeof raw === "string") {
    const t = raw.trim();
    if (!t || t === "{}" || t === "[]" || t === "null" || t.length <= 2) return null;
    try {
      const v = JSON.parse(t) as unknown;
      if (Array.isArray(v)) return v.length > 0 ? ({ products: v } as Record<string, unknown>) : null;
      if (typeof v === "object" && v !== null) {
        const obj = v as Record<string, unknown>;
        if (Array.isArray(obj.products)) return obj.products.length > 0 ? obj : null;
        if (Array.isArray(obj.items)) return obj.items.length > 0 ? obj : null;
        return Object.keys(obj).length > 0 ? obj : null;
      }
      return null;
    } catch {
      return null;
    }
  }
  return null;
}

type OrderViewModel = {
  id: string; orderNumber: number; status: string; orderType: string; summary: string;
  customerPhone: string; routeMode: "single" | "double"; adminOrderCode: string;
  alternatePhone: string | null; secondCustomerPhone: string | null;
  secondCustomerLocationUrl: string; secondCustomerLandmark: string;
  secondSmartHintLine?: string;
  secondCustomerDoorPhotoUrl: string | null; secondCustomerDoorPhotoUploadedByName: string | null;
  secondCustomerRegion: { name: string } | null;
  orderNoteTime: string | null; imageUrl: string | null; orderImageUploadedByName: string | null;
  voiceNoteUrl: string | null; adminVoiceNoteUrl: string | null; shopDoorPhotoUrl: string | null;
  shopDoorPhotoUploadedByName: string | null; customerDoorPhotoUrl: string | null;
  customerDoorPhotoUploadedByName: string | null; customerLandmark: string;
  smartHintLine?: string;
  orderSubtotal: string | null; deliveryPrice: string | null; totalAmount: string | null;
  submissionSource: string; createdAt: string; prepaidAll: boolean; reversePickup: boolean;
  shop: { name: string; phone: string; ownerName: string; region?: { name: string } | null };
  shopPhotoUrl: string; shopLocationUrl: string; customerLocationUrl: string;
  customerLocationUploadedByName: string | null; customerRegion: { name: string } | null;
  customerRegionId: string | null;
  customerProfileId: string | null;
  isBlocked: boolean;
  courier: { name: string; phone: string } | null; customer: { name: string } | null;
  submittedBy: { name: string; phone: string } | null;
  submittedByCompanyPreparer: { name: string; phone: string } | null;
  preparerShoppingJson: any;
  customerLocationSetByCourierAt?: string | Date | null;
  secondCustomerLocationSetByCourierAt?: string | Date | null;
  secondCustomerAlternatePhone?: string | null;
  customerPhone2?: string | null;
  totalPrice?: number | string | null;
  secondCustomerRegionId?: string | null;
};

export function OrderViewContent({
  order,
  preparers = [],
  customWaButtons,
  waButtonSettings,
  storeProducts = [],
  twoWayTemplates,
  couriers = [],
  phoneProfile,
  secondPhoneProfile,
}: {
  order: OrderViewModel;
  preparers?: { id: string; name: string }[];
  customWaButtons?: Array<{
    id: string;
    label: string;
    iconKey: string;
    messages: string[];
  }>;
  waButtonSettings?: WaButtonNextItem[];
  storeProducts?: any[];
  twoWayTemplates?: any;
  couriers?: { id: string; name: string; phone?: string }[];
  phoneProfile?: any;
  secondPhoneProfile?: any;
}) {
  const router = useRouter();
  const [pricingOpen, setPricingOpen] = useState(false);
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
  const [isShopCardExpanded, setIsShopCardExpanded] = useState(false);
  const [isSenderExpanded, setIsSenderExpanded] = useState(false);

  // حالات مودال تغيير المندوب المباشر
  const [showAssignCourierModal, setShowAssignCourierModal] = useState(false);
  const [directReceipt, setDirectReceipt] = useState(false);
  const [assignLoading, setAssignLoading] = useState(false);
  const [selectedCourierId, setSelectedCourierId] = useState<string | null>(null);
  const [toastSuccess, setToastSuccess] = useState<string | null>(null);

  const handleAssignCourier = async (courierId: string | null) => {
    setAssignLoading(true);
    setSelectedCourierId(courierId);
    try {
      const res = await quickAssignOrderCourier(order.id, courierId, directReceipt);
      if (res.error) {
        alert(res.error);
      } else {
        setShowAssignCourierModal(false);
        const msg = courierId 
          ? `✅ تم تغيير المندوب بنجاح إلى: ${res.courierName || "المندوب الجديد"}` 
          : `✅ تم سحب الطلبية وإلغاء إسناد المندوب بنجاح.`;
        setToastSuccess(msg);
        router.refresh();
        setTimeout(() => setToastSuccess(null), 5000);
      }
    } catch (e: any) {
      alert("حدث خطأ غير متوقع: " + (e.message || e));
    } finally {
      setAssignLoading(false);
      setSelectedCourierId(null);
    }
  };

  const imgOrder = resolvePublicAssetSrc(order.imageUrl);
  const voiceSrc = resolvePublicAssetSrc(order.voiceNoteUrl);
  const adminVoiceSrc = resolvePublicAssetSrc(order.adminVoiceNoteUrl);
  const imgShopDoor = resolvePublicAssetSrc(order.shopPhotoUrl || order.shopDoorPhotoUrl || null);
  const imgCustDoor = resolvePublicAssetSrc(order.customerDoorPhotoUrl);
  const imgCustDoor2 = resolvePublicAssetSrc(order.secondCustomerDoorPhotoUrl);


  const isReversePickup = order.reversePickup || isReversePickupOrderType(order.orderType);
  const isSystemAdminOrder =
    isAdminShopName(order.shop?.name) ||
    order.submissionSource === "admin_portal" ||
    order.submissionSource === "company_preparer" ||
    Boolean(order.submittedByCompanyPreparerId) ||
    (Boolean(order.submittedByCompanyPreparer?.name) && Boolean(order.shop?.name) && order.shop.name.trim() === order.submittedByCompanyPreparer.name.trim());
  const isDoubleRoute = order.routeMode === "double" || !!order.secondCustomerPhone;

  const statusBadgeClass = order.prepaidAll ? orderStatusBadgeClassPrepaid(order.status, true) : orderStatusBadgeClass(order.status);

  const submitterName = order.submittedByCompanyPreparer?.name || order.submittedBy?.name || (isSystemAdminOrder ? "الإدارة" : order.shop?.name || "المسؤول");
  const currentTotalPriceStr = String(order.totalAmount || order.totalPrice || "");
  const currentCourierName = order.courier?.name || "المندوب";
  const isSenderPickedUp = isDoubleRoute && (order.status === "delivering" || order.status === "delivered");
  const shouldCollapseSender = isDoubleRoute && isSenderPickedUp && !isSenderExpanded;

  const submitterPhone = order.submittedByCompanyPreparer?.phone?.trim()
    || order.submittedBy?.phone?.trim()
    || (order.submissionSource === "admin_portal" ? SYSTEM_ADMIN_PHONE : order.shop?.phone?.trim() || "");

  const parsedShoppingJson = parsePreparerShoppingJson(order.preparerShoppingJson);

  const isSmartHintValid = (s: string | null | undefined) => {
    if (!s) return false;
    const t = s.trim();
    if (!t || t === "—" || t.startsWith("—")) return false;
    return true;
  };

  const [customerDebt, setCustomerDebt] = useState<number | null>(null);

  useEffect(() => {
    if (order.customerPhone) {
      import("@/app/abo1stor3hlaa2kbr8-47/(dashboard)/credit-book/actions").then(({ getCustomerDebtByPhone }) => {
        getCustomerDebtByPhone(order.customerPhone).then(setCustomerDebt);
      });
    }
  }, [order.customerPhone]);

  return (
    <>
      <div className="relative mt-4 rounded-[28px] border-2 border-[#C9A86A] bg-gradient-to-b from-[#06281D] via-[#0A3D2E] to-[#06281D] p-3.5 sm:p-6 pb-24 sm:pb-32 text-[#FFF8F0] shadow-[0_20px_60px_rgba(0,0,0,0.85)] text-base leading-relaxed select-none overflow-hidden" dir="rtl">

        {/* زخرفة دمشقية في أعلى وأسفل الصفحة */}
        <div className="absolute top-0 right-0 left-0 h-1 bg-gradient-to-r from-transparent via-[#C9A86A] to-transparent opacity-80 pointer-events-none" />

        {/* --- بلوك كلشي واصل المشع والمتحرك (RGB) --- */}
        {order.prepaidAll && (
          <div className="relative mb-4 overflow-hidden rounded-2xl p-5 shadow-xl text-white prepaid-rgb-block border-2 border-[#F5D77F]/60">
            <style>{`
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
            {/* لمعة زجاجية خفيفة */}
            <div className="absolute inset-0 bg-gradient-to-tr from-white/10 to-transparent pointer-events-none" />
          </div>
        )}

        {customerDebt !== null && customerDebt > 0 && (
          <div className="mb-4 rounded-2xl border-2 border-[#C9A86A] bg-gradient-to-r from-[#B45309] to-[#78350F] p-4 text-right shadow-xl animate-pulse">
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

        {/* --- بطاقة ترويسة الطلبية الملكية الإسلامية المذهبة --- */}
        <div className="mb-5 rounded-[24px] border-2 border-[#C9A86A]/80 bg-[#0A241C]/95 p-3.5 sm:p-5 shadow-2xl backdrop-blur-md relative overflow-hidden">
          
          {/* سطر الأزرار العلوية الأربعة: إغلاق - تعديل - تغيير المندوب - بصمة المدير */}
          <div className="mb-4 grid grid-cols-4 gap-1.5 sm:gap-2.5">
            <Link
              href={`${SECRET_ADMIN_PATH}/orders/tracking`}
              className="inline-flex items-center justify-center gap-1 rounded-xl border border-[#C9A86A] bg-gradient-to-r from-[#0F4D3A] to-[#164E3D] hover:scale-105 active:scale-95 px-1.5 py-2.5 text-xs font-black text-[#F5D77F] shadow-md transition-all min-h-[42px] text-center"
            >
              <span>⬅️</span>
              <span>إغلاق</span>
            </Link>

            <Link
              href={`${SECRET_ADMIN_PATH}/orders/${order.id}/edit`}
              className="inline-flex items-center justify-center gap-1 rounded-xl border border-[#C9A86A] bg-gradient-to-r from-[#1B4D3E] to-[#2D6A4F] hover:scale-105 active:scale-95 px-1.5 py-2.5 text-xs font-black text-[#F5D77F] shadow-md transition-all min-h-[42px] text-center"
            >
              <span>📝</span>
              <span>تعديل</span>
            </Link>

            {order.status !== "cancelled" && order.status !== "archived" ? (
              <button
                type="button"
                onClick={() => setShowAssignCourierModal(true)}
                className="inline-flex items-center justify-center gap-1 rounded-xl border border-[#FFF0D0] bg-gradient-to-r from-[#E67E22] to-[#D35400] hover:scale-105 active:scale-95 px-1.5 py-2.5 text-xs font-black text-white shadow-md transition-all cursor-pointer min-h-[42px] text-center"
              >
                <span>📦</span>
                <span className="truncate">المندوب</span>
              </button>
            ) : (
              <div />
            )}

            <AdminVoiceNoteSection
              variant="button"
              orderId={order.id}
              defaultAdminVoiceNoteUrl={order.adminVoiceNoteUrl}
            />
          </div>

          {/* سطر زر تعديل التسعير التكميلي إن وجد */}
          {parsedShoppingJson !== null && (
            <div className="mb-3.5">
              <Link
                href={`${SECRET_ADMIN_PATH}/orders/${order.id}/price`}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-[#C9A86A] bg-gradient-to-r from-[#B45309] to-[#78350F] hover:scale-101 active:scale-95 px-4 py-2 text-xs font-black text-[#F5D77F] shadow-md transition-all"
              >
                <span>💰</span>
                <span>تعديل تفاصيل وأسعار التجهيز</span>
              </Link>
            </div>
          )}

          {/* السطر الثاني: كبسولة رقم الطلب + اسم المندوب + حالة الطلب + الشارات الخاصة */}
          <div className="flex flex-wrap items-center justify-between gap-2.5 border-t border-[#C9A86A]/40 pt-3.5">
            <div className="flex flex-wrap items-center gap-2">
              {/* كبسولة رقم الطلب بالخلفية المكيشة المذهبة الفاخرة */}
              <div
                className="min-w-[85px] sm:min-w-[105px] h-11 sm:h-12 px-3 rounded-lg flex items-center justify-center text-center font-black font-mono text-xl sm:text-2xl tracking-wider select-none bg-no-repeat bg-[length:100%_100%] leading-none shrink-0"
                style={{
                  backgroundImage: "url('/images/order-luxury/order-number-bg.webp')",
                  color: "#F5D77F",
                  textShadow: "0 1px 3px rgba(0,0,0,0.85)",
                }}
              >
                <span className="drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)] pt-0.5">
                  #{order.orderNumber}
                </span>
              </div>

              {order.courier ? (
                <span className="inline-flex items-center gap-1.5 rounded-xl border border-[#C9A86A] bg-gradient-to-r from-[#0F4D3A] to-[#164E3D] px-3 py-1.5 text-xs font-black text-[#F5D77F] shadow-sm">
                  <span>🛵</span>
                  <span>{order.courier.name}</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 rounded-xl border border-slate-600 bg-slate-800/80 px-3 py-1.5 text-xs font-black text-slate-300">
                  <span>🛵</span>
                  <span>غير مسند</span>
                </span>
              )}
              
              {isReversePickup && (
                <span className="rounded-xl border border-[#C9A86A] bg-gradient-to-r from-[#78350F] to-[#B45309] px-2.5 py-1 text-xs font-black text-[#F5D77F] shadow-sm">
                  📦⤺ طلب عكسي
                </span>
              )}
              {isDoubleRoute && (
                <span className="rounded-xl border border-[#C9A86A] bg-gradient-to-r from-[#4C1D95] to-[#6D28D9] px-2.5 py-1 text-xs font-black text-[#F5D77F] shadow-sm">
                  📦➔ وجهتين
                </span>
              )}
              {order.prepaidAll && (
                <span className="rounded-xl border border-[#F5D77F] bg-emerald-600 text-[#FFF8F0] px-3 py-1 text-xs font-black shadow-md animate-pulse">
                  ✓ كلشي واصل
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <span className="rounded-full px-4 py-1.5 text-xs sm:text-sm font-black border border-[#C9A86A] bg-gradient-to-r from-[#06281D] to-[#0A3D2E] text-[#F5D77F] shadow-md drop-shadow-sm">
                {STATUS_AR[order.status] ?? order.status}
              </span>
            </div>
          </div>

          {/* سطر التواريخ والأوقات الأرابيسك المذهب الفاخر */}
          <div className="mt-3 flex items-center justify-between gap-2 rounded-xl border border-[#C9A86A]/60 bg-gradient-to-r from-[#06281D] via-[#0A3D2E] to-[#06281D] p-2.5 text-[11px] sm:text-xs font-bold text-[#FFF8F0] whitespace-nowrap overflow-x-auto shadow-md">
            <div className="flex items-center gap-1.5 shrink-0">
              <div className="w-6 h-6 rounded-md bg-gradient-to-b from-[#E67E22] to-[#D35400] text-white flex items-center justify-center font-black text-[10px] shadow-xs">
                📅
              </div>
              <span className="text-[#F5D77F] font-black">تاريخ الرفع:</span>
              <span className="font-mono text-white [direction:ltr]">{formatBaghdadDateTime(new Date(order.createdAt))}</span>
            </div>

            <div className="h-4 w-px bg-[#C9A86A]/50 shrink-0" />

            <div className="flex items-center gap-1.5 shrink-0">
              <span className="text-base">⏰</span>
              <span className="text-rose-400 font-black">وقت الاستلام:</span>
              <span className="text-[#F5D77F] font-black">{order.orderNoteTime || "فوري"}</span>
            </div>
          </div>

        </div>

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
                  <DeleteAdminVoiceNoteButton orderId={order.id} compact />
                </div>
                <VoiceNoteAudio src={adminVoiceSrc} streamKey={`${order.id}-admin-voice`} className="w-full" />
              </div>
            )}
          </div>
        )}

      <div className="mt-5 space-y-6 sm:space-y-8">
        
        {/* --- ⇄ TWO WAY ORDER ACTION BUTTONS (أزرار الطلب ذو الوجهتين) --- */}
        {isDoubleRoute && (
          <div className="mb-4">
            <TwoWayOrderActionButtons
              orderId={order.id}
              orderNumber={order.orderNumber}
              orderStatus={order.status}
              routeMode={order.routeMode || "double"}
              senderName="المرسل"
              senderPhone={order.customerPhone}
              senderAlternatePhone={order.alternatePhone}
              senderRegionName={order.customerRegion?.name}
              senderHasLocation={Boolean(order.customerLocationUrl)}
              senderGpsUploaded={Boolean(order.customerLocationSetByCourierAt)}
              recipientName="المستلم"
              recipientPhone={order.secondCustomerPhone || order.customerPhone}
              recipientAlternatePhone={order.secondCustomerAlternatePhone}
              recipientRegionName={order.secondCustomerRegion?.name}
              recipientHasLocation={Boolean(order.secondCustomerLocationUrl)}
              subtotal={order.orderSubtotal ? String(order.orderSubtotal) : "0"}
              delivery={order.deliveryPrice ? String(order.deliveryPrice) : "0"}
              total={order.totalAmount ? String(order.totalAmount) : "0"}
              notes={order.summary}
              twoWayTemplates={twoWayTemplates}
              deliveryName={order.courier?.name || "المندوب"}
            />
          </div>
        )}
        
        {/* --- بطاقة المحل (المرسل) - بالتصميم الملكي الإسلامي الفاخر --- */}
        {!isDoubleRoute && (
          <div className="bg-[#0A241C]/95 backdrop-blur-md rounded-[24px] border-2 border-[#C9A86A] shadow-xl p-4 sm:p-5 relative overflow-hidden transition-all duration-300">
            <div className="flex items-center justify-between border-b border-[#C9A86A]/40 pb-2.5 mb-3.5">
              <div className="flex-1">
                <button
                  type="button"
                  onClick={() => setIsShopCardExpanded(!isShopCardExpanded)}
                  className="inline-flex items-center gap-1.5 bg-gradient-to-r from-[#0F4D3A] to-[#164E3D] border border-[#C9A86A] text-[11px] font-black text-[#F5D77F] px-3 py-1.5 rounded-xl shadow-md transition hover:scale-105 active:scale-95 cursor-pointer"
                >
                  <span>{isShopCardExpanded ? "⬆️ طي تفاصيل المحل" : "🔽 تفاصيل المحل (المرسل)"}</span>
                </button>
              </div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm sm:text-base font-black text-[#F5D77F] drop-shadow-sm">
                  المحل (المرسل)
                </h3>
                <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-[#0F4D3A] to-[#06281D] border border-[#C9A86A] flex items-center justify-center text-lg shadow-sm">
                  🏢
                </div>
              </div>
            </div>

            <div className="flex flex-row gap-4 items-start justify-between">
              <div className="flex-1 space-y-2.5 text-right">
                <div className="space-y-2 text-xs sm:text-sm">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-black text-[#F5D77F]" title="اسم المحل">🏢</span>
                    <span className="font-black text-white text-sm sm:text-base">{order.shop?.name || "المحل"}</span>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-black text-[#F5D77F]" title="العميل / المسؤول">👤</span>
                    <span className="font-black text-emerald-300">{submitterName}</span>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-black text-[#F5D77F]" title="منطقة المحل">📍</span>
                    <span className="font-bold text-[#FFF8F0]">{order.shop?.region?.name || "—"}</span>
                  </div>

                  {submitterPhone && (
                    <div className="flex items-center gap-2">
                      <span className="font-black text-[#F5D77F]" title="هاتف المسؤول">📞</span>
                      <span className="font-mono font-black text-[#F5D77F] text-sm tracking-wider">{contactLine(submitterPhone)}</span>
                    </div>
                  )}
                </div>

                <div className="pt-2 space-y-2.5 w-full">
                  {order.shopLocationUrl?.trim() ? (
                    <a
                      href={order.shopLocationUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex min-h-[44px] sm:min-h-[48px] w-full items-center justify-center rounded-xl border border-[#C9A86A] bg-gradient-to-r from-[#0F4D3A] to-[#164E3D] px-4 text-xs sm:text-sm font-black text-[#F5D77F] hover:scale-[1.01] active:scale-95 transition-all gap-2 shadow-lg cursor-pointer"
                    >
                      <span>📍</span>
                      <span>موقع المحل على الخريطة ↗</span>
                    </a>
                  ) : (
                    <div className="w-full p-2 bg-[#06281D]/80 border border-[#C9A86A]/40 rounded-xl text-center text-xs font-bold text-amber-300">
                      ⚠️ لا يوجد موقع جغرافي للمحل
                    </div>
                  )}

                  {submitterPhone && (
                    <div className="flex items-center gap-2 w-full">
                      <a
                        href={telHref(submitterPhone)}
                        className="flex-1 inline-flex min-h-[40px] items-center justify-center rounded-xl border border-[#C9A86A] bg-gradient-to-r from-[#0F4D3A] to-[#164E3D] px-2 py-1.5 text-xs sm:text-sm font-black text-[#F5D77F] hover:scale-105 active:scale-95 transition-all gap-1.5 shadow-md cursor-pointer"
                      >
                        <span>📞</span>
                        <span>اتصال</span>
                      </a>
                      <a
                        href={whatsappMeUrl(submitterPhone)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 inline-flex min-h-[40px] items-center justify-center rounded-xl border border-[#C9A86A] bg-gradient-to-r from-[#1B4D3E] to-[#2D6A4F] px-2 py-1.5 text-xs sm:text-sm font-black text-[#F5D77F] hover:scale-105 active:scale-95 transition-all gap-1.5 shadow-md cursor-pointer"
                      >
                        <span>💬</span>
                        <span>واتس</span>
                      </a>
                    </div>
                  )}
                </div>
              </div>

              {/* صورة المحل / الباب مع إطار مذهب فاخر */}
              <div className="w-[170px] xs:w-[195px] sm:w-[240px] md:w-[270px] flex flex-col items-center justify-start shrink-0 self-start gap-2">
                <span className="text-xs font-black text-[#F5D77F]">صورة المحل</span>
                {imgShopDoor ? (
                  <div className="w-full flex flex-col items-center gap-1">
                    <div className="aspect-square w-full overflow-hidden rounded-2xl border-2 border-[#C9A86A] shadow-xl bg-black/40">
                      <img src={imgShopDoor} alt="" className="h-full w-full object-cover cursor-zoom-in hover:scale-105 transition duration-300" onClick={() => setPreviewImageUrl(imgShopDoor)} />
                    </div>
                    {order.shopDoorPhotoUploadedByName?.trim() ? (
                      <div className="mt-0.5"><ImageUploaderCaption name={order.shopDoorPhotoUploadedByName} /></div>
                    ) : null}
                  </div>
                ) : (
                  <div className="aspect-square w-full flex items-center justify-center bg-[#06281D]/80 rounded-2xl border-2 border-dashed border-[#C9A86A]/50 text-xs text-[#F5D77F]/70 font-bold text-center p-2">
                    لا توجد صورة
                  </div>
                )}
                {!isSystemAdminOrder && (
                  <div className="w-full">
                    <AdminOrderPhotoQuick orderId={order.id} kind="shop" hasImage={!!(order.shopPhotoUrl || order.shopDoorPhotoUrl)} />
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* --- بطاقة الزبون (المستلم) أو المرسل (الوجهة الأولى) --- */}
        <div className="space-y-4">
          {shouldCollapseSender && (
            <div
              onClick={() => setIsSenderExpanded(true)}
              className="bg-[#0A3D2E]/90 border-2 border-[#C9A86A] rounded-[1.5rem] p-3.5 shadow-lg flex items-center justify-between cursor-pointer hover:bg-[#0F4D3A] transition-all mb-3 active:scale-[0.99]"
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
            <div className="relative overflow-hidden rounded-[2rem] border-2 border-[#C9A86A] bg-gradient-to-br from-[#0A3D2E] via-[#06281D] to-[#0A3D2E] p-4 sm:p-5 shadow-2xl ring-1 ring-[#F5D77F]/30 backdrop-blur-md">
              <div className="absolute inset-0 bg-[radial-gradient(#C9A86A_1px,transparent_1px)] [background-size:16px_16px] opacity-10 pointer-events-none" />

              {isSenderPickedUp && (
                <div className="relative z-10 flex justify-end mb-2">
                  <button
                    type="button"
                    onClick={() => setIsSenderExpanded(false)}
                    className="px-3 py-1 bg-[#0F4D3A] text-[#F5D77F] rounded-xl text-xs font-black shadow-xs border border-[#C9A86A]/60"
                  >
                    طوي بطاقة المرسل 🔼
                  </button>
                </div>
              )}

              <div className="relative z-10 flex flex-row gap-4 items-start justify-between">
                <div className="flex-1 space-y-3 text-right">
                  <div className="flex items-center gap-2 border-b border-[#C9A86A]/30 pb-2">
                    <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-[#1B4D3E] to-[#06281D] border border-[#C9A86A] flex items-center justify-center text-lg shadow-inner">
                      👤
                    </div>
                    <div>
                      <h3 className="text-sm sm:text-base font-black text-[#F5D77F] drop-shadow-sm">
                        {isDoubleRoute ? "المرسل (الوجهة الأولى)" : "الزبون (المستلم)"}
                      </h3>
                    </div>
                  </div>

                  <div className="space-y-2 text-xs sm:text-sm">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-black text-[#F5D77F]" title="منطقة الزبون">📍</span>
                      <span className="font-black text-white text-sm sm:text-base">{order.customerRegion?.name ?? "—"}</span>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-black text-[#F5D77F]" title="رقم الزبون">📞</span>
                      {order.customerPhone ? (
                        <AdminCustomerPhoneInteractive
                          phone={order.customerPhone}
                          formattedPhone={contactLine(order.customerPhone)}
                          regionId={order.customerRegionId}
                          currentOrderId={order.id}
                          customerName={order.customerName}
                          customerRegionName={order.customerRegion?.name}
                          alternatePhone={order.alternatePhone}
                          customerLocationUrl={order.customerLocationUrl || undefined}
                          customerLandmark={order.customerLandmark || undefined}
                          customerProfileId={order.customerProfileId}
                        />
                      ) : (
                        <span className="font-mono font-black text-white/50">—</span>
                      )}
                    </div>

                    {order.alternatePhone && (
                      <div className="flex items-center gap-1.5 bg-[#06281D]/90 px-2 py-0.5 rounded-lg border border-[#C9A86A]/50 w-fit">
                        <span className="font-bold text-amber-300 text-[10px]">رقم بديل / أرشيف:</span>
                        <span className="font-mono font-black text-[#F5D77F] ml-1">{order.alternatePhone}</span>
                      </div>
                    )}
                  </div>

                  <div className="pt-2 space-y-2.5 w-full">
                    <div className="flex flex-col items-start gap-2">
                      <div className="flex flex-wrap items-center gap-2 w-full">
                        {order.customerLocationUrl?.trim() ? (
                          <div className="flex flex-wrap items-center gap-2 w-full">
                            <a
                              href={order.customerLocationUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex min-h-[44px] sm:min-h-[48px] items-center justify-center rounded-xl border border-[#C9A86A] bg-gradient-to-r from-[#0F4D3A] to-[#164E3D] px-4 text-xs sm:text-sm font-black text-[#F5D77F] hover:scale-[1.01] active:scale-95 transition-all gap-1.5 shadow-lg cursor-pointer"
                            >
                              <span>📍 موقع الزبون ↗</span>
                            </a>
                            <WaLocationCustomButtons
                              userRole="admin"
                              customerPhone={order.customerPhone}
                              customerPhone2={order.customerPhone2 || undefined}
                              shopPhone={submitterPhone || undefined}
                              orderStatus={order.status}
                              hasCustomerLocation={Boolean(order.customerLocationUrl)}
                              hasCourierUploadedLocation={Boolean(order.customerLocationSetByCourierAt)}
                              templateVars={{
                                clientshop: order.shop?.name || (isSystemAdminOrder ? "الإدارة" : "المحل"),
                                city: order.customerRegion?.name || "—",
                                total_price: currentTotalPriceStr,
                                total: currentTotalPriceStr,
                                delivery: currentCourierName,
                                courier: currentCourierName,
                                courierName: currentCourierName,
                                deliveryName: currentCourierName,
                                location_url: order.customerLocationUrl || "",
                                landmark: order.customerLandmark || "",
                                order_number: String(order.orderNumber || ""),
                                customer_phone: order.customerPhone || "",
                                customer_phone2: order.customerPhone2 || "",
                                shop_phone: submitterPhone || "",
                              }}
                              customButtons={waButtonSettings}
                            />
                          </div>
                        ) : (
                          <div className="flex flex-wrap items-center gap-2 w-full">
                            <AdminCustomerLocationQuick
                              orderId={order.id}
                              customerPhone={order.customerPhone}
                              customerPhone2={order.customerPhone2 || undefined}
                              shopPhone={submitterPhone || undefined}
                              orderStatus={order.status}
                              templateVars={{
                                clientshop: order.shop?.name || "",
                                city: order.customerRegion?.name || "",
                                total_price: String(order.totalAmount || ""),
                                delivery: order.courier?.name || "",
                                location_url: order.customerLocationUrl || "",
                                landmark: order.customerLandmark || "",
                                order_number: String(order.orderNumber || ""),
                                customer_phone: order.customerPhone || "",
                                customer_phone2: order.customerPhone2 || "",
                                shop_phone: submitterPhone || "",
                              }}
                              customButtons={waButtonSettings}
                            />
                          </div>
                        )}

                        <OtherRegionsCustomerDetails
                          phone={order.customerPhone}
                          currentRegionId={order.customerRegionId}
                          currentRegionName={order.customerRegion?.name}
                          orderId={order.id}
                          isSecondDestination={false}
                        />
                      </div>

                      {order.customerLocationUrl?.trim() && order.customerLocationUploadedByName?.trim() && (
                        <div className="mt-0.5"><ImageUploaderCaption name={order.customerLocationUploadedByName} /></div>
                      )}

                      {/* أزرار الاتصال والواتساب السريعة للزبون */}
                      {order.customerPhone && (
                        <div className="flex items-center gap-2 w-full mt-1">
                          <a
                            href={telHref(order.customerPhone)}
                            className="flex-1 inline-flex min-h-[40px] items-center justify-center rounded-xl border border-[#C9A86A] bg-gradient-to-r from-[#0F4D3A] to-[#164E3D] px-2 py-1.5 text-xs sm:text-sm font-black text-[#F5D77F] hover:scale-105 active:scale-95 transition-all gap-1.5 shadow-md cursor-pointer"
                          >
                            <span>📞</span>
                            <span>اتصال</span>
                          </a>
                          <a
                            href={whatsappMeUrl(order.customerPhone)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex-1 inline-flex min-h-[40px] items-center justify-center rounded-xl border border-[#C9A86A] bg-gradient-to-r from-[#1B4D3E] to-[#2D6A4F] px-2 py-1.5 text-xs sm:text-sm font-black text-[#F5D77F] hover:scale-105 active:scale-95 transition-all gap-1.5 shadow-md cursor-pointer"
                          >
                            <span>💬</span>
                            <span>واتس</span>
                          </a>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* صورة باب الزبون */}
                <div className="w-[170px] xs:w-[195px] sm:w-[240px] md:w-[270px] flex flex-col items-center justify-start shrink-0 self-start gap-2">
                  <span className="text-xs font-black text-[#F5D77F]">صورة الباب</span>
                  {imgCustDoor ? (
                    <div className="w-full flex flex-col items-center gap-1">
                      <div className="aspect-square w-full overflow-hidden rounded-2xl border-2 border-[#C9A86A] shadow-xl bg-black/40">
                        <img src={imgCustDoor} alt="" className="h-full w-full object-cover cursor-zoom-in hover:scale-105 transition duration-300" onClick={() => setPreviewImageUrl(imgCustDoor)} />
                      </div>
                      {order.customerDoorPhotoUploadedByName?.trim() ? (
                        <div className="mt-0.5"><ImageUploaderCaption name={order.customerDoorPhotoUploadedByName} /></div>
                      ) : null}
                    </div>
                  ) : (
                    <div className="aspect-square w-full flex items-center justify-center bg-[#06281D]/80 rounded-2xl border-2 border-dashed border-[#C9A86A]/50 text-xs text-[#F5D77F]/70 font-bold text-center p-2">
                      لا توجد صورة
                    </div>
                  )}
                  <div className="w-full">
                    <CustomerDoorPhotoQuick orderId={order.id} hasImage={!!order.customerDoorPhotoUrl} />
                  </div>
                </div>
              </div>

              <div className="relative z-10 mt-3 space-y-2">
                <div className="flex flex-col gap-1">
                  <InlineLandmarkEditor
                    orderId={order.id}
                    initialLandmark={order.customerLandmark}
                    isSecondDestination={false}
                    label="📍 دالة:"
                    uploadedByName={order.customerLocationUploadedByName || order.customerDoorPhotoUploadedByName}
                  />
                </div>

                {/* بلوك الاستدلال الذكي المضيء */}
                {isSmartHintValid(order.smartHintLine) && (
                  <div className="mt-3 bg-gradient-to-r from-[#0F4D3A] via-[#1B4D3E] to-[#0F4D3A] border-2 border-[#C9A86A] rounded-2xl p-3 flex items-center justify-between shadow-lg">
                    <div className="flex-1 text-right">
                      <p className="text-[10px] font-black text-[#F5D77F] flex items-center gap-1 justify-end">
                        <span>💡 الاستدلال الذكي</span>
                      </p>
                      <p className="text-xs font-black text-white mt-1">
                        {order.smartHintLine!.trim()}
                      </p>
                    </div>
                    <div className="h-10 w-10 bg-[#06281D] border border-[#C9A86A] rounded-xl flex items-center justify-center text-white font-bold text-lg shadow-md shrink-0 mr-2">
                      💡
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* --- بطاقة المستلم (الوجهة الثانية) في حالة الطلب ذو الوجهتين --- */}
          {order.routeMode === "double" && (
            <div className="relative overflow-hidden rounded-[2rem] border-2 border-[#C9A86A] bg-gradient-to-br from-[#1E1B4B] via-[#0F172A] to-[#06281D] p-4 sm:p-5 shadow-2xl ring-1 ring-[#F5D77F]/30 backdrop-blur-md mt-3">
              <div className="absolute inset-0 bg-[radial-gradient(#C9A86A_1px,transparent_1px)] [background-size:16px_16px] opacity-10 pointer-events-none" />

              <div className="relative z-10 flex flex-row gap-4 items-start justify-between">
                <div className="flex-1 space-y-3 text-right">
                  <div className="flex items-center gap-2 border-b border-[#C9A86A]/30 pb-2">
                    <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-[#312E81] to-[#0F172A] border border-[#C9A86A] flex items-center justify-center text-lg shadow-inner">
                      👥
                    </div>
                    <div>
                      <h3 className="text-sm sm:text-base font-black text-[#F5D77F] drop-shadow-sm">
                        المستلم (الوجهة الثانية)
                      </h3>
                    </div>
                  </div>

                  <div className="space-y-2 text-xs sm:text-sm">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-black text-[#F5D77F]" title="منطقة المستلم">📍</span>
                      <span className="font-black text-white text-sm sm:text-base">{order.secondCustomerRegion?.name ?? "—"}</span>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-black text-[#F5D77F]" title="هاتف المستلم">📞</span>
                      {order.secondCustomerPhone ? (
                        <AdminCustomerPhoneInteractive
                          phone={order.secondCustomerPhone}
                          formattedPhone={contactLine(order.secondCustomerPhone)}
                          regionId={order.secondCustomerRegionId}
                          currentOrderId={order.id}
                          customerName={order.secondCustomerName}
                          customerRegionName={order.secondCustomerRegion?.name}
                          alternatePhone={order.secondCustomerAlternatePhone}
                          customerLocationUrl={order.secondCustomerLocationUrl || undefined}
                          customerLandmark={order.secondCustomerLandmark || undefined}
                          customerProfileId={order.secondCustomerProfileId}
                        />
                      ) : (
                        <span className="font-mono font-black text-white/50">—</span>
                      )}
                    </div>

                    {order.secondCustomerAlternatePhone && (
                      <div className="flex items-center gap-1.5 bg-[#06281D]/90 px-2 py-0.5 rounded-lg border border-[#C9A86A]/50 w-fit">
                        <span className="font-bold text-amber-300 text-[10px]">رقم بديل / أرشيف:</span>
                        <span className="font-mono font-black text-[#F5D77F] ml-1">{order.secondCustomerAlternatePhone}</span>
                      </div>
                    )}
                  </div>

                  <div className="pt-2 space-y-2.5 w-full">
                    <div className="max-w-full">
                      {order.secondCustomerLocationUrl?.trim() ? (
                        <div className="flex flex-wrap items-center gap-2 w-full">
                          <a
                            href={order.secondCustomerLocationUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex min-h-[44px] sm:min-h-[48px] items-center justify-center rounded-xl border border-[#C9A86A] bg-gradient-to-r from-[#0F4D3A] to-[#164E3D] px-4 text-xs sm:text-sm font-black text-[#F5D77F] hover:scale-[1.01] active:scale-95 transition-all gap-1.5 shadow-lg cursor-pointer"
                          >
                            <span>📍 موقع المستلم ↗</span>
                          </a>
                          <WaLocationCustomButtons
                            userRole="admin"
                            customerPhone={order.secondCustomerPhone || order.customerPhone}
                            customerPhone2={order.customerPhone2 || undefined}
                            shopPhone={submitterPhone || undefined}
                            orderStatus={order.status}
                            hasCustomerLocation={Boolean(order.secondCustomerLocationUrl)}
                            hasCourierUploadedLocation={Boolean(order.secondCustomerLocationSetByCourierAt)}
                            templateVars={{
                              clientshop: order.shop?.name || (isSystemAdminOrder ? "الإدارة" : "المحل"),
                              city: order.secondCustomerRegion?.name || "—",
                              total_price: currentTotalPriceStr,
                              total: currentTotalPriceStr,
                              delivery: currentCourierName,
                              courier: currentCourierName,
                              courierName: currentCourierName,
                              deliveryName: currentCourierName,
                              location_url: order.secondCustomerLocationUrl || "",
                              landmark: order.secondCustomerLandmark || "",
                              order_number: String(order.orderNumber || ""),
                              customer_phone: order.secondCustomerPhone || order.customerPhone || "",
                              customer_phone2: order.customerPhone2 || "",
                              shop_phone: submitterPhone || "",
                            }}
                            customButtons={waButtonSettings}
                          />
                        </div>
                      ) : (
                        <div className="flex flex-wrap items-center gap-2 w-full">
                          <AdminCustomerLocationQuick
                            orderId={order.id}
                            target="second"
                            customerPhone={order.secondCustomerPhone || order.customerPhone}
                            customerPhone2={order.customerPhone2 || undefined}
                            shopPhone={submitterPhone || undefined}
                            orderStatus={order.status}
                            templateVars={{
                              clientshop: order.shop?.name || "",
                              city: order.secondCustomerRegion?.name || "",
                              total_price: String(order.totalAmount || ""),
                              delivery: order.courier?.name || "",
                              location_url: order.secondCustomerLocationUrl || "",
                              landmark: order.secondCustomerLandmark || "",
                              order_number: String(order.orderNumber || ""),
                              customer_phone: order.secondCustomerPhone || order.customerPhone || "",
                              customer_phone2: order.customerPhone2 || "",
                              shop_phone: submitterPhone || "",
                            }}
                            customButtons={waButtonSettings}
                          />
                        </div>
                      )}

                      <OtherRegionsCustomerDetails
                        phone={order.secondCustomerPhone || order.customerPhone}
                        currentRegionId={order.secondCustomerRegionId}
                        currentRegionName={order.secondCustomerRegion?.name}
                        orderId={order.id}
                        isSecondDestination={true}
                      />

                      {/* أزرار الاتصال والواتساب السريعة للمستلم */}
                      {(order.secondCustomerPhone || order.customerPhone) && (
                        <div className="flex items-center gap-2 w-full mt-2">
                          <a
                            href={telHref(order.secondCustomerPhone || order.customerPhone)}
                            className="flex-1 inline-flex min-h-[40px] items-center justify-center rounded-xl border border-[#C9A86A] bg-gradient-to-r from-[#0F4D3A] to-[#164E3D] px-2 py-1.5 text-xs sm:text-sm font-black text-[#F5D77F] hover:scale-105 active:scale-95 transition-all gap-1.5 shadow-md cursor-pointer"
                          >
                            <span>📞</span>
                            <span>اتصال</span>
                          </a>
                          <a
                            href={whatsappMeUrl(order.secondCustomerPhone || order.customerPhone)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex-1 inline-flex min-h-[40px] items-center justify-center rounded-xl border border-[#C9A86A] bg-gradient-to-r from-[#1B4D3E] to-[#2D6A4F] px-2 py-1.5 text-xs sm:text-sm font-black text-[#F5D77F] hover:scale-105 active:scale-95 transition-all gap-1.5 shadow-md cursor-pointer"
                          >
                            <span>💬</span>
                            <span>واتس</span>
                          </a>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* صورة باب المستلم */}
                <div className="w-[170px] xs:w-[195px] sm:w-[240px] md:w-[270px] flex flex-col items-center justify-start shrink-0 self-start gap-2">
                  <span className="text-xs font-black text-[#F5D77F]">صورة باب المستلم</span>
                  {imgCustDoor2 ? (
                    <div className="w-full flex flex-col items-center gap-1">
                      <div className="aspect-square w-full overflow-hidden rounded-2xl border-2 border-[#C9A86A] shadow-xl bg-black/40 relative">
                        <img src={imgCustDoor2} alt="" className="h-full w-full object-cover cursor-zoom-in hover:scale-105 transition duration-300" onClick={() => setPreviewImageUrl(imgCustDoor2)} />
                      </div>
                      {order.secondCustomerDoorPhotoUploadedByName?.trim() ? (
                        <div className="mt-0.5"><ImageUploaderCaption name={order.secondCustomerDoorPhotoUploadedByName} /></div>
                      ) : null}
                    </div>
                  ) : (
                    <div className="aspect-square w-full flex items-center justify-center bg-[#06281D]/80 rounded-2xl border-2 border-dashed border-[#C9A86A]/50 text-xs text-[#F5D77F]/70 font-bold text-center p-2">
                      لا توجد صورة
                    </div>
                  )}
                  <div className="w-full">
                    <CustomerDoorPhotoQuick orderId={order.id} hasImage={!!order.secondCustomerDoorPhotoUrl} isSecondCustomer />
                  </div>
                </div>
              </div>

              <div className="relative z-10 mt-3 space-y-2">
                <div className="flex flex-col gap-1">
                  <InlineLandmarkEditor
                    orderId={order.id}
                    initialLandmark={order.secondCustomerLandmark}
                    isSecondDestination={true}
                    label="📍 دالة:"
                    uploadedByName={order.secondCustomerDoorPhotoUploadedByName || order.customerLocationUploadedByName}
                  />
                </div>

                {isSmartHintValid(order.secondSmartHintLine) && (
                  <div className="flex flex-row items-center gap-1.5 rounded-xl bg-[#06281D]/80 p-2 border border-[#C9A86A]/40">
                    <span className="text-[11px] font-black text-[#F5D77F]">
                      💡 {order.secondSmartHintLine!.trim()}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* --- تفاصيل الطلب والأسعار وصورة الطلب --- */}
        <div className={gridInfoPhoto}>
          <div className="space-y-3.5 rounded-[2rem] border-2 border-[#C9A86A] bg-gradient-to-br from-[#0A3D2E] via-[#06281D] to-[#0A3D2E] p-4 sm:p-5 shadow-2xl ring-1 ring-[#F5D77F]/30 relative overflow-hidden backdrop-blur-md">
            <div className="absolute inset-0 bg-[radial-gradient(#C9A86A_1px,transparent_1px)] [background-size:16px_16px] opacity-10 pointer-events-none" />

            {/* نوع الطلب */}
            <div className="relative z-10 flex items-center justify-between gap-2 border-b border-[#C9A86A]/30 pb-2.5">
              <span className="text-xs sm:text-sm font-bold text-[#F5D77F] whitespace-nowrap">الطلب:</span>
              <div className="text-left font-black text-white text-xs sm:text-sm">
                <OrderTypeDetailBlock orderType={order.orderType} prefixClassName="font-black text-[#06281D] bg-gradient-to-r from-[#F5D77F] to-[#C9A86A] px-2.5 py-1 rounded-xl text-xs sm:text-sm shadow-md inline-block ml-1" restClassName="text-xs sm:text-sm font-black text-white" />
              </div>
            </div>

            {/* وقت الطلب */}
            <div className="relative z-10 flex items-center justify-between gap-2 border-b border-[#C9A86A]/30 pb-2.5">
              <span className="text-xs sm:text-sm font-bold text-[#F5D77F]">الوقت:</span>
              <span className="text-xs sm:text-sm font-black text-[#F5D77F] bg-[#0F4D3A] px-3 py-1 rounded-xl border border-[#C9A86A]/60 shadow-inner">
                {order.orderNoteTime || "فوري"}
              </span>
            </div>

            {/* سعر البضاعة والتوصيل والدين */}
            {(() => {
              const parseNum = (val: string | null | undefined): number => {
                if (!val) return 0;
                const clean = val.replace(/[^\d.]/g, "");
                const num = parseFloat(clean);
                return isNaN(num) ? 0 : num;
              };

              const subRaw = parseNum(order.orderSubtotal);
              const delRaw = parseNum(order.deliveryPrice);
              const totRaw = parseNum(order.totalAmount);
              
              const calculatedDebt = totRaw - (subRaw + delRaw);
              const hasDebt = calculatedDebt > 0;

              return (
                <div className="relative z-10 space-y-2.5 pt-0.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs sm:text-sm font-bold text-white">سعر البضاعة:</span>
                    <span className="font-mono text-base font-black text-[#F5D77F] bg-[#0F4D3A] px-3 py-0.5 rounded-xl border border-[#C9A86A]/50 shadow-inner">{order.orderSubtotal || "0"}</span>
                  </div>

                  {hasDebt && (
                    <div className="flex items-center justify-between gap-2 rounded-xl border border-rose-500/80 bg-rose-950/50 px-3 py-1 shadow-md">
                      <span className="text-xs font-black text-rose-300">الدين:</span>
                      <span className="font-mono text-base font-black text-rose-200 animate-pulse">{calculatedDebt}</span>
                    </div>
                  )}

                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs sm:text-sm font-bold text-white">التوصيل:</span>
                    <span className="font-mono text-base font-black text-[#F5D77F] bg-[#0F4D3A] px-3 py-0.5 rounded-xl border border-[#C9A86A]/50 shadow-inner">{order.deliveryPrice || "0"}</span>
                  </div>
                </div>
              );
            })()}

            {/* المبلغ الكلي أو كلشي واصل */}
            <div className={`relative z-10 rounded-2xl border-2 p-3 shadow-xl flex items-center justify-between gap-2 mt-2 ${order.prepaidAll ? "border-[#C9A86A] bg-gradient-to-r from-[#0F4D3A] to-[#1B4D3E] text-[#F5D77F]" : "border-[#C9A86A] bg-gradient-to-r from-[#06281D] to-[#0A3D2E] text-[#F5D77F]"}`}>
              <span className="text-xs sm:text-sm font-black">
                {order.prepaidAll ? "حالة الدفع:" : "المبلغ الكلي:"}
              </span>
              <span className="font-mono text-xl sm:text-2xl font-black tabular-nums drop-shadow-md">
                {order.prepaidAll ? (
                  <span className="text-[#F5D77F] font-black animate-pulse">كل شي واصل ✓</span>
                ) : (
                  order.totalAmount || "—"
                )}
              </span>
            </div>
          </div>

          <div className="self-start rounded-[2rem] border-2 border-[#C9A86A] bg-gradient-to-br from-[#0A3D2E] via-[#06281D] to-[#0A3D2E] p-4 shadow-2xl ring-1 ring-[#F5D77F]/30 backdrop-blur-md">
            <p className="mb-2 text-xs sm:text-sm font-black text-[#F5D77F]">صورة الطلبية</p>
            {imgOrder ? (
              <div className="aspect-square w-full overflow-hidden rounded-2xl border-2 border-[#C9A86A] shadow-xl bg-black/40">
                <img src={imgOrder} alt="" className="h-full w-full object-contain cursor-zoom-in hover:scale-105 transition duration-300" onClick={() => setPreviewImageUrl(imgOrder)} />
              </div>
            ) : (
              <div className="aspect-square w-full flex items-center justify-center bg-[#06281D]/80 rounded-2xl border-2 border-dashed border-[#C9A86A]/50 text-xs text-[#F5D77F]/70 font-bold text-center p-2">
                لا توجد صورة
              </div>
            )}
            <div className="mt-3 space-y-2">
              <AdminOrderPhotoQuick orderId={order.id} kind="order" hasImage={!!order.imageUrl} />
              <ImageUploaderCaption name={order.orderImageUploadedByName} />
            </div>
          </div>
        </div>
      </div>

      {(() => {
        const hasNotes = Boolean(order.summary?.trim());
        const cartItems =
          parsedShoppingJson &&
          Array.isArray(parsedShoppingJson.webStoreCart)
            ? (parsedShoppingJson.webStoreCart as any[])
            : [];
        const hasCart = cartItems.length > 0;
        if (!hasNotes && !hasCart) return null;
        return (
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
        );
      })()}

      <OrderFabDock
        storageKey="adminFab_v1"
        orderId={order.id}
        shopPhone={submitterPhone}
        customerPhone={order.customerPhone}
        customerAlternatePhone={order.alternatePhone ?? undefined}
        secondCustomerPhone={order.secondCustomerPhone ?? undefined}
        secondCustomerAlternatePhone={order.secondCustomerAlternatePhone ?? undefined}
        customWaButtons={customWaButtons}
        editUrl={`${SECRET_ADMIN_PATH}/orders/${order.id}/edit`}
        isDoubleRoute={isDoubleRoute}
      />

      {/* مودال معاينة الصور التفاعلي الأنيق الداعم للتكبير بالإصبعين والسحب */}
      {previewImageUrl && (
        <ImageZoomModal
          imageUrl={previewImageUrl}
          onClose={() => setPreviewImageUrl(null)}
        />
      )}



      {/* توست التأكيد الإيجابي الأخضر لنجاح تغيير المندوب */}
      {toastSuccess && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-[110] flex items-center gap-3 rounded-2xl bg-emerald-900 text-white px-5 py-3.5 shadow-2xl border-2 border-emerald-400 animate-in slide-in-from-top duration-300">
          <span className="text-2xl">🎉</span>
          <span className="font-black text-sm sm:text-base">{toastSuccess}</span>
          <button onClick={() => setToastSuccess(null)} className="mr-2 text-white/80 hover:text-white font-bold text-lg">✕</button>
        </div>
      )}

      {/* --- MODAL FOR CHANGING / ASSIGNING COURIER --- */}
      {showAssignCourierModal && (
        <LuxuryAssignCourierModal
          orderId={order.id}
          orderNumber={order.orderNumber}
          currentCourierId={order.courier?.id}
          currentCourierName={order.courier?.name}
          couriers={couriers}
          isPending={assignLoading}
          onAssign={async (courierId, direct) => {
            setDirectReceipt(direct);
            await handleAssignCourier(courierId);
            setShowAssignCourierModal(false);
          }}
          onClose={() => setShowAssignCourierModal(false)}
        />
      )}

    </div>

    </>
  );
}
