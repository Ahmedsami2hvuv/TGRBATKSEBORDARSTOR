"use client";

import React, { useRef, useState } from "react";

type SwipeableLuxuryPhotoBoxProps = {
  size?: number; // مثلاً 130 أو 110
  variant?: "shop" | "customer" | "order";
  imageUrl?: string | null;
  label?: string;
  fallbackIcon?: React.ReactNode;
  onSwipeRight: () => void; // فتح الكاميرا
  onSwipeLeft: () => void;  // فتح المعرض
  onClickPreview: () => void; // تكبير الصورة
  isBusy?: boolean;
};

export function SwipeableLuxuryPhotoBox({
  size = 130,
  variant = "customer",
  imageUrl,
  label = "الصورة",
  fallbackIcon,
  onSwipeRight,
  onSwipeLeft,
  onClickPreview,
  isBusy = false,
}: SwipeableLuxuryPhotoBoxProps) {
  const [offsetX, setOffsetX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const startXRef = useRef(0);
  const currentOffsetRef = useRef(0);
  const hasMovedRef = useRef(false);

  // إعدادات اللمس بالهاتف
  const handleTouchStart = (e: React.TouchEvent) => {
    if (isBusy) return;
    const touch = e.touches[0];
    startXRef.current = touch.clientX;
    currentOffsetRef.current = 0;
    hasMovedRef.current = false;
    setIsDragging(true);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging || isBusy) return;
    const touch = e.touches[0];
    const diff = touch.clientX - startXRef.current;
    if (Math.abs(diff) > 6) {
      hasMovedRef.current = true;
    }
    const dampened = diff * 0.45;
    currentOffsetRef.current = diff;
    setOffsetX(dampened);
  };

  const handleTouchEnd = () => {
    if (!isDragging || isBusy) return;
    setIsDragging(false);
    const diff = currentOffsetRef.current;
    setOffsetX(0);

    if (diff > 25) {
      // سحب لليمين -> فتح الكاميرا 📷
      onSwipeRight();
    } else if (diff < -25) {
      // سحب لليسار -> فتح المعرض / الاستوديو 🖼️
      onSwipeLeft();
    } else if (!hasMovedRef.current) {
      onClickPreview();
    }
    currentOffsetRef.current = 0;
  };

  // إعدادات الماوس بالكمبيوتر
  const handleMouseDown = (e: React.MouseEvent) => {
    if (isBusy) return;
    startXRef.current = e.clientX;
    currentOffsetRef.current = 0;
    hasMovedRef.current = false;
    setIsDragging(true);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || isBusy) return;
    const diff = e.clientX - startXRef.current;
    if (Math.abs(diff) > 5) {
      hasMovedRef.current = true;
    }
    const dampened = diff * 0.45;
    currentOffsetRef.current = diff;
    setOffsetX(dampened);
  };

  const handleMouseUp = () => {
    if (!isDragging || isBusy) return;
    setIsDragging(false);
    const diff = currentOffsetRef.current;
    setOffsetX(0);

    if (diff > 25) {
      // سحب لليمين -> فتح الكاميرا 📷
      onSwipeRight();
    } else if (diff < -25) {
      // سحب لليسار -> فتح المعرض 🖼️
      onSwipeLeft();
    } else if (!hasMovedRef.current) {
      onClickPreview();
    }
    currentOffsetRef.current = 0;
  };

  const handleMouseLeave = () => {
    if (isDragging) {
      setIsDragging(false);
      setOffsetX(0);
      currentOffsetRef.current = 0;
    }
  };

  const isShop = variant === "shop";
  const isOrder = variant === "order";

  const boxStyle: React.CSSProperties = isShop
    ? {
        width: size,
        height: size,
        borderRadius: size <= 115 ? 18 : 24,
        border: "3px solid #C9A86A",
        backgroundColor: "#0E3D2B",
        backgroundImage: `url("data:image/svg+xml,%3Csvg width='56' height='56' viewBox='0 0 56 56' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M28 0 L30.5 25.5 L56 28 L30.5 30.5 L28 56 L25.5 30.5 L0 28 L25.5 25.5 Z' fill='%231A4D3A' fill-opacity='0.28'/%3E%3Ccircle cx='28' cy='28' r='1.8' fill='%232A6A55' fill-opacity='0.22'/%3E%3C/svg%3E")`,
        backgroundRepeat: "repeat",
        boxShadow:
          "0 4px 15px rgba(201,168,106,0.4), inset 0 1px 0 rgba(255,255,255,0.12), 0 0 0 1px rgba(232,213,163,0.3) inset",
        transform: `translateX(${offsetX}px) ${isDragging ? "scale(0.97)" : ""}`,
        transition: isDragging ? "none" : "transform 0.22s cubic-bezier(.34,1.2,.64,1)",
      }
    : {
        width: size,
        height: size,
        borderRadius: size <= 115 ? 18 : 24,
        border: "3px solid #C9A86A",
        backgroundImage: `url("data:image/svg+xml,%3Csvg width='48' height='48' viewBox='0 0 48 48' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M24 0 L26 21 L48 24 L26 27 L24 48 L22 27 L0 24 L22 21 Z' fill='%23C9A86A' fill-opacity='0.07'/%3E%3C/svg%3E"), linear-gradient(135deg, #FDF6E3 0%, #F5E6C0 50%, #E8D5A3 100%)`,
        backgroundRepeat: "repeat, no-repeat",
        backgroundColor: "#FDF6E3",
        boxShadow:
          "0 4px 15px rgba(201,168,106,0.3), inset 0 1px 0 white, 0 0 0 1px rgba(232,213,163,0.5) inset",
        transform: `translateX(${offsetX}px) ${isDragging ? "scale(0.97)" : ""}`,
        transition: isDragging ? "none" : "transform 0.22s cubic-bezier(.34,1.2,.64,1)",
      };

  const iconCircleSize = size <= 110 ? 44 : 58;

  return (
    <div
      className="relative shrink-0 select-none touch-pan-y"
      style={{ width: size, height: size }}
      title="اسحب لليمين للكاميرا 📷 | اسحب لليسار للمعرض 🖼️ | انقر للمعاينة 🔍"
    >
      {/* خلفية الأيقونات التي تظهر عند السحب يميناً ويساراً */}
      <div
        className="absolute inset-0 rounded-[24px] overflow-hidden pointer-events-none"
        style={{ border: "3px solid transparent" }}
      >
        <div className="absolute inset-0 flex items-center justify-between">
          {/* أيقونة الكاميرا جهة اليمين (تظهر عند السحب لليمين) */}
          <div
            className="h-full flex-1 bg-[#C9A86A]/20 flex items-center justify-start pl-2 sm:pl-3 rounded-r-[20px]"
            style={{
              opacity: offsetX > 6 ? Math.min(offsetX / 40, 1) : 0,
              transition: "opacity 0.15s ease",
            }}
          >
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-[#0A3D2E] border border-[#C9A86A] flex items-center justify-center shadow-md">
              <span className="text-[13px] sm:text-[14px]">📷</span>
            </div>
          </div>

          {/* أيقونة المعرض جهة اليسار (تظهر عند السحب لليسار) */}
          <div
            className="h-full flex-1 bg-[#0A3D2E]/15 flex items-center justify-end pr-2 sm:pr-3 rounded-l-[20px]"
            style={{
              opacity: offsetX < -6 ? Math.min(Math.abs(offsetX) / 40, 1) : 0,
              transition: "opacity 0.15s ease",
            }}
          >
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-[#FFFEF8] border border-[#C9A86A] flex items-center justify-center shadow-md">
              <span className="text-[13px] sm:text-[14px]">🖼️</span>
            </div>
          </div>
        </div>
      </div>

      {/* المربع الرئيسي القابل للسحب */}
      <div
        className="relative overflow-hidden cursor-grab active:cursor-grabbing flex flex-col items-center justify-center"
        style={boxStyle}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
      >
        {imageUrl ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={imageUrl}
            alt={label}
            className="w-full h-full object-cover pointer-events-none"
            style={{ borderRadius: size <= 115 ? 15 : 21 }}
            draggable={false}
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center text-center p-1.5 pointer-events-none">
            <div
              className={`rounded-[16px] flex items-center justify-center mb-1.5 shadow-sm ${
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
              className={`font-black tracking-wide leading-none drop-shadow-sm ${
                size <= 110 ? "text-[12px]" : "text-[14px]"
              } ${isShop ? "text-[#FFFEF8]" : "text-[#0A3D2E]"}`}
            >
              {label}
            </span>
          </div>
        )}

        {isBusy && (
          <div className="absolute inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center z-10">
            <div className="w-6 h-6 border-2 border-[#E8C77E] border-t-transparent rounded-full animate-spin" />
          </div>
        )}
      </div>
    </div>
  );
}
