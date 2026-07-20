"use client";

import { useState, useEffect, useRef } from "react";

export function PullToRefresh() {
  const [translateY, setTranslateY] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pullProgress, setPullProgress] = useState(0); // من 0 إلى 100 ليتوافق مع النسب

  const startY = useRef(0);
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
    // ----------------------------------------------------
    // أولاً: معالجة أحداث اللمس للهواتف والتابلت
    // ----------------------------------------------------
    const handleTouchStart = (e: TouchEvent) => {
      const scrollTop = window.scrollY || window.pageYOffset || document.documentElement.scrollTop || document.body.scrollTop || 0;
      if (scrollTop <= 10 && !isRefreshingRef.current) {
        startY.current = e.touches[0].clientY;
        isPulling.current = true;
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!isPulling.current || isRefreshingRef.current) return;

      const currentY = e.touches[0].clientY;
      const pullDistance = currentY - startY.current;

      if (pullDistance > 0) {
        if (e.cancelable) {
          e.preventDefault();
        }

        const resistance = 0.4;
        const rawDistance = pullDistance * resistance;
        const distance = Math.min(rawDistance, 100);

        translateYRef.current = distance;
        setTranslateY(distance);
        setPullProgress(Math.min((distance / 70) * 100, 150));
        setIsVisible(true);
      } else {
        isPulling.current = false;
        resetPull();
      }
    };

    const handleTouchEnd = () => {
      if (!isPulling.current || isRefreshingRef.current) return;
      isPulling.current = false;

      if (translateYRef.current >= 70) {
        triggerRefresh();
      } else {
        resetPull();
      }
    };

    // ----------------------------------------------------
    // ثانياً: معالجة أحداث عجلة الماوس والـ Touchpad للكمبيوتر
    // ----------------------------------------------------
    const handleWheel = (e: WheelEvent) => {
      const scrollTop = window.scrollY || window.pageYOffset || document.documentElement.scrollTop || document.body.scrollTop || 0;
      
      // إذا كان المستخدم في أعلى الصفحة وقام بالتمرير للأعلى (deltaY < 0 تعني التمرير للأعلى)
      if (scrollTop <= 5 && e.deltaY < 0 && !isRefreshingRef.current) {
        if (pullTimeoutRef.current) {
          clearTimeout(pullTimeoutRef.current);
        }

        accumulatedDeltaRef.current += Math.abs(e.deltaY);
        
        const threshold = 220; // نفس قيمة العتبة المستخدمة في لوحة المدير
        const progress = Math.min(100, (accumulatedDeltaRef.current / threshold) * 100);
        
        // محاكاة الإزاحة البصرية (translateY) بناءً على التقدم
        const visualDistance = (progress / 100) * 75; // نصل لأقصى ارتفاع 75 بكسل
        setTranslateY(visualDistance);
        setPullProgress(progress);
        setIsVisible(true);

        if (accumulatedDeltaRef.current >= threshold) {
          triggerRefresh();
        } else {
          pullTimeoutRef.current = setTimeout(() => {
            resetPull();
          }, 800);
        }
      }
    };

    const triggerRefresh = () => {
      setIsRefreshing(true);
      isRefreshingRef.current = true;
      setTranslateY(60);
      translateYRef.current = 60;
      
      setTimeout(() => {
        window.location.reload();
      }, 800);
    };

    const resetPull = () => {
      translateYRef.current = 0;
      accumulatedDeltaRef.current = 0;
      setTranslateY(0);
      setPullProgress(0);
      setTimeout(() => {
        setIsVisible(false);
      }, 300);
    };

    // تسجيل المستمعين على الجوال والكمبيوتر
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

  // نسبة الدوران بناءً على pullProgress
  const rotation = (pullProgress / 100) * 360;

  return (
    <div
      style={{
        transform: `translate3d(-50%, ${translateY}px, 0)`,
        opacity: isVisible || isRefreshing ? 1 : 0,
        transition: isPulling.current ? "none" : "transform 0.3s cubic-bezier(0.1, 0.9, 0.2, 1), opacity 0.3s ease",
      }}
      className="fixed left-1/2 top-[-50px] z-[99999] flex h-11 w-11 -translate-x-1/2 items-center justify-center rounded-full border border-slate-200/60 bg-white/90 shadow-lg backdrop-blur-md transition-all duration-300 dark:border-slate-800/60 dark:bg-slate-900/90"
    >
      {isRefreshing ? (
        // أيقونة التحميل الدائرية الدوارة (Spinner)
        <svg
          className="h-5 w-5 animate-spin text-sky-600 dark:text-sky-400"
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
        // أيقونة السهم الدائري التي تزداد دورانها ووضوحها مع السحب
        <svg
          style={{
            transform: `rotate(${rotation}deg)`,
            opacity: Math.min(pullProgress / 100, 1),
            transition: "transform 0.1s linear",
          }}
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={3}
          stroke="currentColor"
          className="h-5 w-5 text-sky-600 dark:text-sky-400"
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
