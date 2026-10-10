"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";

export type FloatingOrderActionProps = {
  orderId: string;
  status: string; // "pending" | "assigned" | "delivering" | "delivered" | string
  onOpenPickup?: () => void;
  onOpenDelivery?: () => void;
  storageKeyPrefix?: string;
  isMandoub?: boolean;
};

export function FloatingOrderActionButton({
  orderId,
  status,
  onOpenPickup,
  onOpenDelivery,
  storageKeyPrefix = "floating_action_btn",
  isMandoub = true,
}: FloatingOrderActionProps) {
  // الحالات التي يظهر فيها الزر:
  // 1. استلام: إذا كانت الحالة assigned أو pending (مسند للمندوب ولم يستلم بعد)
  // 2. تسليم: إذا كانت الحالة delivering (قيد التوصيل ومستلم)
  // 3. يختفي الزران إذا كانت الحالة delivered أو cancelled أو archived
  const isPickup = status === "assigned" || status === "pending";
  const isDelivery = status === "delivering";

  // الإعدادات الافتراضية
  const DEFAULT_SIZE = 76;
  const DEFAULT_OPACITY = 100;
  const DEFAULT_POS = { x: 20, y: 110 };

  // حالات التحكم
  const [size, setSize] = useState<number>(DEFAULT_SIZE);
  const [opacity, setOpacity] = useState<number>(DEFAULT_OPACITY);
  const [position, setPosition] = useState(DEFAULT_POS);
  const [isDragging, setIsDragging] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);

  const dragRef = useRef<HTMLDivElement>(null);
  const startCoord = useRef({ x: 0, y: 0 });
  const offset = useRef({ x: 0, y: 0 });
  const hasMovedSignificantly = useRef(false);
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);
  const isLongPressTriggered = useRef(false);

  // استرجاع الإعدادات المحفوظة من LocalStorage
  useEffect(() => {
    try {
      // 1. استرجاع الموضع
      const savedPos = localStorage.getItem(`${storageKeyPrefix}_pos`);
      if (savedPos) {
        const parsed = JSON.parse(savedPos);
        if (typeof parsed.x === "number" && typeof parsed.y === "number") {
          const boundedX = Math.max(10, Math.min(window.innerWidth - 90, parsed.x));
          const boundedY = Math.max(10, Math.min(window.innerHeight - 90, parsed.y));
          setPosition({ x: boundedX, y: boundedY });
        }
      }

      // 2. استرجاع الحجم
      const savedSize = localStorage.getItem(`${storageKeyPrefix}_size`);
      if (savedSize) {
        const parsedSize = Number(savedSize);
        if (!isNaN(parsedSize) && parsedSize >= 45 && parsedSize <= 120) {
          setSize(parsedSize);
        }
      }

      // 3. استرجاع الشفافية
      const savedOpacity = localStorage.getItem(`${storageKeyPrefix}_opacity`);
      if (savedOpacity) {
        const parsedOpacity = Number(savedOpacity);
        if (!isNaN(parsedOpacity) && parsedOpacity >= 20 && parsedOpacity <= 100) {
          setOpacity(parsedOpacity);
        }
      }
    } catch {
      // تجاهل أخطاء التخزين المحلي
    }
  }, [storageKeyPrefix]);

  // دالة حفظ الإعدادات
  const saveSize = (newSize: number) => {
    setSize(newSize);
    try {
      localStorage.setItem(`${storageKeyPrefix}_size`, String(newSize));
    } catch {}
  };

  const saveOpacity = (newOpacity: number) => {
    setOpacity(newOpacity);
    try {
      localStorage.setItem(`${storageKeyPrefix}_opacity`, String(newOpacity));
    } catch {}
  };

  const resetPosition = () => {
    setPosition(DEFAULT_POS);
    try {
      localStorage.setItem(`${storageKeyPrefix}_pos`, JSON.stringify(DEFAULT_POS));
    } catch {}
  };

  const resetSize = () => {
    saveSize(DEFAULT_SIZE);
  };

  const resetAll = () => {
    resetPosition();
    resetSize();
    saveOpacity(DEFAULT_OPACITY);
  };

  // معالجة بدء اللمس أو الماوس
  const handleStart = (e: React.MouseEvent | React.TouchEvent) => {
    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
    const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;

    startCoord.current = { x: clientX, y: clientY };
    hasMovedSignificantly.current = false;
    isLongPressTriggered.current = false;
    setIsDragging(true);

    if (dragRef.current) {
      const rect = dragRef.current.getBoundingClientRect();
      offset.current = {
        x: clientX - rect.left,
        y: clientY - rect.top,
      };
    }

    // بدء مؤقت الضغط المطول
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
    }
    longPressTimer.current = setTimeout(() => {
      if (!hasMovedSignificantly.current) {
        isLongPressTriggered.current = true;
        if (typeof navigator !== "undefined" && navigator.vibrate) {
          try {
            navigator.vibrate(50);
          } catch {}
        }
        setShowSettingsModal(true);
      }
    }, 550);
  };

  // معالجة التحريك والسحب
  const handleMove = useCallback((e: MouseEvent | TouchEvent) => {
    if (!isDragging) return;
    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
    const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;

    const dx = Math.abs(clientX - startCoord.current.x);
    const dy = Math.abs(clientY - startCoord.current.y);

    if (dx > 6 || dy > 6) {
      hasMovedSignificantly.current = true;
      // إلغاء الضغط المطول إذا تم السحب
      if (longPressTimer.current) {
        clearTimeout(longPressTimer.current);
        longPressTimer.current = null;
      }
    }

    const newX = window.innerWidth - clientX - (dragRef.current?.offsetWidth || 0) + offset.current.x;
    const newY = window.innerHeight - clientY - (dragRef.current?.offsetHeight || 0) + offset.current.y;

    const boundedPos = {
      x: Math.max(10, Math.min(window.innerWidth - size - 10, newX)),
      y: Math.max(10, Math.min(window.innerHeight - size - 10, newY)),
    };

    setPosition(boundedPos);
  }, [isDragging, size]);

  // معالجة الإفلات
  const handleEnd = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
    if (isDragging) {
      setIsDragging(false);
      try {
        localStorage.setItem(`${storageKeyPrefix}_pos`, JSON.stringify(position));
      } catch {}
    }
  }, [isDragging, position, storageKeyPrefix]);

  useEffect(() => {
    if (isDragging) {
      window.addEventListener("mousemove", handleMove);
      window.addEventListener("mouseup", handleEnd);
      window.addEventListener("touchmove", handleMove, { passive: false });
      window.addEventListener("touchend", handleEnd);
      window.addEventListener("touchcancel", handleEnd);
    }
    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleEnd);
      window.removeEventListener("touchmove", handleMove);
      window.removeEventListener("touchend", handleEnd);
      window.removeEventListener("touchcancel", handleEnd);
    };
  }, [isDragging, handleMove, handleEnd]);

  // معالجة النقر العادي
  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }

    // إذا كان ضغطاً مطولاً أو سحباً، لا ننفذ النقر
    if (hasMovedSignificantly.current || isLongPressTriggered.current) {
      return;
    }

    if (isPickup) {
      if (onOpenPickup) {
        onOpenPickup();
      } else {
        const eventName = isMandoub ? "OPEN_MANDOUB_PICKUP_MODAL" : "OPEN_ADMIN_PICKUP_MODAL";
        window.dispatchEvent(new CustomEvent(eventName, { detail: { orderId } }));
      }
    } else if (isDelivery) {
      if (onOpenDelivery) {
        onOpenDelivery();
      } else {
        const eventName = isMandoub ? "OPEN_MANDOUB_DELIVERY_MODAL" : "OPEN_ADMIN_DELIVERY_MODAL";
        window.dispatchEvent(new CustomEvent(eventName, { detail: { orderId } }));
      }
    }
  };

  // إذا لم يكن استلام ولا تسليم (مثلاً delivered أو ملغى)، لا نظهر أي زر
  if (!isPickup && !isDelivery) {
    return null;
  }

  const btnImageSrc = isPickup
    ? "/images/order-luxury/btn-pickup-floating.png"
    : "/images/order-luxury/btn-delivery-floating.png";

  const btnTitle = isPickup
    ? "استلام الطلب وتسجيل الصادر (اضغط مطولاً للخصائص والإعدادات)"
    : "تسليم الطلب للزبون وتسجيل الوارد (اضغط مطولاً للخصائص والإعدادات)";

  const glowColor = isPickup
    ? "rgba(11, 46, 140, 0.45)"
    : "rgba(255, 193, 7, 0.55)";

  return (
    <>
      {/* --- الزر العائم الحر بهوية وصلي: أزرق للاستلام وأصفر للتسليم --- */}
      <div
        ref={dragRef}
        onMouseDown={handleStart}
        onTouchStart={handleStart}
        onClick={handleClick}
        style={{
          bottom: `${position.y}px`,
          right: `${position.x}px`,
          width: `${size}px`,
          height: `${size}px`,
          opacity: opacity / 100,
          touchAction: "none",
        }}
        className={`fixed z-[105] select-none transition-[opacity,transform] duration-150 cursor-pointer ${
          isDragging
            ? "scale-105 opacity-80 cursor-grabbing"
            : "hover:scale-105 active:scale-90"
        }`}
        title={btnTitle}
      >
        <div
          className={`relative w-full h-full rounded-full flex flex-col items-center justify-center transition-all overflow-hidden border-[3px] ${
            isPickup
              ? "bg-gradient-to-tr from-[#0B2E8C] via-[#153E9B] to-[#1E4DB7] border-[#FFC107] shadow-[0_8px_24px_rgba(11,46,140,0.5),inset_0_2px_4px_rgba(255,255,255,0.35)]"
              : "bg-gradient-to-tr from-[#FFA000] via-[#FFB300] to-[#FFC107] border-white shadow-[0_8px_24px_rgba(255,193,7,0.6),inset_0_2px_4px_rgba(255,255,255,0.6)]"
          }`}
          style={{
            filter: `drop-shadow(0 6px 16px ${glowColor})`,
          }}
        >
          {/* حلقة نبض ناعمة لجذب الانتباه */}
          <div
            className="absolute inset-0 rounded-full animate-ping opacity-25 pointer-events-none"
            style={{
              backgroundColor: isPickup ? "#0B2E8C" : "#FFC107",
              animationDuration: "3.5s",
            }}
          />

          {/* محتوى الزر بهوية وصلي: أيقونة + نص واضح */}
          {isPickup ? (
            <div className="flex flex-col items-center justify-center pointer-events-none leading-none select-none">
              <svg
                className="text-[#FFC107] drop-shadow-sm transition-transform"
                style={{ width: `${Math.round(size * 0.38)}px`, height: `${Math.round(size * 0.38)}px` }}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
              </svg>
              <span
                className="font-black text-[#FFC107] tracking-tight drop-shadow-sm mt-0.5"
                style={{ fontSize: `${Math.max(10, Math.round(size * 0.18))}px` }}
              >
                استلام
              </span>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center pointer-events-none leading-none select-none">
              <svg
                className="text-[#0B2E8C] drop-shadow-sm transition-transform"
                style={{ width: `${Math.round(size * 0.38)}px`, height: `${Math.round(size * 0.38)}px` }}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
                <line x1="12" y1="22.08" x2="12" y2="12" />
              </svg>
              <span
                className="font-black text-[#0B2E8C] tracking-tight drop-shadow-sm mt-0.5"
                style={{ fontSize: `${Math.max(10, Math.round(size * 0.18))}px` }}
              >
                تسليم
              </span>
            </div>
          )}
        </div>
      </div>

      {/* --- نافذة الخصائص والإعدادات المتقدمة للزر العائم (عند الضغط المطول) --- */}
      {showSettingsModal && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200"
          dir="rtl"
          onClick={() => setShowSettingsModal(false)}
        >
          <div
            className="w-full max-w-sm rounded-[24px] border-[2px] border-[#38BDF8] bg-[#FFFFFF] p-5 shadow-[0_12px_40px_rgba(2,132,199,0.25)] text-right relative overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* هيدر نافذة الإعدادات */}
            <div className="flex items-center justify-between border-b border-[#38BDF8]/30 pb-3 mb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#38BDF8] to-[#0284C7] flex items-center justify-center shadow-md text-white">
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="3" />
                    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
                  </svg>
                </div>
                <div>
                  <h4 className="text-sm font-black text-[#0369A1]">إعدادات الزر العائم</h4>
                  <p className="text-[10px] font-bold text-[#0284C7]">تخصيص الحجم والموضع والشفافية</p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowSettingsModal(false)}
                className="w-7 h-7 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold flex items-center justify-center cursor-pointer active:scale-90 transition"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              {/* 1. التحكم بالحجم (تصغير / تكبير) */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-black text-[#0369A1] flex items-center gap-1.5">
                    <span>حجم الزر العائم:</span>
                  </label>
                  <span className="text-xs font-mono font-black text-[#0369A1] bg-[#F0F9FF] px-2 py-0.5 rounded-md border border-[#38BDF8]/40">
                    {size}px
                  </span>
                </div>

                <input
                  type="range"
                  min="48"
                  max="110"
                  step="2"
                  value={size}
                  onChange={(e) => saveSize(Number(e.target.value))}
                  className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-[#0284C7]"
                />

                {/* أزرار سريعة للحجم */}
                <div className="grid grid-cols-3 gap-1.5 mt-2">
                  <button
                    type="button"
                    onClick={() => saveSize(58)}
                    className={`py-1 px-2 rounded-xl text-[11px] font-black border transition active:scale-95 ${
                      size === 58
                        ? "bg-[#0284C7] text-white border-[#0284C7]"
                        : "bg-white text-[#0369A1] border-[#38BDF8]/40 hover:bg-[#F0F9FF]"
                    }`}
                  >
                    صغير (58px)
                  </button>
                  <button
                    type="button"
                    onClick={() => saveSize(76)}
                    className={`py-1 px-2 rounded-xl text-[11px] font-black border transition active:scale-95 ${
                      size === 76
                        ? "bg-[#0284C7] text-white border-[#0284C7]"
                        : "bg-white text-[#0369A1] border-[#38BDF8]/40 hover:bg-[#F0F9FF]"
                    }`}
                  >
                    افتراضي (76px)
                  </button>
                  <button
                    type="button"
                    onClick={() => saveSize(96)}
                    className={`py-1 px-2 rounded-xl text-[11px] font-black border transition active:scale-95 ${
                      size === 96
                        ? "bg-[#0284C7] text-white border-[#0284C7]"
                        : "bg-white text-[#0369A1] border-[#38BDF8]/40 hover:bg-[#F0F9FF]"
                    }`}
                  >
                    كبير (96px)
                  </button>
                </div>
              </div>

              {/* 2. التحكم بالشفافية */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-black text-[#0369A1] flex items-center gap-1.5">
                    <span>معدل الشفافية:</span>
                  </label>
                  <span className="text-xs font-mono font-black text-[#0369A1] bg-[#F0F9FF] px-2 py-0.5 rounded-md border border-[#38BDF8]/40">
                    {opacity}%
                  </span>
                </div>

                <input
                  type="range"
                  min="25"
                  max="100"
                  step="5"
                  value={opacity}
                  onChange={(e) => saveOpacity(Number(e.target.value))}
                  className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-[#0284C7]"
                />

                {/* أزرار سريعة للشفافية */}
                <div className="grid grid-cols-3 gap-1.5 mt-2">
                  <button
                    type="button"
                    onClick={() => saveOpacity(45)}
                    className={`py-1 px-2 rounded-xl text-[11px] font-black border transition active:scale-95 ${
                      opacity === 45
                        ? "bg-[#0284C7] text-white border-[#0284C7]"
                        : "bg-white text-[#0369A1] border-[#38BDF8]/40 hover:bg-[#F0F9FF]"
                    }`}
                  >
                    شفاف (45%)
                  </button>
                  <button
                    type="button"
                    onClick={() => saveOpacity(75)}
                    className={`py-1 px-2 rounded-xl text-[11px] font-black border transition active:scale-95 ${
                      opacity === 75
                        ? "bg-[#0284C7] text-white border-[#0284C7]"
                        : "bg-white text-[#0369A1] border-[#38BDF8]/40 hover:bg-[#F0F9FF]"
                    }`}
                  >
                    متوسط (75%)
                  </button>
                  <button
                    type="button"
                    onClick={() => saveOpacity(100)}
                    className={`py-1 px-2 rounded-xl text-[11px] font-black border transition active:scale-95 ${
                      opacity === 100
                        ? "bg-[#0284C7] text-white border-[#0284C7]"
                        : "bg-white text-[#0369A1] border-[#38BDF8]/40 hover:bg-[#F0F9FF]"
                    }`}
                  >
                    واضح (100%)
                  </button>
                </div>
              </div>

              {/* 3. أزرار إعادة الضبط السريعة */}
              <div className="pt-2 border-t border-[#38BDF8]/20 space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  {/* زر الرجوع لمكانه الأصلي */}
                  <button
                    type="button"
                    onClick={resetPosition}
                    className="py-2 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-[#0369A1] border border-slate-300 text-xs font-black flex items-center justify-center gap-1.5 active:scale-95 transition cursor-pointer"
                  >
                    <span>الرجوع لمكانه الأصلي</span>
                  </button>

                  {/* زر الرجوع لحجمه الأصلي */}
                  <button
                    type="button"
                    onClick={resetSize}
                    className="py-2 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-[#0369A1] border border-slate-300 text-xs font-black flex items-center justify-center gap-1.5 active:scale-95 transition cursor-pointer"
                  >
                    <span>الرجوع لحجمه الأصلي</span>
                  </button>
                </div>

                {/* زر إعادة ضبط الكل */}
                <button
                  type="button"
                  onClick={resetAll}
                  className="w-full py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200 text-[11px] font-black flex items-center justify-center gap-1 active:scale-95 transition cursor-pointer"
                >
                  <span>إعادة ضبط كافة الإعدادات للافتراضي</span>
                </button>
              </div>

              {/* زر الحفظ والإغلاق */}
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => setShowSettingsModal(false)}
                  className="w-full py-2.5 rounded-xl bg-gradient-to-r from-[#0284C7] to-[#0369A1] border border-[#38BDF8] text-xs font-black text-white shadow-md hover:scale-[1.02] active:scale-95 transition cursor-pointer"
                >
                  ✓ تم وحفظ الإعدادات
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
