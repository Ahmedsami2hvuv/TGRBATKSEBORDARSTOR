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
      <h2 className="text-lg font-bold text-rose-950">المسح والتحكم بالبيانات</h2>
      <p className="text-sm leading-relaxed text-rose-900/90">
        يمكنك اختيار نوع البيانات التي تريد مسحها بدقة. هذا الإجراء خطير ولا يمكن التراجع عنه.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <label className="flex flex-col gap-1">
          <span className={ad.label}>ماذا تريد أن تمسح؟</span>
          <select name="target" className={ad.input}>
            <option value="all">كل شيء (تصفير شامل)</option>
            <option value="orders">الطلبات فقط</option>
            <option value="customers">الزبائن فقط</option>
            <option value="shops">المحلات فقط</option>
            <option value="regions">المناطق (سيحذف ما بداخلها)</option>
          </select>
        </label>

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
      </div>

      {state.error ? (
        <p className="text-sm font-bold text-rose-700" role="alert">
          {state.error}
        </p>
      ) : null}
      {state.ok ? (
        <p className="text-sm font-bold text-emerald-800" role="status">
          تمت عملية المسح بنجاح.
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="rounded-xl border border-rose-300 bg-white px-4 py-2 text-sm font-bold text-rose-900 shadow-sm hover:bg-rose-100 disabled:opacity-60 w-full md:w-auto"
      >
        {pending ? "جارٍ التصفير…" : "تنفيذ عملية المسح"}
      </button>
    </form>
  );
}

