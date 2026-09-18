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
import { ClickableNotesCard } from "@/components/clickable-notes-card";
import { normalizeOrderSummaryText } from "@/lib/preparation-invoice";
import { OrderTypeDetailBlock } from "@/components/order-type-line";
import { UISectionConfig } from "@/lib/ui-settings";
import { DynamicIcon } from "@/components/dynamic-icon";
import { type GlobalIconsConfig } from "@/lib/icon-settings";
import { useState, useRef } from "react";
import { compressImageFileForUpload } from "@/lib/client-image-compress";
import {
  uploadPreparerPortalOrderImage,
  uploadPreparerPortalShopDoorPhoto,
} from "./actions";

const STATUS_AR: Record<string, string> = {
  pending: "جديد",
  assigned: "بانتظار المندوب",
  delivering: "مستلم",
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

function isSmartHintValid(text?: string | null): boolean {
  if (!text) return false;
  const t = text.trim();
  return t.length > 0 && t !== "—" && !t.startsWith("—");
}

const locBtnEmerald =
  "inline-flex min-h-[44px] sm:min-h-[48px] max-w-full items-center justify-center rounded-xl bg-emerald-600 px-4 py-2.5 text-sm sm:text-base font-black text-white shadow-md hover:bg-emerald-700 active:scale-95 transition-all gap-1.5";
const locBtnSecond =
  "inline-flex min-h-[44px] sm:min-h-[48px] max-w-full items-center justify-center rounded-xl bg-violet-600 px-4 py-2.5 text-sm sm:text-base font-black text-white shadow-md hover:bg-violet-700 active:scale-95 transition-all gap-1.5";

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
  onCloseModal,
  auth,
  nextUrl,
  preparerId,
  phoneProfile,
  secondPhoneProfile,
  smartHintLine,
  secondSmartHintLine,
  uiSettings,
  icons,
  canEditPricing,
  pricingEditHref,
  productImagesMap,
  productBranchMap,
  couriers,
}: {
  order: MandoubOrderDetailPayload;
  closeHref: string;
  onCloseModal?: () => void;
  auth: { p: string; exp: string; s: string };
  nextUrl: string;
  preparerId: string;
  phoneProfile?: PhoneProfileFallback;
  secondPhoneProfile?: PhoneProfileFallback;
  smartHintLine?: string | null;
  secondSmartHintLine?: string | null;
  uiSettings?: UISectionConfig | null;
  icons?: GlobalIconsConfig | null;
  canEditPricing?: boolean;
  pricingEditHref?: string;
  productImagesMap?: Record<string, string>;
  productBranchMap?: Record<string, string>;
  couriers?: { id: string; name: string }[];
}) {
  const [zoomImage, setZoomImage] = useState<{ url: string; title: string } | null>(null);

  // الستايل الديناميكي
  const customStyle = uiSettings ? {
    backgroundColor: uiSettings.statusStyles?.[order.status]?.backgroundColor || uiSettings.backgroundColor,
    color: uiSettings.statusStyles?.[order.status]?.textColor || uiSettings.textColor,
    opacity: uiSettings.backgroundOpacity,
    borderRadius: uiSettings.borderRadius,
    fontSize: uiSettings.fontSize,
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
        const parsedShoppingJson = order.preparerShoppingJson as any;
        const cartItems = parsedShoppingJson && Array.isArray(parsedShoppingJson.webStoreCart)
          ? (parsedShoppingJson.webStoreCart as any[])
          : (parsedShoppingJson && Array.isArray(parsedShoppingJson.products) ? parsedShoppingJson.products : []);
        
        if (!cartItems || cartItems.length === 0) return null;

        return (
          <div key="preparer_site_products" className="rounded-xl border-2 border-amber-200 bg-amber-50/30 p-4" style={blockStyle}>
            <div className="mb-3 flex items-center gap-2">
              <DynamicIcon iconKey="ui_package" config={icons} className="h-5 w-5 text-amber-800" fallback={<span>📦</span>} />
              <h3 className="text-lg font-bold text-amber-950 sm:text-xl">مواد الطلب (المتجر الإلكتروني)</h3>
            </div>
            <div className="grid grid-cols-1 gap-2">
              {cartItems.map((item: any, idx: number) => {
                const lineName = item.name || item.line || "";
                const lineKey = lineName.trim().toLowerCase();
                const qty = item.quantity || item.qty || 1;
                const isWebStore = parsedShoppingJson && Array.isArray(parsedShoppingJson.webStoreCart);
                const img = isWebStore ? (productImagesMap?.[lineKey] || "") : "";

                // التحقق من المجهز أو المورد المخصص للمنتج
                const itemPrepId = String(item.assignedPreparerId || item.pricedById || "").trim();
                const itemPrepName = String(item.assignedPreparerName || item.pricedBy || "").trim();
                const isAssignedToOther = Boolean(itemPrepId && itemPrepId !== preparerId);
                const isAssignedToMe = Boolean(itemPrepId && itemPrepId === preparerId);

                return (
                  <div 
                    key={idx} 
                    className={`flex items-center gap-3 p-3 rounded-xl border shadow-sm transition-all ${
                      isAssignedToOther
                        ? "border-rose-100 bg-rose-50/20 opacity-60 grayscale-[20%] dark:border-rose-950/20 dark:bg-rose-950/5"
                        : isAssignedToMe
                          ? "border-emerald-200 bg-emerald-50/10 dark:border-emerald-900/20 dark:bg-emerald-950/5"
                          : "border-slate-100 bg-white dark:border-slate-800 dark:bg-slate-900"
                    }`}
                  >
                    {img && (
                      <div 
                        onClick={() => setZoomImage({ url: img, title: lineName })}
                        className="shrink-0 w-12 h-12 rounded-lg overflow-hidden border border-slate-100 bg-slate-50 cursor-zoom-in active:scale-95 transition-transform"
                      >
                        <img src={resolvePublicAssetSrc(img)!} alt="" className="w-full h-full object-cover" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-black text-slate-900 dark:text-white truncate flex-1">{lineName} ×{qty}</p>
                        <span className={`shrink-0 text-base font-black px-2.5 py-0.5 rounded border-2 ${
                          qty > 1
                            ? "text-rose-600 dark:text-rose-400 bg-rose-100/80 dark:bg-rose-950/40 border-rose-500 animate-pulse scale-105"
                            : "text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-700"
                        }`}>
                          ×{qty}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 mt-1">
                        <span className="text-xs font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded border border-rose-100 dark:bg-rose-950/20 dark:text-rose-400 dark:border-rose-900/30">
                          الكمية: x{qty}
                        </span>
                        {item.price && (
                          <span className="text-xs font-mono font-bold text-slate-500">
                            {Number(item.price).toLocaleString()} د.ع
                          </span>
                        )}
                        
                        {/* عرض شارات التخصيص للمجهزين والموردين الآخرين */}
                        {isAssignedToOther ? (
                          <span className="text-[10px] font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200 dark:bg-rose-950/30 dark:text-rose-400 dark:border-rose-900/40">
                            ⚠️ خاص بالمجهز: {itemPrepName || "مجهز آخر"}
                          </span>
                        ) : isAssignedToMe ? (
                          <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-250 dark:bg-emerald-950/30 dark:text-emerald-450 dark:border-emerald-900/40">
                            ✅ مسند إليك
                          </span>
                        ) : null}
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
            <h3 className="mb-2 text-lg font-bold text-sky-950 sm:text-xl">بيانات المستلم (الزبون)</h3>

            <div className="space-y-1">
              <p className="text-lg font-bold text-slate-900">{r1}</p>

              <div className="flex items-center gap-1.5">
                <span className="text-sm font-bold text-slate-700">📍 النقطة الدالة:</span>
                <span className="text-sm font-bold text-slate-900">{mergedLandmark || order.customerLandmark || "—"}</span>
              </div>

              <div className="flex items-center gap-1.5">
                <span className="text-[13px] font-black text-emerald-900">
                  💡 {isSmartHintValid(smartHintLine) ? smartHintLine!.trim() : "—"}
                </span>
              </div>
            </div>

            {showSecond ? (
              <div className="mt-4 border-t border-sky-200 pt-3 space-y-1">
                <p className="text-base font-bold text-violet-900">
                  الوجهة الثانية: <span className="text-slate-900">{r2}</span>
                </p>

                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-bold text-slate-700">📍 النقطة الدالة:</span>
                  <span className="text-sm font-bold text-slate-900">{secondLandmarkMerged || "—"}</span>
                </div>

                <div className="flex items-center gap-1.5">
                  <span className="text-[13px] font-black text-violet-900">
                    💡 {isSmartHintValid(secondSmartHintLine) ? secondSmartHintLine!.trim() : "—"}
                  </span>
                </div>
              </div>
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
            {order.purchasePrice != null ? (
              <>
                <div className="flex flex-wrap items-center gap-1.5 font-mono text-lg font-black tabular-nums text-emerald-950 sm:text-xl">
                  <DynamicIcon iconKey="wallet_cash" config={icons} className="h-5 w-5 text-emerald-600" fallback={null} />
                  <span className="text-sm font-bold text-emerald-900 sm:text-base">سعر الشراء (للمحل/السوق): </span>
                  <span className="rounded-lg border border-emerald-300 bg-emerald-100 px-2 py-0.5 font-bold text-emerald-950">
                    {formatDinarAsAlf(order.purchasePrice)}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-1.5 font-mono text-lg font-black tabular-nums text-slate-900 sm:text-xl">
                  <DynamicIcon iconKey="ui_courier" config={icons} className="h-5 w-5 text-slate-500" fallback={null} />
                  <span className="text-sm font-bold text-slate-700 sm:text-base">سعر التوصيل: </span>
                  <span>{order.deliveryPrice != null ? `${formatDinarAsAlf(order.deliveryPrice)}` : "—"}</span>
                </div>
                <div className="rounded-lg border border-emerald-500/55 bg-emerald-500/15 px-3 py-3 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.25)] sm:px-5 sm:py-4">
                  <div className="flex items-center gap-1.5 text-sm font-bold text-emerald-950 sm:text-base">
                    <DynamicIcon iconKey="wallet_remain" config={icons} className="h-4 w-4 text-emerald-700" fallback={null} />
                    <span>سعر الشراء الكلي مع التوصيل</span>
                  </div>
                  <p className="mt-1 font-mono text-2xl font-black tabular-nums text-emerald-950 sm:text-3xl">
                    {formatDinarAsAlf(Number(order.purchasePrice) + Number(order.deliveryPrice ?? 0))}
                  </p>
                </div>
              </>
            ) : (
              <>
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
                <div className="rounded-lg border border-violet-500/55 bg-violet-500/35 px-3 py-3 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.25)] sm:px-5 sm:py-4">
                  <div className="flex items-center gap-1.5 text-sm font-bold text-violet-950 sm:text-base">
                    <DynamicIcon iconKey="wallet_remain" config={icons} className="h-4 w-4" fallback={null} />
                    <span>سعر الطلب الكلي</span>
                  </div>
                  <p className="mt-1 font-mono text-2xl font-black tabular-nums text-violet-950 sm:text-3xl">
                    {order.totalAmount != null ? formatDinarAsAlf(order.totalAmount) : "—"}
                  </p>
                </div>
              </>
            )}
          </div>
        );
      }
      case "preparer_notes": {
        if (order.submissionSource === "company_preparer") return null;
        const text = order.summary?.trim() || "";
        if (!text) return null;
        return (
          <ClickableNotesCard key="preparer_notes" text={text}>
            <div className="p-4 pt-9" style={blockStyle}>
              <div className="mb-2 flex items-center gap-2">
                <DynamicIcon iconKey="ui_note" config={icons} className="h-5 w-5 text-amber-800" fallback={null} />
                <h3 className="text-lg font-bold text-amber-950 sm:text-xl">الملاحظات (الفاتورة)</h3>
              </div>
              <div className="whitespace-pre-wrap text-base font-bold leading-relaxed text-slate-800">
                {normalizeOrderSummaryText(text)}
              </div>
            </div>
          </ClickableNotesCard>
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
                    {order.orderNoteTime || "فوري"}
                  </p>
                </div>
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
            key="money"
            orderId={order.id}
            orderNumber={order.orderNumber}
            courierName={order.courier?.name?.trim() || "—"}
            assignedCourierId={order.assignedCourierId}
            orderStatus={order.status}
            purchasePriceDinar={order.purchasePrice != null ? Number(order.purchasePrice) : null}
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
              recordedAt: e.createdAt,
              deletedAt: e.deletedAt,
              deletedReason: e.deletedReason,
              deletedByDisplayName: e.deletedByDisplayName,
              performedByDisplayName: e.recordedByCompanyPreparer?.name?.trim() || e.courier?.name?.trim() || "—",
              recordedByCompanyPreparerId: e.recordedByCompanyPreparerId ?? null
            }))}
            auth={auth}
            nextUrl={nextUrl}
            preparerId={preparerId}
            icons={icons}
            couriers={couriers}
            isPreparationOrder={Boolean(order.preparerShoppingJson || order.orderType?.includes("تجهيز"))}
          />
        );
      default: return null;
    }
  };

  const [editPanelOpen, setEditPanelOpen] = useState(false);
  const shopDoorCamRef = useRef<HTMLInputElement>(null);
  const shopDoorGalRef = useRef<HTMLInputElement>(null);
  const orderImgCamRef = useRef<HTMLInputElement>(null);
  const orderImgGalRef = useRef<HTMLInputElement>(null);
  const [uploadBusy, setUploadBusy] = useState(false);

  async function handlePhotoUpload(file: File, field: "orderImage" | "shopDoorPhoto") {
    if (!file) return;
    setUploadBusy(true);
    try {
      let toSend = file;
      try {
        toSend = await compressImageFileForUpload(file);
      } catch {}
      const fd = new FormData();
      fd.set("p", auth.p);
      fd.set("exp", auth.exp);
      fd.set("s", auth.s);
      fd.set("orderId", order.id);
      if (field === "orderImage") fd.set("orderImage", toSend);
      else fd.set("shopDoorPhoto", toSend);

      if (field === "orderImage") {
        await uploadPreparerPortalOrderImage({}, fd);
      } else {
        await uploadPreparerPortalShopDoorPhoto({}, fd);
      }
      window.location.reload();
    } finally {
      setUploadBusy(false);
    }
  }

  const shopImageUrl = order.shop.photoUrl?.trim() || order.shopDoorPhotoUrl?.trim() || "";
  const shopDoorDisplay = order.shopDoorPhotoUrl?.trim() || "";
  const orderImageDisplay = order.imageUrl?.trim() || "";
  const destRegionName = order.customerRegion?.name?.trim() || "جيكور";
  const shopName = order.shop.name || "الإدارة";
  const orderTimeStr = order.orderNoteTime || "هسه";
  
  const rawType = order.orderType && order.orderType !== "عام" && order.orderType !== "—"
    ? order.orderType
    : order.summary && order.summary.trim()
    ? order.summary
    : order.orderType || destRegionName;

  const priceVal = order.orderSubtotal != null
    ? formatDinarAsAlf(order.orderSubtotal)
    : order.purchasePrice != null
    ? formatDinarAsAlf(order.purchasePrice)
    : order.totalAmount != null
    ? formatDinarAsAlf(order.totalAmount)
    : "15";

  const numOnlyPrice = String(priceVal).replace(/[^\d.]/g, "") || "15";

  // حالة السحب للصور
  const [shopSwipeOffset, setShopSwipeOffset] = useState(0);
  const [orderSwipeOffset, setOrderSwipeOffset] = useState(0);
  const [shopDragStart, setShopDragStart] = useState<number | null>(null);
  const [orderDragStart, setOrderDragStart] = useState<number | null>(null);

  const THRESHOLD = 18;

  const handleShopTouchEnd = () => {
    if (shopDragStart !== null) {
      if (shopSwipeOffset > THRESHOLD) {
        shopDoorCamRef.current?.click();
      } else if (shopSwipeOffset < -THRESHOLD) {
        shopDoorGalRef.current?.click();
      } else if (Math.abs(shopSwipeOffset) < 5) {
        if (shopDoorDisplay) setZoomImage({ url: shopDoorDisplay, title: "باب المحل" });
        else shopDoorCamRef.current?.click();
      }
    }
    setShopSwipeOffset(0);
    setShopDragStart(null);
  };

  const handleOrderTouchEnd = () => {
    if (orderDragStart !== null) {
      if (orderSwipeOffset > THRESHOLD) {
        orderImgCamRef.current?.click();
      } else if (orderSwipeOffset < -THRESHOLD) {
        orderImgGalRef.current?.click();
      } else if (Math.abs(orderSwipeOffset) < 5) {
        if (orderImageDisplay) setZoomImage({ url: orderImageDisplay, title: "الطلبية" });
        else orderImgCamRef.current?.click();
      }
    }
    setOrderSwipeOffset(0);
    setOrderDragStart(null);
  };

  return (
    <div className="w-full max-w-[440px] mx-auto flex flex-col gap-3 text-right" dir="rtl">
      {/* 1. الهيدر الملكي الفاخر (سطر واحد فقط ارتفاع 52px) */}
      <header className="h-[52px] bg-[#FFFEF8] border-2 border-[#C9A86A] rounded-[16px] flex items-center justify-between px-2.5 shadow-[0_4px_16px_rgba(201,168,106,0.2)]">
        {/* اليمين: رقم الطلب + منطقة الزبون (بدلاً من حالة الطلب) */}
        <div className="flex items-center gap-2">
          <div className="bg-[#FDF6E3] border-2 border-[#C9A86A] rounded-[10px] px-2 py-0.5 text-[#8B6A2A] font-extrabold text-[15px] font-mono leading-none shadow-[inset_0_1px_2px_rgba(201,168,106,0.2)]">
            #{order.orderNumber}
          </div>
          <div className="bg-[#0A3D2E] border-[1.5px] border-[#C9A86A] rounded-[10px] px-2.5 py-1 text-white font-extrabold text-xs flex items-center gap-1.5 leading-none shadow-[0_2px_6px_rgba(10,61,46,0.25)]">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#F5D77F" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
              <circle cx="12" cy="10" r="3" />
            </svg>
            <span>{destRegionName}</span>
          </div>
        </div>

        {/* اليسار: زر تعديل + زر إغلاق */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setEditPanelOpen(!editPanelOpen)}
            className="bg-white border-[1.5px] border-[#C9A86A] rounded-[10px] px-2.5 py-1 text-[#0A3D2E] text-xs font-black flex items-center gap-1.5 cursor-pointer shadow-[0_2px_6px_rgba(201,168,106,0.15)] hover:bg-[#FAF5E8] active:scale-95 transition-all"
          >
            <div className="w-4 h-4 rounded-full bg-[#FDF6E3] border border-[#C9A86A] flex items-center justify-center text-[#8B6A2A]">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                <path d="m15 5 4 4" />
              </svg>
            </div>
            <span>تعديل</span>
          </button>

          {onCloseModal ? (
            <button
              type="button"
              onClick={onCloseModal}
              className="w-7 h-7 rounded-full bg-[#FEF2F2] border-[1.5px] border-[#E11D48] text-[#E11D48] flex items-center justify-center cursor-pointer active:scale-90 transition-transform font-bold text-xs"
              title="إغلاق"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          ) : (
            <Link
              href={closeHref}
              className="w-7 h-7 rounded-full bg-[#FEF2F2] border-[1.5px] border-[#E11D48] text-[#E11D48] flex items-center justify-center cursor-pointer active:scale-90 transition-transform font-bold text-xs"
              title="إغلاق"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </Link>
          )}
        </div>
      </header>

      {/* لوحة تعديل الطلب السريع القابلة للفتح والطي */}
      {editPanelOpen && (
        <div className="rounded-[20px] border-2 border-[#C9A86A] bg-[#FFFEF8] p-3 shadow-lg animate-in slide-in-from-top-2 duration-200">
          <PreparerOrderEditPanel
            auth={auth}
            orderId={order.id}
            defaults={{
              orderType: order.orderType,
              customerPhone: "",
              orderSubtotalAlf: order.orderSubtotal != null ? dinarDecimalToAlfInputString(order.orderSubtotal) : "",
            }}
          />
        </div>
      )}

      {/* 2. كارت المعلومات الرئيسي المدمج */}
      <section className="bg-[#FFFEF8] border-[2.5px] border-[#C9A86A] rounded-[20px] p-3 sm:p-3.5 shadow-[0_4px_20px_rgba(201,168,106,0.25)] flex flex-col gap-2.5">
        {/* السطر الأول: اسم المحل + سعر الطلب بدون توصيل */}
        <div className="flex items-center justify-between">
          {/* يمين: المحل */}
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-[#FDF6E3] border-[1.5px] border-[#C9A86A] flex items-center justify-center text-[#0A3D2E] shadow-[inset_0_1px_2px_rgba(201,168,106,0.2)]">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="m2 7 4.41-4.41A2 2 0 0 1 7.83 2h8.34a2 2 0 0 1 1.42.59L22 7" />
                <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
                <path d="M15 22v-4a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v4" />
                <path d="M2 7h20" />
                <path d="M22 7a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2" />
              </svg>
            </div>
            <span className="font-extrabold text-sm text-[#0A3D2E]">{shopName}</span>
          </div>

          {/* يسار: السعر بدون توصيل */}
          <div className="flex items-center gap-1.5">
            <span className="font-extrabold text-sm text-[#0A3D2E] font-mono">{numOnlyPrice} ألف</span>
            <div className="w-8 h-8 rounded-full bg-[#FDF6E3] border-[1.5px] border-[#C9A86A] flex items-center justify-center text-[#8B6A2A] shadow-[inset_0_1px_2px_rgba(201,168,106,0.2)]">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="8" cy="8" r="6" />
                <path d="M18.09 10.37A6 6 0 1 1 10.34 18" />
                <path d="M7 6h1v4" />
                <path d="m16.71 13.88.7.71-2.82 2.82" />
              </svg>
            </div>
          </div>
        </div>

        {/* فاصل ذهبي متقطع */}
        <div className="border-t border-dashed border-[#C9A86A]/45 w-full my-0.5" />

        {/* السطر الثاني: نوع الطلب بالكامل + وقت الطلب */}
        <div className="flex items-center justify-between gap-2">
          {/* يمين: نوع الطلب كاملاً بدون قص */}
          <div className="flex items-center gap-1.5 min-w-0 flex-1">
            <div className="w-7 h-7 rounded-full bg-[#FDF6E3] border border-[#C9A86A] flex items-center justify-center text-[#8B6A2A] shadow-[inset_0_1px_2px_rgba(201,168,106,0.2)] shrink-0">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2H2v10l9.29 9.29c.94.94 2.48.94 3.42 0l6.58-6.58c.94-.94.94-2.48 0-3.42L12 2Z" />
                <path d="M7 7h.01" />
              </svg>
            </div>
            <span className="font-extrabold text-[13px] text-[#0A3D2E] break-words">{rawType}</span>
          </div>

          {/* يسار: وقت الطلب */}
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="font-extrabold text-[13px] text-[#E11D48]">{orderTimeStr}</span>
            <div className="w-7 h-7 rounded-full bg-[#FEF2F2] border border-[#E11D48]/30 flex items-center justify-center text-[#E11D48]">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
            </div>
          </div>
        </div>
      </section>

      {/* 3. زري الإجراء أسفل كارت المعلومات */}
      <div className="flex gap-3 w-full">
        {/* زر يمين: استلام من الزبون */}
        <button
          type="button"
          onClick={() => {
            const el = document.getElementById("preparer-order-money");
            if (el) el.scrollIntoView({ behavior: "smooth" });
          }}
          className="flex-1 h-[52px] rounded-[28px] bg-[#FDF6E3] border-2 border-[#C9A86A] text-[#0A3D2E] font-extrabold text-xs flex items-center justify-center gap-2 shadow-[0_4px_15px_rgba(201,168,106,0.35)] active:scale-95 transition-transform cursor-pointer"
        >
          <div className="w-[26px] h-[26px] rounded-full bg-white border border-[#C9A86A] flex items-center justify-center text-[#0A3D2E]">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m7.5 4.27 9 5.15" />
              <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
              <path d="m3.3 7 8.7 5 8.7-5" />
              <path d="M12 22V12" />
            </svg>
          </div>
          <span>استلام من الزبون</span>
        </button>

        {/* زر يسار: تسليم للعميل */}
        <button
          type="button"
          onClick={() => {
            const el = document.getElementById("preparer-order-money");
            if (el) el.scrollIntoView({ behavior: "smooth" });
          }}
          className="flex-1 h-[52px] rounded-[28px] bg-[#0A3D2E] border-2 border-[#C9A86A] text-white font-extrabold text-xs flex items-center justify-center gap-2 shadow-[0_4px_18px_rgba(10,61,46,0.45)] active:scale-95 transition-transform cursor-pointer"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='32' height='32' viewBox='0 0 32 32' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M16 0 L18 8 L26 6 L22 14 L30 16 L22 18 L26 26 L18 24 L16 32 L14 24 L6 26 L10 18 L2 16 L10 14 L6 6 L14 8 Z' fill='%23C9A86A' fill-opacity='0.08'/%3E%3C/svg%3E")`,
          }}
        >
          <div className="w-[26px] h-[26px] rounded-full bg-[#E8C77E]/25 border border-[#E8C77E] flex items-center justify-center text-[#F5D77F]">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2" />
              <path d="M15 18H9" />
              <path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14" />
              <circle cx="17" cy="18" r="2" />
              <circle cx="7" cy="18" r="2" />
            </svg>
          </div>
          <span>تسليم للعميل</span>
        </button>
      </div>

      {/* 4. صورتين بجانب بعض مع دعم السحب التفاعلي */}
      <div className="flex gap-3 w-full">
        {/* يمين: باب المحل */}
        <div
          className="flex-1 h-[150px] rounded-[20px] border-[2.5px] border-[#C9A86A] bg-[#0E3D2B] shadow-[0_4px_20px_rgba(201,168,106,0.25)] relative overflow-hidden flex flex-col items-center justify-center cursor-pointer select-none touch-pan-y"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='36' height='36' viewBox='0 0 36 36' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M18 0 L20 10 L30 8 L24 16 L34 18 L24 20 L30 28 L20 26 L18 36 L16 26 L6 28 L12 20 L2 18 L12 16 L6 8 L16 10 Z' fill='%23C9A86A' fill-opacity='0.08'/%3E%3C/svg%3E")`,
            transform: `translateX(${shopSwipeOffset}px)`,
            transition: shopDragStart !== null ? "none" : "transform 0.25s ease",
          }}
          onTouchStart={(e) => setShopDragStart(e.touches[0].clientX)}
          onTouchMove={(e) => {
            if (shopDragStart !== null) {
              const delta = e.touches[0].clientX - shopDragStart;
              setShopSwipeOffset(delta * 0.55);
            }
          }}
          onTouchEnd={handleShopTouchEnd}
          onTouchCancel={handleShopTouchEnd}
          onClick={() => {
            if (shopDoorDisplay) setZoomImage({ url: shopDoorDisplay, title: "باب المحل" });
            else shopDoorCamRef.current?.click();
          }}
        >
          <span className="absolute top-2.5 right-2.5 rounded-[12px] px-2.5 py-1 text-[11px] font-black bg-[#FDF6E3] text-[#0A3D2E] border border-[#C9A86A] shadow-md z-10">
            باب المحل
          </span>

          {shopDoorDisplay ? (
            <img src={resolvePublicAssetSrc(shopDoorDisplay)!} alt="باب المحل" className="absolute inset-0 w-full h-full object-cover z-[1]" />
          ) : (
            <div className="w-14 h-14 rounded-full bg-[#E8C77E]/20 border-[1.5px] border-[#E8C77E] flex items-center justify-center text-[#F5D77F] z-[2]">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
                <circle cx="9" cy="9" r="2" />
                <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
              </svg>
            </div>
          )}

          {/* طبقة السحب التفاعلية */}
          {Math.abs(shopSwipeOffset) > 4 && (
            <div className="absolute inset-0 bg-[#C9A86A]/30 z-[5] flex items-center justify-center pointer-events-none">
              <div className="w-11 h-11 rounded-full bg-[#0A3D2E] border-2 border-[#F5D77F] text-[#F5D77F] flex items-center justify-center shadow-lg">
                {shopSwipeOffset > 0 ? (
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" />
                    <circle cx="12" cy="13" r="3" />
                  </svg>
                ) : (
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
                    <circle cx="9" cy="9" r="2" />
                    <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
                  </svg>
                )}
              </div>
            </div>
          )}
        </div>

        {/* يسار: الطلبية */}
        <div
          className="flex-1 h-[150px] rounded-[20px] border-[2.5px] border-[#C9A86A] bg-gradient-to-br from-[#FDF6E3] to-[#E8D5A3] shadow-[0_4px_20px_rgba(201,168,106,0.25)] relative overflow-hidden flex flex-col items-center justify-center cursor-pointer select-none touch-pan-y"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='36' height='36' viewBox='0 0 36 36' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M18 0 L20 10 L30 8 L24 16 L34 18 L24 20 L30 28 L20 26 L18 36 L16 26 L6 28 L12 20 L2 18 L12 16 L6 8 L16 10 Z' fill='%23C9A86A' fill-opacity='0.08'/%3E%3C/svg%3E")`,
            transform: `translateX(${orderSwipeOffset}px)`,
            transition: orderDragStart !== null ? "none" : "transform 0.25s ease",
          }}
          onTouchStart={(e) => setOrderDragStart(e.touches[0].clientX)}
          onTouchMove={(e) => {
            if (orderDragStart !== null) {
              const delta = e.touches[0].clientX - orderDragStart;
              setOrderSwipeOffset(delta * 0.55);
            }
          }}
          onTouchEnd={handleOrderTouchEnd}
          onTouchCancel={handleOrderTouchEnd}
          onClick={() => {
            if (orderImageDisplay) setZoomImage({ url: orderImageDisplay, title: "الطلبية" });
            else orderImgCamRef.current?.click();
          }}
        >
          <span className="absolute top-2.5 right-2.5 rounded-[12px] px-2.5 py-1 text-[11px] font-black bg-[#0A3D2E] text-white border border-[#C9A86A] shadow-md z-10">
            الطلبية
          </span>

          {orderImageDisplay ? (
            <img src={resolvePublicAssetSrc(orderImageDisplay)!} alt="الطلبية" className="absolute inset-0 w-full h-full object-cover z-[1]" />
          ) : (
            <div className="w-14 h-14 rounded-full bg-[#FDF6E3] border-[1.5px] border-[#C9A86A] flex items-center justify-center text-[#0A3D2E] z-[2]">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
                <circle cx="9" cy="9" r="2" />
                <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
              </svg>
            </div>
          )}

          {/* طبقة السحب التفاعلية */}
          {Math.abs(orderSwipeOffset) > 4 && (
            <div className="absolute inset-0 bg-[#C9A86A]/30 z-[5] flex items-center justify-center pointer-events-none">
              <div className="w-11 h-11 rounded-full bg-[#0A3D2E] border-2 border-[#F5D77F] text-[#F5D77F] flex items-center justify-center shadow-lg">
                {orderSwipeOffset > 0 ? (
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" />
                    <circle cx="12" cy="13" r="3" />
                  </svg>
                ) : (
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
                    <circle cx="9" cy="9" r="2" />
                    <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
                  </svg>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* عناصر الرفع المخفية */}
      <input ref={shopDoorCamRef} type="file" accept="image/*" capture="environment" className="fixed -top-[9999px] -left-[9999px] opacity-0 pointer-events-none w-[1px] h-[1px]" onChange={(e) => e.target.files?.[0] && handlePhotoUpload(e.target.files[0], "shopDoorPhoto")} />
      <input ref={shopDoorGalRef} type="file" accept="image/*" className="fixed -top-[9999px] -left-[9999px] opacity-0 pointer-events-none w-[1px] h-[1px]" onChange={(e) => e.target.files?.[0] && handlePhotoUpload(e.target.files[0], "shopDoorPhoto")} />
      <input ref={orderImgCamRef} type="file" accept="image/*" capture="environment" className="fixed -top-[9999px] -left-[9999px] opacity-0 pointer-events-none w-[1px] h-[1px]" onChange={(e) => e.target.files?.[0] && handlePhotoUpload(e.target.files[0], "orderImage")} />
      <input ref={orderImgGalRef} type="file" accept="image/*" className="fixed -top-[9999px] -left-[9999px] opacity-0 pointer-events-none w-[1px] h-[1px]" onChange={(e) => e.target.files?.[0] && handlePhotoUpload(e.target.files[0], "orderImage")} />

      {/* 5. الأقسام الإضافية الخاصة بالمجهز (المتجر، الصوتيات، الفاتورة، تدفق الأموال) */}
      <div className="mt-2 space-y-4">
        {renderBlock("preparer_voice_notes")}
        {renderBlock("preparer_site_products")}
        {renderBlock("preparer_notes")}
        {renderBlock("money_flow")}
      </div>

      {/* مودال تكبير الصور */}
      {zoomImage && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => setZoomImage(null)}
        >
          <div
            className="relative w-full max-w-lg overflow-hidden rounded-[24px] bg-[#FFFEF8] border-2 border-[#C9A86A] shadow-2xl animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-[#C9A86A]/30 bg-[#FDF6E3] p-3.5">
              <span className="text-sm font-black text-[#0A3D2E]">{zoomImage.title}</span>
              <button
                onClick={() => setZoomImage(null)}
                className="w-8 h-8 rounded-full bg-rose-100 text-rose-700 font-bold flex items-center justify-center text-sm"
              >
                ✕
              </button>
            </div>
            <div className="p-2 bg-black/95 flex items-center justify-center">
              <img
                src={resolvePublicAssetSrc(zoomImage.url)!}
                alt={zoomImage.title}
                className="max-h-[70vh] w-auto rounded-xl object-contain shadow-inner"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
