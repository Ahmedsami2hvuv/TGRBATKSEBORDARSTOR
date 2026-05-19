"use client";

import Link from "next/link";
import type { MandoubOrderDetailPayload } from "@/lib/mandoub-order-queries";
import { dinarDecimalToAlfInputString, formatDinarAsAlf } from "@/lib/money-alf";
import { hasCustomerLocationUrl } from "@/lib/order-location";
import { isReversePickupOrderType } from "@/lib/order-type-flags";
import {
  orderStatusBadgeClass,
  orderStatusDetailSurfaceClass,
  orderStatusStartStripeClass,
} from "@/lib/order-status-style";
import { MandoubOrderDetailActions } from "@/app/mandoub/mandoub-order-detail-actions";
import { PreparerOrderEditPanel } from "./preparer-order-edit-panel";
import { ImageUploaderCaption } from "@/components/image-uploader-caption";
import { VoiceNoteAudio } from "@/components/voice-note-audio";
import { resolvePublicAssetSrc } from "@/lib/image-url";
import { PreparerOrderMoneyFlow } from "./preparer-order-money-flow";
import { PreparerDetailPhotoUploadRow } from "./preparer-order-detail-photo-buttons";
import { NotesCopyButton } from "@/components/notes-copy-button";
import { OrderTypeDetailBlock } from "@/components/order-type-line";
import { UISectionConfig } from "@/lib/ui-settings";
import { DynamicIcon } from "@/components/dynamic-icon";
import { type GlobalIconsConfig } from "@/lib/icon-settings";
import { useState } from "react";

const STATUS_AR: Record<string, string> = {
  pending: "جديد",
  assigned: "بانتظار المندوب",
  delivering: "عند المندوب (تم الاستلام)",
  delivered: "تم التسليم",
  cancelled: "مرفوض",
  archived: "مؤرشف",
};

function imgSrc(url: string): string | null {
  return resolvePublicAssetSrc(url);
}

function contactLine(phone: string): string {
  const t = phone.trim();
  return t || "—";
}

function formatOrderUploadDateBaghdad(createdAt: Date): string {
  return createdAt.toLocaleString("ar-IQ-u-nu-latn", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
    timeZone: "Asia/Baghdad",
  });
}

const locBtnEmerald =
  "inline-flex min-h-[34px] max-w-full items-center justify-center rounded-lg bg-emerald-600 px-2.5 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-emerald-700 sm:px-3 sm:text-[13px]";
const locBtnSecond =
  "inline-flex min-h-[34px] max-w-full items-center justify-center rounded-lg bg-violet-600 px-2.5 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-violet-700 sm:px-3 sm:text-[13px]";

const gridInfoPhoto =
  "grid grid-cols-[minmax(0,1fr)_minmax(0,12rem)] items-start gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.32fr)] sm:gap-6";

const squarePhotoFrame =
  "aspect-square w-full overflow-hidden rounded-xl border border-sky-200 bg-slate-50";
const squarePhotoCover = "h-full w-full object-cover";
const squarePhotoContain = "h-full w-full object-contain";

/** ترتيب ثابت لصفحة طلب المجهز — لا يعتمد على إعدادات لوحة التحكم حتى لا يُستبدل من قاعدة البيانات بالخطأ */
const PREPARER_ORDER_DETAIL_LAYOUT = [
  "preparer_voice_notes",
  "preparer_site_products",
  "preparer_shop_block",
  "preparer_shop_door",
  "preparer_customer_region",
  "preparer_prices",
  "preparer_order_image",
  "preparer_notes",
  "money_flow",
] as const;

function preparerShoppingAudioUrl(order: MandoubOrderDetailPayload): string {
  const j = order.preparerShoppingJson as { preparerAudioUrl?: string } | null | undefined;
  return j?.preparerAudioUrl?.trim() || "";
}

type PhoneProfileFallback = {
  locationUrl: string;
  landmark: string;
  photoUrl: string;
  alternatePhone: string | null;
} | null;

export function PreparerOrderDetailSection({
  order,
  closeHref,
  auth,
  nextUrl,
  preparerId,
  phoneProfile,
  secondPhoneProfile,
  uiSettings,
  icons,
  canEditPricing,
  pricingEditHref,
  productImagesMap,
  productBranchMap,
}: {
  order: MandoubOrderDetailPayload;
  closeHref: string;
  auth: { p: string; exp: string; s: string };
  nextUrl: string;
  preparerId: string;
  phoneProfile?: PhoneProfileFallback;
  secondPhoneProfile?: PhoneProfileFallback;
  uiSettings?: UISectionConfig | null;
  icons?: GlobalIconsConfig | null;
  canEditPricing?: boolean;
  pricingEditHref?: string;
  productImagesMap?: Record<string, string>;
  productBranchMap?: Record<string, string>;
}) {
  const [zoomImage, setZoomImage] = useState<{ url: string; title: string } | null>(null);

  const shopImageUrl = order.shop.photoUrl?.trim() || order.shopDoorPhotoUrl?.trim() || "";
  const shopContactPhone = order.shop.phone?.trim() || order.submittedBy?.phone?.trim() || "";
  const customerDoorDisplay = order.customerDoorPhotoUrl?.trim() || phoneProfile?.photoUrl?.trim() || "";
  const customerDoorCaptionName = customerDoorDisplay && order.customerDoorPhotoUploadedByName?.trim() ? order.customerDoorPhotoUploadedByName : null;
  const mergedCustomerLocationUrl = order.customerLocationUrl?.trim() || phoneProfile?.locationUrl?.trim() || "";
  const mergedLandmark = order.customerLandmark?.trim() || phoneProfile?.landmark?.trim() || "";
  const mergedAlternate = order.alternatePhone?.trim() || phoneProfile?.alternatePhone?.trim() || "";
  const visibleCustomerPhone = order.customerPhone?.trim() || "";
  const visibleMergedAlternate = visibleCustomerPhone ? mergedAlternate : "";
  const missingCustomerLocation = !hasCustomerLocationUrl(mergedCustomerLocationUrl, undefined);
  const hasCustomerLocation = !missingCustomerLocation;
  const hasCourierUploadedLocation = Boolean(order.customerLocationSetByCourierAt);
  const routeMode = order.routeMode ?? "single";
  const secondLocMerged = order.secondCustomerLocationUrl?.trim() || secondPhoneProfile?.locationUrl?.trim() || "";
  const secondDoorMerged = order.secondCustomerDoorPhotoUrl?.trim() || secondPhoneProfile?.photoUrl?.trim() || "";
  const secondLandmarkMerged = order.secondCustomerLandmark?.trim() || secondPhoneProfile?.landmark?.trim() || "";
  const reversePickup = isReversePickupOrderType(order.orderType);

  // الستايل الديناميكي
  const customStyle = uiSettings ? {
    backgroundColor: uiSettings.statusStyles?.[order.status]?.backgroundColor || uiSettings.backgroundColor,
    backgroundImage: uiSettings.statusStyles?.[order.status]?.backgroundImage ? `url(${uiSettings.statusStyles[order.status].backgroundImage})` : (uiSettings.backgroundImage ? `url(${uiSettings.backgroundImage})` : undefined),
    color: uiSettings.statusStyles?.[order.status]?.textColor || uiSettings.textColor,
    opacity: uiSettings.backgroundOpacity,
    borderRadius: uiSettings.borderRadius,
    fontSize: uiSettings.fontSize,
    backgroundSize: 'cover', backgroundPosition: 'center',
  } : {};

  const renderBlock = (blockId: string) => {
    const bConf = uiSettings?.blockConfigs?.[blockId] || {};
    if (bConf.hidden) return null;

    const blockStyle = {
      backgroundColor: bConf.backgroundColor,
      fontSize: bConf.fontSize,
      gridColumn: bConf.fullWidth ? "span 2 / span 2" : "auto"
    };

    switch (blockId) {
      case "preparer_voice_notes": {
        const prepAudio = preparerShoppingAudioUrl(order);
        const hasAny =
          Boolean(order.voiceNoteUrl?.trim()) ||
          Boolean(order.adminVoiceNoteUrl?.trim()) ||
          Boolean(prepAudio);
        if (!hasAny) return null;
        return (
          <div key="preparer_voice" className="rounded-xl border-2 border-amber-200 bg-amber-50/40 p-4" style={blockStyle}>
            <div className="mb-3 flex items-center gap-2">
              <DynamicIcon iconKey="ui_audio" config={icons} className="h-5 w-5 text-amber-800" fallback={<span>🎤</span>} />
              <h3 className="text-lg font-bold text-amber-950 sm:text-xl">الملاحظات الصوتية</h3>
            </div>
            <div className="flex flex-col gap-3">
              {order.voiceNoteUrl?.trim() ? (
                <div className="flex flex-col gap-1">
                  <span className="text-xs font-bold text-amber-900">من المحل أو الزبون</span>
                  <VoiceNoteAudio src={resolvePublicAssetSrc(order.voiceNoteUrl.trim()) || ""} />
                </div>
              ) : null}
              {order.adminVoiceNoteUrl?.trim() ? (
                <div className="flex flex-col gap-1">
                  <span className="text-xs font-bold text-amber-900">من الإدارة</span>
                  <VoiceNoteAudio src={resolvePublicAssetSrc(order.adminVoiceNoteUrl.trim()) || ""} />
                </div>
              ) : null}
              {prepAudio ? (
                <div className="flex flex-col gap-1">
                  <span className="text-xs font-bold text-amber-900">التجهيز</span>
                  <VoiceNoteAudio src={resolvePublicAssetSrc(prepAudio) || ""} />
                </div>
              ) : null}
            </div>
          </div>
        );
      }
      case "preparer_site_products": {
        const pJson = order.preparerShoppingJson as any;
        const products = pJson?.products as any[];
        if (!products || products.length === 0) return null;
        return (
          <div key="preparer_site_products" className="rounded-xl border-2 border-indigo-200 bg-indigo-50/30 p-4" style={blockStyle}>
            <div className="mb-3 flex items-center gap-2">
              <DynamicIcon iconKey="ui_package" config={icons} className="h-5 w-5 text-indigo-700" fallback={<span>📦</span>} />
              <h3 className="text-lg font-bold text-indigo-950 sm:text-xl">المواد المطلوبة</h3>
            </div>
            <div className="flex flex-col gap-2">
              {products.map((p, idx) => {
                const nameKey = p.line.trim().toLowerCase();
                const img = productImagesMap?.[nameKey];
                const branch = productBranchMap?.[nameKey];
                return (
                  <div key={idx} className="flex items-center gap-3 rounded-lg border border-indigo-100 bg-white p-2 shadow-sm">
                    {img && (
                      <button
                        type="button"
                        onClick={() => setZoomImage({ url: img, title: p.line })}
                        className="h-14 w-14 shrink-0 overflow-hidden rounded-lg border border-slate-100 bg-slate-50 active:scale-95 transition-transform"
                      >
                        <img src={resolvePublicAssetSrc(img)!} alt="" className="h-full w-full object-cover" />
                      </button>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-black text-slate-900">{p.line}</p>
                      {branch && (
                        <p className="mt-0.5 inline-block rounded bg-indigo-50 px-1.5 py-0.5 text-[10px] font-bold text-indigo-600">
                          📍 {branch}
                        </p>
                      )}
                      <div className="mt-1 flex items-center gap-2">
                         <span className="text-[10px] font-bold text-slate-500">بواسطة: {p.pricedBy || "—"}</span>
                         <span className="font-mono text-xs font-black text-emerald-600">{p.buyAlf} (شراء)</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      }
      case "preparer_shop_block": {
        const contactName =
          order.submittedBy?.name?.trim() ||
          order.submittedByCompanyPreparer?.name?.trim() ||
          "—";
        return (
          <div key="preparer_shop" className="rounded-xl border-2 border-emerald-200 bg-emerald-50/30 p-4" style={blockStyle}>
            <div className="mb-2 flex items-center gap-2">
              <DynamicIcon iconKey="ui_shops" config={icons} className="h-5 w-5 text-emerald-700" fallback={null} />
              <h3 className="text-lg font-bold text-emerald-900 sm:text-xl">اسم المحل</h3>
            </div>
            <p className="text-lg font-black leading-snug text-slate-900 dark:text-slate-100 sm:text-xl">{order.shop.name}</p>
            <div className="mt-3 flex flex-wrap items-center gap-1.5 text-base font-semibold text-slate-800 dark:text-slate-200">
              <DynamicIcon iconKey="ui_user" config={icons} className="h-4 w-4 text-slate-500" fallback={null} />
              <span className="text-slate-600">موظف المحل (المرسل): </span>
              <span className="font-bold text-slate-900">{contactName}</span>
            </div>
          </div>
        );
      }
      case "preparer_shop_door": {
        const doorRaw = order.shopDoorPhotoUrl?.trim() || "";
        const doorSrc = doorRaw ? imgSrc(doorRaw) : null;
        const shopPhotoRaw = order.shop.photoUrl?.trim() || "";
        const fallbackSrc = !doorSrc && shopPhotoRaw ? imgSrc(shopPhotoRaw) : null;
        const displaySrc = doorSrc || fallbackSrc;
        return (
          <div
            key="preparer_shop_door"
            className="mx-auto max-w-md rounded-xl border-2 border-emerald-200 bg-emerald-50/40 p-4 dark:border-emerald-800 dark:bg-emerald-950/25"
            style={blockStyle}
          >
            <div className="mb-2 flex items-center justify-center gap-2">
              <DynamicIcon iconKey="ui_shops" config={icons} className="h-5 w-5 text-emerald-700 dark:text-emerald-300" fallback={<span>🏪</span>} />
              <h3 className="text-center text-lg font-bold text-emerald-950 dark:text-emerald-100 sm:text-xl">صورة باب المحل (جهة العميل)</h3>
            </div>
            {displaySrc ? (
              <div>
                <div className={`${squarePhotoFrame} dark:border-emerald-800 dark:bg-slate-900`}>
                  <img src={displaySrc} alt="" className={squarePhotoCover} />
                </div>
                {doorSrc && order.shopDoorPhotoUploadedByName?.trim() ? (
                  <ImageUploaderCaption name={order.shopDoorPhotoUploadedByName} />
                ) : null}
                {!doorSrc && fallbackSrc ? (
                  <p className="mt-2 text-center text-xs font-semibold text-slate-600 dark:text-slate-400">
                    صورة المحل العامة — لم يُرفع بعد باب خاص بهذا الطلب
                  </p>
                ) : null}
              </div>
            ) : (
              <p className="mb-2 text-center text-sm font-semibold text-slate-600 dark:text-slate-400">لا توجد صورة باب محل بعد</p>
            )}
            <PreparerDetailPhotoUploadRow auth={auth} orderId={order.id} field="shopDoorPhoto" />
          </div>
        );
      }
      case "preparer_customer_region": {
        const r1 = order.customerRegion?.name?.trim() || "—";
        const r2 = order.secondCustomerRegion?.name?.trim();
        const showSecond = routeMode === "double" && r2 && r2 !== r1;
        return (
          <div key="preparer_region" className="rounded-xl border-2 border-sky-200 bg-sky-50/40 p-4" style={blockStyle}>
            <h3 className="mb-2 text-lg font-bold text-sky-950 sm:text-xl">منطقة المستلم (الزبون)</h3>
            <p className="text-lg font-bold text-slate-900">{r1}</p>
            {showSecond ? (
              <p className="mt-2 text-base font-bold text-violet-900">
                المنطقة الثانية (وجهة 2): <span className="text-slate-900">{r2}</span>
              </p>
            ) : null}
          </div>
        );
      }
      case "preparer_prices": {
        const bikeIcon = "🏍️";
        const carIcon = "🚗";
        const vehicleIcon = order.vehiclePreference === "car" ? carIcon : (order.vehiclePreference === "bike" ? bikeIcon : null);
        const vehicleLabel = order.vehiclePreference === "car" ? "سيارة" : (order.vehiclePreference === "bike" ? "دراجة" : null);

        return (
          <div key="preparer_prices" className="space-y-4 rounded-xl border-2 border-sky-200 bg-sky-50/50 p-4 sm:p-5" style={blockStyle}>
            {vehicleIcon && (
              <div className="flex items-center gap-2 rounded-lg bg-white/60 px-3 py-2 border border-sky-100 shadow-sm">
                <span className="text-xl">{vehicleIcon}</span>
                <span className="text-sm font-bold text-sky-900">نوع المركبة المفضل: {vehicleLabel}</span>
              </div>
            )}
            <div className="flex flex-wrap items-center gap-1.5 font-mono text-lg font-black tabular-nums text-slate-900 sm:text-xl">
              <DynamicIcon iconKey="wallet_cash" config={icons} className="h-5 w-5 text-slate-500" fallback={null} />
              <span className="text-sm font-bold text-slate-700 sm:text-base">سعر الطلب بدون توصيل: </span>
              <span>{order.orderSubtotal != null ? `${formatDinarAsAlf(order.orderSubtotal)}` : "—"}</span>
            </div>
            <div className="flex flex-wrap items-center gap-1.5 font-mono text-lg font-black tabular-nums text-slate-900 sm:text-xl">
              <DynamicIcon iconKey="ui_courier" config={icons} className="h-5 w-5 text-slate-500" fallback={null} />
              <span className="text-sm font-bold text-slate-700 sm:text-base">سعر التوصيل: </span>
              <span>{order.deliveryPrice != null ? `${formatDinarAsAlf(order.deliveryPrice)}` : "—"}</span>
            </div>
            <div className="rounded-lg border border-violet-500/55 bg-violet-500/35 px-3 py-3 sm:px-5 sm:py-4 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.25)]">
              <div className="flex items-center gap-1.5 text-sm font-bold text-violet-950 sm:text-base">
                <DynamicIcon iconKey="wallet_remain" config={icons} className="h-4 w-4" fallback={null} />
                <span>سعر الطلب الكلي</span>
              </div>
              <p className="mt-1 font-mono text-2xl font-black tabular-nums text-violet-950 sm:text-3xl">
                {order.totalAmount != null ? formatDinarAsAlf(order.totalAmount) : "—"}
              </p>
            </div>
          </div>
        );
      }
      case "preparer_notes": {
        const text = order.summary?.trim() || "";
        if (!text) return null;
        return (
          <div key="preparer_notes" className="relative rounded-xl border-2 border-amber-200 bg-amber-50/30 p-4" style={blockStyle}>
            <div className="absolute end-3 top-3">
              <NotesCopyButton text={text} />
            </div>
            <div className="mb-2 flex items-center gap-2 pe-24">
              <DynamicIcon iconKey="ui_note" config={icons} className="h-5 w-5 text-amber-800" fallback={null} />
              <h3 className="text-lg font-bold text-amber-950 sm:text-xl">الملاحظات</h3>
            </div>
            <div className="whitespace-pre-wrap text-base font-bold leading-relaxed text-slate-800">
              {text}
            </div>
          </div>
        );
      }
      case "preparer_order_image": {
        const src = order.imageUrl?.trim() ? imgSrc(order.imageUrl.trim()) : null;
        return (
          <div
            key="preparer_order_img"
            className="mx-auto max-w-md rounded-xl border-2 border-slate-200 bg-white p-4 dark:border-slate-600 dark:bg-slate-900/80"
            style={blockStyle}
          >
            <p className="mb-2 text-center text-base font-bold text-slate-800 dark:text-slate-100 sm:text-lg">صورة الطلبية</p>
            {src ? (
              <div>
                <div className={`${squarePhotoFrame} dark:border-slate-600 dark:bg-slate-950`}>
                  <img src={src} alt="" className={squarePhotoContain} />
                </div>
                {order.orderImageUploadedByName?.trim() ? <ImageUploaderCaption name={order.orderImageUploadedByName} /> : null}
              </div>
            ) : (
              <p className="mb-2 text-center text-sm font-semibold text-slate-600 dark:text-slate-400">لم تُرفع صورة للطلبية بعد</p>
            )}
            <PreparerDetailPhotoUploadRow auth={auth} orderId={order.id} field="orderImage" />
          </div>
        );
      }
      case "shop_info":
        return (
          <div key="shop" className={gridInfoPhoto} style={blockStyle}>
            <div className="min-w-0 space-y-2 text-base sm:space-y-3 sm:text-lg">
              <div className="flex items-center gap-2">
                <DynamicIcon
                  iconKey="ui_shops"
                  config={icons}
                  className="h-5 w-5 text-emerald-600"
                  fallback={null}
                />
                <h3 className="text-lg font-bold text-emerald-800 sm:text-xl">المحل</h3>
              </div>
              <p className="font-bold leading-snug text-slate-900">{order.shop.name}</p>
              <div className="flex items-center gap-1.5 text-sm font-medium leading-snug text-slate-800">
                <DynamicIcon
                  iconKey="ui_user"
                  config={icons}
                  className="h-3.5 w-3.5 text-slate-400"
                  fallback={null}
                />
                <span className="text-slate-500">موظف المحل: </span>{order.submittedBy?.name?.trim() || "—"}
              </div>
              <div className="flex items-center gap-1.5 text-slate-800">
                <DynamicIcon
                  iconKey="ui_location"
                  config={icons}
                  className="h-3.5 w-3.5 text-slate-400"
                  fallback={null}
                />
                {order.shop.region.name}
              </div>
              <div className="flex items-center gap-1.5 font-mono tabular-nums text-slate-900">
                <DynamicIcon
                  iconKey="ui_call"
                  config={icons}
                  className="h-3.5 w-3.5 text-slate-400"
                  fallback={null}
                />
                {shopContactPhone || "—"}
              </div>
              <div className="mt-2">
                {order.shop.locationUrl?.trim() ? (
                  <a href={order.shop.locationUrl} target="_blank" rel="noopener noreferrer" className={locBtnEmerald}>
                    <DynamicIcon
                      iconKey="ui_external_link"
                      config={icons}
                      className="ml-1.5 h-3.5 w-3.5"
                      fallback={null}
                    />
                    فتح لوكيشن المحل
                  </a>
                ) : (
                  <p className="text-xs font-bold text-amber-800 sm:text-sm">لا يوجد لوكيشن للمحل</p>
                )}
              </div>
            </div>
            <div className="min-w-0 w-full max-w-[12rem] shrink-0 self-start justify-self-stretch sm:max-w-none">
              <p className="mb-1.5 text-sm font-bold text-slate-700 sm:mb-2 sm:text-lg">صورة المحل</p>
              {shopImageUrl && imgSrc(shopImageUrl) ? (<div><div className={squarePhotoFrame}><img src={imgSrc(shopImageUrl)!} alt="" className={squarePhotoCover} /></div>{order.shopDoorPhotoUploadedByName?.trim() ? <ImageUploaderCaption name={order.shopDoorPhotoUploadedByName} /> : null}</div>) : <p className="text-base text-slate-400">لا توجد صورة محل بعد</p>}
            </div>
          </div>
        );
      case "customer_info":
        return (
          <div key="customer" className={gridInfoPhoto} style={blockStyle}>
            <div className="min-w-0 space-y-2 text-base sm:space-y-3 sm:text-lg">
              <div className="flex items-center gap-2">
                <DynamicIcon
                  iconKey="ui_user"
                  config={icons}
                  className="h-5 w-5 text-emerald-600"
                  fallback={null}
                />
                <h3 className="text-lg font-bold text-emerald-800 sm:text-xl">الزبون (المستلم النهائي)</h3>
              </div>
              <div className="flex items-center gap-1.5 text-slate-800">
                <DynamicIcon
                  iconKey="ui_location"
                  config={icons}
                  className="h-3.5 w-3.5 text-slate-400"
                  fallback={null}
                />
                {order.customerRegion?.name ?? "—"}
              </div>
              {visibleCustomerPhone ? (
                <div className="flex items-center gap-1.5 font-mono tabular-nums text-slate-900">
                  <DynamicIcon
                    iconKey="ui_call"
                    config={icons}
                    className="h-3.5 w-3.5 text-slate-400"
                    fallback={null}
                  />
                  محمي
                </div>
              ) : null}
              {visibleMergedAlternate ? (
                <div className="mt-1 flex items-center gap-1.5 font-mono tabular-nums text-slate-900">
                  <DynamicIcon
                    iconKey="ui_call"
                    config={icons}
                    className="h-3.5 w-3.5 text-slate-400"
                    fallback={null}
                  />
                  محمي
                </div>
              ) : null}
              {mergedLandmark ? (
                <div className="mt-1 flex items-start gap-1.5 text-sm font-medium leading-relaxed text-slate-800">
                  <DynamicIcon
                    iconKey="ui_note"
                    config={icons}
                    className="mt-1 h-3.5 w-3.5 text-slate-400"
                    fallback={null}
                  />
                  <span>أقرب نقطة دالة: {mergedLandmark}</span>
                </div>
              ) : null}
              <div className="mt-2 space-y-2">
                {mergedCustomerLocationUrl ? (
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <a href={mergedCustomerLocationUrl} target="_blank" rel="noopener noreferrer" className={locBtnEmerald}>
                        <DynamicIcon
                          iconKey="ui_external_link"
                          config={icons}
                          className="ml-1.5 h-3.5 w-3.5"
                          fallback={null}
                        />
                        فتح لوكيشن الزبون
                      </a>
                      {order.customerLocationSetByCourierAt ? (
                        <span className="inline-flex max-w-full items-center rounded-full border border-emerald-300 bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-950">
                          لوكيشن مرفوع من المندوب (GPS)
                        </span>
                      ) : null}
                    </div>
                    <ImageUploaderCaption name={order.customerLocationUploadedByName} />
                  </div>
                ) : null}
                {!mergedCustomerLocationUrl ? (
                  <p className="text-xs font-bold text-amber-800">لا يوجد لوكيشن للزبون بعد</p>
                ) : null}
              </div>
            </div>
            <div className="min-w-0 self-start">
              <p className="mb-2 text-base font-bold text-slate-700 sm:text-lg">صورة باب الزبون (المستلم)</p>
              {customerDoorDisplay && imgSrc(customerDoorDisplay) ? (
                <div>
                  <div className={squarePhotoFrame}>
                    <img src={imgSrc(customerDoorDisplay)!} alt="" className={squarePhotoCover} />
                  </div>
                  <ImageUploaderCaption name={customerDoorCaptionName} />
                </div>
              ) : (
                <p className="text-base text-slate-400">لم تُرفع بعد</p>
              )}
            </div>
          </div>
        );
      case "price_details":
        const bikeIcon = "🏍️";
        const carIcon = "🚗";
        const vehicleIcon = order.vehiclePreference === "car" ? carIcon : (order.vehiclePreference === "bike" ? bikeIcon : null);
        const vehicleLabel = order.vehiclePreference === "car" ? "سيارة" : (order.vehiclePreference === "bike" ? "دراجة" : null);

        return (
          <div key="pricing" className={`${gridInfoPhoto} mt-6`} style={blockStyle}>
            <div className="min-w-0 space-y-4 rounded-xl border border-sky-100 bg-sky-50/50 p-4 sm:space-y-5 sm:p-5">
              {vehicleIcon && (
                <div className="flex items-center gap-2 rounded-lg bg-white/60 px-3 py-2 border border-sky-100 shadow-sm mb-2">
                  <span className="text-xl">{vehicleIcon}</span>
                  <span className="text-sm font-bold text-sky-900">المركبة: {vehicleLabel}</span>
                </div>
              )}
              <div className="grid grid-cols-1 gap-4 xs:grid-cols-2">
                <div>
                  <div className="flex items-center gap-1.5 text-sm font-bold text-slate-700 sm:text-base">
                    <DynamicIcon
                      iconKey="ui_package"
                      config={icons}
                      className="h-4 w-4 text-slate-500"
                      fallback={null}
                    />
                    <span>نوع</span>
                  </div>
                  <div className="mt-1">
                    <OrderTypeDetailBlock
                      orderType={order.orderType}
                      prefixClassName="font-black text-violet-950 bg-violet-100 px-2 py-1 rounded-lg text-xl sm:text-2xl ring-2 ring-violet-400/80 shadow-sm"
                      restClassName="text-xl font-black leading-snug sm:text-2xl text-slate-900"
                    />
                  </div>
                </div>
                {order.orderNoteTime && (
                  <div>
                    <div className="flex items-center gap-1.5 text-sm font-bold text-slate-700 sm:text-base">
                      <DynamicIcon
                        iconKey="ui_time"
                        config={icons}
                        className="h-4 w-4 text-slate-500"
                        fallback={null}
                      />
                      <span>وقت الطلب</span>
                    </div>
                    <p className="mt-1 text-lg font-black text-indigo-700 bg-indigo-50 px-3 py-1.5 rounded-lg border border-indigo-200 inline-block">
                      {order.orderNoteTime}
                    </p>
                  </div>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-1.5 font-mono text-lg font-black tabular-nums text-slate-900 sm:text-xl">
                <DynamicIcon
                  iconKey="wallet_cash"
                  config={icons}
                  className="h-5 w-5 text-slate-400"
                  fallback={null}
                />
                <span>السعر:</span>
                <span>{order.orderSubtotal != null ? formatDinarAsAlf(order.orderSubtotal) : "—"}</span>
              </div>
              <div className="flex flex-wrap items-center gap-1.5 font-mono text-lg font-black tabular-nums text-slate-900 sm:text-xl">
                <DynamicIcon
                  iconKey="ui_courier"
                  config={icons}
                  className="h-5 w-5 text-slate-400"
                  fallback={null}
                />
                <span>التوصيل:</span>
                <span>{order.deliveryPrice != null ? formatDinarAsAlf(order.deliveryPrice) : "—"}</span>
              </div>
              <div className="flex flex-col items-center justify-center rounded-lg border border-violet-500/55 bg-violet-500/35 px-3 py-3 text-center sm:px-5 sm:py-4 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.25)]">
                <div className="flex items-center gap-1.5 text-sm font-bold text-violet-950 sm:text-base">
                  <DynamicIcon
                    iconKey="wallet_remain"
                    config={icons}
                    className="h-4 w-4"
                    fallback={null}
                  />
                  <span>الكلي</span>
                </div>
                <p className="mt-1 font-mono text-2xl font-black tabular-nums text-violet-950 sm:text-3xl">
                  {order.totalAmount != null ? formatDinarAsAlf(order.totalAmount) : "—"}
                </p>
              </div>
            </div>
            <div className="min-w-0 w-full max-w-[12rem] shrink-0 self-start justify-self-stretch sm:max-w-none">
              <p className="mb-1.5 text-sm font-bold text-slate-700 sm:mb-2 sm:text-lg">صورة الطلبية</p>
              {order.imageUrl?.trim() && imgSrc(order.imageUrl) ? (
                <div>
                  <div className={squarePhotoFrame}>
                    <img src={imgSrc(order.imageUrl)!} alt="" className={squarePhotoContain} />
                  </div>
                  <ImageUploaderCaption name={order.orderImageUploadedByName} />
                </div>
              ) : (
                <div className="flex aspect-square items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50/90 px-2 text-center text-sm font-medium text-slate-500">
                  لا توجد صورة طلبية بعد
                </div>
              )}
            </div>
          </div>
        );
      case "notes_summary":
        // تم إخفاء الملاحظات بناءً على طلب المجهز
        return null;
      case "money_flow":
        return (
          <PreparerOrderMoneyFlow
            key="money" orderId={order.id} orderNumber={order.orderNumber} courierName={order.courier?.name?.trim() || "—"} assignedCourierId={order.assignedCourierId} orderStatus={order.status} orderSubtotalDinar={order.orderSubtotal != null ? Number(order.orderSubtotal) : null} totalAmountDinar={order.totalAmount != null ? Number(order.totalAmount) : null}
            moneyEvents={order.moneyEvents.map((e) => ({ id: e.id, kind: e.kind, amountDinar: Number(e.amountDinar), expectedDinar: e.expectedDinar != null ? Number(e.expectedDinar) : null, matchesExpected: e.matchesExpected, mismatchReason: e.mismatchReason, mismatchNote: e.mismatchNote, recordedAt: e.createdAt, deletedAt: e.deletedAt, deletedReason: e.deletedReason, deletedByDisplayName: e.deletedByDisplayName, performedByDisplayName: e.recordedByCompanyPreparer?.name?.trim() || e.courier?.name?.trim() || "—", recordedByCompanyPreparerId: e.recordedByCompanyPreparerId ?? null }))}
            auth={auth} nextUrl={nextUrl} preparerId={preparerId} icons={icons}
          />
        );
      default: return null;
    }
  };

  /** دائماً تخطيط المجهز الجديد — لا نقرأ layoutOrder من الإعدادات (قد يُعيد الشكل القديم من لوحة التصميم) */
  const layout = [...PREPARER_ORDER_DETAIL_LAYOUT];

  return (
    <section
      style={customStyle}
      className={`kse-glass-dark relative mt-4 border p-4 pb-32 text-base leading-relaxed sm:p-5 sm:pb-36 ${!uiSettings ? orderStatusStartStripeClass(order.status) : ''} ${
        !uiSettings && order.prepaidAll ? "border-emerald-300/85 bg-gradient-to-b from-emerald-50/70 via-white/90 to-teal-50/40 ring-2 ring-emerald-200/55 shadow-[0_0_0_1px_rgba(16,185,129,0.08)]" :
        !uiSettings && reversePickup ? "border-violet-400 bg-violet-100 shadow-md" :
        !uiSettings && missingCustomerLocation ? "border-sky-200 bg-rose-50/30 ring-2 ring-rose-200" : (!uiSettings ? `border-sky-200 ${orderStatusDetailSurfaceClass(order.status)}` : "")
      }`}
    >
      {reversePickup ? null : null}
      <div className="grid grid-cols-1 gap-3 border-b border-sky-100 pb-3 sm:grid-cols-[1fr_auto] sm:items-start sm:gap-2">
        <div className="min-w-0">
          <h2 className="text-xl font-black text-slate-900 dark:text-slate-100 sm:text-2xl">
            رقم الطلب <span className="tabular-nums text-sky-800 dark:text-sky-200">#{order.orderNumber}</span>
          </h2>
          <p className="mt-1 text-sm font-bold text-slate-600 dark:text-slate-300">
            تاريخ رفع الطلب:{" "}
            <span className="tabular-nums text-slate-800 dark:text-slate-100">
              {formatOrderUploadDateBaghdad(order.createdAt)}
            </span>
          </p>
        </div>
        <div className="flex flex-shrink-0 flex-wrap items-center justify-start gap-2 sm:justify-self-start">
          <MandoubOrderDetailActions closeHref={closeHref} />
          {canEditPricing && pricingEditHref ? (
            <Link href={pricingEditHref} className="inline-flex items-center rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-amber-600 transition-colors">
              <DynamicIcon
                iconKey="admin_pricing"
                config={icons}
                className="h-4 w-4"
                fallback={<span>💰</span>}
              />
              <span className="mr-2">تعديل التسعير</span>
            </Link>
          ) : null}
          <span className={`rounded-full px-3 py-1.5 text-xs font-bold ${orderStatusBadgeClass(order.status)}`}>{STATUS_AR[order.status] ?? order.status}</span>
        </div>
      </div>

      <PreparerOrderEditPanel auth={auth} orderId={order.id} defaults={{ orderType: order.orderType, customerPhone: "", orderSubtotalAlf: order.orderSubtotal != null ? dinarDecimalToAlfInputString(order.orderSubtotal) : "" }} />

      <div className="mt-5 space-y-6">
        {layout.map(id => renderBlock(id))}
      </div>

      {zoomImage && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/90 p-4 backdrop-blur-md animate-in fade-in duration-300"
          onClick={() => setZoomImage(null)}
        >
          <div
            className="relative w-full max-w-2xl overflow-hidden rounded-3xl bg-white shadow-2xl animate-in zoom-in-95 duration-300"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b bg-slate-50 p-4">
              <span className="text-base font-bold text-slate-800">{zoomImage.title}</span>
              <button
                onClick={() => setZoomImage(null)}
                className="flex size-10 items-center justify-center rounded-full bg-slate-200 font-bold text-slate-600 transition-all hover:bg-slate-300"
              >
                ✕
              </button>
            </div>
            <div className="bg-slate-200 p-1">
              <img
                src={resolvePublicAssetSrc(zoomImage.url)!}
                alt={zoomImage.title}
                className="h-auto max-h-[75vh] w-full rounded-2xl object-contain shadow-inner"
              />
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
