"use client";

import React, { useState } from "react";
import { createPortal } from "react-dom";
import { resolvePublicAssetSrc } from "@/lib/image-url";

export type ModalActionType = "call" | "chat" | "location" | "door";

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
    const resolvedSrc = resolvePublicAssetSrc(activePreviewImage.url);
    const viewerContent = (
      <div
        className="fixed inset-0 z-[999999] flex items-center justify-center p-3 sm:p-4 bg-black/90 backdrop-blur-md animate-in fade-in duration-200"
        dir="rtl"
        onClick={() => {
          setActivePreviewImage(null);
          if (onClosePreviewImage) onClosePreviewImage();
        }}
      >
        <div
          className="relative w-full max-w-lg rounded-[28px] overflow-hidden border-2 border-[#C9A86A] bg-[#0A1A18] text-white shadow-[0_20px_60px_rgba(0,0,0,0.9)] flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200"
          onClick={(e) => e.stopPropagation()}
        >
          {/* شريط رأس عارض الصور الملكي */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-[#C9A86A]/40 bg-gradient-to-r from-[#0F4D3A] via-[#0A3D2E] to-[#0F4D3A]">
            <div className="flex items-center gap-2">
              <span className="text-xl">🚪</span>
              <span className="text-sm sm:text-base font-black text-[#F5D77F] truncate">
                {activePreviewImage.title}
              </span>
            </div>
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setActivePreviewImage(null);
                if (onClosePreviewImage) onClosePreviewImage();
              }}
              className="w-8 h-8 rounded-full bg-[#0A3D2E] text-[#F5D77F] border border-[#C9A86A] hover:bg-[#C9A86A] hover:text-[#0A3D2E] flex items-center justify-center font-black text-sm transition active:scale-90 cursor-pointer shadow-md"
              title="إغلاق"
            >
              ✕
            </button>
          </div>

          {/* حاوي الصورة المكبرة */}
          <div className="p-3 bg-black/60 flex-1 overflow-auto flex items-center justify-center min-h-[220px]">
            {resolvedSrc ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={resolvedSrc}
                alt={activePreviewImage.title}
                className="max-w-full max-h-[65vh] object-contain rounded-xl shadow-2xl border border-[#C9A86A]/30"
              />
            ) : (
              <div className="text-center py-12 text-slate-400 font-bold text-sm">
                لم يتم العثور على ملف الصورة أو الرابط غير صالح
              </div>
            )}
          </div>

          {/* زر سفلي لإغلاق المعاينة */}
          <div className="p-3 border-t border-[#C9A86A]/30 bg-[#0A1A18] flex justify-center">
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setActivePreviewImage(null);
                if (onClosePreviewImage) onClosePreviewImage();
              }}
              className="w-full py-2.5 rounded-xl border-2 border-[#C9A86A] bg-gradient-to-r from-[#0F4D3A] to-[#164E3D] text-[#F5D77F] font-black text-sm transition hover:scale-[1.01] active:scale-95 shadow-md flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>✕</span>
              <span>إغلاق المعاينة</span>
            </button>
          </div>
        </div>
      </div>
    );
    if (typeof document === "undefined") return null;
    return createPortal(viewerContent, document.body);
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
          <div className="text-3xl sm:text-4xl mb-1 flex items-center justify-center drop-shadow-md select-none">
            {type === "chat" ? "💬" : type === "call" ? "📞" : type === "location" ? "📍" : "🚪"}
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
