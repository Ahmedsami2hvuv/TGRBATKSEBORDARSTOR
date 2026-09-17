"use client";

import React, { useRef, useState, useActionState } from "react";
import { useRouter } from "next/navigation";
import { formatDinarAsAlf } from "@/lib/money-alf";
import { resolvePublicAssetSrc } from "@/lib/image-url";
import { ImageZoomModal } from "@/components/pinch-zoom-image";
import { SwipeableLuxuryPhotoBox } from "./swipeable-luxury-photo-box";
import {
  assignFileToInput,
  compressImageForMandoubUpload,
} from "@/lib/client-image-compress";
import { uploadMandoubOrderImage } from "@/app/mandoub/actions";

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

  const cameraFileRef = useRef<HTMLInputElement>(null);
  const galleryFileRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const [, formAction, pending] = useActionState(uploadMandoubOrderImage, {});

  const orderImageUrl = resolvePublicAssetSrc(order.imageUrl);

  const parseNum = (val: string | number | null | undefined): number => {
    if (val === null || val === undefined) return 0;
    if (typeof val === "number") return isNaN(val) ? 0 : val;
    const clean = String(val).replace(/[^\d.]/g, "");
    const num = parseFloat(clean);
    return isNaN(num) ? 0 : num;
  };

  const subtotalVal = order.orderSubtotal != null ? parseNum(order.orderSubtotal) : 0;
  const deliveryVal = order.deliveryPrice != null ? parseNum(order.deliveryPrice) : 0;
  const totalVal = order.totalAmount != null ? parseNum(order.totalAmount) : 0;

  async function handleFileSelected(file: File | undefined, inputEl: HTMLInputElement | null) {
    if (!(file instanceof File) || file.size <= 0) return;

    setCompressing(true);
    let photoToUpload = file;
    try {
      photoToUpload = await compressImageForMandoubUpload(file);
      assignFileToInput(inputEl, photoToUpload);
    } catch (err) {
      console.error("خطأ في ضغط الصورة:", err);
    } finally {
      setCompressing(false);
    }

    if (formRef.current) {
      formRef.current.requestSubmit();
    }
  }

  const busy = compressing || pending;
  const orderTitle = order.orderType || order.summary || "أدوية";

  return (
    <div className="w-full max-w-4xl mx-auto my-0 select-none" dir="rtl">
      <form ref={formRef} action={formAction} className="hidden">
        <input type="hidden" name="orderId" value={order.id} />
        {nextUrl && <input type="hidden" name="nextUrl" value={nextUrl} />}
        {auth && (
          <>
            <input type="hidden" name="c" value={auth.c} />
            <input type="hidden" name="exp" value={auth.exp} />
            <input type="hidden" name="s" value={auth.s} />
          </>
        )}
        <input
          ref={cameraFileRef}
          type="file"
          name="orderImage"
          accept="image/*"
          capture="environment"
          onChange={(e) => {
            const file = e.target.files?.[0];
            void handleFileSelected(file, cameraFileRef.current);
          }}
        />
        <input
          ref={galleryFileRef}
          type="file"
          name="orderImage"
          accept="image/*"
          onChange={(e) => {
            const file = e.target.files?.[0];
            void handleFileSelected(file, galleryFileRef.current);
          }}
        />
      </form>

      <div className="relative unified-card rounded-[20px] border-[2px] border-[#C9A86A] bg-[#FFFEF8] shadow-[0_8px_30px_rgba(0,0,0,0.15),inset_0_1px_0_white,0_0_0_1px_#E8D5A3_inset] overflow-hidden">
        {/* معينات الزوايا الأربعة */}
        <div className="gold-corner top-[10px] right-[10px]" />
        <div className="gold-corner top-[10px] left-[10px]" />
        <div className="gold-corner bottom-[10px] right-[10px]" />
        <div className="gold-corner bottom-[10px] left-[10px]" />

        {/* الهيدر */}
        <div className="unified-header px-3.5 py-3 flex items-center justify-between bg-gradient-to-r from-[#FFFEF8] to-[#FDF6E3] border-b-[1.5px] border-[#E8D5A3]">
          <div className="flex items-center gap-2.5">
            <div className="w-[32px] h-[32px] rounded-[10px] gold-grad flex items-center justify-center shadow-[0_3px_10px_rgba(201,168,106,0.4)] border border-[#9C7D46]/30">
              <svg className="w-[16px] h-[16px] text-[#0A3D2E]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" />
                <path d="M3 6h18" />
                <path d="M16 10a4 4 0 0 1-8 0" />
              </svg>
            </div>
            <h3 className="text-[14px] font-black text-[#0A3D2E] leading-none">تفاصيل الطلبية والمبلغ</h3>
          </div>
        </div>

        {/* المحتوى: التفاصيل يمين (أدوية بدون "نوع الطلب")، الصورة يسار 110px */}
        <div className="p-3.5 bg-[#FFFEF8]">
          <div className="flex gap-3 items-start" dir="rtl">
            <div className="flex-1 min-w-0 space-y-3" style={{ flex: "1.5" }}>
              {/* اسم الطلب مباشرة بدون كلمة "نوع الطلب" */}
              <div className="flex items-center gap-2.5">
                <div className="w-[38px] h-[38px] rounded-[11px] bg-[#FDF6E3] border border-[#C9A86A]/40 flex items-center justify-center shadow-[inset_0_1px_0_white]">
                  <svg className="w-[18px] h-[18px] text-[#8B6A2A]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                    <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
                    <path d="M14 2v4a2 2 0 0 0 2 2h4" />
                    <path d="M10 9H8" />
                    <path d="M16 13H8" />
                    <path d="M16 17H8" />
                  </svg>
                </div>
                <div className="text-[18px] font-black text-[#0A3D2E] leading-none truncate">
                  {orderTitle}
                </div>
              </div>

              <div className="space-y-2.5">
                {/* سعر الطلب */}
                <div className="w-full h-[40px] rounded-[12px] bg-[#FFFEF8] border-[1.5px] border-[#C9A86A] px-3 flex items-center justify-between gap-2 shadow-[0_2px_6px_rgba(201,168,106,0.12),inset_0_1px_0_white]">
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="w-[22px] h-[22px] rounded-[9px] bg-[#FDF6E3] border border-[#C9A86A]/30 flex items-center justify-center">
                      <svg className="w-[12px] h-[12px] text-[#8B6A2A]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <path d="M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42z" />
                        <circle cx="7.5" cy="7.5" r=".5" fill="currentColor" />
                      </svg>
                    </span>
                    <span className="text-[12px] font-bold text-[#0A3D2E] whitespace-nowrap">سعر الطلب</span>
                  </div>
                  <div className="flex items-baseline gap-1 shrink-0">
                    <span className="text-[14px] font-black text-[#0A3D2E] font-mono [direction:ltr]">
                      {order.orderSubtotal != null ? formatDinarAsAlf(subtotalVal) : "0"}
                    </span>
                    <span className="text-[11px] font-bold text-[#8B6A2A] whitespace-nowrap">ألف</span>
                  </div>
                </div>

                {/* التوصيل */}
                <div className="w-full h-[40px] rounded-[12px] bg-[#FFFEF8] border-[1.5px] border-[#C9A86A] px-3 flex items-center justify-between gap-2 shadow-[0_2px_6px_rgba(201,168,106,0.12),inset_0_1px_0_white]">
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="w-[22px] h-[22px] rounded-[9px] bg-[#0A3D2E] border border-[#C9A86A]/20 flex items-center justify-center">
                      <svg className="w-[12px] h-[12px] text-[#E8C77E]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2" />
                        <path d="M15 18H9" />
                        <path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14" />
                        <circle cx="17" cy="18" r="2" />
                        <circle cx="7" cy="18" r="2" />
                      </svg>
                    </span>
                    <span className="text-[12px] font-bold text-[#0A3D2E] whitespace-nowrap">التوصيل</span>
                  </div>
                  <div className="flex items-baseline gap-1 shrink-0">
                    <span className="text-[14px] font-black text-[#0A3D2E] font-mono [direction:ltr]">
                      {order.deliveryPrice != null ? formatDinarAsAlf(deliveryVal) : "0"}
                    </span>
                    <span className="text-[11px] font-bold text-[#8B6A2A] whitespace-nowrap">ألف</span>
                  </div>
                </div>

                {/* الصندوق الكلي العريض 100% بارتفاع 70px ورقم 42px فقط بدون كلمة ألف */}
                <div
                  className="w-full h-[70px] rounded-[16px] border-[2px] border-[#0A3D2E] shadow-[0_4px_14px_rgba(201,168,106,0.3),inset_0_1px_0_rgba(255,255,255,0.6)] flex items-center justify-center"
                  style={{ background: "linear-gradient(135deg, #E8C77E 0%, #C9A86A 100%)" }}
                >
                  <span className="text-[42px] font-black leading-none text-[#0A3D2E] font-mono tracking-tight [direction:ltr]">
                    {order.totalAmount != null ? formatDinarAsAlf(totalVal) : "0"}
                  </span>
                </div>
              </div>
            </div>

            {/* صورة الطلب يسار 110px قابلة للسحب لليمين للكاميرا ولليسار للمعرض والنقر للتكبير */}
            <div className="shrink-0 flex flex-col items-center justify-start" style={{ flex: "0 0 110px" }}>
              <SwipeableLuxuryPhotoBox
                size={110}
                variant="order"
                imageUrl={orderImageUrl}
                label="صورة الطلب"
                isBusy={busy}
                onSwipeRight={() => cameraFileRef.current?.click()}
                onSwipeLeft={() => galleryFileRef.current?.click()}
                onClickPreview={() => {
                  if (orderImageUrl) {
                    setPreviewImageUrl(orderImageUrl);
                    setZoomOpen(true);
                  } else {
                    cameraFileRef.current?.click();
                  }
                }}
                fallbackIcon={
                  <svg className="w-[24px] h-[24px] text-[#0A3D2E]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
                    <path d="M14 2v4a2 2 0 0 0 2 2h4" />
                  </svg>
                }
              />
            </div>
          </div>
        </div>
      </div>

      {zoomOpen && orderImageUrl && (
        <ImageZoomModal
          imageUrl={orderImageUrl}
          title="صورة الطلبية"
          uploadedByName={order.orderImageUploadedByName}
          onClose={() => setZoomOpen(false)}
        />
      )}
    </div>
  );
}
