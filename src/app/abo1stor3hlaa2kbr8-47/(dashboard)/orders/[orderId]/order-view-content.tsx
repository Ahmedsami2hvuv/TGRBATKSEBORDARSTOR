"use client";

import { useState } from "react";
import Link from "next/link";
import { ad } from "@/lib/admin-ui";

const SECRET_ADMIN_PATH = "/abo1stor3hlaa2kbr8-47";

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
import { DynamicIcon } from "@/components/dynamic-icon";

const squarePhotoFrame = "aspect-square w-full overflow-hidden rounded-3xl border border-slate-200 bg-slate-50 shadow-sm transition-all hover:shadow-md group cursor-zoom-in";
const squarePhotoImg = "h-full w-full object-cover transition-transform duration-500 group-hover:scale-110";
const squarePhotoContain = "h-full w-full object-contain p-2 transition-transform duration-500 group-hover:scale-110";
const gridInfoPhoto = "grid grid-cols-1 items-start gap-4 sm:grid-cols-[1fr_200px] sm:gap-8";
const compactPhoneText = "font-mono text-base font-black text-slate-900 tabular-nums sm:text-lg [direction:ltr] break-all group-hover:text-indigo-600 transition-colors";

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
    <div className={`relative mt-6 ${ad.section} !p-0 overflow-hidden shadow-2xl ${orderStatusStartStripeClass(order.status)}`} dir="rtl">
      {/* Background Status Tint */}
      <div className={`absolute inset-0 opacity-[0.03] pointer-events-none ${order.prepaidAll ? "bg-emerald-500" : isReversePickup ? "bg-violet-500" : isDoubleRoute ? "bg-fuchsia-500" : "bg-indigo-500"}`}></div>

      <div className="relative p-5 sm:p-8 pb-24 sm:pb-32">
        {order.isBlocked && (
          <div className="mb-6 animate-pulse rounded-2xl border-4 border-rose-600 bg-rose-50 p-4 text-center text-xl font-black text-rose-900 shadow-xl" role="alert">
            🛑 تنبيه: هذا الزبون محظور (Blocklist)
          </div>
        )}

        {/* بصمات الصوت */}
        {(voiceSrc || adminVoiceSrc) && (
          <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
            {voiceSrc && (
              <div className="rounded-3xl border border-amber-100 bg-amber-50/30 p-4 shadow-sm">
                <p className="mb-2 text-[10px] font-black text-amber-600 uppercase tracking-widest flex items-center gap-2">
                  <span>🗣️</span> بصمة الزبون / المحل
                </p>
                <VoiceNoteAudio src={voiceSrc} streamKey={`${order.id}-voice`} className="w-full" />
              </div>
            )}
            <AdminVoiceNoteSection variant="standalone" orderId={order.id} defaultAdminVoiceNoteUrl={order.adminVoiceNoteUrl} />
          </div>
        )}

        {pricingOpen && (
          <div className="fixed inset-0 z-[500] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-md animate-in fade-in duration-300">
            <div className="w-full max-w-2xl bg-white rounded-[2rem] shadow-[0_20px_60px_rgba(0,0,0,0.3)] overflow-hidden border border-slate-200">
              <div className="flex items-center justify-between bg-slate-50 px-6 py-4 border-b border-slate-100">
                <h3 className={ad.h2}>تعديل تسعير الطلب <span className="text-indigo-600">#{order.orderNumber}</span></h3>
                <button onClick={() => setPricingOpen(false)} className="h-10 w-10 flex items-center justify-center rounded-2xl bg-white border border-slate-200 text-slate-400 hover:text-rose-600 hover:border-rose-200 shadow-sm transition-all">✕</button>
              </div>
              <div className="p-0 overflow-y-auto max-h-[85vh]">
                <AdminPricingPanel
                  orderId={order.id}
                  initialData={parsedShoppingJson}
                  orderSummary={order.summary}
                  shops={[]}
                  preparers={preparers}
                  rawDeliveryPriceDinar={order.deliveryPrice != null ? Number(order.deliveryPrice) : null}
                  onSuccess={() => { setPricingOpen(false); window.location.reload(); }}
                />
              </div>
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3 mb-6">
          {isReversePickup && <span className="px-3 py-1 rounded-full bg-violet-600 text-white text-[10px] font-black shadow-lg shadow-violet-200">طلب عكسي</span>}
          {isDoubleRoute && <span className="px-3 py-1 rounded-full bg-fuchsia-600 text-white text-[10px] font-black shadow-lg shadow-fuchsia-200">وجهتين</span>}
          {order.prepaidAll && <span className="px-3 py-1 rounded-full bg-emerald-600 text-white text-[10px] font-black shadow-lg shadow-emerald-200">مدفوع مسبقاً</span>}
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 border-b border-slate-100 pb-6 mb-8">
          <div>
            <h2 className={ad.h1}>رقم الطلب <span className="tabular-nums text-indigo-600">#{order.orderNumber}</span></h2>
            <p className="text-[10px] font-black text-slate-400 mt-1 uppercase tracking-widest">بتاريخ: {formatBaghdadDateTime(new Date(order.createdAt))}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Link href={`${SECRET_ADMIN_PATH}/orders/${order.id}/edit`} className={ad.navButton}>تعديل البيانات</Link>
              <button onClick={() => setPricingOpen(true)} className={`${ad.btnPrimary} !bg-amber-500 hover:!bg-amber-600 !shadow-amber-100`}>
                💰 تعديل التسعير
              </button>
              {order.status === "pending" && <Link href={`${SECRET_ADMIN_PATH}/orders/pending?assignOrder=${order.id}`} className={ad.btnPrimary}>إسناد للمندوب</Link>}
            </div>
          </div>
          <div className="flex flex-col items-end gap-2">
            <span className={ad.label}>حالة الطلب الآن</span>
            <span className={`rounded-2xl px-5 py-2 text-sm font-black shadow-xl ${statusBadgeClass}`}>{STATUS_AR[order.status] ?? order.status}</span>
          </div>
        </div>

        <div className="space-y-12">
          {/* --- SENDER / SHOP --- */}
          <section className={gridInfoPhoto}>
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center shadow-sm">
                  <span className="text-lg">🏪</span>
                </div>
                <h3 className={ad.h2 + " !text-emerald-700"}>{order.routeMode === "double" ? "جهة الإرسال (1)" : "معلومات المحل / المصدر"}</h3>
              </div>

              <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm space-y-4 group">
                {order.routeMode === "double" ? (
                  <>
                    <p className="text-xl font-black text-slate-900">{displayCustomerName || "—"}</p>
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded-lg bg-emerald-50 text-emerald-700 text-[10px] font-black border border-emerald-100">{order.customerRegion?.name ?? "غير محدد"}</span>
                    </div>
                    <div className="space-y-1">
                      <span className={compactPhoneText}>{order.customerPhone}</span>
                      {order.alternatePhone && <div className="pt-1 border-t border-slate-50"><span className={compactPhoneText}>{order.alternatePhone}</span></div>}
                    </div>
                    <p className="text-sm font-bold text-slate-600">نقطة دالة: {order.customerLandmark?.trim() || "—"}</p>
                    <div className="pt-2 flex flex-wrap gap-2">
                      {order.customerLocationUrl?.trim() ? (
                        <div className="space-y-2 w-full">
                          <a href={order.customerLocationUrl} target="_blank" rel="noopener noreferrer" className={ad.btnPrimary + " !py-2 !text-xs !bg-emerald-600 w-fit"}>لوكيشن المرسل ↗</a>
                          <ImageUploaderCaption name={order.customerLocationUploadedByName} />
                        </div>
                      ) : <AdminCustomerLocationQuick orderId={order.id} />}
                    </div>
                  </>
                ) : (
                  <>
                    {isSystemAdminOrder ? (
                      <div className="space-y-2">
                        <p className="text-[10px] font-black text-indigo-500 uppercase tracking-widest">طلب إداري مباشر</p>
                        <p className="text-3xl font-black text-slate-900 tabular-nums">{SYSTEM_ADMIN_PHONE}</p>
                      </div>
                    ) : (
                      <>
                        <p className="text-xl font-black text-slate-900">{order.shop.name}</p>
                        <div className="flex items-center gap-2 text-sm">
                          <span className="text-slate-400 font-bold">المسؤول:</span>
                          <span className="font-black text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-lg border border-indigo-100">{order.submittedByCompanyPreparer?.name || order.submittedBy?.name || "—"}</span>
                        </div>
                        <div className="pt-2">
                          {order.shopLocationUrl?.trim() ? (
                            <a href={order.shopLocationUrl} target="_blank" rel="noopener noreferrer" className={ad.btnPrimary + " !py-2 !text-xs !bg-emerald-600 w-fit"}>لوكيشن المحل ↗</a>
                          ) : <p className={ad.warn + " text-[10px]"}>لا يوجد لوكيشن مسجل</p>}
                        </div>
                      </>
                    )}
                  </>
                )}
              </div>
            </div>

            <div className="space-y-3">
              <span className={ad.label}>الصورة المرفقة</span>
              <div className={squarePhotoFrame}>
                {order.routeMode === "double" ? (
                  imgCustDoor ? <img src={imgCustDoor} alt="" className={squarePhotoImg} /> : <div className="h-full flex flex-col items-center justify-center gap-2 text-slate-300"><span className="text-2xl">🖼️</span><p className="text-[9px] font-black">لا توجد صورة</p></div>
                ) : (
                  !isSystemAdminOrder && (imgShopDoor ? <img src={imgShopDoor} alt="" className={squarePhotoImg} /> : <div className="h-full flex flex-col items-center justify-center gap-2 text-slate-300"><span className="text-2xl">🖼️</span><p className="text-[9px] font-black">لا توجد صورة</p></div>)
                )}
              </div>
              <div className="flex flex-col gap-2">
                {order.routeMode === "double" ? (
                  <>
                    <CustomerDoorPhotoQuick orderId={order.id} hasImage={!!order.customerDoorPhotoUrl} />
                    <ImageUploaderCaption name={order.customerDoorPhotoUploadedByName} />
                  </>
                ) : (!isSystemAdminOrder && (
                  <>
                    <AdminOrderPhotoQuick orderId={order.id} kind="shop" hasImage={!!(order.shopPhotoUrl || order.shopDoorPhotoUrl)} />
                    <ImageUploaderCaption name={order.shopDoorPhotoUploadedByName} />
                  </>
                ))}
              </div>
            </div>
          </section>

          {/* --- RECEIVER / CUSTOMER --- */}
          <section className={gridInfoPhoto}>
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-xl bg-sky-100 text-sky-600 flex items-center justify-center shadow-sm">
                  <span className="text-lg">👤</span>
                </div>
                <h3 className={ad.h2 + " !text-sky-700"}>{order.routeMode === "double" ? "جهة الاستلام (2)" : "معلومات الزبون / المستلم"}</h3>
              </div>

              <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm space-y-4 group">
                {order.routeMode === "double" ? (
                  <>
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded-lg bg-sky-50 text-sky-700 text-[10px] font-black border border-sky-100">{order.secondCustomerRegion?.name ?? "غير محدد"}</span>
                    </div>
                    <div className="space-y-1">
                      <span className={compactPhoneText}>{order.secondCustomerPhone || "—"}</span>
                    </div>
                    <p className="text-sm font-bold text-slate-600">نقطة دالة: {order.secondCustomerLandmark?.trim() || "—"}</p>
                    <div className="pt-2 flex flex-wrap gap-2">
                      {order.secondCustomerLocationUrl?.trim() ? (
                        <div className="space-y-2 w-full">
                          <a href={order.secondCustomerLocationUrl} target="_blank" rel="noopener noreferrer" className={ad.btnPrimary + " !py-2 !text-xs !bg-sky-600 w-fit"}>لوكيشن المستلم ↗</a>
                          <ImageUploaderCaption name={order.secondCustomerDoorPhotoUploadedByName} />
                        </div>
                      ) : <AdminCustomerLocationQuick orderId={order.id} target="second" />}
                    </div>
                  </>
                ) : (
                  <>
                    <p className="text-xl font-black text-slate-900">{displayCustomerName || "—"}</p>
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded-lg bg-sky-50 text-sky-700 text-[10px] font-black border border-sky-100">{order.customerRegion?.name ?? "غير محدد"}</span>
                    </div>
                    <div className="space-y-1">
                      <span className={compactPhoneText}>{order.customerPhone}</span>
                      {(order.alternatePhone || order.secondCustomerPhone) && (
                        <div className="flex flex-col gap-1 pt-1 border-t border-slate-50">
                          {order.alternatePhone && <span className={compactPhoneText}>{order.alternatePhone}</span>}
                          {order.secondCustomerPhone && order.secondCustomerPhone !== order.alternatePhone && <span className={compactPhoneText}>{order.secondCustomerPhone}</span>}
                        </div>
                      )}
                    </div>
                    <p className="text-sm font-bold text-slate-600">نقطة دالة: {order.customerLandmark?.trim() || "—"}</p>
                    <div className="pt-2 space-y-3">
                      {order.customerLocationUrl?.trim() ? (
                        <div className="space-y-2 w-full">
                          <a href={order.customerLocationUrl} target="_blank" rel="noopener noreferrer" className={ad.btnPrimary + " !py-2 !text-xs !bg-sky-600 w-fit"}>لوكيشن الزبون ↗</a>
                          <ImageUploaderCaption name={order.customerLocationUploadedByName} />
                        </div>
                      ) : <AdminCustomerLocationQuick orderId={order.id} />}

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
                        {order.customerProfileId && (
                          <Link href={`${SECRET_ADMIN_PATH}/customers/profiles/${order.customerProfileId}/edit`} className={ad.navButton + " !text-[10px]"}>فتح البروفايل</Link>
                        )}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>

            <div className="space-y-3">
              <span className={ad.label}>صورة الواجهة</span>
              <div className={squarePhotoFrame}>
                {order.routeMode === "double" ? (
                  imgCustDoor2 ? <img src={imgCustDoor2} alt="" className={squarePhotoImg} /> : <div className="h-full flex flex-col items-center justify-center gap-2 text-slate-300"><span className="text-2xl">🖼️</span><p className="text-[9px] font-black">لا توجد صورة</p></div>
                ) : (
                  imgCustDoor ? <img src={imgCustDoor} alt="" className={squarePhotoImg} /> : <div className="h-full flex flex-col items-center justify-center gap-2 text-slate-300"><span className="text-2xl">🖼️</span><p className="text-[9px] font-black">لا توجد صورة</p></div>
                )}
              </div>
              <div className="flex flex-col gap-2">
                {order.routeMode !== "double" && <CustomerDoorPhotoQuick orderId={order.id} hasImage={!!order.customerDoorPhotoUrl} />}
                <ImageUploaderCaption name={order.routeMode === "double" ? order.secondCustomerDoorPhotoUploadedByName : order.customerDoorPhotoUploadedByName} />
              </div>
            </div>
          </section>

          {/* قسم المندوب */}
          {order.courier && (
            <div className="rounded-[2.5rem] bg-slate-900 p-8 shadow-2xl relative overflow-hidden group">
               <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 blur-3xl -mr-16 -mt-16 group-hover:bg-indigo-500/20 transition-all duration-700"></div>
               <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-6">
                  <div className="flex items-center gap-4">
                    <div className="h-14 w-14 rounded-2xl bg-indigo-600 flex items-center justify-center text-white text-2xl shadow-xl shadow-indigo-500/20">🚚</div>
                    <div>
                       <p className={ad.label + " !text-indigo-400 !mb-0.5"}>المندوب المكلّف</p>
                       <p className="text-2xl font-black text-white">{order.courier.name}</p>
                    </div>
                  </div>
                  <div className="bg-white/5 backdrop-blur-md rounded-2xl p-4 border border-white/10 group-hover:border-indigo-500/30 transition-all">
                     <p className="font-mono text-xl font-black text-indigo-400 tabular-nums [direction:ltr]">{order.courier.phone}</p>
                  </div>
               </div>
            </div>
          )}

          {/* تفاصيل المبالغ والنوع */}
          <section className={gridInfoPhoto}>
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center shadow-sm">
                  <span className="text-lg">📋</span>
                </div>
                <h3 className={ad.h2}>تفاصيل الطلبية والنوع</h3>
              </div>

              <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                    <p className={ad.label}>نوع الخدمة</p>
                    <OrderTypeDetailBlock orderType={order.orderType} prefixClassName="font-black text-indigo-600 text-lg" restClassName="text-sm font-bold text-slate-700" />
                  </div>
                  {order.orderNoteTime && (
                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                      <p className={ad.label}>وقت التسليم</p>
                      <p className="text-lg font-black text-slate-900">{order.orderNoteTime}</p>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="text-center">
                    <p className={ad.label + " !pr-0"}>البضاعة</p>
                    <p className="text-lg font-black text-slate-900 font-mono">{order.orderSubtotal || "0"}</p>
                  </div>
                  <div className="text-center">
                    <p className={ad.label + " !pr-0"}>التوصيل</p>
                    <p className="text-lg font-black text-slate-900 font-mono">{order.deliveryPrice || "0"}</p>
                  </div>
                  <div className="bg-indigo-600 text-white rounded-2xl p-3 shadow-lg shadow-indigo-100 flex flex-col items-center justify-center">
                    <p className="text-[9px] font-black opacity-80 uppercase tracking-widest mb-0.5">الإجمالي</p>
                    <p className="text-xl font-black font-mono leading-none">{order.totalAmount || "—"}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <span className={ad.label}>صورة الطلب</span>
              <div className={squarePhotoFrame}>
                {imgOrder ? <img src={imgOrder} alt="" className={squarePhotoContain} /> : <div className="h-full flex flex-col items-center justify-center gap-2 text-slate-300"><span className="text-2xl">🖼️</span><p className="text-[9px] font-black">لا توجد صورة</p></div>}
              </div>
              <AdminOrderPhotoQuick orderId={order.id} kind="order" hasImage={!!order.imageUrl} />
              <ImageUploaderCaption name={order.orderImageUploadedByName} />
            </div>
          </section>
        </div>

        {/* الملاحظات والسلة */}
        {(() => {
          const hasNotes = Boolean(order.summary?.trim());
          const cartItems = order.submissionSource === "web_store" && parsedShoppingJson && Array.isArray(parsedShoppingJson.webStoreCart) ? (parsedShoppingJson.webStoreCart as any[]) : [];
          const hasCart = cartItems.length > 0;
          if (!hasNotes && !hasCart) return null;
          return (
            <div className="mt-12 pt-8 border-t border-slate-100">
              <div className="flex items-center gap-3 mb-6">
                <div className="h-8 w-8 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center shadow-sm">
                  <span className="text-lg">📝</span>
                </div>
                <h3 className={ad.h2 + " !text-amber-700"}>المواد والملاحظات</h3>
              </div>

              {hasCart && (
                <div className="mb-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {cartItems.map((item: any, idx: number) => (
                    <div key={idx} className="flex justify-between items-center p-4 rounded-2xl bg-white border border-slate-100 shadow-sm hover:border-indigo-200 transition-colors group">
                      <div className="flex flex-col">
                        <span className="text-sm font-black text-slate-900 group-hover:text-indigo-600 transition-colors">{item.name}</span>
                        <span className="text-[10px] font-bold text-slate-400 tabular-nums">{item.price?.toLocaleString()} × {item.quantity}</span>
                      </div>
                      <span className="text-sm font-mono font-black text-indigo-600 bg-indigo-50 px-2 py-1 rounded-lg">{(item.price * item.quantity).toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              )}

              {hasNotes && (
                <div className="relative rounded-[2rem] border border-amber-200 bg-amber-50/20 p-6 sm:p-8 overflow-hidden group">
                  <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/5 blur-2xl -mr-12 -mt-12"></div>
                  <div className="absolute left-6 top-6 z-10">
                    <NotesCopyButton text={order.summary ?? ""} />
                  </div>
                  <div className="whitespace-pre-wrap text-base font-bold text-slate-800 leading-relaxed relative z-0">{order.summary}</div>
                </div>
              )}
            </div>
          );
        })()}
      </div>

      <OrderFabDock
        storageKey="adminFab_v2"
        orderId={order.id}
        shopPhone={submitterPhone}
        shopLabel={isDoubleRoute ? "المرسل" : "المحل"}
        customerPhone={order.customerPhone}
        customerAlternatePhone={order.alternatePhone ?? undefined}
        customWaButtons={customWaButtons}
        editUrl={`${SECRET_ADMIN_PATH}/orders/${order.id}/edit`}
      />
    </div>
  );
      <OrderFabDock
        storageKey="adminFab_v1"
        orderId={order.id}
        shopPhone={submitterPhone}
        shopLabel={isDoubleRoute ? "المرسل" : "المحل"}
        customerPhone={order.customerPhone}
        customerAlternatePhone={order.alternatePhone ?? undefined}
        customWaButtons={customWaButtons}
        editUrl={`${SECRET_ADMIN_PATH}/orders/${order.id}/edit`}
      />
    </div>
  );
}
