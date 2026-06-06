"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";

type Auth = { c: string; exp?: string; s: string };

function withTimeout<T>(promise: Promise<T>, timeoutMs: number = 2000): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("Timeout")), timeoutMs)
    ),
  ]);
}

export function MandoubNotificationsDiagnostics({ auth }: { auth: Auth }) {
  const [isActive, setIsActive] = useState<boolean | null>(null);
  const checkIntervalRef = useRef<any>(null);

  const checkStatus = async () => {
    if (typeof window === "undefined") return;

    // 1. فحص الدعم والإذن العام للمتصفح أولاً
    const supported = "Notification" in window;
    if (!supported || Notification.permission !== "granted") {
      setIsActive(false);
      return;
    }

    if (checkIntervalRef.current) {
      clearInterval(checkIntervalRef.current);
      checkIntervalRef.current = null;
    }

    // 2. استخدام طابور ون سيجنال المؤجل لضمان تحميل وتهيئة المكتبة أولاً
    const windowObj = window as any;
    windowObj.OneSignalDeferred = windowObj.OneSignalDeferred || [];
    windowObj.OneSignalDeferred.push(async (OneSignal: any) => {
      if (!OneSignal.Notifications.permission) {
        setIsActive(false);
        return;
      }

      let attempts = 0;
      const maxAttempts = 8;

      const tryCheck = async () => {
        try {
          if (OneSignal.User && typeof OneSignal.User.getExternalId === "function") {
            const extId = await OneSignal.User.getExternalId();
            if (extId === auth.c) {
              setIsActive(true);
              return true;
            }
          }
        } catch (err) {
          console.error("Error reading OneSignal External ID in status check attempt:", err);
        }
        return false;
      };

      // محاولة أولى فورية
      const success = await tryCheck();
      if (success) return;

      // محاولات متكررة في الخلفية للتعامل مع تأخر استرجاع الجلسة
      checkIntervalRef.current = setInterval(async () => {
        attempts++;
        const ok = await tryCheck();
        if (ok || attempts >= maxAttempts) {
          if (checkIntervalRef.current) {
            clearInterval(checkIntervalRef.current);
            checkIntervalRef.current = null;
          }
          if (!ok) {
            setIsActive(false);
          }
        }
      }, 1000);
    });
  };

  useEffect(() => {
    void checkStatus();
    return () => {
      if (checkIntervalRef.current) {
        clearInterval(checkIntervalRef.current);
        checkIntervalRef.current = null;
      }
    };
  }, [auth.c]);

  const targetUrl = `/mandoub/settings/notifications?c=${auth.c}&s=${auth.s}${auth.exp ? `&exp=${auth.exp}` : ""}`;

  return (
    <Link
      href={targetUrl}
      className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border-2 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm hover:scale-105 active:scale-95 transition-all duration-200"
      title="إعدادات وحالة الإشعارات"
    >
      <span className="text-lg">🔔</span>
      {/* نقطة الحالة الدائرية */}
      <span className="absolute -top-1.5 -right-1.5 flex h-4 w-4">
        {isActive === true ? (
          <>
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-4 w-4 bg-emerald-500 border-2 border-white dark:border-slate-900" title="الإشعارات مفعلة ونشطة"></span>
          </>
        ) : isActive === false ? (
          <span className="relative inline-flex rounded-full h-4 w-4 bg-rose-500 border-2 border-white dark:border-slate-900" title="الإشعارات غير مفعلة"></span>
        ) : (
          <span className="relative inline-flex rounded-full h-4 w-4 bg-amber-500 border-2 border-white dark:border-slate-900 animate-pulse" title="جاري فحص الإشعارات..."></span>
        )}
      </span>
    </Link>
  );
}
