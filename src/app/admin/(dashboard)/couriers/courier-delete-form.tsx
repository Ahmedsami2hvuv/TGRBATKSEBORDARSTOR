"use client";

import { useActionState } from "react";
import { ad } from "@/lib/admin-ui";
import { deleteCourierAction, type CourierFormState } from "./actions";

const initial: CourierFormState = {};

export function CourierDeleteForm({ id, name }: { id: string; name: string }) {
  const [state, formAction, pending] = useActionState(deleteCourierAction, initial);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    if (!confirm(`هل أنت متأكد من حذف المندوب "${name}"؟\nلا يمكن حذف المندوب إذا كان لديه طلبات مرتبطة به (في هذه الحالة يفضل إيقافه).`)) {
      e.preventDefault();
    }
  }

  return (
    <form action={formAction} onSubmit={onSubmit} className="inline-block">
      <input type="hidden" name="id" value={id} />
      <button
        type="submit"
        disabled={pending}
        className={`${ad.dangerLink} disabled:opacity-50`}
      >
        {pending ? "جاري الحذف..." : "حذف"}
      </button>
      {state?.error && (
        <p className="fixed bottom-4 right-4 z-50 rounded-xl bg-rose-600 p-4 text-sm font-bold text-white shadow-2xl">
          {state.error}
        </p>
      )}
    </form>
  );
}
