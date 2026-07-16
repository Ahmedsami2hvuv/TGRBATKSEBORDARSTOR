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
  useEffect(() => {
    let touchStartY = 0;

    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 1) {
        touchStartY = e.touches[0].clientY;
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;

      const touchY = e.touches[0].clientY;
      const touchDiff = touchY - touchStartY;

      // إذا كان السحب للأسفل (سحب بالإصبع للأسفل لرفع المحتوى أو سحب من قمة عنصر)
      if (touchDiff > 0) {
        let target: HTMLElement | null = e.target as HTMLElement;
        let isInsideScrollableAtTop = false;
        let hasActiveModalOrDrawer = false;

        // التحقق من وجود عناصر منبثقة أو مودالات عامة لمنع التحديث
        const openModal = document.querySelector('[role="dialog"], .modal, [data-state="open"], .drawer, [class*="Dialog"], [class*="Drawer"]');
        if (openModal) {
          hasActiveModalOrDrawer = true;
        }

        while (target && target !== document.body) {
          const style = window.getComputedStyle(target);
          const overflowY = style.overflowY;
          const isScrollable = (overflowY === "auto" || overflowY === "scroll") && target.scrollHeight > target.clientHeight;
          
          if (isScrollable) {
            if (target.scrollTop <= 0) {
              isInsideScrollableAtTop = true;
            }
            break;
          }
          target = target.parentElement;
        }

        // إذا كان هناك مودال مفتوح أو كنا نسحب من قمة عنصر داخلي قابل للتمرير
        // نقوم بعمل preventDefault لمنع تمرير إيماءة السحب للأسفل إلى WebView الأندرويد
        if (isInsideScrollableAtTop || hasActiveModalOrDrawer) {
          if (window.scrollY === 0 && e.cancelable) {
            e.preventDefault();
          }
        }
      }
    };

    window.addEventListener("touchstart", handleTouchStart, { passive: true });
    window.addEventListener("touchmove", handleTouchMove, { passive: false });

    return () => {
      window.removeEventListener("touchstart", handleTouchStart);
      window.removeEventListener("touchmove", handleTouchMove);
    };
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

      <PwaRoutePreserver />
      <PwaServiceWorkerRegister />
      {children}
      <Toaster richColors position="top-center" dir="rtl" closeButton />
    </>
  );
}
