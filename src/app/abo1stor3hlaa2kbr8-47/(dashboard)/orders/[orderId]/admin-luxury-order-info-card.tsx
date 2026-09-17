"use client";

import React, { useRef, useState, useActionState } from "react";
import { useRouter } from "next/navigation";
import { OrderTypeDetailBlock } from "@/components/order-type-line";
import { formatDinarAsAlf, formatDinarAsAlfWithUnit } from "@/lib/money-alf";
import { resolvePublicAssetSrc } from "@/lib/image-url";
import { ImageUploaderCaption } from "@/components/image-uploader-caption";
import { ImageZoomModal } from "@/components/pinch-zoom-image";
import {
  type OrderCardDesignerConfig,
  type CustomElementConfig,
  getElementStyle,
  getCardContainerStyle,
  RenderCustomElementsLayer,
} from "@/lib/order-card-customizer";
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
  isDesignMode = false,
  selectedElementKey,
  onSelectElement,
}: {
  order: any;
  setPreviewImageUrl: (url: string | null) => void;
  designerConfig?: OrderCardDesignerConfig;
  auth?: { c: string; exp: string; s: string };
  nextUrl?: string;
  hideSubtotalInfo?: boolean;
  isMandoubPortal?: boolean;
  isDesignMode?: boolean;
  selectedElementKey?: string;
  onSelectElement?: (key: string, cardType: "orderInfoCard") => void;
}) {
  const router = useRouter();
  const [isExpanded, setIsExpanded] = useState(true);
  const [zoomOpen, setZoomOpen] = useState(false);
  const [compressing, setCompressing] = useState(false);

  // مراجع رفع الصور للكاميرا والمعرض
  const cameraFileRef = useRef<HTMLInputElement>(null);
  const galleryFileRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const [, formAction, pending] = useActionState(uploadMandoubOrderImage, {});

  const orderImageUrl = resolvePublicAssetSrc(order.imageUrl);
  const infoCustom = designerConfig?.orderInfoCard;

  // دالة تغليف كل عنصر في كارت الطلبية لجعله قابلاً للنقر والتحديد الفوري في وضع التعديل المباشر
  const wrapInteractive = (elemKey: string, title: string, element: React.ReactNode, cfg?: CustomElementConfig, containerClassName = "") => {
    if (!isDesignMode) return element;
    const isSelected = selectedElementKey === elemKey;
    return (
      <div
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (onSelectElement) {
            onSelectElement(elemKey, "orderInfoCard");
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

  // الحسابات المالية (سعر البضاعة + التوصيل + الدين + الإجمالي)
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

  const calculatedDebt = totalVal - (subtotalVal + deliveryVal);
  const hasDebt = calculatedDebt > 0;

  // معالجة اختيار ورفع ملف الصورة
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

  return (
    <div
      className="relative overflow-hidden transition-all duration-300 select-none"
      style={{
        width: "100%",
        maxWidth: "100%",
        direction: "rtl",
      }}
    >
      <div
        className="w-full relative shadow-2xl rounded-[22px] sm:rounded-[26px] md:rounded-[30px] border-2 border-[#C9A86A] bg-cover bg-center bg-no-repeat p-2 sm:p-3.5 md:p-4.5"
        style={{
          ...getCardContainerStyle(
            infoCustom?.frameConfig,
            infoCustom?.frameBgUrl || "/images/order-luxury/order-info-card/order-info-frame.jpg"
          ),
          backgroundColor: "#06281D",
        }}
      >
        {/* طبقة العناصر والنصوص والصور المخصصة المضافة */}
        <RenderCustomElementsLayer
          elements={infoCustom?.customElements}
          context={{
            order,
            onZoomImage: (url, title) => {
              setPreviewImageUrl(url);
            },
          }}
        />

        {/* طبقة تظليل زمردية ناعمة لضمان قراءة النصوص والألوان الذهبية */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#06281D]/80 via-[#0A3D2E]/60 to-[#06281D]/85 pointer-events-none rounded-[20px] sm:rounded-[24px]" />

        <div className="relative z-10 flex flex-col gap-2">
          {/* سطر الرأس الملكي: تفاصيل الطلب مع زر طي/فتح البردة */}
          <div className="flex items-center justify-between border-b border-[#C9A86A]/40 pb-1.5 sm:pb-2">
            {/* يمين الرأس: عنوان معلومات الطلب */}
            {wrapInteractive(
              "headerInfo",
              "رأس كارت الطلبية",
              <div className="flex items-center gap-1.5 sm:gap-2 min-w-0" style={getElementStyle(infoCustom?.headerInfo)}>
                {wrapInteractive(
                  "iconOrderBox",
                  "أيقونة نوع الطلب",
                  <div className="shrink-0 w-fit inline-flex">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={infoCustom?.iconOrderBox?.imageUrl || "/images/order-luxury/order-info-card/icon-order-box.jpg"}
                      alt="تفاصيل الطلب"
                      style={getElementStyle(infoCustom?.iconOrderBox)}
                      className="w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 rounded-lg object-contain border border-[#C9A86A]/70 shadow-sm transition-transform"
                    />
                  </div>,
                  infoCustom?.iconOrderBox
                )}
                <h3 className="font-black text-xs sm:text-sm md:text-base text-[#F5D77F] drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)] truncate">
                  تفاصيل الطلبية والمبالغ
                </h3>
              </div>,
              infoCustom?.headerInfo
            )}

            {/* يسار الرأس: عنوان صورة الطلبية مع زر طي البردة */}
            <div className="flex items-center gap-2">
              <div className="hidden sm:inline-flex items-center gap-1" style={getElementStyle(infoCustom?.headerPhoto)}>
                <span className="font-black text-[11px] sm:text-xs text-[#F5D77F]/90">
                  صورة الطلبية
                </span>
              </div>
              <button
                type="button"
                onClick={() => !isDesignMode && setIsExpanded((prev) => !prev)}
                className="inline-flex items-center gap-1 bg-[#0F4D3A] hover:bg-[#165B45] border border-[#C9A86A] text-[10px] sm:text-xs font-black text-[#F5D77F] px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-xl shadow-sm transition-all active:scale-95 cursor-pointer"
                title={isExpanded ? "طي تفاصيل الطلب" : "فتح تفاصيل الطلب"}
              >
                <span>{isExpanded ? "▲ طي" : "▼ فتح"}</span>
              </button>
            </div>
          </div>

          {/* محتوى الكارت القابل للتوسيع والطي */}
          {isExpanded && (
            <div className="grid grid-cols-[1fr_auto] gap-2 sm:gap-3.5 items-stretch pt-0.5">
              {/* الجهة اليمنى: نوع الطلب + الوقت + تفاصيل الأسعار والمبالغ */}
              <div className="flex flex-col justify-between space-y-2 min-w-0">
                
                {/* سطر 1: نوع الطلب */}
                <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap min-w-0">
                  <span className="text-[11px] sm:text-xs font-bold text-[#FFF8F0]/80 shrink-0">
                    نوع الطلب:
                  </span>
                  {wrapInteractive(
                    "textOrderType",
                    "نص نوع الطلب",
                    <div style={getElementStyle(infoCustom?.textOrderType)} className="w-fit inline-flex min-w-0">
                      <OrderTypeDetailBlock
                        orderType={order.orderType}
                        prefixClassName="font-black text-[#06281D] bg-gradient-to-r from-[#F5D77F] via-[#E5C158] to-[#C9A86A] px-2 py-0.5 rounded-lg text-[10px] sm:text-xs font-black shadow-md inline-block"
                        restClassName="text-[11px] sm:text-xs font-black text-[#FFF8F0]"
                      />
                    </div>,
                    infoCustom?.textOrderType
                  )}
                </div>

                {/* سطر 2: وقت الطلب / وقت الاستلام */}
                {wrapInteractive(
                  "textOrderTime",
                  "وقت الطلب",
                  <div className="flex items-center gap-1.5 sm:gap-2 min-w-0" style={getElementStyle(infoCustom?.textOrderTime)}>
                    {wrapInteractive(
                      "iconClock",
                      "أيقونة التوقيت",
                      <div className="shrink-0 w-fit inline-flex">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={infoCustom?.iconClock?.imageUrl || "/images/order-luxury/order-info-card/icon-order-clock.jpg"}
                          alt="وقت الطلب"
                          style={getElementStyle(infoCustom?.iconClock)}
                          className="w-4.5 h-4.5 sm:w-5 sm:h-5 rounded-full object-contain border border-[#C9A86A]/60 shadow-xs"
                        />
                      </div>,
                      infoCustom?.iconClock
                    )}
                    <span className="text-[11px] sm:text-xs font-bold text-[#FFF8F0]/80 shrink-0">
                      وقت الطلب:
                    </span>
                    <span className="font-black text-[11px] sm:text-xs text-[#F5D77F] bg-[#0F4D3A] px-2 py-0.5 rounded-lg border border-[#C9A86A]/40 shadow-inner">
                      {order.orderNoteTime || "فوري"}
                    </span>
                  </div>,
                  infoCustom?.textOrderTime
                )}

                {/* سطر 3: بطاقات المبالغ الفرعية (سعر الطلب والتوصيل والدين) */}
                {!hideSubtotalInfo && (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 sm:gap-2 pt-0.5">
                    {/* سعر البضاعة */}
                    {wrapInteractive(
                      "blockSubtotal",
                      "بلوك سعر المواد",
                      <div
                        style={getElementStyle(infoCustom?.blockSubtotal)}
                        className="flex flex-col gap-0.5 rounded-xl border border-[#C9A86A]/50 bg-[#06281D]/90 p-1.5 shadow-inner"
                      >
                        <span className="text-[9px] sm:text-[10px] font-bold text-[#FFF8F0]/70">
                          سعر البضاعة:
                        </span>
                        <span className="font-mono font-black text-xs sm:text-sm text-[#F5D77F] tabular-nums">
                          {order.orderSubtotal != null ? `${formatDinarAsAlf(order.orderSubtotal)} الف` : "0"}
                        </span>
                      </div>,
                      infoCustom?.blockSubtotal
                    )}

                    {/* سعر التوصيل */}
                    {wrapInteractive(
                      "blockDelivery",
                      "بلوك أجور التوصيل",
                      <div
                        style={getElementStyle(infoCustom?.blockDelivery)}
                        className="flex flex-col gap-0.5 rounded-xl border border-[#C9A86A]/50 bg-[#06281D]/90 p-1.5 shadow-inner"
                      >
                        <span className="text-[9px] sm:text-[10px] font-bold text-[#FFF8F0]/70">
                          التوصيل:
                        </span>
                        <span className="font-mono font-black text-xs sm:text-sm text-[#F5D77F] tabular-nums">
                          {order.deliveryPrice != null ? `${formatDinarAsAlf(order.deliveryPrice)} الف` : "0"}
                        </span>
                      </div>,
                      infoCustom?.blockDelivery
                    )}

                    {/* الدين إن وجد */}
                    {hasDebt && (
                      wrapInteractive(
                        "blockDebt",
                        "بلوك الديون",
                        <div
                          style={getElementStyle(infoCustom?.blockDebt)}
                          className="col-span-2 sm:col-span-1 flex flex-col gap-0.5 rounded-xl border-2 border-rose-400 bg-rose-950/80 p-1.5 shadow-md animate-pulse"
                        >
                          <span className="text-[9px] sm:text-[10px] font-bold text-rose-300">
                            الدين:
                          </span>
                          <span className="font-mono font-black text-xs sm:text-sm text-rose-200 tabular-nums">
                            {`${formatDinarAsAlf(calculatedDebt)} الف`}
                          </span>
                        </div>,
                        infoCustom?.blockDebt
                      )
                    )}
                  </div>
                )}

                {/* سطر 4: المبلغ الكلي المطلوب أو شارة كل شي واصل */}
                {wrapInteractive(
                  "blockTotal",
                  "بلوك الحساب الكلي",
                  <div
                    style={getElementStyle(infoCustom?.blockTotal)}
                    className={`rounded-xl border-2 p-2 sm:p-2.5 shadow-lg flex items-center justify-between gap-2 mt-1 ${
                      order.prepaidAll
                        ? "border-[#C9A86A] bg-gradient-to-r from-[#0F4D3A] via-[#165B45] to-[#0F4D3A] text-[#F5D77F]"
                        : "border-[#C9A86A] bg-gradient-to-r from-[#06281D] via-[#0A3D2E] to-[#06281D] text-[#F5D77F]"
                    }`}
                  >
                    <div className="flex items-center gap-1.5">
                      {wrapInteractive(
                        "iconCoins",
                        "أيقونة المبلغ الكلي",
                        <div className="shrink-0 w-fit inline-flex">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={infoCustom?.iconCoins?.imageUrl || "/images/order-luxury/order-info-card/icon-order-coins.jpg"}
                            alt="المبلغ الكلي"
                            style={getElementStyle(infoCustom?.iconCoins)}
                            className="w-5 h-5 sm:w-6 sm:h-6 rounded-full object-contain border border-[#C9A86A]/60 shadow-xs shrink-0"
                          />
                        </div>,
                        infoCustom?.iconCoins
                      )}
                      <span className="text-[10px] sm:text-xs font-black">
                        {order.prepaidAll ? "حالة الدفع:" : "المبلغ الكلي:"}
                      </span>
                    </div>

                    <span className="font-mono text-base sm:text-lg md:text-xl font-black tabular-nums tracking-wide drop-shadow-md">
                      {order.prepaidAll ? (
                        <span className="text-[#F5D77F] font-black animate-pulse">كل شي واصل ✓</span>
                      ) : order.totalAmount != null ? (
                        formatDinarAsAlfWithUnit(order.totalAmount)
                      ) : (
                        "—"
                      )}
                    </span>
                  </div>,
                  infoCustom?.blockTotal
                )}

              </div>

              {/* الجهة اليسرى: صورة الطلبية + أزرار الرفع بالكاميرا والمعرض */}
              {wrapInteractive(
                "photoContainer",
                "إطار صورة الطلبية",
                <div
                  className="w-[100px] xs:w-[115px] sm:w-[135px] md:w-[155px] flex flex-col items-center justify-between shrink-0 gap-1.5 self-center"
                  style={getElementStyle(infoCustom?.photoContainer)}
                >
                  {/* إطار الصورة المذهب الملكي */}
                  <div className="w-full relative group">
                    <div className="aspect-square w-full overflow-hidden rounded-2xl border-2 border-[#C9A86A] bg-[#06281D]/90 shadow-xl relative flex items-center justify-center">
                      {orderImageUrl ? (
                        <>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={orderImageUrl}
                            alt="صورة الطلبية"
                            className="h-full w-full object-contain cursor-zoom-in group-hover:scale-105 transition-transform duration-300"
                            onClick={() => {
                              if (!isDesignMode) {
                                setPreviewImageUrl(orderImageUrl);
                                setZoomOpen(true);
                              }
                            }}
                          />
                          {!isDesignMode && (
                            <div
                              className="absolute bottom-1 left-1 bg-[#06281D]/80 border border-[#C9A86A]/80 text-[#F5D77F] p-1 rounded-md text-[10px] shadow-sm cursor-pointer hover:bg-[#0A3D2E]"
                              onClick={(e) => {
                                e.stopPropagation();
                                setPreviewImageUrl(orderImageUrl);
                                setZoomOpen(true);
                              }}
                            >
                              🔍
                            </div>
                          )}
                        </>
                      ) : (
                        <div
                          className="flex flex-col items-center justify-center p-2 text-center"
                          style={getElementStyle(infoCustom?.placeholderNoPhoto)}
                        >
                          <span className="text-2xl mb-0.5 opacity-50">📦</span>
                          <span className="text-[9px] sm:text-[10px] font-bold text-[#F5D77F]/60 leading-tight">
                            لا توجد صورة
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* أزرار الكاميرا والمعرض لرفع وتحديث صورة الطلبية */}
                  <div className="grid grid-cols-2 gap-1 w-full pt-0.5">
                    {/* زر الكاميرا 📷 */}
                    {wrapInteractive(
                      "btnCamera",
                      "زر كاميرا الطلبية",
                      <div className="w-full flex justify-center" style={getElementStyle(infoCustom?.btnCamera)}>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => {
                            if (isDesignMode) return;
                            const el = cameraFileRef.current;
                            if (!el) return;
                            el.setAttribute("capture", "environment");
                            el.click();
                          }}
                          className="w-full rounded-xl border border-[#C9A86A] bg-gradient-to-r from-[#0F4D3A] to-[#165B45] py-1 text-[10px] sm:text-xs font-black text-[#F5D77F] shadow-sm hover:brightness-110 active:scale-95 transition-all flex items-center justify-center gap-0.5 cursor-pointer disabled:opacity-50"
                          title="التقاط صورة الطلبية بالكاميرا"
                        >
                          <span>📷</span>
                          <span>{busy ? "…" : "كاميرا"}</span>
                        </button>
                      </div>,
                      infoCustom?.btnCamera
                    )}

                    {/* زر المعرض 🖼️ */}
                    {wrapInteractive(
                      "btnGallery",
                      "زر معرض الطلبية",
                      <div className="w-full flex justify-center" style={getElementStyle(infoCustom?.btnGallery)}>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => {
                            if (isDesignMode) return;
                            const el = galleryFileRef.current;
                            if (!el) return;
                            el.removeAttribute("capture");
                            el.click();
                          }}
                          className="w-full rounded-xl border border-[#C9A86A] bg-gradient-to-r from-[#0F4D3A] to-[#165B45] py-1 text-[10px] sm:text-xs font-black text-[#F5D77F] shadow-sm hover:brightness-110 active:scale-95 transition-all flex items-center justify-center gap-0.5 cursor-pointer disabled:opacity-50"
                          title="اختيار صورة الطلبية من المعرض"
                        >
                          <span>🖼️</span>
                          <span>{busy ? "…" : "معرض"}</span>
                        </button>
                      </div>,
                      infoCustom?.btnGallery
                    )}
                  </div>

                  {/* نموذج رفع صورة الطلبية في الخلفية */}
                  <form
                    ref={formRef}
                    action={formAction}
                    encType="multipart/form-data"
                    className="hidden"
                  >
                    <input type="hidden" name="orderId" value={order.id} />
                    {nextUrl && <input type="hidden" name="next" value={nextUrl} />}
                    {auth && (
                      <>
                        <input type="hidden" name="c" value={auth.c} />
                        <input type="hidden" name="exp" value={auth.exp} />
                        <input type="hidden" name="s" value={auth.s} />
                      </>
                    )}
                    <input
                      ref={cameraFileRef}
                      name="orderImage"
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className="sr-only"
                      onChange={(e) => handleFileSelected(e.target.files?.[0], cameraFileRef.current)}
                    />
                    <input
                      ref={galleryFileRef}
                      name="orderImage"
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className="sr-only"
                      onChange={(e) => handleFileSelected(e.target.files?.[0], galleryFileRef.current)}
                    />
                  </form>
                </div>,
                infoCustom?.photoContainer
              )}
            </div>
          )}
        </div>
      </div>

      {/* نافذة التكبير الذكية للصورة */}
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