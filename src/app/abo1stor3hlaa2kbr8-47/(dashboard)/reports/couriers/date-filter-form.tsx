"use client";

import { useRouter, useSearchParams } from "next/navigation";

type Props = {
  selectedDayIso: string;
};

export function DateFilterForm({ selectedDayIso }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const handleDateChange = (val: string) => {
    if (!val) return;
    const params = new URLSearchParams(searchParams.toString());
    params.set("day", val);
    router.push(`?${params.toString()}`);
  };

  return (
    <div className="flex items-center gap-2 rounded-2xl bg-white border border-slate-200 p-2 shadow-sm">
      <span className="text-xs font-black text-slate-500">تغيير اليوم:</span>
      <input
        type="date"
        defaultValue={selectedDayIso}
        className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-extrabold text-slate-800 outline-none focus:border-slate-400"
        onChange={(e) => handleDateChange(e.target.value)}
      />
    </div>
  );
}
