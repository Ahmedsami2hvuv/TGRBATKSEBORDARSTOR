"use client";

import { useEffect } from "react";
import Script from "next/script";

export function OneSignalInitializer({ externalId }: { externalId?: string }) {
  useEffect(() => {
    if (typeof window !== "undefined") {
      window.OneSignalDeferred = window.OneSignalDeferred || [];
      window.OneSignalDeferred.push(async function (OneSignal: any) {
        await OneSignal.init({
          appId: "aa21547a-4853-4ced-8823-6fd8c778b7b1",
          safari_web_id: "web.onesignal.auto.064c4897-400a-426c-829d-648c08974567", // سيتم تحديثه إذا لزم الأمر
          notifyButton: {
            enable: false, // سنستخدم الزر الخاص بنا
          },
          allowLocalhostAsSecureOrigin: true,
        });

        if (externalId) {
          // ربط الجهاز بـ ID المندوب أو المستخدم في نظامنا
          await OneSignal.login(externalId);
          console.log("OneSignal: Logged in with External ID:", externalId);
        }
      });
    }
  }, [externalId]);

  return (
    <Script
      src="https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js"
      strategy="afterInteractive"
    />
  );
}

// تعريف النوع للمتصفح
declare global {
  interface Window {
    OneSignalDeferred: any[];
  }
}
