"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
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
import { NotesCopyButton } from "@/components/notes-copy-button";
import { ImageUploaderCaption } from "@/components/image-uploader-caption";
import { OrderTypeDetailBlock } from "@/components/order-type-line";
import { telHref, whatsappMeUrl } from "@/lib/whatsapp";
import { IconPhone, IconWa } from "@/components/order-fab-dock";
import { UISectionConfig } from "@/lib/ui-settings";
import { ADMIN_PHONE_FROM_SHOP_LOCAL } from "@/lib/admin-order-from-admin-constants";
import { GlobalIconsConfig } from "@/lib/icon-settings";
import { DynamicIcon } from "@/components/dynamic-icon";

const STATUS_AR: Record<string, string> = {
  assigned: "بانتظار المندوب",
  delivering: "عند المندوب (تم الاستلام)",
  delivered: "تم التسليم",
};

function imgSrc(url: string): string | null {
  return resolvePublicAssetSrc(url);
}

function contactLine(phone: string): string {
  const t = phone.trim();
  return t || "—";
}

const locBtnEmerald =
  "inline-flex min-h-[34px] max-w-full items-center justify-center rounded-lg bg-emerald-600 px-2.5 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-emerald-700 sm:px-3 sm:text-[13px]";
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
  auth,
  nextUrl,
  viewerCourierId,
  phoneProfile,
  secondPhoneProfile,
  smartHintLine,
  uiSettings,
  icons,
  courierSettings,
}: {
  order: MandoubOrderDetailPayload;
  closeHref: string;
  auth: { c: string; exp: string; s: string };
  nextUrl: string;
  viewerCourierId?: string;
  phoneProfile?: any;
  secondPhoneProfile?: PhoneProfileFallback;
  smartHintLine?: string | null;
  uiSettings?: UISectionConfig | null;
  icons?: GlobalIconsConfig | null;
  routeHistory?: { lat: number; lng: number; recordedAt: string }[];
  courierSettings?: {
    showDoorBtn: boolean;
    showLocationBtn: boolean;
    showCallBtn: boolean;
    showWhatsAppBtn: boolean;
    showNotesBtn: boolean;
    showVoiceNotesBtn: boolean;
  };
}) {
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);

  const shopImageUrl = order.shop.photoUrl?.trim() || order.shopDoorPhotoUrl?.trim() || "";
  const isAdminPortal = order.submissionSource === "admin_portal";
  const submitterName = order.submittedByCompanyPreparer?.name?.trim() || order.submittedBy?.name?.trim() || (isAdminPortal && !order.submittedBy ? "الإدارة" : "—");
  const shopContactPhone = order.submittedByCompanyPreparer?.phone?.trim() || order.submittedBy?.phone?.trim() || (isAdminPortal && !order.submittedBy ? ADMIN_PHONE_FROM_SHOP_LOCAL : order.shop.phone?.trim() || "");
  const customerDoorDisplay =
    order.customerDoorPhotoUrl?.trim() ||
    order.customer?.customerDoorPhotoUrl?.trim() ||
    phoneProfile?.photoUrl?.trim() ||
    "";
  const mergedCustomerLocationUrl =
    order.customerLocationUrl?.trim() ||
    order.customer?.customerLocationUrl?.trim() ||
    phoneProfile?.locationUrl?.trim() ||
    "";
  const mergedLandmark =
    order.customerLandmark?.trim() ||
    order.customer?.customerLandmark?.trim() ||
    phoneProfile?.landmark?.trim() ||
    "";
  const mergedAlternate =
    order.secondCustomerPhone?.trim() ||
    order.alternatePhone?.trim() ||
    order.customer?.alternatePhone?.trim() ||
    phoneProfile?.alternatePhone?.trim() ||
    "";
  const secondLocMerged =
    order.secondCustomerLocationUrl?.trim() || secondPhoneProfile?.locationUrl?.trim() || "";
  const secondDoorMerged =
    order.secondCustomerDoorPhotoUrl?.trim() || secondPhoneProfile?.photoUrl?.trim() || "";
  const secondLandmarkMerged =
    order.secondCustomerLandmark?.trim() || secondPhoneProfile?.landmark?.trim() || "";
  const secondDoorCaptionName =
    secondDoorMerged && order.secondCustomerDoorPhotoUploadedByName?.trim()
      ? order.secondCustomerDoorPhotoUploadedByName
      : null;
  const isDoubleRoute = order.routeMode === "double";
  const missingCustomerLocation = !hasCustomerLocationUrl(mergedCustomerLocationUrl, undefined);
  const prepJson = order.preparerShoppingJson as any;
  const hideSubtotalInfo = prepJson?.hidePricesFromCourier === true;
  const reversePickup = isReversePickupOrderType(order.orderType);

  const customStyle = uiSettings ? {
    backgroundColor: uiSettings.statusStyles?.[order.status]?.backgroundColor || uiSettings.backgroundColor,
    color: uiSettings.statusStyles?.[order.status]?.textColor || uiSettings.textColor,
    opacity: uiSettings.backgroundOpacity,
    borderRadius: uiSettings.borderRadius,
    fontSize: uiSettings.fontSize,
    position: 'relative' as const,
    overflow: 'hidden' as const,
  } : {};

  const bgImage = uiSettings?.statusStyles?.[order.status]?.backgroundImage || uiSettings?.backgroundImage;
  const bgOpacity = uiSettings?.backgroundImageOpacity ?? 1;

  const renderBlock = (blockId: string) => {
    const bConf = uiSettings?.blockConfigs?.[blockId] || {};
    if (bConf.hidden && blockId !== "money_flow") return null;

    const blockStyle = {
      backgroundColor: bConf.backgroundColor,
      fontSize: bConf.fontSize,
      gridColumn: bConf.fullWidth ? "span 2 / span 2" : "auto"
    };

    const isDoubleRoute = order.routeMode === "double";

    switch (blockId) {
      case "shop_info":
        if (isDoubleRoute) return null;
        return (
          <div key="shop" className="bg-white/80 dark:bg-slate-900/85 backdrop-blur-md rounded-[2rem] border border-slate-200 dark:border-white/10 shadow-lg p-4 relative overflow-hidden transition-all duration-305 hover:shadow-xl" style={blockStyle}>
            <div className="flex flex-row gap-4 items-start justify-between">
              <div className="flex-1 space-y-2 text-right">
                <div className="flex items-center gap-2 border-b border-slate-100 dark:border-white/5 pb-2">
                  <div className="h-8 w-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 flex items-center justify-center text-emerald-600">
                    <DynamicIcon icon={icons?.ui_shops} fallback="🏢" width={18} height={18} />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-emerald-800 dark:text-emerald-400">معلومات المحل (المرسل)</h3>
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
                    <span className="font-bold text-slate-800 dark:text-slate-200">{order.shop.region.name}</span>
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
                    <a href={order.shop.locationUrl} target="_blank" rel="noopener noreferrer" className="inline-flex h-8 items-center justify-center rounded-xl bg-emerald-600 px-3 text-[11px] font-black text-white hover:bg-emerald-700 transition-all gap-1 shadow-sm max-w-full">
                      📍 موقع المحل <DynamicIcon icon={icons?.ui_external_link} fallback="↗" width={10} height={10} />
                    </a>
                  ) : (
                    <div className="inline-block p-1.5 bg-amber-50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/30 rounded-xl text-center text-[10px] font-bold text-amber-800">
                      ⚠️ لا يوجد موقع جغرافي
                    </div>
                  )}
                </div>
              </div>

              {/* Shop Door / Logo Photo */}
              <div className="w-[130px] sm:w-[160px] flex flex-col items-center justify-start shrink-0 self-start gap-2">
                <span className="text-[10px] font-black text-slate-400">صورة المحل</span>
                {shopImageUrl ? (
                  <div className="aspect-square w-full overflow-hidden rounded-2xl border border-sky-200 dark:border-white/10 shadow-md">
                    <img src={imgSrc(shopImageUrl)!} alt="" className="h-full w-full object-cover cursor-zoom-in hover:scale-105 transition duration-300" onClick={() => setPreviewImageUrl(imgSrc(shopImageUrl))} />
                  </div>
                ) : (
                  <div className="aspect-square w-full flex items-center justify-center bg-slate-100 dark:bg-slate-800 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 text-[10px] text-slate-400 font-bold text-center p-2">
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
            <div key="customer" className="bg-white/80 dark:bg-slate-900/85 backdrop-blur-md rounded-[2rem] border border-slate-200 dark:border-white/10 shadow-lg p-4 relative overflow-hidden transition-all duration-300 hover:shadow-xl" style={blockStyle}>
              <div className="flex flex-row gap-4 items-start justify-between">
                <div className="flex-1 space-y-2 text-right">
                  <div className="flex items-center gap-2 border-b border-slate-100 dark:border-white/5 pb-2">
                    <div className="h-8 w-8 rounded-lg bg-sky-50 dark:bg-sky-950/30 flex items-center justify-center text-sky-600">
                      <DynamicIcon icon={icons?.ui_user} fallback="👤" width={18} height={18} />
                    </div>
                    <div>
                      <h3 className="text-sm font-black text-sky-950 dark:text-sky-400">
                        {isDoubleRoute ? "المرسل (الوجهة الأولى)" : "الزبون (المستلم)"}
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
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-slate-400 text-sm" title="الهاتف البديل">📱</span>
                        <span className="font-mono font-bold text-slate-600 dark:text-slate-400">{mergedAlternate}</span>
                      </div>
                    )}

                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-bold text-slate-400 text-sm" title="أقرب نقطة دالة">🗺️</span>
                      <span className="font-bold text-slate-800 dark:text-slate-200">{mergedLandmark || "—"}</span>
                    </div>

                    {smartHintLine?.trim() && (
                      <div className="flex flex-col gap-0.5 rounded-lg bg-emerald-50/50 dark:bg-emerald-950/10 p-1.5 border border-emerald-100/50 dark:border-emerald-900/20">
                        <span className="text-[9px] font-black text-emerald-600 dark:text-emerald-400">💡 الاستدلال الذكي للعنوان:</span>
                        <span className="text-[11px] font-black text-emerald-800 dark:text-emerald-350">{smartHintLine.trim()}</span>
                      </div>
                    )}
                  </div>

                  <div className="pt-1.5">
                    {courierSettings?.showLocationBtn !== false && (
                      <div className="max-w-full">
                        {mergedCustomerLocationUrl ? (
                          <a href={mergedCustomerLocationUrl} target="_blank" rel="noopener noreferrer" className="inline-flex h-8 items-center justify-center rounded-xl bg-emerald-600 px-3 text-[11px] font-black text-white hover:bg-emerald-700 transition-all gap-1 shadow-sm">
                            📍 موقع الزبون <DynamicIcon icon={icons?.ui_external_link} fallback="↗" width={10} height={10} />
                          </a>
                        ) : (
                          <div className="p-1 rounded-xl bg-slate-50 dark:bg-black/10 border border-slate-100 dark:border-white/5 transform scale-90 origin-right">
                            <MandoubUploadLocationInline orderId={order.id} auth={auth} nextUrl={nextUrl} />
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Customer Door Photo */}
                <div className="w-[130px] sm:w-[160px] flex flex-col items-center justify-start shrink-0 self-start gap-2">
                  <span className="text-[10px] font-black text-slate-400">صورة الباب</span>
                  {customerDoorDisplay ? (
                    <div className="aspect-square w-full overflow-hidden rounded-2xl border border-sky-200 dark:border-white/10 shadow-md">
                      <img src={imgSrc(customerDoorDisplay)!} alt="" className="h-full w-full object-cover cursor-zoom-in hover:scale-105 transition duration-300" onClick={() => setPreviewImageUrl(imgSrc(customerDoorDisplay))} />
                    </div>
                  ) : (
                    <div className="aspect-square w-full flex items-center justify-center bg-white dark:bg-slate-800 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 text-[10px] text-slate-400 font-bold text-center p-2">
                      لا توجد صورة
                    </div>
                  )}
                  {courierSettings?.showDoorBtn !== false && (
                    <div className="w-full"><MandoubQuickDoorCapture orderId={order.id} nextUrl={nextUrl} auth={auth} /></div>
                  )}
                </div>
              </div>
            </div>

            {order.routeMode === "double" && (
              <div key="receiver" className="bg-white/80 dark:bg-slate-900/85 backdrop-blur-md rounded-[2rem] border border-slate-200 dark:border-white/10 shadow-lg p-4 relative overflow-hidden transition-all duration-300 hover:shadow-xl mt-3" style={blockStyle}>
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

                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-bold text-slate-400 text-sm" title="أقرب نقطة دالة">🗺️</span>
                        <span className="font-bold text-slate-800 dark:text-slate-200">{secondLandmarkMerged || "—"}</span>
                      </div>
                    </div>

                    <div className="pt-1.5">
                      {courierSettings?.showLocationBtn !== false && (
                        <div className="max-w-full">
                          {secondLocMerged ? (
                            <a href={secondLocMerged} target="_blank" rel="noopener noreferrer" className="inline-flex h-8 items-center justify-center rounded-xl bg-emerald-600 px-3 text-[11px] font-black text-white hover:bg-emerald-700 transition-all gap-1 shadow-sm">
                              📍 موقع المستلم <DynamicIcon icon={icons?.ui_external_link} fallback="↗" width={10} height={10} />
                            </a>
                          ) : (
                            <div className="p-1 rounded-xl bg-slate-50 dark:bg-black/10 border border-slate-100 dark:border-white/5 transform scale-90 origin-right">
                              <MandoubUploadLocationInline orderId={order.id} auth={auth} nextUrl={nextUrl} target="second" />
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Second Customer Door Photo */}
                  <div className="w-[130px] sm:w-[160px] flex flex-col items-center justify-start shrink-0 self-start gap-2">
                    <span className="text-[10px] font-black text-slate-400">صورة باب المستلم</span>
                    {secondDoorMerged && imgSrc(secondDoorMerged) ? (
                      <div className="w-full flex flex-col items-center gap-1">
                        <div className="aspect-square w-full overflow-hidden rounded-2xl border border-sky-200 dark:border-white/10 shadow-md relative">
                          <img src={imgSrc(secondDoorMerged)!} alt="" className="h-full w-full object-cover cursor-zoom-in hover:scale-105 transition duration-300" onClick={() => setPreviewImageUrl(imgSrc(secondDoorMerged))} />
                        </div>
                        {secondDoorCaptionName ? <div className="mt-1"><ImageUploaderCaption name={secondDoorCaptionName} /></div> : null}
                      </div>
                    ) : (
                      <div className="aspect-square w-full flex items-center justify-center bg-white dark:bg-slate-800 rounded-2xl border border-dashed border-slate-350 dark:border-slate-700 text-xs text-slate-400 font-bold">
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
              </div>
            )}
          </div>
        );
      case "route_map":
        return null;
      case "price_details":
        return (
          <div key="pricing" className="bg-white/80 dark:bg-slate-900/85 backdrop-blur-md rounded-[2rem] border border-slate-200 dark:border-white/10 shadow-lg p-4 relative overflow-hidden transition-all duration-300 hover:shadow-xl" style={blockStyle}>
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

                  {order.orderNoteTime && (
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-slate-400">وقت الطلب:</span>
                      <span className="font-black text-indigo-700 dark:text-indigo-400">{order.orderNoteTime}</span>
                    </div>
                  )}

                  {!hideSubtotalInfo && (
                    <div className="grid grid-cols-2 gap-2 border-t border-slate-100/50 dark:border-white/5 pt-1.5">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-[10px] text-slate-400 font-bold">سعر الطلب:</span>
                        <span className="font-mono font-black text-slate-900 dark:text-white">{order.orderSubtotal != null ? `${formatDinarAsAlf(order.orderSubtotal)} الف` : "—"}</span>
                      </div>
                      <div className="flex flex-col gap-0.5">
                        <span className="text-[10px] text-slate-400 font-bold">التوصيل:</span>
                        <span className="font-mono font-black text-slate-900 dark:text-white">{order.deliveryPrice != null ? `${formatDinarAsAlf(order.deliveryPrice)} الف` : "—"}</span>
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex flex-col items-center justify-center rounded-xl border border-violet-500/20 bg-violet-50/5 dark:bg-violet-950/10 p-2 text-center shadow-inner mt-2">
                  <p className="text-[9px] font-black text-violet-900 dark:text-violet-400 uppercase tracking-widest mb-0.5">المبلغ الكلي المطلوب</p>
                  <p className="font-mono text-xl font-black text-violet-950 dark:text-violet-100 tabular-nums">{order.totalAmount != null ? formatDinarAsAlfWithUnit(order.totalAmount) : "—"}</p>
                </div>
              </div>

              {/* Order Package Photo */}
              <div className="w-[130px] sm:w-[160px] flex flex-col items-center justify-start shrink-0 self-start gap-2">
                <span className="text-[10px] font-black text-slate-400">صورة الطلبية</span>
                {order.imageUrl ? (
                  <div className="aspect-square w-full overflow-hidden rounded-2xl border border-sky-200 dark:border-white/10 shadow-md bg-white">
                    <img src={imgSrc(order.imageUrl)!} alt="" className="h-full w-full object-contain cursor-zoom-in" onClick={() => setPreviewImageUrl(imgSrc(order.imageUrl))} />
                  </div>
                ) : (
                  <div className="aspect-square w-full flex items-center justify-center bg-white dark:bg-slate-800 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 text-[10px] text-slate-400 font-bold text-center p-2">
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
          <div key="notes" className="bg-white/80 dark:bg-slate-900/85 backdrop-blur-md rounded-[2.5rem] border border-slate-200 dark:border-white/10 shadow-xl p-6 text-right" style={blockStyle}>
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
                <div className="relative rounded-2xl border border-amber-200 dark:border-amber-900/40 bg-amber-50/10 p-5 shadow-inner">
                  <div className="absolute end-4 top-4"><NotesCopyButton text={order.summary ?? ""} /></div>
                  <div className="whitespace-pre-wrap text-sm font-black text-slate-800 dark:text-slate-200 leading-relaxed pr-1">{order.summary}</div>
                </div>
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
          />
        );
      default: return null;
    }
  };

  // Enforce a strict vertical stacked sequence for the courier as requested
  const layout = ["shop_info", "customer_info", "price_details", "money_flow", "notes_summary"];

  return (
    <section
      style={customStyle}
      className={`kse-glass-dark relative mt-4 border p-4 pb-32 text-base leading-relaxed sm:p-5 sm:pb-36 ${!uiSettings ? orderStatusStartStripeClass(order.status) : ''} ${
        !uiSettings && order.prepaidAll ? "border-emerald-300/85 bg-gradient-to-b from-emerald-50/70 via-white/90 to-teal-50/40 ring-2 ring-emerald-200/55 shadow-[0_0_0_1px_rgba(16,185,129,0.08)]" :
        !uiSettings && reversePickup ? "border-violet-400 bg-violet-100 shadow-md" :
        !uiSettings && missingCustomerLocation ? "border-sky-200 bg-rose-50/30 ring-2 ring-rose-200" : (!uiSettings ? `border-sky-200 ${orderStatusDetailSurfaceClass(order.status)}` : "")
      }`}
    >
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
        {order.prepaidAll && (<div className="relative mb-4 overflow-hidden rounded-2xl border-2 border-emerald-400/55 bg-gradient-to-br from-emerald-100/90 via-teal-50/85 to-cyan-50/75 p-4 sm:p-5 shadow-xl"><div className="relative flex flex-col items-center gap-4 sm:flex-row sm:items-start"><div className="flex size-[4rem] shrink-0 items-center justify-center rounded-2xl bg-white/95 shadow-md"><svg className="size-10 text-emerald-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /></svg></div><p className="text-xl font-black text-emerald-950 sm:text-2xl text-center sm:text-right">الطلب واصل اخذ التوصيل من العميل</p></div></div>)}

        <Suspense fallback={null}><MandoubLocFlashBanner /></Suspense>

        <MandoubFloatingBar
          orderId={order.id} shopPhone={shopContactPhone} customerPhone={order.customerPhone} customerAlternatePhone={order.secondCustomerPhone?.trim() || mergedAlternate || ""} preparerPhone={order.submittedByCompanyPreparer?.phone ?? ""} orderStatus={order.status} orderNumber={order.orderNumber} shopName={order.shop.name} city={order.customerRegion?.name ?? ""} totalPrice={order.totalAmount != null ? formatDinarAsAlf(order.totalAmount) : ""} deliveryName={order.courier?.name ?? ""} customerLocationUrl={mergedCustomerLocationUrl} customerLandmark={mergedLandmark} hasCustomerLocation={!missingCustomerLocation} hasCourierUploadedLocation={Boolean(order.customerLocationSetByCourierAt)}
          showCallBtn={courierSettings?.showCallBtn !== false}
          showWhatsAppBtn={courierSettings?.showWhatsAppBtn !== false}
        />

        <div className="grid grid-cols-1 gap-3 border-b border-sky-100 pb-3 sm:grid-cols-[1fr_auto] sm:items-center">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-xl font-black text-slate-900 sm:text-2xl">رقم الطلب <span className="tabular-nums text-sky-800">#{order.orderNumber}</span></h2>
             <p className="text-[11px] font-black text-sky-700 bg-sky-50 px-2 py-0.5 rounded border border-sky-100 flex items-center gap-1">
               📅 تاريخ الرفع: {formatBaghdadDateTime(order.createdAt)}
             </p>
             <p className="text-[11px] font-black text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-100 flex items-center gap-1">
               ⏰ وقت الطلب (المطلوب): {order.orderNoteTime || "فوري"}
             </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <MandoubOrderDetailActions closeHref={closeHref} orderId={order.id} />
            <span className={`rounded-full px-3 py-1.5 text-xs font-bold ${orderStatusBadgeClass(order.status)}`}>{STATUS_AR[order.status] ?? order.status}</span>
          </div>
        </div>

        <MandoubCustomerEditForm orderId={order.id} defaultOrderStatus={order.status} defaultCustomerPhone={order.customerPhone} defaultCustomerLocationUrl={mergedCustomerLocationUrl} defaultCustomerLandmark={mergedLandmark} defaultAlternatePhone={mergedAlternate} auth={auth} nextUrl={nextUrl} />

        <div className="mt-5 space-y-6">
          {layout.map((blockId) => renderBlock(blockId))}
        </div>
      </div>

      {/* مودال معاينة الصور التفاعلي الأنيق في نفس الصفحة باستخدام React Portal لتجنب مشاكل التموضع */}
      {previewImageUrl && typeof document !== "undefined" && createPortal(
        <div 
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/90 backdrop-blur-md p-4 transition-all duration-300 animate-fade-in"
          onClick={() => setPreviewImageUrl(null)}
        >
          <div className="relative w-full max-w-lg flex flex-col items-center justify-center" onClick={(e) => e.stopPropagation()}>
            {/* زر الإغلاق الأنيق في الأعلى بمنتصف العرض تماماً للمس مريح */}
            <button
              onClick={() => setPreviewImageUrl(null)}
              className="absolute -top-12 left-1/2 -translate-x-1/2 flex h-9 w-24 items-center justify-center gap-1.5 rounded-full bg-white/20 text-white hover:bg-white/35 border border-white/20 transition-all text-xs font-black shadow-xl active:scale-95"
              title="إغلاق المعاينة"
            >
              ✕ إغلاق
            </button>
            
            {/* إطار الصورة الفعلي */}
            <div className="overflow-hidden rounded-2xl border border-white/10 bg-slate-950/60 shadow-2xl p-1 max-w-[95vw] max-h-[75vh] flex items-center justify-center">
              <img 
                src={previewImageUrl} 
                alt="معاينة الصورة" 
                className="max-w-full max-h-[72vh] object-contain rounded-xl"
              />
            </div>
          </div>
        </div>,
        document.body
      )}
    </section>
  );
}
