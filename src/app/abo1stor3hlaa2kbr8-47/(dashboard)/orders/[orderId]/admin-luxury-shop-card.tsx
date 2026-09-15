"use client";

import React, { useRef, useState, useActionState } from "react";
import { useRouter } from "next/navigation";
import { telHref, whatsappMeUrl } from "@/lib/whatsapp";
import {
  uploadShopDoorPhotoFromView,
  deleteShopDoorPhotoAction,
  revertShopDoorPhotoToOriginal,
  type CustomerDoorPhotoState,
} from "./customer-door-photo-actions";
import {
  compressImageForMandoubUpload,
  assignFileToInput,
} from "@/lib/client-image-compress";
import { ImageUploaderCaption } from "@/components/image-uploader-caption";
import {
  type OrderCardDesignerConfig,
  type CustomElementConfig,
  type CustomFrameConfig,
  getElementStyle,
  getCardContainerStyle,
} from "@/lib/order-card-customizer";

const initial: CustomerDoorPhotoState = {};

function contactLine(phone: string): string {
  const t = (phone || "").trim();
  if (!t || t === "—" || t === "undefined") return "";
  return t;
}

export function AdminLuxuryShopCard({
  order,
  submitterName,
  submitterPhone,
  imgShopDoor,
  setPreviewImageUrl,
  isSystemAdminOrder = false,
  designerConfig,
}: {
  order: any;
  submitterName: string;
  submitterPhone: string;
  imgShopDoor: string | null;
  setPreviewImageUrl: (url: string | null) => void;
  isSystemAdminOrder?: boolean;
  designerConfig?: OrderCardDesignerConfig;
}) {
  const router = useRouter();
  const [isExpanded, setIsExpanded] = useState(true);

  // مراجع رفع الصور للكاميرا والمعرض
  const cameraFileRef = useRef<HTMLInputElement>(null);
  const galleryFileRef = useRef<HTMLInputElement>(null);

  const [state, formAction, pending] = useActionState(
    uploadShopDoorPhotoFromView.bind(null, order.id),
    initial
  );
  const [deleting, setDeleting] = useState(false);
  const [reverting, setReverting] = useState(false);

  async function handleFileSelected(file: File | undefined, inputEl: HTMLInputElement | null) {
    if (!(file instanceof File) || file.size <= 0) return;

    let photoToUpload = file;
    try {
      photoToUpload = await compressImageForMandoubUpload(file);
      assignFileToInput(inputEl, photoToUpload);
    } catch (err) {
      console.error("خطأ في ضغط الصورة:", err);
    }

    const fd = new FormData();
    fd.set("shopDoorPhoto", photoToUpload);
    await formAction(fd);

    if (inputEl) {
      inputEl.value = "";
    }
    router.refresh();
  }

  async function handleDelete() {
    if (!confirm("هل أنت متأكد من مسح صورة باب المحل؟")) return;
    setDeleting(true);
    try {
      await deleteShopDoorPhotoAction(order.id);
      router.refresh();
    } finally {
      setDeleting(false);
    }
  }

  async function handleRevert() {
    if (!confirm("هل أنت متأكد من الرجوع إلى صورة المحل الأصلية؟")) return;
    setReverting(true);
    try {
      await revertShopDoorPhotoToOriginal(order.id);
      router.refresh();
    } finally {
      setReverting(false);
    }
  }

  const hasLocation = Boolean(order.shopLocationUrl && order.shopLocationUrl.trim());
  const cleanPhone = contactLine(submitterPhone);

  const shopCustom = designerConfig?.shopCard;
  const frameBg = shopCustom?.frameBgUrl || "/images/order-luxury/shop-card/shop-card-frame.webp";

  return (
    <div className="w-full max-w-4xl mx-auto my-2 select-none" dir="rtl">
      {/* مدخلات الملفات المخفية للكاميرا والمعرض */}
      <input
        ref={cameraFileRef}
        type="file"
        name="shopDoorPhotoCamera"
        accept="image/*"
        capture="environment"
        className="sr-only hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          void handleFileSelected(file, cameraFileRef.current);
        }}
      />
      <input
        ref={galleryFileRef}
        type="file"
        name="shopDoorPhotoGallery"
        accept="image/*"
        className="sr-only hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          void handleFileSelected(file, galleryFileRef.current);
        }}
      />

      {/* الهيكل الرئيسي لكارت المحل بالإطار الملكي الفاخر */}
      <div
        className="relative w-full rounded-[22px] sm:rounded-[28px] bg-no-repeat bg-[length:100%_100%] shadow-2xl overflow-hidden p-3.5 sm:p-6 md:p-7 transition-all mx-auto"
        style={getCardContainerStyle(shopCustom?.frameConfig, frameBg)}
      >
        {isExpanded ? (
          /* محتوى الكارت المفتوح: عمودين متجاورين دائماً (اليمين للمعلومات والتواصل، اليسار للصورة وأزرار الرفع) */
          <div className="grid grid-cols-2 gap-2.5 sm:gap-5 md:gap-7 items-start min-w-0 relative z-10">
            
            {/* ================= 1. الجانب الأيمن: كبسولة العنوان + بيانات المحل + موقع المحل + أزرار التواصل ================= */}
            <div className="flex flex-col justify-between gap-2 sm:gap-3 min-w-0">
              {/* الرأس: كبسولة المحل (المرسل) - النقر عليها يطوي الكارت */}
              <div
                onClick={() => setIsExpanded(false)}
                className="flex justify-start cursor-pointer hover:scale-105 active:scale-95 transition-transform"
                style={getElementStyle(shopCustom?.headerShopInfo)}
                title="انقر لطي معلومات المحل"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={shopCustom?.headerShopInfo?.imageUrl || "/images/order-luxury/shop-card/header-shop-info.webp"}
                  alt="المحل (المرسل)"
                  className="h-8.5 sm:h-11 md:h-13 w-auto object-contain drop-shadow-md select-none transition-transform pointer-events-none"
                />
              </div>

              {/* قائمة البيانات الأربع بأيقوناتها المجسمة */}
              <div className="space-y-1.5 sm:space-y-2.5 py-0.5">
                {/* سطر 1: اسم المحل */}
                <div className="flex items-center gap-1.5 sm:gap-2.5 min-w-0">
                  <div className="shrink-0">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={shopCustom?.iconShopName?.imageUrl || "/images/order-luxury/shop-card/icon-shop-name.webp"}
                      alt="اسم المحل"
                      style={getElementStyle(shopCustom?.iconShopName)}
                      className="w-6 h-6 sm:w-7.5 sm:h-7.5 md:w-8.5 md:h-8.5 object-contain shrink-0 drop-shadow-sm transition-transform"
                    />
                  </div>
                  <div className="min-w-0">
                    <span
                      style={getElementStyle(shopCustom?.textShopName)}
                      className="font-black text-xs sm:text-sm md:text-base text-[#F5D77F] drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)] truncate inline-block transition-transform"
                    >
                      {order.shop?.name || "المحل"}
                    </span>
                  </div>
                </div>

                {/* سطر 2: اسم العميل / المسؤول */}
                <div className="flex items-center gap-1.5 sm:gap-2.5 min-w-0">
                  <div className="shrink-0">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={shopCustom?.iconCustomerName?.imageUrl || "/images/order-luxury/shop-card/icon-customer-name.webp"}
                      alt="اسم العميل"
                      style={getElementStyle(shopCustom?.iconCustomerName)}
                      className="w-6 h-6 sm:w-7.5 sm:h-7.5 md:w-8.5 md:h-8.5 object-contain shrink-0 drop-shadow-sm transition-transform"
                    />
                  </div>
                  <div className="min-w-0">
                    <span
                      style={getElementStyle(shopCustom?.textCustomerName)}
                      className="font-black text-xs sm:text-sm md:text-base text-emerald-300 drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)] truncate inline-block transition-transform"
                    >
                      {submitterName || "—"}
                    </span>
                  </div>
                </div>

                {/* سطر 3: اسم المنطقة */}
                <div className="flex items-center gap-1.5 sm:gap-2.5 min-w-0">
                  <div className="shrink-0">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={shopCustom?.iconRegion?.imageUrl || "/images/order-luxury/shop-card/icon-region.webp"}
                      alt="منطقة المحل"
                      style={getElementStyle(shopCustom?.iconRegion)}
                      className="w-6 h-6 sm:w-7.5 sm:h-7.5 md:w-8.5 md:h-8.5 object-contain shrink-0 drop-shadow-sm transition-transform"
                    />
                  </div>
                  <div className="min-w-0">
                    <span
                      style={getElementStyle(shopCustom?.textRegion)}
                      className="font-bold text-xs sm:text-sm md:text-base text-[#FFF8F0] drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)] truncate inline-block transition-transform"
                    >
                      {order.shop?.region?.name || "—"}
                    </span>
                  </div>
                </div>

                {/* سطر 4: رقم الهاتف */}
                <div className="flex items-center gap-1.5 sm:gap-2.5 min-w-0">
                  <div className="shrink-0">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={shopCustom?.iconPhone?.imageUrl || "/images/order-luxury/shop-card/icon-phone.webp"}
                      alt="رقم الهاتف"
                      style={getElementStyle(shopCustom?.iconPhone)}
                      className="w-6 h-6 sm:w-7.5 sm:h-7.5 md:w-8.5 md:h-8.5 object-contain shrink-0 drop-shadow-sm transition-transform"
                    />
                  </div>
                  <div className="min-w-0">
                    <span
                      style={getElementStyle(shopCustom?.textPhone)}
                      className="font-mono font-black text-xs sm:text-sm md:text-base text-[#F5D77F] tracking-wider drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)] truncate inline-block transition-transform"
                    >
                      {cleanPhone || "—"}
                    </span>
                  </div>
                </div>
              </div>

              {/* زر موقع المحل على الخريطة */}
              <div className="pt-0.5" style={getElementStyle(shopCustom?.btnShopLocation)}>
                {hasLocation ? (
                  <a
                    href={order.shopLocationUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block transition-transform hover:scale-[1.02] active:scale-95 cursor-pointer"
                    title="فتح موقع المحل على الخريطة"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={shopCustom?.btnShopLocation?.imageUrl || "/images/order-luxury/shop-card/btn-shop-location.webp"}
                      alt="موقع المحل"
                      className="h-7 sm:h-9 md:h-10 w-auto object-contain drop-shadow-lg transition-transform"
                    />
                  </a>
                ) : (
                  <div
                    className="inline-block opacity-60 cursor-not-allowed"
                    title="لا يوجد موقع جغرافي مسجل للمحل"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={shopCustom?.btnShopLocation?.imageUrl || "/images/order-luxury/shop-card/btn-shop-location.webp"}
                      alt="موقع المحل غير متوفر"
                      className="h-7 sm:h-9 md:h-10 w-auto object-contain grayscale transition-transform"
                    />
                  </div>
                )}
              </div>

              {/* أزرار التواصل (اتصال + واتساب) - مقفلة جنباً إلى جنب دائماً بدون كسر سطر */}
              <div className="grid grid-cols-2 gap-1 sm:gap-2 pt-1 w-full items-center">
                {/* 1. زر اتصال 📞 */}
                <div style={getElementStyle(shopCustom?.btnCall)} className="w-full flex justify-center min-w-0">
                  {cleanPhone ? (
                    <a
                      href={telHref(cleanPhone)}
                      className="transition-transform hover:scale-105 active:scale-95 cursor-pointer block w-full flex justify-center"
                      title={`اتصال هاتفي: ${cleanPhone}`}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={shopCustom?.btnCall?.imageUrl || "/images/order-luxury/shop-card/btn-call.webp"}
                        alt="اتصال"
                        className="h-7 sm:h-8.5 md:h-10 w-full max-w-[110px] object-contain drop-shadow-xl transition-transform block"
                      />
                    </a>
                  ) : (
                    <div className="opacity-50 cursor-not-allowed block w-full flex justify-center" title="لا يوجد رقم هاتف">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={shopCustom?.btnCall?.imageUrl || "/images/order-luxury/shop-card/btn-call.webp"}
                        alt="اتصال"
                        className="h-7 sm:h-8.5 md:h-10 w-full max-w-[110px] object-contain grayscale transition-transform block"
                      />
                    </div>
                  )}
                </div>

                {/* 2. زر واتس اب 💬 */}
                <div style={getElementStyle(shopCustom?.btnWhatsapp)} className="w-full flex justify-center min-w-0">
                  {cleanPhone ? (
                    <a
                      href={whatsappMeUrl(cleanPhone)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="transition-transform hover:scale-105 active:scale-95 cursor-pointer block w-full flex justify-center"
                      title="مراسلة عبر واتساب"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={shopCustom?.btnWhatsapp?.imageUrl || "/images/order-luxury/shop-card/btn-whatsapp.webp"}
                        alt="واتس اب"
                        className="h-7 sm:h-8.5 md:h-10 w-full max-w-[110px] object-contain drop-shadow-xl transition-transform block"
                      />
                    </a>
                  ) : (
                    <div className="opacity-50 cursor-not-allowed block w-full flex justify-center" title="لا يوجد رقم هاتف">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={shopCustom?.btnWhatsapp?.imageUrl || "/images/order-luxury/shop-card/btn-whatsapp.webp"}
                        alt="واتس اب"
                        className="h-7 sm:h-8.5 md:h-10 w-full max-w-[110px] object-contain grayscale transition-transform block"
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* ================= 2. الجانب الأيسر: كبسولة صورة المحل + مربع الصورة + أزرار (كاميرا ومعرض) ================= */}
            <div className="flex flex-col items-center justify-between gap-2 sm:gap-3 min-w-0 h-full">
              {/* الرأس: كبسولة صورة المحل */}
              <div className="flex justify-center w-full" style={getElementStyle(shopCustom?.headerShopPhoto)}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={shopCustom?.headerShopPhoto?.imageUrl || "/images/order-luxury/shop-card/header-shop-photo.webp"}
                  alt="صورة المحل"
                  className="h-8.5 sm:h-11 md:h-13 w-auto object-contain drop-shadow-md select-none transition-transform"
                />
              </div>

              {/* مساحة عرض صورة باب المحل أو الـ Placeholder */}
              <div className="w-full flex items-center justify-center py-0.5" style={getElementStyle(shopCustom?.placeholderNoPhoto)}>
                {imgShopDoor ? (
                  <div className="w-full max-w-[170px] sm:max-w-[240px] md:max-w-[280px] flex flex-col items-center gap-1">
                    <div className="w-full aspect-[4/3] overflow-hidden rounded-2xl border-2 border-[#C9A86A] shadow-2xl bg-black/40 relative group">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={imgShopDoor}
                        alt="باب المحل"
                        className="h-full w-full object-cover cursor-zoom-in group-hover:scale-105 transition duration-300"
                        onClick={() => setPreviewImageUrl(imgShopDoor)}
                      />
                      <div
                        onClick={() => setPreviewImageUrl(imgShopDoor)}
                        className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-white font-black text-xs cursor-zoom-in"
                      >
                        🔍 تكبير
                      </div>
                    </div>
                    {order.shopDoorPhotoUploadedByName?.trim() && (
                      <div className="mt-0.5">
                        <ImageUploaderCaption name={order.shopDoorPhotoUploadedByName} />
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="w-full max-w-[160px] sm:max-w-[220px] md:max-w-[260px] flex items-center justify-center">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={shopCustom?.placeholderNoPhoto?.imageUrl || "/images/order-luxury/shop-card/placeholder-no-photo.webp"}
                      alt="لا توجد صورة"
                      className="w-full h-auto max-h-[110px] sm:max-h-[150px] md:max-h-[180px] object-contain drop-shadow-xl opacity-95 select-none transition-transform"
                    />
                  </div>
                )}
              </div>

              {/* أزرار الحذف والاسترجاع الإدارية إن وجدت صورة */}
              {imgShopDoor && !isSystemAdminOrder && (
                <div className="flex items-center gap-2 mt-1">
                  <button
                    type="button"
                    onClick={handleDelete}
                    disabled={deleting}
                    className="text-[10px] sm:text-xs font-bold text-rose-300 hover:text-rose-200 underline cursor-pointer"
                  >
                    {deleting ? "جاري المسح..." : "🗑️ مسح"}
                  </button>
                  {order.shopPhotoUrl && (
                    <button
                      type="button"
                      onClick={handleRevert}
                      disabled={reverting}
                      className="text-[10px] sm:text-xs font-bold text-amber-300 hover:text-amber-200 underline cursor-pointer"
                    >
                      {reverting ? "جاري الاسترجاع..." : "🔄 استرجاع"}
                    </button>
                  )}
                </div>
              )}

              {/* أزرار رفع الصورة (كاميرا + معرض) - مقفلة جنباً إلى جنب دائماً بدون كسر سطر */}
              {!isSystemAdminOrder && (
                <div className="grid grid-cols-2 gap-1 sm:gap-2 pt-1 w-full items-center">
                  {/* 3. زر كاميرا 📷 */}
                  <div style={getElementStyle(shopCustom?.btnCamera)} className="w-full flex justify-center min-w-0">
                    <button
                      type="button"
                      onClick={() => cameraFileRef.current?.click()}
                      disabled={pending}
                      className="transition-transform hover:scale-105 active:scale-95 cursor-pointer block w-full flex justify-center"
                      title="التقاط صورة المحل بالكاميرا"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={shopCustom?.btnCamera?.imageUrl || "/images/order-luxury/shop-card/btn-camera.webp"}
                        alt="كاميرا"
                        className="h-7 sm:h-8.5 md:h-10 w-full max-w-[110px] object-contain drop-shadow-xl transition-transform block"
                      />
                    </button>
                  </div>

                  {/* 4. زر معرض 🖼️ */}
                  <div style={getElementStyle(shopCustom?.btnGallery)} className="w-full flex justify-center min-w-0">
                    <button
                      type="button"
                      onClick={() => galleryFileRef.current?.click()}
                      disabled={pending}
                      className="transition-transform hover:scale-105 active:scale-95 cursor-pointer block w-full flex justify-center"
                      title="اختيار صورة المحل من المعرض"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={shopCustom?.btnGallery?.imageUrl || "/images/order-luxury/shop-card/btn-gallery.webp"}
                        alt="معرض"
                        className="h-7 sm:h-8.5 md:h-10 w-full max-w-[110px] object-contain drop-shadow-xl transition-transform block"
                      />
                    </button>
                  </div>
                </div>
              )}
            </div>

          </div>
        ) : (
          /* ================= محتوى الكارت المطوي: سطر مصغر أنيق وفخم ================= */
          <div className="flex items-center justify-between gap-2 min-w-0 relative z-10">
            <div className="flex items-center gap-2.5 sm:gap-3.5 min-w-0">
              {/* الرأس: كبسولة المحل (المرسل) - النقر عليها يفتح الكارت */}
              <div
                onClick={() => setIsExpanded(true)}
                className="flex justify-start cursor-pointer hover:scale-105 active:scale-95 transition-transform shrink-0"
                style={getElementStyle(shopCustom?.headerShopInfo)}
                title="انقر لعرض تفاصيل المحل"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={shopCustom?.headerShopInfo?.imageUrl || "/images/order-luxury/shop-card/header-shop-info.webp"}
                  alt="المحل (المرسل)"
                  className="h-8.5 sm:h-10 md:h-11 w-auto object-contain drop-shadow-md select-none transition-transform pointer-events-none"
                />
              </div>

              {/* تفاصيل مختصرة في السطر المطوي */}
              <div className="flex items-center gap-2 min-w-0 cursor-pointer" onClick={() => setIsExpanded(true)}>
                <span className="font-black text-xs sm:text-sm text-[#F5D77F] drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)] truncate">
                  {order.shop?.name || "المحل"}
                </span>
                {order.shop?.region?.name && (
                  <span className="text-[11px] sm:text-xs text-emerald-200/80 truncate hidden sm:inline">
                    • {order.shop.region.name}
                  </span>
                )}
              </div>
            </div>

            {/* أزرار سريعة مصغرة إذا كان هناك هاتف وموقع */}
            <div className="flex items-center gap-1.5 shrink-0">
              {cleanPhone && (
                <a
                  href={telHref(cleanPhone)}
                  className="p-1.5 bg-[#0F4D3A] hover:bg-[#164E3D] border border-[#C9A86A]/60 rounded-xl text-emerald-300 text-xs shadow-md transition hover:scale-110 active:scale-95"
                  title="اتصال سريع"
                >
                  📞
                </a>
              )}
              {hasLocation && (
                <a
                  href={order.shopLocationUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-1.5 bg-[#0F4D3A] hover:bg-[#164E3D] border border-[#C9A86A]/60 rounded-xl text-amber-300 text-xs shadow-md transition hover:scale-110 active:scale-95"
                  title="موقع المحل"
                >
                  📍
                </a>
              )}
              <button
                type="button"
                onClick={() => setIsExpanded(true)}
                className="text-[#F5D77F] text-xs font-black p-1 hover:scale-110 transition cursor-pointer"
                title="توسيع الكارت"
              >
                ▼
              </button>
            </div>
          </div>
        )}

        {/* مؤشر رفع الصورة إذا كان هناك رفع جاري */}
        {pending && (
          <div className="absolute top-2 left-2 z-30 bg-black/80 px-2.5 py-1 rounded-xl border border-amber-400 text-xs font-black text-[#F5D77F] animate-pulse flex items-center gap-1 shadow-lg">
            <span>⏳</span> جاري رفع الصورة...
          </div>
        )}
      </div>
    </div>
  );
}
