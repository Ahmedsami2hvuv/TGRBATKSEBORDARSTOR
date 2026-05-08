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

type ClientRuntimeProps = {
  children: React.ReactNode;
};

export function ClientRuntime({ children }: ClientRuntimeProps) {
  return (
    <>
      {/* Removed background PWA and AI services to stop background activity */}
      <EnterSubmitGlobal />
      {children}
      <Toaster richColors position="top-center" dir="rtl" closeButton />
    </>
  );
}
