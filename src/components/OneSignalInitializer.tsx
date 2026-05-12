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
    // دالة آمنة لتشغيل وان سيجنال
    const runOneSignal = async () => {
      try {
        if (typeof window !== "undefined" && window.OneSignal) {
          // استخدام نظام الـ push لضمان الجاهزية
          window.OneSignal.push(async function() {
            await window.OneSignal.init({
              appId: "aa21547a-4853-4ced-8823-6fd8c778b7b1",
              allowLocalhostAsSecureOrigin: true,
              serviceWorkerPath: "OneSignalSDKWorker.js",
              notificationDisplayPredicate: () => true,
              promptOptions: {
                slidedown: {
                  enabled: true,
                  autoPrompt: true,
                  timeDelay: 5,
                  pageViews: 1,
                },
              },
            });

            let finalId = externalId;
            if (!finalId && pathname?.startsWith("/admin")) {
              finalId = "admin_global";
            }

            if (finalId) {
              await window.OneSignal.login(finalId);
              console.log("✅ [OneSignal] Linked to:", finalId);
            }
          });
        }
      } catch (err) {
        console.error("OneSignal Safe Init Error:", err);
      }
    };

    // ننتظر حتى يحمل السكربت من layout.tsx
    if (window.OneSignal) {
      runOneSignal();
    } else {
      const timeout = setTimeout(() => {
        if (window.OneSignal) runOneSignal();
      }, 3000);
      return () => clearTimeout(timeout);
    }
  }, [externalId, pathname]);

  return null;
}
