"use client";

import { useEffect } from "react";
import { registerNotifyServiceWorker } from "@/lib/client-web-notification";

/** تسجيل خفيف لـ SW حتى تكون إشعارات الشريط جاهزة بعد تفعيل الإذن */
export function PwaServiceWorkerRegister() {
  useEffect(() => {
    void registerNotifyServiceWorker();
  }, []);
  return null;
}
