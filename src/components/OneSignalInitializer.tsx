"use client";

import { useEffect, useRef } from "react";

// قفل عالمي لضمان تنفيذ عملية التهيئة مرة واحدة فقط في الجلسة الواحدة
let globalOneSignalPromise: Promise<void> | null = null;

function withTimeout<T>(promise: Promise<T>, timeoutMs: number = 4000): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("Timeout")), timeoutMs)
    ),
  ]);
}

export function OneSignalInitializer({ externalId }: { externalId?: string }) {
  // تتبع آخر ID تم تسجيل الدخول به لمنع التكرار المزعج في الـ Console
  const lastLoggedIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    let active = true;
    let retryTimeoutId: any = null;
    let loginAttemptsCount = 0;

    const initializeAndLogin = async () => {
      const OneSignal = (window as any).OneSignal;
      if (!OneSignal) return;

      // 1. إدارة عملية التهيئة (Init) بشكل آمن ومنفرد
      if (!globalOneSignalPromise) {
        globalOneSignalPromise = (async () => {
          try {
            // تأخير بسيط لضمان استقرار موارد الصفحة قبل تشغيل الإشعارات
            await new Promise((resolve) => setTimeout(resolve, 1500));

            if (!OneSignal.initialized) {
              await withTimeout(
                OneSignal.init({
                  appId: "aa21547a-4853-4ced-8823-6fd8c778b7b1",
                  allowLocalhostAsSecureOrigin: true,
                  serviceWorkerPath: "OneSignalSDKWorker.js",
                }),
                5000
              ).catch(() => {
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

      // انتظر حتى تكتمل محاولة التهيئة
      try {
        await globalOneSignalPromise;
      } catch (e) {
        console.error("Error waiting for global OneSignal init:", e);
      }

      if (!active) return;

      // 2. إدارة عملية تسجيل الدخول (Login) بشكل متكرر لحين التأكد من نجاحها أو بلوغ الحد الأقصى للمحاولات
      const attemptLogin = async () => {
        if (!active) return;
        
        const currentOneSignal = (window as any).OneSignal;
        if (!currentOneSignal) return;

        if (externalId && lastLoggedIdRef.current !== externalId) {
          if (currentOneSignal.initialized) {
            try {
              console.log(`OneSignal: Attempting login for ${externalId} (Attempt ${loginAttemptsCount + 1})...`);
              // تغليف login بمهلة زمنية
              await withTimeout(currentOneSignal.login(externalId), 4000);
              console.log("✅ OneSignal: Identity set successfully to:", externalId);
              lastLoggedIdRef.current = externalId;
              
              // طلب الإذن إذا لم يكن ممنوحاً بعد
              if (currentOneSignal.Notifications.permission !== "granted") {
                console.log("OneSignal: Permission is not granted yet.");
              }
            } catch (e) {
              console.error("OneSignal Login Error:", e);
              // إعادة المحاولة بعد ثانية إذا لم نصل للحد الأقصى (مثلاً 5 محاولات)
              loginAttemptsCount++;
              if (loginAttemptsCount < 5 && active) {
                retryTimeoutId = setTimeout(attemptLogin, 1500);
              }
            }
          } else {
            // إذا لم يكتمل init بعد، ننتظر ونعيد المحاولة
            loginAttemptsCount++;
            if (loginAttemptsCount < 10 && active) {
              console.log("OneSignal not initialized yet, retrying login check in 1s...");
              retryTimeoutId = setTimeout(attemptLogin, 1000);
            } else {
              console.warn("OneSignal failed to initialize after 10 attempts.");
            }
          }
        }
      };

      await attemptLogin();
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

    return () => {
      active = false;
      if (retryTimeoutId) clearTimeout(retryTimeoutId);
    };
  }, [externalId]);

  return null;
}
