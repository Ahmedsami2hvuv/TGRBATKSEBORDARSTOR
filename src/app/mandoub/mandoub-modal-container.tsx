"use client";

import { useEffect, useRef, type ReactNode } from "react";

export function MandoubModalContainer({
  children,
  onClose,
  className = "",
}: {
  children: ReactNode;
  onClose?: () => void;
  className?: string;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const preventTouchGesture = (e: TouchEvent) => {
      // حظر تسرب السحب كلياً لمتصفح الأندرويد ومنع Pull-to-refresh
      if (e.cancelable) {
        try {
          e.preventDefault();
        } catch {}
      }
      try {
        e.stopPropagation();
      } catch {}
    };

    el.addEventListener("touchstart", preventTouchGesture, { passive: false });
    el.addEventListener("touchmove", preventTouchGesture, { passive: false });

    const origOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      el.removeEventListener("touchstart", preventTouchGesture);
      el.removeEventListener("touchmove", preventTouchGesture);
      document.body.style.overflow = origOverflow;
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className={`fixed inset-0 z-[1200] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-md overflow-y-auto ${className}`}
      style={{ touchAction: "none", overscrollBehavior: "none" }}
      dir="rtl"
      onClick={(e) => {
        if (e.target === containerRef.current && onClose) {
          onClose();
        }
      }}
    >
      {children}
    </div>
  );
}
