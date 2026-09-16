"use client";

import React, { useRef, useState, useActionState } from "react";
import { useRouter } from "next/navigation";
import { telHref, whatsappMeUrl } from "@/lib/whatsapp";
import {
  uploadCustomerDoorPhotoFromView,
  deleteCustomerDoorPhotoAction,
  type CustomerDoorPhotoState,
} from "./customer-door-photo-actions";
import {
  compressImageForMandoubUpload,
  assignFileToInput,
} from "@/lib/client-image-compress";
import { ImageUploaderCaption } from "@/components/image-uploader-caption";
import {
  type OrderCardDesignerConfig,
  getElementStyle,
  getCardContainerStyle,
} from "@/lib/order-card-customizer";
import { AdminCustomerPhoneInteractive } from "./admin-customer-order-history";
import { ImageZoomModal } from "@/components/pinch-zoom-image";

const initial: CustomerDoorPhotoState = {};

function contactLine(phone: string): string {
  const t = (phone || "").trim();
  if (!t || t === "—" || t === "undefined") return "";
  return t;
}

export function AdminLuxuryCustomerCard({
  order,
  customerName,
  customerPhone,
  imgCustomerDoor,
  setPreviewImageUrl,
  isDoubleRoute = false,
  designerConfig,
  phoneProfile,
}: {
  order: any;
  customerName: string;
  customerPhone: string;
  imgCustomerDoor: string | null;
  setPreviewImageUrl: (url: string | null) => void;
  isDoubleRoute?: boolean;
  designerConfig?: OrderCardDesignerConfig;
  phoneProfile?: any;
}) {
  const router = useRouter();
  const [isExpanded, setIsExpanded] = useState(true);
  const [zoomOpen, setZoomOpen] = useState(false);

  // مراجع رفع الصور للكاميرا والمعرض
  const cameraFileRef = useRef<HTMLInputElement>(null);
  const galleryFileRef = useRef<HTMLInputElement>(null);

  const [state, formAction, pending] = useActionState(
    uploadCustomerDoorPhotoFromView.bind(null, order.id),
    initial
  );
  const [deleting, setDeleting] = useState(false);

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
    fd.set("customerDoorPhoto", photoToUpload);
    await formAction(fd);

    if (inputEl) {
      inputEl.value = "";
    }
    router.refresh();
  }

  async function handleDelete() {
    if (!confirm("هل أنت متأكد من مسح صورة باب الزبون؟")) return;
    setDeleting(true);
    try {
      await deleteCustomerDoorPhotoAction(order.id);
      setZoomOpen(false);
      router.refresh();
    } finally {
      setDeleting(false);
    }
  }

  const hasLocation = Boolean(order.customerLocationUrl && order.customerLocationUrl.trim());
  const cleanPhone = contactLine(customerPhone || order.customerPhone);

  const custCustom = designerConfig?.customerCard;
  const frameBg = custCustom?.frameBgUrl || "/images/order-luxury/shop-card/shop-card-frame.webp";

  return (
    <div className="w-full max-w-4xl mx-auto my-0 sm:my-0.5 select-none" dir="rtl">
      {/* مدخلات الملفات المخفية للكاميرا والمعرض */}
      <input
        ref={cameraFileRef}
        type="file"
        name="customerDoorPhotoCamera"
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
        name="customerDoorPhotoGallery"
        accept="image/*"
        className="sr-only hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          void handleFileSelected(file, galleryFileRef.current);
        }}
      />

      {/* الهيكل الرئيسي لكارت الزبون بالإطار الفاخر */}
      <div
        className="relative w-full rounded-[20px] sm:rounded-[26px] bg-no-repeat bg-[length:100%_100%] shadow-2xl overflow-hidden p-2 sm:p-3.5 md:p-4.5 transition-all mx-auto"
        style={getCardContainerStyle(custCustom?.frameConfig, frameBg)}
      >
        {isExpanded ? (
          /* محتوى الكارت المفتوح: عمودين متجاورين (اليمين للمعلومات والتواصل، اليسار للصورة وأزرار الرفع) */
          <div className="grid grid-cols-2 gap-2.5 sm:gap-5 md:gap-7 items-start min-w-0 relative z-10">
            
            {/* ================= 1. الجانب الأيمن: كبسولة العنوان + بيانات الزبون + موقع الزبون + أزرار التواصل ================= */}
            <div className="flex flex-col justify-between items-start gap-2 sm:gap-3 min-w-0">
              {/* الرأس: كبسولة الزبون (المستلم) - النقر عليها يطوي الكارت */}
              <div
                onClick={() => setIsExpanded(false)}
                className="w-fit inline-flex self-start cursor-pointer hover:scale-105 active:scale-95 transition-transform"
                style={getElementStyle(custCustom?.headerCustomerInfo)}
                title="انقر لطي معلومات الزبون"
              >
                {custCustom?.headerCustomerInfo?.imageUrl ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={custCustom.headerCustomerInfo.imageUrl}
                    alt={isDoubleRoute ? "المرسل (الوجهة الأولى)" : "الزبون (المستلم)"}
                    className="h-8.5 sm:h-11 md:h-13 w-auto object-contain drop-shadow-md select-none pointer-events-none"
                  />
                ) : (
                  <div className="inline-flex items-center gap-1.5 px-3 sm:px-4 py-1 bg-gradient-to-r from-[#0F4D3A] via-[#164E3D] to-[#0A3D2E] border-2 border-[#C9A86A] rounded-2xl shadow-lg">
                    <span className="text-xs sm:text-sm">👤</span>
                    <span className="font-black text-xs sm:text-sm text-[#F5D77F] drop-shadow-md tracking-wide">
                      {isDoubleRoute ? "المرسل (الوجهة الأولى)" : "الزبون (المستلم)"}
                    </span>
                  </div>
                )}
              </div>

              {/* قائمة البيانات الأربع بأيقوناتها المجسمة */}
              <div className="space-y-1.5 sm:space-y-2.5 py-0.5 w-full">
                {/* سطر 1: اسم الزبون */}
                <div className="flex items-center gap-1.5 sm:gap-2.5 min-w-0">
                  <div className="shrink-0 w-fit inline-flex">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={custCustom?.iconCustomerName?.imageUrl || "/images/order-luxury/shop-card/icon-customer-name.webp"}
                      alt="اسم الزبون"
                      style={getElementStyle(custCustom?.iconCustomerName)}
                      className="w-6 h-6 sm:w-7.5 sm:h-7.5 md:w-8.5 md:h-8.5 object-contain shrink-0 drop-shadow-sm transition-transform"
                    />
                  </div>
                  <div className="min-w-0 w-fit inline-flex">
                    <span
                      style={getElementStyle(custCustom?.textCustomerName)}
                      className="font-black text-xs sm:text-sm md:text-base text-emerald-300 drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)] truncate inline-block transition-transform"
                    >
                      {customerName || order.customer?.name || "الزبون"}
                    </span>
                  </div>
                </div>

                {/* سطر 2: اسم المنطقة */}
                <div className="flex items-center gap-1.5 sm:gap-2.5 min-w-0">
                  <div className="shrink-0 w-fit inline-flex">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={custCustom?.iconRegion?.imageUrl || "/images/order-luxury/shop-card/icon-region.webp"}
                      alt="المنطقة"
                      style={getElementStyle(custCustom?.iconRegion)}
                      className="w-6 h-6 sm:w-7.5 sm:h-7.5 md:w-8.5 md:h-8.5 object-contain shrink-0 drop-shadow-sm transition-transform"
                    />
                  </div>
                  <div className="min-w-0 w-fit inline-flex">
                    <span
                      style={getElementStyle(custCustom?.textRegion)}
                      className="font-bold text-xs sm:text-sm md:text-base text-[#FFF8F0] drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)] truncate inline-block transition-transform"
                    >
                      {order.customerRegion?.name || "—"}
                    </span>
                  </div>
                </div>

                {/* سطر 3: رقم هاتف الزبون */}
                <div className="flex items-center gap-1.5 sm:gap-2.5 min-w-0">
                  <div className="shrink-0 w-fit inline-flex">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={custCustom?.iconPhone?.imageUrl || "/images/order-luxury/shop-card/icon-phone.webp"}
                      alt="رقم الهاتف"
                      style={getElementStyle(custCustom?.iconPhone)}
                      className="w-6 h-6 sm:w-7.5 sm:h-7.5 md:w-8.5 md:h-8.5 object-contain shrink-0 drop-shadow-sm transition-transform"
                    />
                  </div>
                  <div className="min-w-0 w-fit inline-flex">
                    <span
                      style={getElementStyle(custCustom?.textPhone)}
                      className="font-mono font-black text-xs sm:text-sm md:text-base text-[#F5D77F] tracking-wider drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)] truncate inline-block transition-transform"
                    >
                      {cleanPhone || "—"}
                    </span>
                  </div>
                </div>
              </div>

              {/* زر موقع الزبون على الخريطة */}
              <div
                className="pt-0.5 w-fit inline-flex self-start"
                style={getElementStyle(custCustom?.btnLocation)}
              >
                {hasLocation ? (
                  <a
                    href={order.customerLocationUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block transition-transform hover:scale-[1.02] active:scale-95 cursor-pointer"
                    title="فتح موقع الزبون على الخريطة"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={custCustom?.btnLocation?.imageUrl || "/images/order-luxury/shop-card/btn-shop-location.webp"}
                      alt="موقع الزبون"
                      className="h-7 sm:h-9 md:h-10 w-auto object-contain drop-shadow-lg transition-transform"
                    />
                  </a>
                ) : (
                  <div
                    className="inline-block opacity-60 cursor-not-allowed"
                    title="لا يوجد موقع جغرافي مسجل للزبون"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={custCustom?.btnLocation?.imageUrl || "/images/order-luxury/shop-card/btn-shop-location.webp"}
                      alt="موقع الزبون غير متوفر"
                      className="h-7 sm:h-9 md:h-10 w-auto object-contain grayscale transition-transform"
                    />
                  </div>
                )}
              </div>

              {/* أزرار التواصل للزبون (اتصال + واتساب) - مقفلة جنباً إلى جنب دائماً بدون كسر سطر */}
              <div className="grid grid-cols-2 gap-1 sm:gap-2 pt-1 w-full items-center">
                {/* 1. زر اتصال 📞 */}
                <div className="w-full flex justify-center min-w-0">
                  <div style={getElementStyle(custCustom?.btnCall)} className="w-fit inline-flex">
                    {cleanPhone ? (
                      <a
                        href={telHref(cleanPhone)}
                        className="transition-transform hover:scale-105 active:scale-95 cursor-pointer block"
                        title={`اتصال هاتفي: ${cleanPhone}`}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={custCustom?.btnCall?.imageUrl || "/images/order-luxury/shop-card/btn-call.webp"}
                          alt="اتصال"
                          className="h-7 sm:h-8.5 md:h-10 w-full max-w-[110px] object-contain drop-shadow-xl transition-transform block"
                        />
                      </a>
                    ) : (
                      <div className="opacity-50 cursor-not-allowed block" title="لا يوجد رقم هاتف">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={custCustom?.btnCall?.imageUrl || "/images/order-luxury/shop-card/btn-call.webp"}
                          alt="اتصال"
                          className="h-7 sm:h-8.5 md:h-10 w-full max-w-[110px] object-contain grayscale transition-transform block"
                        />
                      </div>
                    )}
                  </div>
                </div>

                {/* 2. زر واتس اب 💬 */}
                <div className="w-full flex justify-center min-w-0">
                  <div style={getElementStyle(custCustom?.btnWhatsapp)} className="w-fit inline-flex">
                    {cleanPhone ? (
                      <a
                        href={whatsappMeUrl(cleanPhone)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="transition-transform hover:scale-105 active:scale-95 cursor-pointer block"
                        title="مراسلة الزبون عبر واتساب"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={custCustom?.btnWhatsapp?.imageUrl || "/images/order-luxury/shop-card/btn-whatsapp.webp"}
                          alt="واتس اب"
                          className="h-7 sm:h-8.5 md:h-10 w-full max-w-[110px] object-contain drop-shadow-xl transition-transform block"
                        />
                      </a>
                    ) : (
                      <div className="opacity-50 cursor-not-allowed block" title="لا يوجد رقم هاتف">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={custCustom?.btnWhatsapp?.imageUrl || "/images/order-luxury/shop-card/btn-whatsapp.webp"}
                          alt="واتس اب"
                          className="h-7 sm:h-8.5 md:h-10 w-full max-w-[110px] object-contain grayscale transition-transform block"
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* ================= 2. الجانب الأيسر: كبسولة صورة باب الزبون + مربع الصورة + أزرار (كاميرا ومعرض) ================= */}
            <div className="flex flex-col items-center justify-between gap-2 sm:gap-3 min-w-0 h-full">
              {/* الرأس: كبسولة صورة باب الزبون */}
              <div
                className="flex justify-center w-fit mx-auto"
                style={getElementStyle(custCustom?.headerDoorPhoto)}
              >
                {custCustom?.headerDoorPhoto?.imageUrl ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={custCustom.headerDoorPhoto.imageUrl}
                    alt="صورة الباب"
                    className="h-8.5 sm:h-11 md:h-13 w-auto object-contain drop-shadow-md select-none transition-transform"
                  />
                ) : (
                  <div className="inline-flex items-center gap-1.5 px-3 sm:px-4 py-1 bg-gradient-to-r from-[#0F4D3A] via-[#164E3D] to-[#0A3D2E] border-2 border-[#C9A86A] rounded-2xl shadow-lg">
                    <span className="text-xs sm:text-sm">🚪</span>
                    <span className="font-black text-xs sm:text-sm text-[#F5D77F] drop-shadow-md tracking-wide">
                      صورة باب الزبون
                    </span>
                  </div>
                )}
              </div>

              {/* مساحة عرض صورة باب الزبون أو الـ Placeholder - متطابقة هندسياً 100% مع الاستوديو */}
              <div
                className="w-fit inline-flex mx-auto justify-center items-center py-0.5"
                style={getElementStyle(custCustom?.placeholderNoPhoto)}
              >
                {imgCustomerDoor ? (
                  <div className="flex flex-col items-center gap-1">
                    <div className="w-[82px] sm:w-[105px] md:w-[125px] h-[54px] sm:h-[70px] md:h-[82px] overflow-hidden rounded-xl border-2 border-[#C9A86A] shadow-xl bg-black/40 relative group shrink-0">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={imgCustomerDoor}
                        alt="باب الزبون"
                        className="h-full w-full object-cover cursor-zoom-in group-hover:scale-105 transition duration-300"
                        onClick={() => setZoomOpen(true)}
                      />
                      <div
                        onClick={() => setZoomOpen(true)}
                        className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-white font-black text-[10px] cursor-zoom-in"
                      >
                        🔍 تكبير
                      </div>
                    </div>
                    {order.customerDoorPhotoUploadedByName?.trim() && (
                      <div className="mt-0.5">
                        <ImageUploaderCaption name={order.customerDoorPhotoUploadedByName} />
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="w-fit inline-flex items-center justify-center">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={custCustom?.placeholderNoPhoto?.imageUrl || "/images/order-luxury/shop-card/placeholder-no-photo.webp"}
                      alt="لا توجد صورة باب"
                      className="w-[82px] sm:w-[105px] md:w-[125px] h-auto max-h-[54px] sm:max-h-[70px] md:max-h-[82px] object-contain drop-shadow-xl opacity-95 select-none transition-transform"
                    />
                  </div>
                )}
              </div>

              {/* أزرار رفع صورة باب الزبون (كاميرا + معرض) - مقفلة جنباً إلى جنب دائماً بدون كسر سطر */}
              <div className="grid grid-cols-2 gap-1 sm:gap-2 pt-1 w-full items-center">
                {/* 3. زر كاميرا 📷 */}
                <div className="w-full flex justify-center min-w-0">
                  <div style={getElementStyle(custCustom?.btnCamera)} className="w-fit inline-flex">
                    <button
                      type="button"
                      onClick={() => cameraFileRef.current?.click()}
                      disabled={pending}
                      className="transition-transform hover:scale-105 active:scale-95 cursor-pointer block"
                      title="تصوير باب الزبون بالكاميرا"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={custCustom?.btnCamera?.imageUrl || "/images/order-luxury/shop-card/btn-camera.webp"}
                        alt="كاميرا"
                        className="h-7 sm:h-8.5 md:h-10 w-full max-w-[110px] object-contain drop-shadow-xl transition-transform block"
                      />
                    </button>
                  </div>
                </div>

                {/* 4. زر معرض 🖼️ */}
                <div className="w-full flex justify-center min-w-0">
                  <div style={getElementStyle(custCustom?.btnGallery)} className="w-fit inline-flex">
                    <button
                      type="button"
                      onClick={() => galleryFileRef.current?.click()}
                      disabled={pending}
                      className="transition-transform hover:scale-105 active:scale-95 cursor-pointer block"
                      title="اختيار صورة باب الزبون من المعرض"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={custCustom?.btnGallery?.imageUrl || "/images/order-luxury/shop-card/btn-gallery.webp"}
                        alt="معرض"
                        className="h-7 sm:h-8.5 md:h-10 w-full max-w-[110px] object-contain drop-shadow-xl transition-transform block"
                      />
                    </button>
                  </div>
                </div>
              </div>

            </div>

          </div>
        ) : (
          /* ================= محتوى الكارت المطوي: سطر مصغر أنيق وفخم ================= */
          <div className="flex items-center justify-between gap-2 min-w-0 relative z-10">
            <div className="flex items-center gap-2.5 sm:gap-3.5 min-w-0">
              {/* الرأس: كبسولة الزبون (المستلم) - النقر عليها يفتح الكارت */}
              <div
                onClick={() => setIsExpanded(true)}
                className="flex justify-start cursor-pointer hover:scale-105 active:scale-95 transition-transform shrink-0"
                style={getElementStyle(custCustom?.headerCustomerInfo)}
                title="انقر لعرض تفاصيل الزبون"
              >
                {custCustom?.headerCustomerInfo?.imageUrl ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={custCustom.headerCustomerInfo.imageUrl}
                    alt={isDoubleRoute ? "المرسل (الوجهة الأولى)" : "الزبون (المستلم)"}
                    className="h-8.5 sm:h-10 md:h-11 w-auto object-contain drop-shadow-md select-none transition-transform pointer-events-none"
                  />
                ) : (
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-gradient-to-r from-[#0F4D3A] via-[#164E3D] to-[#0A3D2E] border-2 border-[#C9A86A] rounded-2xl shadow-lg">
                    <span className="text-xs">👤</span>
                    <span className="font-black text-xs text-[#F5D77F] drop-shadow-md">
                      {isDoubleRoute ? "المرسل" : "الزبون"}
                    </span>
                  </div>
                )}
              </div>

              {/* تفاصيل مختصرة في السطر المطوي */}
              <div className="flex items-center gap-2 min-w-0 cursor-pointer" onClick={() => setIsExpanded(true)}>
                <span className="font-black text-xs sm:text-sm text-emerald-300 drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)] truncate">
                  {customerName || order.customer?.name || "الزبون"}
                </span>
                {order.customerRegion?.name && (
                  <span className="text-[11px] sm:text-xs text-[#FFF8F0]/80 truncate hidden sm:inline">
                    • {order.customerRegion.name}
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
                  href={order.customerLocationUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-1.5 bg-[#0F4D3A] hover:bg-[#164E3D] border border-[#C9A86A]/60 rounded-xl text-amber-300 text-xs shadow-md transition hover:scale-110 active:scale-95"
                  title="موقع الزبون"
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

        {/* مؤشر رفع صورة الباب إذا كان هناك رفع جاري */}
        {pending && (
          <div className="absolute top-2 left-2 z-30 bg-black/80 px-2.5 py-1 rounded-xl border border-amber-400 text-xs font-black text-[#F5D77F] animate-pulse flex items-center gap-1 shadow-lg">
            <span>⏳</span> جاري رفع صورة الباب...
          </div>
        )}
      </div>

      {/* مودال معاينة وتكبير صورة باب الزبون مع زر المسح */}
      {zoomOpen && imgCustomerDoor && (
        <ImageZoomModal
          imageUrl={imgCustomerDoor}
          onClose={() => setZoomOpen(false)}
          title="صورة باب الزبون"
          onDelete={handleDelete}
          deleteLabel="مسح صورة باب الزبون"
          isDeleting={deleting}
        />
      )}
    </div>
  );
}
