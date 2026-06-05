"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { Toaster } from "sonner";

const EnterSubmitGlobal = dynamic(
  () => import("@/components/enter-submit-global").then((m) => m.EnterSubmitGlobal),
  { ssr: false },
);
const PwaServiceWorkerRegister = dynamic(
  () => import("@/components/pwa-service-worker-register").then((m) => m.PwaServiceWorkerRegister),
  { ssr: false },
);
const PwaRoutePreserver = dynamic(
  () => import("@/components/pwa-route-preserver").then((m) => m.PwaRoutePreserver),
  { ssr: false },
);
const GlobalAIAssistant = dynamic(() => import("@/components/GlobalAIAssistant"), {
  ssr: false,
});
const PortalChatWidget = dynamic(() => import("@/components/PortalChatWidget"), {
  ssr: false,
});
const OneSignalInitializer = dynamic(
  () => import("@/components/OneSignalInitializer").then((m) => m.OneSignalInitializer),
  { ssr: false },
);

type ClientRuntimeProps = {
  children: React.ReactNode;
  mandoubFeatures?: { aiEnabled: boolean; chatEnabled: boolean };
  preparerFeatures?: { aiEnabled: boolean; chatEnabled: boolean };
  chatEnabled?: boolean;
  trackingEnabled?: boolean;
  storeFeatures?: { aiEnabled: boolean };
  externalId?: string; // إضافة هذا الحقل
};

export function ClientRuntime({
  children,
  mandoubFeatures,
  preparerFeatures,
  chatEnabled,
  trackingEnabled,
  storeFeatures,
  externalId,
}: ClientRuntimeProps) {
  const [isOneSignalUser, setIsOneSignalUser] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const path = window.location.pathname;
    const oneSignalPaths = ["/mandoub", "/preparer"];
    const isOSUser = oneSignalPaths.some((p) => path.startsWith(p));
    setIsOneSignalUser(isOSUser);

    if (isOSUser && "serviceWorker" in navigator) {
      // تنظيف أي Service Worker نشط لـ sw-notify.js لمنع صراع الإشعارات والرسالة الافتراضية
      navigator.serviceWorker
        .getRegistrations()
        .then((registrations) => {
          for (const reg of registrations) {
            if (reg.active && reg.active.scriptURL.includes("sw-notify.js")) {
              console.log("[ClientRuntime] Found conflicting sw-notify.js. Unregistering...");
              reg.unregister().then((success) => {
                if (success) {
                  console.log("[ClientRuntime] Successfully unregistered sw-notify.js service worker.");
                }
              });
            }
          }
        })
        .catch((err) => {
          console.error("[ClientRuntime] Error checking service worker registrations:", err);
        });
    }
  }, []);

  return (
    <>
      <OneSignalInitializer externalId={externalId} />
      {/* Keep global assistant visible across portals */}
      <EnterSubmitGlobal />
      <GlobalAIAssistant
        mandoubFeatures={mandoubFeatures}
        preparerFeatures={preparerFeatures}
        storeFeatures={storeFeatures}
      />
      <PortalChatWidget
        mandoubFeatures={mandoubFeatures}
        preparerFeatures={preparerFeatures}
        globalEnabled={chatEnabled}
      />
      <PwaRoutePreserver />
      {!isOneSignalUser && <PwaServiceWorkerRegister />}
      {children}
      <Toaster richColors position="top-center" dir="rtl" closeButton />
    </>
  );
}
