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
  RenderCustomElementsLayer,
} from "@/lib/order-card-customizer";
import { ImageZoomModal } from "@/components/pinch-zoom-image";

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
  isDesignMode = false,
  selectedElementKey,
  onSelectElement,
}: {
  order: any;
  submitterName: string;
  submitterPhone: string;
  imgShopDoor: string | null;
  setPreviewImageUrl: (url: string | null) => void;
  isSystemAdminOrder?: boolean;
  designerConfig?: OrderCardDesignerConfig;
  isDesignMode?: boolean;
  selectedElementKey?: string;
  onSelectElement?: (key: string, cardType: "shopCard") => void;
}) {
  const router = useRouter();
  const [isExpanded, setIsExpanded] = useState(true);
  const [zoomOpen, setZoomOpen] = useState(false);

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
      setZoomOpen(false);
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
      setZoomOpen(false);
      router.refresh();
    } finally {
      setReverting(false);
    }
  }

  const hasLocation = Boolean(order.shopLocationUrl && order.shopLocationUrl.trim());
  const cleanPhone = contactLine(submitterPhone);

  const shopCustom = designerConfig?.shopCard;
  const frameBg = shopCustom?.frameBgUrl || "/images/order-luxury/shop-card/shop-card-frame.webp";

  // دالة تغليف كل عنصر في الكارت لجعله قابلاً للنقر والتحديد الفوري في وضع التعديل المباشر
  const wrapInteractive = (elemKey: string, title: string, element: React.ReactNode, cfg?: CustomElementConfig, containerClassName = "") => {
    if (!isDesignMode) return element;
    const isSelected = selectedElementKey === elemKey;
    return (
      <div
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (onSelectElement) {
            onSelectElement(elemKey, "shopCard");
          }
        }}
        title={`انقر لتحديد (${title}) وتعديل موضعه وحجمه`}
        className={`relative cursor-pointer transition-all duration-200 ${containerClassName} ${
          isSelected
            ? "ring-2 ring-amber-400 ring-offset-2 ring-offset-slate-900 rounded-xl shadow-[0_0_15px_rgba(245,215,127,0.85)] z-30"
            : "hover:ring-1 hover:ring-amber-400/60 hover:rounded-lg"
        } ${cfg?.hidden ? "opacity-30 grayscale dashed border border-rose-500/50" : ""}`}
      >
        {isSelected && (
          <div className="absolute -top-5 right-0 bg-amber-500 text-black text-[9px] font-black px-1.5 py-0.5 rounded shadow-md pointer-events-none whitespace-nowrap z-40 animate-bounce">
            ★ {title}
          </div>
        )}
        {element}
      </div>
    );
  };

  return (
    <div className="w-full max-w-4xl mx-auto my-0 select-none" dir="rtl">
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
        className="relative w-full rounded-[20px] sm:rounded-[26px] bg-no-repeat bg-[length:100%_100%] shadow-2xl overflow-hidden p-2 sm:p-3.5 md:p-4.5 transition-all mx-auto"
        style={getCardContainerStyle(shopCustom?.frameConfig, frameBg)}
      >
        {/* طبقة العناصر والنصوص والصور المخصصة المضافة */}
        <RenderCustomElementsLayer
          elements={shopCustom?.customElements}
          context={{
            order,
            shopPhone: cleanPhone,
            shopLocationUrl: order.shopLocationUrl,
            onZoomImage: (url, title) => {
              setPreviewImageUrl(url);
            },
          }}
        />

        {isExpanded ? (
          /* محتوى الكارت المفتوح: عمودين متجاورين دائماً (اليمين للمعلومات والتواصل، اليسار للصورة وأزرار الرفع) */
          <div className="grid grid-cols-2 gap-2.5 sm:gap-5 md:gap-7 items-start min-w-0 relative z-10">
            
            {/* ================= 1. الجانب الأيمن: كبسولة العنوان + بيانات المحل + موقع المحل + أزرار التواصل ================= */}
            <div className="flex flex-col justify-between items-start gap-2 sm:gap-3 min-w-0">
              {/* الرأس: كبسولة المحل (المرسل) - النقر عليها يطوي الكارت */}
              {wrapInteractive(
                "headerShopInfo",
                "كبسولة عنوان المحل",
                <div
                  onClick={() => !isDesignMode && setIsExpanded(false)}
                  className="w-fit inline-flex self-start cursor-pointer hover:scale-105 active:scale-95 transition-transform"
                  style={getElementStyle(shopCustom?.headerShopInfo)}
                  title={isDesignMode ? "تحديد كبسولة المحل" : "انقر لطي معلومات المحل"}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={shopCustom?.headerShopInfo?.imageUrl || "/images/order-luxury/shop-card/header-shop-info.webp"}
                    alt="المحل (المرسل)"
                    className="h-8.5 sm:h-11 md:h-13 w-auto object-contain drop-shadow-md select-none pointer-events-none"
                  />
                </div>,
                shopCustom?.headerShopInfo
              )}

              {/* قائمة البيانات الأربع بأيقوناتها المجسمة */}
              <div className="space-y-1.5 sm:space-y-2.5 py-0.5 w-full">
                {/* سطر 1: اسم المحل */}
                <div className="flex items-center gap-1.5 sm:gap-2.5 min-w-0">
                  {wrapInteractive(
                    "iconShopName",
                    "أيقونة اسم المحل",
                    <div className="shrink-0 w-fit inline-flex">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={shopCustom?.iconShopName?.imageUrl || "/images/order-luxury/shop-card/icon-shop-name.webp"}
                        alt="اسم المحل"
                        style={getElementStyle(shopCustom?.iconShopName)}
                        className="w-6 h-6 sm:w-7.5 sm:h-7.5 md:w-8.5 md:h-8.5 object-contain shrink-0 drop-shadow-sm transition-transform"
                      />
                    </div>,
                    shopCustom?.iconShopName
                  )}
                  {wrapInteractive(
                    "textShopName",
                    "نص اسم المحل",
                    <div className="min-w-0 w-fit inline-flex">
                      <span
                        style={getElementStyle(shopCustom?.textShopName)}
                        className="font-black text-xs sm:text-sm md:text-base text-[#F5D77F] drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)] truncate inline-block transition-transform"
                      >
                        {order.shop?.name || (isSystemAdminOrder ? "الإدارة" : "المحل")}
                      </span>
                    </div>,
                    shopCustom?.textShopName
                  )}
                </div>

                {/* سطر 2: اسم العميل / المسؤول */}
                <div className="flex items-center gap-1.5 sm:gap-2.5 min-w-0">
                  {wrapInteractive(
                    "iconCustomerName",
                    "أيقونة اسم صاحب المحل",
                    <div className="shrink-0 w-fit inline-flex">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={shopCustom?.iconCustomerName?.imageUrl || "/images/order-luxury/shop-card/icon-customer-name.webp"}
                        alt="اسم العميل"
                        style={getElementStyle(shopCustom?.iconCustomerName)}
                        className="w-6 h-6 sm:w-7.5 sm:h-7.5 md:w-8.5 md:h-8.5 object-contain shrink-0 drop-shadow-sm transition-transform"
                      />
                    </div>,
                    shopCustom?.iconCustomerName
                  )}
                  {wrapInteractive(
                    "textCustomerName",
                    "نص اسم صاحب المحل",
                    <div className="min-w-0 w-fit inline-flex">
                      <span
                        style={getElementStyle(shopCustom?.textCustomerName)}
                        className="font-black text-xs sm:text-sm md:text-base text-emerald-300 drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)] truncate inline-block transition-transform"
                      >
                        {submitterName || (isSystemAdminOrder ? "الإدارة" : "—")}
                      </span>
                    </div>,
                    shopCustom?.textCustomerName
                  )}
                </div>

                {/* سطر 3: اسم المنطقة */}
                <div className="flex items-center gap-1.5 sm:gap-2.5 min-w-0">
                  {wrapInteractive(
                    "iconRegion",
                    "أيقونة المنطقة",
                    <div className="shrink-0 w-fit inline-flex">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={shopCustom?.iconRegion?.imageUrl || "/images/order-luxury/shop-card/icon-region.webp"}
                        alt="منطقة المحل"
                        style={getElementStyle(shopCustom?.iconRegion)}
                        className="w-6 h-6 sm:w-7.5 sm:h-7.5 md:w-8.5 md:h-8.5 object-contain shrink-0 drop-shadow-sm transition-transform"
                      />
                    </div>,
                    shopCustom?.iconRegion
                  )}
                  {wrapInteractive(
                    "textRegion",
                    "نص المنطقة",
                    <div className="min-w-0 w-fit inline-flex">
                      <span
                        style={getElementStyle(shopCustom?.textRegion)}
                        className="font-bold text-xs sm:text-sm md:text-base text-[#FFF8F0] drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)] truncate inline-block transition-transform"
                      >
                        {order.shop?.region?.name || (isSystemAdminOrder ? "الإدارة العامة" : "—")}
                      </span>
                    </div>,
                    shopCustom?.textRegion
                  )}
                </div>

                {/* سطر 4: رقم الهاتف */}
                <div className="flex items-center gap-1.5 sm:gap-2.5 min-w-0">
                  {wrapInteractive(
                    "iconPhone",
                    "أيقونة الهاتف",
                    <div className="shrink-0 w-fit inline-flex">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={shopCustom?.iconPhone?.imageUrl || "/images/order-luxury/shop-card/icon-phone.webp"}
                        alt="رقم الهاتف"
                        style={getElementStyle(shopCustom?.iconPhone)}
                        className="w-6 h-6 sm:w-7.5 sm:h-7.5 md:w-8.5 md:h-8.5 object-contain shrink-0 drop-shadow-sm transition-transform"
                      />
                    </div>,
                    shopCustom?.iconPhone
                  )}
                  {wrapInteractive(
                    "textPhone",
                    "نص الهاتف",
                    <div className="min-w-0 w-fit inline-flex">
                      <span
                        style={getElementStyle(shopCustom?.textPhone)}
                        className="font-mono font-black text-xs sm:text-sm md:text-base text-[#F5D77F] tracking-wider drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)] truncate inline-block transition-transform"
                      >
                        {cleanPhone || (isSystemAdminOrder ? "07733921568" : "—")}
                      </span>
                    </div>,
                    shopCustom?.textPhone
                  )}
                </div>
              </div>

              {/* زر موقع المحل على الخريطة */}
              {wrapInteractive(
                "btnShopLocation",
                "زر موقع المحل",
                <div
                  className="pt-0.5 w-fit inline-flex self-start"
                  style={getElementStyle(shopCustom?.btnShopLocation)}
                >
                  {hasLocation ? (
                    <a
                      href={order.shopLocationUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-block transition-transform hover:scale-[1.02] active:scale-95 cursor-pointer"
                      title="فتح موقع المحل على الخريطة"
                      onClick={(e) => isDesignMode && e.preventDefault()}
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
                </div>,
                shopCustom?.btnShopLocation
              )}

              {/* أزرار التواصل (اتصال + واتساب) - مقفلة جنباً إلى جنب دائماً بدون كسر سطر */}
              <div className="grid grid-cols-2 gap-1 sm:gap-2 pt-1 w-full items-center">
                {/* 1. زر اتصال 📞 */}
                <div className="w-full flex justify-center min-w-0">
                  {wrapInteractive(
                    "btnCall",
                    "زر الاتصال",
                    <div style={getElementStyle(shopCustom?.btnCall)} className="w-fit inline-flex origin-center">
                      {cleanPhone ? (
                        <a
                          href={telHref(cleanPhone)}
                          className="transition-transform hover:scale-105 active:scale-95 cursor-pointer block"
                          title={`اتصال هاتفي: ${cleanPhone}`}
                          onClick={(e) => isDesignMode && e.preventDefault()}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={shopCustom?.btnCall?.imageUrl || "/images/order-luxury/shop-card/btn-call.webp"}
                            alt="اتصال"
                            className="h-7 sm:h-8.5 md:h-10 w-auto max-w-[160px] object-contain drop-shadow-xl transition-transform block"
                          />
                        </a>
                      ) : (
                        <div className="opacity-50 cursor-not-allowed block" title="لا يوجد رقم هاتف">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={shopCustom?.btnCall?.imageUrl || "/images/order-luxury/shop-card/btn-call.webp"}
                            alt="اتصال"
                            className="h-7 sm:h-8.5 md:h-10 w-auto max-w-[160px] object-contain grayscale transition-transform block"
                          />
                        </div>
                      )}
                    </div>,
                    shopCustom?.btnCall
                  )}
                </div>

                {/* 2. زر واتس اب 💬 */}
                <div className="w-full flex justify-center min-w-0">
                  {wrapInteractive(
                    "btnWhatsapp",
                    "زر الواتساب",
                    <div style={getElementStyle(shopCustom?.btnWhatsapp)} className="w-fit inline-flex origin-center">
                      {cleanPhone ? (
                        <a
                          href={whatsappMeUrl(cleanPhone)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="transition-transform hover:scale-105 active:scale-95 cursor-pointer block"
                          title="مراسلة عبر واتساب"
                          onClick={(e) => isDesignMode && e.preventDefault()}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={shopCustom?.btnWhatsapp?.imageUrl || "/images/order-luxury/shop-card/btn-whatsapp.webp"}
                            alt="واتس اب"
                            className="h-7 sm:h-8.5 md:h-10 w-auto max-w-[160px] object-contain drop-shadow-xl transition-transform block"
                          />
                        </a>
                      ) : (
                        <div className="opacity-50 cursor-not-allowed block" title="لا يوجد رقم هاتف">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={shopCustom?.btnWhatsapp?.imageUrl || "/images/order-luxury/shop-card/btn-whatsapp.webp"}
                            alt="واتس اب"
                            className="h-7 sm:h-8.5 md:h-10 w-auto max-w-[160px] object-contain grayscale transition-transform block"
                          />
                        </div>
                      )}
                    </div>,
                    shopCustom?.btnWhatsapp
                  )}
                </div>
              </div>
            </div>

            {/* ================= 2. الجانب الأيسر: كبسولة صورة المحل + مربع الصورة + أزرار (كاميرا ومعرض) ================= */}
            <div className="flex flex-col items-center justify-between gap-1.5 sm:gap-2.5 min-w-0 h-full">
              {/* الرأس: كبسولة صورة المحل */}
              {wrapInteractive(
                "headerShopPhoto",
                "كبسولة صورة المحل",
                <div
                  className="flex justify-center w-fit mx-auto shrink-0"
                  style={getElementStyle(shopCustom?.headerShopPhoto)}
                >
                  {shopCustom?.headerShopPhoto?.imageUrl ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={shopCustom.headerShopPhoto.imageUrl}
                      alt="صورة المحل"
                      className="h-8.5 sm:h-11 md:h-13 w-auto object-contain drop-shadow-md select-none transition-transform"
                    />
                  ) : (
                    <div className="inline-flex items-center gap-1.5 px-3 sm:px-4 py-1 bg-gradient-to-r from-[#0F4D3A] via-[#164E3D] to-[#0A3D2E] border-2 border-[#C9A86A] rounded-2xl shadow-lg">
                      <span className="text-xs sm:text-sm">🏪</span>
                      <span className="font-black text-xs sm:text-sm text-[#F5D77F] drop-shadow-md tracking-wide">
                        صورة المحل
                      </span>
                    </div>
                  )}
                </div>,
                shopCustom?.headerShopPhoto
              )}

              {/* مساحة عرض صورة باب المحل أو الـ Placeholder */}
              {wrapInteractive(
                "photoContainer",
                "إطار صورة باب المحل",
                <div
                  className="w-fit inline-flex flex-col mx-auto justify-center items-center py-0.5 relative"
                  style={getElementStyle(shopCustom?.placeholderNoPhoto)}
                >
                  {imgShopDoor ? (
                    <div className="flex flex-col items-center gap-0.5">
                      <div className="w-[82px] sm:w-[105px] md:w-[125px] h-[54px] sm:h-[70px] md:h-[82px] overflow-hidden rounded-xl border-2 border-[#C9A86A] shadow-xl bg-black/40 relative group shrink-0">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={imgShopDoor}
                          alt="باب المحل"
                          className="h-full w-full object-cover cursor-zoom-in group-hover:scale-105 transition duration-300 pointer-events-auto"
                          onClick={() => !isDesignMode && setZoomOpen(true)}
                        />
                        <div
                          onClick={() => !isDesignMode && setZoomOpen(true)}
                          className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-white font-black text-[10px] cursor-zoom-in"
                        >
                          🔍 تكبير
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="w-fit inline-flex items-center justify-center">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={shopCustom?.placeholderNoPhoto?.imageUrl || "/images/order-luxury/shop-card/placeholder-no-photo.webp"}
                        alt="لا توجد صورة"
                        className="w-[82px] sm:w-[105px] md:w-[125px] h-auto max-h-[54px] sm:max-h-[70px] md:max-h-[82px] object-contain drop-shadow-xl opacity-95 select-none transition-transform"
                      />
                    </div>
                  )}
                </div>,
                shopCustom?.placeholderNoPhoto
              )}

              {/* أزرار رفع الصورة (كاميرا + معرض) - مقفلة جنباً إلى جنب دائماً بدون كسر سطر */}
              {!isSystemAdminOrder && (
                <div className="grid grid-cols-2 gap-1 sm:gap-2 pt-1 w-full items-center">
                  {/* 3. زر كاميرا 📷 */}
                  <div className="w-full flex justify-center min-w-0">
                    {wrapInteractive(
                      "btnCamera",
                      "زر كاميرا الباب",
                      <div style={getElementStyle(shopCustom?.btnCamera)} className="w-fit inline-flex origin-center">
                        <button
                          type="button"
                          onClick={() => !isDesignMode && cameraFileRef.current?.click()}
                          disabled={pending}
                          className="transition-transform hover:scale-105 active:scale-95 cursor-pointer block"
                          title="التقاط صورة المحل بالكاميرا"
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={shopCustom?.btnCamera?.imageUrl || "/images/order-luxury/shop-card/btn-camera.webp"}
                            alt="كاميرا"
                            className="h-7 sm:h-8.5 md:h-10 w-auto max-w-[160px] object-contain drop-shadow-xl transition-transform block"
                          />
                        </button>
                      </div>,
                      shopCustom?.btnCamera
                    )}
                  </div>

                  {/* 4. زر معرض 🖼️ */}
                  <div className="w-full flex justify-center min-w-0">
                    {wrapInteractive(
                      "btnGallery",
                      "زر معرض الباب",
                      <div style={getElementStyle(shopCustom?.btnGallery)} className="w-fit inline-flex origin-center">
                        <button
                          type="button"
                          onClick={() => !isDesignMode && galleryFileRef.current?.click()}
                          disabled={pending}
                          className="transition-transform hover:scale-105 active:scale-95 cursor-pointer block"
                          title="اختيار صورة المحل من المعرض"
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={shopCustom?.btnGallery?.imageUrl || "/images/order-luxury/shop-card/btn-gallery.webp"}
                            alt="معرض"
                            className="h-7 sm:h-8.5 md:h-10 w-auto max-w-[160px] object-contain drop-shadow-xl transition-transform block"
                          />
                        </button>
                      </div>,
                      shopCustom?.btnGallery
                    )}
                  </div>
                </div>
              )}
            </div>

          </div>
        ) : (
          /* محتوى الكارت المطوي */
          <div
            onClick={() => setIsExpanded(true)}
            className="flex items-center justify-between cursor-pointer py-1 px-2"
          >
            <div className="flex items-center gap-2">
              <span className="text-sm">🏪</span>
              <span className="font-black text-sm text-[#F5D77F]">
                {order.shop?.name || "المحل"} - {cleanPhone || "لا يوجد هاتف"}
              </span>
            </div>
            <span className="text-xs text-[#F5D77F] font-bold">عرض التفاصيل ◀</span>
          </div>
        )}

      </div>

      {/* نافذة تكبير الصورة (Pinch-to-zoom) */}
      {zoomOpen && imgShopDoor && (
        <ImageZoomModal
          imageUrl={imgShopDoor}
          title={`صورة باب محل: ${order.shop?.name || ""}`}
          onClose={() => setZoomOpen(false)}
        />
      )}
    </div>
  );
}
