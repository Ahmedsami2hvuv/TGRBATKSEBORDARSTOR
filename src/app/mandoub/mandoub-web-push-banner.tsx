"use client";

import { useEffect, useState } from "react";

export function MandoubWebPushBanner() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const key = "mandoubPushBannerShown_v1";
    if (typeof window === "undefined") return;

    // إذا تم إظهار البانر سابقاً خلال آخر 7 أيام، لا نكرره
    try {
      const v = localStorage.getItem(key);
      if (v) {
        const ts = parseInt(v, 10);
        if (!isNaN(ts)) {
          const sevenDays = 7 * 24 * 60 * 60 * 1000;
          if (Date.now() - ts < sevenDays) return;
        }
      }
    } catch {}

    const checkPermission = async () => {
      const OneSignal = (window as any).OneSignal;
      if (OneSignal) {
        // إذا لم يكن الإذن ممنوحاً، نظهر البانر
        if (OneSignal.Notifications.permission !== "granted") {
          setShow(true);
          try {
            localStorage.setItem(key, String(Date.now()));
          } catch {}
        }
      }
    };

    // فحص بعد 3 ثوانٍ من التحميل
    const timer = setTimeout(checkPermission, 3000);
    return () => clearTimeout(timer);
  }, []);

  const handleEnable = async () => {
    const OneSignal = (window as any).OneSignal;
    if (OneSignal) {
      try {
        await OneSignal.Notifications.requestPermission();
        setShow(false);
        try {
          localStorage.setItem("mandoubPushBannerShown_v1", String(Date.now()));
        } catch {}
      } catch (err) {
        console.error("Error requesting permission", err);
      }
    }
  };

  if (!show) return null;

  return (
    <div className="mb-4 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-700 p-4 text-white shadow-lg animate-pulse">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="text-2xl">🔔</span>
          <div>
            <p className="text-sm font-bold">فعل التنبيهات ليصلك جديد الطلبات!</p>
            <p className="text-[10px] opacity-80">اضغط تفعيل ثم اختر "Allow" أو "سماح"</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleEnable}
            className="rounded-lg bg-white px-4 py-2 text-xs font-black text-blue-700 shadow-sm hover:bg-blue-50"
          >
            تفعيل الآن
          </button>
          <button
            onClick={() => {
              try {
                localStorage.setItem("mandoubPushBannerShown_v1", String(Date.now()));
              } catch {}
              setShow(false);
            }}
            aria-label="إغلاق"
            className="rounded-full bg-white/20 px-3 py-1 text-xs font-bold text-white hover:bg-white/30"
          >
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
}
