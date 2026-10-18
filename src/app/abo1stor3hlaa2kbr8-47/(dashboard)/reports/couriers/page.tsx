import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { ad } from "@/lib/admin-ui";
import { formatYMDLocal } from "@/lib/report-dates";
import { formatDinarAsAlfWithUnit } from "@/lib/money-alf";
import { Decimal } from "@prisma/client/runtime/library";
import { MONEY_KIND_DELIVERY } from "@/lib/mandoub-money-events";
import { computeCourierDeliveryEarningDinar } from "@/lib/courier-earnings";
import { ReportTableClient } from "../preparation/report-table-client";
import { ADMIN_SHOP_NAMES } from "@/lib/admin-order-from-admin-constants";
import { DateFilterForm } from "./date-filter-form";

import { ProfitsAnalyticsClient } from "../profits/profits-analytics-client";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "تقرير الأرباح الشامل (التوصيل والتجهيز) — وصلي",
};

type Props = {
  searchParams: Promise<{ day?: string | string[]; view?: string | string[] }>;
};

type CourierProfitRow = {
  courierId: string;
  name: string;
  courierEarning: Decimal;
  companyNet: Decimal;
  ordersCount: number;
};

// كلمات الاستبعاد للتجهيز
const STRICT_EXCLUDE = ["همبركر", "بركر", "كبة", "كبه", "نعناع", "كرفس", "فجل"];
const ALF_PER_DINAR = 1;

function parseSelectedDay(day?: string | string[]): string {
  const value = Array.isArray(day) ? day[0] : day;
  if (!value) return "";
  return /^\d{4}-\d{2}-\d{2}$/.test(value.trim()) ? value.trim() : "";
}

function ensureCourierRow(courierId: string, courierName: string): CourierProfitRow {
  return {
    courierId,
    name: courierName || "مندوب",
    courierEarning: new Decimal(0),
    companyNet: new Decimal(0),
    ordersCount: 0,
  };
}

const checkIsTypeFlexible = (line: string, whitelist: string[]) => {
  const clean = line.toLowerCase()
    .replace(/[0-9٠-٩]/g, '')
    .replace(/\b(كيلو|كغم|ك|غم|غرام|نص|نصف|ربع|عدد)\b/g, '')
    .trim();
  const startOfLine = clean.slice(0, 15);
  return whitelist.some(item => startOfLine.includes(item.toLowerCase()));
};

const SECRET_ADMIN_PATH = "/abo1stor3hlaa2kbr8-47";

export default async function CombinedReportPage({ searchParams }: Props) {
  try {
    const sp = await searchParams;
    const viewVal = Array.isArray(sp.view) ? sp.view[0] : sp.view;
    const view = viewVal || "table";

    // جلب إعدادات التسعير والأنواع للتجهيز
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

    if (view === "chart") {
      const allOrders = await prisma.order.findMany({
        where: {
          OR: [
            { status: { in: ["delivered", "archived"] } },
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
          courierEarningForCourier: { select: { vehicleType: true } },
          preparerShoppingJson: true,
          shop: { select: { name: true } }
        },
        orderBy: { createdAt: "asc" }
      });

      const yearsMap = new Map<number, Map<number, Map<number, { delivery: number; prep: number; meat: number; fish: number; other: number }>>>();

      for (const order of allOrders) {
        const shiftDate = new Date(order.createdAt.getTime() - 3 * 60 * 60 * 1000);
        const y = shiftDate.getUTCFullYear();
        const m = shiftDate.getUTCMonth() + 1;
        const d = shiftDate.getUTCDate();

        let deliveryProfit = 0;
        if ((order.status === "delivered" || order.status === "archived") && order.deliveryPrice != null) {
          let courierEarning = order.courierEarningDinar;

          // صافي التوصيل للشركة يجب أن يكون متبقي التوصيل وليس التوصيل كله
          if (courierEarning == null || courierEarning.lte(0)) {
            const vehicleType = order.courierEarningForCourier?.vehicleType || order.courier?.vehicleType || "car";
            courierEarning = computeCourierDeliveryEarningDinar(vehicleType as any, (order.deliveryPrice ?? null) as any) as any;
          }
          if (courierEarning != null) {
            deliveryProfit = order.deliveryPrice.minus(courierEarning).toNumber();
          }
        }

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
          const totalProfitAlf = products.reduce((sum: number, p: any) => sum + (Number(p.sellAlf) - Number(p.buyAlf) || 0), 0);
          prepProfit = totalProfitAlf * ALF_PER_DINAR;

          const meatProfitAlf = products.reduce((sum: number, p: any) => {
            const line = p.line || "";
            const isMeat = checkIsTypeFlexible(line, meatWhitelist) && !STRICT_EXCLUDE.some(ex => line.toLowerCase().includes(ex));
            return isMeat ? sum + (Number(p.sellAlf) - Number(p.buyAlf) || 0) : sum;
          }, 0);
          meatProfit = meatProfitAlf * ALF_PER_DINAR;

          const fishProfitAlf = products.reduce((sum: number, p: any) => {
            const line = p.line || "";
            const isFish = checkIsTypeFlexible(line, fishWhitelist) && !STRICT_EXCLUDE.some(ex => line.toLowerCase().includes(ex));
            return isFish ? sum + (Number(p.sellAlf) - Number(p.buyAlf) || 0) : sum;
          }, 0);
          fishProfit = fishProfitAlf * ALF_PER_DINAR;

          otherProfit = prepProfit - meatProfit - fishProfit;
        }

        if (deliveryProfit === 0 && prepProfit === 0) continue;

        if (!yearsMap.has(y)) yearsMap.set(y, new Map());
        const monthsMap = yearsMap.get(y)!;

        if (!monthsMap.has(m)) monthsMap.set(m, new Map());
        const daysMap = monthsMap.get(m)!;

        if (!daysMap.has(d)) daysMap.set(d, { delivery: 0, prep: 0, meat: 0, fish: 0, other: 0 });
        const dayStat = daysMap.get(d)!;
        dayStat.delivery += deliveryProfit;
        dayStat.prep += prepProfit;
        dayStat.meat += meatProfit;
        dayStat.fish += fishProfit;
        dayStat.other += otherProfit;
      }

      const stats: any[] = [];
      const sortedYears = Array.from(yearsMap.keys()).sort((a, b) => a - b);

      for (const y of sortedYears) {
        const monthsMap = yearsMap.get(y)!;
        const monthsList: any[] = [];

        for (let m = 1; m <= 12; m++) {
          const daysMap = monthsMap.get(m) || new Map<number, { delivery: number; prep: number; meat: number; fish: number; other: number }>();
          const daysList: any[] = [];

          const numDays = new Date(y, m, 0).getDate();
          for (let d = 1; d <= numDays; d++) {
            const dayStat = daysMap.get(d) || { delivery: 0, prep: 0, meat: 0, fish: 0, other: 0 };
            daysList.push({
              day: d,
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
            month: m,
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
          year: y,
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
        <div className="space-y-6 animate-in fade-in duration-300" dir="rtl">
          <p className={ad.muted}>
            <Link href={`${SECRET_ADMIN_PATH}/reports`} className={ad.link}>
              ← التقارير
            </Link>
          </p>

          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className={`${ad.h1} flex items-center gap-2`}>
                <span>📊</span> تقرير الأرباح الشامل والتجهيز
              </h1>
              <p className={`mt-2 ${ad.lead}`}>
                الرسوم البيانية لتحليلات الأرباح السنوية والشهرية واليومية
              </p>
            </div>
          </div>

          {/* شريط تبويب تبديل طرق العرض */}
          <div className="flex gap-2 border-b border-slate-200 pb-3">
            <Link
              href={{ pathname: `${SECRET_ADMIN_PATH}/reports/couriers`, query: { ...sp, view: "table" } }}
              className="px-4 py-2.5 rounded-2xl text-xs font-black transition-all bg-white text-slate-600 hover:bg-slate-50 border border-slate-200"
            >
              📋 التفاصيل وجدول الأرباح اليومية
            </Link>
            <Link
              href={{ pathname: `${SECRET_ADMIN_PATH}/reports/couriers`, query: { ...sp, view: "chart" } }}
              className="px-4 py-2.5 rounded-2xl text-xs font-black transition-all bg-slate-900 text-white shadow-md scale-105"
            >
              📈 الرسم البياني (سنوي / شهري / يومي)
            </Link>
          </div>

          <ProfitsAnalyticsClient stats={stats} secretAdminPath={SECRET_ADMIN_PATH} />
        </div>
      );
    }


    const today = new Date();
    // نحدد اليوم الافتراضي بناءً على نوبة العمل (تبدأ 6:00 صباحاً بتوقيت بغداد)
    const ymdToday = formatYMDLocal(today);
    let shiftStartToday = new Date(`${ymdToday}T06:00:00+03:00`);
    if (today < shiftStartToday) {
      shiftStartToday = new Date(shiftStartToday.getTime() - 24 * 60 * 60 * 1000);
    }
    const defaultDay = formatYMDLocal(shiftStartToday);
    const selectedDayIso = parseSelectedDay(sp.day) || defaultDay;

    const from = new Date(`${selectedDayIso}T06:00:00+03:00`);
    const to = new Date(from.getTime() + 24 * 60 * 60 * 1000 - 1);

    const dayList = Array.from({ length: 21 }, (_, index) => {
      const d = new Date(shiftStartToday.getTime() - index * 24 * 60 * 60 * 1000);
      return formatYMDLocal(d);
    });

    const rangeFrom = new Date(from.getTime() - 20 * 24 * 60 * 60 * 1000);

    // جلب البيانات المتوازي (تم إزالة الإكراميات)
    const [ordersDelivery, ordersPrep, sidebarPrepOrders, companyPreparersList] = await Promise.all([
      // طلبات التوصيل المسلمة أو المؤرشفة الخاصة باليوم المحدد فقط
      prisma.order.findMany({
        where: {
          status: { in: ["delivered", "archived"] },
          OR: [
            {
              moneyEvents: {
                some: {
                  kind: MONEY_KIND_DELIVERY,
                  deletedAt: null,
                  createdAt: { gte: from, lte: to },
                },
              },
            },
            {
              createdAt: { gte: from, lte: to },
              moneyEvents: {
                none: {
                  kind: MONEY_KIND_DELIVERY,
                  deletedAt: null,
                },
              },
            },
          ],
        },
        select: {
          id: true,
          createdAt: true,
          assignedCourierId: true,
          courierEarningForCourierId: true,
          courierEarningForCourier: { select: { name: true, vehicleType: true } },
          courierEarningDinar: true,
          deliveryPrice: true,
          courier: { select: { name: true, vehicleType: true, zeroEarning: true } },
          moneyEvents: {
            where: {
              kind: MONEY_KIND_DELIVERY,
              deletedAt: null,
            },
            orderBy: { createdAt: "desc" },
            select: {
              createdAt: true,
              courierId: true,
              courier: { select: { name: true, vehicleType: true } },
            },
          },
        },
      }),
      // طلبات التجهيز لليوم المحدد
      prisma.order.findMany({
        where: {
          createdAt: { gte: from, lte: to },
          preparerShoppingJson: { not: null as any },
          status: { notIn: ["cancelled", "rejected"] },
          shop: { name: { in: ADMIN_SHOP_NAMES } }
        },
        orderBy: { createdAt: "desc" },
        include: { shop: { select: { name: true } }, customerRegion: { select: { name: true } } },
      }),
      // طلبات التجهيز لآخر 21 يوم للمؤشرات الجانبية
      prisma.order.findMany({
        where: {
          createdAt: { gte: rangeFrom, lte: to },
          preparerShoppingJson: { not: null as any },
          status: { notIn: ["cancelled", "rejected"] },
          shop: { name: { in: ADMIN_SHOP_NAMES } }
        },
        select: { createdAt: true, preparerShoppingJson: true }
      }),
      // جلب المجهزين لمعرفة الراتب اليومي وسجلات العمل لليوم
      prisma.companyPreparer.findMany({
        where: { active: true },
        select: {
          id: true,
          name: true,
          dailySalary: true,
          workLogs: {
            where: { createdAt: { gte: from, lte: to } },
            select: { id: true, createdAt: true }
          }
        }
      })
    ]);

    // --- معالجة وحساب بيانات التوصيل ---
    const rows = new Map<string, CourierProfitRow>();
    function getRow(courierId: string, courierName: string) {
      const existing = rows.get(courierId);
      if (existing) return existing;
      const row = ensureCourierRow(courierId, courierName);
      rows.set(courierId, row);
      return row;
    }

    for (const order of ordersDelivery) {
      // إيجاد حركة التسليم التي حدثت في هذا اليوم حصراً
      const deliveryEvInDay = order.moneyEvents.find(
        (e) => e.createdAt >= from && e.createdAt <= to
      );

      // إذا كان للطلب حركات تسليم سابقة، ولكن ولا واحدة منها حدثت في هذا اليوم: يتم استبعاده
      if (order.moneyEvents.length > 0 && !deliveryEvInDay) {
        continue;
      }

      // إذا لم يكن للطلب أي حركة تسليم، يجب أن يكون تاريخ إنشائه ضمن هذا اليوم
      if (order.moneyEvents.length === 0) {
        if (order.createdAt < from || order.createdAt > to) {
          continue;
        }
      }

      const activeDeliveryEv = deliveryEvInDay || order.moneyEvents[0];
      const earningOwner =
        activeDeliveryEv?.courierId ??
        order.courierEarningForCourierId ??
        order.assignedCourierId ??
        null;
      if (!earningOwner) continue;

      const courierName =
        activeDeliveryEv?.courier?.name ||
        order.courierEarningForCourier?.name ||
        order.courier?.name ||
        "مندوب";
      const row = getRow(earningOwner, courierName);
      row.ordersCount += 1;

      let courierEarning = order.courierEarningDinar;

      // صافي التوصيل للشركة يجب أن يكون متبقي التوصيل وليس التوصيل كله
      if (courierEarning == null || courierEarning.lte(0)) {
        const vehicleType =
          activeDeliveryEv?.courier?.vehicleType ||
          order.courierEarningForCourier?.vehicleType ||
          order.courier?.vehicleType ||
          "car";
        courierEarning = computeCourierDeliveryEarningDinar(vehicleType as any, (order.deliveryPrice ?? null) as any) as any;
      }
      if (courierEarning == null) continue;

      const companyProfit = order.deliveryPrice?.minus(courierEarning) ?? new Decimal(0);
      row.courierEarning = row.courierEarning.plus(courierEarning);
      row.companyNet = row.companyNet.plus(companyProfit);
    }

    const sortedRows = Array.from(rows.values()).sort((a, b) => {
      const cmp = b.companyNet.cmp(a.companyNet);
      return cmp !== 0 ? cmp : a.name.localeCompare(b.name, "ar");
    });

    const totalCourierEarning = Array.from(rows.values()).reduce((sum, row) => sum.plus(row.courierEarning), new Decimal(0));
    const totalCompanyNet = Array.from(rows.values()).reduce((sum, row) => sum.plus(row.companyNet), new Decimal(0));
    const totalOrders = Array.from(rows.values()).reduce((count, row) => count + row.ordersCount, 0);

    // --- معالجة وحساب بيانات التجهيز ---
    const dayIndicators: Record<string, { hasMeat: boolean; hasFish: boolean }> = {};
    sidebarPrepOrders.forEach(order => {
      const d = order.createdAt;
      const baghdadTime = new Date(d.toLocaleString("en-US", { timeZone: "Asia/Baghdad" }));
      if (baghdadTime.getHours() < 6) {
        baghdadTime.setDate(baghdadTime.getDate() - 1);
      }
      const dayKey = formatYMDLocal(baghdadTime);

      if (!dayIndicators[dayKey]) dayIndicators[dayKey] = { hasMeat: false, hasFish: false };
      if (dayIndicators[dayKey].hasMeat && dayIndicators[dayKey].hasFish) return;

      const json = order.preparerShoppingJson as any;
      const products = Array.isArray(json?.products) ? json.products : [];

      if (!dayIndicators[dayKey].hasMeat) {
        const hasMeat = products.some((p: any) => {
          const line = p.line || "";
          return checkIsTypeFlexible(line, meatWhitelist) && !STRICT_EXCLUDE.some(ex => line.toLowerCase().includes(ex));
        });
        if (hasMeat) dayIndicators[dayKey].hasMeat = true;
      }

      if (!dayIndicators[dayKey].hasFish) {
        const hasFish = products.some((p: any) => {
          const line = p.line || "";
          return checkIsTypeFlexible(line, fishWhitelist) && !STRICT_EXCLUDE.some(ex => line.toLowerCase().includes(ex));
        });
        if (hasFish) dayIndicators[dayKey].hasFish = true;
      }
    });

    const orderSummaries = ordersPrep.map((order) => {
      const json = order.preparerShoppingJson as any;
      const products = Array.isArray(json?.products) ? json.products : [];
      const totalProfit = products.reduce((sum: number, p: any) => sum + (Number(p.sellAlf) - Number(p.buyAlf) || 0), 0);

      const meatProducts = products.filter((p: any) => {
        const line = p.line || "";
        return checkIsTypeFlexible(line, meatWhitelist) && !STRICT_EXCLUDE.some(ex => line.toLowerCase().includes(ex));
      });

      const fishProducts = products.filter((p: any) => {
        const line = p.line || "";
        return checkIsTypeFlexible(line, fishWhitelist) && !STRICT_EXCLUDE.some(ex => line.toLowerCase().includes(ex));
      });

      return {
        orderId: order.id,
        orderNumber: order.orderNumber,
        shopName: order.shop.name,
        regionName: order.customerRegion?.name ?? "غير معروف",
        productCount: products.length,
        totalProfitAlf: totalProfit,
        hasMeat: meatProducts.length > 0,
        meatBuyAlf: meatProducts.reduce((sum: number, p: any) => sum + Number(p.buyAlf), 0),
        meatSellAlf: meatProducts.reduce((sum: number, p: any) => sum + Number(p.sellAlf), 0),
        meatProfitAlf: meatProducts.reduce((sum: number, p: any) => sum + (Number(p.sellAlf) - Number(p.buyAlf)), 0),
        meatProductsList: meatProducts,
        hasFish: fishProducts.length > 0,
        fishBuyAlf: fishProducts.reduce((sum: number, p: any) => sum + Number(p.buyAlf), 0),
        fishSellAlf: fishProducts.reduce((sum: number, p: any) => sum + Number(p.sellAlf), 0),
        fishProfitAlf: fishProducts.reduce((sum: number, p: any) => sum + (Number(p.sellAlf) - Number(p.buyAlf)), 0),
        fishProductsList: fishProducts,
        preparerShoppingJson: json
      };
    });

    const totalPrepProfit = orderSummaries.reduce((sum, o) => sum + o.totalProfitAlf, 0);
    const totalMeatProfit = orderSummaries.reduce((sum, o) => sum + o.meatProfitAlf, 0);
    const totalFishProfit = orderSummaries.reduce((sum, o) => sum + o.fishProfitAlf, 0);
    const totalOtherPrepProfit = totalPrepProfit - totalMeatProfit - totalFishProfit;

    // 1. حسابات التوصيل
    const totalDeliveryGross = totalCourierEarning.plus(totalCompanyNet);

    // 2. حسابات التجهيز وأجور المجهز
    const totalPrepGross = totalPrepProfit * ALF_PER_DINAR;

    // تحديد المجهزين الذين خرجوا للعمل في هذا اليوم
    const activeWorkingPreparers = (companyPreparersList || []).filter(p => {
      const hasLogs = p.workLogs && p.workLogs.length > 0;
      const hasOrders = ordersPrep.some((o: any) => o.submittedByCompanyPreparerId === p.id);
      return hasLogs || hasOrders;
    });

    const workingPreparers = activeWorkingPreparers.length > 0
      ? activeWorkingPreparers
      : (ordersPrep.length > 0 ? (companyPreparersList || []).filter(p => Number(p.dailySalary) > 0).slice(0, 1) : []);

    const totalPreparersWage = workingPreparers.reduce(
      (sum, p) => sum + Number(p.dailySalary || 0),
      0
    );

    const totalPreparersWageDinar = new Decimal(totalPreparersWage);
    const netPrepProfitDinar = new Decimal(totalPrepGross).minus(totalPreparersWageDinar);

    // 3. الأرباح الكلية الصافية للشركة (صافي التوصيل + صافي التجهيز بعد خصم أجور المجهز)
    const grandTotalCompanyProfit = totalCompanyNet.plus(netPrepProfitDinar);

    return (
      <div className="space-y-6 animate-in fade-in duration-300" dir="rtl">
        <p className={ad.muted}>
          <Link href={`${SECRET_ADMIN_PATH}/reports`} className={ad.link}>
            ← التقارير
          </Link>
        </p>

        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className={`${ad.h1} flex items-center gap-2`}>
              <span>📊</span> تقرير الأرباح الشامل والتجهيز
            </h1>
            <p className={`mt-2 ${ad.lead}`}>
              أرباح التوصيل للمندوبين وأرباح تجهيز اللحوم والأسماك مدمجة ليوم {selectedDayIso}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <DateFilterForm selectedDayIso={selectedDayIso} />
          </div>
        </div>
        {/* شريط تبويب تبديل طرق العرض */}
        <div className="flex gap-2 border-b border-slate-200 pb-3">
          <Link
            href={{ pathname: `${SECRET_ADMIN_PATH}/reports/couriers`, query: { ...sp, view: "table" } }}
            className="px-4 py-2.5 rounded-2xl text-xs font-black transition-all bg-slate-900 text-white shadow-md scale-105"
          >
            📋 التفاصيل وجدول الأرباح اليومية
          </Link>
          <Link
            href={{ pathname: `${SECRET_ADMIN_PATH}/reports/couriers`, query: { ...sp, view: "chart" } }}
            className="px-4 py-2.5 rounded-2xl text-xs font-black transition-all bg-white text-slate-605 hover:bg-slate-50 border border-slate-200"
          >
            📈 الرسم البياني (سنوي / شهري / يومي)
          </Link>
        </div>
        {/* الكروت الإحصائية الرئيسية الثلاثة */}
        <div className="grid gap-5 grid-cols-1 md:grid-cols-3">
          {/* 1. التوصيل الكلي */}
          <div className="rounded-3xl border border-sky-100 bg-sky-50/50 p-6 shadow-sm hover:shadow-md transition-all">
            <div className="flex items-center justify-between pb-3 border-b border-sky-100/80">
              <span className="text-xs font-black text-sky-800 uppercase tracking-wider">🚚 التوصيل الكلي</span>
              <span className="text-[11px] font-bold text-sky-600 bg-sky-100/70 px-2.5 py-0.5 rounded-full">{totalOrders} طلب</span>
            </div>

            <div className="mt-4">
              <p className="text-[11px] font-bold text-sky-600">الكلي</p>
              <p className="text-3xl font-black text-sky-950 mt-1">{formatDinarAsAlfWithUnit(totalDeliveryGross)}</p>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3 pt-4 border-t border-sky-100/80">
              <div className="bg-white/80 rounded-2xl p-3 border border-sky-100/50">
                <p className="text-[10px] font-bold text-slate-500">للمندوبين 🛵</p>
                <p className="text-sm font-black text-emerald-600 mt-1">{formatDinarAsAlfWithUnit(totalCourierEarning)}</p>
              </div>
              <div className="bg-white/80 rounded-2xl p-3 border border-sky-100/50">
                <p className="text-[10px] font-bold text-slate-500">للشركة 🏢</p>
                <p className="text-sm font-black text-sky-900 mt-1">{formatDinarAsAlfWithUnit(totalCompanyNet)}</p>
              </div>
            </div>
          </div>

          {/* 2. التجهيز الكلي */}
          <div className="rounded-3xl border border-indigo-100 bg-indigo-50/50 p-6 shadow-sm hover:shadow-md transition-all">
            <div className="flex items-center justify-between pb-3 border-b border-indigo-100/80">
              <span className="text-xs font-black text-indigo-800 uppercase tracking-wider">🔪 التجهيز الكلي</span>
              <span className="text-[11px] font-bold text-indigo-600 bg-indigo-100/70 px-2.5 py-0.5 rounded-full">{ordersPrep.length} طلب</span>
            </div>

            <div className="mt-4">
              <p className="text-[11px] font-bold text-indigo-600">التجهيز الكلي</p>
              <p className="text-3xl font-black text-indigo-950 mt-1">{formatDinarAsAlfWithUnit(totalPrepGross)}</p>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3 pt-4 border-t border-indigo-100/80">
              <div className="bg-white/80 rounded-2xl p-3 border border-indigo-100/50">
                <p className="text-[10px] font-bold text-slate-500">أجور التجهيز 👨‍🍳</p>
                <p className="text-sm font-black text-amber-600 mt-1">{formatDinarAsAlfWithUnit(totalPreparersWageDinar)}</p>
                {workingPreparers.length > 0 && (
                  <p className="text-[9px] font-bold text-slate-400 mt-0.5 truncate" title={workingPreparers.map(p => p.name).join("، ")}>
                    {workingPreparers.map(p => p.name).join("، ")}
                  </p>
                )}
              </div>
              <div className="bg-white/80 rounded-2xl p-3 border border-indigo-100/50">
                <p className="text-[10px] font-bold text-slate-500">صافي التجهيز للشركة 🏢</p>
                <p className={`text-sm font-black mt-1 ${netPrepProfitDinar.gte(0) ? "text-indigo-950" : "text-rose-600"}`}>
                  {formatDinarAsAlfWithUnit(netPrepProfitDinar)}
                </p>
                <p className="text-[9px] font-bold text-slate-400 mt-0.5">بعد خصم أجور المجهز</p>
              </div>
            </div>
          </div>

          {/* 3. الأرباح الكلية */}
          <div className="rounded-3xl bg-slate-900 text-white p-6 shadow-xl relative overflow-hidden border-b-4 border-slate-700 hover:shadow-2xl transition-all">
            <div className="absolute left-2 -bottom-2 opacity-10 text-[95px] pointer-events-none leading-none select-none">💰</div>

            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <span className="text-xs font-black text-amber-400 uppercase tracking-wider">💰 الأرباح الكلية</span>
              <span className="text-[11px] font-bold text-slate-300 bg-slate-800 px-2.5 py-0.5 rounded-full">صافي الشركة</span>
            </div>

            <div className="mt-4 relative z-10">
              <p className="text-[11px] font-bold text-slate-400">الأرباح الكلية للشركة</p>
              <p className="text-3xl font-black text-amber-400 mt-1">{formatDinarAsAlfWithUnit(grandTotalCompanyProfit)}</p>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3 pt-4 border-t border-slate-800 relative z-10">
              <div className="bg-slate-800/80 rounded-2xl p-3 border border-slate-700/80">
                <p className="text-[10px] font-bold text-slate-400">التوصيل 🚚</p>
                <p className="text-sm font-black text-sky-400 mt-1">{formatDinarAsAlfWithUnit(totalCompanyNet)}</p>
              </div>
              <div className="bg-slate-800/80 rounded-2xl p-3 border border-slate-700/80">
                <p className="text-[10px] font-bold text-slate-400">التجهيز الصافي 🔪</p>
                <p className={`text-sm font-black mt-1 ${netPrepProfitDinar.gte(0) ? "text-emerald-400" : "text-rose-400"}`}>
                  {formatDinarAsAlfWithUnit(netPrepProfitDinar)}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-5 lg:grid-cols-[260px_1fr]">
          {/* القائمة الجانبية للأيام */}
          <div className="space-y-2 rounded-3xl border border-slate-200 bg-white p-3 shadow-sm h-fit">
            <h2 className="text-xs font-black text-slate-400 mb-3 px-2 uppercase tracking-wider">الأيام السابقة (آخر 21 يوم)</h2>
            <div className="max-h-[70vh] overflow-y-auto space-y-1.5 pr-1">
              {dayList.map((day) => {
                const indicators = dayIndicators[day];
                return (
                  <Link 
                    key={day} 
                    href={{ pathname: `${SECRET_ADMIN_PATH}/reports/couriers`, query: { day } }} 
                    className={`block rounded-2xl px-3 py-2.5 text-xs font-black transition-all ${day === selectedDayIso ? "bg-slate-900 text-white shadow-md scale-[1.02]" : "text-slate-600 hover:bg-slate-50 border border-transparent hover:border-slate-100"}`}
                  >
                    <div className="flex items-center justify-between">
                      <span>{day} {day === defaultDay && "⭐"}</span>
                      <div className="flex gap-0.5 text-xs">
                        {indicators?.hasMeat && <span title="يحتوي على لحوم">🥩</span>}
                        {indicators?.hasFish && <span title="يحتوي على أسماك">🐟</span>}
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>

          <div className="space-y-6">
            {/* القسم الأول: أرباح المندوبين */}
            <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
              <h2 className="text-base font-black text-slate-800 border-b pb-2 flex items-center gap-2">
                <span>🛵</span> أرباح المندوبين (التوصيل)
              </h2>

              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs text-slate-600">
                  <thead className="bg-slate-50 border-b border-slate-100 text-[10px] font-bold text-slate-500">
                    <tr>
                      <th className="px-4 py-3 text-right">المندوب</th>
                      <th className="px-4 py-3 text-center">ربح المندوب</th>
                      <th className="px-4 py-3 text-center">صافي الشركة</th>
                      <th className="px-4 py-3 text-center">عدد الطلبات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {sortedRows.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-4 py-10 text-center text-slate-400 font-bold italic">
                          لا توجد أرباح توصيل مسجلة لهذا اليوم.
                        </td>
                      </tr>
                    ) : (
                      sortedRows.map((row) => (
                        <tr key={row.courierId} className="transition hover:bg-slate-50">
                          <td className="px-4 py-3 font-bold text-slate-800">{row.name}</td>
                          <td className="px-4 py-3 text-center font-bold text-emerald-600">{formatDinarAsAlfWithUnit(row.courierEarning)}</td>
                          <td className="px-4 py-3 text-center font-bold text-slate-900">{formatDinarAsAlfWithUnit(row.companyNet)}</td>
                          <td className="px-4 py-3 text-center font-semibold text-slate-700">{row.ordersCount}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                  {sortedRows.length > 0 && (
                    <tfoot className="bg-slate-50 text-[10px] font-bold text-slate-600 border-t border-slate-100">
                      <tr>
                        <td className="px-4 py-3 text-right">الإجمالي</td>
                        <td className="px-4 py-3 text-center">{formatDinarAsAlfWithUnit(totalCourierEarning)}</td>
                        <td className="px-4 py-3 text-center">{formatDinarAsAlfWithUnit(totalCompanyNet)}</td>
                        <td className="px-4 py-3 text-center">{totalOrders}</td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </div>

            {/* القسم الثاني: أرباح التجهيز */}
            <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
              <h2 className="text-base font-black text-slate-800 border-b pb-2 flex items-center gap-2">
                <span>🔪</span> تفاصيل التجهيز والأرباح للمحلات
              </h2>

              <ReportTableClient orders={orderSummaries} />
            </div>
          </div>
        </div>
      </div>
    );
  } catch (error) {
    console.error("Combined report rendering failed:", error);
    return (
      <div className="space-y-6" dir="rtl">
        <p className={ad.muted}>
          <Link href={`${SECRET_ADMIN_PATH}/reports`} className={ad.link}>
            ← التقارير
          </Link>
        </p>
        <div className="rounded-3xl border border-rose-200 bg-rose-50 p-6 text-center">
          <h1 className="text-lg font-black text-rose-800">حدث خطأ أثناء تحميل التقرير</h1>
          <p className="mt-2 text-xs text-rose-600 font-bold">يرجى التأكد من اختيار تاريخ صحيح أو المحاولة مرة أخرى لاحقاً.</p>
        </div>
      </div>
    );
  }
}
