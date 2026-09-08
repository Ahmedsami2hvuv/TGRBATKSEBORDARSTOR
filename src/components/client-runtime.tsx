"use client";

import { useEffect } from "react";
import { Toaster } from "sonner";
import { EnterSubmitGlobal } from "@/components/enter-submit-global";
import { PwaServiceWorkerRegister } from "@/components/pwa-service-worker-register";
import { PwaRoutePreserver } from "@/components/pwa-route-preserver";
import { OneSignalInitializer } from "@/components/OneSignalInitializer";
import { GlobalConfirmDialog } from "@/components/global-confirm-dialog";

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

        // حظر التحديث فقط إذا كان هناك نافذة منبثقة/مودال مفتوح، حتى لا يلغي السحب للتحديث في باقي الصفحة
        if (hasActiveModalOrDrawer) {
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


      <PwaRoutePreserver />
      <PwaServiceWorkerRegister />
      <GlobalConfirmDialog />
      {children}
      <Toaster richColors position="top-center" dir="rtl" closeButton />
    </>
  );
}
