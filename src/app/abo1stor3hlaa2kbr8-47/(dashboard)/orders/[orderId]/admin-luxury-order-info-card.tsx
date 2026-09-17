"use client";

import React, { useRef, useState, useActionState } from "react";
import { useRouter } from "next/navigation";
import { formatDinarAsAlf, formatDinarAsAlfWithUnit } from "@/lib/money-alf";
import { resolvePublicAssetSrc } from "@/lib/image-url";
import { ImageZoomModal } from "@/components/pinch-zoom-image";
import {
  type OrderCardDesignerConfig,
  getElementStyle,
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
}: {
  order: any;
  setPreviewImageUrl: (url: string | null) => void;
  designerConfig?: OrderCardDesignerConfig;
  auth?: { c: string; exp: string; s: string };
  nextUrl?: string;
  hideSubtotalInfo?: boolean;
  isMandoubPortal?: boolean;
}) {
  const router = useRouter();
  const [isExpanded, setIsExpanded] = useState(true);
  const [zoomOpen, setZoomOpen] = useState(false);
  const [compressing, setCompressing] = useState(false);

  const cameraFileRef = useRef<HTMLInputElement>(null);
  const galleryFileRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const [, formAction, pending] = useActionState(uploadMandoubOrderImage, {});

  const orderImageUrl = resolvePublicAssetSrc(order.imageUrl);
  const infoCustom = designerConfig?.orderInfoCard;

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

  return (
    <div className="w-full max-w-4xl mx-auto my-0 select-none" dir="rtl">
      {/* مدخلات رفع الصور المخفية */}
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

      {/* كارت تفاصيل الطلبية والمبلغ الملكي الزمردي المذهب */}
      <div className="relative mt-1">
        {/* إطار التدرج الخارجي */}
        <div className="absolute -inset-[1px] rounded-[24px] bg-gradient-to-b from-[#E8C77E] via-[#C9A86A] to-[#9C7D46] opacity-90 pointer-events-none" />
        <div className="absolute -inset-[6px] rounded-[28px] bg-[#C9A86A]/10 blur-[8px] pointer-events-none" />

        <div className="relative rounded-[22px] bg-[#FFFEFB] border border-[#FDF6E3] shadow-[0_8px_24px_rgba(10,61,46,0.07),0_1px_3px_rgba(0,0,0,0.05),inset_0_1px_0_white] overflow-hidden">
          {/* زخارف أرابيسك وزوايا مذهبة */}
          <div className="absolute top-[10px] right-[10px] w-[7px] h-[7px] rotate-45 bg-gradient-to-br from-[#E8C77E] to-[#C9A86A] shadow-[0_0_4px_rgba(201,168,106,0.5)] pointer-events-none" />
          <div className="absolute top-[10px] left-[10px] w-[7px] h-[7px] rotate-45 bg-gradient-to-br from-[#E8C77E] to-[#C9A86A] shadow-[0_0_4px_rgba(201,168,106,0.5)] pointer-events-none" />
          <div className="absolute bottom-[10px] right-[10px] w-[5px] h-[5px] rotate-45 border border-[#C9A86A]/40 pointer-events-none" />
          <div className="absolute bottom-[10px] left-[10px] w-[5px] h-[5px] rotate-45 border border-[#C9A86A]/40 pointer-events-none" />

          {/* طبقة العناصر المخصصة */}
          <RenderCustomElementsLayer
            elements={infoCustom?.customElements}
            context={{
              order,
              onZoomImage: (url) => setPreviewImageUrl(url),
            }}
          />

          {/* هيدر الكارت المذهب */}
          <div className="px-3.5 py-3 flex items-center justify-between border-b border-[#C9A86A]/20 bg-gradient-to-b from-[#FDF6E3] to-[#FFFEFB]">
            <div className="flex items-center gap-2.5">
              <div className="w-[32px] h-[32px] rounded-[10px] gold-grad flex items-center justify-center shadow-[0_3px_10px_rgba(201,168,106,0.4)] border border-[#9C7D46]/30">
                <svg className="w-[16px] h-[16px] text-[#0A3D2E]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                  <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
                  <line x1="12" y1="22.08" x2="12" y2="12" />
                </svg>
              </div>
              <h3 className="text-[14px] font-black text-[#0A3D2E] leading-none">تفاصيل الطلبية والمبلغ</h3>
            </div>

            <button
              type="button"
              onClick={() => setIsExpanded(!isExpanded)}
              className="inline-flex items-center gap-1 bg-[#FDF6E3] hover:bg-[#F7E9B0] border border-[#C9A86A]/40 text-[10px] font-black text-[#8B6A2A] px-2.5 py-1 rounded-full shadow-xs transition-all active:scale-95 cursor-pointer"
            >
              <span>{isExpanded ? "طي ▲" : "عرض ▼"}</span>
            </button>
          </div>

          {/* محتوى تفاصيل الطلبية والمبالغ */}
          {isExpanded && (
            <div className="p-3.5 bg-[#FFFEF8]">
              <div className="flex gap-3 items-start">
                {/* القسم الأيمن للمبالغ ونوع الطلبية */}
                <div className="flex-1 min-w-0 space-y-2.5">
                  {/* نوع الطلبية / التفاصيل */}
                  <div className="flex items-center gap-2">
                    <div className="w-[36px] h-[36px] rounded-[10px] bg-[#FDF6E3] border border-[#C9A86A]/40 flex items-center justify-center shadow-[inset_0_1px_0_white] shrink-0">
                      <svg className="w-[18px] h-[18px] text-[#8B6A2A]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                        <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
                        <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
                      </svg>
                    </div>
                    <div className="text-[16px] font-black text-[#0A3D2E] leading-none truncate">
                      {order.orderType || order.summary || "تفاصيل الطلب"}
                    </div>
                  </div>

                  {/* سطر سعر الطلب */}
                  {!hideSubtotalInfo && (
                    <div className="w-full h-[38px] rounded-[12px] bg-[#FFFEF8] border-[1.5px] border-[#C9A86A] px-3 flex items-center justify-between gap-2 shadow-[0_2px_6px_rgba(201,168,106,0.12),inset_0_1px_0_white]">
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="w-[20px] h-[20px] rounded-[8px] bg-[#FDF6E3] border border-[#C9A86A]/30 flex items-center justify-center">
                          <svg className="w-[11px] h-[11px] text-[#8B6A2A]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <circle cx="12" cy="12" r="10" />
                            <path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8" />
                            <path d="M12 18V6" />
                          </svg>
                        </span>
                        <span className="text-[11px] font-bold text-[#0A3D2E] whitespace-nowrap">سعر الطلب</span>
                      </div>
                      <div className="flex items-baseline gap-1 shrink-0">
                        <span className="text-[13px] font-black text-[#0A3D2E] font-mono">
                          {order.orderSubtotal != null ? formatDinarAsAlf(subtotalVal) : "0"}
                        </span>
                        <span className="text-[10px] font-bold text-[#8B6A2A] whitespace-nowrap">ألف</span>
                      </div>
                    </div>
                  )}

                  {/* سطر التوصيل */}
                  <div className="w-full h-[38px] rounded-[12px] bg-[#FFFEF8] border-[1.5px] border-[#C9A86A] px-3 flex items-center justify-between gap-2 shadow-[0_2px_6px_rgba(201,168,106,0.12),inset_0_1px_0_white]">
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="w-[20px] h-[20px] rounded-[8px] bg-[#0A3D2E] border border-[#C9A86A]/20 flex items-center justify-center">
                        <svg className="w-[11px] h-[11px] text-[#E8C77E]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <rect x="1" y="3" width="15" height="13" />
                          <polygon points="16 8 20 8 23 11 23 16 16 16 16 8" />
                          <circle cx="5.5" cy="18.5" r="2.5" />
                          <circle cx="18.5" cy="18.5" r="2.5" />
                        </svg>
                      </span>
                      <span className="text-[11px] font-bold text-[#0A3D2E] whitespace-nowrap">التوصيل</span>
                    </div>
                    <div className="flex items-baseline gap-1 shrink-0">
                      <span className="text-[13px] font-black text-[#0A3D2E] font-mono">
                        {order.deliveryPrice != null ? formatDinarAsAlf(deliveryVal) : "0"}
                      </span>
                      <span className="text-[10px] font-bold text-[#8B6A2A] whitespace-nowrap">ألف</span>
                    </div>
                  </div>

                  {/* الصندوق الملكي الذهبي الكبير للمبلغ الإجمالي */}
                  <div
                    className="w-full h-[64px] rounded-[14px] border-[2px] border-[#0A3D2E] shadow-[0_4px_14px_rgba(201,168,106,0.3),inset_0_1px_0_rgba(255,255,255,0.6)] flex items-center justify-center"
                    style={{ background: "linear-gradient(135deg, #E8C77E 0%, #C9A86A 100%)" }}
                  >
                    {order.prepaidAll ? (
                      <span className="text-[20px] font-black text-[#0A3D2E]">كل شي واصل ✓</span>
                    ) : (
                      <span className="text-[36px] font-black leading-none text-[#0A3D2E] font-mono tracking-tight">
                        {order.totalAmount != null ? formatDinarAsAlf(totalVal) : "0"}
                      </span>
                    )}
                  </div>
                </div>

                {/* القسم الأيسر: صورة الطلبية */}
                <div className="shrink-0 flex flex-col items-center gap-1.5 w-[110px]">
                  <div className="relative w-[110px] h-[110px] rounded-[18px] p-[2.5px] bg-gradient-to-br from-[#E8C77E] to-[#C9A86A] shadow-[0_4px_16px_rgba(201,168,106,0.28)]">
                    <div className="w-full h-full rounded-[15px] bg-gradient-to-br from-[#E8E0C8] via-[#D8CCB0] to-[#C9B997] relative overflow-hidden border border-white/50 flex flex-col items-center justify-center">
                      {orderImageUrl ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img
                          src={orderImageUrl}
                          alt="صورة الطلبية"
                          className="w-full h-full object-cover cursor-pointer hover:scale-105 transition duration-300"
                          onClick={() => {
                            setPreviewImageUrl(orderImageUrl);
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
                                <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                              </svg>
                            </div>
                            <span className="text-[10px] font-bold text-[#3A2E1A]/80 leading-none">صورة الطلب</span>
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  {/* أزرار كاميرا ومعرض صور الطلب */}
                  <div className="grid grid-cols-2 gap-1.5 w-full">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => cameraFileRef.current?.click()}
                      className="h-[28px] rounded-full bg-white border border-[#C9A86A]/35 text-[#6B5A38] flex items-center justify-center gap-1 text-[10px] font-bold shadow-xs active:scale-95 transition-all cursor-pointer"
                    >
                      <span>📷</span>
                      <span>كاميرا</span>
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => galleryFileRef.current?.click()}
                      className="h-[28px] rounded-full bg-white border border-[#C9A86A]/35 text-[#6B5A38] flex items-center justify-center gap-1 text-[10px] font-bold shadow-xs active:scale-95 transition-all cursor-pointer"
                    >
                      <span>🖼️</span>
                      <span>معرض</span>
                    </button>
                  </div>
                </div>
              </div>
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