import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { ad } from "@/lib/admin-ui";
import { CustomerReportsClient } from "./customer-reports-client";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "تقارير الزبائن — أبو الأكبر للتوصيل",
};

const SECRET_ADMIN_PATH = "/abo1stor3hlaa2kbr8-47";

type Props = {
  searchParams: Promise<{ year?: string; month?: string }>;
};

export default async function CustomerReportsPage({ searchParams }: Props) {
  const sp = await searchParams;
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth(); // 0-11

  // معالجة السنة
  let selectedYear = currentYear;
  const yearVal = Array.isArray(sp.year) ? sp.year[0] : sp.year;
  if (yearVal && /^\d{4}$/.test(yearVal.trim())) {
    selectedYear = parseInt(yearVal.trim(), 10);
  }

  // معالجة الشهر (null = سنوي)
  let selectedMonth: number | null = null;
  const monthVal = Array.isArray(sp.month) ? sp.month[0] : sp.month;
  if (monthVal !== undefined && monthVal !== null && monthVal !== "") {
    const parsed = parseInt(monthVal, 10);
    if (!isNaN(parsed) && parsed >= 0 && parsed <= 11) {
      selectedMonth = parsed;
    }
  }

  // التوقيت العراقي UTC+3
  let startDate: Date;
  let endDate: Date;

  if (selectedMonth !== null) {
    // تقرير شهري
    // بداية الشهر بالتوقيت العراقي = بداية الشهر الميلادي - 3 ساعات
    startDate = new Date(Date.UTC(selectedYear, selectedMonth, 1, 0, 0, 0, 0));
    startDate = new Date(startDate.getTime() - 3 * 60 * 60 * 1000);
    // نهاية الشهر بالتوقيت العراقي
    endDate = new Date(Date.UTC(selectedYear, selectedMonth + 1, 0, 23, 59, 59, 999));
    endDate = new Date(endDate.getTime() - 3 * 60 * 60 * 1000);
  } else {
    // تقرير سنوي
    startDate = new Date(Date.UTC(selectedYear - 1, 11, 31, 21, 0, 0, 0));
    endDate = new Date(Date.UTC(selectedYear, 11, 31, 20, 59, 59, 999));
  }

  // جلب الطلبات مع بيانات الزبون
  const orders = await prisma.order.findMany({
    where: {
      createdAt: {
        gte: startDate,
        lte: endDate,
      },
    },
    select: {
      id: true,
      customerId: true,
      customerPhone: true,
      status: true,
      createdAt: true,
      totalAmount: true,
      customer: {
        select: {
          id: true,
          name: true,
          phone: true,
        },
      },
      shop: {
        select: {
          phone: true,
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  // تجميع بيانات الزبائن
  type CustomerStat = {
    customerId: string | null;
    customerPhone: string;
    customerName: string;
    totalOrders: number;
    deliveredOrders: number;
    canceledOrders: number;
    pendingOrders: number;
    monthlyOrders: number[]; // 12 شهراً
    firstOrderDate: Date;
    lastOrderDate: Date;
  };

  const customerMap = new Map<string, CustomerStat>();

  for (const order of orders) {
    // إذا كان رقم هاتف الزبون مساوياً لرقم هاتف المحل نفسه، نتخطى الطلب لأنه بون أو دين للعميل من محله وليس زبون خارجي
    const cleanPhone = (p: string) => p.replace(/[\s\-\+\(\)]/g, "");
    if (order.customerPhone && order.shop?.phone && cleanPhone(order.customerPhone) === cleanPhone(order.shop.phone)) {
      continue;
    }

    // مفتاح الزبون: إما الـ customerId أو رقم الهاتف
    const key = order.customerId ?? `phone:${order.customerPhone}`;
    const iraqTime = new Date(order.createdAt.getTime() + 3 * 60 * 60 * 1000);
    const orderMonth = iraqTime.getUTCMonth();

    if (!customerMap.has(key)) {
      customerMap.set(key, {
        customerId: order.customerId,
        customerPhone: order.customerPhone,
        customerName: order.customer?.name || order.customerPhone || "زبون غير معروف",
        totalOrders: 0,
        deliveredOrders: 0,
        canceledOrders: 0,
        pendingOrders: 0,
        monthlyOrders: Array(12).fill(0),
        firstOrderDate: order.createdAt,
        lastOrderDate: order.createdAt,
      });
    }

    const stat = customerMap.get(key)!;
    stat.totalOrders += 1;

    if (order.status === "delivered" || order.status === "completed" || order.status === "archived") {
      stat.deliveredOrders += 1;
    } else if (order.status === "canceled" || order.status === "rejected") {
      stat.canceledOrders += 1;
    } else {
      stat.pendingOrders += 1;
    }

    if (orderMonth >= 0 && orderMonth < 12) {
      stat.monthlyOrders[orderMonth] += 1;
    }

    if (order.createdAt < stat.firstOrderDate) stat.firstOrderDate = order.createdAt;
    if (order.createdAt > stat.lastOrderDate) stat.lastOrderDate = order.createdAt;
  }

  // تحويل الخريطة إلى مصفوفة وتصفيتها لتبقي فقط من لديهم طلبات مكتملة أو مؤرشفة، ومرتبة حسب عدد الطلبات
  const customerStats = Array.from(customerMap.values())
    .filter((s) => s.deliveredOrders > 0)
    .sort((a, b) => b.totalOrders - a.totalOrders)
    .map((s) => ({
      ...s,
      firstOrderDate: s.firstOrderDate.toISOString(),
      lastOrderDate: s.lastOrderDate.toISOString(),
    }));

  // إحصائيات عامة
  const totalOrders = orders.length;
  const uniqueCustomers = customerStats.length;
  const repeatCustomers = customerStats.filter((c) => c.totalOrders > 1).length;

  // السنوات المتاحة
  const availableYears = Array.from({ length: 4 }, (_, i) => currentYear - 2 + i);

  return (
    <div className="space-y-6" dir="rtl">
      <p className={ad.muted}>
        <Link href={`${SECRET_ADMIN_PATH}/reports`} className={ad.link}>
          ← التقارير
        </Link>
        <span className="text-slate-400"> | </span>
        <Link href={SECRET_ADMIN_PATH} className={ad.link}>
          الرئيسية
        </Link>
      </p>

      <div>
        <h1 className={ad.h1}>تقارير الزبائن</h1>
        <p className={`mt-3 ${ad.lead}`}>
          إحصائيات تفصيلية لطلبات الزبائن السنوية والشهرية، مرتبة حسب الأكثر طلباً.
        </p>
      </div>

      <CustomerReportsClient
        selectedYear={selectedYear}
        selectedMonth={selectedMonth}
        currentMonth={currentMonth}
        availableYears={availableYears}
        customerStats={customerStats}
        totalOrders={totalOrders}
        uniqueCustomers={uniqueCustomers}
        repeatCustomers={repeatCustomers}
        secretAdminPath={SECRET_ADMIN_PATH}
      />
    </div>
  );
}
