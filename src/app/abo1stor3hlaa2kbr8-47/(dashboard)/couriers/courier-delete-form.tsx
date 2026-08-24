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

  return (
    <div className="inline-block">
      <button
        type="button"
        onClick={handleDeleteClick}
        disabled={isLoading}
        className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-rose-200 dark:border-rose-900/40 bg-rose-50 dark:bg-rose-950/30 px-3 py-1.5 text-xs font-bold text-rose-700 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-900/50 transition-colors disabled:opacity-50 cursor-pointer"
      >
        <DynamicIcon config={icons} iconKey="ui_delete" fallback="🗑️" className="w-3.5 h-3.5 text-rose-500" />
        <span>{isLoading ? "جاري..." : "حذف"}</span>
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
