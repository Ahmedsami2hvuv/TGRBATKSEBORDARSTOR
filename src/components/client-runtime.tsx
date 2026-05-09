"use client";

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

type ClientRuntimeProps = {
  children: React.ReactNode;
  mandoubFeatures?: { aiEnabled: boolean; chatEnabled: boolean };
  preparerFeatures?: { aiEnabled: boolean; chatEnabled: boolean };
  storeFeatures?: { aiEnabled: boolean };
};

export function ClientRuntime({
  children,
  mandoubFeatures,
  preparerFeatures,
  storeFeatures,
}: ClientRuntimeProps) {
  return (
    <>
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
      />
      {children}
      <Toaster richColors position="top-center" dir="rtl" closeButton />
    </>
  );
}
