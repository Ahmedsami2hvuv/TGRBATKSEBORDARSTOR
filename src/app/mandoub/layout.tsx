import { Suspense } from "react";
import { MandoubLocationGateAndPing } from "./mandoub-location-gate-and-ping";
import { FontSizeProvider } from "@/components/font-size-provider";
import { PullToRefresh } from "@/components/pull-to-refresh";

export default function MandoubLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={null}>
      <FontSizeProvider>
        <MandoubLocationGateAndPing>
          <PullToRefresh />
          {children}
        </MandoubLocationGateAndPing>
      </FontSizeProvider>
    </Suspense>
  );
}
