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
import { OrderTypeDetailBlock } from "@/components/order-type-line";
import { isReversePickupOrderType } from "@/lib/order-type-flags";
import { formatBaghdadDateTime } from "@/lib/baghdad-time";
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
import { AdminCustomerOrderHistory } from "./admin-customer-order-history";
import { OrderFabDock } from "@/components/order-fab-dock";
import { ClickableNotesCard } from "@/components/clickable-notes-card";
import { AdminPricingPanel } from "../pending/pending-orders-client";
import { isAdminShopName } from "@/lib/admin-order-from-admin-constants";
import { formatDinarAsAlfWithUnit } from "@/lib/money-alf";

const squarePhotoFrame = "aspect-square w-full overflow-hidden rounded-xl border border-sky-200 bg-slate-50";
const squarePhotoImg = "h-full w-full object-cover";
const squarePhotoContain = "h-full w-full object-contain";
const gridInfoPhoto = "grid grid-cols-[minmax(0,1fr)_minmax(0,12rem)] items-start gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.32fr)] sm:gap-6";
const compactPhoneText = "font-mono text-base font-black text-emerald-900 tabular-nums sm:text-lg [direction:ltr] break-all";

const STATUS_AR: Record<string, string> = {
  pending: "قيد الانتظار", assigned: "مسند للمندوب", delivering: "قيد التوصيل",
  delivered: "تم التسليم", cancelled: "ملغى", archived: "مؤرشف",
};

const SYSTEM_ADMIN_PHONE = "07733921568";

/** بيانات JSON للتسعير/المتجر — قد تكون نصاً غير صالح أو شكلاً غير متوقع بعد التخزين */
function parsePreparerShoppingJson(raw: unknown): Record<string, unknown> | null {
  if (raw == null) return null;
  if (Array.isArray(raw)) return { products: raw } as Record<string, unknown>;
  if (typeof raw === "object") return raw as Record<string, unknown>;
  if (typeof raw === "string") {
    const t = raw.trim();
    if (!t) return null;
    try {
      const v = JSON.parse(t) as unknown;
      if (Array.isArray(v)) return { products: v } as Record<string, unknown>;
      if (typeof v === "object" && v !== null) return v as Record<string, unknown>;
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
};

export function OrderViewContent({
  order,
  preparers = [],
  customWaButtons,
  storeProducts = [],
  twoWayTemplates,
  couriers = [],
}: {
  order: OrderViewModel;
  preparers?: { id: string; name: string }[];
  customWaButtons?: Array<{
    id: string;
    label: string;
    iconKey: string;
    messages: string[];
  }>;
  storeProducts?: any[];
  twoWayTemplates?: any;
  couriers?: { id: string; name: string; phone?: string }[];
}) {
  const router = useRouter();
  const [pricingOpen, setPricingOpen] = useState(false);
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);

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
  const isSystemAdminOrder = isAdminShopName(order.shop.name) || order.submissionSource === "admin_portal";
  const isDoubleRoute = order.routeMode === "double" || !!order.secondCustomerPhone;

  const statusBadgeClass = order.prepaidAll ? orderStatusBadgeClassPrepaid(order.status, true) : orderStatusBadgeClass(order.status);

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

        {/* --- بطاقة ترويسة الطلبية المرتبة والأنيقة --- */}
        <div className="mb-6 rounded-2xl border border-sky-200 bg-white/95 p-4 shadow-sm sm:p-5 backdrop-blur-sm">
          {/* السطر الأول: رقم الطلب + شارة الحالة + الشارات الخاصة */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-sky-100 pb-3.5">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="text-xl sm:text-2xl font-black text-slate-800">
                تفاصيل الطلب <span className="inline-block rounded-xl bg-sky-600 px-3 py-1 text-white tabular-nums shadow-sm">#{order.orderNumber}</span>
              </span>
              
              {isReversePickup && (
                <span className="rounded-xl border border-violet-300 bg-violet-100 px-2.5 py-1 text-xs font-black text-violet-900">
                  🔄 طلب عكسي
                </span>
              )}
              {isDoubleRoute && (
                <span className="rounded-xl border border-fuchsia-300 bg-fuchsia-100 px-2.5 py-1 text-xs font-black text-fuchsia-900">
                  ✌️ وجهتين
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <span className={`rounded-full px-4 py-1.5 text-xs sm:text-sm font-black shadow-sm ${statusBadgeClass}`}>
                {STATUS_AR[order.status] ?? order.status}
              </span>
            </div>
          </div>

          {/* السطر الثاني: التواريخ والأوقات بأسلوب أنيق */}
          <div className="mt-3.5 flex flex-wrap items-center gap-2 text-xs sm:text-sm">
            <div className="flex items-center gap-1.5 rounded-xl border border-sky-100 bg-sky-50/80 px-3 py-1.5 font-bold text-sky-900">
              <span>📅</span>
              <span className="text-sky-700">تاريخ الرفع:</span>
              <span className="font-mono [direction:ltr]">{formatBaghdadDateTime(new Date(order.createdAt))}</span>
            </div>
            <div className="flex items-center gap-1.5 rounded-xl border border-rose-100 bg-rose-50/80 px-3 py-1.5 font-bold text-rose-900">
              <span>⏰</span>
              <span className="text-rose-700">وقت الطلب (المطلوب):</span>
              <span>{order.orderNoteTime || "فوري"}</span>
            </div>
          </div>

          {/* السطر الثالث: أزرار الإجراءات السريعة كبار ومريحين للنقر */}
          <div className="mt-4 flex flex-wrap items-center gap-2.5 pt-1">
            <Link
              href={`${SECRET_ADMIN_PATH}/orders/${order.id}/edit`}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-sky-600 hover:bg-sky-700 active:scale-95 px-4 py-2.5 text-xs sm:text-sm font-bold text-white shadow-sm transition-all min-h-[42px]"
            >
              <span>📝</span>
              <span>تعديل البيانات</span>
            </Link>

            {parsedShoppingJson !== null && (
              <Link
                href={`${SECRET_ADMIN_PATH}/orders/${order.id}/price`}
                className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 active:scale-95 px-4 py-2.5 text-xs sm:text-sm font-bold text-white shadow-sm transition-all min-h-[42px]"
              >
                <span>💰</span>
                <span>تعديل التسعير</span>
              </Link>
            )}

            {order.status !== "cancelled" && order.status !== "archived" && (
              <button
                type="button"
                onClick={() => setShowAssignCourierModal(true)}
                className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 px-4 py-2.5 text-xs sm:text-sm font-bold text-white shadow-sm transition-all cursor-pointer min-h-[42px]"
              >
                <span>📦</span>
                <span>{order.courier?.name || order.courierId || order.status !== "pending" ? "تغيير المندوب" : "إسناد للمندوب"}</span>
              </button>
            )}
          </div>
        </div>

        {/* بصمات الصوت في بداية الصفحة بتنسيق مرتب */}
        <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {voiceSrc && (
            <div className="rounded-2xl border-2 border-amber-100 bg-white p-3.5 shadow-sm">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-black text-amber-700 flex items-center gap-1"><span>🗣️</span> بصمة الزبون (المحل)</span>
              </div>
              <VoiceNoteAudio src={voiceSrc} streamKey={`${order.id}-voice`} className="w-full" />
            </div>
          )}
          <div className={voiceSrc ? "" : "sm:col-span-2"}>
            <AdminVoiceNoteSection variant="standalone" orderId={order.id} defaultAdminVoiceNoteUrl={order.adminVoiceNoteUrl} />
          </div>
        </div>


      <div className="mt-5 space-y-6 sm:space-y-8">
        
        {/* --- ⇄ TWO WAY ORDER ACTION BUTTONS --- */}
        {isDoubleRoute && (
          <TwoWayOrderActionButtons
            orderId={order.id}
            orderNumber={order.orderNumber}
            orderStatus={order.status}
            routeMode={order.routeMode}
            senderName={order.routeMode === "double" ? "المرسل" : order.shop.name}
            senderPhone={order.customerPhone}
            senderAlternatePhone={order.alternatePhone}
            senderRegionName={order.customerRegion?.name}
            senderHasLocation={!!order.customerLocationUrl}
            senderGpsUploaded={!!order.customerLocationSetByCourierAt}
            recipientName="المستلم"
            recipientPhone={order.secondCustomerPhone || (order.routeMode === "double" ? null : order.customerPhone)}
            recipientAlternatePhone={order.secondCustomerAlternatePhone}
            recipientRegionName={order.secondCustomerRegion?.name}
            recipientHasLocation={!!order.secondCustomerLocationUrl}
            subtotal={order.orderSubtotal ? String(order.orderSubtotal) : "0"}
            delivery={order.deliveryPrice ? String(order.deliveryPrice) : "0"}
            total={order.totalAmount ? String(order.totalAmount) : "0"}
            notes={order.summary}
            twoWayTemplates={twoWayTemplates}
          />
        )}
        
        {/* --- SENDER / SHOP --- */}
        <div className={gridInfoPhoto}>
          <div className="space-y-2">
            <h3 className="text-lg font-bold text-emerald-800">
              {order.routeMode === "double" ? "المرسل (الوجهة الأولى)" : "المحل"}
            </h3>
            {order.routeMode === "double" ? (
              <>
                <p className="text-slate-800 font-bold">{order.customerRegion?.name ?? "—"}</p>
                <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-3 max-w-sm">
                  <div className="min-w-0">
                    <span className={compactPhoneText}>{order.customerPhone}</span>
                  </div>
                  {order.alternatePhone && (
                    <div className="mt-2 min-w-0 border-t border-emerald-100 pt-2">
                      <span className={compactPhoneText}>{order.alternatePhone}</span>
                    </div>
                  )}
                </div>
                <OtherRegionsCustomerDetails 
                  phone={order.customerPhone} 
                  currentRegionId={order.customerRegionId} 
                  currentRegionName={order.customerRegion?.name}
                  orderId={order.id}
                  isSecondDestination={false}
                />
                <InlineLandmarkEditor
                  orderId={order.id}
                  initialLandmark={order.customerLandmark}
                  isSecondDestination={false}
                  label="📍 دالة:"
                />
                <p className="text-sm font-bold text-emerald-800 flex items-center gap-1.5">
                  💡 {isSmartHintValid(order.smartHintLine) ? order.smartHintLine!.trim() : "—"}
                </p>
                <div className="mt-2 space-y-2">
                  {order.customerLocationUrl?.trim() ? (
                    <div className="space-y-1">
                      <a href={order.customerLocationUrl} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-[44px] items-center justify-center bg-emerald-600 px-4 py-2.5 text-xs sm:text-sm font-black text-white rounded-xl shadow-md hover:bg-emerald-700 active:scale-95 transition-all gap-1.5">لوكيشن المرسل ↗</a>
                      <ImageUploaderCaption name={order.customerLocationUploadedByName} />
                    </div>
                  ) : (
                    <div className="mt-2">
                      <AdminCustomerLocationQuick 
                        orderId={order.id} 
                        customerPhone={order.customerPhone}
                        customerPhone2={order.customerPhone2 || undefined}
                        shopPhone={order.shop?.phone || undefined}
                        orderStatus={order.status}
                        templateVars={{
                          clientshop: order.shop?.name || "",
                          city: order.shop?.region?.name || "",
                          total_price: String(order.totalPrice || ""),
                          delivery: order.courier?.name || "",
                          location_url: order.customerLocationUrl || "",
                          landmark: order.customerLandmark || "",
                          order_number: String(order.orderNumber || ""),
                          customer_phone: order.customerPhone || "",
                          customer_phone2: order.customerPhone2 || "",
                          shop_phone: order.shop?.phone || "",
                        }}
                      />
                    </div>
                  )}
                </div>
              </>
            ) : (
              <>
                {isSystemAdminOrder ? <p className="text-3xl font-black text-indigo-700 tabular-nums">{SYSTEM_ADMIN_PHONE}</p> :
                  <>
                    <p className="font-bold text-slate-900">{order.shop.name}</p>
                    {order.shop.region?.name && (
                      <p className="text-xs font-semibold text-slate-500">{order.shop.region.name}</p>
                    )}
                    <p className="text-sm font-medium"><span className="text-slate-500">المسؤول: </span><span className="font-bold text-sky-900">{order.submittedByCompanyPreparer?.name || order.submittedBy?.name || "—"}</span></p>
                    <div className="mt-2">{order.shopLocationUrl?.trim() ? <a href={order.shopLocationUrl} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-[44px] items-center justify-center bg-emerald-600 px-4 py-2.5 text-xs sm:text-sm font-black text-white rounded-xl shadow-md hover:bg-emerald-700 active:scale-95 transition-all gap-1.5">فتح لوكيشن المحل ↗</a> : <p className="text-xs font-bold text-amber-800">لا يوجد لوكيشن</p>}</div>
                  </>
                }
              </>
            )}
          </div>
          <div className="self-start">
            {order.routeMode === "double" ? (
              <>
                {imgCustDoor ? <div className={squarePhotoFrame}><img src={imgCustDoor} alt="" className={`${squarePhotoImg} cursor-zoom-in hover:scale-105 transition duration-300`} onClick={() => setPreviewImageUrl(imgCustDoor)} /></div> : <div className="aspect-square border-dashed border-2 flex items-center justify-center rounded-xl text-xs text-slate-400">لا توجد صورة</div>}
                <div className="mt-2 space-y-2">
                  <CustomerDoorPhotoQuick orderId={order.id} hasImage={!!order.customerDoorPhotoUrl} />
                  <ImageUploaderCaption name={order.customerDoorPhotoUploadedByName} />
                </div>
              </>
            ) : (
              !isSystemAdminOrder && (
                <>
                  {imgShopDoor ? <div className={squarePhotoFrame}><img src={imgShopDoor} alt="" className={`${squarePhotoImg} cursor-zoom-in hover:scale-105 transition duration-300`} onClick={() => setPreviewImageUrl(imgShopDoor)} /></div> : <div className="aspect-square border-dashed border-2 flex items-center justify-center rounded-xl text-xs text-slate-400">لا توجد صورة</div>}
                  <div className="mt-2 space-y-2">
                    <AdminOrderPhotoQuick orderId={order.id} kind="shop" hasImage={!!(order.shopPhotoUrl || order.shopDoorPhotoUrl)} />
                    <ImageUploaderCaption name={order.shopDoorPhotoUploadedByName} />
                  </div>
                </>
              )
            )}
          </div>
        </div>

        {/* --- RECEIVER / CUSTOMER --- */}
        <div className={gridInfoPhoto}>
          <div className="space-y-2">
            <h3 className="text-lg font-bold text-emerald-800">
              {order.routeMode === "double" ? "المستلم (الوجهة الثانية)" : "الزبون"}
            </h3>
            {order.routeMode === "double" ? (
              <>
                <p className="text-slate-800 font-bold">{order.secondCustomerRegion?.name ?? "—"}</p>
                <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-3 max-w-sm">
                  <div className="min-w-0">
                    <span className={compactPhoneText}>{order.secondCustomerPhone || "—"}</span>
                  </div>
                </div>
                <OtherRegionsCustomerDetails 
                  phone={order.secondCustomerPhone || order.customerPhone} 
                  currentRegionId={order.secondCustomerRegionId} 
                  currentRegionName={order.secondCustomerRegion?.name}
                  orderId={order.id}
                  isSecondDestination={true}
                />
                <InlineLandmarkEditor
                  orderId={order.id}
                  initialLandmark={order.secondCustomerLandmark}
                  isSecondDestination={true}
                  label="📍 دالة:"
                />
                <p className="text-sm font-bold text-emerald-800 flex items-center gap-1.5">
                  💡 {isSmartHintValid(order.secondSmartHintLine) ? order.secondSmartHintLine!.trim() : "—"}
                </p>
                <div className="mt-2 space-y-2">
                  {order.secondCustomerLocationUrl?.trim() ? (
                    <div className="space-y-1">
                      <a href={order.secondCustomerLocationUrl} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-[44px] items-center justify-center bg-emerald-600 px-4 py-2.5 text-xs sm:text-sm font-black text-white rounded-xl shadow-md hover:bg-emerald-700 active:scale-95 transition-all gap-1.5">لوكيشن المستلم ↗</a>
                      <ImageUploaderCaption name={order.secondCustomerDoorPhotoUploadedByName} />
                    </div>
                  ) : (
                    <div className="mt-2">
                      <AdminCustomerLocationQuick 
                        orderId={order.id} 
                        target="second" 
                        customerPhone={order.secondCustomerPhone || order.customerPhone}
                        customerPhone2={order.customerPhone2 || undefined}
                        shopPhone={order.shop?.phone || undefined}
                        orderStatus={order.status}
                        templateVars={{
                          clientshop: order.shop?.name || "",
                          city: order.secondCustomerRegion?.name || "",
                          total_price: String(order.totalPrice || ""),
                          delivery: order.courier?.name || "",
                          location_url: order.secondCustomerLocationUrl || "",
                          landmark: order.secondCustomerLandmark || "",
                          order_number: String(order.orderNumber || ""),
                          customer_phone: order.secondCustomerPhone || order.customerPhone || "",
                          customer_phone2: order.customerPhone2 || "",
                          shop_phone: order.shop?.phone || "",
                        }}
                      />
                    </div>
                  )}
                </div>
              </>
            ) : (
              <>
                <p className="text-slate-800 font-bold">{order.customerRegion?.name ?? "—"}</p>
                <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-3 max-w-sm">
                  <div className="min-w-0">
                    <span className={compactPhoneText}>{order.customerPhone}</span>
                  </div>
                  {(order.alternatePhone || order.secondCustomerPhone) && (
                    <div className="flex flex-col gap-2 mt-2 pt-2 border-t border-emerald-100">
                      {order.alternatePhone && (
                        <div className="min-w-0">
                          <span className={compactPhoneText}>{order.alternatePhone}</span>
                        </div>
                      )}
                      {order.secondCustomerPhone && order.secondCustomerPhone !== order.alternatePhone && (
                        <div className="min-w-0">
                          <span className={compactPhoneText}>{order.secondCustomerPhone}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <OtherRegionsCustomerDetails 
                  phone={order.customerPhone} 
                  currentRegionId={order.customerRegionId} 
                  currentRegionName={order.customerRegion?.name}
                  orderId={order.id}
                  isSecondDestination={false}
                />
                <InlineLandmarkEditor
                  orderId={order.id}
                  initialLandmark={order.customerLandmark}
                  isSecondDestination={false}
                  label="📍 دالة:"
                />
                <p className="text-sm font-bold text-emerald-800 flex items-center gap-1.5">
                  💡 {isSmartHintValid(order.smartHintLine) ? order.smartHintLine!.trim() : "—"}
                </p>
                <div className="mt-2 space-y-2">
                  {order.customerLocationUrl?.trim() ? (
                    <div className="space-y-1">
                      <a href={order.customerLocationUrl} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-[44px] items-center justify-center bg-emerald-600 px-4 py-2.5 text-xs sm:text-sm font-black text-white rounded-xl shadow-md hover:bg-emerald-700 active:scale-95 transition-all gap-1.5">لوكيشن الزبون ↗</a>
                      <ImageUploaderCaption name={order.customerLocationUploadedByName} />
                    </div>
                  ) : (
                    <div className="mt-2">
                      <AdminCustomerLocationQuick 
                        orderId={order.id} 
                        customerPhone={order.customerPhone}
                        customerPhone2={order.customerPhone2 || undefined}
                        shopPhone={order.shop?.phone || undefined}
                        orderStatus={order.status}
                        templateVars={{
                          clientshop: order.shop?.name || "",
                          city: order.customerRegion?.name || "",
                          total_price: String(order.totalPrice || ""),
                          delivery: order.courier?.name || "",
                          location_url: order.customerLocationUrl || "",
                          landmark: order.customerLandmark || "",
                          order_number: String(order.orderNumber || ""),
                          customer_phone: order.customerPhone || "",
                          customer_phone2: order.customerPhone2 || "",
                          shop_phone: order.shop?.phone || "",
                        }}
                      />
                    </div>
                  )}
                  <div className="flex flex-wrap gap-2">
                    <AdminCustomerOrderHistory
                      phone={order.customerPhone}
                      regionId={order.customerRegionId}
                      currentOrderId={order.id}
                      customerRegionName={order.customerRegion?.name ?? null}
                      alternatePhone={order.alternatePhone}
                      customerLocationUrl={order.customerLocationUrl}
                      customerLandmark={order.customerLandmark}
                      customerProfileId={order.customerProfileId}
                    />
                    {order.customerProfileId ? (
                      <Link href={`${SECRET_ADMIN_PATH}/customers/profiles/${order.customerProfileId}/edit`} className="inline-flex items-center rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-900 shadow-sm hover:bg-slate-50 transition-colors">ملف الزبون المباشر</Link>
                    ) : null}
                  </div>
                </div>
              </>
            )}
          </div>
          <div className="self-start">
            {order.routeMode === "double" ? (
              <>
                 {imgCustDoor2 ? <div className={squarePhotoFrame}><img src={imgCustDoor2} alt="" className={`${squarePhotoImg} cursor-zoom-in hover:scale-105 transition duration-300`} onClick={() => setPreviewImageUrl(imgCustDoor2)} /></div> : <div className="aspect-square border-dashed border-2 flex items-center justify-center rounded-xl text-xs text-slate-400">لا توجد صورة</div>}
                <div className="mt-2 space-y-2">
                  <CustomerDoorPhotoQuick orderId={order.id} hasImage={!!order.secondCustomerDoorPhotoUrl} isSecondCustomer />
                  <ImageUploaderCaption name={order.secondCustomerDoorPhotoUploadedByName} />
                </div>
              </>
            ) : (
              <>
                 {imgCustDoor ? <div className={squarePhotoFrame}><img src={imgCustDoor} alt="" className={`${squarePhotoImg} cursor-zoom-in hover:scale-105 transition duration-300`} onClick={() => setPreviewImageUrl(imgCustDoor)} /></div> : <div className="aspect-square border-dashed border-2 flex items-center justify-center rounded-xl text-xs text-slate-400">لا توجد صورة</div>}
                <div className="mt-2 space-y-2">
                  <CustomerDoorPhotoQuick orderId={order.id} hasImage={!!order.customerDoorPhotoUrl} />
                  <ImageUploaderCaption name={order.customerDoorPhotoUploadedByName} />
                </div>
              </>
            )}
          </div>
        </div>


        {/* قسم المندوب - مضاف حديثاً بناءً على طلبك */}
        {order.courier && (
          <div className="rounded-2xl border-2 border-purple-200 bg-purple-50/40 p-5 shadow-sm">
             <div className="flex items-center justify-between gap-2 mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">🚚</span>
                  <h3 className="text-lg font-black text-purple-900">المندوب المسجل على الطلب</h3>
                </div>
                {order.status !== "cancelled" && order.status !== "archived" && (
                  <button
                    type="button"
                    onClick={() => setShowAssignCourierModal(true)}
                    className="inline-flex items-center gap-1 rounded-xl bg-purple-600 hover:bg-purple-700 active:scale-95 px-3 py-1.5 text-xs font-bold text-white shadow-sm transition-all cursor-pointer"
                  >
                    <span>🔄</span>
                    تغيير المندوب
                  </button>
                )}
             </div>
             <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                   <p className="text-2xl font-black text-slate-900">{order.courier.name}</p>
                   <p className="font-mono text-base font-bold text-purple-800 tabular-nums sm:text-lg [direction:ltr] break-all">{order.courier.phone}</p>
                </div>
             </div>
          </div>
        )}

        <div className={gridInfoPhoto}>
          <div className="space-y-4 rounded-xl border border-sky-100 bg-sky-50/50 p-4">
            <div className="grid grid-cols-2 gap-4">
              <div><p className="text-sm font-bold text-slate-700 mb-1">نوع الطلب</p><OrderTypeDetailBlock orderType={order.orderType} prefixClassName="font-black text-violet-950 bg-violet-100 px-2 py-1 rounded-lg text-lg ring-1 ring-violet-300" restClassName="text-lg font-black text-slate-900" /></div>
              <div><p className="text-sm font-bold text-slate-700 mb-1">وقت الطلب</p><p className="text-sm font-black text-indigo-700 bg-indigo-50 px-2 py-1 rounded-md border border-indigo-200 inline-block">{order.orderNoteTime || "فوري"}</p></div>
            </div>
            {(() => {
              const parseNum = (val: string | null | undefined): number => {
                if (!val) return 0;
                // استخلاص الأرقام فقط (مثال: "1 الف" أو "1.5" تصبح 1 أو 1.5)
                const clean = val.replace(/[^\d.]/g, "");
                const num = parseFloat(clean);
                return isNaN(num) ? 0 : num;
              };

              const subRaw = parseNum(order.orderSubtotal);
              const delRaw = parseNum(order.deliveryPrice);
              const totRaw = parseNum(order.totalAmount);
              
              const calculatedDebt = totRaw - (subRaw + delRaw);
              const hasDebt = calculatedDebt > 0;
              
              const { formatDinarAsAlfWithUnit } = require("@/lib/money-alf");

              return (
                <>
                  <div className={`grid ${hasDebt ? 'grid-cols-3' : 'grid-cols-2'} gap-4`}>
                    <div>
                      <p className="text-xs font-bold text-slate-500">سعر البضاعة</p>
                      <p className="font-mono text-lg font-black text-slate-900">{order.orderSubtotal || "0"}</p>
                    </div>
                    {hasDebt && (
                      <div className="rounded-xl border border-rose-200 bg-rose-50/50 p-1 px-2">
                        <p className="text-xs font-black text-rose-600">الدين</p>
                        <p className="font-mono text-lg font-black text-rose-700 animate-pulse">
                          {calculatedDebt}
                        </p>
                      </div>
                    )}
                    <div>
                      <p className="text-xs font-bold text-slate-500">التوصيل</p>
                      <p className="font-mono text-lg font-black text-slate-900">{order.deliveryPrice || "0"}</p>
                    </div>
                  </div>
                </>
              );
            })()}
            <div className="rounded-lg border-2 border-violet-500/30 bg-violet-500/10 p-3 shadow-sm"><p className="text-xs font-black text-violet-900 mb-1">المبلغ الكلي</p><p className="font-mono text-3xl font-black text-violet-950 tabular-nums">{order.totalAmount || "—"}</p></div>
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
