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
    if (resetState.success) {
      router.refresh();
    } else if (resetState.error) {
      alert("خطأ أثناء التصفير: " + resetState.error);
    }
  }, [resetState, router]);

  return (
    <form
      action={resetAction}
      onSubmit={(e) => {
        if (
          !window.confirm(
            "تأكيد تصفير أرقام لوحة المندوب؟ ستُصفَّر عرض الفترة للوارد/الصادر/المتبقي/أرباحي ليبدأ من جديد (بلوك الإدارة سيبقى ثابتاً وتراكمياً).",
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
