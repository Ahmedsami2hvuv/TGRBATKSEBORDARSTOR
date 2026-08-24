"use client";

import { Suspense, useEffect, useRef, useState, useContext } from "react";
import { ImageZoomModal } from "@/components/pinch-zoom-image";
import { formatDinarAsAlf, formatDinarAsAlfWithUnit } from "@/lib/money-alf";
import { resolvePublicAssetSrc } from "@/lib/image-url";
import { extractLatLngFromLocationInput, hasCustomerLocationUrl } from "@/lib/order-location";
import { VoiceNoteAudio } from "@/components/voice-note-audio";
import { isReversePickupOrderType } from "@/lib/order-type-flags";
import { formatBaghdadDateTime } from "@/lib/baghdad-time";
import {
  orderStatusBadgeClass,
  orderStatusDetailSurfaceClass,
  orderStatusStartStripeClass,
} from "@/lib/order-status-style";
import type { MandoubOrderDetailPayload } from "@/lib/mandoub-order-queries";
import { MandoubCustomerEditForm } from "./mandoub-customer-edit-form";
import { MandoubDoorPhotoForm } from "./mandoub-door-photo-form";
import { MandoubOrderDetailActions } from "./mandoub-order-detail-actions";
import { MandoubFloatingBar } from "./mandoub-floating-bar";
import { MandoubLocFlashBanner } from "./mandoub-loc-flash-banner";
import { MandoubUploadLocationInline } from "./mandoub-upload-location-inline";
import { MandoubOrderMoneyFlow } from "./mandoub-order-money-flow";
import { MandoubOrderImageQuick } from "./mandoub-order-image-quick";
import { MandoubQuickDoorCapture } from "./mandoub-quick-door";
import { MandoubQuickDoorSecondCapture } from "./mandoub-quick-door-second";
import { ClickableNotesCard } from "@/components/clickable-notes-card";
import { normalizeOrderSummaryText } from "@/lib/preparation-invoice";
import { ImageUploaderCaption } from "@/components/image-uploader-caption";
import { OrderTypeDetailBlock } from "@/components/order-type-line";
import { telHref, whatsappMeUrl } from "@/lib/whatsapp";
import { IconPhone, IconWa } from "@/components/order-fab-dock";
import { UISectionConfig } from "@/lib/ui-settings";
import { ADMIN_PHONE_FROM_SHOP_LOCAL } from "@/lib/admin-order-from-admin-constants";
import { GlobalIconsConfig } from "@/lib/icon-settings";
import { DynamicIcon } from "@/components/dynamic-icon";
import { FontSizeContext } from "@/components/font-size-provider";
import { InlineLandmarkEditor } from "@/components/inline-landmark-editor";
import { OtherRegionsCustomerDetails } from "@/components/other-regions-customer-details";
import { TwoWayOrderActionButtons } from "@/components/two-way-order-action-buttons";

const STATUS_AR: Record<string, string> = {
  assigned: "بانتظار المندوب",
  delivering: "عند المندوب (تم الاستلام)",
  delivered: "تم التسليم",
};

function imgSrc(url: string): string | null {
  return resolvePublicAssetSrc(url);
}

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

const locBtnEmerald =
  "inline-flex min-h-[44px] sm:min-h-[48px] max-w-full items-center justify-center rounded-xl bg-emerald-600 px-4 py-2.5 text-sm sm:text-base font-black text-white shadow-md hover:bg-emerald-700 active:scale-95 transition-all gap-1.5";
const contactBtnBase = "inline-flex items-center justify-center gap-1 rounded-md px-2 py-1 text-[11px] font-bold shadow-sm transition-colors sm:px-2.5 sm:py-1.5 sm:text-xs";
const callBtnClass = `${contactBtnBase} bg-sky-600 text-white hover:bg-sky-700`;
const waBtnClass = `${contactBtnBase} bg-emerald-600 text-white hover:bg-emerald-700`;

const gridInfoPhoto =
  "grid grid-cols-[minmax(0,1fr)_minmax(0,12rem)] items-start gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.32fr)] sm:gap-6";

const squarePhotoFrame =
  "aspect-square w-full overflow-hidden rounded-xl border border-sky-200 bg-slate-50";
const squarePhotoCover = "h-full w-full object-cover";
const squarePhotoContain = "h-full w-full object-contain";

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
    guidedDeliverySteps?: boolean;
  };
  isModal?: boolean;
  customWaButtons?: any[];
}) {
  const fontSizeContext = useContext(FontSizeContext);
  const fontSizeConfig = fontSizeContext?.config;

  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => {
    setIsMounted(true);
  }, []);
  const activeConfig = isMounted ? fontSizeConfig : null;

  // حل مشكلة السحب للتحديث (Pull-to-refresh) في تطبيق الأندرويد عند فتح الطلبية كـ Modal
  useEffect(() => {
    if (!isModal) return;

    const originalMinHeight = document.documentElement.style.minHeight;
    const originalScrollBehavior = document.documentElement.style.scrollBehavior;

    // تعطيل التمرير السلس مؤقتاً لتجنب التأثيرات البصرية
    document.documentElement.style.scrollBehavior = "auto";
    
    // جعل الصفحة أطول قليلاً لضمان عمل السكرول
    document.documentElement.style.minHeight = "101vh";
    
    // تمرير الصفحة بمقدار 1 بكسل ليكون scrollY > 0 وبالتالي يتم تعطيل السحب للتحديث في الأندرويد
    if (window.scrollY === 0) {
      window.scrollTo(0, 1);
    }

    // تجميد تمرير الصفحة الخلفية
    document.body.style.overflow = "hidden";

    return () => {
      // استعادة الإعدادات الأصلية
      document.body.style.overflow = "";
      document.documentElement.style.minHeight = originalMinHeight;
      document.documentElement.style.scrollBehavior = originalScrollBehavior;
    };
  }, [isModal]);

  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);


  const shopImageUrl = order.shop.photoUrl?.trim() || order.shopDoorPhotoUrl?.trim() || "";
  const isAdminPortal = order.submissionSource === "admin_portal";
  const submitterName =
    order.shop.ownerName?.trim() ||
    order.submittedByCompanyPreparer?.name?.trim() ||
    order.submittedBy?.name?.trim() ||
    (isAdminPortal && !order.submittedBy ? "الإدارة" : "—");
  const shopContactPhone = order.submittedByCompanyPreparer?.phone?.trim() || order.submittedBy?.phone?.trim() || (isAdminPortal && !order.submittedBy ? ADMIN_PHONE_FROM_SHOP_LOCAL : order.shop.phone?.trim() || "");

  const customerDoorDisplay = getCleanValue(
    order.customerDoorPhotoUrl,
    order.customer?.customerDoorPhotoUrl,
    phoneProfile?.photoUrl
  );
  const isDoubleRoute = order.routeMode === "double" || !!order.secondCustomerPhone;

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
  const secondDoorCaptionName =
    secondDoorMerged && order.secondCustomerDoorPhotoUploadedByName?.trim()
      ? order.secondCustomerDoorPhotoUploadedByName
      : null;
  const missingCustomerLocation = !hasCustomerLocationUrl(mergedCustomerLocationUrl, undefined);
  const prepJson = order.preparerShoppingJson as any;
  const hideSubtotalInfo = prepJson?.hidePricesFromCourier === true;
  const reversePickup = isReversePickupOrderType(order.orderType);

  const currentCourierName = courierName || order.courier?.name || (order as any).courierName || (courierSettings as any)?.name || "";
  const currentTotalPriceStr = String(
    (order as any).totalAmount ?? (order as any).totalPrice ?? (Number((order as any).orderSubtotal || 0) + Number((order as any).deliveryPrice || 0)) ?? ""
  );

  const isFromProfileLandmark = !getCleanValue(order.customerLandmark, order.customer?.customerLandmark) && !!getCleanValue(phoneProfile?.landmark);
  const isFromProfileLocation = !getCleanValue(order.customerLocationUrl, order.customer?.customerLocationUrl) && !!getCleanValue(phoneProfile?.locationUrl);
  const isFromProfilePhoto = !getCleanValue(order.customerDoorPhotoUrl, order.customer?.customerDoorPhotoUrl) && !!getCleanValue(phoneProfile?.photoUrl);
  const isFromProfileAlternate = isDoubleRoute
    ? (!getCleanValue(order.alternatePhone, order.customer?.alternatePhone) && !!getCleanValue(phoneProfile?.alternatePhone))
    : (!getCleanValue(order.secondCustomerPhone, order.alternatePhone, order.customer?.alternatePhone) && !!getCleanValue(phoneProfile?.alternatePhone));

  const isFromSecondProfileLandmark = !getCleanValue(order.secondCustomerLandmark) && !!getCleanValue(secondPhoneProfile?.landmark);
  const isFromSecondProfileLocation = !getCleanValue(order.secondCustomerLocationUrl) && !!getCleanValue(secondPhoneProfile?.locationUrl);
  const isFromSecondProfilePhoto = !getCleanValue(order.secondCustomerDoorPhotoUrl) && !!getCleanValue(secondPhoneProfile?.photoUrl);

  const isSmartHintValid = (s: string | null | undefined) => {
    if (!s) return false;
    const t = s.trim();
    if (!t || t === "—" || t.startsWith("—")) return false;
    return true;
  };

  const customStyle = uiSettings ? {
    backgroundColor: uiSettings.statusStyles?.[order.status]?.backgroundColor || uiSettings.backgroundColor,
    color: uiSettings.statusStyles?.[order.status]?.textColor || uiSettings.textColor,
    opacity: uiSettings.backgroundOpacity,
    borderRadius: uiSettings.borderRadius,
    fontSize: uiSettings.fontSize,
    position: 'relative' as const,
    overflow: 'hidden' as const,
  } : {};

  const bgImage = undefined;
  const bgOpacity = 1;

  const renderBlock = (blockId: string) => {
    const bConf = uiSettings?.blockConfigs?.[blockId] || {};
    if (bConf.hidden && blockId !== "money_flow") return null;

    const blockStyle = {
      backgroundColor: bConf.backgroundColor,
      fontSize: bConf.fontSize,
      gridColumn: bConf.fullWidth ? "span 2 / span 2" : "auto"
    };

    const isDoubleRoute = order.routeMode === "double" || !!order.secondCustomerPhone;

    switch (blockId) {
      case "shop_info":
        if (isDoubleRoute) return null;
        // عند تفعيل نظام الخطوات التوجيهي واستلام الطلب من المحل (قيد التوصيل)، نلغي إظهار بطاقة المحل لعدم تشتيت المندوب
        if (courierSettings?.guidedDeliverySteps && (order.status === "delivering" || order.status === "delivered")) {
          return null;
        }
        return (
          <div key="shop" className={`bg-gradient-to-br from-emerald-50/70 via-white to-slate-50/80 dark:from-emerald-950/30 dark:via-slate-900 dark:to-slate-900 backdrop-blur-md rounded-[2rem] border-2 ${courierSettings?.guidedDeliverySteps ? "border-amber-500 ring-4 ring-amber-400/30" : "border-emerald-500/80 dark:border-emerald-500/70 border-r-[8px] border-r-emerald-500"} shadow-xl shadow-emerald-500/10 ring-1 ring-emerald-500/20 p-4 relative overflow-hidden transition-all duration-300 hover:shadow-2xl`} style={blockStyle}>
            {courierSettings?.guidedDeliverySteps && (
              <div className="-mx-4 -mt-4 mb-3 bg-gradient-to-r from-amber-500 to-orange-500 px-4 py-1.5 text-center text-xs font-black text-white shadow-sm flex items-center justify-center gap-1.5">
                <span>🏬 الخطوة 1: استلام البضاعة من المحل (المرسل)</span>
              </div>
            )}
            <div className="flex flex-row gap-4 items-start justify-between">
              <div className="flex-1 space-y-2 text-right">
                <div className="flex items-center gap-2 border-b border-slate-100 dark:border-white/5 pb-2">
                  <div className="h-8 w-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 flex items-center justify-center text-emerald-600">
                    <DynamicIcon icon={icons?.ui_shops} fallback="🏢" width={18} height={18} />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-emerald-800 dark:text-emerald-400">
                      {courierSettings?.guidedDeliverySteps ? "المحل (المرسل - مكان الاستلام)" : "معلومات المحل (المرسل)"}
                    </h3>
                  </div>
                </div>

                <div className="space-y-2 text-xs">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-bold text-slate-400 text-sm" title="اسم المحل">🏢</span>
                    <span className="font-black text-slate-900 dark:text-white">{order.shop.name}</span>
                  </div>

                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-bold text-slate-400 text-sm" title="العميل / المسؤول">👤</span>
                    <span className="font-black text-sky-900 dark:text-sky-400">{submitterName}</span>
                  </div>

                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-bold text-slate-400 text-sm" title="منطقة المحل">📍</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200">{order.shop.region?.name || "—"}</span>
                  </div>

                  {shopContactPhone && (
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-slate-400 text-sm" title="هاتف المسؤول">📞</span>
                      <span className="font-mono font-black text-slate-700 dark:text-slate-300">{contactLine(shopContactPhone)}</span>
                    </div>
                  )}
                </div>

                <div className="pt-1.5">
                  {order.shop.locationUrl?.trim() ? (
                    <a href={order.shop.locationUrl} target="_blank" rel="noopener noreferrer" className={`inline-flex min-h-[44px] sm:min-h-[48px] items-center justify-center rounded-xl ${courierSettings?.guidedDeliverySteps ? "bg-amber-600 hover:bg-amber-700 ring-2 ring-amber-300" : "bg-emerald-600 hover:bg-emerald-700"} px-4 text-xs sm:text-sm font-black text-white active:scale-95 transition-all gap-1.5 shadow-md max-w-full`}>
                      {courierSettings?.guidedDeliverySteps ? "🏢 خريطة المحل (لاستلام البضاعة فقط)" : "📍 موقع المحل"} <DynamicIcon icon={icons?.ui_external_link} fallback="↗" width={12} height={12} />
                    </a>
                  ) : (
                    <div className="inline-block p-1.5 bg-amber-50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/30 rounded-xl text-center text-[10px] font-bold text-amber-800">
                      ⚠️ لا يوجد موقع جغرافي للمحل
                    </div>
                  )}
                </div>
              </div>

              {/* Shop Door / Logo Photo */}
              <div className="w-[170px] xs:w-[195px] sm:w-[240px] md:w-[270px] flex flex-col items-center justify-start shrink-0 self-start gap-2">
                <span className="text-xs font-black text-slate-500 dark:text-slate-400">صورة المحل</span>
                {shopImageUrl ? (
                  <div className="w-full flex flex-col items-center gap-1">
                    <div className="aspect-square w-full overflow-hidden rounded-2xl border-2 border-sky-300 dark:border-white/10 shadow-lg">
                      <img src={imgSrc(shopImageUrl)!} alt="" className="h-full w-full object-cover cursor-zoom-in hover:scale-105 transition duration-300" onClick={() => setPreviewImageUrl(imgSrc(shopImageUrl))} />
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
                {courierSettings?.showDoorBtn !== false && (
                  <div className="w-full"><MandoubDoorPhotoForm orderId={order.id} nextUrl={nextUrl} {...auth} /></div>
                )}
              </div>
            </div>
          </div>
        );
      case "customer_info":
        return (
          <div key="customer_parent" className="space-y-4">
            <div key="customer" className={`bg-gradient-to-br from-sky-50/70 via-white to-slate-50/80 dark:from-sky-950/30 dark:via-slate-900 dark:to-slate-900 backdrop-blur-md rounded-[2rem] border-2 ${courierSettings?.guidedDeliverySteps ? "border-emerald-500 ring-4 ring-emerald-400/30" : "border-sky-500/80 dark:border-sky-500/70 border-r-[8px] border-r-sky-500"} shadow-xl shadow-sky-500/10 ring-1 ring-sky-500/20 p-4 relative overflow-hidden transition-all duration-300 hover:shadow-2xl`} style={blockStyle}>
              {courierSettings?.guidedDeliverySteps && (
                <div className="-mx-4 -mt-4 mb-3 bg-gradient-to-r from-emerald-600 to-teal-600 px-4 py-1.5 text-center text-xs font-black text-white shadow-sm flex items-center justify-center gap-1.5">
                  <span>🏠 الخطوة 2: التوصيل للزبون (المستلم النهائي)</span>
                </div>
              )}
              <div className="flex flex-row gap-4 items-start justify-between">
                <div className="flex-1 space-y-2 text-right">
                  <div className="flex items-center gap-2 border-b border-slate-100 dark:border-white/5 pb-2">
                    <div className="h-8 w-8 rounded-lg bg-sky-50 dark:bg-sky-950/30 flex items-center justify-center text-sky-600">
                      <DynamicIcon icon={icons?.ui_user} fallback="👤" width={18} height={18} />
                    </div>
                    <div>
                      <h3 className="text-sm font-black text-sky-950 dark:text-sky-400">
                        {isDoubleRoute ? "المرسل (الوجهة الأولى)" : courierSettings?.guidedDeliverySteps ? "الزبون (المستلم النهائي)" : "الزبون (المستلم)"}
                      </h3>
                    </div>
                  </div>

                  <div className="space-y-2 text-xs">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-bold text-slate-400 text-sm" title="منطقة الزبون">📍</span>
                      <span className="font-black text-slate-900 dark:text-white">{order.customerRegion?.name ?? "—"}</span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-slate-400 text-sm" title="رقم الزبون">📞</span>
                      <span className="font-mono font-black text-slate-900 dark:text-white">{contactLine(order.customerPhone)}</span>
                    </div>

                    {mergedAlternate && (
                      <div className="flex items-center gap-1.5 bg-amber-50 dark:bg-amber-950/20 px-2 py-0.5 rounded border border-amber-100 dark:border-amber-900/30 w-fit">
                        <span className="font-bold text-amber-600 text-[10px]">{isFromProfileAlternate ? "رقم أرشيف:" : "رقم بديل:"}</span>
                        <span className="font-mono font-black text-amber-900 dark:text-amber-100 ml-1">{mergedAlternate}</span>
                      </div>
                    )}
                    

                  </div>

                  <div className="pt-1.5">
                    <div className="flex flex-col items-start gap-1">
                      <div className="flex flex-wrap items-center gap-2">
                        {courierSettings?.showLocationBtn !== false && (
                          <>
                            {mergedCustomerLocationUrl ? (
                              <a 
                                href={mergedCustomerLocationUrl} 
                                target="_blank" 
                                rel="noopener noreferrer" 
                                className={`inline-flex min-h-[44px] sm:min-h-[48px] items-center justify-center rounded-xl ${courierSettings?.guidedDeliverySteps ? "bg-emerald-600 hover:bg-emerald-700 ring-2 ring-emerald-300 animate-pulse" : "bg-emerald-600 hover:bg-emerald-700"} px-4 text-xs sm:text-sm font-black text-white active:scale-95 transition-all gap-1.5 shadow-md kse-location-btn`}
                                style={{
                                  fontSize: activeConfig ? `${activeConfig.locationBtnSize}px` : undefined,
                                  height: activeConfig ? `${Math.max(44, activeConfig.locationBtnSize + 22)}px` : undefined
                                }}
                              >
                                {courierSettings?.guidedDeliverySteps ? "🛵 خريطة الزبون (للتوصيل والتسليم)" : "📍 موقع الزبون"} {isFromProfileLocation && "(أرشيف)"} <DynamicIcon icon={icons?.ui_external_link} fallback="↗" width={12} height={12} />
                              </a>
                            ) : (
                              <MandoubUploadLocationInline 
                                orderId={order.id} 
                                auth={auth} 
                                nextUrl={nextUrl} 
                                fontSizeConfig={activeConfig}
                                customerPhone={order.customerPhone}
                                customerPhone2={order.customerPhone2 || undefined}
                                shopPhone={order.shopPhone || undefined}
                                orderStatus={order.status}
                                templateVars={{
                                  clientshop: order.shop?.name || order.clientName || (order as any).submitterName || (order.submissionSource === "staff_portal" ? "الإدارة" : "المحل"),
                                  city: order.customerRegion?.name || order.regionLine || "—",
                                  total_price: currentTotalPriceStr,
                                  total: currentTotalPriceStr,
                                  delivery: currentCourierName,
                                  courier: currentCourierName,
                                  courierName: currentCourierName,
                                  deliveryName: currentCourierName,
                                  location_url: mergedCustomerLocationUrl || "",
                                  landmark: order.customerLandmark || order.nearestLandmark || "",
                                  order_number: String(order.orderNumber || ""),
                                  customer_phone: order.customerPhone || "",
                                  customer_phone2: order.customerPhone2 || "",
                                  shop_phone: order.shop?.phone || order.shopPhone || "",
                                }}
                                customWaButtons={customWaButtons}
                              />
                            )}
                          </>
                        )}
                        <OtherRegionsCustomerDetails 
                          phone={order.customerPhone} 
                          currentRegionId={order.customerRegionId} 
                          currentRegionName={order.regionLine}
                          icons={icons} 
                          fontSizeConfig={activeConfig} 
                          prefetchedProfiles={(order as any).otherRegionsProfiles}
                          orderId={order.id}
                          isSecondDestination={false}
                        />
                      </div>
                      {courierSettings?.showLocationBtn !== false && mergedCustomerLocationUrl && order.customerLocationUploadedByName?.trim() && (
                        <div className="mt-0.5"><ImageUploaderCaption name={order.customerLocationUploadedByName} /></div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Customer Door Photo */}
                <div className="w-[170px] xs:w-[195px] sm:w-[240px] md:w-[270px] flex flex-col items-center justify-start shrink-0 self-start gap-2">
                  <span className="text-xs font-black text-slate-500 dark:text-slate-400">صورة الباب {isFromProfilePhoto && "(أرشيف)"}</span>
                  {customerDoorDisplay ? (
                    <div className="w-full flex flex-col items-center gap-1">
                      <div className="aspect-square w-full overflow-hidden rounded-2xl border-2 border-sky-300 dark:border-white/10 shadow-lg">
                        <img src={imgSrc(customerDoorDisplay)!} alt="" className="h-full w-full object-cover cursor-zoom-in hover:scale-105 transition duration-300" onClick={() => setPreviewImageUrl(imgSrc(customerDoorDisplay))} />
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
                  {courierSettings?.showDoorBtn !== false && (
                    <div className="w-full"><MandoubQuickDoorCapture orderId={order.id} nextUrl={nextUrl} auth={auth} /></div>
                  )}
                </div>
              </div>

              <div className="mt-3 space-y-2">
                <div className="flex flex-col gap-1">
                  <InlineLandmarkEditor
                    orderId={order.id}
                    initialLandmark={mergedLandmark}
                    isSecondDestination={false}
                    fontSizeConfig={activeConfig}
                    isFromProfile={isFromProfileLandmark}
                    label="📍 دالة:"
                  />
                </div>

                <div className="flex flex-row items-center gap-1.5 rounded-lg bg-emerald-50/50 dark:bg-emerald-950/10 p-1.5 border border-emerald-100/50 dark:border-emerald-900/20 kse-smart-hint-text">
                  <span 
                    className="text-[11px] font-black text-emerald-800 dark:text-emerald-350"
                    style={{ fontSize: activeConfig ? `${activeConfig.smartHintFontSize}px` : undefined }}
                  >
                    💡 {isSmartHintValid(smartHintLine) ? smartHintLine!.trim() : "—"}
                  </span>
                </div>
              </div>
            </div>

            {order.routeMode === "double" && (
              <div key="receiver" className="bg-gradient-to-br from-violet-50/70 via-white to-slate-50/80 dark:from-violet-950/30 dark:via-slate-900 dark:to-slate-900 backdrop-blur-md rounded-[2rem] border-2 border-violet-500/80 dark:border-violet-500/70 border-r-[8px] border-r-violet-500 shadow-xl shadow-violet-500/10 ring-1 ring-violet-500/20 p-4 relative overflow-hidden transition-all duration-300 hover:shadow-2xl mt-3" style={blockStyle}>
                <div className="flex flex-row gap-4 items-start justify-between">
                  <div className="flex-1 space-y-2 text-right">
                    <div className="flex items-center gap-2 border-b border-slate-100 dark:border-white/5 pb-2">
                      <div className="h-8 w-8 rounded-lg bg-violet-50 dark:bg-violet-950/30 flex items-center justify-center text-violet-600">
                        <DynamicIcon icon={icons?.ui_users} fallback="👥" width={18} height={18} />
                      </div>
                      <div>
                        <h3 className="text-sm font-black text-violet-850 dark:text-violet-400">المستلم (الوجهة الثانية)</h3>
                      </div>
                    </div>

                    <div className="space-y-2 text-xs">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-bold text-slate-400 text-sm" title="منطقة المستلم">📍</span>
                        <span className="font-black text-slate-900 dark:text-white">{order.secondCustomerRegion?.name ?? "—"}</span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-slate-400 text-sm" title="هاتف المستلم">📞</span>
                        <span className="font-mono font-black text-slate-900 dark:text-white">{contactLine(order.secondCustomerPhone || "")}</span>
                      </div>

                      {mergedSecondAlternate && (
                        <div className="flex items-center gap-1.5 bg-amber-50 dark:bg-amber-950/20 px-2 py-0.5 rounded border border-amber-100 dark:border-amber-900/30 w-fit">
                          <span className="font-bold text-amber-600 text-[10px]">رقم أرشيف:</span>
                          <span className="font-mono font-black text-amber-900 dark:text-amber-100 ml-1">{mergedSecondAlternate}</span>
                        </div>
                      )}

                    </div>
                    <div className="pt-1.5">
                      {courierSettings?.showLocationBtn !== false && (
                        <div className="max-w-full">
                          {secondLocMerged ? (
                              <a 
                                href={secondLocMerged} 
                                target="_blank" 
                                rel="noopener noreferrer" 
                                className="inline-flex min-h-[44px] sm:min-h-[48px] items-center justify-center rounded-xl bg-emerald-600 px-4 text-xs sm:text-sm font-black text-white hover:bg-emerald-700 active:scale-95 transition-all gap-1.5 shadow-md kse-location-btn"
                                style={{
                                  fontSize: activeConfig ? `${activeConfig.locationBtnSize}px` : undefined,
                                  height: activeConfig ? `${Math.max(44, activeConfig.locationBtnSize + 22)}px` : undefined
                                }}
                              >
                                📍 موقع المستلم {isFromSecondProfileLocation && "(أرشيف)"} <DynamicIcon icon={icons?.ui_external_link} fallback="↗" width={12} height={12} />
                              </a>
                          ) : (
                            <MandoubUploadLocationInline 
                              orderId={order.id} 
                              auth={auth} 
                              nextUrl={nextUrl} 
                              target="second" 
                              fontSizeConfig={activeConfig}
                              customerPhone={order.secondCustomerPhone || order.customerPhone}
                              customerPhone2={order.customerPhone2 || undefined}
                              shopPhone={order.shopPhone || undefined}
                              orderStatus={order.status}
                              templateVars={{
                                clientshop: order.shop?.name || order.clientName || (order as any).submitterName || (order.submissionSource === "staff_portal" ? "الإدارة" : "المحل"),
                                city: order.secondCustomerRegion?.name || order.secondCustomerRegionName || order.regionLine || "—",
                                total_price: currentTotalPriceStr,
                                total: currentTotalPriceStr,
                                delivery: currentCourierName,
                                courier: currentCourierName,
                                courierName: currentCourierName,
                                deliveryName: currentCourierName,
                                location_url: mergedCustomerLocationUrl || "",
                                landmark: order.secondCustomerLandmark || order.secondCustomerNearestLandmark || order.nearestLandmark || "",
                                order_number: String(order.orderNumber || ""),
                                customer_phone: order.secondCustomerPhone || order.customerPhone || "",
                                customer_phone2: order.customerPhone2 || "",
                                shop_phone: order.shop?.phone || order.shopPhone || "",
                              }}
                              customWaButtons={customWaButtons}
                            />
                          )}
                        </div>
                      )}
                      
                      <OtherRegionsCustomerDetails 
                        phone={order.secondCustomerPhone!} 
                        currentRegionId={order.secondCustomerRegionId}
                        currentRegionName={order.secondCustomerRegionName}
                        icons={icons} 
                        fontSizeConfig={activeConfig} 
                        prefetchedProfiles={(order as any).secondOtherRegionsProfiles}
                        orderId={order.id}
                        isSecondDestination={true}
                      />
                    </div>
                  </div>

                  {/* Second Customer Door Photo */}
                  <div className="w-[170px] xs:w-[195px] sm:w-[240px] md:w-[270px] flex flex-col items-center justify-start shrink-0 self-start gap-2">
                    <span className="text-xs font-black text-slate-500 dark:text-slate-400">صورة باب المستلم {isFromSecondProfilePhoto && "(أرشيف)"}</span>
                    {secondDoorMerged && imgSrc(secondDoorMerged) ? (
                      <div className="w-full flex flex-col items-center gap-1">
                        <div className="aspect-square w-full overflow-hidden rounded-2xl border-2 border-sky-300 dark:border-white/10 shadow-lg relative">
                          <img src={imgSrc(secondDoorMerged)!} alt="" className="h-full w-full object-cover cursor-zoom-in hover:scale-105 transition duration-300" onClick={() => setPreviewImageUrl(imgSrc(secondDoorMerged))} />
                        </div>
                        {secondDoorCaptionName ? <div className="mt-1"><ImageUploaderCaption name={secondDoorCaptionName} /></div> : null}
                      </div>
                    ) : (
                      <div className="aspect-square w-full flex items-center justify-center bg-white dark:bg-slate-800 rounded-2xl border-2 border-dashed border-slate-350 dark:border-slate-700 text-xs text-slate-400 font-bold">
                        لا توجد صورة
                      </div>
                    )}
                    {courierSettings?.showDoorBtn !== false && (
                      <div className="w-full">
                        <MandoubQuickDoorSecondCapture orderId={order.id} nextUrl={nextUrl} auth={auth} />
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-3 space-y-2">
                  <div className="flex flex-col gap-1">
                    <InlineLandmarkEditor
                      orderId={order.id}
                      initialLandmark={secondLandmarkMerged}
                      isSecondDestination={true}
                      fontSizeConfig={activeConfig}
                      isFromProfile={isFromSecondProfileLandmark}
                      label="📍 دالة:"
                    />
                  </div>

                  <div className="flex flex-row items-center gap-1.5 rounded-lg bg-violet-50/50 dark:bg-violet-950/10 p-1.5 border border-violet-100/50 dark:border-violet-900/20 kse-smart-hint-text">
                    <span 
                      className="text-[11px] font-black text-violet-800 dark:text-violet-350"
                      style={{ fontSize: activeConfig ? `${activeConfig.smartHintFontSize}px` : undefined }}
                    >
                      💡 {isSmartHintValid(secondSmartHintLine) ? secondSmartHintLine!.trim() : "—"}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      case "route_map":
        return null;
      case "price_details":
        return (
          <div key="pricing" className="bg-gradient-to-br from-purple-50/70 via-white to-slate-50/80 dark:from-purple-950/30 dark:via-slate-900 dark:to-slate-900 backdrop-blur-md rounded-[2rem] border-2 border-purple-500/80 dark:border-purple-500/70 border-r-[8px] border-r-purple-500 shadow-xl shadow-purple-500/10 ring-1 ring-purple-500/20 p-4 relative overflow-hidden transition-all duration-300 hover:shadow-2xl" style={blockStyle}>
            <div className="flex flex-row gap-4 items-start justify-between">
              <div className="flex-1 space-y-2 text-right">
                <div className="flex items-center gap-2 border-b border-slate-100 dark:border-white/5 pb-2">
                  <div className="h-8 w-8 rounded-lg bg-violet-50 dark:bg-violet-950/30 flex items-center justify-center text-violet-600">
                    <DynamicIcon icon={icons?.ui_package} fallback="📦" width={18} height={18} />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-violet-850 dark:text-violet-400">تفاصيل الطلب والأسعار</h3>
                  </div>
                </div>

                <div className="space-y-1.5 text-xs">
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-slate-400">نوع الطلب:</span>
                    <OrderTypeDetailBlock orderType={order.orderType} prefixClassName="font-black text-violet-950 bg-violet-100 px-1.5 py-0.5 rounded text-[11px] ring-1 ring-violet-300" restClassName="text-[11px] font-black text-slate-950 dark:text-white" />
                  </div>

                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-slate-400">وقت الطلب:</span>
                    <span className="font-black text-indigo-700 dark:text-indigo-400">{order.orderNoteTime || "فوري"}</span>
                  </div>

                  {!hideSubtotalInfo && (() => {
                    const subtotalVal = order.orderSubtotal != null ? Number(order.orderSubtotal) : 0;
                    const deliveryVal = order.deliveryPrice != null ? Number(order.deliveryPrice) : 0;
                    const totalVal = order.totalAmount != null ? Number(order.totalAmount) : 0;
                    
                    const calculatedDebt = totalVal - (subtotalVal + deliveryVal);
                    const hasDebt = calculatedDebt > 0;

                    return (
                      <div className={`grid ${hasDebt ? 'grid-cols-3' : 'grid-cols-2'} gap-2 border-t border-slate-100/50 dark:border-white/5 pt-1.5`}>
                        <div className="flex flex-col gap-0.5">
                          <span className="text-[10px] text-slate-400 font-bold">سعر الطلب:</span>
                          <span className="font-mono font-black text-slate-900 dark:text-white">
                            {order.orderSubtotal != null ? `${formatDinarAsAlf(order.orderSubtotal)} الف` : "—"}
                          </span>
                        </div>
                        
                        {hasDebt && (
                          <div className="flex flex-col gap-0.5">
                            <span className="text-[10px] text-rose-500 font-bold">الدين:</span>
                            <span className="font-mono font-black text-rose-600 dark:text-rose-400">
                              {`${formatDinarAsAlf(calculatedDebt)} الف`}
                            </span>
                          </div>
                        )}
                        
                        <div className="flex flex-col gap-0.5">
                          <span className="text-[10px] text-slate-400 font-bold">التوصيل:</span>
                          <span className="font-mono font-black text-slate-900 dark:text-white">
                            {order.deliveryPrice != null ? `${formatDinarAsAlf(order.deliveryPrice)} الف` : "—"}
                          </span>
                        </div>
                      </div>
                    );
                  })()}
                </div>

                <div className="flex flex-col items-center justify-center rounded-xl border border-violet-500/20 bg-violet-50/5 dark:bg-violet-950/10 p-2 text-center shadow-inner mt-2">
                  <p className="text-[9px] font-black text-violet-900 dark:text-violet-400 uppercase tracking-widest mb-0.5">المبلغ الكلي المطلوب</p>
                  <p className="font-mono text-xl font-black text-violet-950 dark:text-violet-100 tabular-nums">
                    {order.prepaidAll ? "كل شي واصل" : (order.totalAmount != null ? formatDinarAsAlfWithUnit(order.totalAmount) : "—")}
                  </p>
                </div>
              </div>

              {/* Order Package Photo */}
              <div className="w-[170px] xs:w-[195px] sm:w-[240px] md:w-[270px] flex flex-col items-center justify-start shrink-0 self-start gap-2">
                <span className="text-xs font-black text-slate-500 dark:text-slate-400">صورة الطلبية</span>
                {order.imageUrl ? (
                  <div className="w-full flex flex-col items-center gap-1">
                    <div className="aspect-square w-full overflow-hidden rounded-2xl border-2 border-sky-300 dark:border-white/10 shadow-lg bg-white">
                      <img src={imgSrc(order.imageUrl)!} alt="" className="h-full w-full object-contain cursor-zoom-in" onClick={() => setPreviewImageUrl(imgSrc(order.imageUrl))} />
                    </div>
                    {order.orderImageUploadedByName?.trim() ? (
                      <div className="mt-0.5"><ImageUploaderCaption name={order.orderImageUploadedByName} /></div>
                    ) : null}
                  </div>
                ) : (
                  <div className="aspect-square w-full flex items-center justify-center bg-white dark:bg-slate-800 rounded-2xl border-2 border-dashed border-slate-300 dark:border-slate-700 text-xs text-slate-400 font-bold text-center p-2">
                    لا توجد صورة
                  </div>
                )}
                <div className="w-full"><MandoubOrderImageQuick orderId={order.id} nextUrl={nextUrl} auth={auth} /></div>
              </div>
            </div>
          </div>
        );
      case "notes_summary": {
        const hasVoiceNote = Boolean(order.voiceNoteUrl?.trim() || order.adminVoiceNoteUrl?.trim());
        const hasSummary = Boolean(order.summary?.trim());
        const showNotes = courierSettings?.showNotesBtn !== false;
        const showVoice = courierSettings?.showVoiceNotesBtn !== false;

        if ((!hasVoiceNote || !showVoice) && (!hasSummary || !showNotes)) return null;

        return (
          <div key="notes" className="bg-gradient-to-br from-amber-50/70 via-white to-slate-50/80 dark:from-amber-950/30 dark:via-slate-900 dark:to-slate-900 backdrop-blur-md rounded-[2.5rem] border-2 border-amber-500/80 dark:border-amber-500/70 border-r-[8px] border-r-amber-500 shadow-xl shadow-amber-500/10 ring-1 ring-amber-500/20 p-6 text-right" style={blockStyle}>
            <div className="flex items-center gap-2 border-b border-slate-100 dark:border-white/5 pb-3 mb-4">
              <div className="h-10 w-10 rounded-xl bg-amber-50 dark:bg-amber-950/30 flex items-center justify-center text-amber-600">
                <DynamicIcon icon={icons?.ui_note} fallback="📝" width={22} height={22} />
              </div>
              <div>
                <h3 className="text-base font-black text-amber-800 dark:text-amber-400">ملاحظات وقائمة المواد</h3>
                <p className="text-[10px] font-bold text-slate-400">البصمات الصوتية المسجلة وتفاصيل طلب العميل</p>
              </div>
            </div>
            
            <div className="flex flex-col gap-4">
              {hasVoiceNote && showVoice && (
                <div className="flex flex-col gap-3 rounded-2xl border border-amber-100 dark:border-amber-900/20 bg-amber-50/20 p-4">
                  {order.voiceNoteUrl?.trim() && (
                    <div className="flex flex-col gap-1.5">
                      <span className="flex items-center gap-1 text-[10px] font-black text-amber-800 dark:text-amber-400">
                        <DynamicIcon icon={icons?.ui_audio} fallback="🎤" width={11} height={11} /> بصمة الزبون/المحل:
                      </span>
                      <VoiceNoteAudio src={resolvePublicAssetSrc(order.voiceNoteUrl) || ""} />
                    </div>
                  )}
                  {order.adminVoiceNoteUrl?.trim() && (
                    <div className="flex flex-col gap-1.5">
                      <span className="flex items-center gap-1 text-[10px] font-black text-amber-850 dark:text-amber-400">
                        <DynamicIcon icon={icons?.ui_audio} fallback="🎤" width={11} height={11} /> بصمة الإدارة والتجهيز:
                      </span>
                      <VoiceNoteAudio src={resolvePublicAssetSrc(order.adminVoiceNoteUrl) || ""} />
                    </div>
                  )}
                </div>
              )}
              {hasSummary && showNotes && (
                <ClickableNotesCard text={order.summary ?? ""}>
                  <div className="whitespace-pre-wrap p-5 pt-9 text-sm font-black text-slate-800 dark:text-slate-200 leading-relaxed pr-1">
                    {normalizeOrderSummaryText(order.summary)}
                  </div>
                </ClickableNotesCard>
              )}
            </div>
          </div>
        );
      }
      case "money_flow":
        // Always show money_flow regardless of bConf.hidden to ensure it appears at the end of the order
        return (
          <MandoubOrderMoneyFlow
            key="money"
            orderId={order.id}
            orderNumber={order.orderNumber}
            courierName={order.courier?.name ?? "—"}
            orderStatus={order.status}
            missingCustomerLocation={missingCustomerLocation}
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
        );
      default: return null;
    }
  };

  // الترتيب المطلوب: المحل أولاً، ثم الزبون، ثم تفاصيل الطلب والأسعار
  const layout = ["shop_info", "customer_info", "price_details", "notes_summary", "money_flow"];

  const [customerDebt, setCustomerDebt] = useState<number | null>(null);

  useEffect(() => {
    if (order.customerPhone) {
      import("@/app/abo1stor3hlaa2kbr8-47/(dashboard)/credit-book/actions").then(({ getCustomerDebtByPhone }) => {
        getCustomerDebtByPhone(order.customerPhone).then(setCustomerDebt);
      });
    }
  }, [order.customerPhone]);

  return (
    <section
      style={customStyle}
      className={`kse-glass-dark relative mt-4 border p-4 pb-32 text-base leading-relaxed sm:p-5 sm:pb-36 ${!uiSettings ? orderStatusStartStripeClass(order.status) : ''} ${
        !uiSettings && order.prepaidAll ? "border-emerald-300/85 bg-gradient-to-b from-emerald-50/70 via-white/90 to-teal-50/40 ring-2 ring-emerald-200/55 shadow-[0_0_0_1px_rgba(16,185,129,0.08)]" :
        !uiSettings && reversePickup ? "border-violet-400 bg-violet-100 shadow-md" :
        !uiSettings && missingCustomerLocation ? "border-sky-200 bg-rose-50/30 ring-2 ring-rose-200" : (!uiSettings ? `border-sky-200 ${orderStatusDetailSurfaceClass(order.status)}` : "")
      }`}
    >

      {customerDebt !== null && customerDebt > 0 && (
        <div className="mb-4 rounded-2xl border-4 border-amber-500 bg-amber-50 p-4 text-right shadow-md animate-pulse z-20 relative">
          <p className="text-sm font-black text-amber-900 flex items-center gap-2">
            <span>⚠️ تنبيه للمندوب:</span>
            هذا الزبون مطلوب للإدارة مبلغ وقدره: ({formatDinarAsAlfWithUnit(customerDebt)})
          </p>
        </div>
      )}
      {bgImage && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundImage: `url(${bgImage})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            opacity: bgOpacity,
            zIndex: 0,
            pointerEvents: 'none'
          }}
        />
      )}
      <div className="relative z-10">
        {reversePickup && <div className="mb-4 rounded-xl border border-violet-300 bg-violet-50 px-3 py-2 text-sm font-bold text-violet-950">تنبيه طلب عكسي استلام من الزبون وتسليم للعميل</div>}
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

        <Suspense fallback={null}><MandoubLocFlashBanner /></Suspense>

        {isDoubleRoute && (
          <div className="mb-4">
            <TwoWayOrderActionButtons
              orderId={order.id}
              orderNumber={order.orderNumber}
              orderStatus={order.status}
              routeMode={order.routeMode || "double"}
              senderName="المرسل"
              senderPhone={order.customerPhone}
              senderAlternatePhone={mergedAlternate}
              senderRegionName={order.customerRegion?.name}
              senderHasLocation={!missingCustomerLocation}
              senderGpsUploaded={Boolean(order.customerLocationSetByCourierAt)}
              recipientName="المستلم"
              recipientPhone={order.secondCustomerPhone || order.customerPhone}
              recipientAlternatePhone={mergedSecondAlternate}
              recipientRegionName={order.secondCustomerRegion?.name}
              recipientHasLocation={!!secondLocMerged}
              subtotal={order.orderSubtotal != null ? Number(order.orderSubtotal) : "0"}
              delivery={order.deliveryPrice != null ? Number(order.deliveryPrice) : "0"}
              total={order.totalAmount != null ? Number(order.totalAmount) : "0"}
              notes={order.summary}
              deliveryName={currentCourierName}
            />
          </div>
        )}

        <MandoubFloatingBar
          orderId={order.id}
          shopPhone={shopContactPhone}
          customerPhone={order.customerPhone}
          customerAlternatePhone={mergedAlternate || ""}
          secondCustomerPhone={order.secondCustomerPhone || ""}
          secondCustomerAlternatePhone={mergedSecondAlternate || ""}
          preparerPhone={order.submittedByCompanyPreparer?.phone ?? ""}
          orderStatus={order.status}
          orderNumber={order.orderNumber}
          shopName={order.shop.name}
          city={order.customerRegion?.name ?? ""}
          totalPrice={currentTotalPriceStr}
          deliveryName={currentCourierName}
          customerLocationUrl={mergedCustomerLocationUrl}
          customerLandmark={mergedLandmark}
          hasCustomerLocation={!missingCustomerLocation}
          hasCourierUploadedLocation={Boolean(order.customerLocationSetByCourierAt)}
          showCallBtn={courierSettings?.showCallBtn !== false}
          showWhatsAppBtn={courierSettings?.showWhatsAppBtn !== false}
          isDoubleRoute={isDoubleRoute}
        />

        {isModal ? (
          <div className="flex items-center justify-between pb-2 mb-1 border-b border-slate-100 dark:border-white/5">
            <span className="text-xs font-bold text-slate-500">تفاصيل الطلب والخطوات:</span>
            <MandoubOrderDetailActions closeHref={closeHref} orderId={order.id} onCloseModal={onCloseModal} />
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-2 border-b border-sky-100 dark:border-white/10 pb-3 sm:grid-cols-[1fr_auto] sm:items-center">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-black text-slate-900 dark:text-white">رقم الطلب <span className="tabular-nums text-sky-800 dark:text-sky-400">#{order.orderNumber}</span></h2>
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${orderStatusBadgeClass(order.status)}`}>{STATUS_AR[order.status] ?? order.status}</span>
              <p className="text-[11px] font-black text-sky-700 bg-sky-50 px-2 py-0.5 rounded border border-sky-100 flex items-center gap-1 dark:bg-sky-950/30 dark:text-sky-300 dark:border-sky-900/40">
                📅 {formatBaghdadDateTime(order.createdAt)}
              </p>
              <p className="text-[11px] font-black text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-100 flex items-center gap-1 dark:bg-rose-950/30 dark:text-rose-300 dark:border-rose-900/40">
                ⏰ {order.orderNoteTime || "فوري"}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <MandoubOrderDetailActions closeHref={closeHref} orderId={order.id} onCloseModal={onCloseModal} />
            </div>
          </div>
        )}

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

        <div className="mt-5 space-y-6">
          {layout.map((blockId) => renderBlock(blockId))}
        </div>
      </div>

      {/* مودال معاينة الصور التفاعلي الأنيق الداعم للتكبير بالإصبعين والسحب */}
      {previewImageUrl && (
        <ImageZoomModal
          imageUrl={previewImageUrl}
          onClose={() => setPreviewImageUrl(null)}
        />
      )}

    </section>
  );
}
