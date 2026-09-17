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
import { AdminLuxuryShopCard } from "./admin-luxury-shop-card";
import { AdminLuxuryCustomerCard } from "./admin-luxury-customer-card";
import { AdminLuxuryOrderInfoCard } from "./admin-luxury-order-info-card";

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
  designerConfig,
  initialCustomerDebt = null,
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
  designerConfig?: any;
  initialCustomerDebt?: number | null;
}) {
  const router = useRouter();
  const [designerConfigState, setDesignerConfigState] = useState(designerConfig);
  const [pricingOpen, setPricingOpen] = useState(false);
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
  const [previewUploadedByName, setPreviewUploadedByName] = useState<string | null>(null);
  const [isShopCardExpanded, setIsShopCardExpanded] = useState(false);
  const [isSenderExpanded, setIsSenderExpanded] = useState(false);

  // تحديث حالة التصميم إذا تغيرت الخصائص القادمة
  useEffect(() => {
    if (designerConfig) {
      setDesignerConfigState(designerConfig);
    }
  }, [designerConfig]);

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

  const [customerDebt, setCustomerDebt] = useState<number | null>(initialCustomerDebt ?? null);

  useEffect(() => {
    if (initialCustomerDebt !== null && initialCustomerDebt !== undefined) {
      setCustomerDebt(initialCustomerDebt);
    }
  }, [initialCustomerDebt]);

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
            {/* لمعة زجاجية خفيفة */}
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

        {/* --- بطاقة ترويسة الطلبية الملكية الثابتة في الأعلى (Sticky Header) --- */}
        <div className="sticky top-0 z-40 rounded-[22px] border-[1.5px] border-[#C9A86A] bg-[#FFFEFB]/95 backdrop-blur-md p-3.5 shadow-[0_8px_25px_rgba(201,168,106,0.22)] select-none mb-3.5" dir="rtl">
          {/* معينات الزوايا الذهبية الأربعة */}
          <div className="absolute top-[8px] right-[8px] w-[6px] h-[6px] rotate-45 bg-[#C9A86A] opacity-80 pointer-events-none" />
          <div className="absolute top-[8px] left-[8px] w-[6px] h-[6px] rotate-45 bg-[#C9A86A] opacity-80 pointer-events-none" />
          <div className="absolute bottom-[8px] right-[8px] w-[6px] h-[6px] rotate-45 bg-[#C9A86A] opacity-80 pointer-events-none" />
          <div className="absolute bottom-[8px] left-[8px] w-[6px] h-[6px] rotate-45 bg-[#C9A86A] opacity-80 pointer-events-none" />

          {/* السطر الأول: رقم الطلب والحالة (يمين) | الإسناد والإغلاق (يسار) */}
          <div className="flex items-center justify-between gap-2">
            {/* جهة اليمين: رقم الطلب + شارة الحالة */}
            <div className="flex items-center gap-[6px] flex-nowrap shrink-0">
              {/* صندوق رقم الطلب الذهبي */}
              <div
                className="inline-flex items-center justify-center rounded-[10px] border-[2px] border-[#C9A86A] px-[12px] shadow-[0_2px_8px_rgba(201,168,106,0.25),inset_0_1px_0_white] shrink-0"
                style={{ background: "linear-gradient(135deg, #FDF6E3 0%, #F7E9B0 100%)", height: "32px", minWidth: "64px" }}
              >
                <span className="font-mono text-[18px] font-black leading-none text-[#8B6A2A] tracking-wide [direction:ltr]">
                  #{order.orderNumber}
                </span>
              </div>

              {/* شارة حالة الطلب */}
              <div
                className="inline-flex items-center gap-1.5 px-[10px] rounded-full bg-[#FFF8E0] border border-[#E8C77E]/60 text-[#8B6A2A] font-black shadow-[inset_0_1px_0_white] shrink-0"
                style={{ whiteSpace: "nowrap", height: "30px", fontSize: "11px" }}
              >
                <div className="w-[6px] h-[6px] rounded-full bg-[#D4A017] animate-pulse shadow-[0_0_6px_#E8C77E] shrink-0" />
                <span style={{ whiteSpace: "nowrap" }}>
                  {STATUS_AR[order.status] ?? order.status}
                </span>
              </div>
            </div>

            {/* جهة اليسار: زر الإسناد + زر الإغلاق X */}
            <div className="flex items-center gap-[6px] shrink-0 flex-nowrap">
              {order.courier ? (
                <button
                  type="button"
                  id="assignBtnTop"
                  onClick={() => setShowAssignCourierModal(true)}
                  className="inline-flex items-center justify-center rounded-full border-[1.5px] border-[#C9A86A] px-[10px] text-[11px] font-black shadow-[0_2px_8px_rgba(10,61,46,0.15)] active:scale-95 shrink-0 cursor-pointer"
                  style={{ height: "28px", background: "#0A3D2E", color: "#E8C77E", whiteSpace: "nowrap" }}
                >
                  مسند: {order.courier.name}
                </button>
              ) : (
                <button
                  type="button"
                  id="assignBtnTop"
                  onClick={() => setShowAssignCourierModal(true)}
                  className="inline-flex items-center justify-center rounded-full border-[1.5px] px-[12px] text-[11px] font-black shadow-[0_2px_8px_rgba(201,168,106,0.25)] active:scale-95 shrink-0 cursor-pointer"
                  style={{ height: "28px", background: "linear-gradient(180deg, #E8C77E 0%, #C9A86A 100%)", borderColor: "#0A3D2E", color: "#0A3D2E", whiteSpace: "nowrap" }}
                >
                  إسناد
                </button>
              )}

              {/* زر الإغلاق الدائري الوردي X */}
              <Link
                href={`${SECRET_ADMIN_PATH}/orders/tracking`}
                className="w-[28px] h-[28px] rounded-full bg-white border border-[#FF8A8A]/50 flex items-center justify-center shadow-[0_1px_4px_rgba(197,48,48,0.12)] active:scale-90 shrink-0 cursor-pointer hover:bg-rose-50 transition"
                title="إغلاق عرض الطلب"
              >
                <svg className="w-[13px] h-[13px] text-[#C53030]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </Link>
            </div>
          </div>

          {/* الفاصل الأرابيسك المذهب في المنتصف */}
          <div className="relative my-[10px] flex items-center justify-center w-full">
            <div className="absolute left-0 right-0 top-1/2 h-[1px] bg-[#E8D5A3] w-full" />
            <div className="relative z-10 w-[12px] h-[12px] bg-[#FFFEFB] border border-[#E8D5A3] rotate-45 flex items-center justify-center shadow-[0_1px_3px_rgba(201,168,106,0.2)]">
              <div className="w-[4px] h-[4px] bg-[#C9A86A] rotate-45" />
            </div>
          </div>

          {/* السطر الثاني: زر التعديل + زر البصمة + التاريخ + الوقت */}
          <div className="flex items-center justify-center gap-[8px] w-full flex-nowrap">
            {/* زر تعديل الطلب */}
            <Link
              href={`${SECRET_ADMIN_PATH}/orders/${order.id}/edit`}
              className="h-[34px] rounded-full bg-white border-[1.5px] border-[#C9A86A] flex items-center justify-center gap-[5px] pl-[8px] pr-[12px] shadow-[0_2px_8px_rgba(201,168,106,0.12),inset_0_1px_0_white] active:scale-[0.97] shrink-0 hover:bg-[#FDF6E3] transition"
            >
              <span className="text-[12px] font-black text-[#0A3D2E] leading-none whitespace-nowrap">تعديل</span>
              <span
                className="w-[20px] h-[20px] rounded-full flex items-center justify-center border border-[#0A3D2E]/15 shadow-[inset_0_1px_0_rgba(255,255,255,0.7),0_1px_3px_rgba(201,168,106,0.3)] shrink-0"
                style={{ background: "linear-gradient(180deg, #F1D99A 0%, #E8C77E 50%, #C9A86A 100%)" }}
              >
                <svg className="w-[10px] h-[10px] text-[#0A3D2E]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 20h9" />
                  <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                </svg>
              </span>
            </Link>

            {/* زر البصمة الدائري الأحمر المشع */}
            <div className="shrink-0">
              <AdminVoiceNoteSection
                variant="royal_circular"
                orderId={order.id}
                defaultAdminVoiceNoteUrl={order.adminVoiceNoteUrl}
              />
            </div>

            {/* شارة التاريخ */}
            <div
              className="px-[8px] rounded-full bg-[#FFFEF8] border border-[#C9A86A]/30 text-[#3A2E1A] text-[11px] font-bold flex items-center gap-1.5 whitespace-nowrap shadow-[inset_0_1px_0_white] shrink-0"
              style={{ height: "32px" }}
            >
              <span className="text-[11px] font-mono">
                {(() => {
                  try {
                    if (!order.createdAt) return "—";
                    const d = new Date(order.createdAt);
                    return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
                  } catch {
                    return "—";
                  }
                })()}
              </span>
              <span className="w-[16px] h-[16px] rounded-full bg-[#FDF6E3] border border-[#C9A86A]/30 flex items-center justify-center shrink-0">
                <svg className="w-[10px] h-[10px] text-[#8B6A2A]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                  <line x1="16" y1="2" x2="16" y2="6" />
                  <line x1="8" y1="2" x2="8" y2="6" />
                  <line x1="3" y1="10" x2="21" y2="10" />
                </svg>
              </span>
            </div>

            {/* شارة وقت الطلب (فوري أو الدقائق) */}
            <div
              className="px-[8px] rounded-full bg-[#FFF5F5] border border-[#C9A86A]/30 text-[#C53030] text-[11px] font-black flex items-center gap-1.5 whitespace-nowrap shadow-[inset_0_1px_0_white] shrink-0"
              style={{ height: "32px" }}
            >
              <span className="font-mono text-[#C53030] text-[12px] font-black">
                {order.orderNoteTime || "فوري"}
              </span>
              <span className="w-[16px] h-[16px] rounded-full bg-white border border-[#FFB4B4]/50 flex items-center justify-center shrink-0">
                <svg className="w-[10px] h-[10px] text-[#C53030]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
              </span>
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

      <div className="mt-1.5 space-y-3 sm:space-y-4">
        
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
        
        {/* --- بطاقات الطلب الفاخرة (كارت المحل / العميل ثم كارت الزبون مباشرة شبه ملاصق ومترابط) --- */}
        <div className="flex flex-col gap-0 w-full">
          {!isDoubleRoute && (
            <AdminLuxuryShopCard
              order={order}
              submitterName={submitterName}
              submitterPhone={submitterPhone}
              imgShopDoor={imgShopDoor}
              setPreviewImageUrl={setPreviewImageUrl}
              isSystemAdminOrder={isSystemAdminOrder}
              designerConfig={designerConfigState}
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
            <div className="-mt-4 sm:-mt-5.5">
              <AdminLuxuryCustomerCard
                order={order}
                customerName={(order as any).customerName || order.customer?.name || "الزبون"}
                customerPhone={order.customerPhone}
                imgCustomerDoor={imgCustDoor}
                setPreviewImageUrl={setPreviewImageUrl}
                isDoubleRoute={isDoubleRoute}
                designerConfig={designerConfigState}
                phoneProfile={phoneProfile}
              >


                {/* أزرار اللوكيشن الملكية الثلاثة المذهبة من تحديث Meta AI (طلب لوكيشن - رفع لوكيشن - لصق لوكيشن) */}
                <div className="w-full pt-1">
                  <AdminCustomerLocationQuick
                    orderId={order.id}
                    customerPhone={order.customerPhone}
                    customerPhone2={order.customerPhone2 || undefined}
                    shopPhone={submitterPhone || undefined}
                    orderStatus={order.status}
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
                    designerConfig={designerConfigState}
                  />

                  <div className="mt-2">
                    <OtherRegionsCustomerDetails
                      phone={order.customerPhone}
                      currentRegionId={order.customerRegionId}
                      currentRegionName={order.customerRegion?.name}
                      orderId={order.id}
                      isSecondDestination={false}
                      designerConfig={designerConfigState}
                    />
                  </div>
                </div>

                {/* بلوك الاستدلال الذكي المضيء */}
                {isSmartHintValid(order.smartHintLine) && (
                  <div className="bg-gradient-to-r from-[#0F4D3A] via-[#1B4D3E] to-[#0F4D3A] border-2 border-[#C9A86A] rounded-2xl p-2.5 sm:p-3 flex items-center justify-between shadow-lg">
                    <div className="flex-1 text-right">
                      <p className="text-[10px] font-black text-[#F5D77F] flex items-center gap-1 justify-end">
                        <span>💡 الاستدلال الذكي</span>
                      </p>
                      <p className="text-xs font-black text-white mt-1">
                        {order.smartHintLine!.trim()}
                      </p>
                    </div>
                    <div className="h-9 w-9 bg-[#06281D] border border-[#C9A86A] rounded-xl flex items-center justify-center text-white font-bold text-base shadow-md shrink-0 mr-2">
                      💡
                    </div>
                  </div>
                )}
              </AdminLuxuryCustomerCard>
            </div>
          )}

          {/* كارت معلومات الطلب مدمج ومترابط مع فاصل أرابيسك مذهب */}
          {!isDoubleRoute && designerConfigState?.enabledPortals?.admin !== false && (
            <>
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
              <div className="w-full">
                <AdminLuxuryOrderInfoCard
                  order={order}
                  setPreviewImageUrl={setPreviewImageUrl}
                  designerConfig={designerConfigState || undefined}
                  hideSubtotalInfo={false}
                  isMandoubPortal={false}
                />
              </div>
            </>
          )}
        </div>

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
                            className="group relative transition-transform active:scale-95 flex items-center justify-center w-full"
                            title="موقع المستلم على الخريطة"
                          >
                            <img
                              src="/images/order-luxury/btn-open-location.webp"
                              alt="موقع المستلم على الخريطة"
                              className="h-11 sm:h-12 w-full max-w-[280px] object-contain drop-shadow-lg group-hover:scale-105 transition"
                            />
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
                            designerConfig={designerConfig}
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
                            designerConfig={designerConfig}
                          />
                        </div>
                      )}

                      <div className="mt-2">
                        <OtherRegionsCustomerDetails
                          phone={order.secondCustomerPhone || order.customerPhone}
                          currentRegionId={order.secondCustomerRegionId}
                          currentRegionName={order.secondCustomerRegion?.name}
                          orderId={order.id}
                          isSecondDestination={true}
                          designerConfig={designerConfig}
                        />
                      </div>
                    </div>

                    <div className="flex items-center gap-2 w-full">
                      {(order.secondCustomerPhone || order.customerPhone) && (
                        <div className="flex items-center gap-2 w-full">
                          <a
                            href={telHref(order.secondCustomerPhone || order.customerPhone!)}
                            className="flex-1 group relative transition-transform active:scale-95 flex items-center justify-center"
                            title="اتصال بالمستلم"
                          >
                            <img
                              src="/images/order-luxury/shop-card/btn-call.webp"
                              alt="اتصال"
                              className="h-12 sm:h-14 w-auto object-contain drop-shadow-xl group-hover:scale-105 transition"
                            />
                          </a>
                          <a
                            href={whatsappMeUrl(order.secondCustomerPhone || order.customerPhone!)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex-1 group relative transition-transform active:scale-95 flex items-center justify-center"
                            title="مراسلة المستلم واتساب"
                          >
                            <img
                              src="/images/order-luxury/shop-card/btn-whatsapp.webp"
                              alt="واتس"
                              className="h-12 sm:h-14 w-auto object-contain drop-shadow-xl group-hover:scale-105 transition"
                            />
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
                        <img
                          src={imgCustDoor2}
                          alt=""
                          className="h-full w-full object-cover cursor-zoom-in hover:scale-105 transition duration-300"
                          onClick={() => {
                            setPreviewImageUrl(imgCustDoor2);
                            setPreviewUploadedByName(order.secondCustomerDoorPhotoUploadedByName || null);
                          }}
                        />
                      </div>
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
        {/* --- تفاصيل الطلب والأسعار وصورة الطلب (في حالة الوجهتين أو التصميم القديم) --- */}
        {isDoubleRoute && designerConfig?.enabledPortals?.admin !== false ? (
          <div className="w-full mb-3 -mt-2 sm:-mt-2.5">
            <AdminLuxuryOrderInfoCard
              order={order}
              setPreviewImageUrl={setPreviewImageUrl}
              designerConfig={designerConfig || undefined}
              hideSubtotalInfo={false}
              isMandoubPortal={false}
            />
          </div>
        ) : designerConfig?.enabledPortals?.admin === false ? (
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
                  <img
                    src={imgOrder}
                    alt=""
                    className="h-full w-full object-contain cursor-zoom-in hover:scale-105 transition duration-300"
                    onClick={() => {
                      setPreviewImageUrl(imgOrder);
                      setPreviewUploadedByName(order.orderImageUploadedByName || null);
                    }}
                  />
                </div>
              ) : (
                <div className="aspect-square w-full flex items-center justify-center bg-[#06281D]/80 rounded-2xl border-2 border-dashed border-[#C9A86A]/50 text-xs text-[#F5D77F]/70 font-bold text-center p-2">
                  لا توجد صورة
                </div>
              )}
              <div className="mt-3 space-y-2">
                <AdminOrderPhotoQuick orderId={order.id} kind="order" hasImage={!!order.imageUrl} />
              </div>
            </div>
          </div>
        ) : null}
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
          uploadedByName={previewUploadedByName}
          onClose={() => {
            setPreviewImageUrl(null);
            setPreviewUploadedByName(null);
          }}
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
