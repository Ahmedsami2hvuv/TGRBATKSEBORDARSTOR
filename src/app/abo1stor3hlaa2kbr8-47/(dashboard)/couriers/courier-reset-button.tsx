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
  const tooltipText = "تصفير أرقام المندوب (إعادة ضبط الحسابات)";

  return (
    <button
      type="button"
      onClick={handleResetClick}
      disabled={isLoading}
      title={tooltipText}
      aria-label={tooltipText}
      className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center shrink-0 border border-amber-400 bg-amber-500 hover:bg-amber-600 text-white shadow-sm transition-all disabled:opacity-60 cursor-pointer active:scale-95"
    >
      <DynamicIcon config={icons} iconKey="ui_reset" fallback="🔄" className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
    </button>
  );
}
