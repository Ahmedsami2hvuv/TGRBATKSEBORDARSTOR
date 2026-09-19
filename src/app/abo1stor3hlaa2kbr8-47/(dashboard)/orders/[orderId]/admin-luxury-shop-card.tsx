"use client";

import React, { useRef, useState, useActionState } from "react";
import { useRouter } from "next/navigation";
import { telHref, whatsappMeUrl } from "@/lib/whatsapp";
import {
  uploadShopDoorPhotoFromView,
  deleteShopDoorPhotoAction,
  type CustomerDoorPhotoState,
} from "./customer-door-photo-actions";
import {
  compressImageForMandoubUpload,
  assignFileToInput,
} from "@/lib/client-image-compress";
import { ImageZoomModal } from "@/components/pinch-zoom-image";
import { SwipeableLuxuryPhotoBox } from "./swipeable-luxury-photo-box";

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
  const [zoomOpen, setZoomOpen] = useState(false);

  const cameraFileRef = useRef<HTMLInputElement>(null);
  const galleryFileRef = useRef<HTMLInputElement>(null);

  const [state, formAction, pending] = useActionState(
    uploadShopDoorPhotoFromView.bind(null, order.id),
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
    fd.set("shopDoorPhoto", photoToUpload);
    await formAction(fd);

    if (inputEl) {
      inputEl.value = "";
    }
    router.refresh();
  }

  async function handleDelete() {
    if (!confirm("هل أنت متأكد من مسح صورة المحل؟")) return;
    setDeleting(true);
    try {
      await deleteShopDoorPhotoAction(order.id);
      setZoomOpen(false);
      router.refresh();
    } finally {
      setDeleting(false);
    }
  }

  const cleanPhone = contactLine(order.shop?.phone || submitterPhone || "");
  const rawShopName = order.shop?.name?.trim() || "";
  const rawOwnerName = order.shop?.ownerName?.trim() || "";
  const rawSubmitterName = submitterName?.trim() || "";

  // اسم المحل الأساسي يظهر دائماً كاسم المحل الفعلي
  let shopName = rawShopName;
  if (!shopName || shopName === "—" || shopName === "المحل") {
    if (rawSubmitterName && rawSubmitterName !== "—" && rawSubmitterName !== "المسؤول") {
      shopName = rawSubmitterName;
    } else {
      shopName = isSystemAdminOrder ? "الإدارة" : "المحل";
    }
  }

  // اسم صاحب المحل أو المسؤول يظهر تحته إن وجد وكان مختلفاً
  let ownerName = "";
  if (rawOwnerName && rawOwnerName !== shopName) {
    ownerName = rawOwnerName;
  } else if (rawSubmitterName && rawSubmitterName !== shopName && rawSubmitterName !== "—" && rawSubmitterName !== "الإدارة") {
    ownerName = rawSubmitterName;
  } else if (isSystemAdminOrder && shopName === "الإدارة") {
    ownerName = rawSubmitterName || "المسؤول";
  }

  const regionName = order.shop?.region?.name || "السوق";
  const hasLocation = Boolean(order.shop?.locationUrl && order.shop.locationUrl.trim());

  const cameraInputUniqueId = `shop-door-cam-${order.id}`;
  const galleryInputUniqueId = `shop-door-gal-${order.id}`;

  return (
    <div className="w-full max-w-4xl mx-auto my-0 select-none" dir="rtl">
      {/* مدخلات الملفات للكاميرا والمعرض المربوطة بالأزرار مباشرة كـ Hardware Trigger */}
      <input
        id={cameraInputUniqueId}
        ref={cameraFileRef}
        type="file"
        name="shopDoorPhotoCamera"
        accept="image/*"
        capture="environment"
        className="sr-only"
        onChange={(e) => {
          const file = e.target.files?.[0];
          void handleFileSelected(file, cameraFileRef.current);
        }}
      />
      <input
        id={galleryInputUniqueId}
        ref={galleryFileRef}
        type="file"
        name="shopDoorPhotoGallery"
        accept="image/*"
        className="sr-only"
        onChange={(e) => {
          const file = e.target.files?.[0];
          void handleFileSelected(file, galleryFileRef.current);
        }}
      />

      <div className="relative mt-1 rounded-[20px] border-[2px] border-[#C9A86A] bg-[#FFFEF8] shadow-[0_8px_30px_rgba(0,0,0,0.15),inset_0_1px_0_white,0_0_0_1px_#E8D5A3_inset] overflow-hidden">
        {/* معينات الزوايا */}
        <div className="absolute top-[10px] right-[10px] w-[7px] h-[7px] rotate-45 bg-gradient-to-br from-[#E8C77E] to-[#C9A86A] shadow-[0_1px_4px_rgba(201,168,106,0.4)] pointer-events-none" />
        <div className="absolute top-[10px] left-[10px] w-[7px] h-[7px] rotate-45 bg-gradient-to-br from-[#E8C77E] to-[#C9A86A] shadow-[0_1px_4px_rgba(201,168,106,0.4)] pointer-events-none" />

        {/* ترويسة المحل */}
        <div className="relative p-3.5 pt-5 bg-gradient-to-r from-[#FFFEF8] to-[#FDF6E3] border-b-[1.5px] border-[#E8D5A3]">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[62%] h-[14px] bg-gradient-to-b from-[#FDF6E3] to-transparent rounded-b-[14px] border-x border-b border-[#C9A86A]/15 pointer-events-none" />
          <div className="flex items-center gap-2">
            <div className="w-[30px] h-[30px] rounded-[10px] bg-gradient-to-br from-[#0A3D2E] to-[#115740] flex items-center justify-center shadow-[0_3px_10px_rgba(10,61,46,0.25),inset_0_1px_0_rgba(255,255,255,0.15)] border border-[#C9A86A]/20 shrink-0">
              <svg className="w-[15px] h-[15px] text-[#E8C77E]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
                <path d="M15 22v-4a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v4" />
                <path d="M2 7l4.41-4.41A2 2 0 0 1 7.83 2h8.34a2 2 0 0 1 1.42.59L22 7" />
                <path d="M2 7h20" />
              </svg>
            </div>
            <div>
              <h2 className="text-[14px] font-black text-[#0A3D2E] leading-none">المحل (المرسل)</h2>
              <div className="mt-[3px] h-[2px] w-[78px] bg-gradient-to-l from-[#C9A86A] to-transparent rounded-full" />
            </div>
          </div>
        </div>

        {/* محتوى المحل */}
        <div className="p-3.5">
          <div className="flex gap-3 items-start">
            <div className="flex-1 min-w-0 space-y-2.5">
              <div>
                <div className="text-[16px] font-black text-[#0A3D2E] leading-tight truncate">
                  {shopName}
                </div>
                {ownerName && (
                  <div className="flex items-center gap-1.5 mt-1">
                    <span className="w-[18px] h-[18px] rounded-full bg-[#FDF6E3] border border-[#C9A86A]/30 flex items-center justify-center shrink-0">
                      <svg className="w-[10px] h-[10px] text-[#9C7D46]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
                        <circle cx="12" cy="7" r="4" />
                      </svg>
                    </span>
                    <span className="text-[12px] font-bold text-[#3A4F49] truncate">{ownerName}</span>
                  </div>
                )}
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center gap-1.5 text-[12px] text-[#5A6E68]">
                  <span className="w-[18px] h-[18px] rounded-full bg-[#E6F4EF] flex items-center justify-center shrink-0">
                    <svg className="w-[10px] h-[10px] text-[#115740]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                      <circle cx="12" cy="10" r="3" />
                    </svg>
                  </span>
                  <span className="font-medium">{regionName}</span>
                </div>

                <div className="flex items-center gap-1.5">
                  <span className="w-[18px] h-[18px] rounded-full bg-[#0A3D2E] flex items-center justify-center shrink-0">
                    <svg className="w-[10px] h-[10px] text-[#E8C77E]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                    </svg>
                  </span>
                  <span className="text-[12px] font-bold tracking-[0.02em] text-[#0A3D2E] font-mono [direction:ltr]">
                    {cleanPhone || "—"}
                  </span>
                </div>
              </div>
            </div>

            {/* صورة المحل 130x130 مع زري الكاميرا والمعرض الفاخرين المباشرين */}
            <SwipeableLuxuryPhotoBox
              size={130}
              variant="shop"
              imageUrl={imgShopDoor}
              label="صورة المحل"
              isBusy={pending}
              galleryInputId={galleryInputUniqueId}
              onCameraClick={() => cameraFileRef.current?.click()}
              onGalleryClick={() => galleryFileRef.current?.click()}
              onClickPreview={() => {
                if (imgShopDoor) {
                  setPreviewImageUrl(imgShopDoor);
                  setZoomOpen(true);
                } else {
                  cameraFileRef.current?.click();
                }
              }}
              fallbackIcon={
                <svg className="w-[32px] h-[32px] text-[#E8C77E]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
                  <path d="M15 22v-4a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v4" />
                  <path d="M2 7l4.41-4.41A2 2 0 0 1 7.83 2h8.34a2 2 0 0 1 1.42.59L22 7" />
                  <path d="M2 7h20" />
                </svg>
              }
            />
          </div>

          {/* أزرار موقع المحل وواتس واتصال */}
          <div className="mt-3.5 space-y-2">
            {hasLocation ? (
              <a
                href={order.shop?.locationUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full h-[40px] rounded-full gold-grad relative overflow-hidden shadow-[0_4px_14px_rgba(201,168,106,0.35),inset_0_1px_0_rgba(255,255,255,0.6)] border border-[#9C7D46]/30 active:scale-[0.99] flex items-center justify-center gap-1.5 text-[13px] font-black text-[#0A3D2E]"
              >
                <svg className="w-[14px] h-[14px] text-[#0A3D2E]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                  <circle cx="12" cy="10" r="3" />
                </svg>
                <span>موقع المحل</span>
              </a>
            ) : null}

            {cleanPhone && (
              <div className="grid grid-cols-2 gap-2">
                <a
                  href={whatsappMeUrl(cleanPhone)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="h-[40px] rounded-[12px] bg-[#0A3D2E] border-[1.5px] border-[#C9A86A] text-[#E8C77E] flex items-center justify-center gap-1.5 shadow-[0_3px_10px_rgba(10,61,46,0.2),inset_0_1px_0_rgba(232,199,126,0.15)] active:scale-[0.98] transition hover:bg-[#104D3B]"
                >
                  <svg className="w-[14px] h-[14px] text-[#E8C77E]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                    <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
                  </svg>
                  <span className="text-[12px] font-black">واتس</span>
                </a>

                <a
                  href={telHref(cleanPhone)}
                  className="h-[40px] rounded-[12px] bg-[#0A3D2E] border-[1.5px] border-[#C9A86A] text-[#E8C77E] flex items-center justify-center gap-1.5 shadow-[0_3px_10px_rgba(10,61,46,0.2),inset_0_1px_0_rgba(232,199,126,0.15)] active:scale-[0.98] transition hover:bg-[#104D3B]"
                >
                  <svg className="w-[14px] h-[14px] text-[#E8C77E]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                  </svg>
                  <span className="text-[12px] font-black">اتصال</span>
                </a>
              </div>
            )}
          </div>
        </div>
      </div>

      {zoomOpen && imgShopDoor && (
        <ImageZoomModal
          imageUrl={imgShopDoor}
          onClose={() => setZoomOpen(false)}
          title="صورة المحل"
          uploadedByName={order.shopDoorPhotoUploadedByName}
          onDelete={handleDelete}
          deleteLabel="مسح صورة المحل"
          isDeleting={deleting}
        />
      )}
    </div>
  );
}
