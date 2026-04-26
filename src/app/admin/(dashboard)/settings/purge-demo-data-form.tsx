"use client";

import { useActionState } from "react";
import { ad } from "@/lib/admin-ui";
import { purgeDemoCoreData, type PurgeDemoCoreDataState } from "./actions";

const CONFIRM_PHRASE = "مسح شامل";

export function PurgeDemoDataForm() {
  const [state, action, pending] = useActionState(
    purgeDemoCoreData,
    {} as PurgeDemoCoreDataState,
  );

  return (
    <form
      action={action}
      className={`space-y-4 rounded-2xl border border-rose-200 bg-rose-50/50 p-5 ${ad.section}`}
    >
      <h2 className="text-lg font-bold text-rose-950">تصفير تجريبي شامل</h2>
      <p className="text-sm leading-relaxed text-rose-900/90">
        يمسح من قاعدة البيانات: <strong>المحلات</strong> و<strong>العملاء</strong>{" "}
        و<strong>المجهزين</strong> و<strong>المندوبين</strong> و<strong>الطلبات</strong>،
        ويُصفّر أيضاً عداد رقم الطلب ليبدأ من جديد.
      </p>
      <p className="text-sm leading-relaxed text-rose-900/90">
        هذا إجراء خطير ولا يمكن التراجع عنه من التطبيق.
      </p>

      {state.error ? (
        <p className="text-sm font-bold text-rose-700" role="alert">
          {state.error}
        </p>
      ) : null}
      {state.ok ? (
        <p className="text-sm font-bold text-emerald-800" role="status">
          تم التصفير. يمكنك إنشاء بيانات جديدة الآن.
        </p>
      ) : null}

      <label className="flex flex-col gap-1">
        <span className={ad.label}>اكتب «{CONFIRM_PHRASE}» للتأكيد</span>
        <input
          type="text"
          name="confirm"
          autoComplete="off"
          placeholder={CONFIRM_PHRASE}
          className={ad.input}
          dir="rtl"
        />
      </label>

      <button
        type="submit"
        disabled={pending}
        className="rounded-xl border border-rose-300 bg-white px-4 py-2 text-sm font-bold text-rose-900 shadow-sm hover:bg-rose-100 disabled:opacity-60"
      >
        {pending ? "جارٍ التصفير…" : "تنفيذ التصفير"}
      </button>
    </form>
  );
}

