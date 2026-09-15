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
}: {
  order: any;
  submitterName: string;
  submitterPhone: string;
  imgShopDoor: string | null;
  setPreviewImageUrl: (url: string | null) => void;
  isSystemAdminOrder?: boolean;
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

  return (
    <div className="w-full max-w-4xl mx-auto my-3 select-none" dir="rtl">
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

      {/* زر طي وتوسيع الكارت الفاخر */}
      <div className="flex items-center justify-between px-2 mb-1.5">
        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          className="inline-flex items-center gap-1.5 bg-gradient-to-r from-[#0F4D3A] to-[#164E3D] border border-[#C9A86A] text-xs sm:text-sm font-black text-[#F5D77F] px-3.5 py-1.5 rounded-xl shadow-md transition hover:scale-105 active:scale-95 cursor-pointer"
        >
          <span>{isExpanded ? "▲ طي كارت المحل" : "▼ تفاصيل كارت المحل (المرسل)"}</span>
        </button>

        {pending && (
          <span className="text-xs sm:text-sm font-black text-[#F5D77F] animate-pulse flex items-center gap-1">
            <span>⏳</span> جاري رفع الصورة...
          </span>
        )}
      </div>

      {/* الهيكل الرئيسي لكارت العميل بالإطار الملكي الفاخر */}
      {isExpanded && (
        <div
          className="relative w-full rounded-[22px] sm:rounded-[28px] bg-no-repeat bg-[length:100%_100%] shadow-2xl overflow-hidden p-3.5 sm:p-5 md:p-7 transition-all"
          style={{
            backgroundImage: "url('/images/order-luxury/shop-card/shop-card-frame.webp')",
          }}
        >
          {/* محتوى الكارت: عمودين متجاورين دائماً (اليمين للمعلومات والتواصل، اليسار للصورة وأزرار الرفع) */}
          <div className="grid grid-cols-2 gap-2.5 sm:gap-4 md:gap-6 items-stretch min-w-0">
            
            {/* ================= 1. الجانب الأيمن: كبسولة العنوان + بيانات المحل + موقع المحل + أزرار التواصل ================= */}
            <div className="flex flex-col justify-between gap-2 sm:gap-3 min-w-0">
              {/* الرأس: كبسولة المحل (المرسل) */}
              <div className="flex justify-start">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/images/order-luxury/shop-card/header-shop-info.webp"
                  alt="المحل (المرسل)"
                  className="h-8.5 sm:h-11 md:h-13 w-auto object-contain drop-shadow-md select-none"
                />
              </div>

              {/* قائمة البيانات الأربع بأيقوناتها المجسمة */}
              <div className="space-y-1.5 sm:space-y-2.5 py-0.5">
                {/* سطر 1: اسم المحل */}
                <div className="flex items-center gap-1.5 sm:gap-2.5 min-w-0">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="/images/order-luxury/shop-card/icon-shop-name.webp"
                    alt="اسم المحل"
                    className="w-6 h-6 sm:w-8 sm:h-8 md:w-9 md:h-9 object-contain shrink-0 drop-shadow-sm"
                  />
                  <span className="font-black text-xs sm:text-sm md:text-base text-[#F5D77F] drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)] truncate">
                    {order.shop?.name || "المحل"}
                  </span>
                </div>

                {/* سطر 2: اسم العميل / المسؤول */}
                <div className="flex items-center gap-1.5 sm:gap-2.5 min-w-0">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="/images/order-luxury/shop-card/icon-customer-name.webp"
                    alt="اسم العميل"
                    className="w-6 h-6 sm:w-8 sm:h-8 md:w-9 md:h-9 object-contain shrink-0 drop-shadow-sm"
                  />
                  <span className="font-black text-xs sm:text-sm md:text-base text-emerald-300 drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)] truncate">
                    {submitterName || "—"}
                  </span>
                </div>

                {/* سطر 3: اسم المنطقة */}
                <div className="flex items-center gap-1.5 sm:gap-2.5 min-w-0">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="/images/order-luxury/shop-card/icon-region.webp"
                    alt="منطقة المحل"
                    className="w-6 h-6 sm:w-8 sm:h-8 md:w-9 md:h-9 object-contain shrink-0 drop-shadow-sm"
                  />
                  <span className="font-bold text-xs sm:text-sm md:text-base text-[#FFF8F0] drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)] truncate">
                    {order.shop?.region?.name || "—"}
                  </span>
                </div>

                {/* سطر 4: رقم الهاتف */}
                <div className="flex items-center gap-1.5 sm:gap-2.5 min-w-0">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="/images/order-luxury/shop-card/icon-phone.webp"
                    alt="رقم الهاتف"
                    className="w-6 h-6 sm:w-8 sm:h-8 md:w-9 md:h-9 object-contain shrink-0 drop-shadow-sm"
                  />
                  <span className="font-mono font-black text-xs sm:text-sm md:text-base text-[#F5D77F] tracking-wider drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)] truncate">
                    {cleanPhone || "—"}
                  </span>
                </div>
              </div>

              {/* زر موقع المحل على الخريطة */}
              <div className="pt-0.5">
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
                      src="/images/order-luxury/shop-card/btn-shop-location.webp"
                      alt="موقع المحل"
                      className="h-7 sm:h-9 md:h-10.5 w-auto object-contain drop-shadow-lg"
                    />
                  </a>
                ) : (
                  <div
                    className="inline-block opacity-60 cursor-not-allowed"
                    title="لا يوجد موقع جغرافي مسجل للمحل"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src="/images/order-luxury/shop-card/btn-shop-location.webp"
                      alt="موقع المحل غير متوفر"
                      className="h-7 sm:h-9 md:h-10.5 w-auto object-contain grayscale"
                    />
                  </div>
                )}
              </div>

              {/* أزرار التواصل (اتصال + واتساب) تحت البيانات في الجانب الأيمن */}
              <div className="flex items-center gap-1.5 sm:gap-2.5 pt-1">
                {/* 1. زر اتصال 📞 */}
                {cleanPhone ? (
                  <a
                    href={telHref(cleanPhone)}
                    className="transition-transform hover:scale-105 active:scale-95 cursor-pointer shrink-0"
                    title={`اتصال هاتفي: ${cleanPhone}`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src="/images/order-luxury/shop-card/btn-call.webp"
                      alt="اتصال"
                      className="h-7.5 sm:h-9.5 md:h-11 w-auto object-contain drop-shadow-xl"
                    />
                  </a>
                ) : (
                  <div className="opacity-50 cursor-not-allowed shrink-0" title="لا يوجد رقم هاتف">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src="/images/order-luxury/shop-card/btn-call.webp"
                      alt="اتصال"
                      className="h-7.5 sm:h-9.5 md:h-11 w-auto object-contain grayscale"
                    />
                  </div>
                )}

                {/* 2. زر واتس اب 💬 */}
                {cleanPhone ? (
                  <a
                    href={whatsappMeUrl(cleanPhone)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="transition-transform hover:scale-105 active:scale-95 cursor-pointer shrink-0"
                    title="مراسلة عبر واتساب"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src="/images/order-luxury/shop-card/btn-whatsapp.webp"
                      alt="واتس اب"
                      className="h-7.5 sm:h-9.5 md:h-11 w-auto object-contain drop-shadow-xl"
                    />
                  </a>
                ) : (
                  <div className="opacity-50 cursor-not-allowed shrink-0" title="لا يوجد رقم هاتف">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src="/images/order-luxury/shop-card/btn-whatsapp.webp"
                      alt="واتس اب"
                      className="h-7.5 sm:h-9.5 md:h-11 w-auto object-contain grayscale"
                    />
                  </div>
                )}
              </div>
            </div>

            {/* ================= 2. الجانب الأيسر: كبسولة صورة المحل + مساحة الصورة بالأعلى + أزرار (كاميرا ومعرض) تحتها ================= */}
            <div className="flex flex-col items-center justify-between gap-2 sm:gap-3 min-w-0 h-full">
              {/* الرأس: كبسولة صورة المحل */}
              <div className="flex justify-center w-full">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/images/order-luxury/shop-card/header-shop-photo.webp"
                  alt="صورة المحل"
                  className="h-8.5 sm:h-11 md:h-13 w-auto object-contain drop-shadow-md select-none"
                />
              </div>

              {/* مساحة عرض صورة باب المحل أو الـ Placeholder بحجم كبير ومتناسق */}
              <div className="w-full flex flex-col items-center justify-center my-auto">
                {imgShopDoor ? (
                  <div className="w-full max-w-[170px] sm:max-w-[230px] md:max-w-[270px] flex flex-col items-center gap-1">
                    <div className="w-full aspect-[4/3] overflow-hidden rounded-xl sm:rounded-2xl border-2 border-[#C9A86A] shadow-xl bg-black/40 relative group">
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
                  <div className="w-full max-w-[160px] sm:max-w-[220px] md:max-w-[250px] flex items-center justify-center py-0.5">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src="/images/order-luxury/shop-card/placeholder-no-photo.webp"
                      alt="لا توجد صورة"
                      className="w-full h-auto max-h-[110px] sm:max-h-[145px] md:max-h-[170px] object-contain drop-shadow-lg opacity-95 select-none"
                    />
                  </div>
                )}

                {/* أزرار الحذف والاسترجاع الإدارية إن وجدت صورة */}
                {imgShopDoor && !isSystemAdminOrder && (
                  <div className="flex items-center gap-2 mt-0.5">
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
              </div>

              {/* أزرار رفع الصورة (كاميرا + معرض) مباشرة تحت صورة المحل في الجانب الأيسر بنفس حجم زري الاتصال والواتساب */}
              {!isSystemAdminOrder && (
                <div className="flex items-center justify-center gap-1.5 sm:gap-2.5 pt-1 w-full">
                  {/* 3. زر كاميرا 📷 */}
                  <button
                    type="button"
                    onClick={() => cameraFileRef.current?.click()}
                    disabled={pending}
                    className="transition-transform hover:scale-105 active:scale-95 cursor-pointer shrink-0"
                    title="التقاط صورة المحل بالكاميرا"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src="/images/order-luxury/shop-card/btn-camera.webp"
                      alt="كاميرا"
                      className="h-7.5 sm:h-9.5 md:h-11 w-auto object-contain drop-shadow-xl"
                    />
                  </button>

                  {/* 4. زر معرض 🖼️ */}
                  <button
                    type="button"
                    onClick={() => galleryFileRef.current?.click()}
                    disabled={pending}
                    className="transition-transform hover:scale-105 active:scale-95 cursor-pointer shrink-0"
                    title="اختيار صورة المحل من المعرض"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src="/images/order-luxury/shop-card/btn-gallery.webp"
                      alt="معرض"
                      className="h-7.5 sm:h-9.5 md:h-11 w-auto object-contain drop-shadow-xl"
                    />
                  </button>
                </div>
              )}
            </div>

          </div>
        </div>
      )}
    </div>
  );
}

