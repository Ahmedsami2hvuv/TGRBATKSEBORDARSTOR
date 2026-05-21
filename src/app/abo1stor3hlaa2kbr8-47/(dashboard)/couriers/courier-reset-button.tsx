"use client";

import { useActionState, useEffect } from "react";
import { resetCourierMandoubTotals, type CourierMandoubResetState } from "./actions";
import { useRouter } from "next/navigation";

const initialReset: CourierMandoubResetState = {};

export function CourierResetButton({ courierId }: { courierId: string }) {
  const boundReset = resetCourierMandoubTotals.bind(null, courierId);
  const [resetState, resetAction, resetPending] = useActionState(
    boundReset,
    initialReset,
  );
  const router = useRouter();

  useEffect(() => {
    if (resetState.ok) {
      if (resetState.ok) {
        // Option 1: show a simple toast or alert if needed
      }
      router.refresh();
    }
  }, [resetState.ok, router]);

  return (
    <form
      action={resetAction}
      onSubmit={(e) => {
        if (
          !window.confirm(
            "تأكيد تصفير أرقام لوحة المندوب؟ ستُصفَّر عرض الفترة للوارد/الصادر/المتبقي/أرباحي، ويُحفظ متبقي المحفظة الحالي في رصيد محمول، ثم تُحسب الحركات الجديدة فوق ذلك.",
          )
        ) {
          e.preventDefault();
        }
      }}
    >
      <button
        type="submit"
        disabled={resetPending}
        className="inline-flex items-center rounded-lg border border-rose-500/50 bg-rose-50 px-3 py-1.5 text-xs font-black text-rose-900 shadow-sm transition hover:bg-rose-100 disabled:opacity-60"
      >
        {resetPending ? "جارٍ التصفير…" : "تصفير الأرقام"}
      </button>
    </form>
  );
}
