import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { ad } from "@/lib/admin-ui";
import { GeneralReportsClient } from "./general-reports-client";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "التقارير العامة والإحصائيات — أبو الأكبر للتوصيل",
};

const SECRET_ADMIN_PATH = "/abo1stor3hlaa2kbr8-47";

type Props = {
  searchParams: Promise<{ year?: string | string[] }>;
};

export default async function GeneralReportsPage({ searchParams }: Props) {
  const sp = await searchParams;
  const currentYear = new Date().getFullYear();
  let selectedYear = currentYear;

  const yearVal = Array.isArray(sp.year) ? sp.year[0] : sp.year;
  if (yearVal && /^\d{4}$/.test(yearVal.trim())) {
    selectedYear = parseInt(yearVal.trim(), 10);
  }

  // تحديد بداية ونهاية السنة بالتوقيت العالمي لتغطية كامل السنة بالتوقيت العراقي
  // التوقيت العراقي يسبق التوقيت العالمي بـ 3 ساعات (UTC+3)
  // لذلك تبدأ السنة العراقية في 31 ديسمبر الساعة 21:00 بالتوقيت العالمي من السنة السابقة
  const startOfYear = new Date(Date.UTC(selectedYear - 1, 11, 31, 21, 0, 0, 0));
  const endOfYear = new Date(Date.UTC(selectedYear, 11, 31, 20, 59, 59, 999));

  // جلب الطلبات لهذه السنة بكفاءة عالية (جلب الحقول اللازمة فقط)
  const orders = await prisma.order.findMany({
    where: {
      createdAt: {
        gte: startOfYear,
        lte: endOfYear,
      },
    },
    select: {
      createdAt: true,
      status: true,
    },
  });

  // مصفوفات وسجلات لحفظ الإحصائيات المجمعة
  // 1. البيانات الشهرية (12 شهراً)
  const monthlyStats = Array.from({ length: 12 }, (_, i) => ({
    monthIndex: i, // 0 to 11
    totalOrders: 0,
    deliveredOrders: 0,
    canceledOrders: 0,
  }));

  // 2. البيانات اليومية لكل شهر (مفتاحها رقم الشهر من 0 إلى 11)
  const dailyStatsByMonth: { [key: number]: { [day: number]: number } } = {};
  for (let i = 0; i < 12; i++) {
    dailyStatsByMonth[i] = {};
  }

  // 3. البيانات الساعية (24 ساعة)
  const hourlyStats = Array.from({ length: 24 }, (_, i) => ({
    hour: i,
    count: 0,
  }));

  // 4. إحصائيات أيام الأسبوع (من الأحد 0 إلى السبت 6)
  // سنقوم بترتيبها لاحقاً لتبدأ من السبت
  const weekdayStats = Array.from({ length: 7 }, (_, i) => ({
    dayIndex: i,
    count: 0,
  }));

  // دالة لتحويل وقت الطلب إلى التوقيت المحلي العراقي (UTC+3) لمعالجة صحيحة للتواريخ والساعات
  const getIraqDateTime = (date: Date) => {
    return new Date(date.getTime() + 3 * 60 * 60 * 1000);
  };

  // معالجة وتجميع البيانات
  for (const order of orders) {
    const iraqTime = getIraqDateTime(order.createdAt);
    
    // للحصول على القيم بناءً على التوقيت المعدل
    const month = iraqTime.getUTCMonth(); // 0 - 11
    const day = iraqTime.getUTCDate(); // 1 - 31
    const hour = iraqTime.getUTCHours(); // 0 - 23
    const weekday = iraqTime.getUTCDay(); // 0 (Sunday) - 6 (Saturday)

    // تجميع شهري
    if (month >= 0 && month < 12) {
      monthlyStats[month].totalOrders += 1;
      if (order.status === "delivered" || order.status === "completed") {
        monthlyStats[month].deliveredOrders += 1;
      } else if (order.status === "canceled" || order.status === "rejected") {
        monthlyStats[month].canceledOrders += 1;
      }

      // تجميع يومي داخل الشهر
      dailyStatsByMonth[month][day] = (dailyStatsByMonth[month][day] || 0) + 1;
    }

    // تجميع ساعي
    if (hour >= 0 && hour < 24) {
      hourlyStats[hour].count += 1;
    }

    // تجميع أيام الأسبوع
    if (weekday >= 0 && weekday < 7) {
      weekdayStats[weekday].count += 1;
    }
  }

  // جلب السنوات المتوفرة في النظام لتمكين التنقل بينها (اختياري، سنعرض الخيارات من 2024 إلى السنة الحالية + 1)
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
        <h1 className={ad.h1}>التقارير العامة والإحصائيات</h1>
        <p className={`mt-3 ${ad.lead}`}>
          تحليلات ورسوم بيانية تفاعلية لحركة الطلبات، أوقات الذروة، وكثافة العمل اليومية والشهرية.
        </p>
      </div>

      <GeneralReportsClient
        selectedYear={selectedYear}
        availableYears={availableYears}
        monthlyStats={monthlyStats}
        dailyStatsByMonth={dailyStatsByMonth}
        hourlyStats={hourlyStats}
        weekdayStats={weekdayStats}
        secretAdminPath={SECRET_ADMIN_PATH}
      />
    </div>
  );
}
