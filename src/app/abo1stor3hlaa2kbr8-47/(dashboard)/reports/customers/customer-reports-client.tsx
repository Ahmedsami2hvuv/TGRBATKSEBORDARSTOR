"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";

const MONTH_NAMES = [
  "1", "2", "3", "4", "5", "6",
  "7", "8", "9", "10", "11", "12",
];

// ترجمة حالات الطلب
const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  pending:    { label: "قيد الانتظار",  color: "bg-amber-100 text-amber-800" },
  assigned:   { label: "مسند للمندوب", color: "bg-sky-100 text-sky-800" },
  delivering: { label: "جارٍ التوصيل", color: "bg-blue-100 text-blue-800" },
  delivered:  { label: "تم التسليم",   color: "bg-emerald-100 text-emerald-800" },
  completed:  { label: "مكتمل",         color: "bg-green-100 text-green-800" },
  canceled:   { label: "ملغي",          color: "bg-rose-100 text-rose-800" },
  cancelled:  { label: "ملغي",          color: "bg-rose-100 text-rose-800" },
  rejected:   { label: "مرفوض",         color: "bg-red-100 text-red-800" },
  archived:   { label: "مؤرشف",         color: "bg-slate-100 text-slate-600" },
};

type OrderDetail = {
  id: string;
  orderNumber: number;
  status: string;
  createdAt: string;
  orderType: string;
  orderSubtotal: string | null;
  deliveryPrice: string | null;
  totalAmount: string | null;
  summary: string;
  customerLandmark: string;
  customerLocationUrl: string;
  shop: { name: string } | null;
  customerRegion: { name: string } | null;
  courier: { name: string } | null;
  submittedBy: { name: string } | null;
};

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

// ==============================
// مكون المودال
// ==============================
function CustomerOrdersModal({
  customer,
  selectedYear,
  selectedMonth,
  onClose,
  secretAdminPath,
}: {
  customer: CustomerStat;
  selectedYear: number;
  selectedMonth: number | null;
  onClose: () => void;
  secretAdminPath: string;
}) {
  const [orders, setOrders] = useState<OrderDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if (customer.customerId) {
        params.set("customerId", customer.customerId);
      } else {
        params.set("phone", customer.customerPhone);
      }
      params.set("year", String(selectedYear));
      if (selectedMonth !== null) params.set("month", String(selectedMonth));

      const res = await fetch(
        `${secretAdminPath}/api/customer-report-orders?${params.toString()}`
      );
      if (!res.ok) throw new Error("فشل في جلب البيانات");
      const data = await res.json();
      setOrders(data.orders ?? []);
    } catch {
      setError("حدث خطأ أثناء تحميل الطلبات، حاول مرة أخرى.");
    } finally {
      setLoading(false);
    }
  }, [customer, selectedYear, selectedMonth, secretAdminPath]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  // إغلاق عند الضغط على Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString("ar-IQ", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const statusInfo = (status: string) =>
    STATUS_LABELS[status] ?? { label: status, color: "bg-slate-100 text-slate-600" };

  const periodLabel =
    selectedMonth !== null
      ? `شهر ${MONTH_NAMES[selectedMonth]} ${selectedYear}`
      : `سنة ${selectedYear}`;

  return (
    // خلفية المودال
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 backdrop-blur-sm p-4 pt-12 overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="relative w-full max-w-3xl rounded-3xl bg-white shadow-2xl"
        dir="rtl"
      >
        {/* رأس المودال */}
        <div className="flex items-start justify-between gap-3 rounded-t-3xl bg-gradient-to-l from-violet-50 to-purple-50 border-b border-violet-100 p-5">
          <div>
            <h2 className="text-lg font-black text-slate-800">
              {customer.customerName}
            </h2>
            <p className="text-sm text-slate-500 mt-0.5">
              📞 {customer.customerPhone}
            </p>
            <p className="text-xs text-violet-600 mt-1 font-bold">
              طلبات {periodLabel}
            </p>
          </div>
          <button
            onClick={onClose}
            className="flex-shrink-0 rounded-xl p-2 text-slate-400 hover:bg-white hover:text-slate-700 transition"
            aria-label="إغلاق"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* ملخص سريع */}
        <div className="flex flex-wrap gap-3 px-5 py-3 border-b border-slate-100 bg-slate-50/50">
          <span className="text-xs font-bold text-violet-700 bg-violet-50 rounded-full px-3 py-1">
            إجمالي: {customer.totalOrders} طلب
          </span>
          <span className="text-xs font-bold text-emerald-700 bg-emerald-50 rounded-full px-3 py-1">
            مكتملة: {customer.deliveredOrders}
          </span>
          <span className="text-xs font-bold text-rose-600 bg-rose-50 rounded-full px-3 py-1">
            ملغاة: {customer.canceledOrders}
          </span>
          <span className="text-xs font-bold text-amber-600 bg-amber-50 rounded-full px-3 py-1">
            أخرى: {customer.pendingOrders}
          </span>
        </div>

        {/* المحتوى */}
        <div className="p-5 max-h-[65vh] overflow-y-auto">
          {loading && (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <div className="w-10 h-10 rounded-full border-4 border-violet-200 border-t-violet-600 animate-spin" />
              <p className="text-sm text-slate-400">جارٍ تحميل الطلبات...</p>
            </div>
          )}

          {!loading && error && (
            <div className="text-center py-10">
              <p className="text-rose-600 text-sm font-bold">{error}</p>
              <button
                onClick={fetchOrders}
                className="mt-3 rounded-xl bg-rose-50 border border-rose-200 px-4 py-2 text-sm font-bold text-rose-700 hover:bg-rose-100 transition"
              >
                إعادة المحاولة
              </button>
            </div>
          )}

          {!loading && !error && orders.length === 0 && (
            <div className="text-center py-16">
              <p className="text-slate-400 text-sm">لا توجد طلبات في هذه الفترة</p>
            </div>
          )}

          {!loading && !error && orders.length > 0 && (
            <div className="space-y-3">
              {orders.map((order, idx) => {
                const st = statusInfo(order.status);
                return (
                  <a
                    key={order.id}
                    href={`${secretAdminPath}/orders/${order.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block rounded-2xl border border-slate-200 bg-white p-4 hover:border-violet-300 hover:shadow-md transition group"
                  >
                    <div className="flex items-start justify-between gap-3">
                      {/* رقم تسلسلي + رقم الطلب */}
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-300 font-mono w-5 text-center">
                          {idx + 1}
                        </span>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-base font-black text-violet-700">
                              #{order.orderNumber}
                            </span>
                            <span
                              className={`text-xs font-bold rounded-full px-2 py-0.5 ${st.color}`}
                            >
                              {st.label}
                            </span>
                          </div>
                          <p className="text-xs text-slate-400 mt-0.5">
                            {formatDate(order.createdAt)}
                          </p>
                        </div>
                      </div>

                      {/* زر فتح الطلب */}
                      <span className="flex-shrink-0 text-xs font-bold text-violet-500 group-hover:text-violet-700 transition">
                        عرض ←
                      </span>
                    </div>

                    {/* تفاصيل الطلب */}
                    <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-1.5 text-xs text-slate-600">
                      {order.shop && (
                        <span>🏪 <span className="font-medium">{order.shop.name}</span></span>
                      )}
                      {order.customerRegion && (
                        <span>📍 <span className="font-medium">{order.customerRegion.name}</span></span>
                      )}
                      {order.courier && (
                        <span>🛵 <span className="font-medium">{order.courier.name}</span></span>
                      )}
                      {order.submittedBy && (
                        <span>👤 <span className="font-medium">{order.submittedBy.name}</span></span>
                      )}
                      {order.customerLandmark && (
                        <span className="col-span-2">🏠 {order.customerLandmark}</span>
                      )}
                    </div>

                    {/* المبالغ */}
                    <div className="mt-3 flex flex-wrap gap-3 text-xs border-t border-slate-100 pt-2">
                      {order.orderSubtotal && (
                        <span className="text-slate-500">
                          مجموع المنتجات:{" "}
                          <span className="font-bold text-slate-700">
                            {Number(order.orderSubtotal).toLocaleString()} د.ع
                          </span>
                        </span>
                      )}
                      {order.deliveryPrice && (
                        <span className="text-slate-500">
                          التوصيل:{" "}
                          <span className="font-bold text-slate-700">
                            {Number(order.deliveryPrice).toLocaleString()} د.ع
                          </span>
                        </span>
                      )}
                      {order.totalAmount && (
                        <span className="text-slate-500">
                          الإجمالي:{" "}
                          <span className="font-bold text-violet-700">
                            {Number(order.totalAmount).toLocaleString()} د.ع
                          </span>
                        </span>
                      )}
                      {!order.orderSubtotal && !order.deliveryPrice && !order.totalAmount && (
                        <span className="text-slate-300">لا توجد مبالغ مسجلة</span>
                      )}
                    </div>

                    {/* ملاحظة الطلب إن وجدت */}
                    {order.summary && (
                      <p className="mt-2 text-xs text-slate-500 bg-slate-50 rounded-xl px-3 py-2 line-clamp-2">
                        {order.summary}
                      </p>
                    )}
                  </a>
                );
              })}
            </div>
          )}
        </div>

        {/* تذييل المودال */}
        {!loading && orders.length > 0 && (
          <div className="px-5 py-3 border-t border-slate-100 text-center">
            <p className="text-xs text-slate-400">
              يعرض {orders.length} طلب • اضغط على أي طلب لفتحه في نافذة جديدة
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ==============================
// المكون الرئيسي
// ==============================
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
  const [modalCustomer, setModalCustomer] = useState<CustomerStat | null>(null);

  const isMonthlyView = selectedMonth !== null;

  const handleYearChange = (year: number) => {
    if (isMonthlyView && selectedMonth !== null) {
      router.push(`${secretAdminPath}/reports/customers?year=${year}&month=${selectedMonth}`);
    } else {
      router.push(`${secretAdminPath}/reports/customers?year=${year}`);
    }
  };

  const handleMonthChange = (month: number | null) => {
    if (month === null) {
      router.push(`${secretAdminPath}/reports/customers?year=${selectedYear}`);
    } else {
      router.push(`${secretAdminPath}/reports/customers?year=${selectedYear}&month=${month}`);
    }
  };

  const filteredCustomers = customerStats.filter((c) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.trim().toLowerCase();
    return (
      c.customerName.toLowerCase().includes(q) ||
      c.customerPhone.includes(q)
    );
  });

  const avgOrdersPerCustomer =
    uniqueCustomers > 0 ? (totalOrders / uniqueCustomers).toFixed(1) : "0";
  const topCustomer = customerStats[0];
  const repeatRate =
    uniqueCustomers > 0
      ? Math.round((repeatCustomers / uniqueCustomers) * 100)
      : 0;

  return (
    <>
      {/* ===== المودال ===== */}
      {modalCustomer && (
        <CustomerOrdersModal
          customer={modalCustomer}
          selectedYear={selectedYear}
          selectedMonth={selectedMonth}
          onClose={() => setModalCustomer(null)}
          secretAdminPath={secretAdminPath}
        />
      )}

      <div className="space-y-6 pb-12">
        {/* ===== فلتر السنة والشهر ===== */}
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
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

          <div className="flex flex-wrap gap-2">
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
              ? `شهر ${MONTH_NAMES[selectedMonth!]} — ${selectedYear}`
              : `سنة ${selectedYear} كاملة`}
          </span>
        </div>

        {/* ===== كروت الإحصائيات السريعة ===== */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="relative overflow-hidden rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">إجمالي الطلبات</p>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-3xl font-black text-slate-800">{totalOrders.toLocaleString()}</span>
              <span className="text-sm font-medium text-slate-500">طلب</span>
            </div>
            <div className="absolute -left-4 -bottom-4 text-violet-100 pointer-events-none">
              <svg className="w-20 h-20" fill="currentColor" viewBox="0 0 24 24">
                <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z"/>
              </svg>
            </div>
          </div>

          <div className="relative overflow-hidden rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">عدد الزبائن</p>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-3xl font-black text-violet-700">{uniqueCustomers.toLocaleString()}</span>
              <span className="text-sm font-medium text-slate-500">زبون</span>
            </div>
            <p className="mt-2 text-xs text-slate-400">متوسط {avgOrdersPerCustomer} طلب / زبون</p>
            <div className="absolute -left-4 -bottom-4 text-violet-100 pointer-events-none">
              <svg className="w-20 h-20" fill="currentColor" viewBox="0 0 24 24">
                <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/>
              </svg>
            </div>
          </div>

          <div className="relative overflow-hidden rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">الزبائن المتكررون</p>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-3xl font-black text-emerald-700">{repeatCustomers.toLocaleString()}</span>
              <span className="text-sm font-medium text-slate-500">زبون</span>
            </div>
            <div className="mt-2 flex items-center gap-2">
              <span className="text-xs font-bold text-emerald-600">{repeatRate}% من الزبائن</span>
              <div className="h-1.5 flex-1 rounded-full bg-slate-100">
                <div className="h-full rounded-full bg-emerald-500 transition-all duration-500" style={{ width: `${repeatRate}%` }} />
              </div>
            </div>
          </div>

          <div className="relative overflow-hidden rounded-3xl border border-amber-200 bg-amber-50/40 p-6 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-wider text-amber-600">الزبون الأكثر طلباً</p>
            {topCustomer ? (
              <>
                <div className="mt-3">
                  <p className="text-base font-black text-slate-800 truncate">{topCustomer.customerName}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{topCustomer.customerPhone}</p>
                </div>
                <div className="mt-2 flex items-baseline gap-1">
                  <span className="text-2xl font-black text-amber-600">{topCustomer.totalOrders}</span>
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
          <div className="p-5 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-slate-800">قائمة الزبائن مرتبة حسب عدد الطلبات</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                إجمالي {uniqueCustomers} زبون • {totalOrders} طلب • اضغط على أي زبون لعرض طلباته
              </p>
            </div>
            <input
              type="text"
              placeholder="بحث باسم أو هاتف الزبون..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-800 outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100 w-full sm:w-64"
              dir="rtl"
            />
          </div>

          {filteredCustomers.length === 0 ? (
            <div className="py-20 text-center">
              <p className="text-slate-400 text-sm">
                {searchQuery ? "لا توجد نتائج للبحث" : "لا توجد بيانات للفترة المختارة"}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {filteredCustomers.map((customer, index) => {
                const customerKey = customer.customerId ?? `phone:${customer.customerPhone}`;
                const deliveryRate =
                  customer.totalOrders > 0
                    ? Math.round((customer.deliveredOrders / customer.totalOrders) * 100)
                    : 0;

                let rankColor = "text-slate-400";
                let rankBg = "bg-slate-100";
                if (index === 0) { rankColor = "text-amber-700"; rankBg = "bg-amber-100"; }
                else if (index === 1) { rankColor = "text-slate-600"; rankBg = "bg-slate-200"; }
                else if (index === 2) { rankColor = "text-orange-700"; rankBg = "bg-orange-100"; }

                const maxMonthlyOrders = Math.max(...customer.monthlyOrders, 1);

                return (
                  <div key={customerKey}>
                    {/* صف الزبون — قابل للضغط لفتح المودال */}
                    <button
                      onClick={() => setModalCustomer(customer)}
                      className="w-full text-right p-4 hover:bg-violet-50/50 transition-colors group"
                    >
                      <div className="flex items-center gap-3">
                        {/* رقم الترتيب */}
                        <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-xs font-black ${rankBg} ${rankColor}`}>
                          {index + 1}
                        </div>

                        {/* معلومات الزبون */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-baseline gap-2 flex-wrap">
                            <span className="font-bold text-slate-800 group-hover:text-violet-700 transition truncate">
                              {customer.customerName}
                            </span>
                            <span className="text-xs text-slate-400">{customer.customerPhone}</span>
                          </div>
                          <div className="mt-1.5 flex items-center gap-2">
                            <div className="flex-1 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                              <div
                                className="h-full rounded-full bg-violet-500 transition-all"
                                style={{
                                  width: `${Math.min(
                                    (customer.totalOrders / (customerStats[0]?.totalOrders || 1)) * 100,
                                    100
                                  )}%`,
                                }}
                              />
                            </div>
                            <span className="text-xs text-slate-400 whitespace-nowrap">{deliveryRate}% مكتمل</span>
                          </div>
                        </div>

                        {/* إحصائيات + أيقونة فتح */}
                        <div className="flex-shrink-0 flex items-center gap-3">
                          <div className="text-center">
                            <p className="text-lg font-black text-violet-700">{customer.totalOrders}</p>
                            <p className="text-xs text-slate-400">طلب</p>
                          </div>
                          <div className="hidden sm:block text-center">
                            <p className="text-sm font-bold text-emerald-600">{customer.deliveredOrders}</p>
                            <p className="text-xs text-slate-400">مُكتمل</p>
                          </div>
                          <div className="hidden sm:block text-center">
                            <p className="text-sm font-bold text-rose-500">{customer.canceledOrders}</p>
                            <p className="text-xs text-slate-400">ملغي</p>
                          </div>
                          {/* أيقونة "عرض التفاصيل" */}
                          <div className="w-8 h-8 rounded-xl bg-violet-100 group-hover:bg-violet-200 flex items-center justify-center transition flex-shrink-0">
                            <svg className="w-4 h-4 text-violet-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                          </div>
                        </div>
                      </div>
                    </button>
                  </div>
                );
              })}
            </div>
          )}

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
    </>
  );
}
