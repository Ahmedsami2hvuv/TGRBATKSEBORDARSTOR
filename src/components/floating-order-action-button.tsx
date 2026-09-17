"use client";

import React, { useState, useEffect, useRef } from "react";

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

  // موضع الزر الافتراضي (في أسفل يمين الشاشة مع هامش مريح)
  const [position, setPosition] = useState({ x: 20, y: 110 });
  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef<HTMLDivElement>(null);
  const startCoord = useRef({ x: 0, y: 0 });
  const offset = useRef({ x: 0, y: 0 });
  const hasMovedSignificantly = useRef(false);

  // استرجاع الموضع المحفوظ
  useEffect(() => {
    try {
      const saved = localStorage.getItem(`${storageKeyPrefix}_pos`);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (typeof parsed.x === "number" && typeof parsed.y === "number") {
          const boundedX = Math.max(10, Math.min(window.innerWidth - 90, parsed.x));
          const boundedY = Math.max(10, Math.min(window.innerHeight - 90, parsed.y));
          setPosition({ x: boundedX, y: boundedY });
        }
      }
    } catch {
      // تجاهل أخطاء التخزين المحلي
    }
  }, [storageKeyPrefix]);

  const handleStart = (e: React.MouseEvent | React.TouchEvent) => {
    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
    const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;

    startCoord.current = { x: clientX, y: clientY };
    hasMovedSignificantly.current = false;
    setIsDragging(true);

    if (dragRef.current) {
      const rect = dragRef.current.getBoundingClientRect();
      offset.current = {
        x: clientX - rect.left,
        y: clientY - rect.top,
      };
    }
  };

  const handleMove = (e: MouseEvent | TouchEvent) => {
    if (!isDragging) return;
    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
    const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;

    const dx = Math.abs(clientX - startCoord.current.x);
    const dy = Math.abs(clientY - startCoord.current.y);
    if (dx > 5 || dy > 5) {
      hasMovedSignificantly.current = true;
    }

    const newX = window.innerWidth - clientX - (dragRef.current?.offsetWidth || 0) + offset.current.x;
    const newY = window.innerHeight - clientY - (dragRef.current?.offsetHeight || 0) + offset.current.y;

    const boundedPos = {
      x: Math.max(10, Math.min(window.innerWidth - 85, newX)),
      y: Math.max(10, Math.min(window.innerHeight - 85, newY)),
    };

    setPosition(boundedPos);
  };

  const handleEnd = () => {
    if (isDragging) {
      setIsDragging(false);
      try {
        localStorage.setItem(`${storageKeyPrefix}_pos`, JSON.stringify(position));
      } catch {}
    }
  };

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
  }, [isDragging, position]);

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (hasMovedSignificantly.current) {
      return; // كان سحباً وليس نقرة
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
    ? "استلام الطلب وتسجيل الصادر (أعطيت للمحل/المجهز) 💸"
    : "تسليم الطلب للزبون وتسجيل الوارد (أخذت من الزبون) 📦";

  const glowColor = isPickup
    ? "rgba(10, 61, 46, 0.45)"
    : "rgba(197, 48, 48, 0.45)";

  return (
    <div
      ref={dragRef}
      onMouseDown={handleStart}
      onTouchStart={handleStart}
      onClick={handleClick}
      style={{
        bottom: `${position.y}px`,
        right: `${position.x}px`,
        touchAction: "none",
      }}
      className={`fixed z-[105] select-none transition-transform duration-75 cursor-pointer ${
        isDragging
          ? "scale-110 opacity-75 cursor-grabbing"
          : "hover:scale-105 active:scale-95"
      }`}
      title={btnTitle}
    >
      <div
        className="relative w-[70px] h-[70px] sm:w-[78px] sm:h-[78px] rounded-full flex items-center justify-center p-1 bg-white/95 dark:bg-slate-900/95 border-[2px] border-[#C9A86A] shadow-[0_8px_24px_rgba(0,0,0,0.25)] backdrop-blur-md transition-all"
        style={{
          boxShadow: `0 8px 24px ${glowColor}, 0 2px 8px rgba(201, 168, 106, 0.35)`,
        }}
      >
        {/* حلقة نبض ناعمة لجذب انتباه المندوب */}
        <div
          className="absolute inset-0 rounded-full animate-ping opacity-25 pointer-events-none"
          style={{
            backgroundColor: isPickup ? "#0A3D2E" : "#C53030",
            animationDuration: "3s",
          }}
        />

        {/* صورة الزر الفاخر */}
        <img
          src={btnImageSrc}
          alt={isPickup ? "استلام" : "تسليم"}
          className="w-full h-full object-contain pointer-events-none drop-shadow-md rounded-full"
          draggable={false}
        />
      </div>
    </div>
  );
}
