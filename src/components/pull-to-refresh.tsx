"use client";

import { useState, useEffect, useRef } from "react";

export function PullToRefresh() {
  const [translateY, setTranslateY] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pullProgress, setPullProgress] = useState(0); // من 0 إلى 100

  const startY = useRef(0);
  const startX = useRef(0);
  const isPulling = useRef(false);
  const translateYRef = useRef(0);
  const isRefreshingRef = useRef(false);

  // لتجميع حركة عجلة الماوس (Wheel) على الكمبيوتر
  const accumulatedDeltaRef = useRef(0);
  const pullTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // تحديث المرجع عند تغير حالة التحديث
  useEffect(() => {
    isRefreshingRef.current = isRefreshing;
  }, [isRefreshing]);

  useEffect(() => {
    // دالة ذكية جداً للتحقق مما إذا كان المستخدم في أعلى التمرير تماماً أم قام بالتمرير للأسفل
    const isAtTopOfScroll = (target: EventTarget | null): boolean => {
      // 1. التمرير الأساسي للصفحة
      const windowScrollTop = window.scrollY || window.pageYOffset || document.documentElement.scrollTop || document.body.scrollTop || 0;
      if (windowScrollTop > 5) return false;

      // 2. فحص الحاويات الداخلية القابلة للتمرير (مثل main أو أي div بداخل Dashboard)
      let el = target as HTMLElement | null;
      while (el && el !== document.body && el !== document.documentElement) {
        // استثناء المكون نفسه
        if (el.id === "kse-pull-to-refresh-indicator") {
          el = el.parentElement;
          continue;
        }

        const style = window.getComputedStyle(el);
        const overflowY = style.overflowY;
        const isScrollable = (overflowY === "auto" || overflowY === "scroll") && el.scrollHeight > el.clientHeight;

        // إذا كان العنصر قابل للتمرير وكان المستخدم قد نزل فيه أكثر من 5 بكسل
        if (isScrollable && el.scrollTop > 5) {
          return false;
        }

        // إذا كان هناك مودال أو نافذة منبثقة عائمة مفتوحة والمستخدم نزل فيها
        if (el.getAttribute("role") === "dialog" || el.classList.contains("modal") || el.getAttribute("aria-modal") === "true") {
          if (el.scrollTop > 5) return false;
        }

        el = el.parentElement;
      }

      return true;
    };

    // ----------------------------------------------------
    // معالجة أحداث اللمس للهواتف والأندرويد والتابلت
    // ----------------------------------------------------
    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 1 || isRefreshingRef.current) return;

      if (isAtTopOfScroll(e.target)) {
        startY.current = e.touches[0].clientY;
        startX.current = e.touches[0].clientX;
        isPulling.current = true;
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!isPulling.current || isRefreshingRef.current) return;
      if (e.touches.length !== 1) return;

      const currentY = e.touches[0].clientY;
      const currentX = e.touches[0].clientX;
      const pullDistanceY = currentY - startY.current;
      const pullDistanceX = Math.abs(currentX - startX.current);

      // السحب فقط إذا كانت الحركة رأسية للأسفل (أكبر من الحركة الأفقية)
      if (pullDistanceY > 0 && pullDistanceY > pullDistanceX) {
        if (!isAtTopOfScroll(e.target)) {
          isPulling.current = false;
          resetPull();
          return;
        }

        if (e.cancelable) {
          e.preventDefault();
        }

        const resistance = 0.42;
        const rawDistance = pullDistanceY * resistance;
        const distance = Math.min(rawDistance, 85);

        translateYRef.current = distance;
        setTranslateY(distance);
        setPullProgress(Math.min((distance / 55) * 100, 150));
        setIsVisible(true);
      } else if (pullDistanceY < -10) {
        isPulling.current = false;
        resetPull();
      }
    };

    const handleTouchEnd = () => {
      if (!isPulling.current || isRefreshingRef.current) return;
      isPulling.current = false;

      if (translateYRef.current >= 55) {
        triggerRefresh();
      } else {
        resetPull();
      }
    };

    // ----------------------------------------------------
    // معالجة أحداث عجلة الماوس والـ Touchpad للكمبيوتر
    // ----------------------------------------------------
    const handleWheel = (e: WheelEvent) => {
      if (!isAtTopOfScroll(e.target) || isRefreshingRef.current) {
        return;
      }

      if (e.deltaY < 0) {
        if (pullTimeoutRef.current) {
          clearTimeout(pullTimeoutRef.current);
        }

        accumulatedDeltaRef.current += Math.abs(e.deltaY);
        const threshold = 180;
        const progress = Math.min(100, (accumulatedDeltaRef.current / threshold) * 100);
        const visualDistance = (progress / 100) * 70;

        setTranslateY(visualDistance);
        setPullProgress(progress);
        setIsVisible(true);

        if (accumulatedDeltaRef.current >= threshold) {
          triggerRefresh();
        } else {
          pullTimeoutRef.current = setTimeout(() => {
            resetPull();
          }, 600);
        }
      }
    };

    const triggerRefresh = () => {
      setIsRefreshing(true);
      isRefreshingRef.current = true;
      setTranslateY(55);
      translateYRef.current = 55;

      if (typeof navigator !== "undefined" && navigator.vibrate) {
        try {
          navigator.vibrate(60);
        } catch (e) {}
      }

      setTimeout(() => {
        window.location.reload();
      }, 400);
    };

    const resetPull = () => {
      translateYRef.current = 0;
      accumulatedDeltaRef.current = 0;
      setTranslateY(0);
      setPullProgress(0);
      setTimeout(() => {
        setIsVisible(false);
      }, 250);
    };

    window.addEventListener("touchstart", handleTouchStart, { passive: true });
    window.addEventListener("touchmove", handleTouchMove, { passive: false });
    window.addEventListener("touchend", handleTouchEnd, { passive: true });

    window.addEventListener("wheel", handleWheel, { passive: true });

    return () => {
      window.removeEventListener("touchstart", handleTouchStart);
      window.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("touchend", handleTouchEnd);
      window.removeEventListener("wheel", handleWheel);

      if (pullTimeoutRef.current) {
        clearTimeout(pullTimeoutRef.current);
      }
    };
  }, []);

  if (!isVisible && !isRefreshing) return null;

  const rotation = (pullProgress / 100) * 360;

  return (
    <div
      id="kse-pull-to-refresh-indicator"
      style={{
        transform: `translate3d(-50%, ${translateY}px, 0)`,
        opacity: isVisible || isRefreshing ? 1 : 0,
        transition: isPulling.current ? "none" : "transform 0.25s cubic-bezier(0.1, 0.9, 0.2, 1), opacity 0.2s ease",
      }}
      className="fixed left-1/2 top-[-50px] z-[999999] flex h-11 w-11 -translate-x-1/2 items-center justify-center rounded-full border border-sky-400/40 bg-white shadow-xl backdrop-blur-md dark:border-sky-500/40 dark:bg-slate-900"
    >
      {isRefreshing ? (
        <svg
          className="h-5 w-5 animate-spin text-sky-500 dark:text-[#00f3ff]"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
      ) : (
        <svg
          style={{
            transform: `rotate(${rotation}deg)`,
            opacity: Math.min(pullProgress / 100, 1),
            transition: "transform 0.05s linear",
          }}
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={3}
          stroke="currentColor"
          className="h-5 w-5 text-sky-500 dark:text-[#00f3ff]"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99"
          />
        </svg>
      )}
    </div>
  );
}
