"use client";

import { useActionState, useEffect } from "react";
import { ad } from "@/lib/admin-ui";
import { purgeWalletLedgerData, type WalletLedgerPurgeState } from "./actions";

export function WalletLedgerPurgeForm() {
  const [state, action, pending] = useActionState(purgeWalletLedgerData, {} as WalletLedgerPurgeState);

  useEffect(() => {
    if (state.ok) {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, [state.ok]);

  return (
    <form action={action} className={`space-y-4 rounded-2xl border border-rose-200 bg-rose-50/50 p-5 ${ad.section}`}>
      <h2 className="text-lg font-bold text-rose-950">مسح جميع معاملات المحافظ</h2>
      <p className="text-sm leading-relaxed text-rose-900/90">
        يُحذف من قاعدة البيانات على Railway: حركات نقد الطلبات، أخذت/أعطيت المندوبين والموظفين، وجميع تحويلات
        المحفظة. يُصفَّر أيضاً تاريخ «تصفير لوحة المندوب» والمبلغ المرحّل لكل مندوب.{" "}
        <strong>لا يُحذف الطلبات ولا الحسابات.</strong> لا يمكن التراجع عن العملية من التطبيق.
      </p>
      {state.error ? (
        <p className="text-sm font-bold text-rose-700" role="alert">
          {state.error}
        </p>
      ) : null}
      {state.ok ? (
        <p className="text-sm font-bold text-emerald-800" role="status">
          تم مسح بيانات المحافظ بنجاح.
        </p>
      ) : null}
      <label className="flex flex-col gap-1">
        <span className={ad.label}>اكتب «مسح» للتأكيد</span>
        <input
          type="text"
          name="confirm"
          autoComplete="off"
          placeholder="مسح"
          className={ad.input}
          dir="rtl"
        />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="rounded-xl border border-rose-300 bg-white px-4 py-2 text-sm font-bold text-rose-900 shadow-sm hover:bg-rose-100 disabled:opacity-60"
      >
        {pending ? "جارٍ المسح…" : "تنفيذ المسح"}
      </button>
    </form>
  );
}
