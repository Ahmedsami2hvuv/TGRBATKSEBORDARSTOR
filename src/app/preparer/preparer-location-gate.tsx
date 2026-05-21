"use client";

import { useSearchParams } from "next/navigation";
import { PortalLocationHeartbeat } from "@/components/portal-location-heartbeat";
import { OneSignalInitializer } from "@/components/OneSignalInitializer";
import { useEffect, useState } from "react";

/**
 * بوابة المجهز: نبض موقع كل 20 ثانية للإدارة، وقفل الصفحة إن انقطع الإرسال أكثر من 3 دقائق.
 */
export function PreparerLocationGate({ children }: { children: React.ReactNode }) {
  const [globalTracking, setGlobalTracking] = useState(true);

  useEffect(() => {
    fetch("/api/admin/settings/resource-management")
      .then(res => res.json())
      .then(data => {
        if (data.trackingEnabled !== undefined) {
          setGlobalTracking(data.trackingEnabled);
        }
      })
      .catch(() => {});
  }, []);

  const searchParams = useSearchParams();
  const paramP = searchParams.get("p");
  const paramExp = searchParams.get("exp");
  const paramS = searchParams.get("s");

  function readCookie(name: string) {
    if (typeof document === "undefined") return "";
    const m = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'));
    return m ? decodeURIComponent(m[1]) : "";
  }

  const p = paramP ?? readCookie("preparer_p") ?? readCookie("company_preparer_p") ?? "";
  const exp = paramExp ?? readCookie("preparer_exp") ?? readCookie("company_preparer_exp") ?? "";
  const s = paramS ?? readCookie("preparer_s") ?? readCookie("company_preparer_s") ?? "";

  // الربط مع OneSignal إذا كان معرف المجهز موجوداً في الرابط
  const oneSignalComponent = p.trim() ? <OneSignalInitializer externalId={p.trim()} /> : null;

  if (!p.trim() || !s.trim()) {
    return (
      <>
        {oneSignalComponent}
        {children}
      </>
    );
  }

  return (
    <PortalLocationHeartbeat variant="preparer" p={p} exp={exp} s={s} globalEnabled={globalTracking}>
      {oneSignalComponent}
      {children}
    </PortalLocationHeartbeat>
  );
}
