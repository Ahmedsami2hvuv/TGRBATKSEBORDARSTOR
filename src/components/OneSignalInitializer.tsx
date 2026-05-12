"use client";

import { useEffect } from "react";
import Script from "next/script";
import { usePathname } from "next/navigation";

export function OneSignalInitializer({ externalId }: { externalId?: string }) {
  const pathname = usePathname();

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.OneSignalDeferred = window.OneSignalDeferred || [];
      window.OneSignalDeferred.push(async function (OneSignal: any) {
        try {
          await OneSignal.init({
            appId: "aa21547a-4853-4ced-8823-6fd8c778b7b1",
            safari_web_id: "web.onesignal.auto.064c4897-400a-426c-829d-648c08974567",
            notifyButton: {
              enable: false,
            },
            allowLocalhostAsSecureOrigin: true,
            serviceWorkerParam: { scope: "/" },
            serviceWorkerPath: "OneSignalSDKWorker.js",
          });

          let finalId = externalId;

          // إذا كان المستخدم في لوحة الإدارة ولم يتم تحديد ID له، نربطه بـ admin_global
          if (!finalId && pathname?.startsWith("/admin")) {
            finalId = "admin_global";
          }

          if (finalId) {
            await OneSignal.login(finalId);
            console.log("OneSignal: Device linked to ID:", finalId);
          }
        } catch (error) {
          console.error("OneSignal Init Error:", error);
        }
      });
    }
  }, [externalId, pathname]);

  return (
    <Script
      src="https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js"
      strategy="afterInteractive"
    />
  );
}

declare global {
  interface Window {
    OneSignalDeferred: any[];
  }
}
