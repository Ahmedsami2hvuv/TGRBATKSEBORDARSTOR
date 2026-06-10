"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// أسماء الأشهر باللغة العربية
const MONTH_NAMES = [
  "كانون الثاني (يناير)",
  "شباط (فبراير)",
  "آذار (مارس)",
  "نيسان (أبريل)",
  "أيار (مايو)",
  "حزيران (يونيو)",
  "تموز (يوليو)",
  "آب (أغسطس)",
  "أيلول (سبتمبر)",
  "تشرين الأول (أكتوبر)",
  "تشرين الثاني (نوفمبر)",
  "كانون الأول (ديسمبر)"
];

// أسماء أيام الأسبوع باللغة العربية
const WEEKDAY_NAMES = [
  "الأحد",
  "الاثنين",
  "الثلاثاء",
  "الأربعاء",
  "الخميس",
  "الجمعة",
  "السبت"
];

// ترتيب مخصص لأيام الأسبوع لتبدأ من السبت
const WEEKDAY_ORDER = [6, 0, 1, 2, 3, 4, 5];

type MonthlyStat = {
  monthIndex: number;
  totalOrders: number;
  deliveredOrders: number;
  canceledOrders: number;
};

type HourlyStat = {
  hour: number;
  count: number;
};

type WeekdayStat = {
  dayIndex: number;
  count: number;
};

type Props = {
  selectedYear: number;
  availableYears: number[];
  monthlyStats: MonthlyStat[];
  dailyStatsByMonth: { [key: number]: { [day: number]: number } };
  hourlyStats: HourlyStat[];
  weekdayStats: WeekdayStat[];
  secretAdminPath: string;
};

export function GeneralReportsClient({
  selectedYear,
  availableYears,
  monthlyStats,
  dailyStatsByMonth,
  hourlyStats,
  weekdayStats,
  secretAdminPath
}: Props) {
  const router = useRouter();
  const [activeMonth, setActiveMonth] = useState<number>(new Date().getMonth());
  const [hoveredBar, setHoveredBar] = useState<{ type: string; index: number; text: string } | null>(null);

  // إجمالي الطلبات في السنة
  const totalOrdersYear = monthlyStats.reduce((sum, m) => sum + m.totalOrders, 0);
  
  // إجمالي الطلبات المستلمة/المكتملة
  const totalDeliveredYear = monthlyStats.reduce((sum, m) => sum + m.deliveredOrders, 0);

  // نسبة اكتمال الطلبات
  const deliveryRate = totalOrdersYear > 0 
    ? Math.round((totalDeliveredYear / totalOrdersYear) * 100) 
    : 0;

  // تحديد الشهر الأعلى والشهر الأدنى (فقط من الأشهر التي تحتوي على طلبات > 0)
  const activeMonthsWithOrders = monthlyStats.filter(m => m.totalOrders > 0);
  
  let maxMonthIndex = 0;
  let minMonthIndex = 0;
  let maxMonthVal = 0;
  let minMonthVal = Infinity;

  monthlyStats.forEach((m) => {
    if (m.totalOrders > maxMonthVal) {
      maxMonthVal = m.totalOrders;
      maxMonthIndex = m.monthIndex;
    }
    // للأدنى، نأخذ فقط الأشهر التي تحتوي على الأقل على طلب واحد لنعطي نتيجة منطقية
    if (m.totalOrders > 0 && m.totalOrders < minMonthVal) {
      minMonthVal = m.totalOrders;
      minMonthIndex = m.monthIndex;
    }
  });

  // إذا لم تكن هناك أي طلبات في السنة
  if (activeMonthsWithOrders.length === 0) {
    minMonthIndex = -1; // لا يوجد
  }

  // أفضل ساعة (ساعة الذروة)
  let peakHour = 0;
  let peakHourCount = 0;
  hourlyStats.forEach((h) => {
    if (h.count > peakHourCount) {
      peakHourCount = h.count;
      peakHour = h.hour;
    }
  });

  // صياغة اسم الساعة (مثلاً: 9:00 صباحاً أو 4:00 مساءً)
  const formatHourName = (hour: number) => {
    if (hour === 0) return "12:00 منتصف الليل";
    if (hour === 12) return "12:00 ظهراً";
    return hour > 12 ? `${hour - 12}:00 مساءً` : `${hour}:00 صباحاً`;
  };

  // تغيير السنة
  const handleYearChange = (year: number) => {
    router.push(`${secretAdminPath}/reports/general?year=${year}`);
  };

  // بيانات الأيام للشهر المختار
  const daysInSelectedMonth = Array.from({ length: 31 }, (_, i) => i + 1);
  const selectedMonthDailyData = dailyStatsByMonth[activeMonth] || {};
  
  // حساب اليوم الأعلى كثافة في الشهر المختار
  let maxDayInMonth = 1;
  let maxDayCount = 0;
  daysInSelectedMonth.forEach((d) => {
    const count = selectedMonthDailyData[d] || 0;
    if (count > maxDayCount) {
      maxDayCount = count;
      maxDayInMonth = d;
    }
  });

  // حساب إجمالي طلبات الشهر المختار
  const selectedMonthTotalOrders = monthlyStats[activeMonth]?.totalOrders || 0;

  return (
    <div className="space-y-8 pb-12">
      {/* فلتر اختيار السنة بتصميم زجاجي عصري */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-6 rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="space-y-1">
          <h3 className="text-lg font-bold text-slate-800">سنة التقرير</h3>
          <p className="text-sm text-slate-500">اختر السنة لعرض البيانات والإحصائيات الخاصة بها:</p>
        </div>
        <div className="flex gap-2">
          {availableYears.map((year) => (
            <button
              key={year}
              onClick={() => handleYearChange(year)}
              className={`rounded-2xl px-5 py-2.5 text-sm font-bold transition-all ${
                year === selectedYear
                  ? "bg-indigo-600 text-white shadow-lg shadow-indigo-100 scale-105"
                  : "bg-slate-50 text-slate-600 hover:bg-slate-100"
              }`}
            >
              {year} م
            </button>
          ))}
        </div>
      </div>

      {/* كروت الإحصائيات السريعة والذكية */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* إجمالي الطلبات ونسبة التوصيل */}
        <div className="relative overflow-hidden rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition hover:shadow-md">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-400">إجمالي الطلبات في {selectedYear}</p>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-3xl font-black text-slate-800">{totalOrdersYear.toLocaleString()}</span>
            <span className="text-sm font-medium text-slate-500">طلب</span>
          </div>
          <div className="mt-4 flex items-center gap-2">
            <span className="text-xs font-bold text-emerald-600">✓ {deliveryRate}% نسبة الاكتمال</span>
            <div className="h-1.5 flex-1 rounded-full bg-slate-100">
              <div 
                className="h-full rounded-full bg-emerald-500 transition-all duration-500" 
                style={{ width: `${deliveryRate}%` }}
              />
            </div>
          </div>
          <div className="absolute -right-6 -bottom-6 opacity-5 text-indigo-900 pointer-events-none">
            <svg className="w-24 h-24" fill="currentColor" viewBox="0 0 24 24">
              <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-9 14l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
            </svg>
          </div>
        </div>

        {/* الشهر الأكثر صعوداً (الأعلى) */}
        <div className="relative overflow-hidden rounded-3xl border border-emerald-100 bg-emerald-50/10 p-6 shadow-sm transition hover:shadow-md">
          <p className="text-xs font-bold uppercase tracking-wider text-emerald-600">الشهر الأعلى طلباً</p>
          {maxMonthVal > 0 ? (
            <>
              <div className="mt-4">
                <span className="text-2xl font-black text-emerald-800">{MONTH_NAMES[maxMonthIndex].split(" ")[0]}</span>
                <p className="mt-1 text-sm text-slate-500">بمعدل {maxMonthVal.toLocaleString()} طلب</p>
              </div>
              <div className="mt-4 text-xs font-bold text-emerald-600/90 flex items-center gap-1">
                <span className="inline-block">▲</span> ذروة المبيعات
              </div>
            </>
          ) : (
            <p className="mt-4 text-sm text-slate-400">لا توجد بيانات بعد</p>
          )}
          <div className="absolute -right-6 -bottom-6 opacity-5 text-emerald-900 pointer-events-none">
            <svg className="w-24 h-24" fill="currentColor" viewBox="0 0 24 24">
              <path d="M16 6l2.29 2.29-4.88 4.88-4-4L2 16.59 3.41 18l6-6 4 4 6.3-6.29L22 12V6z"/>
            </svg>
          </div>
        </div>

        {/* الشهر الأكثر نزولاً (الأدنى) */}
        <div className="relative overflow-hidden rounded-3xl border border-rose-100 bg-rose-50/10 p-6 shadow-sm transition hover:shadow-md">
          <p className="text-xs font-bold uppercase tracking-wider text-rose-600">الشهر الأقل طلباً</p>
          {minMonthIndex !== -1 && minMonthVal !== Infinity ? (
            <>
              <div className="mt-4">
                <span className="text-2xl font-black text-rose-850">{MONTH_NAMES[minMonthIndex].split(" ")[0]}</span>
                <p className="mt-1 text-sm text-slate-500">بمعدل {minMonthVal.toLocaleString()} طلب</p>
              </div>
              <div className="mt-4 text-xs font-bold text-rose-600/95 flex items-center gap-1">
                <span>▼</span> أقل الشهور نشاطاً
              </div>
            </>
          ) : (
            <p className="mt-4 text-sm text-slate-400">لا توجد بيانات بعد</p>
          )}
          <div className="absolute -right-6 -bottom-6 opacity-5 text-rose-950 pointer-events-none">
            <svg className="w-24 h-24" fill="currentColor" viewBox="0 0 24 24">
              <path d="M16 18l2.29-2.29-4.88-4.88-4 4L2 7.41 3.41 6l6 6 4-4 6.3 6.29L22 12v6z"/>
            </svg>
          </div>
        </div>

        {/* ساعة الذروة اليومية */}
        <div className="relative overflow-hidden rounded-3xl border border-purple-100 bg-purple-50/10 p-6 shadow-sm transition hover:shadow-md">
          <p className="text-xs font-bold uppercase tracking-wider text-purple-600">ساعة الذروة اليومية</p>
          {peakHourCount > 0 ? (
            <>
              <div className="mt-4">
                <span className="text-lg font-black text-purple-800 block leading-tight">{formatHourName(peakHour)}</span>
                <p className="mt-1 text-sm text-slate-500">سُجل فيها {peakHourCount.toLocaleString()} طلب</p>
              </div>
              <div className="mt-4 text-xs font-bold text-purple-600/95 flex items-center gap-1">
                <span>⏱</span> أكثر فترات اليوم نشاطاً
              </div>
            </>
          ) : (
            <p className="mt-4 text-sm text-slate-400">لا توجد بيانات بعد</p>
          )}
          <div className="absolute -right-6 -bottom-6 opacity-5 text-purple-950 pointer-events-none">
            <svg className="w-24 h-24" fill="currentColor" viewBox="0 0 24 24">
              <path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z"/>
            </svg>
          </div>
        </div>
      </div>

      {/* قسم الرسم البياني السنوي / الشهري التفاعلي */}
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-black text-slate-800">توزيع الطلبات على مدار شهور السنة</h2>
            <p className="text-xs text-slate-400 mt-1">اضغط على أي عمود لاستعراض تفاصيل الأيام الخاصة بهذا الشهر في المخطط أدناه.</p>
          </div>
          <div className="flex items-center gap-4 text-xs">
            <span className="flex items-center gap-1.5 text-slate-500 font-semibold">
              <span className="inline-block w-3 h-3 rounded bg-emerald-500 shadow-sm"></span>
              الأعلى نشاطاً
            </span>
            <span className="flex items-center gap-1.5 text-slate-500 font-semibold">
              <span className="inline-block w-3 h-3 rounded bg-rose-500 shadow-sm"></span>
              الأقل نشاطاً
            </span>
            <span className="flex items-center gap-1.5 text-slate-500 font-semibold">
              <span className="inline-block w-3 h-3 rounded bg-indigo-500 shadow-sm"></span>
              أشهر اعتيادية
            </span>
          </div>
        </div>

        {/* مخطط الأعمدة SVG تفاعلي ومميز للغاية */}
        <div className="relative pt-6">
          <div className="relative h-72 w-full">
            {/* خطوط الخلفية والشبكة */}
            <div className="absolute inset-0 flex flex-col justify-between pointer-events-none">
              {[0, 1, 2, 3, 4].map((i) => (
                <div key={i} className="w-full border-t border-slate-100 flex items-center justify-start text-[10px] text-slate-400 font-bold h-0">
                  <span className="bg-white px-2 -mt-2.5">
                    {maxMonthVal > 0 ? Math.round((maxMonthVal * (4 - i)) / 4).toLocaleString() : 0}
                  </span>
                </div>
              ))}
            </div>

            {/* الأعمدة البيانية */}
            <div className="absolute inset-0 flex items-end justify-between px-2 pt-6">
              {monthlyStats.map((item, index) => {
                const heightPercent = maxMonthVal > 0 ? (item.totalOrders / maxMonthVal) * 85 : 0; // حجز مساحة علوية للقيم
                const isMax = index === maxMonthIndex && maxMonthVal > 0;
                const isMin = index === minMonthIndex && minMonthVal !== Infinity && maxMonthVal > 0;
                const isActive = index === activeMonth;

                // اختيار اللون بناءً على القمة والقاع
                let barBgColor = "from-indigo-500 to-indigo-600 shadow-indigo-100";
                let hoverColor = "group-hover:from-indigo-600 group-hover:to-indigo-700";
                
                if (isMax) {
                  barBgColor = "from-emerald-500 to-emerald-600 shadow-emerald-100";
                  hoverColor = "group-hover:from-emerald-600 group-hover:to-emerald-700";
                } else if (isMin) {
                  barBgColor = "from-rose-500 to-rose-600 shadow-rose-100";
                  hoverColor = "group-hover:from-rose-600 group-hover:to-rose-700";
                }

                if (isActive) {
                  barBgColor = `${barBgColor.split(" ")[0]} ${barBgColor.split(" ")[1]} ring-4 ring-offset-2 ring-indigo-500 scale-[1.03] z-10`;
                }

                return (
                  <div
                    key={item.monthIndex}
                    className="group flex flex-col items-center flex-1 cursor-pointer"
                    style={{ height: "100%" }}
                    onClick={() => setActiveMonth(item.monthIndex)}
                    onMouseEnter={() =>
                      setHoveredBar({
                        type: "month",
                        index,
                        text: `${MONTH_NAMES[index]}: ${item.totalOrders.toLocaleString()} طلب (منها ${item.deliveredOrders.toLocaleString()} ناجح و ${item.canceledOrders.toLocaleString()} ملغي)`
                      })
                    }
                    onMouseLeave={() => setHoveredBar(null)}
                  >
                    <div className="flex-1 w-full flex items-end justify-center px-1 sm:px-2">
                      <div
                        className={`w-full max-w-[32px] rounded-t-xl bg-gradient-to-t ${barBgColor} ${hoverColor} transition-all duration-300 relative shadow-lg`}
                        style={{ height: `${Math.max(heightPercent, item.totalOrders > 0 ? 5 : 2)}%` }}
                      >
                        {item.totalOrders > 0 && (
                          <span className="absolute -top-7 left-1/2 -translate-x-1/2 bg-slate-850 text-white text-[10px] font-black px-1.5 py-0.5 rounded shadow opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-20">
                            {item.totalOrders}
                          </span>
                        )}
                      </div>
                    </div>
                    {/* اسم الشهر أسفل العمود */}
                    <span className={`mt-3 text-[10px] font-bold sm:text-xs whitespace-nowrap transition-colors ${
                      isActive ? "text-indigo-600 font-black" : "text-slate-500 group-hover:text-slate-850"
                    }`}>
                      {MONTH_NAMES[index].split(" ")[0]}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* تلميح التحويم المخصص التفاعلي */}
          {hoveredBar && hoveredBar.type === "month" && (
            <div className="mt-6 p-3 rounded-2xl bg-indigo-950 text-white text-center text-sm font-semibold shadow-lg border border-indigo-700/30">
              {hoveredBar.text}
            </div>
          )}
        </div>
      </div>

      {/* قسم تفاصيل الشهر المختار (توزيع الأيام) */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* رسم بياني لأيام الشهر المختار (2/3 المساحة) */}
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm lg:col-span-2">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-black text-slate-800">
                حجم الطلبات اليومي لشهر: <span className="text-indigo-600">{MONTH_NAMES[activeMonth].split(" ")[0]}</span>
              </h2>
              <p className="text-xs text-slate-400 mt-1">يوضح كثافة الطلبات لكل يوم من أيام الشهر (1-31).</p>
            </div>
            <div className="rounded-2xl bg-indigo-50 px-3 py-1.5 text-xs font-bold text-indigo-700">
              مجموع طلبات الشهر: {selectedMonthTotalOrders.toLocaleString()}
            </div>
          </div>

          {/* رسم بياني بالـ CSS لأيام الشهر */}
          <div className="pt-6">
            {selectedMonthTotalOrders > 0 ? (
              <div className="flex h-56 items-end justify-between gap-1 border-b border-slate-100 pb-1">
                {daysInSelectedMonth.map((day) => {
                  const count = selectedMonthDailyData[day] || 0;
                  const dayHeightPercent = maxDayCount > 0 ? (count / maxDayCount) * 85 : 0;
                  const isPeakDay = count === maxDayCount && maxDayCount > 0;

                  return (
                    <div
                      key={day}
                      className="group flex flex-1 flex-col items-center justify-end"
                      style={{ height: "100%" }}
                      onMouseEnter={() =>
                        setHoveredBar({
                          type: "day",
                          index: day,
                          text: `اليوم: ${day} ${MONTH_NAMES[activeMonth].split(" ")[0]} | الطلبات: ${count} طلب`
                        })
                      }
                      onMouseLeave={() => setHoveredBar(null)}
                    >
                      <div
                        className={`w-full rounded-t-sm transition-all duration-300 relative ${
                          isPeakDay
                            ? "bg-gradient-to-t from-emerald-500 to-emerald-600 shadow-md shadow-emerald-100"
                            : count > 0
                            ? "bg-indigo-500 hover:bg-indigo-600"
                            : "bg-slate-100"
                        }`}
                        style={{ height: `${Math.max(dayHeightPercent, count > 0 ? 5 : 2)}%` }}
                      >
                        {count > 0 && (
                          <div className="absolute -top-7 left-1/2 -translate-x-1/2 bg-slate-850 text-white text-[9px] font-black px-1.5 py-0.5 rounded shadow opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-20">
                            {count}
                          </div>
                        )}
                      </div>
                      <span className="mt-1 text-[9px] font-semibold text-slate-400 group-hover:text-slate-800">
                        {day}
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex h-56 items-center justify-center rounded-2xl bg-slate-50 text-slate-400 text-sm">
                لا توجد طلبات مسجلة في هذا الشهر.
              </div>
            )}

            {/* تفاصيل اليوم الأعلى */}
            {selectedMonthTotalOrders > 0 && maxDayCount > 0 && (
              <div className="mt-4 flex items-center justify-between text-xs rounded-2xl bg-emerald-50/40 border border-emerald-100/50 p-3">
                <span className="text-slate-650 font-bold">يوم الكثافة الأعلى في هذا الشهر:</span>
                <span className="text-emerald-700 font-black">
                  يوم {maxDayInMonth} من الشهر (بواقع {maxDayCount} طلب)
                </span>
              </div>
            )}

            {hoveredBar && hoveredBar.type === "day" && (
              <div className="mt-4 p-2.5 rounded-xl bg-indigo-950 text-white text-center text-xs font-semibold shadow">
                {hoveredBar.text}
              </div>
            )}
          </div>
        </div>

        {/* توزيع أيام الأسبوع (1/3 المساحة) */}
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-black text-slate-850 mb-1">توزيع الطلبات الأسبوعي</h2>
          <p className="text-xs text-slate-450 mb-6">مقارنة لتوزيع الطلبات حسب أيام الأسبوع لمعرفة أيام الكثافة الأسبوعية.</p>

          <div className="space-y-4">
            {WEEKDAY_ORDER.map((dayIndex) => {
              const item = weekdayStats.find((w) => w.dayIndex === dayIndex);
              const count = item ? item.count : 0;
              
              // تحديد أقصى قيمة لأيام الأسبوع لحساب النسبة المئوية لعرض الشريط
              const maxWeekdayCount = Math.max(...weekdayStats.map((w) => w.count), 1);
              const percentage = (count / maxWeekdayCount) * 100;

              return (
                <div key={dayIndex} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-700">{WEEKDAY_NAMES[dayIndex]}</span>
                    <span className="font-black text-slate-900">{count.toLocaleString()} طلب</span>
                  </div>
                  <div className="h-3 w-full rounded-full bg-slate-50 overflow-hidden border border-slate-100">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-indigo-600 shadow-sm transition-all duration-500"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* قسم توزيع أوقات اليوم وساعات النشاط */}
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-6">
          <h2 className="text-lg font-black text-slate-850">كثافة الطلبات على مدار 24 ساعة</h2>
          <p className="text-xs text-slate-450 mt-1">يوضح هذا المخطط الساعات الـ 24 لليوم لتحديد متى يصعد ضغط الطلبات إلى النظام.</p>
        </div>

        {/* مخطط الساعات تفاعلي وجميل */}
        <div className="pt-6">
          <div className="flex h-52 items-end justify-between gap-1.5 border-b border-slate-100 pb-1">
            {hourlyStats.map((item) => {
              const hourHeightPercent = peakHourCount > 0 ? (item.count / peakHourCount) * 90 : 0;
              const isPeak = item.hour === peakHour && peakHourCount > 0;

              return (
                <div
                  key={item.hour}
                  className="group flex flex-1 flex-col items-center justify-end"
                  style={{ height: "100%" }}
                  onMouseEnter={() =>
                    setHoveredBar({
                      type: "hour",
                      index: item.hour,
                      text: `التوقيت: ${formatHourName(item.hour)} | ${item.count} طلب`
                    })
                  }
                  onMouseLeave={() => setHoveredBar(null)}
                >
                  <div
                    className={`w-full rounded-t-md transition-all duration-300 relative ${
                      isPeak
                        ? "bg-gradient-to-t from-purple-500 to-purple-600 shadow-md shadow-purple-100"
                        : item.count > 0
                        ? "bg-indigo-500 hover:bg-indigo-600"
                        : "bg-slate-100"
                    }`}
                    style={{ height: `${Math.max(hourHeightPercent, item.count > 0 ? 5 : 2)}%` }}
                  >
                    {item.count > 0 && (
                      <div className="absolute -top-7 left-1/2 -translate-x-1/2 bg-slate-850 text-white text-[9px] font-black px-1.5 py-0.5 rounded shadow opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-20">
                        {item.count}
                      </div>
                    )}
                  </div>
                  <span className={`mt-2 text-[9px] font-bold ${
                    isPeak ? "text-purple-600 font-black" : "text-slate-450"
                  }`}>
                    {item.hour}:00
                  </span>
                </div>
              );
            })}
          </div>
          
          <div className="mt-4 flex flex-wrap justify-between items-center text-xs text-slate-500">
            <span>ساعات اليوم (من 0 إلى 23)</span>
            <div className="flex gap-4">
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-indigo-500"></span> ساعات اعتيادية</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-purple-500"></span> ذروة الطلبات اليومية</span>
            </div>
          </div>

          {hoveredBar && hoveredBar.type === "hour" && (
            <div className="mt-4 p-2.5 rounded-xl bg-indigo-950 text-white text-center text-xs font-semibold shadow">
              {hoveredBar.text}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
