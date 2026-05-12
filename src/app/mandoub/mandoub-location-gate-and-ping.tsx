"use client";

import { useSearchParams } from "next/navigation";
import { PortalLocationHeartbeat } from "@/components/portal-location-heartbeat";
import { OneSignalInitializer } from "@/components/OneSignalInitializer";

/**
 * لوحة المندوب: نبض موقع كل 20 ثانية للإدارة، وقفل الصفحة إن انقطع الإرسال أكثر من 3 دقائق.
 */
export function MandoubLocationGateAndPing({ children }: { children: React.ReactNode }) {
  const searchParams = useSearchParams();
  const c = searchParams.get("c") ?? "";
  const exp = searchParams.get("exp") ?? "";
  const s = searchParams.get("s") ?? "";

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
    <PortalLocationHeartbeat variant="mandoub" c={c} exp={exp} s={s}>
      {oneSignalComponent}
      {children}
    </PortalLocationHeartbeat>
  );
}
