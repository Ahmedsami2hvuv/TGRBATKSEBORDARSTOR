"use client";

import { useSearchParams } from "next/navigation";
import { PortalLocationHeartbeat } from "@/components/portal-location-heartbeat";

/**
 * لوحة المندوب: نبض موقع كل 20 ثانية للإدارة، وقفل الصفحة إن انقطع الإرسال أكثر من 3 دقائق.
 */
export function MandoubLocationGateAndPing({ children }: { children: React.ReactNode }) {
  const searchParams = useSearchParams();
  const c = searchParams.get("c") ?? "";
  const exp = searchParams.get("exp") ?? "";
  const s = searchParams.get("s") ?? "";
  if (!c.trim() || !s.trim()) {
    return <>{children}</>;
  }
  return (
    <PortalLocationHeartbeat variant="mandoub" c={c} exp={exp} s={s}>
      {children}
    </PortalLocationHeartbeat>
  );
}
