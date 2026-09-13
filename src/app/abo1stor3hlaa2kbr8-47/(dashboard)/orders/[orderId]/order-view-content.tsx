"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ImageZoomModal } from "@/components/pinch-zoom-image";
import { ad } from "@/lib/admin-ui";
import { InlineLandmarkEditor } from "@/components/inline-landmark-editor";
import { OtherRegionsCustomerDetails } from "@/components/other-regions-customer-details";
import { quickAssignOrderCourier } from "../actions";

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
      <div className={`kse-glass-dark relative mt-4 border p-4 pb-24 text-base leading-relaxed sm:p-5 sm:pb-32 ${orderStatusStartStripeClass(order.status)} ${order.prepaidAll ? "border-emerald-300 bg-gradient-to-b from-emerald-50 to-teal-50" : isReversePickup ? "border-violet-400 bg-violet-100" : isDoubleRoute ? "border-fuchsia-300 bg-gradient-to-b from-fuchsia-50 to-violet-50" : `border-sky-200 ${orderStatusDetailSurfaceClass(order.status)}`}`} dir="rtl">

        {/* --- بلوك كلشي واصل المشع والمتحرك (RGB) --- */}
        {order.prepaidAll && (
          <div className="relative mb-4 overflow-hidden rounded-2xl p-5 shadow-xl text-white prepaid-rgb-block">
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
          <div className="mb-4 rounded-2xl border-4 border-amber-500 bg-amber-50 p-4 text-right shadow-md animate-pulse">
            <p className="text-base font-black text-amber-900 flex items-center gap-2">
              <span>⚠️ تنبيه مالي للزبون:</span>
              نطلب هذا الزبون مبلغاً معلقاً بذمته وقدره: ({formatDinarAsAlfWithUnit(customerDebt)}) في دفتر الديون.
            </p>
          </div>
        )}

        {order.isBlocked && (
          <div
            className="mb-4 animate-pulse rounded-2xl border-4 border-red-600 bg-red-100 p-4 text-center text-xl font-black text-red-900 shadow-xl"
            role="alert"
          >
            🛑 تنبيه: هذا الزبون محظور من التوصيل (Blocklist)
          </div>
        )}

        {/* --- بطاقة ترويسة الطلبية المختصرة والمدمجة --- */}
        <div className="mb-4 rounded-2xl border border-sky-200 bg-white/95 p-3 shadow-sm sm:p-4 backdrop-blur-sm">
          
          {/* سطر الأزرار العلوية الأربعة: إغلاق - تعديل - تغيير المندوب - بصمة المدير */}
          <div className="mb-3.5 grid grid-cols-4 gap-1 sm:gap-2">
            <Link
              href={`${SECRET_ADMIN_PATH}/orders/tracking`}
              className="inline-flex items-center justify-center gap-1 rounded-xl bg-slate-800 hover:bg-slate-900 active:scale-95 px-1.5 py-2 text-xs font-bold text-white shadow-sm transition-all min-h-[40px] text-center"
            >
              <span>⬅️</span>
              <span>إغلاق</span>
            </Link>

            <Link
              href={`${SECRET_ADMIN_PATH}/orders/${order.id}/edit`}
              className="inline-flex items-center justify-center gap-1 rounded-xl bg-sky-600 hover:bg-sky-700 active:scale-95 px-1.5 py-2 text-xs font-bold text-white shadow-sm transition-all min-h-[40px] text-center"
            >
              <span>📝</span>
              <span>تعديل</span>
            </Link>

            {order.status !== "cancelled" && order.status !== "archived" ? (
              <button
                type="button"
                onClick={() => setShowAssignCourierModal(true)}
                className="inline-flex items-center justify-center gap-1 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 px-1.5 py-2 text-xs font-bold text-white shadow-sm transition-all cursor-pointer min-h-[40px] text-center"
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
            <div className="mb-3">
              <Link
                href={`${SECRET_ADMIN_PATH}/orders/${order.id}/price`}
                className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 active:scale-95 px-3 py-1.5 text-xs font-bold text-white shadow-sm transition-all"
              >
                <span>💰</span>
                <span>تعديل التسعير</span>
              </Link>
            </div>
          )}

          {/* السطر الثاني: رقم الطلب + اسم المندوب + حالة الطلب + الشارات الخاصة */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-sky-100 pt-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-block rounded-xl bg-sky-600 px-3 py-1 text-base sm:text-lg font-black text-white tabular-nums shadow-sm">
                #{order.orderNumber}
              </span>

              {order.courier ? (
                <span className="inline-flex items-center gap-1 rounded-xl border border-emerald-300 bg-emerald-100 px-2.5 py-1 text-xs font-black text-emerald-900">
                  <span>🛵</span>
                  <span>{order.courier.name}</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600">
                  <span>🛵</span>
                  <span>غير مسند</span>
                </span>
              )}
              
              {isReversePickup && (
                <span className="rounded-xl border border-violet-300 bg-violet-100 px-2 py-0.5 text-xs font-black text-violet-900">
                  🔄 طلب عكسي
                </span>
              )}
              {isDoubleRoute && (
                <span className="rounded-xl border border-fuchsia-300 bg-fuchsia-100 px-2 py-0.5 text-xs font-black text-fuchsia-900">
                  ✌️ وجهتين
                </span>
              )}
              {order.prepaidAll && (
                <span className="rounded-xl border border-emerald-400 bg-emerald-600 text-white px-2.5 py-0.5 text-xs font-black shadow-sm animate-pulse">
                  ✓ كلشي واصل
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <span className={`rounded-full px-3.5 py-1 text-xs sm:text-sm font-black shadow-sm ${statusBadgeClass}`}>
                {STATUS_AR[order.status] ?? order.status}
              </span>
            </div>
          </div>

          {/* سطر التواريخ والأوقات المدمج إجبارياً في سطر واحد ممتد (Single Line Row) */}
          <div className="mt-2.5 flex items-center justify-between gap-1.5 rounded-xl border border-sky-100 bg-sky-50/80 p-2 text-[11px] sm:text-xs font-bold text-slate-800 whitespace-nowrap overflow-x-auto">
            <div className="flex items-center gap-1 shrink-0">
              <span>📅</span>
              <span className="text-sky-800 font-extrabold">رفع:</span>
              <span className="font-mono text-slate-900 [direction:ltr]">{formatBaghdadDateTime(new Date(order.createdAt))}</span>
            </div>

            <div className="h-3.5 w-px bg-sky-300 shrink-0" />

            <div className="flex items-center gap-1 shrink-0">
              <span>⏰</span>
              <span className="text-rose-800 font-extrabold">وقت الاستلام:</span>
              <span className="text-slate-900 font-black">{order.orderNoteTime || "فوري"}</span>
            </div>
          </div>

        </div>

        {/* بصمات الصوت المسجلة إن وجدت */}
        {(voiceSrc || adminVoiceSrc) && (
          <div className="mb-4 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            {voiceSrc && (
              <div className="rounded-xl border border-amber-200 bg-white p-3 shadow-sm">
                <div className="mb-1.5 flex items-center justify-between">
                  <span className="text-xs font-black text-amber-700 flex items-center gap-1"><span>🗣️</span> بصمة الزبون (المحل)</span>
                </div>
                <VoiceNoteAudio src={voiceSrc} streamKey={`${order.id}-voice`} className="w-full" />
              </div>
            )}
            {adminVoiceSrc && (
              <div className="rounded-xl border border-rose-200 bg-white p-3 shadow-sm">
                <div className="mb-1.5 flex items-center justify-between">
                  <span className="text-xs font-black text-rose-700 flex items-center gap-1"><span>🎧</span> بصمة المدير (المسجلة)</span>
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
        
        {/* --- بطاقة المحل (المرسل) - مطابقة طبق الأصل للمندوب --- */}
        {!isDoubleRoute && (
          <div className="bg-gradient-to-br from-amber-50/70 via-white to-slate-50/80 dark:from-amber-950/30 dark:via-slate-900 dark:to-slate-900 backdrop-blur-md rounded-[2rem] border-2 border-amber-500/80 dark:border-amber-500/70 border-r-[8px] border-r-amber-500 shadow-xl shadow-amber-500/10 ring-1 ring-amber-500/20 p-4 relative overflow-hidden transition-all duration-300 hover:shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-white/5 pb-2 mb-3">
              <div className="flex-1">
                <button
                  type="button"
                  onClick={() => setIsShopCardExpanded(!isShopCardExpanded)}
                  className="inline-flex items-center gap-1 bg-amber-100 hover:bg-amber-200 dark:bg-amber-950/60 dark:hover:bg-amber-900/60 border border-amber-300 dark:border-amber-700 text-[11px] font-black text-amber-900 dark:text-amber-200 px-2.5 py-1 rounded-xl shadow-xs transition"
                >
                  <span>{isShopCardExpanded ? "⬆️ طي تفاصيل المحل" : "🔽 تفاصيل المحل (المرسل)"}</span>
                </button>
              </div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-black text-amber-800 dark:text-amber-400">
                  المحل (المرسل)
                </h3>
                <div className="h-8 w-8 rounded-lg bg-amber-50 dark:bg-amber-950/30 flex items-center justify-center text-amber-600">
                  🏢
                </div>
              </div>
            </div>

            <div className="flex flex-row gap-4 items-start justify-between">
              <div className="flex-1 space-y-2 text-right">
                <div className="space-y-2 text-xs">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-bold text-slate-400 text-sm" title="اسم المحل">🏢</span>
                    <span className="font-black text-slate-900 dark:text-white">{order.shop?.name || "المحل"}</span>
                  </div>

                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-bold text-slate-400 text-sm" title="العميل / المسؤول">👤</span>
                    <span className="font-black text-sky-900 dark:text-sky-400">{submitterName}</span>
                  </div>

                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-bold text-slate-400 text-sm" title="منطقة المحل">📍</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200">{order.shop?.region?.name || "—"}</span>
                  </div>

                  {submitterPhone && (
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-slate-400 text-sm" title="هاتف المسؤول">📞</span>
                      <span className="font-mono font-black text-slate-700 dark:text-slate-300">{contactLine(submitterPhone)}</span>
                    </div>
                  )}
                </div>

                <div className="pt-1.5 space-y-2 w-full">
                  {order.shopLocationUrl?.trim() ? (
                    <a
                      href={order.shopLocationUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex min-h-[44px] sm:min-h-[48px] w-full items-center justify-center rounded-xl bg-emerald-600 hover:bg-emerald-700 px-4 text-xs sm:text-sm font-black text-white active:scale-95 transition-all gap-1.5 shadow-md"
                    >
                      📍 موقع المحل ↗
                    </a>
                  ) : (
                    <div className="w-full p-1.5 bg-amber-50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/30 rounded-xl text-center text-[10px] font-bold text-amber-800">
                      ⚠️ لا يوجد موقع جغرافي للمحل
                    </div>
                  )}

                  {submitterPhone && (
                    <div className="flex items-center gap-2 w-full">
                      <a
                        href={telHref(submitterPhone)}
                        className="flex-1 inline-flex min-h-[38px] items-center justify-center rounded-xl bg-sky-600 hover:bg-sky-700 px-2 py-1.5 text-xs sm:text-sm font-black text-white active:scale-95 transition-all gap-1.5 shadow-sm"
                      >
                        اتصال
                      </a>
                      <a
                        href={whatsappMeUrl(submitterPhone)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 inline-flex min-h-[38px] items-center justify-center rounded-xl bg-emerald-600 hover:bg-emerald-700 px-2 py-1.5 text-xs sm:text-sm font-black text-white active:scale-95 transition-all gap-1.5 shadow-sm"
                      >
                        واتس
                      </a>
                    </div>
                  )}
                </div>
              </div>

              {/* صورة المحل / الباب */}
              <div className="w-[170px] xs:w-[195px] sm:w-[240px] md:w-[270px] flex flex-col items-center justify-start shrink-0 self-start gap-2">
                <span className="text-xs font-black text-slate-500 dark:text-slate-400">صورة المحل</span>
                {imgShopDoor ? (
                  <div className="w-full flex flex-col items-center gap-1">
                    <div className="aspect-square w-full overflow-hidden rounded-2xl border-2 border-amber-500/80 dark:border-amber-400/80 shadow-md shadow-amber-500/10">
                      <img src={imgShopDoor} alt="" className="h-full w-full object-cover cursor-zoom-in hover:scale-105 transition duration-300" onClick={() => setPreviewImageUrl(imgShopDoor)} />
                    </div>
                    {order.shopDoorPhotoUploadedByName?.trim() ? (
                      <div className="mt-0.5"><ImageUploaderCaption name={order.shopDoorPhotoUploadedByName} /></div>
                    ) : null}
                  </div>
                ) : (
                  <div className="aspect-square w-full flex items-center justify-center bg-slate-100 dark:bg-slate-800 rounded-2xl border-2 border-dashed border-slate-300 dark:border-slate-700 text-xs text-slate-400 font-bold text-center p-2">
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
              className="bg-emerald-50/90 dark:bg-emerald-950/40 border-2 border-emerald-500 rounded-[1.5rem] p-3.5 shadow-md flex items-center justify-between cursor-pointer hover:bg-emerald-100/90 transition-all mb-3 active:scale-[0.99]"
            >
              <div className="flex items-center gap-2.5">
                <span className="h-9 w-9 rounded-full bg-emerald-600 text-white flex items-center justify-center font-black text-sm shadow-sm">✓</span>
                <div>
                  <h4 className="text-sm font-black text-emerald-950 dark:text-emerald-200">
                    المرسل (الوجهة الأولى) - تم الاستلام بنجاح ✅
                  </h4>
                  <p className="text-xs font-bold text-emerald-800 dark:text-emerald-300">
                    📍 {order.customerRegion?.name || "منطقة المرسل"} {order.customerPhone ? `| 📞 ${contactLine(order.customerPhone)}` : ""}
                  </p>
                </div>
              </div>
              <button type="button" className="px-3.5 py-1.5 bg-white dark:bg-slate-800 rounded-xl text-xs font-black text-emerald-800 dark:text-emerald-300 shadow-sm border border-emerald-200 dark:border-emerald-700">
                عرض التفاصيل 🔽
              </button>
            </div>
          )}

          {!shouldCollapseSender && (
            <div className="bg-gradient-to-br from-emerald-50/70 via-white to-slate-50/80 dark:from-emerald-950/30 dark:via-slate-900 dark:to-slate-900 backdrop-blur-md rounded-[2rem] border-2 border-emerald-500/80 dark:border-emerald-500/70 border-r-[8px] border-r-emerald-500 shadow-xl shadow-emerald-500/10 ring-1 ring-emerald-500/20 p-4 relative overflow-hidden transition-all duration-300 hover:shadow-2xl">
              {isSenderPickedUp && (
                <div className="flex justify-end mb-2">
                  <button
                    type="button"
                    onClick={() => setIsSenderExpanded(false)}
                    className="px-3 py-1 bg-emerald-100 dark:bg-emerald-950 text-emerald-900 dark:text-emerald-200 rounded-xl text-xs font-black shadow-xs border border-emerald-200"
                  >
                    طوي بطاقة المرسل 🔼
                  </button>
                </div>
              )}

              <div className="flex flex-row gap-4 items-start justify-between">
                <div className="flex-1 space-y-2 text-right">
                  <div className="flex items-center gap-2 border-b border-slate-100 dark:border-white/5 pb-2">
                    <div className="h-8 w-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 flex items-center justify-center text-emerald-600">
                      👤
                    </div>
                    <div>
                      <h3 className="text-sm font-black text-emerald-950 dark:text-emerald-400">
                        {isDoubleRoute ? "المرسل (الوجهة الأولى)" : "الزبون (المستلم)"}
                      </h3>
                    </div>
                  </div>

                  <div className="space-y-2 text-xs">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-bold text-slate-400 text-sm" title="منطقة الزبون">📍</span>
                      <span className="font-black text-slate-900 dark:text-white">{order.customerRegion?.name ?? "—"}</span>
                    </div>

                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-bold text-slate-400 text-sm" title="رقم الزبون">📞</span>
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
                        <span className="font-mono font-black text-slate-400">—</span>
                      )}
                    </div>

                    {order.alternatePhone && (
                      <div className="flex items-center gap-1.5 bg-amber-50 dark:bg-amber-950/20 px-2 py-0.5 rounded border border-amber-100 dark:border-amber-900/30 w-fit">
                        <span className="font-bold text-amber-600 text-[10px]">رقم بديل / أرشيف:</span>
                        <span className="font-mono font-black text-amber-900 dark:text-amber-100 ml-1">{order.alternatePhone}</span>
                      </div>
                    )}
                  </div>

                  <div className="pt-1.5">
                    <div className="flex flex-col items-start gap-1">
                      <div className="flex flex-wrap items-center gap-2">
                        {order.customerLocationUrl?.trim() ? (
                          <div className="flex flex-wrap items-center gap-2">
                            <a
                              href={order.customerLocationUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex min-h-[44px] sm:min-h-[48px] items-center justify-center rounded-xl bg-emerald-600 hover:bg-emerald-700 px-4 text-xs sm:text-sm font-black text-white active:scale-95 transition-all gap-1.5 shadow-md"
                            >
                              📍 موقع الزبون ↗
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
                          <div className="flex flex-wrap items-center gap-2">
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
                        <div className="flex items-center gap-2 w-full mt-2">
                          <a
                            href={telHref(order.customerPhone)}
                            className="flex-1 inline-flex min-h-[38px] items-center justify-center rounded-xl bg-sky-600 hover:bg-sky-700 px-2 py-1.5 text-xs sm:text-sm font-black text-white active:scale-95 transition-all gap-1.5 shadow-sm"
                          >
                            اتصال
                          </a>
                          <a
                            href={whatsappMeUrl(order.customerPhone)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex-1 inline-flex min-h-[38px] items-center justify-center rounded-xl bg-emerald-600 hover:bg-emerald-700 px-2 py-1.5 text-xs sm:text-sm font-black text-white active:scale-95 transition-all gap-1.5 shadow-sm"
                          >
                            واتس
                          </a>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* صورة باب الزبون */}
                <div className="w-[170px] xs:w-[195px] sm:w-[240px] md:w-[270px] flex flex-col items-center justify-start shrink-0 self-start gap-2">
                  <span className="text-xs font-black text-slate-500 dark:text-slate-400">صورة الباب</span>
                  {imgCustDoor ? (
                    <div className="w-full flex flex-col items-center gap-1">
                      <div className="aspect-square w-full overflow-hidden rounded-2xl border-2 border-emerald-500/80 dark:border-emerald-400/80 shadow-md shadow-emerald-500/10">
                        <img src={imgCustDoor} alt="" className="h-full w-full object-cover cursor-zoom-in hover:scale-105 transition duration-300" onClick={() => setPreviewImageUrl(imgCustDoor)} />
                      </div>
                      {order.customerDoorPhotoUploadedByName?.trim() ? (
                        <div className="mt-0.5"><ImageUploaderCaption name={order.customerDoorPhotoUploadedByName} /></div>
                      ) : null}
                    </div>
                  ) : (
                    <div className="aspect-square w-full flex items-center justify-center bg-white dark:bg-slate-800 rounded-2xl border-2 border-dashed border-slate-300 dark:border-slate-700 text-xs text-slate-400 font-bold text-center p-2">
                      لا توجد صورة
                    </div>
                  )}
                  <div className="w-full">
                    <CustomerDoorPhotoQuick orderId={order.id} hasImage={!!order.customerDoorPhotoUrl} />
                  </div>
                </div>
              </div>

              <div className="mt-3 space-y-2">
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
                  <div className="mt-3 bg-gradient-to-r from-emerald-50 via-teal-50 to-emerald-100 dark:from-emerald-950/50 dark:to-teal-950/40 border-2 border-emerald-300 dark:border-emerald-700/70 rounded-2xl p-3 flex items-center justify-between shadow-sm">
                    <div className="flex-1 text-right">
                      <p className="text-[10px] font-black text-emerald-800 dark:text-emerald-300 flex items-center gap-1 justify-end">
                        <span>💡 الاستدلال الذكي</span>
                      </p>
                      <p className="text-xs font-black text-emerald-950 dark:text-emerald-100 mt-1">
                        {order.smartHintLine!.trim()}
                      </p>
                    </div>
                    <div className="h-10 w-10 bg-emerald-600 rounded-xl flex items-center justify-center text-white font-bold text-lg shadow-md shrink-0 mr-2">
                      💡
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* --- بطاقة المستلم (الوجهة الثانية) في حالة الطلب ذو الوجهتين --- */}
          {order.routeMode === "double" && (
            <div className="bg-gradient-to-br from-violet-50/70 via-white to-slate-50/80 dark:from-violet-950/30 dark:via-slate-900 dark:to-slate-900 backdrop-blur-md rounded-[2rem] border-2 border-violet-500/80 dark:border-violet-500/70 border-r-[8px] border-r-violet-500 shadow-xl shadow-violet-500/10 ring-1 ring-violet-500/20 p-4 relative overflow-hidden transition-all duration-300 hover:shadow-2xl mt-3">
              <div className="flex flex-row gap-4 items-start justify-between">
                <div className="flex-1 space-y-2 text-right">
                  <div className="flex items-center gap-2 border-b border-slate-100 dark:border-white/5 pb-2">
                    <div className="h-8 w-8 rounded-lg bg-violet-50 dark:bg-violet-950/30 flex items-center justify-center text-violet-600">
                      👥
                    </div>
                    <div>
                      <h3 className="text-sm font-black text-violet-850 dark:text-violet-400">
                        المستلم (الوجهة الثانية)
                      </h3>
                    </div>
                  </div>

                  <div className="space-y-2 text-xs">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-bold text-slate-400 text-sm" title="منطقة المستلم">📍</span>
                      <span className="font-black text-slate-900 dark:text-white">{order.secondCustomerRegion?.name ?? "—"}</span>
                    </div>

                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-bold text-slate-400 text-sm" title="هاتف المستلم">📞</span>
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
                        <span className="font-mono font-black text-slate-400">—</span>
                      )}
                    </div>

                    {order.secondCustomerAlternatePhone && (
                      <div className="flex items-center gap-1.5 bg-amber-50 dark:bg-amber-950/20 px-2 py-0.5 rounded border border-amber-100 dark:border-amber-900/30 w-fit">
                        <span className="font-bold text-amber-600 text-[10px]">رقم بديل / أرشيف:</span>
                        <span className="font-mono font-black text-amber-900 dark:text-amber-100 ml-1">{order.secondCustomerAlternatePhone}</span>
                      </div>
                    )}
                  </div>

                  <div className="pt-1.5">
                    <div className="max-w-full">
                      {order.secondCustomerLocationUrl?.trim() ? (
                        <div className="flex flex-wrap items-center gap-2">
                          <a
                            href={order.secondCustomerLocationUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex min-h-[44px] sm:min-h-[48px] items-center justify-center rounded-xl bg-emerald-600 px-4 text-xs sm:text-sm font-black text-white hover:bg-emerald-700 active:scale-95 transition-all gap-1.5 shadow-md"
                          >
                            📍 موقع المستلم ↗
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
                        <div className="flex flex-wrap items-center gap-2">
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
                            className="flex-1 inline-flex min-h-[38px] items-center justify-center rounded-xl bg-sky-600 hover:bg-sky-700 px-2 py-1.5 text-xs sm:text-sm font-black text-white active:scale-95 transition-all gap-1.5 shadow-sm"
                          >
                            اتصال
                          </a>
                          <a
                            href={whatsappMeUrl(order.secondCustomerPhone || order.customerPhone)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex-1 inline-flex min-h-[38px] items-center justify-center rounded-xl bg-emerald-600 hover:bg-emerald-700 px-2 py-1.5 text-xs sm:text-sm font-black text-white active:scale-95 transition-all gap-1.5 shadow-sm"
                          >
                            واتس
                          </a>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* صورة باب المستلم */}
                <div className="w-[170px] xs:w-[195px] sm:w-[240px] md:w-[270px] flex flex-col items-center justify-start shrink-0 self-start gap-2">
                  <span className="text-xs font-black text-slate-500 dark:text-slate-400">صورة باب المستلم</span>
                  {imgCustDoor2 ? (
                    <div className="w-full flex flex-col items-center gap-1">
                      <div className="aspect-square w-full overflow-hidden rounded-2xl border-2 border-violet-500/80 dark:border-violet-400/80 shadow-md shadow-violet-500/10 relative">
                        <img src={imgCustDoor2} alt="" className="h-full w-full object-cover cursor-zoom-in hover:scale-105 transition duration-300" onClick={() => setPreviewImageUrl(imgCustDoor2)} />
                      </div>
                      {order.secondCustomerDoorPhotoUploadedByName?.trim() ? (
                        <div className="mt-0.5"><ImageUploaderCaption name={order.secondCustomerDoorPhotoUploadedByName} /></div>
                      ) : null}
                    </div>
                  ) : (
                    <div className="aspect-square w-full flex items-center justify-center bg-white dark:bg-slate-800 rounded-2xl border-2 border-dashed border-slate-300 dark:border-slate-700 text-xs text-slate-400 font-bold text-center p-2">
                      لا توجد صورة
                    </div>
                  )}
                  <div className="w-full">
                    <CustomerDoorPhotoQuick orderId={order.id} hasImage={!!order.secondCustomerDoorPhotoUrl} isSecondCustomer />
                  </div>
                </div>
              </div>

              <div className="mt-3 space-y-2">
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
                  <div className="flex flex-row items-center gap-1.5 rounded-lg bg-violet-50/50 dark:bg-violet-950/10 p-1.5 border border-violet-100/50 dark:border-violet-900/20">
                    <span className="text-[11px] font-black text-violet-800 dark:text-violet-300">
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
          <div className="space-y-3 rounded-2xl border border-sky-200/80 bg-sky-50/40 p-3.5 shadow-sm">
            {/* نوع الطلب */}
            <div className="flex items-center justify-between gap-2 border-b border-sky-100/80 pb-2">
              <span className="text-xs sm:text-sm font-bold text-slate-700 whitespace-nowrap">الطلب:</span>
              <div className="text-left font-black text-slate-900 text-xs sm:text-sm">
                <OrderTypeDetailBlock orderType={order.orderType} prefixClassName="font-black text-violet-950 bg-violet-100 px-2 py-0.5 rounded-lg text-xs sm:text-sm ring-1 ring-violet-300 inline-block ml-1" restClassName="text-xs sm:text-sm font-black text-slate-900" />
              </div>
            </div>

            {/* وقت الطلب */}
            <div className="flex items-center justify-between gap-2 border-b border-sky-100/80 pb-2">
              <span className="text-xs sm:text-sm font-bold text-slate-700">الوقت:</span>
              <span className="text-xs sm:text-sm font-black text-indigo-700 bg-indigo-50 px-2.5 py-0.5 rounded-lg border border-indigo-200">
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
                <div className="space-y-2 pt-0.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs sm:text-sm font-bold text-blue-900">سعر البضاعة:</span>
                    <span className="font-mono text-base font-black text-blue-700 bg-blue-50 px-2.5 py-0.5 rounded-lg border border-blue-200/80">{order.orderSubtotal || "0"}</span>
                  </div>

                  {hasDebt && (
                    <div className="flex items-center justify-between gap-2 rounded-xl border border-rose-200 bg-rose-50 px-2.5 py-1">
                      <span className="text-xs font-black text-rose-600">الدين:</span>
                      <span className="font-mono text-base font-black text-rose-700 animate-pulse">{calculatedDebt}</span>
                    </div>
                  )}

                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs sm:text-sm font-bold text-amber-900">التوصيل:</span>
                    <span className="font-mono text-base font-black text-amber-800 bg-amber-50 px-2.5 py-0.5 rounded-lg border border-amber-200/80">{order.deliveryPrice || "0"}</span>
                  </div>
                </div>
              );
            })()}

            {/* المبلغ الكلي أو كلشي واصل */}
            <div className={`rounded-xl border-2 p-2.5 shadow-sm flex items-center justify-between gap-2 mt-2 ${order.prepaidAll ? "border-emerald-400 bg-emerald-50 text-emerald-950" : "border-violet-500/30 bg-violet-500/10 text-violet-950"}`}>
              <span className="text-xs sm:text-sm font-black">
                {order.prepaidAll ? "حالة الدفع:" : "المبلغ الكلي:"}
              </span>
              <span className="font-mono text-xl sm:text-2xl font-black tabular-nums">
                {order.prepaidAll ? (
                  <span className="text-emerald-700 font-black animate-pulse">كل شي واصل ✓</span>
                ) : (
                  order.totalAmount || "—"
                )}
              </span>
            </div>
          </div>

          <div className="self-start">
            <p className="mb-1.5 text-sm font-bold text-slate-700">صورة الطلبية</p>
            {imgOrder ? <div className={squarePhotoFrame}><img src={imgOrder} alt="" className={`${squarePhotoContain} cursor-zoom-in hover:scale-105 transition duration-300`} onClick={() => setPreviewImageUrl(imgOrder)} /></div> : <div className="aspect-square border-dashed border-2 flex items-center justify-center rounded-xl text-xs text-slate-400">لا توجد صورة</div>}
            <div className="mt-2 space-y-2">
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
          <div className="mt-6 border-t border-sky-100 pt-5">
            <p className="text-xs font-black text-slate-400 mb-2 uppercase tracking-widest">قائمة المواد والملاحظات</p>

            {hasCart && (
              <div className="mb-4 space-y-2">
                <p className="text-[10px] font-black text-amber-600 bg-amber-50 px-2 py-1 rounded border border-amber-100 w-fit">تفاصيل السلة (المتجر)</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {cartItems.map((item: any, idx: number) => (
                    <div key={idx} className="flex justify-between items-center p-3 rounded-xl border border-slate-100 bg-white shadow-sm">
                      <div className="flex flex-col">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-black text-slate-900">{item.name} ×{item.quantity}</span>
                          {item.quantity > 1 && (
                            <span className="text-xs font-black text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-300 animate-pulse">
                              ×{item.quantity}
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] font-bold text-slate-500">{item.price?.toLocaleString()} د.ع × {item.quantity}</span>
                      </div>
                      <span className="text-sm font-mono font-black text-violet-600">{(item.price * item.quantity).toLocaleString()} د.ع</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {hasNotes && (
              <ClickableNotesCard text={order.summary ?? ""}>
                <div className="whitespace-pre-wrap p-4 pt-9 text-sm font-bold text-slate-800 leading-relaxed">
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
        <div className="fixed inset-0 z-[100] flex items-start justify-center pt-4 sm:pt-12 p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto animate-in fade-in duration-200">
          <div className="w-full max-w-md rounded-3xl bg-white p-5 sm:p-6 shadow-2xl ring-1 ring-slate-200 animate-in zoom-in-95 duration-200 my-auto sm:my-0">
            <div className="mb-4 flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-xl font-black text-slate-900">
                  {order.courier ? "🔄 تغيير المندوب للطلب" : "📦 إسناد الطلب للمندوب"}
                </h3>
                <p className="text-sm font-bold text-slate-500">الطلب #{order.orderNumber}</p>
              </div>
              <button
                onClick={() => setShowAssignCourierModal(false)}
                className="h-10 w-10 rounded-full bg-slate-100 text-xl font-bold text-slate-500 hover:bg-slate-200 transition-colors"
              >
                ✕
              </button>
            </div>

            <div className="mb-4 flex items-center gap-2.5 rounded-2xl border border-emerald-200 bg-emerald-50 p-3.5">
              <input
                type="checkbox"
                id="direct-receipt-check-modal"
                checked={directReceipt}
                onChange={(e) => setDirectReceipt(e.target.checked)}
                className="h-5 w-5 rounded border-emerald-400 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
              />
              <label htmlFor="direct-receipt-check-modal" className="text-sm font-black text-emerald-950 cursor-pointer select-none">
                استلام مباشر للمندوب (تخطي الموافقة) ⚡
              </label>
            </div>

            <div className="max-h-[50vh] space-y-2 overflow-y-auto pr-1">
              {order.courier && (
                <button
                  disabled={assignLoading}
                  onClick={() => handleAssignCourier(null)}
                  className="w-full flex items-center justify-between rounded-2xl border-2 border-rose-200 bg-rose-50/70 p-3 text-rose-950 hover:bg-rose-100 transition-colors font-bold text-sm"
                >
                  <span>🚫 إلغاء إسناد المندوب (حذف المندوب الحالي)</span>
                  {assignLoading && selectedCourierId === null && <span className="animate-spin">⏳</span>}
                </button>
              )}

              {couriers && couriers.length > 0 ? (
                couriers.map((c) => {
                  const isCurrent = order.courier?.name === c.name;
                  return (
                    <button
                      key={c.id}
                      disabled={assignLoading}
                      onClick={() => handleAssignCourier(c.id)}
                      className={`w-full flex items-center justify-between rounded-2xl border-2 p-3.5 text-right transition-all font-bold cursor-pointer ${
                        isCurrent
                          ? "border-emerald-500 bg-emerald-50 text-emerald-950 ring-2 ring-emerald-300"
                          : "border-slate-200 bg-slate-50/70 text-slate-800 hover:border-sky-400 hover:bg-sky-50/80"
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <span className="text-xl">{isCurrent ? "✅" : "🚚"}</span>
                        <div>
                          <p className="font-black text-base text-slate-900">{c.name}</p>
                          {c.phone && <p className="text-xs text-slate-500 font-mono [direction:ltr]">{c.phone}</p>}
                        </div>
                      </div>
                      {isCurrent ? (
                        <span className="text-xs font-black text-emerald-700 bg-emerald-200/80 px-2.5 py-1 rounded-lg">المسند حالياً</span>
                      ) : (
                        assignLoading && selectedCourierId === c.id ? (
                          <span className="animate-spin text-sky-600 text-lg">⏳</span>
                        ) : (
                          <span className="text-xs text-sky-700 bg-white border border-sky-200 px-2.5 py-1 rounded-lg">اختيار 👈</span>
                        )
                      )}
                    </button>
                  );
                })
              ) : (
                <p className="text-center py-4 text-sm font-bold text-slate-500">لا يوجد مندوبون متاحون حالياً.</p>
              )}
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => setShowAssignCourierModal(false)}
                className="rounded-xl bg-slate-200 px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-300 transition-colors"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}

    </div>

    </>
  );
}
