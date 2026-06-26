import { Suspense } from "react";
import { PreparerLocationGate } from "./preparer-location-gate";
import { PreparerStickyMoneyStrip } from "./preparer-sticky-money-strip";

export default function PreparerLayout({ children }: { children: React.ReactNode }) {
  return (
    <div dir="rtl" lang="ar" className="kse-app-bg min-h-screen text-slate-800">
      <Suspense fallback={<div className="min-h-screen" aria-hidden />}>
        <PreparerLocationGate>
          <Suspense
            fallback={
              <div className="h-14 border-b border-slate-200/80 bg-white/90 backdrop-blur-sm" aria-hidden />
            }
          >
            <PreparerStickyMoneyStrip />
          </Suspense>
          {children}
        </PreparerLocationGate>
      </Suspense>
    </div>
  );
}
