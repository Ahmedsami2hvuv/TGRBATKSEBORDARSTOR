"use client";

import { useActionState } from "react";
import { ad } from "@/lib/admin-ui";
import { deleteCourierAction, type CourierFormState } from "./actions";

const initial: CourierFormState = {};

export function CourierDeleteForm({ id, name }: { id: string; name: string }) {
  const [state, formAction, pending] = useActionState(deleteCourierAction, initial);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    if (!confirm(`هل أنت متأكد من حذف حساب المندوب "${name}" نهائيًا؟\nسيتم حذف الحساب بشكل دائم ولا يمكن التراجع.`)) {
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
    </form>
  );
}
