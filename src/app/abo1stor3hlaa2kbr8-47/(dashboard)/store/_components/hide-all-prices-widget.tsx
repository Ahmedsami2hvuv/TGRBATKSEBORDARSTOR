"use client";

import { useState } from "react";
import { hideAllStorePrices } from "../actions";

export function HideAllPricesWidget() {
  const [isLoading, setIsLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function handleHideAll() {
    if (!window.confirm("هل أنت متأكد من تفعيل خيار إخفاء الأسعار لجميع الأقسام والفروع الحالية دفعة واحدة؟ (ستتمكن لاحقاً من فتح أي قسم أو فرع وإظهار سعره يدوياً)")) {
      return;
    }

    setIsLoading(true);
    try {
      const res = await hideAllStorePrices();
      if (res.ok) {
        setDone(true);
        setTimeout(() => setDone(false), 5000);
      } else {
        alert(res.error || "حدث خطأ أثناء تنفيذ العملية");
      }
    } catch (e: any) {
      alert(e.message || "حدث خطأ غير متوقع");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="bg-white dark:bg-slate-900 p-6 rounded-[2rem] border border-amber-100 dark:border-amber-900/30 shadow-xl shadow-slate-200/40 flex flex-wrap items-center justify-between gap-6">
      <div className="flex-1 min-w-[280px]">
        <h3 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
          <span>🔒</span> إخفاء أسعار المتجر بالكامل
        </h3>
        <p className="text-xs text-slate-500 font-bold mt-1">
          يقوم هذا الزر بتفعيل إخفاء الأسعار على كافة الأقسام والفروع الحالية دفعة واحدة، ويمكنك بعد ذلك الدخول لأي قسم أو فرع تريده وإلغاء إخفاء السعر عنه ليظهر للزبائن.
        </p>
      </div>

      <div>
        <button
          onClick={handleHideAll}
          disabled={isLoading}
          className={`px-5 py-3 rounded-2xl font-black text-sm flex items-center gap-2 transition-all shadow-md active:scale-95 ${
            done
              ? "bg-emerald-600 text-white shadow-emerald-200"
              : "bg-amber-500 hover:bg-amber-600 text-white shadow-amber-200 dark:shadow-none"
          } disabled:opacity-50`}
        >
          {isLoading ? (
            <>
              <span className="animate-spin inline-block">⏳</span>
              جاري إخفاء الأسعار للجميع...
            </>
          ) : done ? (
            <>
              <span>✅</span>
              تم إخفاء أسعار جميع الأقسام والفروع بنجاح!
            </>
          ) : (
            <>
              <span>🔒</span>
              إخفاء أسعار كل الأقسام والأفرع الآن
            </>
          )}
        </button>
      </div>
    </div>
  );
}
