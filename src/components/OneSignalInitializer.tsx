"use client";

import { useEffect } from "react";

export function OneSignalInitializer({ externalId }: { externalId?: string }) {
  useEffect(() => {
    if (typeof window !== "undefined") {
      const init = async () => {
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
              console.log("✅ OneSignal: Mandoub linked:", externalId);
            }
          } catch (e) {
            console.error("OneSignal Init Error:", e);
          }
        }
      };

      // تحميل السكربت ديناميكياً إذا لم يكن موجوداً
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
