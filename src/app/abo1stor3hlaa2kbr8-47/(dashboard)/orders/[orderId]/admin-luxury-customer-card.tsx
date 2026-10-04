"use client";

import React, { useRef, useState, useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { telHref, whatsappMeUrl, openUrlFromUserGesture } from "@/lib/whatsapp";
import { PhoneActionModal } from "@/components/phone-action-modal";
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
import { SwipeableLuxuryPhotoBox } from "./swipeable-luxury-photo-box";
import { updateOrderLandmarkAction } from "@/app/actions/update-landmark";

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
  customerPhone2,
  imgCustomerDoor,
  setPreviewImageUrl,
  isDoubleRoute = false,
  isSecondDestination = false,
  cardTitle,
  customerRegionName,
  customerRegionId,
  landmark,
  locationUrl,
  alternatePhone,
  customerProfileId,
  doorPhotoUploadedByName,
  designerConfig,
  phoneProfile,
  userRole = "admin",
  headerAction,
  smartHintNode,
  children,
}: {
  order: any;
  customerName?: string;
  customerPhone?: string;
  customerPhone2?: string | null;
  imgCustomerDoor?: string | null;
  setPreviewImageUrl: (url: string | null) => void;
  isDoubleRoute?: boolean;
  isSecondDestination?: boolean;
  cardTitle?: string;
  customerRegionName?: string;
  customerRegionId?: string | null;
  landmark?: string;
  locationUrl?: string;
  alternatePhone?: string | null;
  customerProfileId?: string | null;
  doorPhotoUploadedByName?: string | null;
  designerConfig?: OrderCardDesignerConfig;
  phoneProfile?: any;
  userRole?: "admin" | "mandoub" | "preparer" | string;
  headerAction?: React.ReactNode;
  smartHintNode?: React.ReactNode;
  children?: React.ReactNode;
}) {
  const router = useRouter();
  const [zoomOpen, setZoomOpen] = useState(false);

  // القيم الفعالة للبيانات
  const effectiveName =
    customerName ??
    (isSecondDestination ? order.secondCustomerName || "المستلم" : order.customerName || order.customer?.name || "الزبون");
  const effectivePhone =
    customerPhone ?? (isSecondDestination ? order.secondCustomerPhone : order.customerPhone) ?? "";
  const effectiveRegionName =
    customerRegionName ??
    (isSecondDestination ? order.secondCustomerRegion?.name : order.customerRegion?.name) ??
    (isSecondDestination ? "منطقة المستلم" : "منطقة الزبون");
  const effectiveRegionId =
    customerRegionId !== undefined
      ? customerRegionId
      : isSecondDestination
      ? order.secondCustomerRegionId
      : order.customerRegionId;
  const rawLandmark =
    landmark !== undefined
      ? landmark
      : isSecondDestination
      ? order.secondCustomerLandmark
      : order.customerLandmark || phoneProfile?.landmark;
  const effectiveLocationUrl =
    locationUrl !== undefined
      ? locationUrl
      : isSecondDestination
      ? order.secondCustomerLocationUrl
      : order.customerLocationUrl;
  const effectiveDoorPhoto =
    imgCustomerDoor !== undefined
      ? imgCustomerDoor
      : isSecondDestination
      ? order.secondCustomerDoorPhotoUrl || null
      : order.customerDoorPhotoUrl || null;
  const effectiveAlternatePhone =
    customerPhone2 !== undefined && customerPhone2 !== null
      ? customerPhone2
      : alternatePhone !== undefined && alternatePhone !== null
      ? alternatePhone
      : isSecondDestination
      ? order.secondCustomerPhone2 || order.secondCustomerAlternatePhone || null
      : order.customerPhone2 || order.alternatePhone || phoneProfile?.alternatePhone || null;
  const effectiveProfileId =
    customerProfileId !== undefined
      ? customerProfileId
      : isSecondDestination
      ? order.secondCustomerProfileId
      : order.customerProfileId;
  const effectiveUploaderName =
    doorPhotoUploadedByName ??
    (isSecondDestination
      ? order.secondCustomerDoorPhotoUploadedByName
      : order.customerDoorPhotoUploadedByName);

  const displayTitle =
    cardTitle ||
    (isDoubleRoute
      ? isSecondDestination
        ? "المستلم (الوجهة الثانية)"
        : "المرسل (الوجهة الأولى)"
      : "الزبون (المستلم)");

  // حالات تعديل النقطة الدالة بالنقر المباشر على الكارت
  const [landmarkViewOpen, setLandmarkViewOpen] = useState(false);
  const [landmarkModalOpen, setLandmarkModalOpen] = useState(false);
  const [landmarkTextState, setLandmarkTextState] = useState((rawLandmark || "").trim());
  const [landmarkLoading, setLandmarkLoading] = useState(false);
  const [landmarkError, setLandmarkError] = useState<string | null>(null);
  const landmarkInputRef = useRef<HTMLTextAreaElement>(null);

  const hasLandmarkText = Boolean(landmarkTextState && landmarkTextState.trim().length > 0);

  const handleLandmarkBlockClick = () => {
    if (hasLandmarkText) {
      setLandmarkViewOpen(true);
    } else {
      setLandmarkModalOpen(true);
    }
  };

  useEffect(() => {
    setLandmarkTextState((rawLandmark || "").trim());
  }, [rawLandmark]);

  useEffect(() => {
    if (landmarkModalOpen) {
      setTimeout(() => {
        if (landmarkInputRef.current) {
          landmarkInputRef.current.focus();
          landmarkInputRef.current.selectionStart = landmarkInputRef.current.value.length;
          landmarkInputRef.current.selectionEnd = landmarkInputRef.current.value.length;
        }
      }, 50);
    }
  }, [landmarkModalOpen]);

  async function handleSaveLandmark() {
    if (landmarkLoading) return;
    setLandmarkLoading(true);
    setLandmarkError(null);
    try {
      const res = await updateOrderLandmarkAction(
        order.id,
        landmarkTextState.trim(),
        isSecondDestination
      );
      if (res.error) {
        setLandmarkError(res.error);
      } else {
        setLandmarkModalOpen(false);
        router.refresh();
      }
    } catch (err: any) {
      setLandmarkError(err.message || "حدث خطأ أثناء حفظ النقطة الدالة");
    } finally {
      setLandmarkLoading(false);
    }
  }

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
    if (isSecondDestination) {
      fd.set("target", "second");
    } else {
      fd.set("target", "first");
    }
    await formAction(fd);

    if (inputEl) {
      inputEl.value = "";
    }
    router.refresh();
  }

  async function handleDelete() {
    const photoTitle = isSecondDestination ? "صورة باب المستلم" : "صورة باب الزبون";
    if (!confirm(`هل أنت متأكد من مسح ${photoTitle}؟`)) return;
    setDeleting(true);
    try {
      await deleteCustomerDoorPhotoAction(order.id, isSecondDestination);
      setZoomOpen(false);
      router.refresh();
    } finally {
      setDeleting(false);
    }
  }

  const hasLocation = Boolean(effectiveLocationUrl && effectiveLocationUrl.trim());
  const cleanPhone = contactLine(effectivePhone);
  const cleanPhone2 = contactLine(effectiveAlternatePhone || "");
  const hasMultiplePhones = Boolean(
    cleanPhone &&
    cleanPhone2 &&
    cleanPhone !== cleanPhone2 &&
    cleanPhone.replace(/\D/g, "") !== cleanPhone2.replace(/\D/g, "")
  );

  const [activePhoneModal, setActivePhoneModal] = useState<{
    type: "whatsapp" | "call";
    phone1: string;
    phone2: string;
  } | null>(null);

  const handleWhatsappClick = (e: React.MouseEvent) => {
    if (hasMultiplePhones) {
      e.preventDefault();
      setActivePhoneModal({
        type: "whatsapp",
        phone1: cleanPhone,
        phone2: cleanPhone2,
      });
      return;
    }
    const target = cleanPhone || cleanPhone2;
    if (target) {
      const url = whatsappMeUrl(target);
      if (url && url !== "#") {
        openUrlFromUserGesture(url);
      }
    }
  };

  const handleCallClick = (e: React.MouseEvent) => {
    if (hasMultiplePhones) {
      e.preventDefault();
      setActivePhoneModal({
        type: "call",
        phone1: cleanPhone,
        phone2: cleanPhone2,
      });
      return;
    }
    const target = cleanPhone || cleanPhone2;
    if (target) {
      window.location.href = telHref(target);
    }
  };

  const cameraInputUniqueId = `cust-door-cam-${order.id}-${isSecondDestination ? "second" : "first"}`;
  const galleryInputUniqueId = `cust-door-gal-${order.id}-${isSecondDestination ? "second" : "first"}`;

  return (
    <div className="w-full max-w-4xl mx-auto my-0 select-none" dir="rtl">
      {/* مدخلات الملفات للكاميرا والمعرض المربوطة بالأزرار مباشرة كـ Hardware Trigger */}
      <input
        id={cameraInputUniqueId}
        ref={cameraFileRef}
        type="file"
        name={isSecondDestination ? "secondCustomerDoorPhotoCamera" : "customerDoorPhotoCamera"}
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
        name={isSecondDestination ? "secondCustomerDoorPhotoGallery" : "customerDoorPhotoGallery"}
        accept="image/*"
        className="fixed -top-[9999px] -left-[9999px] opacity-0 pointer-events-none w-[1px] h-[1px]"
        onChange={(e) => {
          const file = e.target.files?.[0];
          void handleFileSelected(file, galleryFileRef.current);
        }}
      />

      {/* كارت الزبون الملكي الزمردي الفاخر كما في التصميم 3 والصور */}
      <div className="relative rounded-[22px] border-[1.5px] border-[#38BDF8]/40 bg-[#FFFFFF] shadow-[0_6px_20px_rgba(2,132,199,0.08)] overflow-hidden">
        {/* ترويسة الكارت الأرابيسكية */}
        <div className="relative px-3.5 pt-3.5 pb-2.5 bg-gradient-to-b from-[#F0F9FF] to-[#FFFFFF] border-b border-[#38BDF8]/20 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-[30px] h-[30px] rounded-[10px] bg-gradient-to-br from-[#E0F2FE] to-[#BAE6FD] flex items-center justify-center shadow-[0_2px_8px_rgba(2,132,199,0.15)] border border-[#0284C7]/20 shrink-0">
              <svg className="w-[15px] h-[15px] text-[#0284C7]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                <polyline points="9 22 9 12 15 12 15 22" />
              </svg>
            </div>
            <div className="min-w-0">
              <h2 className="text-[14px] font-black text-[#0369A1] leading-none truncate">
                {displayTitle}
              </h2>
              <div className="mt-[3px] h-[2px] w-[78px] bg-gradient-to-l from-[#0284C7]/60 to-transparent rounded-full" />
            </div>
          </div>

          {/* زر تفاصيل أخرى أو أي إجراءات بالترويسة */}
          {headerAction ? (
            <div className="shrink-0 flex items-center">
              {headerAction}
            </div>
          ) : null}
        </div>

        {/* محتوى بيانات الزبون */}
        <div className="p-3.5 space-y-3">
          <div className="flex gap-3 items-start">
            <div className="flex-1 min-w-0 flex flex-col gap-2">
              {/* اسم الزبون إن وجد */}
              {effectiveName && effectiveName !== "الزبون" && effectiveName !== "المستلم" && effectiveName !== "—" && (
                <div className="text-[15px] font-black text-[#0F172A] leading-tight truncate">
                  {effectiveName}
                </div>
              )}

              {/* شارة المنطقة */}
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#F0F9FF] border border-[#38BDF8]/30 shadow-[inset_0_1px_0_white] self-start">
                <span className="w-[16px] h-[16px] rounded-full bg-white border border-[#38BDF8]/40 flex items-center justify-center shrink-0">
                  <svg className="w-[9px] h-[9px] text-[#0284C7]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                    <circle cx="12" cy="10" r="3" />
                  </svg>
                </span>
                <span className="text-[12px] font-bold text-[#0369A1] truncate">
                  {effectiveRegionName}
                </span>
              </div>

              {/* أرقام الهواتف (الأساسي والبديل إن وجد) */}
              <div className="flex flex-col gap-1.5 w-full">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="w-[18px] h-[18px] rounded-full bg-[#0284C7] flex items-center justify-center shrink-0">
                    <svg className="w-[10px] h-[10px] text-[#FDE047]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                    </svg>
                  </span>
                  {cleanPhone ? (
                    <div className="flex items-center gap-1 flex-wrap">
                      {hasMultiplePhones && (
                        <span className="text-[10px] font-black text-[#0284C7] px-1.5 py-0.5 rounded-[6px] bg-[#E0F2FE] border border-[#0284C7]/20 shadow-xs">
                          1️⃣ أساسي
                        </span>
                      )}
                      <AdminCustomerPhoneInteractive
                        phone={effectivePhone}
                        formattedPhone={cleanPhone}
                        regionId={effectiveRegionId}
                        currentOrderId={order.id}
                        customerName={effectiveName}
                        customerRegionName={effectiveRegionName}
                        alternatePhone={effectiveAlternatePhone}
                        customerLocationUrl={effectiveLocationUrl || undefined}
                        customerLandmark={landmarkTextState || undefined}
                        customerProfileId={effectiveProfileId}
                        userRole={userRole}
                      />
                    </div>
                  ) : (
                    <span className="text-[12px] font-bold tracking-[0.02em] text-[#0369A1]">—</span>
                  )}
                </div>

                {hasMultiplePhones && (
                  <div className="flex items-center gap-1.5 flex-wrap pr-[22px]">
                    <span className="text-[10px] font-black text-[#854D0E] px-1.5 py-0.5 rounded-[6px] bg-[#FEF08A]/60 border border-[#FACC15]/50 shadow-xs">
                      2️⃣ بديل
                    </span>
                    <AdminCustomerPhoneInteractive
                      phone={cleanPhone2}
                      formattedPhone={cleanPhone2}
                      regionId={effectiveRegionId}
                      currentOrderId={order.id}
                      customerName={effectiveName}
                      customerRegionName={effectiveRegionName}
                      alternatePhone={effectivePhone}
                      customerLocationUrl={effectiveLocationUrl || undefined}
                      customerLandmark={landmarkTextState || undefined}
                      customerProfileId={effectiveProfileId}
                      userRole={userRole}
                    />
                  </div>
                )}
              </div>

              {/* بطاقة أقرب نقطة دالة - قابلة للنقر والتعديل المباشر */}
              <div
                onClick={handleLandmarkBlockClick}
                title={hasLandmarkText ? "انقر لقراءة النقطة الدالة بخط كبير" : "انقر لإضافة أقرب نقطة دالة"}
                className="group relative rounded-[14px] border-[1.5px] border-[#38BDF8]/50 bg-gradient-to-br from-[#F0F9FF] via-[#FFFFFF] to-[#E0F2FE]/50 p-2.5 shadow-[0_2px_8px_rgba(2,132,199,0.08),inset_0_1px_0_white] hover:shadow-[0_4px_14px_rgba(2,132,199,0.2)] hover:border-[#0284C7] active:scale-[0.99] transition-all overflow-hidden w-full min-h-[76px] flex items-center cursor-pointer"
              >
                <div className="absolute right-0 top-0 bottom-0 w-[3px] bg-gradient-to-b from-[#0284C7] to-[#38BDF8]" />
                <div className="flex items-start gap-2.5 w-full pr-1">
                  <span className="w-[24px] h-[24px] rounded-full bg-white border border-[#38BDF8]/40 flex items-center justify-center shadow-[0_1px_3px_rgba(2,132,199,0.15)] shrink-0 mt-[2px] group-hover:bg-[#F0F9FF] transition">
                    <svg className="w-3.5 h-3.5 text-[#0284C7]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3">
                      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                      <circle cx="12" cy="10" r="3" />
                    </svg>
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-[10px] font-bold text-[#0369A1]/70 leading-none mb-1">
                      ن داله
                    </div>
                    <p className="text-[15px] sm:text-[17px] leading-tight font-black text-[#0369A1] text-right break-words">
                      {landmarkTextState || "لا توجد نقطة دالة (انقر للإضافة)"}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* صورة باب الزبون/المستلم 130x130 مع زري الكاميرا والمعرض الفاخرين المباشرين */}
            <SwipeableLuxuryPhotoBox
              size={130}
              variant="customer"
              imageUrl={effectiveDoorPhoto}
              label={isSecondDestination ? "باب المستلم" : "صورة الباب"}
              isBusy={pending}
              cameraInputId={cameraInputUniqueId}
              galleryInputId={galleryInputUniqueId}
              onCameraClick={() => cameraFileRef.current?.click()}
              onGalleryClick={() => galleryFileRef.current?.click()}
              onClickPreview={() => {
                if (effectiveDoorPhoto) {
                  setPreviewImageUrl(effectiveDoorPhoto);
                  setZoomOpen(true);
                } else {
                  cameraFileRef.current?.click();
                }
              }}
              fallbackIcon={
                <svg className="w-[28px] h-[28px] text-[#0284C7]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                  <polyline points="9 22 9 12 15 12 15 22" />
                </svg>
              }
            />
          </div>

          {/* زر فتح لوكيشن الزبون الذهبي الفاخر بارتفاع متناسق مع زر تبليغ الزبون بجانبه أو أزرار اللوكيشن */}
          <div className="space-y-2.5 pt-1">
            {hasLocation ? (
              <div className="grid grid-cols-2 gap-2.5 items-center">
                <a
                  href={effectiveLocationUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full h-[42px] max-h-[42px] rounded-[12px] bg-gradient-to-r from-[#0284C7] via-[#0369A1] to-[#0284C7] border-[1.5px] border-[#38BDF8] text-white font-black text-[13px] shadow-[0_4px_14px_rgba(2,132,199,0.35),inset_0_1px_0_rgba(255,255,255,0.4)] flex items-center justify-center gap-1.5 active:scale-[0.98] transition-transform overflow-hidden px-2"
                >
                  <svg className="w-4 h-4 text-[#FDE047] shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                    <circle cx="12" cy="10" r="3" />
                  </svg>
                  <span className="truncate">
                    {isSecondDestination
                      ? "فتح لوكيشن المستلم"
                      : isDoubleRoute
                      ? "فتح لوكيشن المرسل"
                      : "فتح لوكيشن الزبون"}
                  </span>
                </a>
                <div className="w-full flex items-center">{children}</div>
              </div>
            ) : (
              <div className="w-full">
                {children}
              </div>
            )}

            {/* زري واتساب واتصال الزبون بالنمط الزمردي الكحلي والمذهب 2 cols مع دعم الرقمين */}
            {(cleanPhone || cleanPhone2) && (
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={handleWhatsappClick}
                  className="h-[42px] rounded-[12px] bg-gradient-to-r from-[#0284C7] to-[#0369A1] border-[1.5px] border-[#38BDF8] text-[#FDE047] font-black text-[13px] flex items-center justify-center gap-1.5 shadow-[0_3px_10px_rgba(2,132,199,0.3),inset_0_1px_0_rgba(255,255,255,0.25)] active:scale-[0.97] transition-all hover:bg-[#075985] cursor-pointer"
                >
                  <svg className="w-4 h-4 text-[#FDE047]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                    <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
                  </svg>
                  <span>واتساب</span>
                  {hasMultiplePhones && (
                    <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-[#FDE047] text-[#0369A1] font-black leading-none shadow-xs">
                      2
                    </span>
                  )}
                </button>

                <button
                  type="button"
                  onClick={handleCallClick} className="h-[42px] rounded-[12px] bg-gradient-to-r from-[#0284C7] to-[#0369A1] border-[1.5px] border-[#38BDF8] text-white font-black text-[13px] flex items-center justify-center gap-1.5 shadow-[0_3px_10px_rgba(2,132,199,0.3),inset_0_1px_0_rgba(255,255,255,0.25)] active:scale-[0.97] transition-all hover:bg-[#075985] cursor-pointer"
                >
                  <svg className="w-4 h-4 text-[#FDE047]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                  </svg>
                  <span>اتصال</span>
                  {hasMultiplePhones && (
                    <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-[#FDE047] text-[#0369A1] font-black leading-none shadow-xs">
                      2
                    </span>
                  )}
                </button>
              </div>
            )}

            {/* بلوك الاستدلال الذكي المضيء في موقعه المستقل بكامل العرض */}
            {smartHintNode ? (
              <div className="pt-1 w-full">
                {smartHintNode}
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {/* نافذة عرض أقرب نقطة دالة بخط ضخم ومريح للقراءة */}
      {landmarkViewOpen && (
        <div
          className="fixed inset-0 z-[140] flex items-center justify-center p-3 sm:p-5 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200 overflow-y-auto"
          onClick={() => setLandmarkViewOpen(false)}
        >
          <div
            className="w-full max-w-xl bg-white rounded-[24px] border-[2px] border-[#38BDF8] p-5 sm:p-7 shadow-2xl text-right animate-in zoom-in-95 duration-200 relative overflow-hidden flex flex-col max-h-[90vh] my-auto"
            onClick={(e) => e.stopPropagation()}
            dir="rtl"
          >
            {/* الترويسة */}
            <div className="flex items-center justify-between border-b border-[#38BDF8]/20 pb-4 mb-4 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[#E0F2FE] to-[#BAE6FD] flex items-center justify-center border border-[#0284C7]/20 text-[#0284C7] shadow-sm shrink-0">
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3">
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                    <circle cx="12" cy="10" r="3" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-black text-[#0369A1] leading-none">
                    أقرب نقطة دالة ({isSecondDestination ? "المستلم" : "المرسل"})
                  </h3>
                  <p className="mt-1 text-xs font-semibold text-slate-500">
                    يمكنك قراءة النص بوضوح أو النقر على تعديل
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setLandmarkViewOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold flex items-center justify-center cursor-pointer text-sm transition-colors"
                title="إغلاق"
              >
                ✕
              </button>
            </div>

            {/* نص النقطة الدالة بخط ضخم */}
            <div className="overflow-y-auto py-4 sm:py-6 flex-1 px-1">
              <div className="rounded-[20px] bg-gradient-to-br from-[#F0F9FF] to-[#E0F2FE]/40 border-2 border-[#38BDF8]/40 p-5 sm:p-7 shadow-inner">
                <p className="text-2xl sm:text-3xl md:text-4xl font-black text-[#075985] text-center leading-[1.8] break-words whitespace-pre-wrap select-text">
                  {landmarkTextState}
                </p>
              </div>
            </div>

            {/* أزرار الإجراءات في الأسفل */}
            <div className="flex items-center justify-end gap-2.5 pt-4 mt-2 border-t border-[#38BDF8]/20 shrink-0">
              <button
                type="button"
                onClick={() => setLandmarkViewOpen(false)}
                className="px-5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs sm:text-sm active:scale-95 transition-all cursor-pointer"
              >
                إغلاق
              </button>
              <button
                type="button"
                onClick={() => {
                  setLandmarkViewOpen(false);
                  setLandmarkModalOpen(true);
                }}
                className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-[#0284C7] to-[#0369A1] hover:from-[#0369A1] hover:to-[#075985] border border-[#38BDF8] text-white font-black text-xs sm:text-sm shadow-md active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                </svg>
                <span>تعديل</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* نافذة تعديل أقرب نقطة دالة المنبثقة */}
      {landmarkModalOpen && (
        <div
          className="fixed inset-0 z-[140] flex items-center justify-center p-3 sm:p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => {
            if (!landmarkLoading) setLandmarkModalOpen(false);
          }}
        >
          <div
            className="w-full max-w-md rounded-[20px] border-[2px] border-[#38BDF8] bg-[#FFFFFF] p-4 sm:p-5 shadow-2xl text-right animate-in zoom-in-95 duration-200 relative overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-[#38BDF8]/20 pb-3 mb-3">
              <h4 className="text-sm sm:text-base font-black text-[#0369A1] flex items-center gap-2">
                <svg className="w-4 h-4 text-[#0284C7]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3">
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                  <circle cx="12" cy="10" r="3" />
                </svg>
                <span>تعديل أقرب نقطة دالة ({isSecondDestination ? "المستلم" : "المرسل"})</span>
              </h4>
              <button
                type="button"
                onClick={() => setLandmarkModalOpen(false)}
                className="w-7 h-7 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold flex items-center justify-center cursor-pointer text-xs"
              >
                ✕
              </button>
            </div>

            {landmarkError && (
              <div className="mb-3 p-2 bg-rose-50 border border-rose-200 rounded-xl text-xs font-bold text-rose-700">
                {landmarkError}
              </div>
            )}

            <div className="space-y-2">
              <label className="text-xs font-bold text-[#0369A1] block">نص النقطة الدالة:</label>
              <textarea
                ref={landmarkInputRef}
                rows={3}
                value={landmarkTextState}
                onChange={(e) => setLandmarkTextState(e.target.value)}
                placeholder="اكتب أقرب نقطة دالة بالتفصيل..."
                className="w-full rounded-xl border border-[#38BDF8]/60 bg-white p-3 text-sm sm:text-base font-bold text-[#0369A1] focus:outline-none focus:ring-2 focus:ring-[#0284C7]/30 resize-none shadow-inner leading-relaxed"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 mt-2 border-t border-[#38BDF8]/20">
              <button
                type="button"
                onClick={() => setLandmarkModalOpen(false)}
                disabled={landmarkLoading}
                className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 font-bold text-xs hover:bg-slate-200 cursor-pointer"
              >
                إلغاء
              </button>

              <button
                type="button"
                onClick={handleSaveLandmark}
                disabled={landmarkLoading}
                className="px-5 py-2 rounded-xl bg-gradient-to-r from-[#0284C7] to-[#0369A1] border border-[#38BDF8] text-white font-black text-xs shadow-md active:scale-95 transition cursor-pointer flex items-center gap-1.5"
              >
                {landmarkLoading ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>جاري الحفظ...</span>
                  </>
                ) : (
                  <span>حفظ النقطة الدالة</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* مودال معاينة وتكبير صورة باب الزبون/المستلم مع زر المسح */}
      {zoomOpen && effectiveDoorPhoto && (
        <ImageZoomModal
          imageUrl={effectiveDoorPhoto}
          onClose={() => setZoomOpen(false)}
          title={isSecondDestination ? "صورة باب المستلم" : "صورة باب الزبون"}
          uploadedByName={effectiveUploaderName}
          onDelete={handleDelete}
          deleteLabel={isSecondDestination ? "مسح صورة باب المستلم" : "مسح صورة باب الزبون"}
          isDeleting={deleting}
        />
      )}

      {/* نافذة اختيار الرقم عند الاتصال أو المراسلة للزبائن ذوي الرقمين */}
      {activePhoneModal && (
        <PhoneActionModal
          type={activePhoneModal.type}
          phone1={activePhoneModal.phone1}
          phone2={activePhoneModal.phone2}
          onClose={() => setActivePhoneModal(null)}
        />
      )}
    </div>
  );
}
