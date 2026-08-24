"use client";

import { useActionState, useTransition } from "react";
import { deleteCourierAction, type CourierFormState } from "./actions";
import { customConfirm } from "@/components/global-confirm-dialog";
import { DynamicIcon } from "@/components/dynamic-icon";
import { GlobalIconsConfig } from "@/lib/icon-settings";

const initial: CourierFormState = {};

export function CourierDeleteForm({
  id,
  name,
  icons,
}: {
  id: string;
  name: string;
  icons?: GlobalIconsConfig;
}) {
  const [state, formAction, pending] = useActionState(deleteCourierAction, initial);
  const [isPendingCustom, startTransition] = useTransition();

  const handleDeleteClick = async (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    const confirmed = await customConfirm({
      title: "تأكيد حذف المندوب",
      message: `هل أنت متأكد من حذف حساب المندوب "${name}" نهائيًا؟\nسيتم حذف الحساب بشكل دائم ولا يمكن التراجع.`,
      confirmText: "حذف الحساب نهائياً",
      cancelText: "إلغاء الأمر",
      type: "danger",
    });

    if (confirmed) {
      startTransition(() => {
        const formData = new FormData();
        formData.append("id", id);
        formAction(formData);
      });
    }
  };

  const isLoading = pending || isPendingCustom;
  const tooltipText = "حذف حساب المندوب";

  return (
    <div className="inline-block shrink-0">
      <button
        type="button"
        onClick={handleDeleteClick}
        disabled={isLoading}
        title={tooltipText}
        aria-label={tooltipText}
        className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center shrink-0 border border-rose-500 bg-rose-600 hover:bg-rose-700 text-white shadow-sm transition-all disabled:opacity-50 cursor-pointer active:scale-95"
      >
        <DynamicIcon config={icons} iconKey="ui_delete" fallback="🗑️" className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
      </button>
      {state?.success && state?.message && (
        <p className="fixed bottom-4 right-4 z-50 rounded-xl bg-emerald-600 p-4 text-sm font-bold text-white shadow-2xl">
          {state.message}
        </p>
      )}
      {state?.error && (
        <p className="fixed bottom-4 right-4 z-50 rounded-xl bg-rose-600 p-4 text-sm font-bold text-white shadow-2xl">
          {state.error}
        </p>
      )}
    </div>
  );
}
