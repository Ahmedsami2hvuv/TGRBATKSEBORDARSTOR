"use client";

import { useEffect } from "react";
import OneSignal from "react-onesignal";
import { usePathname } from "next/navigation";

interface OneSignalInitializerProps {
  externalId?: string;
}

export default function OneSignalInitializer({ externalId }: OneSignalInitializerProps) {
  const pathname = usePathname();

  useEffect(() => {
    const initOneSignal = async () => {
      try {
        if (typeof window !== "undefined") {
          await OneSignal.init({
            appId: "aa21547a-4853-4ced-8823-6fd8c778b7b1",
            allowLocalhostAsSecureOrigin: true,
            serviceWorkerPath: "OneSignalSDKWorker.js",
            serviceWorkerParam: { scope: "/" },
            notificationDisplayPredicate: () => {
              // إجبار ظهور الإشعار دائماً حتى لو كان الموقع مفتوحاً
              return true;
            },
            promptOptions: {
              slidedown: {
                enabled: true,
                autoPrompt: true,
                timeDelay: 3,
                pageViews: 1,
              },
            },
          });

          let finalId = externalId;

          // إذا كان في لوحة الإدارة نربطه بـ admin_global لضمان وصول الإشعارات
          if (!finalId && pathname?.startsWith("/admin")) {
            finalId = "admin_global";
          }

          if (finalId) {
            await OneSignal.login(finalId);
            console.log("✅ [OneSignal] Linked Device to ID:", finalId);
          }

          // طلب الإذن إذا لم يكن ممنوحاً
          if (OneSignal.Notifications.permission !== "granted") {
            console.log("🔔 [OneSignal] Requesting permission...");
            await OneSignal.Notifications.requestPermission();
          }
        }
      } catch (error) {
        console.error("❌ [OneSignal] Init Error:", error);
      }
    };

    initOneSignal();
  }, [externalId, pathname]);

  return null;
}
