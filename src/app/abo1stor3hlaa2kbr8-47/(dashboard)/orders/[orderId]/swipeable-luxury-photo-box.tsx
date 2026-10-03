"use client";

import React from "react";

type SwipeableLuxuryPhotoBoxProps = {
  size?: number; // مثلاً 130 أو 110
  variant?: "shop" | "customer" | "order";
  imageUrl?: string | null;
  label?: string;
  fallbackIcon?: React.ReactNode;
  cameraInputId?: string;
  galleryInputId?: string;
  onCameraClick?: () => void;
  onGalleryClick?: () => void;
  /** للتوافق العكسي مع الكود القديم */
  onSwipeRight?: () => void;
  onSwipeLeft?: () => void;
  onClickPreview: () => void;
  isBusy?: boolean;
  showButtons?: boolean;
};

export function SwipeableLuxuryPhotoBox({
  size = 130,
  variant = "customer",
  imageUrl,
  label = "الصورة",
  fallbackIcon,
  cameraInputId,
  galleryInputId,
  onCameraClick,
  onGalleryClick,
  onSwipeRight,
  onSwipeLeft,
  onClickPreview,
  isBusy = false,
  showButtons = true,
}: SwipeableLuxuryPhotoBoxProps) {
  const isShop = variant === "shop";
  const isOrder = variant === "order";

  const handleCamera = () => {
    if (isBusy) return;
    if (onCameraClick) {
      onCameraClick();
    } else if (onSwipeRight) {
      onSwipeRight();
    }
  };

  const handleGallery = () => {
    if (isBusy) return;
    if (onGalleryClick) {
      onGalleryClick();
    } else if (onSwipeLeft) {
      onSwipeLeft();
    }
  };

  const boxStyle: React.CSSProperties = isShop
    ? {
        width: size,
        height: size,
        borderRadius: size <= 115 ? 18 : 22,
        border: "2px solid #38BDF8",
        backgroundColor: "#075985",
        backgroundImage: `url("data:image/svg+xml,%3Csvg width='56' height='56' viewBox='0 0 56 56' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M28 0 L30.5 25.5 L56 28 L30.5 30.5 L28 56 L25.5 30.5 L0 28 L25.5 25.5 Z' fill='%231A4D3A' fill-opacity='0.28'/%3E%3Ccircle cx='28' cy='28' r='1.8' fill='%232A6A55' fill-opacity='0.22'/%3E%3C/svg%3E")`,
        backgroundRepeat: "repeat",
        boxShadow:
          "0 4px 14px rgba(2,132,199,0.25), inset 0 1px 0 rgba(255,255,255,0.15), 0 0 0 1px rgba(232,213,163,0.3) inset",
      }
    : {
        width: size,
        height: size,
        borderRadius: size <= 115 ? 18 : 22,
        border: "2px solid #38BDF8",
        backgroundImage: `linear-gradient(135deg, #FFFFFF 0%, #F0F9FF 50%, #E0F2FE 100%)`,
        backgroundColor: "#F0F9FF",
        boxShadow:
          "0 4px 14px rgba(2,132,199,0.15), inset 0 1px 0 white",
      };

  const iconCircleSize = size <= 110 ? 44 : 54;
  const isSmall = size <= 110;

  return (
    <div
      className="shrink-0 flex flex-col items-center select-none"
      style={{ width: size }}
    >
      {/* المربع الرئيسي للصورة - انقر للمعاينة والتكبير */}
      <div
        onClick={onClickPreview}
        className="group relative overflow-hidden cursor-pointer flex flex-col items-center justify-center transition-all duration-200 hover:shadow-[0_6px_20px_rgba(2,132,199,0.35)] hover:border-[#0284C7] active:scale-[0.98]"
        style={boxStyle}
        title="انقر لتكبير ومعاينة الصورة"
      >
        {imageUrl ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imageUrl}
              alt={label}
              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
              style={{ borderRadius: size <= 115 ? 15 : 19 }}
            />
            <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <div className="w-8 h-8 rounded-full bg-[#0369A1]/90 border border-[#38BDF8] flex items-center justify-center shadow-lg text-[#FDE047]">
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="7" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                  <line x1="11" y1="8" x2="11" y2="14" />
                  <line x1="8" y1="11" x2="14" y2="11" />
                </svg>
              </div>
            </div>
          </>
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center text-center p-1.5 pointer-events-none">
            <div
              className={`rounded-[14px] flex items-center justify-center mb-1 shadow-sm transition-transform duration-200 group-hover:scale-105 ${
                isShop
                  ? "bg-[rgba(201,168,106,0.15)] border-[1.5px] border-[#C9A86A]"
                  : isOrder
                  ? "bg-[#E6EEDB] border-[1.5px] border-[rgba(168,184,154,0.6)]"
                  : "bg-[#E6F4EF] border border-[#115740]/20"
              }`}
              style={{ width: iconCircleSize, height: iconCircleSize }}
            >
              {fallbackIcon}
            </div>
            <span
              className={`font-black tracking-wide leading-none drop-shadow-xs ${
                isSmall ? "text-[11.5px]" : "text-[13px]"
              } ${isShop ? "text-[#FFFEF8]" : "text-[#0369A1]"}`}
            >
              {label}
            </span>
          </div>
        )}

        {isBusy && (
          <div className="absolute inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-10">
            <div className="w-6 h-6 border-2 border-[#E8C77E] border-t-transparent rounded-full animate-spin" />
          </div>
        )}
      </div>

      {/* زري الكاميرا والمعرض المذهبين الفاخرين تحت الصورة مباشرة */}
      {showButtons && (
        <div className="w-full grid grid-cols-2 gap-1.5 mt-2">
          {/* زر الكاميرا الملكي الزمردي المباشر */}
          {cameraInputId ? (
            <label
              htmlFor={cameraInputId}
              onClick={(e) => {
                if (isBusy) e.preventDefault();
              }}
              title="فتح الكاميرا والتقاط صورة مباشرة"
              className={`w-full ${
                isSmall ? "h-[28px] px-1" : "h-[31px] px-1.5"
              } rounded-[9px] bg-gradient-to-b from-[#0E3D2B] via-[#0A3525] to-[#07281C] border border-[#C9A86A] text-[#FDE047] hover:text-[#FFF8E1] hover:border-[#E8C77E] flex items-center justify-center gap-1 shadow-[0_2px_6px_rgba(10,46,32,0.3),inset_0_1px_0_rgba(232,199,126,0.2)] active:scale-95 transition-all cursor-pointer select-none ${
                isBusy ? "opacity-50 pointer-events-none" : ""
              }`}
            >
              <svg
                className={`${isSmall ? "w-3 h-3" : "w-3.5 h-3.5"} shrink-0 text-[#FDE047]`}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" />
                <circle cx="12" cy="13" r="3.2" />
              </svg>
              <span
                className={`font-black tracking-tight leading-none truncate ${
                  isSmall ? "text-[10px]" : "text-[11px]"
                }`}
              >
                كاميرا
              </span>
            </label>
          ) : (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleCamera();
              }}
              disabled={isBusy}
              title="فتح الكاميرا والتقاط صورة مباشرة"
              className={`w-full ${
                isSmall ? "h-[28px] px-1" : "h-[31px] px-1.5"
              } rounded-[9px] bg-gradient-to-b from-[#0E3D2B] via-[#0A3525] to-[#07281C] border border-[#C9A86A] text-[#FDE047] hover:text-[#FFF8E1] hover:border-[#E8C77E] flex items-center justify-center gap-1 shadow-[0_2px_6px_rgba(10,46,32,0.3),inset_0_1px_0_rgba(232,199,126,0.2)] active:scale-95 transition-all cursor-pointer select-none disabled:opacity-50`}
            >
              <svg
                className={`${isSmall ? "w-3 h-3" : "w-3.5 h-3.5"} shrink-0 text-[#FDE047]`}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" />
                <circle cx="12" cy="13" r="3.2" />
              </svg>
              <span
                className={`font-black tracking-tight leading-none truncate ${
                  isSmall ? "text-[10px]" : "text-[11px]"
                }`}
              >
                كاميرا
              </span>
            </button>
          )}

          {/* زر المعرض الملكي العاجي المذهب */}
          {galleryInputId ? (
            <label
              htmlFor={galleryInputId}
              onClick={(e) => {
                if (isBusy) e.preventDefault();
              }}
              title="اختيار صورة من المعرض أو الاستوديو"
              className={`w-full ${
                isSmall ? "h-[28px] px-1" : "h-[31px] px-1.5"
              } rounded-[9px] bg-gradient-to-b from-[#FFFFFF] via-[#F0F9FF] to-[#E0F2FE] border border-[#38BDF8] text-[#0369A1] hover:text-[#0F172A] hover:border-[#0284C7] flex items-center justify-center gap-1 shadow-[0_2px_6px_rgba(2,132,199,0.15),inset_0_1px_0_white] active:scale-95 transition-all cursor-pointer select-none ${
                isBusy ? "opacity-50 pointer-events-none" : ""
              }`}
            >
              <svg
                className={`${isSmall ? "w-3 h-3" : "w-3.5 h-3.5"} shrink-0 text-[#0284C7]`}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect width="18" height="18" x="3" y="3" rx="3" ry="3" />
                <circle cx="8.5" cy="8.5" r="1.5" />
                <path d="m21 15-5-5L5 21" />
              </svg>
              <span
                className={`font-black tracking-tight leading-none truncate ${
                  isSmall ? "text-[10px]" : "text-[11px]"
                }`}
              >
                المعرض
              </span>
            </label>
          ) : (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleGallery();
              }}
              disabled={isBusy}
              title="اختيار صورة من المعرض أو الاستوديو"
              className={`w-full ${
                isSmall ? "h-[28px] px-1" : "h-[31px] px-1.5"
              } rounded-[9px] bg-gradient-to-b from-[#FFFFFF] via-[#F0F9FF] to-[#E0F2FE] border border-[#38BDF8] text-[#0369A1] hover:text-[#0F172A] hover:border-[#0284C7] flex items-center justify-center gap-1 shadow-[0_2px_6px_rgba(2,132,199,0.15),inset_0_1px_0_white] active:scale-95 transition-all cursor-pointer select-none disabled:opacity-50`}
            >
              <svg
                className={`${isSmall ? "w-3 h-3" : "w-3.5 h-3.5"} shrink-0 text-[#0284C7]`}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect width="18" height="18" x="3" y="3" rx="3" ry="3" />
                <circle cx="8.5" cy="8.5" r="1.5" />
                <path d="m21 15-5-5L5 21" />
              </svg>
              <span
                className={`font-black tracking-tight leading-none truncate ${
                  isSmall ? "text-[10px]" : "text-[11px]"
                }`}
              >
                المعرض
              </span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
