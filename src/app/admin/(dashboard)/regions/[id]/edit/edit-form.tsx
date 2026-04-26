"use client";

import { useActionState } from "react";
import { ad } from "@/lib/admin-ui";
import { updateRegion, type RegionFormState } from "../../actions";

const initial: RegionFormState = {};

export function RegionEditForm({
  id,
  defaultName,
  defaultPrice,
}: {
  id: string;
  defaultName: string;
  defaultPrice: string;
}) {
  const [state, formAction, pending] = useActionState(updateRegion, initial);

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="id" value={id} />
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm">
          <span className={ad.label}>اسم المنطقة</span>
          <input
            name="name"
            required
            defaultValue={defaultName}
            className={ad.input}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className={ad.label}>سعر التوصيل (بالألف)</span>
          <input
            name="deliveryPrice"
            type="text"
            inputMode="decimal"
            required
            defaultValue={defaultPrice}
            className={ad.input}
          />
        </label>
      </div>
      {state.error ? (
        <p className={ad.error} role="alert">
          {state.error}
        </p>
      ) : null}
      {state.ok ? <p className={ad.success}>تم حفظ التعديلات.</p> : null}
      <button
        type="submit"
        disabled={pending}
        className={ad.btnPrimary}
      >
        {pending ? "جارٍ الحفظ…" : "حفظ"}
      </button>
    </form>
  );
}
