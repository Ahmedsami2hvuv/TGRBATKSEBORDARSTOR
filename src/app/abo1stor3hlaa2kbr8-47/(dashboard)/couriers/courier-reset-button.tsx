"use client";

import { useActionState, useEffect, useTransition } from "react";
import { resetCourierMandoubTotals, type CourierMandoubResetState } from "./actions";
import { useRouter } from "next/navigation";
import { customConfirm } from "@/components/global-confirm-dialog";
import { DynamicIcon } from "@/components/dynamic-icon";
import { GlobalIconsConfig } from "@/lib/icon-settings";

const initialReset: CourierMandoubResetState = {};

export function CourierResetButton({
  courierId,
  icons,
}: {
  courierId: string;
  icons?: GlobalIconsConfig;
}) {
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
      className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-amber-300/80 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 px-3.5 py-2 text-xs font-bold text-amber-900 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/60 shadow-sm transition-all disabled:opacity-60 cursor-pointer"
    >
      <DynamicIcon config={icons} iconKey="ui_reset" fallback="🔄" className="w-4 h-4" />
      <span>{isLoading ? "جارٍ التصفير…" : "تصفير الأرقام"}</span>
    </button>
  );
}
