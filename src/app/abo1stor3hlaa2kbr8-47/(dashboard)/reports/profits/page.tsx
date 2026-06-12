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

// كلمات الاستبعاد للتجهيز
const STRICT_EXCLUDE = ["همبركر", "بركر", "كبة", "كبه", "نعناع", "كرفس", "فجل"];

const checkIsTypeFlexible = (line: string, whitelist: string[]) => {
  const clean = line.toLowerCase()
    .replace(/[0-9٠-٩]/g, '')
    .replace(/\b(كيلو|كغم|ك|غم|غرام|نص|نصف|ربع|عدد)\b/g, '')
    .trim();
  const startOfLine = clean.slice(0, 15);
  return whitelist.some(item => startOfLine.includes(item.toLowerCase()));
};

export default async function ReportsProfitsPage() {
  // 1. جلب إعدادات تسعير التجهيز لفلترة اللحوم والأسماك
  const pricingSetting = await prisma.uISystemSetting.findUnique({
    where: { target_section: { target: "system", section: "pricing_config" } }
  });
  const pricingConfig = (pricingSetting?.config as any) || {};
  const meatWhitelist = pricingConfig.meat_keywords || ["شرح", "مثروم", "ضلوع", "عظم", "عضم", "فكارة", "فكاره", "عصفورة", "عصفوره", "شحم", "باجة", "باجه", "كراعين"];
  const fishWhitelist = pricingConfig.fish_keywords || [
    "سمك", "ابياح", "برطام", "بنت السلطان", "بني", "بياح", "جش", "حيسون", "حمار", "حمر", "حمرة", "حمره",
    "خشرة", "خشره", "دوكان", "روبيان", "ربيان", "سمتي", "سمكة", "سلمون", "سلمونة", "سلمونه", "سلمنتين",
    "شانگ", "شانك", "شعري", "شلك", "صافي", "ضلعة", "ضلعه", "ظلعة", "ظلعه", "عندك", "عندگ", "عروسة",
    "عروسه", "غريبة", "غريبه", "كطان", "مزلك", "مزلگ", "ملزك", "نگرور", "نكرور", "وحر", "هامور"
  ];

  // 2. جلب جميع الطلبات التي تحتوي على أرباح (التوصيل المسلم أو التجهيز)
  const orders = await prisma.order.findMany({
    where: {
      OR: [
        { status: "delivered" },
        {
          preparerShoppingJson: { not: null as any },
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

  // 3. هيكل لتجميع البيانات
  // سنقوم بتخزين البيانات في شكل خريطة متداخلة: year -> month -> day
  const yearsMap = new Map<number, Map<number, Map<number, { delivery: number; prep: number; meat: number; fish: number; other: number }>>>();

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
        courierEarning = computeCourierDeliveryEarningDinar(vehicleType as any, (order.deliveryPrice ?? null) as any) as any;
      }
      if (courierEarning != null) {
        deliveryProfit = order.deliveryPrice.minus(courierEarning).toNumber();
      }
    }

    // حساب أرباح التجهيز للمحلات التابعة للإدارة
    let prepProfit = 0;
    let meatProfit = 0;
    let fishProfit = 0;
    let otherProfit = 0;

    if (
      order.preparerShoppingJson != null &&
      order.status !== "cancelled" &&
      order.status !== "rejected" &&
      order.shop?.name &&
      ADMIN_SHOP_NAMES.includes(order.shop.name)
    ) {
      const json = order.preparerShoppingJson as any;
      const products = Array.isArray(json?.products) ? json.products : [];
      
      // التجهيز الكلي
      const totalProfitAlf = products.reduce((sum: number, p: any) => sum + (Number(p.sellAlf) - Number(p.buyAlf) || 0), 0);
      prepProfit = totalProfitAlf * ALF_PER_DINAR;

      // اللحوم
      const meatProfitAlf = products.reduce((sum: number, p: any) => {
        const line = p.line || "";
        const isMeat = checkIsTypeFlexible(line, meatWhitelist) && !STRICT_EXCLUDE.some(ex => line.toLowerCase().includes(ex));
        return isMeat ? sum + (Number(p.sellAlf) - Number(p.buyAlf) || 0) : sum;
      }, 0);
      meatProfit = meatProfitAlf * ALF_PER_DINAR;

      // الأسماك
      const fishProfitAlf = products.reduce((sum: number, p: any) => {
        const line = p.line || "";
        const isFish = checkIsTypeFlexible(line, fishWhitelist) && !STRICT_EXCLUDE.some(ex => line.toLowerCase().includes(ex));
        return isFish ? sum + (Number(p.sellAlf) - Number(p.buyAlf) || 0) : sum;
      }, 0);
      fishProfit = fishProfitAlf * ALF_PER_DINAR;

      // المنتجات الأخرى
      otherProfit = prepProfit - meatProfit - fishProfit;
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
      daysMap.set(day, { delivery: 0, prep: 0, meat: 0, fish: 0, other: 0 });
    }
    const dayStat = daysMap.get(day)!;
    dayStat.delivery += deliveryProfit;
    dayStat.prep += prepProfit;
    dayStat.meat += meatProfit;
    dayStat.fish += fishProfit;
    dayStat.other += otherProfit;
  }

  // 4. تحويل الخريطة إلى مصفوفة مرتبة ومكتملة
  const stats: any[] = [];
  const sortedYears = Array.from(yearsMap.keys()).sort((a, b) => a - b);

  for (const year of sortedYears) {
    const monthsMap = yearsMap.get(year)!;
    const monthsList: any[] = [];

    // نضمن دائماً تجميع 12 شهراً بشكل كامل
    for (let month = 1; month <= 12; month++) {
      const daysMap = monthsMap.get(month) || new Map<number, { delivery: number; prep: number; meat: number; fish: number; other: number }>();
      const daysList: any[] = [];

      // نحدد عدد أيام الشهر ديناميكياً
      const numDays = new Date(year, month, 0).getDate();
      for (let day = 1; day <= numDays; day++) {
        const dayStat = daysMap.get(day) || { delivery: 0, prep: 0, meat: 0, fish: 0, other: 0 };
        daysList.push({
          day,
          totalProfit: dayStat.delivery + dayStat.prep,
          deliveryProfit: dayStat.delivery,
          prepProfit: dayStat.prep,
          meatProfit: dayStat.meat,
          fishProfit: dayStat.fish,
          otherProfit: dayStat.other
        });
      }

      const totalDelivery = daysList.reduce((sum, d) => sum + d.deliveryProfit, 0);
      const totalPrep = daysList.reduce((sum, d) => sum + d.prepProfit, 0);
      const totalMeat = daysList.reduce((sum, d) => sum + d.meatProfit, 0);
      const totalFish = daysList.reduce((sum, d) => sum + d.fishProfit, 0);
      const totalOther = daysList.reduce((sum, d) => sum + d.otherProfit, 0);

      monthsList.push({
        month,
        totalProfit: totalDelivery + totalPrep,
        deliveryProfit: totalDelivery,
        prepProfit: totalPrep,
        meatProfit: totalMeat,
        fishProfit: totalFish,
        otherProfit: totalOther,
        days: daysList
      });
    }

    const totalDelivery = monthsList.reduce((sum, m) => sum + m.deliveryProfit, 0);
    const totalPrep = monthsList.reduce((sum, m) => sum + m.prepProfit, 0);
    const totalMeat = monthsList.reduce((sum, m) => sum + m.meatProfit, 0);
    const totalFish = monthsList.reduce((sum, m) => sum + m.fishProfit, 0);
    const totalOther = monthsList.reduce((sum, m) => sum + m.otherProfit, 0);

    stats.push({
      year,
      totalProfit: totalDelivery + totalPrep,
      deliveryProfit: totalDelivery,
      prepProfit: totalPrep,
      meatProfit: totalMeat,
      fishProfit: totalFish,
      otherProfit: totalOther,
      months: monthsList
    });
  }

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
        <h1 className={ad.h1}>رسوم تحليلات أرباح الشركة 📈</h1>
      </div>

      <ProfitsAnalyticsClient stats={stats} secretAdminPath={SECRET_ADMIN_PATH} />
    </div>
  );
}
