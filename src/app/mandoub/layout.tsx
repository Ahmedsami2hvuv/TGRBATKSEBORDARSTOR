import { Suspense } from "react";
import { MandoubLocationGateAndPing } from "./mandoub-location-gate-and-ping";
import { MandoubOfflineSyncManager } from "./mandoub-offline-sync-manager";

export default function MandoubLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={null}>
      <MandoubOfflineSyncManager />
      <MandoubLocationGateAndPing>{children}</MandoubLocationGateAndPing>
    </Suspense>
  );
}
