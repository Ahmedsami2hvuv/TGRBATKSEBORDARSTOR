import { Suspense } from "react";
import { formatDinarAsAlf, formatDinarAsAlfWithUnit } from "@/lib/money-alf";
import { resolvePublicAssetSrc } from "@/lib/image-url";
import { hasCustomerLocationUrl } from "@/lib/order-location";
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
import { NotesCopyButton } from "@/components/notes-copy-button";
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

export function OrderDetailSection({
  order,
  closeHref,
  auth,
  nextUrl,
  viewerCourierId,
  phoneProfile,
  smartHintLine,
  uiSettings,
  icons,
}: {
  order: MandoubOrderDetailPayload;
  closeHref: string;
  auth: { c: string; exp: string; s: string };
  nextUrl: string;
  viewerCourierId?: string;
  phoneProfile?: any;
  smartHintLine?: string | null;
  uiSettings?: UISectionConfig | null;
  icons?: GlobalIconsConfig | null;
}) {
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
    if (bConf.hidden) return null;

    const blockStyle = {
      backgroundColor: bConf.backgroundColor,
      fontSize: bConf.fontSize,
      gridColumn: bConf.fullWidth ? "span 2 / span 2" : "auto"
    };

    switch (blockId) {
      case "shop_info":
        return (
          <div key="shop" className={gridInfoPhoto} style={blockStyle}>
            <div className="space-y-2">
              <h3 className="flex items-center gap-1.5 text-lg font-bold text-emerald-800">
                <DynamicIcon icon={icons?.ui_shops} fallback="🏠" width={20} height={20} />
                المحل
              </h3>
              <p className="font-bold text-slate-900">{order.shop.name}</p>
              <p className="text-sm font-medium"><span className="text-slate-500">المسؤول: </span><span className="font-bold text-sky-900">{submitterName}</span></p>
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-mono text-sm font-bold text-slate-700">{contactLine(shopContactPhone)}</p>
              </div>
              <p className="text-slate-800">{order.shop.region.name}</p>
              <div className="mt-2">{order.shop.locationUrl?.trim() ? <a href={order.shop.locationUrl} target="_blank" rel="noopener noreferrer" className={locBtnEmerald}>فتح لوكيشن المحل <DynamicIcon icon={icons?.ui_external_link} fallback="↗" width={12} height={12} /></a> : <p className="text-xs font-bold text-amber-800">لا يوجد لوكيشن</p>}</div>
            </div>
            <div className="max-w-[12rem] self-start">
              {shopImageUrl ? <div className={squarePhotoFrame}><img src={imgSrc(shopImageUrl)!} alt="" className={squarePhotoCover} /></div> : <p className="text-xs text-slate-400">لا توجد صورة</p>}
              <div className="mt-2"><MandoubDoorPhotoForm orderId={order.id} nextUrl={nextUrl} {...auth} /></div>
            </div>
          </div>
        );
      case "customer_info":
        return (
          <div key="customer_parent" className="space-y-6">
            <div key="customer" className={gridInfoPhoto} style={blockStyle}>
              <div className="space-y-2">
                <h3 className="flex items-center gap-1.5 text-lg font-bold text-emerald-800">
                  <DynamicIcon icon={icons?.ui_user} fallback="👤" width={20} height={20} />
                  الزبون
                </h3>
                <p className="text-slate-800">{order.customerRegion?.name ?? "—"}</p>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-mono font-bold text-slate-900">{contactLine(order.customerPhone)}</p>
                  <a href={`tel:${order.customerPhone}`} className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-sky-600 text-white shadow-sm">
                    <DynamicIcon icon={icons?.ui_call} fallback="📞" width={14} height={14} />
                  </a>
                </div>
                {mergedAlternate && (
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <p className="font-mono text-sm font-bold text-slate-600">رقم ثانٍ: {mergedAlternate}</p>
                    <a href={`tel:${mergedAlternate}`} className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-slate-500 text-white shadow-sm">
                      <DynamicIcon icon={icons?.ui_call} fallback="📞" width={12} height={12} />
                    </a>
                  </div>
                )}
                {mergedLandmark && <p className="mt-1 text-sm font-medium text-slate-800">أقرب نقطة: {mergedLandmark}</p>}
                <p className="mt-1 text-sm font-bold text-emerald-800">
                  الاستدلال الذكي: {smartHintLine?.trim() || "—"}
                </p>
                <div className="mt-2">{mergedCustomerLocationUrl ? <a href={mergedCustomerLocationUrl} target="_blank" rel="noopener noreferrer" className={locBtnEmerald}>فتح لوكيشن الزبون <DynamicIcon icon={icons?.ui_external_link} fallback="↗" width={12} height={12} /></a> : <MandoubUploadLocationInline orderId={order.id} auth={auth} nextUrl={nextUrl} />}</div>
              </div>
              <div className="max-w-[12rem] self-start">{customerDoorDisplay ? <div className={squarePhotoFrame}><img src={imgSrc(customerDoorDisplay)!} alt="" className={squarePhotoCover} /></div> : <p className="text-xs text-slate-400">لا توجد صورة باب</p>}<div className="mt-2"><MandoubQuickDoorCapture orderId={order.id} nextUrl={nextUrl} auth={auth} /></div></div>
            </div>

            {order.routeMode === "double" && (
              <div key="receiver" className={`${gridInfoPhoto} mt-6 pt-6 border-t border-sky-100`} style={blockStyle}>
                <div className="space-y-2">
                  <h3 className="flex items-center gap-1.5 text-lg font-bold text-emerald-800">
                    <DynamicIcon icon={icons?.ui_users} fallback="👥" width={20} height={20} />
                    المستلم (الوجهة الثانية)
                  </h3>
                  <p className="text-slate-800">{order.secondCustomerRegion?.name ?? "—"}</p>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-mono font-bold text-slate-900">{contactLine(order.secondCustomerPhone || "")}</p>
                    {order.secondCustomerPhone && (
                      <a href={`tel:${order.secondCustomerPhone}`} className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-sky-600 text-white shadow-sm">
                        <DynamicIcon icon={icons?.ui_call} fallback="📞" width={14} height={14} />
                      </a>
                    )}
                  </div>
                  <div className="mt-2">
                    {order.secondCustomerLocationUrl?.trim() ? (
                      <a href={order.secondCustomerLocationUrl} target="_blank" rel="noopener noreferrer" className={locBtnEmerald}>فتح لوكيشن المستلم <DynamicIcon icon={icons?.ui_external_link} fallback="↗" width={12} height={12} /></a>
                    ) : (
                      <div className="flex flex-col gap-2">
                        <MandoubUploadLocationInline orderId={order.id} auth={auth} nextUrl={nextUrl} target="second" />
                      </div>
                    )}
                  </div>
                </div>
                <div className="max-w-[12rem] self-start">
                  <p className="text-xs text-slate-400 mb-2 font-bold">باب المستلم</p>
                  <div className="aspect-square flex items-center justify-center rounded-xl border-2 border-dashed border-slate-300 bg-white text-xs font-bold text-slate-400">قريباً</div>
                </div>
              </div>
            )}
          </div>
        );
      case "price_details":
        return (
          <div key="pricing" className={`${gridInfoPhoto} mt-8`} style={blockStyle}>
            <div className="space-y-4 rounded-2xl border-2 border-sky-100 bg-sky-50/50 p-4 shadow-inner">
              <div className="grid grid-cols-2 gap-4">
                <div><p className="text-xs font-bold text-slate-500 uppercase">نوع الطلب</p><div className="mt-1"><OrderTypeDetailBlock orderType={order.orderType} prefixClassName="font-black text-violet-950 bg-violet-100 px-2 py-0.5 rounded text-lg ring-1 ring-violet-300" restClassName="text-lg font-black text-slate-900" /></div></div>
                {order.orderNoteTime && <div><p className="text-xs font-bold text-slate-500 uppercase">وقت الطلب</p><p className="mt-1 text-sm font-black text-indigo-700">{order.orderNoteTime}</p></div>}
              </div>
              {!hideSubtotalInfo && (<div className="space-y-3 pt-2"><div className="flex justify-between items-center"><span className="text-sm font-bold text-slate-600">السعر:</span><span className="font-black text-slate-900 tabular-nums">{order.orderSubtotal != null ? `${formatDinarAsAlf(order.orderSubtotal)} ألف` : "—"}</span></div><div className="flex justify-between items-center"><span className="text-sm font-bold text-slate-600">توصيل:</span><span className="font-black text-slate-900 tabular-nums">{order.deliveryPrice != null ? `${formatDinarAsAlf(order.deliveryPrice)} ألف` : "—"}</span></div></div>)}
              <div className="rounded-xl border-2 border-violet-500/30 bg-violet-50/10 p-4 shadow-sm"><p className="text-xs font-black text-violet-900 uppercase tracking-widest mb-1">الكلي</p><p className="font-mono text-3xl font-black text-violet-950 tabular-nums">{order.totalAmount != null ? formatDinarAsAlfWithUnit(order.totalAmount) : "—"}</p></div>
            </div>
            <div className="max-w-[12rem] self-start">
              <p className="flex items-center gap-1 mb-2 text-sm font-bold text-slate-700">
                <DynamicIcon icon={icons?.ui_package} fallback="📦" width={14} height={14} />
                صورة الطلبية
              </p>
              {order.imageUrl ? <div className={squarePhotoFrame}><img src={imgSrc(order.imageUrl)!} alt="" className={squarePhotoContain} /></div> : <div className="aspect-square flex items-center justify-center rounded-xl border-2 border-dashed border-slate-300 bg-white text-xs font-bold text-slate-400">لا يوجد صورة</div>}<div className="mt-2"><MandoubOrderImageQuick orderId={order.id} nextUrl={nextUrl} auth={auth} /></div></div>
          </div>
        );
      case "notes_summary":
        return (
          <div key="notes" className="mt-6 border-t border-sky-100 pt-5" style={blockStyle}>
            <p className="flex items-center gap-1.5 text-xs font-black text-slate-400 mb-2 uppercase tracking-widest">
              <DynamicIcon icon={icons?.ui_note} fallback="📝" width={14} height={14} /> ملاحظات وقائمة المواد
            </p>
            <div className="flex flex-col gap-3">
              {(order.voiceNoteUrl || order.adminVoiceNoteUrl) && (
                <div className="flex flex-col gap-2 rounded-xl border-2 border-amber-100 bg-amber-50/20 p-3">
                  {order.voiceNoteUrl && (
                    <div className="flex flex-col gap-1">
                      <span className="flex items-center gap-1 text-[10px] font-bold text-amber-700">
                        <DynamicIcon icon={icons?.ui_audio} fallback="🎤" width={10} height={10} /> بصمة الزبون/المحل:
                      </span>
                      <VoiceNoteAudio src={resolvePublicAssetSrc(order.voiceNoteUrl) || ""} />
                    </div>
                  )}
                  {order.adminVoiceNoteUrl && (
                    <div className="flex flex-col gap-1">
                      <span className="flex items-center gap-1 text-[10px] font-bold text-amber-700">
                        <DynamicIcon icon={icons?.ui_audio} fallback="🎤" width={10} height={10} /> بصمة الإدارة:
                      </span>
                      <VoiceNoteAudio src={resolvePublicAssetSrc(order.adminVoiceNoteUrl) || ""} />
                    </div>
                  )}
                </div>
              )}
              <div className="relative rounded-xl border-2 border-amber-200 bg-amber-50/30 p-4"><div className="absolute end-3 top-3"><NotesCopyButton text={order.summary ?? ""} /></div><div className="whitespace-pre-wrap text-sm font-bold text-slate-800 leading-relaxed">{order.summary || "لا توجد ملاحظات"}</div></div>
            </div>
          </div>
        );
      case "money_flow":
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
              recordedAt: e.createdAt.toISOString(),
              deletedAt: e.deletedAt ? e.deletedAt.toISOString() : null,
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

  const layout = uiSettings?.layoutOrder && uiSettings.layoutOrder.length > 0
    ? uiSettings.layoutOrder
    : ["notes_summary", "shop_info", "customer_info", "price_details", "money_flow"];

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
        />

        <div className="grid grid-cols-1 gap-3 border-b border-sky-100 pb-3 sm:grid-cols-[1fr_auto] sm:items-start">
          <div>
            <h2 className="text-xl font-black text-slate-900 sm:text-2xl">رقم الطلب <span className="tabular-nums text-sky-800">#{order.orderNumber}</span></h2>
            <div className="flex flex-wrap items-center gap-3 mt-1">
               <p className="text-[11px] font-black text-sky-700 bg-sky-50 px-2 py-0.5 rounded border border-sky-100">تاريخ الرفع: {formatBaghdadDateTime(order.createdAt)}</p>
               {order.courier && <p className="text-[11px] font-bold text-slate-500">المندوب: {order.courier.name} ({order.courier.phone})</p>}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2"><MandoubOrderDetailActions closeHref={closeHref} /><span className={`rounded-full px-3 py-1.5 text-xs font-bold ${orderStatusBadgeClass(order.status)}`}>{STATUS_AR[order.status] ?? order.status}</span></div>
        </div>

        <MandoubCustomerEditForm orderId={order.id} defaultOrderStatus={order.status} defaultCustomerPhone={order.customerPhone} defaultCustomerLocationUrl={mergedCustomerLocationUrl} defaultCustomerLandmark={mergedLandmark} defaultAlternatePhone={mergedAlternate} auth={auth} nextUrl={nextUrl} />

        <div className="mt-5 space-y-6">
          {layout.map((blockId) => renderBlock(blockId))}
        </div>
      </div>
    </section>
  );
}
