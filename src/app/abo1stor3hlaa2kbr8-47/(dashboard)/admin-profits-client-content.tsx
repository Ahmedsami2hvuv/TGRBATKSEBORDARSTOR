"use client";

import { useEffect, useState } from "react";
import { formatDinarAsAlfWithUnit } from "@/lib/money-alf";
import { payCourierTipAction } from "./couriers/tip-actions";
import { getGlobalIcons, GlobalIconsConfig } from "@/lib/icon-settings";
import { DynamicIcon } from "@/components/dynamic-icon";

type Props = {
  todayNet: number;
  allTimeNet: number;
  todayPrepProfit: number;
  totalPrepProfit: number;
  todayDeliveryProfit: number;
  totalDeliveryProfit: number;
  todayTipsPaid: number;
  totalTipsPaid: number;
  couriersList: Array<{
    id: string;
    name: string;
    todayProfit: number;
    todayTips: number;
  }>;
};

export function AdminProfitsClientContent({
  todayNet,
  allTimeNet,
  todayPrepProfit,
  totalPrepProfit,
  todayDeliveryProfit,
  totalDeliveryProfit,
  todayTipsPaid,
  totalTipsPaid,
  couriersList,
}: Props) {
  const [icons, setIcons] = useState<GlobalIconsConfig | null>(null);

  useEffect(() => {
    getGlobalIcons().then(setIcons);
  }, []);

  return (
    <section className="kse-glass-dark my-8 flex flex-col gap-6 rounded-[1.25rem] border border-amber-200/50 p-5 sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 shadow-inner shadow-white/20">
            <DynamicIcon iconKey="ui_earnings" config={icons} fallback="💰" className="w-8 h-8 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-black text-amber-900">سجل أرباح الشركة التفصيلي</h2>
            <p className="mt-1 text-xs font-semibold text-amber-700/80">ملخص الأرباح (بعد استقطاع الإكراميات)</p>
          </div>
        </div>
        <div className="flex flex-col gap-3 rounded-xl bg-white/60 p-3 shadow-sm sm:min-w-[240px]">
          <div className="flex items-center justify-between gap-3 border-b border-amber-100/50 pb-2">
            <span className="text-xs font-bold text-slate-600">صافي الأرباح (اليوم)</span>
            <span className="text-sm font-black text-emerald-600">{formatDinarAsAlfWithUnit(todayNet)}</span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs font-bold text-slate-600">صافي الأرباح (الشاملة)</span>
            <span className="text-sm font-black text-sky-600">{formatDinarAsAlfWithUnit(allTimeNet)}</span>
          </div>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <div className="rounded-xl border border-sky-100 bg-white p-4 shadow-sm">
          <h3 className="mb-4 text-sm font-bold text-sky-900">أرباح التجهيز</h3>
          <div className="rounded-lg border border-sky-100 bg-sky-50 p-3">
            <div className="mb-1 flex items-center justify-between text-xs"><span className="text-slate-500">اليوم:</span><span className="font-bold text-emerald-600">{formatDinarAsAlfWithUnit(todayPrepProfit)}</span></div>
            <div className="flex items-center justify-between text-xs"><span className="text-slate-500">الإجمالي:</span><span className="font-bold text-sky-700">{formatDinarAsAlfWithUnit(totalPrepProfit)}</span></div>
          </div>
        </div>
        <div className="rounded-xl border border-emerald-100 bg-white p-4 shadow-sm">
          <h3 className="mb-4 text-sm font-bold text-emerald-900">أرباح التوصيل</h3>
          <div className="rounded-lg border border-emerald-100 bg-emerald-50 p-3">
            <div className="mb-1 flex items-center justify-between text-xs"><span className="text-slate-500">اليوم:</span><span className="font-bold text-emerald-600">{formatDinarAsAlfWithUnit(todayDeliveryProfit)}</span></div>
            <div className="flex items-center justify-between text-xs"><span className="text-slate-500">الإجمالي:</span><span className="font-bold text-sky-700">{formatDinarAsAlfWithUnit(totalDeliveryProfit)}</span></div>
          </div>
        </div>
        <div className="rounded-xl border border-rose-100 bg-white p-4 shadow-sm">
          <h3 className="mb-4 text-sm font-bold text-rose-900">الإكراميات</h3>
          <div className="rounded-lg border border-rose-100 bg-rose-50 p-3">
            <div className="mb-1 flex items-center justify-between text-xs"><span className="text-slate-500">اليوم:</span><span className="font-bold text-rose-600">{formatDinarAsAlfWithUnit(todayTipsPaid)}</span></div>
            <div className="flex items-center justify-between text-xs"><span className="text-slate-500">الإجمالي:</span><span className="font-bold text-rose-700">{formatDinarAsAlfWithUnit(totalTipsPaid)}</span></div>
          </div>
        </div>
      </div>

      {couriersList.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden mt-2">
          <div className="overflow-x-auto">
            <table className="w-full text-right text-sm text-slate-600">
              <thead className="bg-slate-50 border-b border-slate-100 text-xs font-semibold text-slate-500">
                <tr>
                  <th className="px-4 py-3">المندوب</th>
                  <th className="px-4 py-3 text-center">أرباح اليوم</th>
                  <th className="px-4 py-3 text-center">دفع إكرامية</th>
                  <th className="px-4 py-3 text-center">إكراميات اليوم</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {couriersList.map((c) => (
                  <tr key={c.id} className="transition hover:bg-slate-50">
                    <td className="px-4 py-3 font-bold text-slate-800">{c.name}</td>
                    <td className="px-4 py-3 text-center font-bold text-emerald-600">{formatDinarAsAlfWithUnit(c.todayProfit)}</td>
                    <td className="px-4 py-3 text-center">
                      <form action={payCourierTipAction} className="flex items-center justify-center gap-1">
                        <input type="hidden" name="courierId" value={c.id} />
                        <input type="number" step="any" inputMode="decimal" name="amountAlf" placeholder="0" required className="w-12 rounded border border-amber-200 px-1 py-1 text-xs outline-none" />
                        <button type="submit" className="rounded bg-amber-500 px-2 py-1 text-[10px] font-bold text-white hover:bg-amber-600">دفع</button>
                      </form>
                    </td>
                    <td className="px-4 py-3 text-center font-bold text-rose-600">{formatDinarAsAlfWithUnit(c.todayTips)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}
