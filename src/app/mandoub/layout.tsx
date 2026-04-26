import { Suspense } from "react";
import { MandoubLocationGateAndPing } from "./mandoub-location-gate-and-ping";

export default function MandoubLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={null}>
      <MandoubLocationGateAndPing>{children}</MandoubLocationGateAndPing>
    </Suspense>
  );
}
