"use client";

import { useActionState } from "react";
import { ad } from "@/lib/admin-ui";
import { updateEmployee, type EmployeeFormState } from "../../actions";

const initial: EmployeeFormState = {};

export function EmployeeEditForm({
  shopId,
  employeeId,
  defaultName,
  defaultPhone,
}: {
  shopId: string;
  employeeId: string;
  defaultName: string;
  defaultPhone: string;
}) {
  const bound = updateEmployee.bind(null, shopId);
  const [state, formAction, pending] = useActionState(bound, initial);

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="id" value={employeeId} />
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm">
          <span className={ad.label}>اسم الموظف</span>
          <input
            name="name"
            required
            defaultValue={defaultName}
            className={ad.input}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className={ad.label}>رقم الهاتف</span>
          <input
            name="phone"
            type="tel"
            inputMode="numeric"
            required
            defaultValue={defaultPhone}
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
