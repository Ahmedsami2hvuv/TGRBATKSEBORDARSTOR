"use client";

import { useSearchParams } from "next/navigation";
import { PortalLocationHeartbeat } from "@/components/portal-location-heartbeat";
import { OneSignalInitializer } from "@/components/OneSignalInitializer";
import { useEffect, useState } from "react";

/**
 * لوحة المندوب: نبض موقع كل 20 ثانية للإدارة، وقفل الصفحة إن انقطع الإرسال أكثر من 3 دقائق.
 */
export function MandoubLocationGateAndPing({ children }: { children: React.ReactNode }) {
  const [globalTracking, setGlobalTracking] = useState(true);

  const SECRET_ADMIN_PATH = "/abo1stor3hlaa2kbr8-47";

  useEffect(() => {
    fetch(`/api${SECRET_ADMIN_PATH}/settings/resource-management`)
      .then(res => res.json())
      .then(data => {
        if (data.trackingEnabled !== undefined) {
          setGlobalTracking(data.trackingEnabled);
        }
      })
      .catch(() => {});
  }, []);

  const searchParams = useSearchParams();
  const paramC = searchParams.get("c");
  const paramExp = searchParams.get("exp");
  const paramS = searchParams.get("s");

  function readCookie(name: string) {
    if (typeof document === "undefined") return "";
    const m = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'));
    return m ? decodeURIComponent(m[1]) : "";
  }

  const c = paramC ?? readCookie("mandoub_c") ?? "";
  const exp = paramExp ?? readCookie("mandoub_exp") ?? "";
  const s = paramS ?? readCookie("mandoub_s") ?? "";

  // الربط مع OneSignal إذا كان معرف المندوب موجوداً في الرابط
  const oneSignalComponent = c.trim() ? <OneSignalInitializer externalId={c.trim()} /> : null;

  if (!c.trim() || !s.trim()) {
    return (
      <>
        {oneSignalComponent}
        {children}
      </>
    );
  }

  return (
    <PortalLocationHeartbeat variant="mandoub" c={c} exp={exp} s={s} globalEnabled={globalTracking}>
      {oneSignalComponent}
      {children}
    </PortalLocationHeartbeat>
  );
}
