"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { formatDinarAsAlfWithUnit } from "@/lib/money-alf";

type DayStat = {
  day: number;
  totalProfit: number;
  deliveryProfit: number;
  prepProfit: number;
};

type MonthStat = {
  month: number; // 1 to 12
  totalProfit: number;
  deliveryProfit: number;
  prepProfit: number;
  days: DayStat[];
};

type YearStat = {
  year: number;
  totalProfit: number;
  deliveryProfit: number;
  prepProfit: number;
  months: MonthStat[];
};

type Props = {
  stats: YearStat[];
  secretAdminPath: string;
};

const MONTH_NAMES = [
  "كانون الثاني (1)",
  "شباط (2)",
  "آذار (3)",
  "نيسان (4)",
  "أيار (5)",
  "حزيران (6)",
  "تموز (7)",
  "آب (8)",
  "أيلول (9)",
  "تشرين الأول (10)",
  "تشرين الثاني (11)",
  "كانون الأول (12)"
];

export function ProfitsAnalyticsClient({ stats, secretAdminPath }: Props) {
  // 1. تحديد السنة الافتراضية
  const latestYear = stats.length > 0 ? stats[stats.length - 1].year : new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState<number>(latestYear);

  // البحث عن بيانات السنة المحددة
  const yearData = useMemo(() => {
    return stats.find((s) => s.year === selectedYear) || null;
  }, [stats, selectedYear]);

  // 2. تحديد الشهر الافتراضي (الأعلى ربحاً في تلك السنة، أو الشهر الحالي)
  const defaultMonth = useMemo(() => {
    if (!yearData || yearData.months.length === 0) return 0; // index 0 (January)
    // نجد الشهر الحقيقي الأعلى ربحاً
    let maxVal = -Infinity;
    let maxIdx = 0;
    yearData.months.forEach((m, idx) => {
      if (m.totalProfit > maxVal && m.totalProfit > 0) {
        maxVal = m.totalProfit;
        maxIdx = idx;
      }
    });
    return maxIdx;
  }, [yearData]);

  const [selectedMonthIndex, setSelectedMonthIndex] = useState<number>(0);

  // تحديث الشهر تلقائياً عند تغيير السنة
  useMemo(() => {
    setSelectedMonthIndex(defaultMonth);
  }, [defaultMonth]);

  const monthData = useMemo(() => {
    if (!yearData) return null;
    return yearData.months[selectedMonthIndex] || null;
  }, [yearData, selectedMonthIndex]);

  // 3. تحديد اليوم المختار للتفاصيل السريعة
  const [selectedDayNum, setSelectedDayNum] = useState<number | null>(null);

  const dayData = useMemo(() => {
    if (!monthData || selectedDayNum === null) return null;
    return monthData.days.find((d) => d.day === selectedDayNum) || null;
  }, [monthData, selectedDayNum]);

  // --- حساب القمم والقيعان (الأعلى والأقل) للسنوات ---
  const { maxYear, minYear } = useMemo(() => {
    if (stats.length <= 1) return { maxYear: null, minYear: null };
    let maxVal = -Infinity;
    let minVal = Infinity;
    let maxY: number | null = null;
    let minY: number | null = null;

    stats.forEach((s) => {
      if (s.totalProfit > maxVal) {
        maxVal = s.totalProfit;
        maxY = s.year;
      }
      if (s.totalProfit < minVal && s.totalProfit > 0) {
        minVal = s.totalProfit;
        minY = s.year;
      }
    });
    return { maxYear: maxY, minYear: minY };
  }, [stats]);

  // --- حساب القمم والقيعان للأشهر في السنة المحددة ---
  const { maxMonthIdx, minMonthIdx } = useMemo(() => {
    if (!yearData) return { maxMonthIdx: null, minMonthIdx: null };
    let maxVal = -Infinity;
    let minVal = Infinity;
    let maxIdx: number | null = null;
    let minIdx: number | null = null;

    yearData.months.forEach((m, idx) => {
      if (m.totalProfit > maxVal) {
        maxVal = m.totalProfit;
        maxIdx = idx;
      }
      if (m.totalProfit < minVal && m.totalProfit > 0) {
        minVal = m.totalProfit;
        minIdx = idx;
      }
    });
    return { maxMonthIdx: maxIdx, minMonthIdx: minIdx };
  }, [yearData]);

  // --- حساب القمم والقيعان للأيام في الشهر المحدد ---
  const { maxDayNum, minDayNum } = useMemo(() => {
    if (!monthData || monthData.days.length === 0) return { maxDayNum: null, minDayNum: null };
    let maxVal = -Infinity;
    let minVal = Infinity;
    let maxD: number | null = null;
    let minD: number | null = null;

    monthData.days.forEach((d) => {
      if (d.totalProfit > maxVal) {
        maxVal = d.totalProfit;
        maxD = d.day;
      }
      if (d.totalProfit < minVal && d.totalProfit > 0) {
        minVal = d.totalProfit;
        minD = d.day;
      }
    });
    return { maxDayNum: maxD, minDayNum: minD };
  }, [monthData]);

  // قيم التحويم للأعمدة
  const [hoveredBar, setHoveredBar] = useState<{ type: string; label: string; value: number } | null>(null);

  // صياغة التاريخ لليوم المحدد بشكل YYYY-MM-DD
  const formattedSelectedDayString = useMemo(() => {
    if (selectedDayNum === null) return "";
    const mStr = String(selectedMonthIndex + 1).padStart(2, "0");
    const dStr = String(selectedDayNum).padStart(2, "0");
    return `${selectedYear}-${mStr}-${dStr}`;
  }, [selectedYear, selectedMonthIndex, selectedDayNum]);

  // أرقام السنوات المتوفرة
  const availableYears = stats.map((s) => s.year);

  // أعلى قيمة ربح سنوي لتحديد مقياس شريط السنوات
  const maxYearProfit = Math.max(...stats.map((s) => s.totalProfit), 1);

  // أعلى قيمة ربح شهري لتحديد مقياس شريط الأشهر
  const maxMonthProfit = yearData ? Math.max(...yearData.months.map((m) => m.totalProfit), 1) : 1;

  // أعلى قيمة ربح يومي لتحديد مقياس شريط الأيام
  const maxDayProfit = monthData ? Math.max(...monthData.days.map((d) => d.totalProfit), 1) : 1;

  return (
    <div className="space-y-8 pb-12" dir="rtl">
      {/* 1. التصفية والاختيار السريع للسنة */}
      <div className="flex flex-col gap-4 p-6 rounded-3xl border border-slate-200 bg-white shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h2 className="text-lg font-black text-slate-800">تحليلات الأرباح السنوية والشهرية</h2>
          <p className="text-xs text-slate-400">توزيع أرباح الشركة التفصيلي (أرباح التوصيل وتجهيز اللحوم والأسماك).</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {availableYears.map((y) => (
            <button
              key={y}
              onClick={() => {
                setSelectedYear(y);
                setSelectedDayNum(null);
              }}
              className={`rounded-2xl px-5 py-2.5 text-xs font-black transition-all ${
                y === selectedYear
                  ? "bg-slate-905 text-white shadow-lg scale-105"
                  : "bg-slate-50 text-slate-650 hover:bg-slate-100"
              }`}
            >
              سنة {y}
            </button>
          ))}
        </div>
      </div>

      {/* 2. المخطط السنوي للأرباح */}
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="text-sm font-black text-slate-400 mb-6 uppercase tracking-wider">مقارنة الأرباح السنوية الكلية</h3>
        {stats.length === 0 ? (
          <p className="text-center py-8 text-slate-400 font-bold italic">لا توجد بيانات أرباح مسجلة في النظام.</p>
        ) : (
          <div className="space-y-4">
            {stats.map((s) => {
              const percent = (s.totalProfit / maxYearProfit) * 100;
              const isMax = s.year === maxYear;
              const isMin = s.year === minYear;
              const isSelected = s.year === selectedYear;

              let barColor = "from-emerald-500 to-emerald-600";
              if (isMax) barColor = "from-amber-500 to-amber-600";
              if (isMin) barColor = "from-rose-500 to-rose-600";

              return (
                <div
                  key={s.year}
                  onClick={() => {
                    setSelectedYear(s.year);
                    setSelectedDayNum(null);
                  }}
                  className={`group cursor-pointer rounded-2xl p-3 border transition-all flex flex-col gap-2 ${
                    isSelected
                      ? "bg-slate-900 border-slate-900 text-white shadow-md scale-[1.01]"
                      : "bg-slate-50 hover:bg-slate-100 border-transparent text-slate-800"
                  }`}
                >
                  <div className="flex items-center justify-between text-xs font-black">
                    <div className="flex items-center gap-2">
                      <span>سنة {s.year} م</span>
                      {isMax && <span className="rounded-lg bg-amber-500/10 text-amber-500 px-2 py-0.5 text-[10px]">👑 الأعلى ربحاً</span>}
                      {isMin && <span className="rounded-lg bg-rose-500/10 text-rose-500 px-2 py-0.5 text-[10px]">⚠️ الأقل ربحاً</span>}
                    </div>
                    <span>{formatDinarAsAlfWithUnit(s.totalProfit)}</span>
                  </div>
                  <div className="h-3 w-full rounded-full bg-slate-200/50 overflow-hidden relative">
                    <div
                      className={`h-full rounded-full bg-gradient-to-r ${barColor} transition-all duration-500`}
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                  <div className={`flex items-center justify-between text-[10px] ${isSelected ? "text-slate-400" : "text-slate-500"} font-bold`}>
                    <span>أرباح التوصيل: {formatDinarAsAlfWithUnit(s.deliveryProfit)}</span>
                    <span>أرباح التجهيز: {formatDinarAsAlfWithUnit(s.prepProfit)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 3. المخطط الشهري للسنة المحددة */}
      {yearData && (
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-sm font-black text-slate-800">الأرباح الشهرية لسنة {selectedYear}</h3>
              <p className="text-xs text-slate-400 mt-1">اختر شهراً لاستعراض أرباح الأيام التفصيلية الخاصة به.</p>
            </div>
            <div className="flex gap-4 text-[10px] font-black">
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-amber-500"></span> الأعلى</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-rose-500"></span> الأقل</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-emerald-500"></span> اعتيادي</span>
            </div>
          </div>

          <div className="relative h-64 w-full">
            {/* خطوط الشبكة وقيم المقياس */}
            <div className="absolute inset-0 flex flex-col justify-between pointer-events-none">
              {[0, 1, 2, 3, 4].map((i) => (
                <div key={i} className="w-full border-t border-slate-100 flex items-center justify-start text-[10px] text-slate-400 font-bold h-0">
                  <span className="bg-white px-2 -mt-2">
                    {maxMonthProfit > 0 ? formatDinarAsAlfWithUnit((maxMonthProfit * (4 - i)) / 4) : 0}
                  </span>
                </div>
              ))}
            </div>

            {/* الأعمدة البيانية للأشهر */}
            <div className="absolute inset-0 flex items-end justify-between px-2 pt-6">
              {yearData.months.map((m, idx) => {
                const heightPercent = maxMonthProfit > 0 ? (m.totalProfit / maxMonthProfit) * 85 : 0;
                const isMax = idx === maxMonthIdx;
                const isMin = idx === minMonthIdx;
                const isSelected = idx === selectedMonthIndex;

                let barColor = "from-emerald-500 to-emerald-600";
                if (isMax) barColor = "from-amber-500 to-amber-600";
                if (isMin) barColor = "from-rose-500 to-rose-600";

                if (isSelected) {
                  barColor = `${barColor} ring-4 ring-offset-2 ring-slate-900 scale-105 z-10`;
                }

                return (
                  <div
                    key={m.month}
                    onClick={() => {
                      setSelectedMonthIndex(idx);
                      setSelectedDayNum(null);
                    }}
                    onMouseEnter={() =>
                      setHoveredBar({
                        type: "month",
                        label: `أرباح شهر ${m.month}`,
                        value: m.totalProfit
                      })
                    }
                    onMouseLeave={() => setHoveredBar(null)}
                    className="group flex flex-col items-center flex-1 cursor-pointer"
                    style={{ height: "100%" }}
                  >
                    <div className="flex-1 w-full flex items-end justify-center px-1">
                      <div
                        className={`w-full max-w-[28px] rounded-t-lg bg-gradient-to-t ${barColor} transition-all duration-300 relative shadow-sm`}
                        style={{ height: `${Math.max(heightPercent, m.totalProfit > 0 ? 5 : 2)}%` }}
                      >
                        {m.totalProfit > 0 && (
                          <div className="absolute -top-7 left-1/2 -translate-x-1/2 bg-slate-850 text-white text-[9px] font-black px-1.5 py-0.5 rounded shadow opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-20">
                            {formatDinarAsAlfWithUnit(m.totalProfit)}
                          </div>
                        )}
                      </div>
                    </div>
                    <span className={`mt-2 text-[10px] font-black ${isSelected ? "text-slate-900 scale-110" : "text-slate-500"}`}>
                      {m.month}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {hoveredBar && hoveredBar.type === "month" && (
            <div className="mt-6 p-2.5 rounded-xl bg-slate-900 text-white text-center text-xs font-black shadow border border-slate-700">
              {hoveredBar.label}: {formatDinarAsAlfWithUnit(hoveredBar.value)}
            </div>
          )}
        </div>
      )}

      {/* 4. تفاصيل ونشاط الشهر المختار (أرباح الأيام) */}
      {monthData && (
        <div className="grid gap-6 lg:grid-cols-3">
          {/* رسم بياني لأيام الشهر (2/3 المساحة) */}
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm lg:col-span-2 space-y-6">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-base font-black text-slate-800">
                  توزيع الأرباح اليومي لشهر: <span className="text-slate-900">{MONTH_NAMES[selectedMonthIndex]}</span>
                </h3>
                <p className="text-xs text-slate-450 mt-0.5">انقر على أي يوم لرؤية تفاصيله والانتقال المباشر لتقرير الطلبات.</p>
              </div>
              <div className="rounded-2xl bg-emerald-50 border border-emerald-100 px-4 py-1.5 text-xs font-black text-emerald-700">
                مجموع أرباح الشهر: {formatDinarAsAlfWithUnit(monthData.totalProfit)}
              </div>
            </div>

            {monthData.days.length === 0 ? (
              <div className="flex h-56 items-center justify-center rounded-2xl bg-slate-50 text-slate-400 text-xs font-bold italic">لا توجد أرباح مسجلة في هذا الشهر.</div>
            ) : (
              <div className="relative h-60 w-full pt-4">
                <div className="absolute inset-0 flex flex-col justify-between pointer-events-none">
                  {[0, 1, 2, 3, 4].map((i) => (
                    <div key={i} className="w-full border-t border-slate-100 flex items-center justify-start text-[9px] text-slate-400 font-bold h-0">
                      <span className="bg-white px-1 -mt-1.5">
                        {maxDayProfit > 0 ? formatDinarAsAlfWithUnit((maxDayProfit * (4 - i)) / 4) : 0}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="absolute inset-0 flex items-end justify-between gap-1 px-1 pt-6">
                  {monthData.days.map((d) => {
                    const heightPercent = maxDayProfit > 0 ? (d.totalProfit / maxDayProfit) * 85 : 0;
                    const isMax = d.day === maxDayNum;
                    const isMin = d.day === minDayNum;
                    const isSelected = d.day === selectedDayNum;

                    let barColor = "from-indigo-500 to-indigo-600";
                    if (isMax) barColor = "from-amber-500 to-amber-600";
                    if (isMin) barColor = "from-rose-500 to-rose-600";

                    if (isSelected) {
                      barColor = `${barColor} ring-2 ring-offset-1 ring-slate-900 scale-105 z-10`;
                    }

                    return (
                      <div
                        key={d.day}
                        onClick={() => setSelectedDayNum(d.day)}
                        onMouseEnter={() =>
                          setHoveredBar({
                            type: "day",
                            label: `أرباح يوم ${d.day} / ${selectedMonthIndex + 1}`,
                            value: d.totalProfit
                          })
                        }
                        onMouseLeave={() => setHoveredBar(null)}
                        className="group flex flex-col items-center flex-1 cursor-pointer"
                        style={{ height: "100%" }}
                      >
                        <div className="flex-1 w-full flex items-end justify-center">
                          <div
                            className={`w-full rounded-t-sm bg-gradient-to-t ${barColor} transition-all duration-300 relative`}
                            style={{ height: `${Math.max(heightPercent, d.totalProfit > 0 ? 5 : 2)}%` }}
                          >
                            {d.totalProfit > 0 && (
                              <div className="absolute -top-7 left-1/2 -translate-x-1/2 bg-slate-850 text-white text-[9px] font-black px-1.5 py-0.5 rounded shadow opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-20">
                                {formatDinarAsAlfWithUnit(d.totalProfit)}
                              </div>
                            )}
                          </div>
                        </div>
                        <span className={`mt-1.5 text-[9px] font-black ${isSelected ? "text-slate-900" : "text-slate-400 group-hover:text-slate-800"}`}>
                          {d.day}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {hoveredBar && hoveredBar.type === "day" && (
              <div className="p-2 rounded-xl bg-slate-900 text-white text-center text-[10px] font-bold shadow">
                {hoveredBar.label}: {formatDinarAsAlfWithUnit(hoveredBar.value)}
              </div>
            )}
          </div>

          {/* لوحة التحكم الجانبية لليوم المختار (1/3 المساحة) */}
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm flex flex-col justify-between">
            <div className="space-y-4">
              <h3 className="text-sm font-black text-slate-800 border-b pb-2">تفاصيل اليوم المحدد</h3>
              {dayData ? (
                <div className="space-y-4">
                  <div className="rounded-2xl bg-slate-50 p-4 border border-slate-100">
                    <p className="text-[10px] font-bold text-slate-400 uppercase">تاريخ اليوم</p>
                    <p className="text-lg font-black text-slate-800 mt-1">{formattedSelectedDayString}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-xl bg-sky-50/50 p-3 border border-sky-100">
                      <p className="text-[9px] font-bold text-sky-600">أرباح التوصيل</p>
                      <p className="text-sm font-black text-sky-850 mt-1">{formatDinarAsAlfWithUnit(dayData.deliveryProfit)}</p>
                    </div>
                    <div className="rounded-xl bg-purple-50/50 p-3 border border-purple-100">
                      <p className="text-[9px] font-bold text-purple-600">أرباح التجهيز</p>
                      <p className="text-sm font-black text-purple-850 mt-1">{formatDinarAsAlfWithUnit(dayData.prepProfit)}</p>
                    </div>
                  </div>

                  <div className="rounded-2xl bg-emerald-50 border border-emerald-100 p-4 text-center">
                    <p className="text-[10px] font-black text-emerald-600 uppercase">صافي أرباح اليوم الكلي</p>
                    <p className="text-2xl font-black text-emerald-700 mt-1">{formatDinarAsAlfWithUnit(dayData.totalProfit)}</p>
                  </div>
                </div>
              ) : (
                <div className="text-center py-10 text-slate-400 text-xs font-bold italic">
                  اختر يوماً من المخطط البياني لعرض إحصائياته التفصيلية هنا.
                </div>
              )}
            </div>

            {dayData && (
              <div className="mt-6 pt-4 border-t border-slate-100">
                <Link
                  href={`${secretAdminPath}/reports/couriers?day=${formattedSelectedDayString}`}
                  className="block w-full text-center bg-slate-900 text-white rounded-2xl py-3.5 text-xs font-black shadow hover:bg-slate-800 transition-colors active:scale-95 border-b-4 border-slate-750"
                >
                  🔍 عرض فواتير وطلبات هذا اليوم
                </Link>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
