"use client";

import Link from "next/link";
import { useActionState } from "react";
import { ad } from "@/lib/admin-ui";
import {
  assignPendingOrderToCourier,
  type AssignOrderState,
} from "../actions";

const initial: AssignOrderState = {};

export function AssignToDelegateForm({
  orderId,
  couriers,
}: {
  orderId: string;
  couriers: { id: string; name: string }[];
}) {
  const bound = assignPendingOrderToCourier.bind(null);
  const [state, formAction, pending] = useActionState(bound, initial);

  if (couriers.length === 0) {
    return (
      <p className={`text-xs ${ad.muted}`}>
        لا يوجد مندوبون في النظام. أضف مندوباً من{" "}
        <Link href="/admin/couriers" className={ad.link}>
          قسم المندوبين
        </Link>{" "}
        — منفصل عن موظفي المحلات.
      </p>
    );
  }

  return (
    <form action={formAction} className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end">
      <input type="hidden" name="orderId" value={orderId} />
      <label className="flex min-w-[12rem] flex-col gap-1 text-xs">
        <span className={ad.label}>مندوب التوصيل</span>
        <select name="courierId" required className={ad.select}>
          <option value="">— اختر —</option>
          {couriers.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </label>
      <button
        type="submit"
        disabled={pending}
        className={`${ad.btnPrimary} shrink-0`}
      >
        {pending ? "…" : "إسناد للمندوب"}
      </button>
      {state.error ? (
        <p className={`w-full text-xs ${ad.error}`} role="alert">
          {state.error}
        </p>
      ) : null}
      {state.ok ? (
        <p className={`w-full text-xs ${ad.success}`}>تم الإسناد.</p>
      ) : null}
    </form>
  );
}
