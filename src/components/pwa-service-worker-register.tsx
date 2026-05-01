"use client";

import { useEffect } from "react";
import { registerNotifyServiceWorker } from "@/lib/client-web-notification";

/** تسجيل خفيف لـ SW حتى تكون إشعارات الشريط جاهزة بعد تفعيل الإذن */
export function PwaServiceWorkerRegister() {
  useEffect(() => {
    const run = () => {
      void registerNotifyServiceWorker();
    };
    if (typeof window !== "undefined" && "requestIdleCallback" in window) {
      const id = window.requestIdleCallback(run, { timeout: 2000 });
      return () => window.cancelIdleCallback(id);
    }
    const timeout = window.setTimeout(run, 600);
    return () => window.clearTimeout(timeout);
  }, []);
  return null;
}
