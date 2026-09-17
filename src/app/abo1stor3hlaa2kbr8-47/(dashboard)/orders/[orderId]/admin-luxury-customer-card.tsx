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
  type CustomElementConfig,
  getElementStyle,
  getCardContainerStyle,
  RenderCustomElementsLayer,
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
  children,
}: {
  order: any;
  customerName: string;
  customerPhone: string;
  imgCustomerDoor: string | null;
  setPreviewImageUrl: (url: string | null) => void;
  isDoubleRoute?: boolean;
  designerConfig?: OrderCardDesignerConfig;
  phoneProfile?: any;
  children?: React.ReactNode;
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
    <div className="w-full max-w-4xl mx-auto my-0 select-none" dir="rtl">
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

      {/* كارت الزبون الملكي الزمردي الفاخر */}
      <div className="relative mt-1">
        {/* إطار التدرج الزمردي الذهبي الخارجي */}
        <div className="absolute -inset-[1px] rounded-[24px] bg-gradient-to-b from-[#C9A86A]/80 to-[#9C7D46]/70 opacity-80 pointer-events-none" />

        <div className="relative rounded-[22px] bg-[#FFFEFB] border border-[#FDF6E3] shadow-[0_8px_24px_rgba(10,61,46,0.07),0_1px_3px_rgba(0,0,0,0.05),inset_0_1px_0_white] overflow-hidden">
          {/* لمسات وزخارف إسلامية هندسية */}
          <div className="absolute inset-[3px] rounded-[19px] border border-[#115740]/[0.06] pointer-events-none" />
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[62%] h-[18px] bg-gradient-to-b from-[#E6F4EF]/70 to-transparent rounded-b-[18px] border-x border-b border-[#115740]/10 pointer-events-none" />
          <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none">
            <div className="w-[28px] h-[14px] bg-[#FFFEFB] border border-[#115740]/20 rounded-b-full flex items-end justify-center pb-[2px] shadow-sm">
              <div className="w-[5px] h-[5px] rotate-45 bg-[#115740]/60" />
            </div>
          </div>
          <div className="absolute top-[10px] right-[10px] w-[7px] h-[7px] rotate-45 bg-gradient-to-br from-[#E8C77E] to-[#C9A86A] shadow-[0_0_4px_rgba(201,168,106,0.5)] pointer-events-none" />
          <div className="absolute top-[10px] left-[10px] w-[7px] h-[7px] rotate-45 bg-gradient-to-br from-[#E8C77E] to-[#C9A86A] shadow-[0_0_4px_rgba(201,168,106,0.5)] pointer-events-none" />

          <div className="relative p-3.5 pt-5">
            {/* عنوان الكارت */}
            <div className="flex items-center gap-2 mb-3">
              <div className="w-[30px] h-[30px] rounded-[10px] bg-gradient-to-br from-[#E6F4EF] to-[#CDE7DC] flex items-center justify-center shadow-[0_2px_8px_rgba(17,87,64,0.15)] border border-[#115740]/10">
                <svg className="w-[15px] h-[15px] text-[#115740]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
              </div>
              <div>
                <h2 className="text-[14px] font-black text-[#0A3D2E] leading-none">
                  {isDoubleRoute ? "المرسل (الوجهة الأولى)" : "الزبون (المستلم)"}
                </h2>
                <div className="mt-[3px] h-[2px] w-[78px] bg-gradient-to-l from-[#115740]/60 to-transparent rounded-full" />
              </div>
            </div>

            {isExpanded && (
              <>
                {/* محتوى بيانات الزبون + صورة الباب المذهبة */}
                <div className="flex gap-3 items-start">
                  <div className="flex-1 min-w-0 space-y-2.5">
                    {/* منطقة الزبون */}
                    <div>
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#FDF6E3] border border-[#C9A86A]/20 shadow-[inset_0_1px_0_white]">
                        <span className="w-[16px] h-[16px] rounded-full bg-white border border-[#C9A86A]/30 flex items-center justify-center shrink-0">
                          <svg className="w-[9px] h-[9px] text-[#9C7D46]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                            <circle cx="12" cy="10" r="3" />
                          </svg>
                        </span>
                        <span className="text-[12px] font-bold text-[#3A2E1A] truncate">
                          {order.customerRegion?.name || "منطقة الزبون"}
                        </span>
                      </div>
                    </div>

                    {/* هاتف الزبون */}
                    <div className="flex items-center gap-1.5">
                      <span className="w-[18px] h-[18px] rounded-full bg-[#0A3D2E] flex items-center justify-center shrink-0">
                        <svg className="w-[10px] h-[10px] text-[#E8C77E]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                        </svg>
                      </span>
                      {cleanPhone ? (
                        <AdminCustomerPhoneInteractive
                          phone={customerPhone || order.customerPhone}
                          formattedPhone={cleanPhone}
                          regionId={order.customerRegionId}
                          currentOrderId={order.id}
                          customerName={customerName || order.customer?.name}
                          customerRegionName={order.customerRegion?.name}
                          alternatePhone={order.alternatePhone}
                          customerLocationUrl={order.customerLocationUrl || undefined}
                          customerLandmark={order.customerLandmark || undefined}
                          customerProfileId={order.customerProfileId}
                        />
                      ) : (
                        <span className="text-[12px] font-bold tracking-[0.02em] text-[#0A3D2E]">—</span>
                      )}
                    </div>
                  </div>

                  {/* إطار صورة باب الزبون الملكي الفاخر */}
                  <div className="shrink-0 relative">
                    <div className="relative w-[96px] h-[96px] rounded-[20px] p-[3px] bg-gradient-to-br from-[#E8C77E] to-[#C9A86A] shadow-[0_4px_18px_rgba(201,168,106,0.3)]">
                      <div className="w-full h-full rounded-[17px] bg-gradient-to-br from-[#E8E0C8] via-[#D8CCB0] to-[#C9B997] relative overflow-hidden border border-white/50 flex flex-col items-center justify-center">
                        {imgCustomerDoor ? (
                          /* eslint-disable-next-line @next/next/no-img-element */
                          <img
                            src={imgCustomerDoor}
                            alt="صورة باب الزبون"
                            className="w-full h-full object-cover cursor-pointer hover:scale-105 transition duration-300"
                            onClick={() => {
                              setPreviewImageUrl(imgCustomerDoor);
                              setZoomOpen(true);
                            }}
                          />
                        ) : (
                          <>
                            <div
                              className="absolute inset-0 opacity-[0.15]"
                              style={{
                                backgroundImage: `url("data:image/svg+xml,%3Csvg width='30' height='30' viewBox='0 0 30 30' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M15 0 L16 12 L28 8 L18 15 L28 22 L16 18 L15 30 L14 18 L2 22 L12 15 L2 8 L14 12 Z' fill='%230A3D2E'/%3E%3C/svg%3E")`,
                              }}
                            />
                            <div className="relative z-10 text-center">
                              <div className="w-[32px] h-[32px] mx-auto rounded-[9px] bg-[#0A3D2E]/10 border border-[#0A3D2E]/15 flex items-center justify-center mb-1">
                                <svg className="w-4 h-4 text-[#0A3D2E]/60" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                                </svg>
                              </div>
                              <span className="text-[10px] font-bold text-[#3A2E1A]/80 leading-none">صورة الباب</span>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* أزرار العمليات والتواصل للزبون */}
                <div className="mt-3.5 space-y-2">
                  {/* زر موقع الزبون الكبير الزمردي */}
                  {hasLocation ? (
                    <a
                      href={order.customerLocationUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full h-[40px] rounded-full bg-[#115740] text-white relative overflow-hidden shadow-[0_4px_14px_rgba(17,87,64,0.3),inset_0_1px_0_rgba(255,255,255,0.12)] border border-[#0A3D2E]/20 active:scale-[0.99] transition-transform flex items-center justify-center gap-1.5"
                    >
                      <svg className="w-[14px] h-[14px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                        <circle cx="12" cy="10" r="3" />
                      </svg>
                      <span className="text-[13px] font-bold">موقع الزبون</span>
                    </a>
                  ) : (
                    <div className="w-full h-[40px] rounded-full bg-slate-100 text-slate-400 border border-slate-200 flex items-center justify-center gap-1.5 text-xs font-bold">
                      <svg className="w-3.5 h-3.5 opacity-60" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                      </svg>
                      <span>لا يوجد موقع للزبون</span>
                    </div>
                  )}

                  {/* زري واتس واتصال الزبون */}
                  {cleanPhone && (
                    <div className="grid grid-cols-2 gap-2">
                      <a
                        href={whatsappMeUrl(cleanPhone)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="h-[38px] rounded-full bg-[#115740] text-white flex items-center justify-center gap-1.5 shadow-[0_3px_12px_rgba(17,87,64,0.25)] border border-white/10 active:scale-[0.98] transition-transform"
                      >
                        <svg className="w-[14px] h-[14px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                          <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
                        </svg>
                        <span className="text-[12px] font-bold">واتس</span>
                      </a>

                      <a
                        href={telHref(cleanPhone)}
                        className="h-[38px] rounded-full bg-[#0A3D2E] text-[#E8C77E] flex items-center justify-center gap-1.5 shadow-[0_3px_12px_rgba(10,61,46,0.3)] border border-[#C9A86A]/40 active:scale-[0.98] transition-transform"
                      >
                        <svg className="w-[14px] h-[14px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                          <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                        </svg>
                        <span className="text-[12px] font-bold">اتصال</span>
                      </a>
                    </div>
                  )}

                  {/* زري كاميرا ومعرض صور باب الزبون */}
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => cameraFileRef.current?.click()}
                      className="h-[32px] rounded-full bg-white border border-[#115740]/20 text-[#115740] flex items-center justify-center gap-1 text-[11px] font-bold shadow-xs active:scale-95 transition-all cursor-pointer"
                    >
                      <svg className="w-3 h-3 text-[#115740]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                        <circle cx="12" cy="13" r="4" />
                      </svg>
                      <span>كاميرا</span>
                    </button>

                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => galleryFileRef.current?.click()}
                      className="h-[32px] rounded-full bg-white border border-[#115740]/20 text-[#115740] flex items-center justify-center gap-1 text-[11px] font-bold shadow-xs active:scale-95 transition-all cursor-pointer"
                    >
                      <svg className="w-3 h-3 text-[#115740]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                        <circle cx="8.5" cy="8.5" r="1.5" />
                        <polyline points="21 15 16 10 5 21" />
                      </svg>
                      <span>معرض</span>
                    </button>
                  </div>
                </div>

                {/* قسم الدالة المباشرة والاستدلال والأزرار المخصصة */}
                {children && (
                  <div className="mt-4 space-y-2.5">
                    {children}
                  </div>
                )}
              </>
            )}

            {/* شريط طي / فتح تفاصيل الزبون */}
            <div className="mt-3.5 -mx-3.5 border-t border-[#115740]/10 bg-gradient-to-b from-[#E6F4EF]/60 to-transparent">
              <button
                type="button"
                onClick={() => setIsExpanded(!isExpanded)}
                className="w-full h-[36px] flex items-center justify-center gap-1.5 text-[11px] font-bold text-[#5A7A6E] hover:text-[#0A3D2E] transition-colors cursor-pointer"
              >
                <span>{isExpanded ? "إغلاق تفاصيل الزبون" : "عرض تفاصيل الزبون"}</span>
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

      {/* مودال معاينة وتكبير صورة باب الزبون مع زر المسح */}
      {zoomOpen && imgCustomerDoor && (
        <ImageZoomModal
          imageUrl={imgCustomerDoor}
          onClose={() => setZoomOpen(false)}
          title="صورة باب الزبون"
          uploadedByName={order.customerDoorPhotoUploadedByName}
          onDelete={handleDelete}
          deleteLabel="مسح صورة باب الزبون"
          isDeleting={deleting}
        />
      )}
    </div>
  );
}
