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
      const target = e.target as HTMLElement | null;
      const isInteractive = target?.closest('button, input, textarea, a, select, [role="button"]');

      // حظر تسرب السحب كلياً على الخلفية والحواف لمنع Pull-to-refresh مع السماح التام للأزرار بالتفاعل والنقر
      if (!isInteractive && e.cancelable) {
        try {
          e.preventDefault();
        } catch {}
      }
    };

    el.addEventListener("touchstart", preventTouchGesture, { passive: false });
    el.addEventListener("touchmove", preventTouchGesture, { passive: false });

    const origOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      el.removeEventListener("touchstart", preventTouchGesture);
      el.removeEventListener("touchmove", preventTouchGesture);
      document.body.style.overflow = origOverflow || "";
      document.body.style.pointerEvents = "";
      document.documentElement.style.overflow = "";
      if (typeof window !== "undefined") {
        try {
          (document.activeElement as HTMLElement)?.blur();
          window.focus();
        } catch {}
      }
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
