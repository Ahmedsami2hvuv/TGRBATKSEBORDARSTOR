import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { ad } from "@/lib/admin-ui";
import { Decimal } from "@prisma/client/runtime/library";
import { computeCourierDeliveryEarningDinar } from "@/lib/courier-earnings";
import { ADMIN_SHOP_NAMES } from "@/lib/admin-order-from-admin-constants";
import { ProfitsAnalyticsClient } from "./profits-analytics-client";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "تحليلات الأرباح السنوية والشهرية — أبو الأكبر للتوصيل",
};

const SECRET_ADMIN_PATH = "/abo1stor3hlaa2kbr8-47";
const ALF_PER_DINAR = 1;

export default async function ReportsProfitsPage() {
  // 1. جلب جميع الطلبات التي تحتوي على أرباح (التوصيل المسلم أو التجهيز)
  const orders = await prisma.order.findMany({
    where: {
      OR: [
        { status: "delivered" },
        {
          preparerShoppingJson: { not: null },
          status: { notIn: ["cancelled", "rejected"] },
          shop: { name: { in: ADMIN_SHOP_NAMES } }
        }
      ]
    },
    select: {
      createdAt: true,
      status: true,
      deliveryPrice: true,
      courierEarningDinar: true,
      courier: { select: { zeroEarning: true, vehicleType: true } },
      preparerShoppingJson: true,
      shop: { select: { name: true } }
    },
    orderBy: { createdAt: "asc" }
  });

  // 2. هيكل لتجميع البيانات
  // سنقوم بتخزين البيانات في شكل خريطة متداخلة: year -> month -> day
  const yearsMap = new Map<number, Map<number, Map<number, { delivery: number; prep: number }>>>();

  for (const order of orders) {
    // إزاحة التاريخ بمقدار 3 ساعات إلى الخلف (توقيت نوبات العمل العراقية تبدأ 6:00 صباحاً)
    // UTC+3 -> shift date by subtract 3 hours to get correct calendar day
    const shiftDate = new Date(order.createdAt.getTime() - 3 * 60 * 60 * 1000);
    const year = shiftDate.getUTCFullYear();
    const month = shiftDate.getUTCMonth() + 1; // 1 to 12
    const day = shiftDate.getUTCDate(); // 1 to 31

    // حساب أرباح التوصيل
    let deliveryProfit = 0;
    if (order.status === "delivered" && order.deliveryPrice != null) {
      let courierEarning = order.courierEarningDinar;
      const isZeroEarning = order.courier?.zeroEarning || false;

      if (isZeroEarning) {
        courierEarning = new Decimal(0);
      } else if (courierEarning == null) {
        const vehicleType = order.courier?.vehicleType || null;
        courierEarning = computeCourierDeliveryEarningDinar(vehicleType, order.deliveryPrice ?? null) as any;
      }
      if (courierEarning != null) {
        deliveryProfit = order.deliveryPrice.minus(courierEarning).toNumber();
      }
    }

    // حساب أرباح التجهيز للمحلات التابعة للإدارة
    let prepProfit = 0;
    if (
      order.preparerShoppingJson != null &&
      order.status !== "cancelled" &&
      order.status !== "rejected" &&
      order.shop?.name &&
      ADMIN_SHOP_NAMES.includes(order.shop.name)
    ) {
      const json = order.preparerShoppingJson as any;
      const products = Array.isArray(json?.products) ? json.products : [];
      const totalProfitAlf = products.reduce((sum: number, p: any) => sum + (Number(p.sellAlf) - Number(p.buyAlf) || 0), 0);
      prepProfit = totalProfitAlf * ALF_PER_DINAR;
    }

    if (deliveryProfit === 0 && prepProfit === 0) continue;

    // الحصول على خريطة السنة
    if (!yearsMap.has(year)) {
      yearsMap.set(year, new Map());
    }
    const monthsMap = yearsMap.get(year)!;

    // الحصول على خريطة الشهر
    if (!monthsMap.has(month)) {
      monthsMap.set(month, new Map());
    }
    const daysMap = monthsMap.get(month)!;

    // الحصول على اليوم
    if (!daysMap.has(day)) {
      daysMap.set(day, { delivery: 0, prep: 0 });
    }
    const dayStat = daysMap.get(day)!;
    dayStat.delivery += deliveryProfit;
    dayStat.prep += prepProfit;
  }

  // 3. تحويل الخريطة إلى مصفوفة مرتبة ومكتملة
  const stats: any[] = [];
  const sortedYears = Array.from(yearsMap.keys()).sort((a, b) => a - b);

  for (const year of sortedYears) {
    const monthsMap = yearsMap.get(year)!;
    const monthsList: any[] = [];

    // نضمن دائماً تجميع 12 شهراً بشكل كامل
    for (let month = 1; month <= 12; month++) {
      const daysMap = monthsMap.get(month) || new Map<number, { delivery: number; prep: number }>();
      const daysList: any[] = [];

      // نحدد عدد أيام الشهر ديناميكياً
      const numDays = new Date(year, month, 0).getDate();
      for (let day = 1; day <= numDays; day++) {
        const dayStat = daysMap.get(day) || { delivery: 0, prep: 0 };
        daysList.push({
          day,
          totalProfit: dayStat.delivery + dayStat.prep,
          deliveryProfit: dayStat.delivery,
          prepProfit: dayStat.prep
        });
      }

      const totalDelivery = daysList.reduce((sum, d) => sum + d.deliveryProfit, 0);
      const totalPrep = daysList.reduce((sum, d) => sum + d.prepProfit, 0);

      monthsList.push({
        month,
        totalProfit: totalDelivery + totalPrep,
        deliveryProfit: totalDelivery,
        prepProfit: totalPrep,
        days: daysList
      });
    }

    const totalDelivery = monthsList.reduce((sum, m) => sum + m.deliveryProfit, 0);
    const totalPrep = monthsList.reduce((sum, m) => sum + m.prepProfit, 0);

    stats.push({
      year,
      totalProfit: totalDelivery + totalPrep,
      deliveryProfit: totalDelivery,
      prepProfit: totalPrep,
      months: monthsList
    });
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-300" dir="rtl">
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
        <h1 className={ad.h1}>رسوم تحليلات أرباح الشركة 📈</h1>
      </div>

      <ProfitsAnalyticsClient stats={stats} secretAdminPath={SECRET_ADMIN_PATH} />
    </div>
  );
}
