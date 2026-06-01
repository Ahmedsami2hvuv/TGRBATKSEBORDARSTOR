"use client";

import { useActionState } from "react";
import { ad } from "@/lib/admin-ui";
import { purgeDemoCoreData, type PurgeDemoCoreDataState } from "./actions";

const CONFIRM_PHRASE = "مسح الطلبات";

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
      <h2 className="text-lg font-bold text-rose-950">مسح وتصفير كافة الطلبات</h2>
      <p className="text-sm leading-relaxed text-rose-900/90">
        سيقوم هذا الإجراء بحذف جميع الطلبات ومسودات التجهيز نهائياً من النظام، وإعادة تعيين عداد الطلبات ليبدأ من الرقم 1 عند رفع طلب جديد. هذا الإجراء خطير ولا يمكن التراجع عنه.
      </p>

      <div className="space-y-4">
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
          تمت عملية المسح بنجاح، وتم تصفير عدارد الطلبات ليبدأ من 1.
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="rounded-xl border border-rose-300 bg-rose-600 hover:bg-rose-700 px-5 py-3 text-sm font-black text-white shadow-md disabled:opacity-60 w-full md:w-auto transition-colors duration-200"
      >
        {pending ? "جارٍ تصفير ومسح الطلبات…" : "تأكيد مسح وتصفير الطلبات"}
      </button>
    </form>
  );
}
