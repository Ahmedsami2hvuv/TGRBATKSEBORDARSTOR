"use client";

import { useSearchParams } from "next/navigation";
import { PortalLocationHeartbeat } from "@/components/portal-location-heartbeat";

/**
 * بوابة المجهز: نبض موقع كل 20 ثانية للإدارة، وقفل الصفحة إن انقطع الإرسال أكثر من 3 دقائق.
 */
export function PreparerLocationGate({ children }: { children: React.ReactNode }) {
  const searchParams = useSearchParams();
  const p = searchParams.get("p") ?? "";
  const exp = searchParams.get("exp") ?? "";
  const s = searchParams.get("s") ?? "";
  if (!p.trim() || !s.trim()) {
    return <>{children}</>;
  }
  return (
    <PortalLocationHeartbeat variant="preparer" p={p} exp={exp} s={s}>
      {children}
    </PortalLocationHeartbeat>
  );
}
