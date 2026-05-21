"use client";

import { useActionState, useState } from "react";
import { ad } from "@/lib/admin-ui";
import { createEmployee, type EmployeeFormState } from "./actions";

const initial: EmployeeFormState = {};

export function EmployeeForm({
  shopId,
  submitLabel = "إضافة موظف",
  successLabel = "تمت إضافة الموظف.",
}: {
  shopId: string;
  submitLabel?: string;
  successLabel?: string;
}) {
  const bound = createEmployee.bind(null, shopId);
  const [state, formAction, pending] = useActionState(bound, initial);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");

  return (
    <form action={formAction} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm">
          <span className={ad.label}>اسم الموظف</span>
          <input
            name="name"
            required
            className={ad.input}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className={ad.label}>رقم الهاتف</span>
          <input
            name="phone"
            type="tel"
            inputMode="numeric"
            required
            placeholder="07xxxxxxxx"
            className={ad.input}
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
        </label>
      </div>
      {state.error ? (
        <p className={ad.error} role="alert">
          {state.error}
        </p>
      ) : null}
      {state.ok ? <p className={ad.success}>{successLabel}</p> : null}
      <button
        type="submit"
        disabled={pending}
        className={ad.btnPrimary}
      >
        {pending ? "جارٍ الحفظ…" : submitLabel}
      </button>
    </form>
  );
}
