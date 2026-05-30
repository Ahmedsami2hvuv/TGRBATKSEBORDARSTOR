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
    <section className="bg-white dark:bg-slate-900 my-8 flex flex-col gap-6 rounded-3xl border border-slate-200 dark:border-slate-800 p-5 sm:p-8 shadow-sm">
      <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
            <DynamicIcon iconKey="ui_earnings" config={icons} fallback="💰" className="w-8 h-8" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">سجل أرباح الشركة التفصيلي</h2>
            <p className="mt-1 text-sm font-medium text-slate-500 dark:text-slate-400">ملخص الأرباح بعد استقطاع الإكراميات</p>
          </div>
        </div>
        <div className="flex flex-col gap-3 rounded-2xl bg-slate-50 dark:bg-slate-800/50 p-4 sm:min-w-[280px] border border-slate-200 dark:border-slate-800">
          <div className="flex items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-700 pb-2">
            <span className="text-sm font-medium text-slate-500 dark:text-slate-400">صافي الأرباح (اليوم)</span>
            <span className="text-lg font-black text-indigo-600 dark:text-indigo-400">{formatDinarAsAlfWithUnit(todayNet)}</span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm font-medium text-slate-500 dark:text-slate-400">صافي الأرباح (الشاملة)</span>
            <span className="text-lg font-black text-slate-900 dark:text-slate-100">{formatDinarAsAlfWithUnit(allTimeNet)}</span>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/20 p-5">
          <h3 className="mb-4 text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">أرباح التجهيز</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between"><span className="text-sm text-slate-600 dark:text-slate-400 font-medium">اليوم:</span><span className="font-bold text-indigo-600 dark:text-indigo-400">{formatDinarAsAlfWithUnit(todayPrepProfit)}</span></div>
            <div className="flex items-center justify-between"><span className="text-sm text-slate-600 dark:text-slate-400 font-medium">الإجمالي:</span><span className="font-bold text-slate-900 dark:text-slate-100">{formatDinarAsAlfWithUnit(totalPrepProfit)}</span></div>
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/20 p-5">
          <h3 className="mb-4 text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">أرباح التوصيل</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between"><span className="text-sm text-slate-600 dark:text-slate-400 font-medium">اليوم:</span><span className="font-bold text-indigo-600 dark:text-indigo-400">{formatDinarAsAlfWithUnit(todayDeliveryProfit)}</span></div>
            <div className="flex items-center justify-between"><span className="text-sm text-slate-600 dark:text-slate-400 font-medium">الإجمالي:</span><span className="font-bold text-slate-900 dark:text-slate-100">{formatDinarAsAlfWithUnit(totalDeliveryProfit)}</span></div>
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/20 p-5">
          <h3 className="mb-4 text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">الإكراميات</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between"><span className="text-sm text-slate-600 dark:text-slate-400 font-medium">اليوم:</span><span className="font-bold text-rose-600 dark:text-rose-400">{formatDinarAsAlfWithUnit(todayTipsPaid)}</span></div>
            <div className="flex items-center justify-between"><span className="text-sm text-slate-600 dark:text-slate-400 font-medium">الإجمالي:</span><span className="font-bold text-slate-900 dark:text-slate-100">{formatDinarAsAlfWithUnit(totalTipsPaid)}</span></div>
          </div>
        </div>
      </div>

      {couriersList.length > 0 && (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden mt-2">
          <div className="overflow-x-auto">
            <table className="w-full text-right text-sm">
              <thead className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">
                <tr>
                  <th className="px-6 py-4">المندوب</th>
                  <th className="px-6 py-4 text-center">أرباح اليوم</th>
                  <th className="px-6 py-4 text-center">دفع إكرامية</th>
                  <th className="px-6 py-4 text-center">إكراميات اليوم</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {couriersList.map((c) => (
                  <tr key={c.id} className="transition hover:bg-slate-50 dark:hover:bg-slate-800/30">
                    <td className="px-6 py-4 font-bold text-slate-900 dark:text-slate-100">{c.name}</td>
                    <td className="px-6 py-4 text-center font-bold text-indigo-600 dark:text-indigo-400">{formatDinarAsAlfWithUnit(c.todayProfit)}</td>
                    <td className="px-6 py-4 text-center">
                      <form action={payCourierTipAction} className="flex items-center justify-center gap-2">
                        <input type="hidden" name="courierId" value={c.id} />
                        <input type="number" step="any" inputMode="decimal" name="amountAlf" placeholder="0" required className="w-20 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-1.5 text-xs outline-none focus:ring-1 focus:ring-indigo-500" />
                        <button type="submit" className="rounded-xl bg-indigo-600 px-4 py-1.5 text-xs font-bold text-white hover:bg-indigo-700 transition-colors">دفع</button>
                      </form>
                    </td>
                    <td className="px-6 py-4 text-center font-bold text-rose-600 dark:text-rose-400">{formatDinarAsAlfWithUnit(c.todayTips)}</td>
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
