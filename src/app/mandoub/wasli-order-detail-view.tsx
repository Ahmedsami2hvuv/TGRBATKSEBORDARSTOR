"use client";

import React, { useState, useRef, useEffect } from "react";
import { formatBaghdadDateTime } from "@/lib/baghdad-time";
import { formatDinarAsAlf, formatDinarAsAlfWithUnit } from "@/lib/money-alf";
import { telHref, whatsappMeUrl, openUrlFromUserGesture } from "@/lib/whatsapp";
import { resolvePublicAssetSrc } from "@/lib/image-url";
import { ImageZoomModal } from "@/components/pinch-zoom-image";
import { MandoubCustomerEditForm } from "./mandoub-customer-edit-form";
import { MandoubOrderMoneyFlow } from "./mandoub-order-money-flow";
import { MANDOUB_ORDER_EDIT_TOGGLE } from "./mandoub-order-detail-actions";
import { FloatingOrderActionButton } from "@/components/floating-order-action-button";
import { ClickableNotesCard } from "@/components/clickable-notes-card";
import { normalizeOrderSummaryText } from "@/lib/preparation-invoice";
import { compressImageForMandoubUpload, assignFileToInput } from "@/lib/client-image-compress";
import { uploadCustomerDoorPhotoFromView, uploadShopDoorPhotoFromView } from "@/app/abo1stor3hlaa2kbr8-47/(dashboard)/orders/[orderId]/customer-door-photo-actions";
import { updateOrderLandmarkAction } from "@/app/actions/update-landmark";
import { toast } from "sonner";

type Props = {
  order: any;
  auth: { c: string; exp: string; s: string };
  closeHref: string;
  onCloseModal?: () => void;
  nextUrl: string;
  viewerCourierId?: string;
  courierName?: string | null;
  phoneProfile?: any;
  secondPhoneProfile?: any;
  smartHintLine?: string | null;
  secondSmartHintLine?: string | null;
  isModal?: boolean;
  customerDebt?: number | null;
  customWaButtons?: any[];
};

export function WasliOrderDetailView({
  order,
  auth,
  closeHref,
  onCloseModal,
  nextUrl,
  viewerCourierId,
  courierName,
  phoneProfile,
  secondPhoneProfile,
  smartHintLine,
  secondSmartHintLine,
  isModal = false,
  customerDebt = null,
  customWaButtons,
}: Props) {
  // حالة المودالات والمعاينة
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
  const [previewUploadedByName, setPreviewUploadedByName] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // صور الباب والمحل
  const [shopPhoto, setShopPhoto] = useState<string | null>(
    resolvePublicAssetSrc(order.shopPhotoUrl || order.shopDoorPhotoUrl || null)
  );
  const [custDoorPhoto, setCustDoorPhoto] = useState<string | null>(
    resolvePublicAssetSrc(order.customerDoorPhotoUrl || phoneProfile?.photoUrl || null)
  );
  const [orderGoodsPhoto, setOrderGoodsPhoto] = useState<string | null>(
    resolvePublicAssetSrc(order.packagePhotoUrl || order.orderPhotoUrl || null)
  );

  // مراجع رفع الصور
  const shopGalleryInputRef = useRef<HTMLInputElement | null>(null);
  const shopCameraInputRef = useRef<HTMLInputElement | null>(null);
  const custGalleryInputRef = useRef<HTMLInputElement | null>(null);
  const custCameraInputRef = useRef<HTMLInputElement | null>(null);
  const goodsGalleryInputRef = useRef<HTMLInputElement | null>(null);
  const goodsCameraInputRef = useRef<HTMLInputElement | null>(null);

  // أقرب نقطة دالة قابلة للتعديل
  const initialLandmark = (order.customerLandmark || phoneProfile?.landmark || "").trim();
  const [landmarkVal, setLandmarkVal] = useState(initialLandmark);
  const [isEditingLandmark, setIsEditingLandmark] = useState(false);
  const [landmarkSaving, setLandmarkSaving] = useState(false);

  // حالة التفاؤل لحالة الطلب
  const [optimisticStatus, setOptimisticStatus] = useState(order.status);
  useEffect(() => {
    setOptimisticStatus(order.status);
  }, [order.status]);

  useEffect(() => {
    const handleOptimisticStatus = (e: any) => {
      if (e.detail?.orderId === order.id && e.detail?.status) {
        setOptimisticStatus(e.detail.status);
      }
    };
    window.addEventListener("MANDOUB_ORDER_STATUS_OPTIMISTIC", handleOptimisticStatus);
    return () => {
      window.removeEventListener("MANDOUB_ORDER_STATUS_OPTIMISTIC", handleOptimisticStatus);
    };
  }, [order.id]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2500);
  };

  // معالجة اختيار صورة
  const handleImagePicked = async (file: File | null, type: "shop" | "customer" | "goods") => {
    if (!file) return;
    try {
      showToast("جارٍ تجهيز الصورة وضغطها...");
      const compressed = await compressImageForMandoubUpload(file);
      const objectUrl = URL.createObjectURL(compressed);

      if (type === "shop") {
        setShopPhoto(objectUrl);
        const fd = new FormData();
        fd.append("shopDoorPhoto", compressed);
        fd.append("target", "shop");
        await uploadShopDoorPhotoFromView(order.id, {}, fd);
        showToast("تم حفظ صورة المحل بنجاح");
      } else if (type === "customer") {
        setCustDoorPhoto(objectUrl);
        const fd = new FormData();
        fd.append("customerDoorPhoto", compressed);
        fd.append("target", "first");
        await uploadCustomerDoorPhotoFromView(order.id, {}, fd);
        showToast("تم حفظ صورة باب الزبون بنجاح");
      } else {
        setOrderGoodsPhoto(objectUrl);
        showToast("تم تحديث صورة الطلب");
      }
    } catch (err) {
      console.error(err);
      showToast("فشل رفع الصورة، يرجى المحاولة ثانية");
    }
  };

  // حفظ النقطة الدالة
  const handleSaveLandmark = async () => {
    setLandmarkSaving(true);
    try {
      const res = await updateOrderLandmarkAction(order.id, landmarkVal);
      if (res.ok) {
        setIsEditingLandmark(false);
        showToast("تم حفظ النقطة الدالة بنجاح");
      } else {
        showToast("فشل حفظ النقطة الدالة");
      }
    } catch {
      showToast("حدث خطأ أثناء الحفظ");
    } finally {
      setLandmarkSaving(false);
    }
  };

  // إغلاق العرض
  const handleClose = () => {
    if (onCloseModal) {
      onCloseModal();
      return;
    }
    if (closeHref && closeHref !== "#") {
      window.location.href = closeHref;
    } else {
      const p = new URLSearchParams(window.location.search);
      p.delete("activeOrderId");
      const newPath = window.location.pathname + (p.toString() ? "?" + p.toString() : "");
      window.history.pushState({}, "", newPath);
    }
  };

  // استخراج البيانات وتنسيقها
  const shopName = order.shop?.name || (order.submissionSource === "admin_portal" ? "الإدارة" : "المحل");
  const shopOwner = order.shop?.ownerName || order.submittedBy?.name || order.submittedByCompanyPreparer?.name || "";
  const shopRegion = order.shop?.region?.name || order.shopRegionName || "";
  const shopPhone = order.shop?.phone || order.submittedBy?.phone || "";
  const shopLocation = order.shop?.locationUrl || order.shopLocationUrl || "";

  // بيانات الزبون - مع الشرط الصارم لعدم ظهور اسم العميل في كارت الزبون:
  const rawCustomerName = (order.customerName || order.customer?.name || "").trim();
  const isClientName =
    rawCustomerName.toLowerCase() === shopName.trim().toLowerCase() ||
    rawCustomerName.toLowerCase() === shopOwner.trim().toLowerCase() ||
    rawCustomerName.toLowerCase() === (order.submittedBy?.name || "").trim().toLowerCase();

  const customerDisplayName = (!isClientName && rawCustomerName && rawCustomerName !== "الزبون" && rawCustomerName !== "المستلم")
    ? rawCustomerName
    : "";

  const customerRegion = order.customerRegion?.name || "";
  const customerPhone = order.customerPhone || "";
  const customerLocation = order.customerLocationUrl || order.customer?.customerLocationUrl || phoneProfile?.locationUrl || "";

  // المبالغ المالية
  const totalAmount = Number(order.totalAmount || order.totalPrice || 0);
  const deliveryPrice = Number(order.deliveryPrice || 0);
  const orderSubtotal = Math.max(0, totalAmount - deliveryPrice);

  // صادر ووارد
  const moneyEvents = order.moneyEvents || [];
  const saderEvents = moneyEvents.filter((e: any) => e.kind === "courier_pickup_out" || e.kind === "pickup_out");
  const wardEvents = moneyEvents.filter((e: any) => e.kind === "courier_delivery_in" || e.kind === "delivery_in");
  const totalSader = saderEvents.reduce((acc: number, e: any) => acc + Number(e.amountDinar || 0), 0);
  const totalWard = wardEvents.reduce((acc: number, e: any) => acc + Number(e.amountDinar || 0), 0);

  // تبليغ الزبون عبر واتساب
  const handleNotifyCustomer = () => {
    if (!customerPhone) {
      showToast("لا يوجد رقم هاتف للزبون!");
      return;
    }
    const cleanPhone = customerPhone.replace(/\D/g, "");
    const msg = `مرحباً، مندوب التوصيل في طريقه إليك لتسليم طلبك #${order.orderNumber || order.id}. يرجى التواجد واستلام الطلب.`;
    const url = `https://wa.me/${cleanPhone.startsWith("0") ? "964" + cleanPhone.slice(1) : cleanPhone}?text=${encodeURIComponent(msg)}`;
    openUrlFromUserGesture(url);
  };

  return (
    <div dir="rtl" className="min-h-screen w-full bg-[#F0F4FF] text-[#0B2E8C] antialiased pb-24 selection:bg-[#FFC107]/30">
      {/* إشعار عائم في الأسفل */}
      {toastMessage && (
        <div className="fixed bottom-6 left-1/2 z-[200] -translate-x-1/2 rounded-full bg-[#0B2E8C] px-5 py-2.5 text-[13px] font-bold text-white shadow-[0_10px_30px_rgba(11,46,140,0.3)] flex items-center gap-2 animate-in fade-in slide-in-from-bottom-2">
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#FFC107] text-[#0B2E8C] text-xs font-black">
            ✓
          </span>
          {toastMessage}
        </div>
      )}

      <div className="mx-auto flex min-h-screen w-full max-w-[480px] flex-col">
        {/* محتوى الشاشة الرئيسي */}
        <main className="flex flex-col gap-3 px-3.5 pb-8 pt-3">
          {/* الشريط العلوي لرقم الطلب وحالته وزر التعديل */}
          <div className="flex items-center justify-between rounded-[20px] border-[1.5px] border-[#D0DDFB] bg-white px-3 py-2.5 shadow-[0_2px_12px_rgba(11,46,140,0.05)]">
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 rounded-full bg-[#E8EEFF] px-3 py-1.5">
                <span className="h-2 w-2 rounded-full bg-[#1E4DB7] animate-pulse" />
                <span className="text-[12px] font-extrabold text-[#0B2E8C]">
                  {optimisticStatus === "delivered" ? "تم التسليم" : optimisticStatus === "delivering" ? "مستلم" : "بانتظار المندوب"}
                </span>
              </div>
              <div className="flex h-8 items-center justify-center rounded-[12px] bg-[#0B2E8C] px-3 shadow-xs">
                <span className="text-[16px] font-extrabold tracking-wide text-[#FFC107] font-mono">
                  #{order.orderNumber || order.id}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                window.dispatchEvent(new CustomEvent(MANDOUB_ORDER_EDIT_TOGGLE, { detail: { orderId: order.id } }));
              }}
              className="flex items-center gap-1.5 rounded-full border-[1.5px] border-[#D0DDFB] bg-white px-3 py-1.5 text-[11px] font-bold text-[#0B2E8C] transition hover:bg-[#F8FAFF] active:scale-[0.97] cursor-pointer shadow-xs"
            >
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#E8EEFF]">
                <svg className="w-3 h-3 text-[#0B2E8C]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 20h9" />
                  <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                </svg>
              </span>
              تعديل الطلب
            </button>
          </div>

          {/* تنبيه كلشي واصل إن وجد */}
          {order.prepaidAll && (
            <div className="rounded-[20px] border-2 border-[#38BDF8] bg-gradient-to-r from-[#0284C7] to-[#0369A1] p-4 text-white shadow-lg flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white/20 text-[#FDE047]">
                <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                  <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
                  <line x1="12" y1="22.08" x2="12" y2="12" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-black text-[#FDE047]">الطلب واصل - استلم أجور التوصيل فقط!</p>
                <p className="text-xs font-bold text-sky-100 mt-0.5">لا تقبض سعر البضاعة من العميل، فقط أجور التوصيل.</p>
              </div>
            </div>
          )}

          {/* تنبيه ديون الزبون إن وجدت */}
          {customerDebt !== null && customerDebt > 0 && (
            <div className="rounded-[20px] border-2 border-[#FFC107] bg-[#0B2E8C] p-3.5 text-white shadow-lg flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#FFC107]/20 text-[#FFC107]">
                <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                  <line x1="12" y1="9" x2="12" y2="13" />
                  <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
              </div>
              <div>
                <p className="text-xs font-black text-[#FFC107]">تنبيه مالي للزبون:</p>
                <p className="text-xs font-bold text-slate-100 mt-0.5">
                  بذمة هذا الزبون مبلغ معلق قدره ({formatDinarAsAlfWithUnit(customerDebt)}) في دفتر الديون.
                </p>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* كارت المحل (المرسل) */}
          {/* ========================================================================= */}
          <section className="overflow-hidden rounded-[24px] border-[1.5px] border-[#D0DDFB] bg-white shadow-[0_4px_20px_rgba(11,46,140,0.06)]">
            {/* الترويسة */}
            <div className="flex items-center justify-between bg-[#F8FAFF] px-4 py-3 border-b border-[#D0DDFB]/50">
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#FFC107] text-[#0B2E8C] shadow-xs">
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                    <polyline points="9 22 9 12 15 12 15 22" />
                  </svg>
                </span>
                <h2 className="text-[14px] font-extrabold text-[#0B2E8C]">المحل (المرسل)</h2>
              </div>
              <div className="h-1.5 w-12 rounded-full bg-[#D0DDFB]" />
            </div>

            {/* تفاصيل المحل */}
            <div className="p-[14px]">
              <div className="flex gap-3">
                {/* البيانات */}
                <div className="flex flex-1 flex-col gap-2 min-w-0">
                  <h3 className="text-[16px] font-extrabold leading-tight text-[#0B2E8C] truncate">
                    {shopName}
                  </h3>

                  {shopOwner && (
                    <div className="flex items-center gap-1.5">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#E8EEFF] text-[#0B2E8C] shrink-0">
                        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                          <circle cx="12" cy="7" r="4" />
                        </svg>
                      </span>
                      <span className="text-[13px] font-bold text-[#1E4DB7] truncate">
                        {shopOwner}
                      </span>
                    </div>
                  )}

                  {shopRegion && (
                    <div className="flex items-center gap-1.5">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#E8EEFF] text-[#0B2E8C] shrink-0">
                        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                          <circle cx="12" cy="10" r="3" />
                        </svg>
                      </span>
                      <span className="text-[12px] font-medium text-[#5B6FA8] truncate">
                        {shopRegion}
                      </span>
                    </div>
                  )}

                  {shopPhone && (
                    <div className="mt-1 flex">
                      <a
                        href={telHref(shopPhone)}
                        className="flex items-center gap-2 rounded-full border border-[#D0DDFB] bg-white px-3 py-1.5 shadow-xs transition hover:border-[#0B2E8C]"
                      >
                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#FFC107] text-[#0B2E8C]">
                          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                          </svg>
                        </span>
                        <span className="text-[12px] font-bold text-[#0B2E8C] font-mono [direction:ltr]">
                          {shopPhone}
                        </span>
                      </a>
                    </div>
                  )}
                </div>

                {/* صورة المحل والباب */}
                <div className="flex flex-col gap-2 shrink-0">
                  <div
                    onClick={() => {
                      if (shopPhoto) setPreviewImageUrl(shopPhoto);
                    }}
                    className="relative h-[132px] w-[132px] overflow-hidden rounded-[20px] border-[2px] border-[#0B2E8C] bg-[#F0F4FF] cursor-pointer"
                  >
                    {shopPhoto ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={shopPhoto} alt="صورة المحل" className="h-full w-full object-cover transition hover:scale-105" />
                    ) : (
                      <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-[#E8EEFF]">
                        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-xs text-[#0B2E8C]">
                          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                            <circle cx="12" cy="13" r="4" />
                          </svg>
                        </span>
                        <span className="text-[10px] font-bold text-[#7A90C0]">صورة المحل</span>
                      </div>
                    )}
                  </div>

                  <div className="flex gap-1.5">
                    <button
                      type="button"
                      onClick={() => shopGalleryInputRef.current?.click()}
                      className="flex flex-1 items-center justify-center gap-1 rounded-[10px] border border-[#D0DDFB] bg-white py-1.5 text-[11px] font-bold text-[#0B2E8C] transition active:scale-95 shadow-xs"
                    >
                      <svg className="w-3.5 h-3.5 text-[#0B2E8C]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                        <circle cx="8.5" cy="8.5" r="1.5" />
                        <polyline points="21 15 16 10 5 21" />
                      </svg>
                      <span>المعرض</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => shopCameraInputRef.current?.click()}
                      className="flex flex-1 items-center justify-center gap-1 rounded-[10px] bg-[#0B2E8C] py-1.5 text-[11px] font-bold text-[#FFC107] transition active:scale-95 shadow-xs"
                    >
                      <svg className="w-3.5 h-3.5 text-[#FFC107]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                        <circle cx="12" cy="13" r="4" />
                      </svg>
                      <span>كاميرا</span>
                    </button>
                  </div>

                  <input
                    ref={shopGalleryInputRef}
                    type="file"
                    accept="image/*"
                    hidden
                    onChange={(e) => handleImagePicked(e.target.files?.[0] || null, "shop")}
                  />
                  <input
                    ref={shopCameraInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    hidden
                    onChange={(e) => handleImagePicked(e.target.files?.[0] || null, "shop")}
                  />
                </div>
              </div>

              {/* زر موقع المحل على الخريطة */}
              {shopLocation && (
                <button
                  type="button"
                  onClick={() => openUrlFromUserGesture(shopLocation)}
                  className="mt-4 flex h-[48px] w-full items-center justify-center gap-2 rounded-[16px] bg-gradient-to-l from-[#0B2E8C] to-[#1E4DB7] text-[14px] font-extrabold text-white shadow-[0_6px_16px_rgba(11,46,140,0.25)] transition hover:brightness-110 active:scale-[0.98] cursor-pointer"
                >
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#FFC107] text-[#0B2E8C]">
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                      <circle cx="12" cy="10" r="3" />
                    </svg>
                  </span>
                  <span>موقع المحل</span>
                </button>
              )}

              {/* أزرار الواتساب والاتصال مع العميل (الواتساب على اليمين والاتصال على اليسار) */}
              {shopPhone && (
                <div className="mt-3 flex gap-2.5">
                  <button
                    type="button"
                    onClick={() => {
                      const clean = shopPhone.replace(/\D/g, "");
                      openUrlFromUserGesture(`https://wa.me/${clean.startsWith("0") ? "964" + clean.slice(1) : clean}`);
                    }}
                    className="flex h-[44px] flex-1 items-center justify-center gap-1.5 rounded-[16px] bg-[#0B2E8C] text-[13px] font-extrabold text-[#FFC107] shadow-[0_4px_12px_rgba(11,46,140,0.18)] transition hover:bg-[#1E4DB7] active:scale-[0.98] cursor-pointer"
                  >
                    <svg className="w-4 h-4 text-[#FFC107]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
                    </svg>
                    <span>واتس العميل</span>
                  </button>
                  <a
                    href={telHref(shopPhone)}
                    className="flex h-[44px] flex-1 items-center justify-center gap-1.5 rounded-[16px] bg-[#0B2E8C] text-[13px] font-extrabold text-[#FFC107] shadow-[0_4px_12px_rgba(11,46,140,0.18)] transition hover:bg-[#1E4DB7] active:scale-[0.98]"
                  >
                    <svg className="w-4 h-4 text-[#FFC107]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                    </svg>
                    <span>اتصال بالعميل</span>
                  </a>
                </div>
              )}
            </div>
          </section>

          {/* ========================================================================= */}
          {/* كارت الزبون (المستلم) */}
          {/* ========================================================================= */}
          <section className="relative overflow-visible rounded-[24px] border-[1.5px] border-[#FFD54F]/60 bg-white shadow-[0_4px_20px_rgba(11,46,140,0.06)]">

            {/* الترويسة */}
            <div className="flex items-center justify-between bg-[#FFFBEB] px-4 py-3 border-b border-[#FFE082]/40 rounded-t-[23px]">
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#0B2E8C] text-base text-[#FFC107] shadow-xs">
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                    <circle cx="12" cy="7" r="4" />
                  </svg>
                </span>
                <h2 className="text-[14px] font-extrabold text-[#0B2E8C]">الزبون (المستلم)</h2>
              </div>
              <div className="h-1.5 w-12 rounded-full bg-[#FFE082]" />
            </div>

            {/* تفاصيل الزبون */}
            <div className="p-[14px] pt-4">
              <div className="flex gap-3">
                {/* البيانات */}
                <div className="flex flex-1 flex-col gap-2.5 min-w-0">
                  {/* اسم الزبون إن وجد مع التأكيد الصارم: اسم العميل لا يظهر في كارت الزبون */}
                  {customerDisplayName && (
                    <h3 className="text-[15px] font-extrabold text-[#0B2E8C] truncate">
                      {customerDisplayName}
                    </h3>
                  )}

                  {customerRegion && (
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-[#E8EEFF] px-2.5 py-1 text-[11px] font-bold text-[#0B2E8C] truncate">
                        <svg className="w-3 h-3 text-[#0B2E8C]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                          <circle cx="12" cy="10" r="3" />
                        </svg>
                        <span>{customerRegion}</span>
                      </span>
                    </div>
                  )}

                  {customerPhone && (
                    <div className="flex items-center gap-2">
                      <a
                        href={telHref(customerPhone)}
                        className="flex items-center gap-1.5 rounded-full border border-[#D0DDFB] bg-white px-2.5 py-1 shadow-xs transition hover:border-[#0B2E8C]"
                      >
                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#FFC107] text-[#0B2E8C]">
                          <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                          </svg>
                        </span>
                        <span className="text-[12px] font-bold text-[#0B2E8C] font-mono [direction:ltr]">
                          {customerPhone}
                        </span>
                      </a>
                    </div>
                  )}

                  {/* بلوك أقرب نقطة دالة */}
                  <div className="mt-1 rounded-[14px] border border-[#D0DDFB] bg-[#F8FAFF] p-2.5 shadow-xs">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#E8EEFF] text-[#0B2E8C]">
                          <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                            <circle cx="12" cy="10" r="3" />
                          </svg>
                        </span>
                        <span className="text-[10px] font-bold text-[#7A90C0]">ن داله</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setIsEditingLandmark((v) => !v)}
                        className="text-[10px] font-bold text-[#1E4DB7] hover:underline cursor-pointer"
                      >
                        {isEditingLandmark ? "إلغاء" : "تعديل"}
                      </button>
                    </div>

                    {isEditingLandmark ? (
                      <div className="mt-1.5 flex flex-col gap-1.5">
                        <input
                          type="text"
                          value={landmarkVal}
                          onChange={(e) => setLandmarkVal(e.target.value)}
                          placeholder="اكتب النقطة الدالة..."
                          className="w-full rounded-lg border border-[#D0DDFB] bg-white p-1.5 text-xs text-[#0B2E8C] outline-none focus:border-[#0B2E8C]"
                        />
                        <button
                          type="button"
                          onClick={handleSaveLandmark}
                          disabled={landmarkSaving}
                          className="self-end rounded-lg bg-[#0B2E8C] px-3 py-1 text-[11px] font-bold text-white shadow-xs active:scale-95"
                        >
                          {landmarkSaving ? "جارٍ الحفظ..." : "حفظ"}
                        </button>
                      </div>
                    ) : (
                      <p className="mt-1.5 text-[12px] font-extrabold leading-snug text-[#0B2E8C]">
                        {landmarkVal || "لم تسجل نقطة دالة بعد (انقر للتعديل)"}
                      </p>
                    )}
                  </div>
                </div>

                {/* صورة باب الزبون */}
                <div className="flex flex-col gap-2 shrink-0">
                  <div
                    onClick={() => {
                      if (custDoorPhoto) setPreviewImageUrl(custDoorPhoto);
                    }}
                    className="relative h-[132px] w-[132px] overflow-hidden rounded-[20px] border-[2px] border-[#FFC107] bg-[#F0F4FF] cursor-pointer"
                  >
                    {custDoorPhoto ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={custDoorPhoto} alt="صورة الزبون" className="h-full w-full object-cover transition hover:scale-105" />
                    ) : (
                      <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-[#FFF8E1]">
                        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-xs text-[#C6A95A]">
                          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M3 21h18" />
                            <path d="M6 21V3h12v18" />
                            <circle cx="15" cy="12" r="1" />
                          </svg>
                        </span>
                        <span className="text-[10px] font-bold text-[#C6A95A]">صورة الباب</span>
                      </div>
                    )}
                  </div>

                  <div className="flex gap-1.5">
                    <button
                      type="button"
                      onClick={() => custGalleryInputRef.current?.click()}
                      className="flex flex-1 items-center justify-center gap-1 rounded-[10px] border border-[#D0DDFB] bg-white py-1.5 text-[11px] font-bold text-[#0B2E8C] transition active:scale-95 shadow-xs"
                    >
                      <svg className="w-3.5 h-3.5 text-[#0B2E8C]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                        <circle cx="8.5" cy="8.5" r="1.5" />
                        <polyline points="21 15 16 10 5 21" />
                      </svg>
                      <span>المعرض</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => custCameraInputRef.current?.click()}
                      className="flex flex-1 items-center justify-center gap-1 rounded-[10px] bg-[#0B2E8C] py-1.5 text-[11px] font-bold text-[#FFC107] transition active:scale-95 shadow-xs"
                    >
                      <svg className="w-3.5 h-3.5 text-[#FFC107]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                        <circle cx="12" cy="13" r="4" />
                      </svg>
                      <span>كاميرا</span>
                    </button>
                  </div>

                  <input
                    ref={custGalleryInputRef}
                    type="file"
                    accept="image/*"
                    hidden
                    onChange={(e) => handleImagePicked(e.target.files?.[0] || null, "customer")}
                  />
                  <input
                    ref={custCameraInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    hidden
                    onChange={(e) => handleImagePicked(e.target.files?.[0] || null, "customer")}
                  />
                </div>
              </div>

              {/* أزرار اللوكيشن والتبليغ */}
              <div className="mt-4 flex gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    if (customerLocation) openUrlFromUserGesture(customerLocation);
                    else showToast("لا يوجد لوكيشن مسجل لهذا الزبون");
                  }}
                  className="flex h-[46px] flex-1 items-center justify-center gap-2 rounded-[16px] bg-[#0B2E8C] text-[13px] font-extrabold text-white shadow-[0_4px_12px_rgba(11,46,140,0.2)] transition hover:bg-[#1E4DB7] active:scale-[0.98] cursor-pointer"
                >
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#FFC107] text-[#0B2E8C]">
                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                      <circle cx="12" cy="10" r="3" />
                    </svg>
                  </span>
                  <span>فتح لوكيشن الزبون</span>
                </button>

                <button
                  type="button"
                  onClick={handleNotifyCustomer}
                  className="flex h-[46px] w-[114px] shrink-0 items-center justify-center gap-1.5 rounded-[16px] bg-[#FFC107] text-[12px] font-extrabold text-[#0B2E8C] shadow-[0_4px_12px_rgba(255,193,7,0.35)] transition hover:bg-[#ffcd38] active:scale-[0.98] cursor-pointer"
                >
                  <svg className="w-3.5 h-3.5 text-[#0B2E8C]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
                  </svg>
                  <span>تبليغ زبون</span>
                </button>
              </div>

              {/* أزرار الواتساب والاتصال مع الزبون (الواتساب على اليمين والاتصال على اليسار) */}
              {customerPhone && (
                <div className="mt-2.5 flex gap-2.5">
                  <button
                    type="button"
                    onClick={() => {
                      const clean = customerPhone.replace(/\D/g, "");
                      openUrlFromUserGesture(`https://wa.me/${clean.startsWith("0") ? "964" + clean.slice(1) : clean}`);
                    }}
                    className="flex h-[44px] flex-1 items-center justify-center gap-1.5 rounded-[16px] bg-[#0B2E8C] text-[13px] font-extrabold text-[#FFC107] shadow-xs transition hover:bg-[#1E4DB7] active:scale-[0.98] cursor-pointer"
                  >
                    <svg className="w-4 h-4 text-[#FFC107]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
                    </svg>
                    <span>واتساب</span>
                  </button>
                  <a
                    href={telHref(customerPhone)}
                    className="flex h-[44px] flex-1 items-center justify-center gap-1.5 rounded-[16px] bg-[#0B2E8C] text-[13px] font-extrabold text-[#FFC107] shadow-xs transition hover:bg-[#1E4DB7] active:scale-[0.98]"
                  >
                    <svg className="w-4 h-4 text-[#FFC107]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                    </svg>
                    <span>اتصال</span>
                  </a>
                </div>
              )}

              {/* بلوك الاستدلال الذكي */}
              {smartHintLine && smartHintLine !== "—" && (
                <div className="mt-3 flex gap-3 rounded-[18px] bg-[#0B2E8C] p-3 shadow-[0_6px_16px_rgba(11,46,140,0.25)] text-white">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#FFC107] text-[#0B2E8C] shadow-xs">
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M9 18h6" />
                      <path d="M10 22h4" />
                      <path d="M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0 0 18 8 6 6 0 0 0 6 8c0 1 .23 2.23 1.5 3.5.76.76 1.23 1.52 1.41 2.5" />
                    </svg>
                  </span>
                  <div className="flex flex-col gap-1 min-w-0">
                    <span className="text-[12px] font-extrabold text-white">الاستدلال الذكي</span>
                    <p className="text-[11px] font-medium leading-snug text-[#C9D6F5]">
                      {smartHintLine}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* ========================================================================= */}
          {/* كارت تفاصيل الطلبية والمبلغ */}
          {/* ========================================================================= */}
          <section className="overflow-hidden rounded-[24px] border-[1.5px] border-[#D0DDFB] bg-white shadow-[0_4px_20px_rgba(11,46,140,0.06)]">
            <div className="flex items-center justify-between bg-[#F8FAFF] px-4 py-3 border-b border-[#D0DDFB]/50">
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#0B2E8C] text-sm text-[#FFC107] shadow-xs">
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
                    <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
                  </svg>
                </span>
                <h2 className="text-[14px] font-extrabold text-[#0B2E8C]">تفاصيل الطلبية والمبلغ</h2>
              </div>
            </div>

            <div className="p-[14px]">
              <div className="flex gap-3">
                <div className="flex flex-1 flex-col gap-3 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#E8EEFF] text-[#0B2E8C]">
                      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
                        <line x1="7" y1="7" x2="7.01" y2="7" />
                      </svg>
                    </span>
                    <span className="text-[16px] font-extrabold text-[#0B2E8C]">
                      {order.orderType || "طلبية عادية"}
                    </span>
                  </div>

                  <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-2 rounded-full border border-[#D0DDFB] bg-white px-3 py-1.5 w-fit shadow-xs">
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#E8EEFF] text-[#0B2E8C]">
                        <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                          <line x1="12" y1="1" x2="12" y2="23" />
                          <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                        </svg>
                      </span>
                      <span className="text-[11px] font-bold text-[#0B2E8C]">
                        سعر الطلب <span className="font-extrabold">{formatDinarAsAlf(orderSubtotal)} ألف</span>
                      </span>
                    </div>

                    <div className="flex items-center gap-2 rounded-full border border-[#D0DDFB] bg-white px-3 py-1.5 w-fit shadow-xs">
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#E8EEFF] text-[#0B2E8C]">
                        <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="1" y="3" width="15" height="13" />
                          <polygon points="16 8 20 8 23 11 23 16 16 16 16 8" />
                          <circle cx="5.5" cy="18.5" r="2.5" />
                          <circle cx="18.5" cy="18.5" r="2.5" />
                        </svg>
                      </span>
                      <span className="text-[11px] font-bold text-[#0B2E8C]">
                        التوصيل <span className="font-extrabold">{formatDinarAsAlf(deliveryPrice)} ألف</span>
                      </span>
                    </div>
                  </div>

                  {/* بلوك المجموع العملاق */}
                  <div className="mt-1 flex h-[64px] w-full items-center justify-center gap-2 rounded-[20px] bg-gradient-to-l from-[#0B2E8C] to-[#1E4DB7] shadow-[0_8px_20px_rgba(11,46,140,0.25)] text-white">
                    <span className="text-[13px] font-bold text-[#A8BFFF]">المجموع</span>
                    <span className="text-[32px] font-extrabold leading-none text-white font-mono">
                      {formatDinarAsAlf(totalAmount)}
                    </span>
                    <span className="text-[12px] font-bold text-[#FFC107]">ألف</span>
                  </div>
                </div>

                {/* صورة الطلب */}
                <div className="flex flex-col gap-2 shrink-0">
                  <div
                    onClick={() => {
                      if (orderGoodsPhoto) setPreviewImageUrl(orderGoodsPhoto);
                    }}
                    className="flex h-[120px] w-[120px] flex-col items-center justify-center gap-2 rounded-[20px] border-[2px] border-[#D0DDFB] bg-[#F0F4FF] overflow-hidden cursor-pointer"
                  >
                    {orderGoodsPhoto ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={orderGoodsPhoto} alt="صورة الطلب" className="h-full w-full object-cover transition hover:scale-105" />
                    ) : (
                      <>
                        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-sm text-[#0B2E8C]">
                          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                            <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
                            <line x1="12" y1="22.08" x2="12" y2="12" />
                          </svg>
                        </span>
                        <span className="text-[11px] font-bold text-[#7A90C0]">صورة الطلب</span>
                      </>
                    )}
                  </div>

                  <div className="flex gap-1.5">
                    <button
                      type="button"
                      onClick={() => goodsGalleryInputRef.current?.click()}
                      className="flex flex-1 items-center justify-center gap-1 rounded-[10px] border border-[#D0DDFB] bg-white py-1.5 text-[11px] font-bold text-[#0B2E8C] transition active:scale-95 shadow-xs"
                    >
                      <svg className="w-3.5 h-3.5 text-[#0B2E8C]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                        <circle cx="8.5" cy="8.5" r="1.5" />
                        <polyline points="21 15 16 10 5 21" />
                      </svg>
                      <span>المعرض</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => goodsCameraInputRef.current?.click()}
                      className="flex flex-1 items-center justify-center gap-1 rounded-[10px] bg-[#0B2E8C] py-1.5 text-[11px] font-bold text-[#FFC107] transition active:scale-95 shadow-xs"
                    >
                      <svg className="w-3.5 h-3.5 text-[#FFC107]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                        <circle cx="12" cy="13" r="4" />
                      </svg>
                      <span>كاميرا</span>
                    </button>
                  </div>

                  <input
                    ref={goodsGalleryInputRef}
                    type="file"
                    accept="image/*"
                    hidden
                    onChange={(e) => handleImagePicked(e.target.files?.[0] || null, "goods")}
                  />
                  <input
                    ref={goodsCameraInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    hidden
                    onChange={(e) => handleImagePicked(e.target.files?.[0] || null, "goods")}
                  />
                </div>
              </div>

              {/* ملاحظات الطلب إن وجدت */}
              {order.summary && (
                <div className="mt-3 rounded-[16px] border border-[#D0DDFB] bg-[#F8FAFF] p-3">
                  <div className="flex items-center gap-1.5 text-[11px] font-black text-[#1E4DB7] mb-1">
                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <polyline points="14 2 14 8 20 8" />
                      <line x1="16" y1="13" x2="8" y2="13" />
                      <line x1="16" y1="17" x2="8" y2="17" />
                      <polyline points="10 9 9 9 8 9" />
                    </svg>
                    <span>ملاحظات وقائمة المواد:</span>
                  </div>
                  <p className="text-xs font-bold text-[#0B2E8C] leading-relaxed whitespace-pre-wrap">
                    {normalizeOrderSummaryText(order.summary)}
                  </p>
                </div>
              )}
            </div>
          </section>

          {/* ========================================================================= */}
          {/* كارت المعاملات المالية (الصادر والوارد) */}
          {/* ========================================================================= */}
          <section className="overflow-hidden rounded-[24px] border-[1.5px] border-[#D0DDFB] bg-white shadow-[0_4px_20px_rgba(11,46,140,0.06)]">
            <div className="flex items-center justify-between bg-[#F8FAFF] px-4 py-3 border-b border-[#D0DDFB]/50">
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#FFC107] text-base text-[#0B2E8C] shadow-xs">
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="6" x2="12" y2="18" />
                    <path d="M15 9H10.5a2 2 0 0 0 0 4h3a2 2 0 0 1 0 4H9" />
                  </svg>
                </span>
                <h2 className="text-[14px] font-extrabold text-[#0B2E8C]">المعاملات المالية</h2>
              </div>
              <div className="flex items-center gap-1.5 rounded-full bg-[#E8EEFF] px-2.5 py-1">
                <span className="h-1.5 w-1.5 rounded-full bg-[#1E4DB7]" />
                <span className="text-[10px] font-bold text-[#0B2E8C]">السجل</span>
              </div>
            </div>

            <div className="p-4">
              {/* المكون التفاعلي لتسجيل النقد والأحداث */}
              <MandoubOrderMoneyFlow
                orderId={order.id}
                orderNumber={order.orderNumber}
                courierName={order.courier?.name ?? "—"}
                orderStatus={order.status}
                missingCustomerLocation={!customerLocation}
                canRecordMoney={order.assignedCourierId === viewerCourierId}
                orderSubtotalDinar={order.orderSubtotal != null ? Number(order.orderSubtotal) : null}
                totalAmountDinar={order.totalAmount != null ? Number(order.totalAmount) : null}
                prepaidAll={order.prepaidAll}
                moneyEvents={moneyEvents.map((e: any) => ({
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
                  performedByDisplayName: e.recordedByCompanyPreparer?.name || e.courier?.name || "—",
                  recordedByCompanyPreparerId: e.recordedByCompanyPreparerId ?? null,
                }))}
                auth={auth}
                nextUrl={nextUrl}
                totalsBaseline={order.courier?.mandoubTotalsResetAt ? String(order.courier.mandoubTotalsResetAt) : null}
              />
            </div>
          </section>

          {/* الفوتر بهوية وصلي */}
          <div className="flex items-center justify-center gap-2 py-4 opacity-75">
            <span className="h-1.5 w-1.5 rounded-full bg-[#0B2E8C]" />
            <span className="text-[11px] font-bold text-[#7A90C0]">
              وصلي • Wasli Delivery • ثيم رسمي
            </span>
            <span className="h-1.5 w-1.5 rounded-full bg-[#FFC107]" />
          </div>
        </main>
      </div>

      {/* مودال تعديل بيانات الزبون السريع */}
      <MandoubCustomerEditForm
        orderId={order.id}
        defaultOrderStatus={order.status}
        defaultCustomerPhone={order.customerPhone}
        defaultCustomerLocationUrl={customerLocation}
        defaultCustomerLandmark={landmarkVal}
        defaultAlternatePhone={order.alternatePhone || ""}
        auth={auth}
        nextUrl={nextUrl}
      />

      {/* مودال معاينة الصور التفاعلي */}
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

      {/* الزر العائم الحر لحالة الاستلام والتسليم: أزرق للاستلام وأصفر للتسليم */}
      <FloatingOrderActionButton
        orderId={order.id}
        status={optimisticStatus}
        isMandoub={true}
      />
    </div>
  );
}
