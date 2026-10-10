"use client";

import React, { useState } from "react";
import { createPortal } from "react-dom";
import { resolvePublicAssetSrc } from "@/lib/image-url";
import { ImageZoomModal } from "@/components/pinch-zoom-image";

export type ModalActionType = "call" | "chat" | "location" | "door" | "customer";

export interface ModalActionOption {
  title: string;
  subtitle?: string;
  icon: string;
  badge?: string;
  actionUrl?: string;
  onClick?: () => void;
  imageUrl?: string;
  colorVariant?: "emerald" | "amber" | "blue" | "gold";
}

interface MandoubActionMenuModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  type: ModalActionType;
  options: ModalActionOption[];
  previewImageUrl?: string | null;
  onClosePreviewImage?: () => void;
}

export function MandoubActionMenuModal({
  isOpen,
  onClose,
  title,
  subtitle,
  type,
  options,
  previewImageUrl,
  onClosePreviewImage,
}: MandoubActionMenuModalProps) {
  const [activePreviewImage, setActivePreviewImage] = useState<{
    url: string;
    title: string;
  } | null>(previewImageUrl ? { url: previewImageUrl, title: title || "صورة الباب" } : null);

  if (!isOpen && !activePreviewImage) return null;

  // في حال كان عارض الصورة المكبرة نشطاً
  if (activePreviewImage) {
    const resolvedSrc = resolvePublicAssetSrc(activePreviewImage.url) || activePreviewImage.url;
    return (
      <ImageZoomModal
        imageUrl={resolvedSrc}
        title={activePreviewImage.title}
        onClose={() => {
          setActivePreviewImage(null);
          if (onClosePreviewImage) onClosePreviewImage();
        }}
      />
    );
  }

  if (!isOpen) return null;

  const modalContent = (
    <div
      className="fixed inset-0 z-[99999] flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
      dir="rtl"
    >
      <div
        className="relative w-full max-w-sm rounded-[28px] p-5 sm:p-6 shadow-[0_20px_50px_rgba(0,0,0,0.95)] border-2 border-[#C9A86A] bg-[#0A1A18] text-white flex flex-col gap-4 select-none animate-in zoom-in-95 duration-200"
        style={{
          boxShadow: "0 20px 50px rgba(0,0,0,0.95), inset 0 0 35px rgba(201,168,106,0.18)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* زر الإغلاق ✕ في الأعلى يعمل 100% بنقرة واحدة */}
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onClose();
          }}
          className="absolute top-3.5 left-3.5 z-50 w-8 h-8 rounded-full bg-[#132A26] border border-[#C9A86A] text-[#F5D77F] hover:bg-[#C9A86A] hover:text-[#0A1A18] flex items-center justify-center font-black text-sm transition active:scale-90 cursor-pointer shadow-md"
          title="إغلاق النافذة"
        >
          ✕
        </button>

        {/* رأس النافذة المنبثقة الفاخر بدون أي إطار محيط بالأيقونة */}
        <div className="text-center pt-1 pb-1">
          <div className="text-3xl sm:text-4xl mb-1 flex items-center justify-center drop-shadow-md select-none text-[#F5D77F]">
            {type === "chat" && (
              <svg className="w-9 h-9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
              </svg>
            )}
            {type === "call" && (
              <svg className="w-9 h-9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
              </svg>
            )}
            {type === "location" && (
              <svg className="w-9 h-9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                <circle cx="12" cy="10" r="3" />
              </svg>
            )}
            {type === "door" && (
              <svg className="w-9 h-9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 21h18" />
                <path d="M6 21V3h12v18" />
                <circle cx="15" cy="12" r="1" />
              </svg>
            )}
            {type !== "chat" && type !== "call" && type !== "location" && type !== "door" && (
              <svg className="w-9 h-9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="5" y="2" width="14" height="20" rx="2" ry="2" />
                <line x1="12" y1="18" x2="12.01" y2="18" />
              </svg>
            )}
          </div>
          <h3 className="text-base sm:text-lg font-black text-[#F5D77F] drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
            {title}
          </h3>
          {subtitle && (
            <p className="text-xs text-slate-300 font-bold mt-0.5">
              {subtitle}
            </p>
          )}
        </div>

        {/* قائمة الخيارات التفاعلية المذهبة بنانو بنانا بسطر واحد ونصوص متمركزة */}
        <div className="flex flex-col gap-2.5">
          {options.map((opt, idx) => {
            const btnContent = (
              <div className="flex items-center justify-center gap-2.5 w-full relative z-10 py-1.5 px-4 text-center">
                <span className="text-xl sm:text-2xl shrink-0 drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
                  {opt.icon}
                </span>
                <span className="text-sm sm:text-base font-black text-white leading-normal truncate drop-shadow-[0_1px_3px_rgba(0,0,0,0.95)]">
                  {opt.title}
                </span>
              </div>
            );

            // استخدام خلفيات الأزرار المذهبة بنانو بنانا بدون إطارات CSS مشوهة
            let bgImage = "url('/images/order-luxury/btn-luxury-option.webp')";
            if (opt.colorVariant === "amber") {
              bgImage = "url('/images/order-luxury/btn-luxury-option-amber.webp')";
            } else if (opt.colorVariant === "blue") {
              bgImage = "url('/images/order-luxury/btn-luxury-option-blue.webp')";
            }

            const baseBtnStyle =
              "relative w-full rounded-2xl min-h-[52px] sm:min-h-[58px] p-2 flex items-center justify-center cursor-pointer active:scale-98 shadow-lg transition-transform hover:scale-[1.01] bg-no-repeat bg-[length:100%_100%] overflow-hidden ";

            if (opt.actionUrl) {
              return (
                <a
                  key={idx}
                  href={opt.actionUrl}
                  target={opt.actionUrl.startsWith("http") ? "_blank" : undefined}
                  rel={opt.actionUrl.startsWith("http") ? "noopener noreferrer" : undefined}
                  onClick={() => {
                    if (opt.onClick) opt.onClick();
                    onClose();
                  }}
                  className={baseBtnStyle}
                  style={{ backgroundImage: bgImage }}
                >
                  {btnContent}
                </a>
              );
            }

            return (
              <button
                key={idx}
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (opt.imageUrl) {
                    setActivePreviewImage({ url: opt.imageUrl, title: opt.title });
                  } else if (opt.onClick) {
                    opt.onClick();
                  } else {
                    onClose();
                  }
                }}
                className={baseBtnStyle}
                style={{ backgroundImage: bgImage }}
              >
                {btnContent}
              </button>
            );
          })}
        </div>

        {options.length === 0 && (
          <div className="text-center py-6 text-slate-400 font-bold text-xs bg-[#132A26] rounded-2xl border border-[#C9A86A]/30">
            لا توجد خيارات متاحة لهذا الطلب
          </div>
        )}
      </div>
    </div>
  );

  if (typeof document === "undefined") return null;
  return createPortal(modalContent, document.body);
}
