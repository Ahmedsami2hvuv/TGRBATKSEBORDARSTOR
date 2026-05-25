"use client";

import { useEffect, useRef } from "react";

// قفل عالمي لضمان تنفيذ عملية التهيئة مرة واحدة فقط في الجلسة الواحدة
let globalOneSignalPromise: Promise<void> | null = null;

export function OneSignalInitializer({ externalId }: { externalId?: string }) {
  // تتبع آخر ID تم تسجيل الدخول به لمنع التكرار المزعج في الـ Console
  const lastLoggedIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const initializeAndLogin = async () => {
      const OneSignal = (window as any).OneSignal;
      if (!OneSignal) return;

      // 1. إدارة عملية التهيئة (Init) بشكل آمن ومنفرد
      if (!globalOneSignalPromise) {
        globalOneSignalPromise = (async () => {
          try {
            // تأخير بسيط لضمان استقرار موارد الصفحة قبل تشغيل الإشعارات
            await new Promise((resolve) => setTimeout(resolve, 3000));

            if (!OneSignal.initialized) {
              await OneSignal.init({
                appId: "aa21547a-4853-4ced-8823-6fd8c778b7b1",
                allowLocalhostAsSecureOrigin: true,
                serviceWorkerPath: "OneSignalSDKWorker.js",
              }).catch(() => {
                // كتم أي خطأ يصدر أثناء التهيئة إذا كانت المكتبة جاهزة بالفعل
              });
            }
          } catch (e: any) {
            // إذا كانت المكتبة مهيئة، فلا داعي لطباعة أي خطأ
            if (!(window as any).OneSignal?.initialized) {
              console.error("OneSignal Init Error:", e);
            }
          }
        })();
      }

      // انتظر حتى تكتمل محاولة التهيئة (سواء نجحت أو كانت مهيئة مسبقاً)
      await globalOneSignalPromise;

      // 2. إدارة عملية تسجيل الدخول (Login)
      if (externalId && lastLoggedIdRef.current !== externalId) {
        try {
          if (OneSignal.initialized) {
            await OneSignal.login(externalId);
            console.log("✅ OneSignal: Identity set to:", externalId);
            lastLoggedIdRef.current = externalId;

            // طلب الإذن إذا لم يكن ممنوحاً
            if (OneSignal.Notifications.permission !== "granted") {
              console.log("OneSignal: Requesting permission...");
            }
          }
        } catch (e) {
          console.error("OneSignal Login Error:", e);
        }
      }
    };

    if (!(window as any).OneSignal) {
      const script = document.createElement("script");
      script.src = "https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js";
      script.async = true;
      script.onload = initializeAndLogin;
      document.head.appendChild(script);
    } else {
      initializeAndLogin();
    }
  }, [externalId]);

  return null;
}
