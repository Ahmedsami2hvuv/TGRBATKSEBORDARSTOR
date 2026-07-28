"use client";

import { useActionState, useTransition } from "react";
import { ad } from "@/lib/admin-ui";
import { deleteCourierAction, type CourierFormState } from "./actions";
import { customConfirm } from "@/components/global-confirm-dialog";

const initial: CourierFormState = {};

export function CourierDeleteForm({ id, name }: { id: string; name: string }) {
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
        className={`${ad.dangerLink} disabled:opacity-50 cursor-pointer`}
      >
        {isLoading ? "جاري الحذف..." : "حذف"}
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
