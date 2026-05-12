"use client";

import { useEffect } from "react";

export function OneSignalInitializer({ externalId }: { externalId?: string }) {
  useEffect(() => {
    if (typeof window !== "undefined") {
      const init = async () => {
        // تأخير لمدة 5 ثوانٍ لضمان استقرار الموقع تماماً قبل تشغيل الإشعارات
        await new Promise((resolve) => setTimeout(resolve, 5000));

        const OneSignal = (window as any).OneSignal;
        if (OneSignal) {
          try {
            await OneSignal.init({
              appId: "aa21547a-4853-4ced-8823-6fd8c778b7b1",
              allowLocalhostAsSecureOrigin: true,
              serviceWorkerPath: "OneSignalSDKWorker.js",
            });

            if (externalId) {
              await OneSignal.login(externalId);
              console.log("✅ OneSignal: Identity set to:", externalId);

              // طلب الإذن بهدوء إذا لم يكن ممنوحاً
              if (OneSignal.Notifications.permission !== "granted") {
                console.log("OneSignal: Requesting permission...");
              }
            }
          } catch (e) {
            console.error("OneSignal Init Error:", e);
          }
        }
      };

      if (!(window as any).OneSignal) {
        const script = document.createElement("script");
        script.src = "https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js";
        script.async = true;
        script.onload = init;
        document.head.appendChild(script);
      } else {
        init();
      }
    }
  }, [externalId]);

  return null;
}
