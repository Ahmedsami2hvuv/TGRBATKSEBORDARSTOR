"use client";

import { useState, useEffect, useRef } from "react";

export function FloatingReloadButton() {
  const [position, setPosition] = useState({ x: 20, y: 90 }); // موضع افتراضي لتجنب التداخل
  const [isDragging, setIsDragging] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const dragRef = useRef<HTMLButtonElement>(null);
  const offset = useRef({ x: 0, y: 0 });

  useEffect(() => {
    // التحقق من البيئة وأننا لسنا داخل WebView للتطبيق
    if (typeof window !== "undefined") {
      const ua = window.navigator.userAgent || "";
      // WebView على أندرويد يحتوي عادةً على "; wv" أو "WebView" أو "Version/" مع Android
      const isApp = 
        ua.includes("; wv") || 
        ua.includes("WebView") || 
        (ua.includes("Android") && ua.includes("Version/")) ||
        (window as any).Android !== undefined; // فحص إضافي لوجود واجهة أندرويد

      if (!isApp) {
        setIsVisible(true);
      }
    }

    const saved = localStorage.getItem("reload_btn_pos");
    if (saved) {
      try {
        setPosition(JSON.parse(saved));
      } catch (e) {}
    }
  }, []);

  const handleStart = (e: any) => {
    setIsDragging(true);
    const clientX = e.type === "touchstart" ? e.touches[0].clientX : e.clientX;
    const clientY = e.type === "touchstart" ? e.touches[0].clientY : e.clientY;

    if (dragRef.current) {
      const rect = dragRef.current.getBoundingClientRect();
      offset.current = {
        x: clientX - rect.left,
        y: clientY - rect.top,
      };
    }
  };

  const handleMove = (e: any) => {
    if (!isDragging) return;
    const clientX = e.type === "touchmove" ? e.touches[0].clientX : e.clientX;
    const clientY = e.type === "touchmove" ? e.touches[0].clientY : e.clientY;

    // الحفاظ على الأبعاد والمسافات وضمان البقاء داخل الشاشة
    const newX = window.innerWidth - clientX - (dragRef.current?.offsetWidth || 0) + offset.current.x;
    const newY = window.innerHeight - clientY - (dragRef.current?.offsetHeight || 0) + offset.current.y;

    const nextPos = {
      x: Math.max(10, Math.min(window.innerWidth - 60, newX)),
      y: Math.max(10, Math.min(window.innerHeight - 60, newY)),
    };

    setPosition(nextPos);
  };

  const handleEnd = () => {
    if (isDragging) {
      setIsDragging(false);
      localStorage.setItem("reload_btn_pos", JSON.stringify(position));
    }
  };

  useEffect(() => {
    if (isDragging) {
      window.addEventListener("mousemove", handleMove);
      window.addEventListener("mouseup", handleEnd);
      window.addEventListener("touchmove", handleMove, { passive: false });
      window.addEventListener("touchend", handleEnd);
    }
    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleEnd);
      window.removeEventListener("touchmove", handleMove);
      window.removeEventListener("touchend", handleEnd);
    };
  }, [isDragging]);

  if (!isVisible) return null;

  return (
    <button
      ref={dragRef}
      onMouseDown={handleStart}
      onTouchStart={handleStart}
      onClick={() => {
        if (!isDragging) {
          window.location.reload();
        }
      }}
      style={{
        bottom: `${position.y}px`,
        right: `${position.x}px`,
        touchAction: "none",
      }}
      className={`fixed z-[9999] w-12 h-12 rounded-full shadow-2xl flex items-center justify-center transition-all bg-sky-500/90 dark:bg-sky-600/90 text-white border border-sky-400/30 dark:border-sky-500/30 backdrop-blur-md active:scale-90 ${
        isDragging ? "scale-110 opacity-70 cursor-grabbing" : "cursor-pointer hover:scale-105 hover:bg-sky-500 dark:hover:bg-sky-600 shadow-sky-500/20"
      }`}
      title="إعادة تحميل الصفحة"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={2.5}
        stroke="currentColor"
        className="w-5 h-5 animate-pulse"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99"
        />
      </svg>
    </button>
  );
}
