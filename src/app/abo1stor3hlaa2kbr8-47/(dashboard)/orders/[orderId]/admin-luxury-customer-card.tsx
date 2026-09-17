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
import { type OrderCardDesignerConfig } from "@/lib/order-card-customizer";
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
  const landmarkText = (order.customerLandmark || phoneProfile?.landmark || "").trim();

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

      {/* كارت الزبون الملكي الزمردي الفاخر كما في التصميم 3 والصور */}
      <div className="relative rounded-[22px] border-[1.5px] border-[#C9A86A] bg-[#FFFEFB] shadow-[0_6px_20px_rgba(201,168,106,0.12)] overflow-hidden">
        {/* ترويسة الكارت الأرابيسكية */}
        <div className="relative px-3.5 pt-3.5 pb-2.5 bg-gradient-to-b from-[#FDF6E3] to-[#FFFEFB] border-b border-[#C9A86A]/20 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-[30px] h-[30px] rounded-[10px] bg-gradient-to-br from-[#E6F4EF] to-[#CDE7DC] flex items-center justify-center shadow-[0_2px_8px_rgba(17,87,64,0.15)] border border-[#115740]/10">
              <svg className="w-[15px] h-[15px] text-[#115740]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                <polyline points="9 22 9 12 15 12 15 22" />
              </svg>
            </div>
            <div>
              <h2 className="text-[14px] font-black text-[#0A3D2E] leading-none">
                {isDoubleRoute ? "المرسل (الوجهة الأولى)" : "الزبون (المستلم)"}
              </h2>
              <div className="mt-[3px] h-[2px] w-[78px] bg-gradient-to-l from-[#115740]/60 to-transparent rounded-full" />
            </div>
          </div>
        </div>

        {/* محتوى بيانات الزبون */}
        <div className="p-3.5 space-y-3">
          <div className="flex gap-3 items-start">
            <div className="flex-1 min-w-0 flex flex-col gap-2.5">
              {/* شارة المنطقة */}
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#FDF6E3] border border-[#C9A86A]/20 shadow-[inset_0_1px_0_white] self-start">
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

              {/* رقم الهاتف */}
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

              {/* بطاقة أقرب نقطة دالة */}
              <div className="relative rounded-[12px] border-[1.5px] border-[#C9A86A] bg-gradient-to-br from-[#FFF8E1] via-[#FFFEF8] to-[#F6EED7] p-2.5 shadow-[0_2px_8px_rgba(201,168,106,0.12),inset_0_1px_0_white] overflow-hidden w-full min-h-[86px] flex items-center">
                <div className="absolute right-0 top-0 bottom-0 w-[3px] gold-grad" />
                <div className="flex items-start gap-2 w-full pr-1">
                  <span className="w-[22px] h-[22px] rounded-full bg-white border border-[#C9A86A]/30 flex items-center justify-center shadow-[0_1px_3px_rgba(201,168,106,0.15)] shrink-0 mt-[1px]">
                    <svg className="w-[11px] h-[11px] text-[#8B6A2A]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                      <circle cx="12" cy="10" r="3" />
                    </svg>
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-[9px] font-black text-[#8B6A2A]/70 leading-none mb-1 tracking-wide">
                      أقرب نقطة دالة
                    </div>
                    <p className="text-[11px] leading-[1.35] font-bold text-[#3A2E1A] text-right">
                      {landmarkText || "لا توجد نقطة دالة مسجلة بعد"}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* كادر صورة باب الزبون الملكي المتطابق مع التصميم (130px) */}
            <div className="shrink-0 flex flex-col items-center gap-1.5">
              <div
                onClick={() => {
                  if (imgCustomerDoor) {
                    setPreviewImageUrl(imgCustomerDoor);
                    setZoomOpen(true);
                  } else {
                    cameraFileRef.current?.click();
                  }
                }}
                className="relative w-[115px] h-[115px] sm:w-[130px] sm:h-[130px] rounded-[16px] border-[1.5px] border-[#C9A86A] bg-gradient-to-br from-[#FBF6E9] via-[#F6EED8] to-[#EFE2C2] p-[3px] shadow-[0_4px_14px_rgba(201,168,106,0.2),inset_0_1px_0_white] cursor-pointer active:scale-95 transition-all overflow-hidden flex flex-col items-center justify-center"
              >
                {imgCustomerDoor ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={imgCustomerDoor}
                    alt="صورة باب الزبون"
                    className="w-full h-full object-cover rounded-[13px] hover:scale-105 transition duration-300"
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center text-center p-2">
                    <div className="w-[42px] h-[42px] rounded-[12px] bg-[#E6F4EF] border border-[#115740]/20 flex items-center justify-center mb-1.5 shadow-xs">
                      <svg className="w-[22px] h-[22px] text-[#0A3D2E]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                        <polyline points="9 22 9 12 15 12 15 22" />
                      </svg>
                    </div>
                    <span className="text-[11px] font-black text-[#0A3D2E] leading-none">صورة الباب</span>
                  </div>
                )}
              </div>

              {/* أزرار كاميرا ومعرض مصغرة أسفل الصورة للسهولة */}
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => cameraFileRef.current?.click()}
                  className="px-2 py-0.5 rounded-full bg-white border border-[#C9A86A]/40 text-[#8B6A2A] text-[9.5px] font-black shadow-xs hover:bg-[#FDF6E3] active:scale-95 transition cursor-pointer"
                  title="التقاط بالكاميرا"
                >
                  📷 كاميرا
                </button>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => galleryFileRef.current?.click()}
                  className="px-2 py-0.5 rounded-full bg-white border border-[#C9A86A]/40 text-[#8B6A2A] text-[9.5px] font-black shadow-xs hover:bg-[#FDF6E3] active:scale-95 transition cursor-pointer"
                  title="رفع من المعرض"
                >
                  🖼️ معرض
                </button>
              </div>
            </div>
          </div>

          {/* زر فتح لوكيشن الزبون الذهبي الكبير الفاخر كما في التصميم */}
          <div className="space-y-2.5 pt-1">
            {hasLocation ? (
              <a
                href={order.customerLocationUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full h-[44px] rounded-[12px] gold-grad border-[1.5px] border-[#9C7D46]/30 text-[#0A3D2E] font-black text-[13px] shadow-[0_4px_12px_rgba(201,168,106,0.28),inset_0_1px_0_rgba(255,255,255,0.6)] flex items-center justify-center gap-1.5 active:scale-[0.98] transition-transform"
              >
                <svg className="w-4 h-4 text-[#0A3D2E]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                  <circle cx="12" cy="10" r="3" />
                </svg>
                <span>فتح لوكيشن الزبون</span>
              </a>
            ) : (
              <div className="w-full">
                {children}
              </div>
            )}

            {/* زري واتساب واتصال الزبون بالنمط الزمردي الكحلي والمذهب 2 cols */}
            {cleanPhone && (
              <div className="grid grid-cols-2 gap-2.5">
                <a
                  href={whatsappMeUrl(cleanPhone)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="h-[42px] rounded-[12px] bg-[#0A3D2E] border-[1.5px] border-[#C9A86A] text-[#E8C77E] font-black text-[13px] flex items-center justify-center gap-1.5 shadow-[0_3px_10px_rgba(10,61,46,0.25),inset_0_1px_0_rgba(232,199,126,0.15)] active:scale-[0.97] transition-all hover:bg-[#104D3B]"
                >
                  <svg className="w-4 h-4 text-[#E8C77E]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                    <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
                  </svg>
                  <span>واتساب</span>
                </a>

                <a
                  href={telHref(cleanPhone)}
                  className="h-[42px] rounded-[12px] bg-[#0A3D2E] border-[1.5px] border-[#C9A86A] text-[#E8C77E] font-black text-[13px] flex items-center justify-center gap-1.5 shadow-[0_3px_10px_rgba(10,61,46,0.25),inset_0_1px_0_rgba(232,199,126,0.15)] active:scale-[0.97] transition-all hover:bg-[#104D3B]"
                >
                  <svg className="w-4 h-4 text-[#E8C77E]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                  </svg>
                  <span>اتصال</span>
                </a>
              </div>
            )}
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
