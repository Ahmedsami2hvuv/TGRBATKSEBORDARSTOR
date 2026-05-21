"use client";

import { useState, useTransition } from "react";
import { saveChosenFontAction } from "./actions";

export function FontSettingsForm({
  availableFonts,
  currentFont
}: {
  availableFonts: string[],
  currentFont: string
}) {
  const [selectedFont, setSelectedFont] = useState(currentFont);
  const [isPending, startTransition] = useTransition();

  async function handleSave() {
    startTransition(async () => {
      const res = await saveChosenFontAction(selectedFont);
      if (res.ok) {
        alert("تم تحديث الخط بنجاح! سيتم تطبيق التغيير على الموقع بالكامل.");
        window.location.reload();
      } else {
        alert("فشل تحديث الخط.");
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3">
        <label className="text-xs font-black text-slate-500 px-1">اختر الخط الأساسي للموقع</label>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {availableFonts.map((font) => (
            <button
              key={font}
              onClick={() => setSelectedFont(font)}
              className={`px-4 py-3 rounded-2xl border-2 transition-all text-sm font-bold text-center ${
                selectedFont === font
                  ? "border-indigo-600 bg-indigo-50 text-indigo-700 shadow-md shadow-indigo-100"
                  : "border-slate-100 bg-slate-50 text-slate-500 hover:border-slate-200"
              }`}
            >
              {font}
            </button>
          ))}
        </div>
      </div>

      <div className="p-4 rounded-2xl bg-slate-900 text-white mt-4">
        <p className="text-[10px] text-slate-400 mb-2 font-bold">معاينة الخط المختار:</p>
        <p style={{ fontFamily: selectedFont }} className="text-xl">
          بسم الله الرحمن الرحيم - تجربة الخط المختار على واجهة النظام.
        </p>
      </div>

      <button
        disabled={isPending || selectedFont === currentFont}
        onClick={handleSave}
        className="w-full py-4 rounded-2xl bg-indigo-600 text-white font-black shadow-lg shadow-indigo-100 disabled:opacity-50 active:scale-95 transition-all"
      >
        {isPending ? "جاري الحفظ..." : "حفظ الخط المختار"}
      </button>

      <p className="text-[10px] text-slate-400 text-center font-bold">
        ملاحظة: تظهر هنا جميع الخطوط الموجودة في مجلد public/fonts تلقائياً.
      </p>
    </div>
  );
}
