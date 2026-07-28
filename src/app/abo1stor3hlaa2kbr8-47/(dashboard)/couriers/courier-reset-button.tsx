"use client";

import { useActionState, useEffect, useTransition } from "react";
import { resetCourierMandoubTotals, type CourierMandoubResetState } from "./actions";
import { useRouter } from "next/navigation";
import { customConfirm } from "@/components/global-confirm-dialog";

const initialReset: CourierMandoubResetState = {};

export function CourierResetButton({ courierId }: { courierId: string }) {
  const boundReset = resetCourierMandoubTotals.bind(null, courierId);
  const [resetState, resetAction, resetPending] = useActionState(
    boundReset,
    initialReset,
  );
  const [isPendingCustom, startTransition] = useTransition();
  const router = useRouter();

  useEffect(() => {
    if (resetState.success) {
      router.refresh();
    } else if (resetState.error) {
      alert("خطأ أثناء التصفير: " + resetState.error);
    }
  }, [resetState, router]);

  const handleResetClick = async (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    const confirmed = await customConfirm({
      title: "تأكيد تصفير أرقام المندوب",
      message: "تأكيد تصفيّر أرقام لوحة المندوب؟ ستُصغر عرض الفترة للوارد/الصادر/المتبقي/أرباحي ليبدأ من جديد (بلوك الإدارة سيبقى ثابتاً وتراكمياً).",
      confirmText: "نعم، تأكيد التصفير",
      cancelText: "إلغاء الأمر",
      type: "warning",
    });

    if (confirmed) {
      startTransition(() => {
        const formData = new FormData();
        resetAction(formData);
      });
    }
  };

  const isLoading = resetPending || isPendingCustom;

  return (
    <button
      type="button"
      onClick={handleResetClick}
      disabled={isLoading}
      className="inline-flex items-center rounded-lg border border-rose-500/50 bg-rose-50 px-3 py-1.5 text-xs font-black text-rose-900 shadow-sm transition hover:bg-rose-100 disabled:opacity-60 cursor-pointer"
    >
      {isLoading ? "جارٍ التصفير…" : "تصفير الأرقام"}
    </button>
  );
}
