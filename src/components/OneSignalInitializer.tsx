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

    const initializeAndLogin = async () => {
      // 1. إدارة عملية التهيئة (Init) بشكل آمن ومنفرد عبر طابور ون سيجنال المؤجل
      if (!globalOneSignalPromise) {
        globalOneSignalPromise = (async () => {
          try {
            await new Promise((resolve) => setTimeout(resolve, 1500));

            return new Promise<void>((resolve, reject) => {
              const windowObj = window as any;
              windowObj.OneSignalDeferred = windowObj.OneSignalDeferred || [];
              windowObj.OneSignalDeferred.push(async (OneSignal: any) => {
                try {
                  if (!windowObj.__onesignal_initialized) {
                    try {
                      await withTimeout(
                        OneSignal.init({
                          appId: "aa21547a-4853-4ced-8823-6fd8c778b7b1",
                          allowLocalhostAsSecureOrigin: true,
                          serviceWorkerPath: "OneSignalSDKWorker.js",
                        }),
                        5000
                      );
                    } catch (initErr) {
                      console.log("OneSignal already initialized or failed in background init:", initErr);
                    }
                    windowObj.__onesignal_initialized = true;
                    console.log("OneSignal successfully initialized via Deferred queue!");
                  }
                  resolve();
                } catch (err) {
                  reject(err);
                }
              });
            });
          } catch (e) {
            console.error("OneSignal Init Error:", e);
          }
        })();
      }

      try {
        await globalOneSignalPromise;
      } catch (e) {
        console.error("Error waiting for global OneSignal init:", e);
      }

      if (!active) return;

      // 2. تسجيل الدخول عبر طابور ون سيجنال المؤجل لضمان تنفيذه بأمان
      if (externalId && lastLoggedIdRef.current !== externalId) {
        const windowObj = window as any;
        windowObj.OneSignalDeferred = windowObj.OneSignalDeferred || [];
        windowObj.OneSignalDeferred.push(async (OneSignal: any) => {
          if (!active) return;
          try {
            console.log(`OneSignal: Attempting login for ${externalId} via Deferred queue...`);
            await withTimeout(OneSignal.login(externalId), 4000);
            console.log("✅ OneSignal: Identity set successfully via Deferred to:", externalId);
            lastLoggedIdRef.current = externalId;
          } catch (e) {
            console.error("OneSignal Login Error via Deferred:", e);
          }
        });
      }
    };

    const windowObj = window as any;
    if (!windowObj.OneSignal) {
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
    };
  }, [externalId]);

  return null;
}
