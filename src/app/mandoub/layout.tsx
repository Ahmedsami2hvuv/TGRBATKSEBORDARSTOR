import { Suspense } from "react";
import { MandoubLocationGateAndPing } from "./mandoub-location-gate-and-ping";
import { FontSizeProvider } from "@/components/font-size-provider";

export default function MandoubLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={null}>
      <FontSizeProvider>
        <MandoubLocationGateAndPing>
          {children}
        </MandoubLocationGateAndPing>
      </FontSizeProvider>
    </Suspense>
  );
}
