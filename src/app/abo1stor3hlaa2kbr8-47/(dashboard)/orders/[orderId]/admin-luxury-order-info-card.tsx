"use client";

import React, { useRef, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { formatDinarAsAlf } from "@/lib/money-alf";
import { resolvePublicAssetSrc } from "@/lib/image-url";
import { ImageZoomModal } from "@/components/pinch-zoom-image";
import { SwipeableLuxuryPhotoBox } from "./swipeable-luxury-photo-box";
import { compressImageForMandoubUpload } from "@/lib/client-image-compress";
import { uploadOrderImageUniversal } from "@/app/actions/order-photo-actions";

export function AdminLuxuryOrderInfoCard({
  order,
  setPreviewImageUrl,
  designerConfig,
  auth,
  nextUrl,
  hideSubtotalInfo = false,
  isMandoubPortal = false,
}: {
  order: any;
  setPreviewImageUrl: (url: string | null) => void;
  designerConfig?: any;
  auth?: { c: string; exp: string; s: string };
  nextUrl?: string;
  hideSubtotalInfo?: boolean;
  isMandoubPortal?: boolean;
}) {
  const router = useRouter();
  const [zoomOpen, setZoomOpen] = useState(false);
  const [compressing, setCompressing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [currentImageUrl, setCurrentImageUrl] = useState<string | null>(order?.imageUrl || null);
  const [uploadedByName, setUploadedByName] = useState<string | null>(order?.orderImageUploadedByName || null);

  useEffect(() => {
    setCurrentImageUrl(order?.imageUrl || null);
    setUploadedByName(order?.orderImageUploadedByName || null);
  }, [order?.imageUrl, order?.orderImageUploadedByName]);

  const cameraFileRef = useRef<HTMLInputElement>(null);
  const galleryFileRef = useRef<HTMLInputElement>(null);

  const orderImageUrl = resolvePublicAssetSrc(currentImageUrl);

  const parseNum = (val: string | number | null | undefined): number => {
    if (val === null || val === undefined) return 0;
    if (typeof val === "number") return isNaN(val) ? 0 : val;
    const clean = String(val).replace(/[^\d.]/g, "");
    const num = parseFloat(clean);
    return isNaN(num) ? 0 : num;
  };

  const subtotalVal = order.orderSubtotal != null ? parseNum(order.orderSubtotal) : 0;
  const deliveryPriceNum = order.deliveryPrice != null ? parseNum(order.deliveryPrice) : 0;
  const totalVal = order.totalAmount != null ? parseNum(order.totalAmount) : 0;

  async function handleFileSelected(file: File | undefined, inputEl: HTMLInputElement | null) {
    if (!(file instanceof File) || file.size <= 0) return;

    setErrorMessage(null);
    setSuccessMessage(null);
    setCompressing(true);

    let photoToUpload = file;
    try {
      photoToUpload = await compressImageForMandoubUpload(file);
    } catch (err) {
      console.warn("تجاوز ضغط الصورة:", err);
    } finally {
      setCompressing(false);
    }

    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("orderId", String(order.id));
      fd.append("orderImage", photoToUpload);
      fd.append("isMandoubPortal", isMandoubPortal ? "true" : "false");

      if (auth?.c) fd.append("c", auth.c);
      if (auth?.exp) fd.append("exp", auth.exp);
      if (auth?.s) fd.append("s", auth.s);

      const res = await uploadOrderImageUniversal(fd);

      if (res.ok && res.imageUrl) {
        setCurrentImageUrl(res.imageUrl);
        setUploadedByName(isMandoubPortal ? "المندوب" : "النظام");
        setSuccessMessage("تم رفع صورة الطلب بنجاح");
        setTimeout(() => setSuccessMessage(null), 4000);
        if (!isMandoubPortal) {
          router.refresh();
        }
      } else {
        setErrorMessage(res.error || "تعذّر رفع الصورة");
      }
    } catch (err: any) {
      console.error("خطأ في رفع صورة الطلب:", err);
      setErrorMessage(err?.message || "حدث خطأ أثناء رفع الصورة");
    } finally {
      setUploading(false);
      if (inputEl) {
        inputEl.value = "";
      }
    }
  }

  const busy = compressing || uploading;
  const orderTitle = order.orderType || order.summary || "أدوية";

  const cameraInputUniqueId = `order-img-cam-${order.id}`;
  const galleryInputUniqueId = `order-img-gal-${order.id}`;

  return (
    <div className="w-full max-w-4xl mx-auto my-0 select-none" dir="rtl">
      {/* مدخلات الكاميرا والمعرض المستقلة والخفيفة */}
      <input
        id={cameraInputUniqueId}
        ref={cameraFileRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="fixed -top-[9999px] -left-[9999px] opacity-0 pointer-events-none w-[1px] h-[1px]"
        onChange={(e) => {
          const file = e.target.files?.[0];
          void handleFileSelected(file, cameraFileRef.current);
        }}
      />
      <input
        id={galleryInputUniqueId}
        ref={galleryFileRef}
        type="file"
        accept="image/*"
        className="fixed -top-[9999px] -left-[9999px] opacity-0 pointer-events-none w-[1px] h-[1px]"
        onChange={(e) => {
          const file = e.target.files?.[0];
          void handleFileSelected(file, galleryFileRef.current);
        }}
      />

      <div className="relative unified-card rounded-[20px] border-[1.5px] border-[#38BDF8]/40 bg-[#FFFFFF] shadow-[0_6px_20px_rgba(2,132,199,0.08)] overflow-hidden">
        {/* الهيدر */}
        <div className="unified-header px-3.5 py-3 flex items-center justify-between bg-gradient-to-r from-[#F0F9FF] to-[#FFFFFF] border-b border-[#38BDF8]/20">
          <div className="flex items-center gap-2.5">
            <div className="w-[32px] h-[32px] rounded-[10px] bg-gradient-to-br from-[#0284C7] to-[#0369A1] flex items-center justify-center shadow-[0_3px_10px_rgba(2,132,199,0.25)] border border-[#38BDF8]/40">
              <svg className="w-[16px] h-[16px] text-[#FDE047]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" />
                <path d="M3 6h18" />
                <path d="M16 10a4 4 0 0 1-8 0" />
              </svg>
            </div>
            <h3 className="text-[14px] font-black text-[#0369A1] leading-none">تفاصيل الطلبية والمبلغ</h3>
          </div>
          {busy && (
            <div className="flex items-center gap-1.5 text-xs font-black text-[#0284C7] bg-[#E0F2FE] px-2.5 py-1 rounded-full border border-[#38BDF8]/40 animate-pulse">
              <span className="w-2 h-2 rounded-full bg-[#0284C7] animate-ping" />
              <span>{compressing ? "جارٍ ضغط الصورة..." : "جارٍ الرفع والحفظ..."}</span>
            </div>
          )}
        </div>

        {/* المحتوى: التفاصيل يمين، الصورة يسار 110px */}
        <div className="p-3.5 bg-[#FFFFFF]">
          <div className="flex gap-3 items-start" dir="rtl">
            <div className="flex-1 min-w-0 space-y-3" style={{ flex: "1.5" }}>
              {/* اسم الطلب */}
              <div className="flex items-center gap-2.5">
                <div className="w-[38px] h-[38px] rounded-[11px] bg-[#F0F9FF] border border-[#38BDF8]/40 flex items-center justify-center shadow-[inset_0_1px_0_white]">
                  <svg className="w-[18px] h-[18px] text-[#0284C7]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                    <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
                    <path d="M14 2v4a2 2 0 0 0 2 2h4" />
                    <path d="M10 9H8" />
                    <path d="M16 13H8" />
                    <path d="M16 17H8" />
                  </svg>
                </div>
                <div className="text-[18px] font-black text-[#0369A1] leading-none truncate">
                  {orderTitle}
                </div>
              </div>

              <div className="space-y-2.5">
                {/* سعر الطلب */}
                <div className="w-full h-[40px] rounded-[12px] bg-[#FFFFFF] border-[1.5px] border-[#38BDF8]/40 px-3 flex items-center justify-between gap-2 shadow-[0_2px_6px_rgba(2,132,199,0.08),inset_0_1px_0_white]">
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="w-[22px] h-[22px] rounded-[9px] bg-[#F0F9FF] border border-[#38BDF8]/40 flex items-center justify-center">
                      <svg className="w-[12px] h-[12px] text-[#0284C7]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <path d="M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42z" />
                        <circle cx="7.5" cy="7.5" r=".5" fill="currentColor" />
                      </svg>
                    </span>
                    <span className="text-[12px] font-bold text-[#0369A1] whitespace-nowrap">سعر الطلب</span>
                  </div>
                  <div className="flex items-baseline gap-1 shrink-0">
                    <span className="text-[14px] font-black text-[#0F172A] font-mono [direction:ltr]">
                      {order.orderSubtotal != null ? formatDinarAsAlf(subtotalVal) : "0"}
                    </span>
                    <span className="text-[11px] font-bold text-[#0369A1] whitespace-nowrap">ألف</span>
                  </div>
                </div>

                {/* التوصيل */}
                <div className="w-full h-[40px] rounded-[12px] bg-[#FFFFFF] border-[1.5px] border-[#38BDF8]/40 px-3 flex items-center justify-between gap-2 shadow-[0_2px_6px_rgba(2,132,199,0.08),inset_0_1px_0_white]">
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="w-[22px] h-[22px] rounded-[9px] bg-[#0284C7] border border-[#38BDF8]/30 flex items-center justify-center">
                      <svg className="w-[12px] h-[12px] text-[#FDE047]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2" />
                        <path d="M15 18H9" />
                        <path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14" />
                        <circle cx="17" cy="18" r="2" />
                        <circle cx="7" cy="18" r="2" />
                      </svg>
                    </span>
                    <span className="text-[12px] font-bold text-[#0369A1] whitespace-nowrap">التوصيل</span>
                  </div>
                  <div className="flex items-baseline gap-1 shrink-0">
                    <span className="text-[14px] font-black text-[#0F172A] font-mono [direction:ltr]">
                      {order.deliveryPrice != null ? formatDinarAsAlf(deliveryPriceNum) : "0"}
                    </span>
                    <span className="text-[11px] font-bold text-[#0369A1] whitespace-nowrap">ألف</span>
                  </div>
                </div>

                {/* الصندوق الكلي */}
                <div
                  className="w-full h-[70px] rounded-[16px] border-[2px] border-[#38BDF8] shadow-[0_4px_14px_rgba(2,132,199,0.35),inset_0_1px_0_rgba(255,255,255,0.3)] flex items-center justify-center"
                  style={{ background: "linear-gradient(135deg, #0284C7 0%, #0369A1 100%)" }}
                >
                  <span className="text-[42px] font-black leading-none text-white drop-shadow-sm font-mono tracking-tight [direction:ltr]">
                    {order.totalAmount != null ? formatDinarAsAlf(totalVal) : "0"}
                  </span>
                </div>
              </div>
            </div>

            {/* صورة الطلب يسار 110px مع زري الكاميرا والمعرض المباشرين */}
            <div className="shrink-0 flex flex-col items-center justify-start" style={{ flex: "0 0 110px" }}>
              <SwipeableLuxuryPhotoBox
                size={110}
                variant="order"
                imageUrl={orderImageUrl}
                label="صورة الطلب"
                isBusy={busy}
                cameraInputId={cameraInputUniqueId}
                galleryInputId={galleryInputUniqueId}
                onCameraClick={() => cameraFileRef.current?.click()}
                onGalleryClick={() => galleryFileRef.current?.click()}
                onClickPreview={() => {
                  if (orderImageUrl) {
                    setPreviewImageUrl(orderImageUrl);
                    setZoomOpen(true);
                  } else {
                    cameraFileRef.current?.click();
                  }
                }}
                fallbackIcon={
                  <svg className="w-[24px] h-[24px] text-[#0284C7]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
                    <path d="M14 2v4a2 2 0 0 0 2 2h4" />
                  </svg>
                }
              />
            </div>
          </div>

          {/* تنبيهات النجاح والخطأ أسفل الكارت */}
          {errorMessage && (
            <div className="mt-2.5 rounded-xl border border-rose-200 bg-rose-50 p-2 text-center text-xs font-black text-rose-700 animate-fadeIn">
              ⚠️ {errorMessage}
            </div>
          )}
          {successMessage && (
            <div className="mt-2.5 rounded-xl border border-emerald-200 bg-emerald-50 p-2 text-center text-xs font-black text-emerald-700 animate-fadeIn">
              ✅ {successMessage}
            </div>
          )}
        </div>
      </div>

      {zoomOpen && orderImageUrl && (
        <ImageZoomModal
          imageUrl={orderImageUrl}
          title="صورة الطلبية"
          uploadedByName={uploadedByName}
          onClose={() => setZoomOpen(false)}
        />
      )}
    </div>
  );
}
