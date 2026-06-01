"use client";

import { useState } from "react";
import { updateGlobalProfit } from "../actions";

export function GlobalProfitWidget({ initialMargin }: { initialMargin: number }) {
  const [margin, setMargin] = useState(initialMargin);
  const [isLoading, setIsLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  async function handleSave() {
    setIsLoading(true);
    try {
      const res = await updateGlobalProfit(margin);
      if (res.ok) {
        setIsEditing(false);
      }
    } catch (e) {
      alert("فشل تحديث الربح العام");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="bg-white dark:bg-slate-900 p-6 rounded-[2rem] border border-slate-100 dark:border-slate-800 shadow-xl shadow-slate-200/40 flex flex-wrap items-center gap-6">
      <div className="flex-1">
        <h3 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
          <span>💰</span> هامش الربح العام للمتجر
        </h3>
        <p className="text-xs text-slate-500 font-bold mt-1">يُطبق هذا الربح على جميع المنتجات ما لم يتم تحديد ربح خاص بالقسم أو الفرع</p>
      </div>

      <div className="flex items-center gap-3 bg-violet-50 dark:bg-violet-900/20 p-2 pl-4 rounded-2xl border border-violet-100 dark:border-violet-800 min-w-[280px]">
        <div className="flex-1 flex flex-col px-2">
          <span className="text-[10px] font-black text-violet-800 dark:text-violet-300 uppercase">الربح الافتراضي (د.ع)</span>
          {isEditing ? (
            <input
              type="number"
              value={margin}
              onChange={(e) => setMargin(Number(e.target.value))}
              className="bg-transparent border-none outline-none font-black text-lg text-violet-700 dark:text-violet-400 w-full"
              autoFocus
            />
          ) : (
            <span className="font-black text-lg text-violet-700 dark:text-violet-400">
              {Number(margin).toLocaleString()} د.ع
            </span>
          )}
        </div>

        {isEditing ? (
          <div className="flex gap-1">
            <button
              onClick={handleSave}
              disabled={isLoading}
              className="p-2 bg-violet-600 text-white rounded-xl hover:bg-violet-700 transition disabled:opacity-50"
            >
              {isLoading ? "..." : "✅"}
            </button>
            <button
              onClick={() => { setMargin(initialMargin); setIsEditing(false); }}
              className="p-2 bg-slate-200 text-slate-600 rounded-xl hover:bg-slate-300 transition"
            >
              ✕
            </button>
          </div>
        ) : (
          <button
            onClick={() => setIsEditing(true)}
            className="px-4 py-2 bg-white dark:bg-slate-800 text-violet-600 dark:text-violet-400 rounded-xl font-black text-xs hover:shadow-md transition-all border border-violet-100 dark:border-violet-700"
          >
            تعديل
          </button>
        )}
      </div>
    </div>
  );
}
