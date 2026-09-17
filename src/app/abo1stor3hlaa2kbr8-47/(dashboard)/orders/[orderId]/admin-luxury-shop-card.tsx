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
}: {
  order: any;
  submitterName: string;
  submitterPhone: string;
  imgShopDoor: string | null;
  setPreviewImageUrl: (url: string | null) => void;
  isSystemAdminOrder?: boolean;
  designerConfig?: any;
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
  const shopName = order.shop?.name || submitterName || "المحل";
  const shopOwner = order.shop?.ownerName || (isSystemAdminOrder ? "الإدارة" : "المسؤول");
  const shopRegion = order.shop?.region?.name || "السوق";

  return (
    <div className="w-full max-w-4xl mx-auto my-0 select-none font-sans" dir="rtl">
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

      {/* كارت المحل الملكي الزمردي الفاخر */}
      <div className="relative mt-1">
        {/* إطار التدرج الذهبي الخارجي */}
        <div className="absolute -inset-[1px] rounded-[24px] bg-gradient-to-b from-[#C9A86A] to-[#9C7D46] opacity-90 pointer-events-none" />

        <div className="relative rounded-[22px] bg-[#FFFEFB] border border-[#FDF6E3] shadow-[0_8px_24px_rgba(10,61,46,0.08),0_1px_3px_rgba(0,0,0,0.05),inset_0_1px_0_white] overflow-hidden">
          {/* لمسات وزخارف إسلامية مذهبة */}
          <div className="absolute inset-[3px] rounded-[19px] border border-[#0A3D2E]/[0.06] pointer-events-none" />
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[62%] h-[18px] bg-gradient-to-b from-[#FDF6E3] to-transparent rounded-b-[18px] border-x border-b border-[#C9A86A]/15 pointer-events-none" />
          <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none">
            <div className="w-[28px] h-[14px] bg-[#FFFEFB] border border-[#C9A86A]/30 rounded-b-full flex items-end justify-center pb-[2px] shadow-sm">
              <div className="w-[5px] h-[5px] rotate-45 bg-[#C9A86A]/70" />
            </div>
          </div>
          <div className="absolute top-[10px] right-[10px] w-[7px] h-[7px] rotate-45 bg-gradient-to-br from-[#E8C77E] to-[#C9A86A] shadow-[0_0_4px_rgba(201,168,106,0.5)] pointer-events-none" />
          <div className="absolute top-[10px] left-[10px] w-[7px] h-[7px] rotate-45 bg-gradient-to-br from-[#E8C77E] to-[#C9A86A] shadow-[0_0_4px_rgba(201,168,106,0.5)] pointer-events-none" />
          <div className="absolute bottom-[42px] right-[10px] w-[5px] h-[5px] rotate-45 border border-[#C9A86A]/40 pointer-events-none" />
          <div className="absolute bottom-[42px] left-[10px] w-[5px] h-[5px] rotate-45 border border-[#C9A86A]/40 pointer-events-none" />

          <div className="relative p-3.5 pt-5">
            {/* عنوان الكارت وشارة الحالة */}
            <div className="flex items-center gap-2 mb-3">
              <div className="w-[30px] h-[30px] rounded-[10px] bg-gradient-to-br from-[#0A3D2E] to-[#115740] flex items-center justify-center shadow-[0_3px_10px_rgba(10,61,46,0.25),inset_0_1px_0_rgba(255,255,255,0.15)] border border-[#C9A86A]/20">
                <svg className="w-[15px] h-[15px] text-[#E8C77E]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                  <polyline points="9 22 9 12 15 12 15 22" />
                </svg>
              </div>
              <div>
                <h2 className="text-[14px] font-black text-[#0A3D2E] leading-none">المحل (المرسل)</h2>
                <div className="mt-[3px] h-[2px] w-[78px] bg-gradient-to-l from-[#C9A86A] to-transparent rounded-full" />
              </div>
              <div className="mr-auto flex items-center gap-1">
                <div className="w-[18px] h-[18px] rounded-full bg-[#E6F4EF] flex items-center justify-center border border-[#115740]/10">
                  <div className="w-[4px] h-[4px] rounded-full bg-[#115740]" />
                </div>
                <span className="text-[10px] font-bold text-[#115740]/70">نشط</span>
              </div>
            </div>

            {isExpanded && (
              <>
                {/* محتوى بيانات المحل + الصورة المذهبة */}
                <div className="flex gap-3 items-start">
                  <div className="flex-1 min-w-0 space-y-2.5">
                    <div>
                      <div className="text-[16px] font-black text-[#0A3D2E] leading-tight break-words">
                        {shopName}
                      </div>
                      <div className="flex items-center gap-1.5 mt-1">
                        <span className="w-[18px] h-[18px] rounded-full bg-[#FDF6E3] border border-[#C9A86A]/30 flex items-center justify-center shrink-0">
                          <svg className="w-[10px] h-[10px] text-[#9C7D46]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                            <circle cx="12" cy="7" r="4" />
                          </svg>
                        </span>
                        <span className="text-[12px] font-bold text-[#3A4F49] truncate">{shopOwner}</span>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex items-center gap-1.5 text-[12px] text-[#5A6E68]">
                        <span className="w-[18px] h-[18px] rounded-full bg-[#E6F4EF] flex items-center justify-center shrink-0">
                          <svg className="w-[10px] h-[10px] text-[#115740]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                            <circle cx="12" cy="10" r="3" />
                          </svg>
                        </span>
                        <span className="font-medium truncate">{shopRegion}</span>
                      </div>

                      {cleanPhone && (
                        <div className="flex items-center gap-1.5">
                          <span className="w-[18px] h-[18px] rounded-full bg-[#0A3D2E] flex items-center justify-center shrink-0">
                            <svg className="w-[10px] h-[10px] text-[#E8C77E]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                              <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                            </svg>
                          </span>
                          <span className="text-[12px] font-bold tracking-[0.02em] text-[#0A3D2E] [direction:ltr]">
                            {cleanPhone}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* إطار صورة المحل الذهبي الفاخر */}
                  <div className="shrink-0 relative">
                    <div className="relative w-[96px] h-[96px] rounded-[20px] p-[3px] bg-gradient-to-b from-[#F1D99A] via-[#E8C77E] to-[#A8864A] shadow-[0_4px_18px_rgba(201,168,106,0.35),inset_0_1px_0_rgba(255,255,255,0.6)]">
                      <div className="w-full h-full rounded-[17px] bg-gradient-to-br from-[#123E2F] via-[#115740] to-[#0A3D2E] relative overflow-hidden border border-[#0A3D2E]/50 flex flex-col items-center justify-center">
                        {imgShopDoor ? (
                          /* eslint-disable-next-line @next/next/no-img-element */
                          <img
                            src={imgShopDoor}
                            alt="صورة باب المحل"
                            className="w-full h-full object-cover cursor-pointer hover:scale-105 transition duration-300"
                            onClick={() => {
                              setPreviewImageUrl(imgShopDoor);
                              setZoomOpen(true);
                            }}
                          />
                        ) : (
                          <>
                            <div
                              className="absolute inset-0 opacity-[0.12]"
                              style={{
                                backgroundImage: `url("data:image/svg+xml,%3Csvg width='30' height='30' viewBox='0 0 30 30' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M15 0 L16 12 L28 8 L18 15 L28 22 L16 18 L15 30 L14 18 L2 22 L12 15 L2 8 L14 12 Z' fill='%23E8C77E'/%3E%3C/svg%3E")`,
                              }}
                            />
                            <div className="relative z-10 text-center">
                              <div className="w-[32px] h-[32px] mx-auto rounded-[9px] bg-[#E8C77E]/15 border border-[#E8C77E]/30 flex items-center justify-center mb-1">
                                <svg className="w-4 h-4 text-[#E8C77E]/80" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                                </svg>
                              </div>
                              <span className="text-[10px] font-bold text-[#E6F4EF]/90 leading-none">صورة المحل</span>
                            </div>
                            <div className="absolute inset-0 rounded-[17px] shadow-[inset_0_1px_12px_rgba(232,199,126,0.15),inset_0_0_0_1px_rgba(232,199,126,0.15)] pointer-events-none" />
                          </>
                        )}
                      </div>

                      {/* شارة التوجيه والموقع */}
                      {hasLocation && (
                        <a
                          href={order.shopLocationUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="absolute -bottom-1 -left-1 w-[28px] h-[28px] rounded-full bg-gradient-to-br from-[#FF5A5A] to-[#C13C3C] border-[2.5px] border-white shadow-[0_3px_10px_rgba(193,60,60,0.4)] flex items-center justify-center active:scale-95 transition-transform"
                          title="فتح الموقع على الخريطة"
                        >
                          <svg className="w-[12px] h-[12px] text-white -rotate-45 translate-x-[0.5px]" viewBox="0 0 24 24" fill="currentColor">
                            <polygon points="3 11 22 2 13 21 11 13 3 11" />
                          </svg>
                        </a>
                      )}
                    </div>
                    <div className="absolute -top-1 -right-1 w-1.5 h-1.5 rounded-full bg-[#E8C77E] shadow-[0_0_6px_#E8C77E]" />
                  </div>
                </div>

                {/* أزرار العمليات والتواصل */}
                <div className="mt-3.5 space-y-2">
                  {/* زر موقع المحل الكبير الذهبي */}
                  {hasLocation ? (
                    <a
                      href={order.shopLocationUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full h-[40px] rounded-full bg-gradient-to-r from-[#F1D99A] via-[#E8C77E] to-[#C9A86A] relative overflow-hidden shadow-[0_4px_14px_rgba(201,168,106,0.35),inset_0_1px_0_rgba(255,255,255,0.6)] border border-[#9C7D46]/30 active:scale-[0.99] transition-transform flex items-center justify-center gap-1.5 group"
                    >
                      <div
                        className="absolute inset-0 opacity-[0.08] mix-blend-overlay pointer-events-none"
                        style={{
                          backgroundImage: `url("data:image/svg+xml,%3Csvg width='20' height='20' viewBox='0 0 20 20' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M10 0 L11 7 L18 4 L12 10 L18 16 L11 13 L10 20 L9 13 L2 16 L8 10 L2 4 L9 7 Z' fill='white'/%3E%3C/svg%3E")`,
                        }}
                      />
                      <svg className="w-[14px] h-[14px] text-[#0A3D2E]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                        <circle cx="12" cy="10" r="3" />
                      </svg>
                      <span className="relative text-[13px] font-black text-[#0A3D2E]">موقع المحل</span>
                    </a>
                  ) : (
                    <div className="w-full h-[40px] rounded-full bg-slate-100 text-slate-400 border border-slate-200 flex items-center justify-center gap-1.5 text-xs font-bold">
                      <svg className="w-3.5 h-3.5 opacity-60" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                      </svg>
                      <span>لا يوجد موقع للمحل</span>
                    </div>
                  )}

                  {/* زري واتس واتصال المحل */}
                  {cleanPhone && (
                    <div className="grid grid-cols-2 gap-2">
                      <a
                        href={whatsappMeUrl(cleanPhone)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="h-[38px] rounded-full bg-[#115740] text-white flex items-center justify-center gap-1.5 shadow-[0_3px_12px_rgba(17,87,64,0.3),inset_0_1px_0_rgba(255,255,255,0.15)] border border-[#0A3D2E]/20 active:scale-[0.98] transition-transform"
                      >
                        <svg className="w-[14px] h-[14px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                          <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
                        </svg>
                        <span className="text-[12px] font-bold">واتس</span>
                      </a>

                      <a
                        href={telHref(cleanPhone)}
                        className="h-[38px] rounded-full bg-[#0A3D2E] text-[#E8C77E] flex items-center justify-center gap-1.5 shadow-[0_3px_12px_rgba(10,61,46,0.35),inset_0_1px_0_rgba(232,199,126,0.15)] border border-[#C9A86A]/40 active:scale-[0.98] transition-transform"
                      >
                        <svg className="w-[14px] h-[14px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                          <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                        </svg>
                        <span className="text-[12px] font-bold">اتصال</span>
                      </a>
                    </div>
                  )}

                  {/* زري كاميرا ومعرض صور المحل */}
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => cameraFileRef.current?.click()}
                      className="h-[32px] rounded-full bg-white border border-[#C9A86A]/35 text-[#6B5A38] flex items-center justify-center gap-1 text-[11px] font-bold shadow-[0_1px_6px_rgba(201,168,106,0.12)] active:scale-95 transition-all cursor-pointer"
                    >
                      <svg className="w-3 h-3 text-[#9C7D46]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                        <circle cx="12" cy="13" r="4" />
                      </svg>
                      <span>كاميرا</span>
                    </button>

                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => galleryFileRef.current?.click()}
                      className="h-[32px] rounded-full bg-white border border-[#C9A86A]/35 text-[#6B5A38] flex items-center justify-center gap-1 text-[11px] font-bold shadow-[0_1px_6px_rgba(201,168,106,0.12)] active:scale-95 transition-all cursor-pointer"
                    >
                      <svg className="w-3 h-3 text-[#9C7D46]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                        <circle cx="8.5" cy="8.5" r="1.5" />
                        <polyline points="21 15 16 10 5 21" />
                      </svg>
                      <span>معرض</span>
                    </button>
                  </div>
                </div>
              </>
            )}

            {/* شريط طي / فتح تفاصيل المحل */}
            <div className="mt-3.5 -mx-3.5 border-t border-[#C9A86A]/15 bg-gradient-to-b from-[#FDF6E3]/60 to-[#FDF6E3]/20">
              <button
                type="button"
                onClick={() => setIsExpanded(!isExpanded)}
                className="w-full h-[36px] flex items-center justify-center gap-1.5 text-[11px] font-bold text-[#7A6A4A] hover:text-[#0A3D2E] transition-colors cursor-pointer"
              >
                <span>{isExpanded ? "إغلاق تفاصيل المحل" : "عرض تفاصيل المحل"}</span>
                <svg
                  className={`w-3.5 h-3.5 transition-transform duration-200 ${isExpanded ? "" : "rotate-180"}`}
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                >
                  <polyline points="18 15 12 9 6 15" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* مودال تكبير الصورة إن وجدت */}
      {imgShopDoor && (
        <ImageZoomModal
          open={zoomOpen}
          onClose={() => setZoomOpen(false)}
          src={imgShopDoor}
          title={shopName}
        />
      )}
    </div>
  );
}
