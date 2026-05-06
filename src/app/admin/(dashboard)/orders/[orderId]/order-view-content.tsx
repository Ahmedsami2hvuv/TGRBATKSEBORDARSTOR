"use client";

import { useState } from "react";
import Link from "next/link";
import { ad } from "@/lib/admin-ui";
import { resolvePublicAssetSrc } from "@/lib/image-url";
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
import { NotesCopyButton } from "@/components/notes-copy-button";
import { AdminPricingPanel } from "../pending/pending-orders-client";
import { isAdminShopName } from "@/lib/admin-order-from-admin-constants";

const squarePhotoFrame = "aspect-square w-full overflow-hidden rounded-xl border border-sky-200 bg-slate-50";
const squarePhotoImg = "h-full w-full object-cover";
const squarePhotoContain = "h-full w-full object-contain";
const gridInfoPhoto = "grid grid-cols-[minmax(0,1fr)_minmax(0,12rem)] items-start gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.32fr)] sm:gap-6";

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
  shop: { name: string; phone: string; ownerName: string };
  shopPhotoUrl: string; shopLocationUrl: string; customerLocationUrl: string;
  customerLocationUploadedByName: string | null; customerRegion: { name: string } | null;
  customerRegionId: string | null;
  customerProfileId: string | null;
  courier: { name: string; phone: string } | null; customer: { name: string } | null;
  submittedBy: { name: string; phone: string } | null;
  submittedByCompanyPreparer: { name: string; phone: string } | null;
  preparerShoppingJson: any;
};

export function OrderViewContent({
  order,
  preparers = [],
  customWaButtons,
}: {
  order: OrderViewModel;
  preparers?: { id: string; name: string }[];
  customWaButtons?: Array<{
    id: string;
    label: string;
    iconKey: string;
    messages: string[];
  }>;
}) {
  const [pricingOpen, setPricingOpen] = useState(false);

  const imgOrder = resolvePublicAssetSrc(order.imageUrl);
  const voiceSrc = resolvePublicAssetSrc(order.voiceNoteUrl);
  const adminVoiceSrc = resolvePublicAssetSrc(order.adminVoiceNoteUrl);
  const imgShopDoor = resolvePublicAssetSrc(order.shopPhotoUrl || order.shopDoorPhotoUrl || null);
  const imgCustDoor = resolvePublicAssetSrc(order.customerDoorPhotoUrl);
  const imgCustDoor2 = resolvePublicAssetSrc(order.secondCustomerDoorPhotoUrl);

  const displayCustomerName = order.customer?.name?.trim() || null;

  const isReversePickup = order.reversePickup || isReversePickupOrderType(order.orderType);
  const isSystemAdminOrder = isAdminShopName(order.shop.name) || order.submissionSource === "admin_portal";
  const isDoubleRoute = order.routeMode === "double";

  const statusBadgeClass = order.prepaidAll ? orderStatusBadgeClassPrepaid(order.status, true) : orderStatusBadgeClass(order.status);

  const submitterPhone = order.submittedByCompanyPreparer?.phone?.trim()
    || order.submittedBy?.phone?.trim()
    || (order.submissionSource === "admin_portal" ? SYSTEM_ADMIN_PHONE : order.shop?.phone?.trim() || "");

  const parsedShoppingJson = parsePreparerShoppingJson(order.preparerShoppingJson);

  return (
    <div className={`kse-glass-dark relative mt-4 border p-4 pb-24 text-base leading-relaxed sm:p-5 sm:pb-32 ${orderStatusStartStripeClass(order.status)} ${order.prepaidAll ? "border-emerald-300 bg-gradient-to-b from-emerald-50 to-teal-50" : isReversePickup ? "border-violet-400 bg-violet-100" : isDoubleRoute ? "border-fuchsia-300 bg-gradient-to-b from-fuchsia-50 to-violet-50" : `border-sky-200 ${orderStatusDetailSurfaceClass(order.status)}`}`} dir="rtl">

      {/* بصمات الصوت في بداية الصفحة بتنسيق مرتب */}
      {(voiceSrc || adminVoiceSrc) && (
        <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {voiceSrc && (
            <div className="rounded-2xl border-2 border-amber-100 bg-white p-3 shadow-sm">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-black text-amber-600 flex items-center gap-1"><span>🗣️</span> بصمة الزبون (المحل)</span>
              </div>
              <VoiceNoteAudio src={voiceSrc} streamKey={`${order.id}-voice`} className="w-full" />
            </div>
          )}
          <AdminVoiceNoteSection variant="standalone" orderId={order.id} defaultAdminVoiceNoteUrl={order.adminVoiceNoteUrl} />
        </div>
      )}

      {pricingOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-2xl bg-white rounded-3xl shadow-2xl overflow-hidden border-2 border-amber-400">
            <div className="flex items-center justify-between bg-amber-50 px-6 py-4 border-b border-amber-200">
              <h3 className="text-lg font-black text-amber-900 flex items-center gap-2"><span>💰</span> لوحة تسعير الطلب #{order.orderNumber}</h3>
              <button onClick={() => setPricingOpen(false)} className="h-10 w-10 flex items-center justify-center rounded-xl bg-white border border-amber-200 text-amber-900 font-bold hover:bg-amber-100 transition-colors">✕</button>
            </div>
            <div className="p-6 overflow-y-auto max-h-[80vh]">
              <AdminPricingPanel
                orderId={order.id}
                initialData={parsedShoppingJson}
                orderSummary={order.summary}
                shops={[]}
                preparers={preparers}
                onSuccess={() => { setPricingOpen(false); window.location.reload(); }}
              />
            </div>
          </div>
        </div>
      )}

      {isReversePickup && <div className="mb-4 rounded-xl border border-violet-300 bg-violet-50 px-3 py-2 text-sm font-bold text-violet-950">تنبيه طلب عكسي</div>}
      {isDoubleRoute && (
        <div className="mb-4 inline-flex rounded-xl border border-fuchsia-300 bg-fuchsia-100 px-3 py-1.5 text-sm font-black text-fuchsia-900">
          وجهتين
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 border-b border-sky-100 pb-3 sm:grid-cols-[1fr_auto]">
        <div>
          <h2 className="text-xl font-black text-slate-900 sm:text-2xl">رقم الطلب <span className="tabular-nums text-sky-800">#{order.orderNumber}</span></h2>
          <p className="text-xs font-black text-sky-700 mt-1 bg-sky-50 px-2 py-0.5 rounded border border-sky-100 w-fit">تاريخ الرفع للنظام: {formatBaghdadDateTime(new Date(order.createdAt))}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Link href={`/admin/orders/${order.id}/edit`} className="inline-flex items-center rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-bold text-white shadow-sm">تعديل البيانات</Link>
            <button onClick={() => setPricingOpen(true)} className="inline-flex items-center rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-amber-600 transition-colors"><span>💰</span> تعديل التسعير</button>
            {order.status === "pending" && <Link href={`/admin/orders/pending?assignOrder=${order.id}`} className="inline-flex items-center rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white shadow-sm">إسناد للمندوب</Link>}
          </div>
        </div>
        <div className="flex flex-shrink-0 flex-wrap items-center gap-2"><span className={`rounded-full px-3 py-1.5 text-xs font-bold ${statusBadgeClass}`}>{STATUS_AR[order.status] ?? order.status}</span></div>
      </div>


      <div className="mt-5 space-y-6 sm:space-y-8">
        
        {/* --- SENDER / SHOP --- */}
        <div className={gridInfoPhoto}>
          <div className="space-y-2">
            <h3 className="text-lg font-bold text-emerald-800">
              {order.routeMode === "double" ? "المرسل (الوجهة الأولى)" : "المحل"}
            </h3>
            {order.routeMode === "double" ? (
              <>
                <p className="text-lg font-black text-slate-900">{displayCustomerName || "—"}</p>
                <p className="text-slate-800 font-bold">{order.customerRegion?.name ?? "—"}</p>
                <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-3 max-w-sm">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl font-black text-emerald-950 tabular-nums">{order.customerPhone}</span>
                    <a href={`tel:${order.customerPhone}`} className="bg-emerald-600 px-3 py-1 text-xs font-bold text-white rounded-full">اتصال 📞</a>
                  </div>
                  {order.alternatePhone && (
                    <div className="flex items-center gap-3 mt-2">
                      <span className="text-xl font-black text-emerald-800 tabular-nums">{order.alternatePhone}</span>
                      <a href={`tel:${order.alternatePhone}`} className="bg-sky-600 px-3 py-1 text-xs font-bold text-white rounded-full">رقم ثاني 📞</a>
                    </div>
                  )}
                </div>
                <p className="text-sm font-medium text-slate-800">أقرب نقطة: {order.customerLandmark?.trim() || "—"}</p>
                {!order.customerLandmark?.trim() ? (
                  <p className="text-sm font-bold text-emerald-800">الاستدلال الذكي: {order.smartHintLine?.trim() || "—"}</p>
                ) : null}
                <div className="mt-2 space-y-2">
                  {order.customerLocationUrl?.trim() ? (
                    <div className="space-y-1">
                      <a href={order.customerLocationUrl} target="_blank" rel="noopener noreferrer" className="inline-flex bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white rounded-lg">لوكيشن المرسل ↗</a>
                      <ImageUploaderCaption name={order.customerLocationUploadedByName} />
                    </div>
                  ) : (
                    <div className="mt-2"><AdminCustomerLocationQuick orderId={order.id} /></div>
                  )}
                </div>
              </>
            ) : (
              <>
                {isSystemAdminOrder ? <p className="text-3xl font-black text-indigo-700 tabular-nums">{SYSTEM_ADMIN_PHONE}</p> :
                  <>
                    <p className="font-bold text-slate-900">{order.shop.name}</p>
                    <p className="text-sm font-medium"><span className="text-slate-500">المسؤول: </span><span className="font-bold text-sky-900">{order.submittedByCompanyPreparer?.name || order.submittedBy?.name || "—"}</span></p>
                    <div className="mt-2">{order.shopLocationUrl?.trim() ? <a href={order.shopLocationUrl} target="_blank" rel="noopener noreferrer" className="inline-flex bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white rounded-lg">فتح اللوكيشن ↗</a> : <p className="text-xs font-bold text-amber-800">لا يوجد لوكيشن</p>}</div>
                  </>
                }
              </>
            )}
          </div>
          <div className="self-start">
            {order.routeMode === "double" ? (
              <>
                {imgCustDoor ? <div className={squarePhotoFrame}><img src={imgCustDoor} alt="" className={squarePhotoImg} /></div> : <div className="aspect-square border-dashed border-2 flex items-center justify-center rounded-xl text-xs text-slate-400">لا توجد صورة</div>}
                <div className="mt-2 space-y-2">
                  <CustomerDoorPhotoQuick orderId={order.id} hasImage={!!order.customerDoorPhotoUrl} />
                  <ImageUploaderCaption name={order.customerDoorPhotoUploadedByName} />
                </div>
              </>
            ) : (
              !isSystemAdminOrder && (
                <>
                  {imgShopDoor ? <div className={squarePhotoFrame}><img src={imgShopDoor} alt="" className={squarePhotoImg} /></div> : <div className="aspect-square border-dashed border-2 flex items-center justify-center rounded-xl text-xs text-slate-400">لا توجد صورة</div>}
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
                  <div className="flex items-center gap-3">
                    <span className="text-2xl font-black text-emerald-950 tabular-nums">{order.secondCustomerPhone || "—"}</span>
                    {order.secondCustomerPhone && <a href={`tel:${order.secondCustomerPhone}`} className="bg-emerald-600 px-3 py-1 text-xs font-bold text-white rounded-full">اتصال 📞</a>}
                  </div>
                </div>
                <p className="text-sm font-medium text-slate-800">أقرب نقطة: {order.secondCustomerLandmark?.trim() || "—"}</p>
                {!order.secondCustomerLandmark?.trim() ? (
                  <p className="text-sm font-bold text-emerald-800">الاستدلال الذكي: {order.secondSmartHintLine?.trim() || "—"}</p>
                ) : null}
                <div className="mt-2 space-y-2">
                  {order.secondCustomerLocationUrl?.trim() ? (
                    <div className="space-y-1">
                      <a href={order.secondCustomerLocationUrl} target="_blank" rel="noopener noreferrer" className="inline-flex bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white rounded-lg">لوكيشن المستلم ↗</a>
                      <ImageUploaderCaption name={order.secondCustomerDoorPhotoUploadedByName} />
                    </div>
                  ) : (
                    <div className="mt-2"><AdminCustomerLocationQuick orderId={order.id} target="second" /></div>
                  )}
                </div>
              </>
            ) : (
              <>
                <p className="text-lg font-black text-slate-900">{displayCustomerName || "—"}</p>
                <p className="text-slate-800 font-bold">{order.customerRegion?.name ?? "—"}</p>
                <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-3 max-w-sm">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl font-black text-emerald-950 tabular-nums">{order.customerPhone}</span>
                    <a href={`tel:${order.customerPhone}`} className="bg-emerald-600 px-3 py-1 text-xs font-bold text-white rounded-full">اتصال 📞</a>
                  </div>
                  {(order.alternatePhone || order.secondCustomerPhone) && (
                    <div className="flex flex-col gap-2 mt-2 pt-2 border-t border-emerald-100">
                      {order.alternatePhone && (
                        <div className="flex items-center gap-3">
                          <span className="text-xl font-black text-emerald-800 tabular-nums">{order.alternatePhone}</span>
                          <a href={`tel:${order.alternatePhone}`} className="bg-sky-600 px-3 py-1 text-xs font-bold text-white rounded-full">رقم ثاني 📞</a>
                        </div>
                      )}
                      {order.secondCustomerPhone && order.secondCustomerPhone !== order.alternatePhone && (
                        <div className="flex items-center gap-3">
                          <span className="text-xl font-black text-emerald-800 tabular-nums">{order.secondCustomerPhone}</span>
                          <a href={`tel:${order.secondCustomerPhone}`} className="bg-indigo-600 px-3 py-1 text-xs font-bold text-white rounded-full">رقم ثالث 📞</a>
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <p className="text-sm font-medium text-slate-800">أقرب نقطة: {order.customerLandmark?.trim() || "—"}</p>
                {!order.customerLandmark?.trim() ? (
                  <p className="text-sm font-bold text-emerald-800">الاستدلال الذكي: {order.smartHintLine?.trim() || "—"}</p>
                ) : null}
                <div className="mt-2 space-y-2">
                  {order.customerLocationUrl?.trim() ? (
                    <div className="space-y-1">
                      <a href={order.customerLocationUrl} target="_blank" rel="noopener noreferrer" className="inline-flex bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white rounded-lg">لوكيشن الزبون ↗</a>
                      <ImageUploaderCaption name={order.customerLocationUploadedByName} />
                    </div>
                  ) : (
                    <div className="mt-2"><AdminCustomerLocationQuick orderId={order.id} /></div>
                  )}
                  <div className="flex flex-wrap gap-2">
                    <AdminCustomerOrderHistory
                      phone={order.customerPhone}
                      regionId={order.customerRegionId}
                      currentOrderId={order.id}
                      customerName={order.customer?.name}
                      customerRegionName={order.customerRegion?.name ?? null}
                      alternatePhone={order.alternatePhone}
                      customerLocationUrl={order.customerLocationUrl}
                      customerLandmark={order.customerLandmark}
                      customerProfileId={order.customerProfileId}
                    />
                    {order.customerProfileId ? (
                      <Link href={`/admin/customers/profiles/${order.customerProfileId}/edit`} className="inline-flex items-center rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-900 shadow-sm hover:bg-slate-50 transition-colors">ملف الزبون المباشر</Link>
                    ) : null}
                  </div>
                </div>
              </>
            )}
          </div>
          <div className="self-start">
            {order.routeMode === "double" ? (
              <>
                {imgCustDoor2 ? <div className={squarePhotoFrame}><img src={imgCustDoor2} alt="" className={squarePhotoImg} /></div> : <div className="aspect-square border-dashed border-2 flex items-center justify-center rounded-xl text-xs text-slate-400">لا توجد صورة</div>}
                <div className="mt-2 space-y-2">
                  {/* NEED SECOND CUSTOMER DOOR PHOTO UPLOADER HERE. WE'LL LEAVE IT READ ONLY FOR NOW */}
                  <ImageUploaderCaption name={order.secondCustomerDoorPhotoUploadedByName} />
                </div>
              </>
            ) : (
              <>
                {imgCustDoor ? <div className={squarePhotoFrame}><img src={imgCustDoor} alt="" className={squarePhotoImg} /></div> : <div className="aspect-square border-dashed border-2 flex items-center justify-center rounded-xl text-xs text-slate-400">لا توجد صورة</div>}
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
             <div className="flex items-center gap-2 mb-3">
                <span className="text-2xl">🚚</span>
                <h3 className="text-lg font-black text-purple-900">المندوب المسجل على الطلب</h3>
             </div>
             <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                   <p className="text-2xl font-black text-slate-900">{order.courier.name}</p>
                   <p className="text-lg font-bold text-purple-800 tabular-nums">{order.courier.phone}</p>
                </div>
                <div className="flex gap-2">
                   <a href={`tel:${order.courier.phone}`} className="inline-flex items-center gap-2 rounded-xl bg-purple-600 px-5 py-2.5 text-sm font-black text-white shadow-md transition hover:bg-purple-700 active:scale-95">
                      <span>📞</span> اتصال بالمندوب
                   </a>
                </div>
             </div>
          </div>
        )}

        <div className={gridInfoPhoto}>
          <div className="space-y-4 rounded-xl border border-sky-100 bg-sky-50/50 p-4">
            <div className="grid grid-cols-2 gap-4">
              <div><p className="text-sm font-bold text-slate-700 mb-1">نوع الطلب</p><OrderTypeDetailBlock orderType={order.orderType} prefixClassName="font-black text-violet-950 bg-violet-100 px-2 py-1 rounded-lg text-lg ring-1 ring-violet-300" restClassName="text-lg font-black text-slate-900" /></div>
              {order.orderNoteTime && <div><p className="text-sm font-bold text-slate-700 mb-1">وقت الطلب</p><p className="text-sm font-black text-indigo-700 bg-indigo-50 px-2 py-1 rounded-md border border-indigo-200 inline-block">{order.orderNoteTime}</p></div>}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><p className="text-xs font-bold text-slate-500">سعر البضاعة</p><p className="font-mono text-lg font-black text-slate-900">{order.orderSubtotal || "0"} ألف</p></div>
              <div><p className="text-xs font-bold text-slate-500">التوصيل</p><p className="font-mono text-lg font-black text-slate-900">{order.deliveryPrice || "0"} ألف</p></div>
            </div>
            <div className="rounded-lg border-2 border-violet-500/30 bg-violet-500/10 p-3 shadow-sm"><p className="text-xs font-black text-violet-900 mb-1">المبلغ الكلي</p><p className="font-mono text-3xl font-black text-violet-950 tabular-nums">{order.totalAmount || "—"}</p></div>
          </div>
          <div className="self-start">
            <p className="mb-1.5 text-sm font-bold text-slate-700">صورة الطلبية</p>
            {imgOrder ? <div className={squarePhotoFrame}><img src={imgOrder} alt="" className={squarePhotoContain} /></div> : <div className="aspect-square border-dashed border-2 flex items-center justify-center rounded-xl text-xs text-slate-400">لا توجد صورة</div>}
            <div className="mt-2 space-y-2">
              <AdminOrderPhotoQuick orderId={order.id} kind="order" hasImage={!!order.imageUrl} />
              <ImageUploaderCaption name={order.orderImageUploadedByName} />
            </div>
          </div>
        </div>
      </div>

      <div className="mt-6 border-t border-sky-100 pt-5">
        <p className="text-xs font-black text-slate-400 mb-2 uppercase tracking-widest">قائمة المواد والملاحظات</p>

        {order.submissionSource === "web_store" &&
          parsedShoppingJson &&
          Array.isArray(parsedShoppingJson.webStoreCart) &&
          (parsedShoppingJson.webStoreCart as unknown[]).length > 0 && (
          <div className="mb-4 space-y-2">
            <p className="text-[10px] font-black text-amber-600 bg-amber-50 px-2 py-1 rounded border border-amber-100 w-fit">تفاصيل السلة (المتجر)</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {(parsedShoppingJson.webStoreCart as any[]).map((item: any, idx: number) => (
                <div key={idx} className="flex justify-between items-center p-3 rounded-xl border border-slate-100 bg-white shadow-sm">
                  <div className="flex flex-col">
                    <span className="text-sm font-black text-slate-900">{item.name}</span>
                    <span className="text-[10px] font-bold text-slate-500">{item.price?.toLocaleString()} د.ع × {item.quantity}</span>
                  </div>
                  <span className="text-sm font-mono font-black text-violet-600">{(item.price * item.quantity).toLocaleString()} د.ع</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className={`relative rounded-xl border-2 p-4 pe-16 ${order.summary?.trim() ? "border-amber-200 bg-amber-50/30" : "border-transparent bg-slate-50"}`}>
          <div className="absolute end-3 top-3"><NotesCopyButton text={order.summary ?? ""} /></div>
          <div className="whitespace-pre-wrap text-sm font-bold text-slate-800 leading-relaxed">{order.summary || "لا توجد ملاحظات"}</div>
        </div>
      </div>

      <OrderFabDock
        storageKey="adminFab_v1"
        orderId={order.id}
        shopPhone={submitterPhone}
        shopLabel={isDoubleRoute ? "المرسل" : "المحل"}
        customerPhone={order.customerPhone}
        customerAlternatePhone={order.alternatePhone ?? undefined}
        customWaButtons={customWaButtons}
        editUrl={`/admin/orders/${order.id}/edit`}
      />
    </div>
  );
}
