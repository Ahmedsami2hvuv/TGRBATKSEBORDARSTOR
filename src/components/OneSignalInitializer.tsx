"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

interface OneSignalInitializerProps {
  externalId?: string;
}

declare global {
  interface Window {
    OneSignal: any;
  }
}

export default function OneSignalInitializer({ externalId }: OneSignalInitializerProps) {
  const pathname = usePathname();

  useEffect(() => {
    const initOneSignal = async () => {
      try {
        if (typeof window !== "undefined") {
          window.OneSignal = window.OneSignal || [];

          await window.OneSignal.init({
            appId: "aa21547a-4853-4ced-8823-6fd8c778b7b1",
            allowLocalhostAsSecureOrigin: true,
            serviceWorkerPath: "/OneSignalSDKWorker.js",
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
            await window.OneSignal.login(finalId);
            console.log("✅ [OneSignal] Linked Device to ID:", finalId);
          }

          // طلب الإذن إذا لم يكن ممنوحاً
          if (window.OneSignal.Notifications.permission !== "granted") {
            console.log("🔔 [OneSignal] Requesting permission...");
            await window.OneSignal.Notifications.requestPermission();
          }
        }
      } catch (error) {
        console.error("❌ [OneSignal] Init Error:", error);
      }
    };

    // التأكد من تحميل السكربت قبل البدء
    if (window.OneSignal) {
        initOneSignal();
    } else {
        // إذا لم يكن محمل بعد، ننتظر قليلاً أو نعتمد على السكربت في layout
        const checkInterval = setInterval(() => {
            if (window.OneSignal) {
                initOneSignal();
                clearInterval(checkInterval);
            }
        }, 1000);
        return () => clearInterval(checkInterval);
    }
  }, [externalId, pathname]);

  return null;
}
