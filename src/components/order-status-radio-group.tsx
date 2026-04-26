"use client";

import { useEffect, useState } from "react";

/** خيارات حالة الطلب كأزرار راديو أفقية مع علامة ✓ على المختار — حالة مضبوطة لضمان ظهور التحديد بعد التحديث */
export function OrderStatusRadioGroup({
  name,
  defaultValue,
  options,
  legend,
  legendClassName,
  required,
}: {
  name: string;
  defaultValue: string;
  options: { value: string; label: string }[];
  legend: string;
  legendClassName?: string;
  required?: boolean;
}) {
  const [selected, setSelected] = useState(defaultValue);

  useEffect(() => {
    setSelected(defaultValue);
  }, [defaultValue]);

  return (
    <fieldset className="space-y-2">
      <legend className={legendClassName ?? "text-sm font-semibold text-slate-700"}>
        {legend}
      </legend>
      <div className="flex flex-wrap items-stretch gap-2" dir="rtl" role="radiogroup" aria-label={legend}>
        {options.map((o) => (
          <label
            key={o.value}
            className="inline-flex min-h-[44px] cursor-pointer select-none items-center gap-2 rounded-xl border-2 border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-800 shadow-sm transition hover:border-sky-300 has-[:checked]:border-emerald-500 has-[:checked]:bg-emerald-50 has-[:checked]:text-emerald-950"
          >
            <input
              type="radio"
              name={name}
              value={o.value}
              checked={selected === o.value}
              onChange={() => setSelected(o.value)}
              className="peer sr-only"
              required={required}
            />
            <span>{o.label}</span>
            <span
              className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 border-slate-300 text-[10px] text-transparent peer-checked:border-emerald-600 peer-checked:bg-emerald-600 peer-checked:text-white"
              aria-hidden
            >
              ✓
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
