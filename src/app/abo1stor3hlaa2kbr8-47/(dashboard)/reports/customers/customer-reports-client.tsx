"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const MONTH_NAMES = [
  "يناير", "فبراير", "مارس", "إبريل", "مايو", "يونيو",
  "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر",
];

type CustomerStat = {
  customerId: string | null;
  customerPhone: string;
  customerName: string;
  totalOrders: number;
  deliveredOrders: number;
  canceledOrders: number;
  pendingOrders: number;
  monthlyOrders: number[];
  firstOrderDate: string;
  lastOrderDate: string;
};

type Props = {
  selectedYear: number;
  selectedMonth: number | null;
  currentMonth: number;
  availableYears: number[];
  customerStats: CustomerStat[];
  totalOrders: number;
  uniqueCustomers: number;
  repeatCustomers: number;
  secretAdminPath: string;
};

export function CustomerReportsClient({
  selectedYear,
  selectedMonth,
  availableYears,
  customerStats,
  totalOrders,
  uniqueCustomers,
  repeatCustomers,
  secretAdminPath,
}: Props) {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedCustomer, setExpandedCustomer] = useState<string | null>(null);

  const isMonthlyView = selectedMonth !== null;

  // تغيير السنة
  const handleYearChange = (year: number) => {
    if (isMonthlyView && selectedMonth !== null) {
      router.push(`${secretAdminPath}/reports/customers?year=${year}&month=${selectedMonth}`);
    } else {
      router.push(`${secretAdminPath}/reports/customers?year=${year}`);
    }
  };

  // تغيير الشهر
  const handleMonthChange = (month: number | null) => {
    if (month === null) {
      router.push(`${secretAdminPath}/reports/customers?year=${selectedYear}`);
    } else {
      router.push(`${secretAdminPath}/reports/customers?year=${selectedYear}&month=${month}`);
    }
  };

  // فلترة الزبائن حسب البحث
  const filteredCustomers = customerStats.filter((c) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.trim().toLowerCase();
    return (
      c.customerName.toLowerCase().includes(q) ||
      c.customerPhone.includes(q)
    );
  });

  // متوسط الطلبات لكل زبون
  const avgOrdersPerCustomer =
    uniqueCustomers > 0 ? (totalOrders / uniqueCustomers).toFixed(1) : "0";

  // أعلى زبون طلباً
  const topCustomer = customerStats[0];

  // نسبة الزبائن المتكررين
  const repeatRate =
    uniqueCustomers > 0
      ? Math.round((repeatCustomers / uniqueCustomers) * 100)
      : 0;

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString("ar-IQ", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  return (
    <div className="space-y-6 pb-12">
      {/* ===== فلتر السنة والشهر ===== */}
      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
        {/* اختيار السنة */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-slate-800">سنة التقرير</h3>
            <p className="text-xs text-slate-500">اختر السنة والشهر لعرض تقرير الزبائن</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            {availableYears.map((year) => (
              <button
                key={year}
                onClick={() => handleYearChange(year)}
                className={`rounded-2xl px-4 py-2 text-sm font-bold transition-all ${
                  year === selectedYear
                    ? "bg-violet-600 text-white shadow-lg shadow-violet-100 scale-105"
                    : "bg-slate-50 text-slate-600 hover:bg-slate-100"
                }`}
              >
                {year} م
              </button>
            ))}
          </div>
        </div>

        {/* اختيار الشهر */}
        <div className="flex flex-wrap gap-2">
          {/* زر "الكل" = السنوي */}
          <button
            onClick={() => handleMonthChange(null)}
            className={`rounded-xl px-3 py-1.5 text-xs font-bold transition-all ${
              selectedMonth === null
                ? "bg-violet-100 text-violet-700 ring-2 ring-violet-300"
                : "bg-slate-50 text-slate-500 hover:bg-slate-100"
            }`}
          >
            السنة كاملة
          </button>
          {MONTH_NAMES.map((name, idx) => (
            <button
              key={idx}
              onClick={() => handleMonthChange(idx)}
              className={`rounded-xl px-3 py-1.5 text-xs font-bold transition-all ${
                selectedMonth === idx
                  ? "bg-violet-100 text-violet-700 ring-2 ring-violet-300"
                  : "bg-slate-50 text-slate-500 hover:bg-slate-100"
              }`}
            >
              {name}
            </button>
          ))}
        </div>
      </div>

      {/* ===== عنوان الفترة ===== */}
      <div className="text-center">
        <span className="inline-block rounded-full bg-violet-50 px-5 py-2 text-sm font-bold text-violet-700 border border-violet-200">
          {isMonthlyView
            ? `${MONTH_NAMES[selectedMonth!]} ${selectedYear}`
            : `سنة ${selectedYear} كاملة`}
        </span>
      </div>

      {/* ===== كروت الإحصائيات السريعة ===== */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* إجمالي الطلبات */}
        <div className="relative overflow-hidden rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
            إجمالي الطلبات
          </p>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-black text-slate-800">
              {totalOrders.toLocaleString()}
            </span>
            <span className="text-sm font-medium text-slate-500">طلب</span>
          </div>
          <div className="absolute -left-4 -bottom-4 text-violet-100 pointer-events-none">
            <svg className="w-20 h-20" fill="currentColor" viewBox="0 0 24 24">
              <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z"/>
            </svg>
          </div>
        </div>

        {/* عدد الزبائن */}
        <div className="relative overflow-hidden rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
            عدد الزبائن
          </p>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-black text-violet-700">
              {uniqueCustomers.toLocaleString()}
            </span>
            <span className="text-sm font-medium text-slate-500">زبون</span>
          </div>
          <p className="mt-2 text-xs text-slate-400">
            متوسط {avgOrdersPerCustomer} طلب / زبون
          </p>
          <div className="absolute -left-4 -bottom-4 text-violet-100 pointer-events-none">
            <svg className="w-20 h-20" fill="currentColor" viewBox="0 0 24 24">
              <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/>
            </svg>
          </div>
        </div>

        {/* الزبائن المتكررون */}
        <div className="relative overflow-hidden rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
            الزبائن المتكررون
          </p>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-black text-emerald-700">
              {repeatCustomers.toLocaleString()}
            </span>
            <span className="text-sm font-medium text-slate-500">زبون</span>
          </div>
          <div className="mt-2 flex items-center gap-2">
            <span className="text-xs font-bold text-emerald-600">{repeatRate}% من الزبائن</span>
            <div className="h-1.5 flex-1 rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                style={{ width: `${repeatRate}%` }}
              />
            </div>
          </div>
        </div>

        {/* أعلى زبون */}
        <div className="relative overflow-hidden rounded-3xl border border-amber-200 bg-amber-50/40 p-6 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-wider text-amber-600">
            الزبون الأكثر طلباً
          </p>
          {topCustomer ? (
            <>
              <div className="mt-3">
                <p className="text-base font-black text-slate-800 truncate">
                  {topCustomer.customerName}
                </p>
                <p className="text-xs text-slate-500 mt-0.5">{topCustomer.customerPhone}</p>
              </div>
              <div className="mt-2 flex items-baseline gap-1">
                <span className="text-2xl font-black text-amber-600">
                  {topCustomer.totalOrders}
                </span>
                <span className="text-xs text-slate-500">طلب</span>
              </div>
            </>
          ) : (
            <p className="mt-3 text-sm text-slate-400">لا توجد بيانات</p>
          )}
          <div className="absolute -left-4 -bottom-4 text-amber-200 pointer-events-none">
            <svg className="w-20 h-20" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/>
            </svg>
          </div>
        </div>
      </div>

      {/* ===== جدول الزبائن ===== */}
      <div className="rounded-3xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        {/* رأس الجدول مع البحث */}
        <div className="p-5 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-slate-800">
              قائمة الزبائن مرتبة حسب عدد الطلبات
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              إجمالي {uniqueCustomers} زبون • {totalOrders} طلب
            </p>
          </div>
          {/* خانة البحث */}
          <input
            type="text"
            placeholder="بحث باسم أو هاتف الزبون..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-800 outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100 w-full sm:w-64"
            dir="rtl"
          />
        </div>

        {/* قائمة الزبائن */}
        {filteredCustomers.length === 0 ? (
          <div className="py-20 text-center">
            <p className="text-slate-400 text-sm">
              {searchQuery ? "لا توجد نتائج للبحث" : "لا توجد بيانات للفترة المختارة"}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filteredCustomers.map((customer, index) => {
              const customerKey =
                customer.customerId ?? `phone:${customer.customerPhone}`;
              const isExpanded = expandedCustomer === customerKey;
              const deliveryRate =
                customer.totalOrders > 0
                  ? Math.round(
                      (customer.deliveredOrders / customer.totalOrders) * 100
                    )
                  : 0;

              // لون الرتبة
              let rankColor = "text-slate-400";
              let rankBg = "bg-slate-100";
              if (index === 0) { rankColor = "text-amber-700"; rankBg = "bg-amber-100"; }
              else if (index === 1) { rankColor = "text-slate-600"; rankBg = "bg-slate-200"; }
              else if (index === 2) { rankColor = "text-orange-700"; rankBg = "bg-orange-100"; }

              // أقصى قيمة شهرية للبار شارت
              const maxMonthlyOrders = Math.max(...customer.monthlyOrders, 1);

              return (
                <div key={customerKey} className="transition-all">
                  {/* صف الزبون الرئيسي */}
                  <button
                    onClick={() =>
                      setExpandedCustomer(isExpanded ? null : customerKey)
                    }
                    className="w-full text-right p-4 hover:bg-slate-50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      {/* رقم الترتيب */}
                      <div
                        className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-xs font-black ${rankBg} ${rankColor}`}
                      >
                        {index + 1}
                      </div>

                      {/* معلومات الزبون */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline gap-2 flex-wrap">
                          <span className="font-bold text-slate-800 truncate">
                            {customer.customerName}
                          </span>
                          <span className="text-xs text-slate-400">
                            {customer.customerPhone}
                          </span>
                        </div>
                        {/* شريط التقدم */}
                        <div className="mt-1.5 flex items-center gap-2">
                          <div className="flex-1 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                            <div
                              className="h-full rounded-full bg-violet-500 transition-all"
                              style={{
                                width: `${Math.min(
                                  (customer.totalOrders /
                                    (customerStats[0]?.totalOrders || 1)) *
                                    100,
                                  100
                                )}%`,
                              }}
                            />
                          </div>
                          <span className="text-xs text-slate-400 whitespace-nowrap">
                            {deliveryRate}% مكتمل
                          </span>
                        </div>
                      </div>

                      {/* إحصائيات سريعة */}
                      <div className="flex-shrink-0 flex items-center gap-3 text-right">
                        <div>
                          <p className="text-lg font-black text-violet-700">
                            {customer.totalOrders}
                          </p>
                          <p className="text-xs text-slate-400">طلب</p>
                        </div>
                        <div className="hidden sm:block">
                          <p className="text-sm font-bold text-emerald-600">
                            {customer.deliveredOrders}
                          </p>
                          <p className="text-xs text-slate-400">مُكتمل</p>
                        </div>
                        <div className="hidden sm:block">
                          <p className="text-sm font-bold text-rose-500">
                            {customer.canceledOrders}
                          </p>
                          <p className="text-xs text-slate-400">ملغي</p>
                        </div>
                        {/* سهم التوسيع */}
                        <div
                          className={`text-slate-400 transition-transform duration-200 ${
                            isExpanded ? "rotate-180" : ""
                          }`}
                        >
                          <svg
                            className="w-4 h-4"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M19 9l-7 7-7-7"
                            />
                          </svg>
                        </div>
                      </div>
                    </div>
                  </button>

                  {/* التفاصيل الموسعة */}
                  {isExpanded && (
                    <div className="px-4 pb-4 bg-slate-50/60 border-t border-slate-100">
                      <div className="pt-4 space-y-4">
                        {/* معلومات أساسية */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                          <div className="rounded-2xl bg-white p-3 border border-slate-200 text-center">
                            <p className="text-xs text-slate-400">إجمالي الطلبات</p>
                            <p className="text-xl font-black text-violet-700 mt-1">
                              {customer.totalOrders}
                            </p>
                          </div>
                          <div className="rounded-2xl bg-white p-3 border border-slate-200 text-center">
                            <p className="text-xs text-slate-400">مكتملة</p>
                            <p className="text-xl font-black text-emerald-600 mt-1">
                              {customer.deliveredOrders}
                            </p>
                          </div>
                          <div className="rounded-2xl bg-white p-3 border border-slate-200 text-center">
                            <p className="text-xs text-slate-400">ملغاة</p>
                            <p className="text-xl font-black text-rose-500 mt-1">
                              {customer.canceledOrders}
                            </p>
                          </div>
                          <div className="rounded-2xl bg-white p-3 border border-slate-200 text-center">
                            <p className="text-xs text-slate-400">أخرى / معلقة</p>
                            <p className="text-xl font-black text-amber-500 mt-1">
                              {customer.pendingOrders}
                            </p>
                          </div>
                        </div>

                        {/* معلومات إضافية */}
                        <div className="flex flex-wrap gap-3 text-xs text-slate-500">
                          <span>
                            📅 أول طلب: {formatDate(customer.firstOrderDate)}
                          </span>
                          <span>
                            🕐 آخر طلب: {formatDate(customer.lastOrderDate)}
                          </span>
                          {customer.customerId && (
                            <span className="text-violet-500">✓ زبون مسجل</span>
                          )}
                        </div>

                        {/* مخطط شهري مصغر (يظهر فقط في التقرير السنوي) */}
                        {selectedMonth === null && (
                          <div>
                            <p className="text-xs font-bold text-slate-500 mb-2">
                              توزيع الطلبات الشهري
                            </p>
                            <div className="flex items-end gap-1 h-16">
                              {MONTH_NAMES.map((name, mIdx) => {
                                const count = customer.monthlyOrders[mIdx];
                                const heightPct =
                                  maxMonthlyOrders > 0
                                    ? (count / maxMonthlyOrders) * 100
                                    : 0;
                                return (
                                  <div
                                    key={mIdx}
                                    className="flex-1 flex flex-col items-center gap-0.5"
                                    title={`${name}: ${count} طلب`}
                                  >
                                    <div className="w-full flex items-end justify-center h-12">
                                      {count > 0 && (
                                        <div
                                          className="w-full rounded-t-sm bg-violet-400 transition-all"
                                          style={{ height: `${heightPct}%` }}
                                        />
                                      )}
                                      {count === 0 && (
                                        <div className="w-full h-0.5 bg-slate-200 rounded" />
                                      )}
                                    </div>
                                    <span className="text-[9px] text-slate-400">
                                      {mIdx + 1}
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* تذييل الجدول */}
        {filteredCustomers.length > 0 && (
          <div className="p-4 border-t border-slate-100 text-center">
            <p className="text-xs text-slate-400">
              يعرض {filteredCustomers.length} من {uniqueCustomers} زبون
              {searchQuery && ` (نتائج البحث عن "${searchQuery}")`}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
