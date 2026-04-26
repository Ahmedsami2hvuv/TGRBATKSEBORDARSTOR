"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { ad } from "@/lib/admin-ui";
import { createRegion, type RegionFormState } from "./actions";

const initial: RegionFormState = {};

export function RegionForm() {
  const [state, formAction, pending] = useActionState(createRegion, initial);
  const [open, setOpen] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);
  const prevPending = useRef(false);
  const [name, setName] = useState("");
  const [deliveryPrice, setDeliveryPrice] = useState("");

  useEffect(() => {
    if (prevPending.current && !pending && state.ok) {
      setName("");
      setDeliveryPrice("");
      nameRef.current?.focus();
    }
    prevPending.current = pending;
  }, [pending, state.ok]);

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className={ad.btnPrimary}>
        ➕ إضافة منطقة جديدة
      </button>
    );
  }

  return (
    <div className="rounded-2xl border border-sky-200 bg-sky-50/40 p-4 sm:p-5">
      <div className="flex justify-between items-center mb-4">
        <h2 className={ad.h2}>إضافة منطقة</h2>
        <button type="button" onClick={() => setOpen(false)} className={ad.btnDark}>
          إلغاء
        </button>
      </div>
      <form action={formAction} className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm">
            <span className={ad.label}>اسم المنطقة</span>
            <input
              ref={nameRef}
              name="name"
              required
              className={ad.input}
              autoComplete="off"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className={ad.label}>سعر التوصيل (بالألف)</span>
            <input
              name="deliveryPrice"
              type="text"
              inputMode="decimal"
              required
              placeholder="مثال: 3 أو 3.5 ألف"
              className={ad.input}
              value={deliveryPrice}
              onChange={(e) => setDeliveryPrice(e.target.value)}
            />
          </label>
        </div>
        {state.error ? (
          <p className={ad.error} role="alert">
            {state.error}
          </p>
        ) : null}
        {state.ok ? <p className={ad.success}>تمت الإضافة.</p> : null}
        <button
          type="submit"
          disabled={pending}
          className={ad.btnPrimary}
        >
          {pending ? "جارٍ الحفظ…" : "حفظ المنطقة"}
        </button>
      </form>
    </div>
  );
}
