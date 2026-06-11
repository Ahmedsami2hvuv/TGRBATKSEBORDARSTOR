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

export const dynamic = "force-dynamic";

export const metadata = {
  title: "تقرير الأرباح الشامل (التوصيل والتجهيز) — أبو الأكبر للتوصيل",
};

type Props = {
  searchParams: Promise<{ day?: string | string[] }>;
};

type CourierProfitRow = {
  courierId: string;
  name: string;
  courierEarning: Decimal;
  tipAmount: Decimal;
  totalPaid: Decimal;
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
    tipAmount: new Decimal(0),
    totalPaid: new Decimal(0),
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

    const today = new Date();
    // نحدد اليوم الافتراضي بناءً على نوبة العمل (تبدأ 6:00 صباحاً)
    let shiftStartToday = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 6, 0, 0, 0);
    if (today < shiftStartToday) {
      shiftStartToday.setDate(shiftStartToday.getDate() - 1);
    }
    const defaultDay = formatYMDLocal(shiftStartToday);
    const selectedDayIso = parseSelectedDay(sp.day) || defaultDay;

    const [year, month, date] = selectedDayIso.split("-").map(Number);
    const selectedDate = new Date(year, month - 1, date);
    
    const from = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate(), 6, 0, 0, 0);
    const to = new Date(from);
    to.setDate(to.getDate() + 1);
    to.setMilliseconds(to.getMilliseconds() - 1);

    const dayList = Array.from({ length: 21 }, (_, index) => {
      const d = new Date(shiftStartToday);
      d.setDate(d.getDate() - index);
      return formatYMDLocal(d);
    });

    const earliestDayDate = new Date(from);
    earliestDayDate.setDate(earliestDayDate.getDate() - 20);
    const rangeFrom = earliestDayDate;

    // جلب البيانات المتوازي
    const [ordersDelivery, tipEntries, ordersPrep, sidebarPrepOrders] = await Promise.all([
      // طلبات التوصيل المسلمة
      prisma.order.findMany({
        where: {
          status: "delivered",
          OR: [
            { updatedAt: { gte: from, lte: to } },
            {
              moneyEvents: {
                some: {
                  kind: MONEY_KIND_DELIVERY,
                  deletedAt: null,
                  createdAt: { gte: from, lte: to },
                },
              },
            },
          ],
        },
        select: {
          id: true,
          assignedCourierId: true,
          courierEarningForCourierId: true,
          courierEarningForCourier: { select: { name: true } },
          courierEarningDinar: true,
          deliveryPrice: true,
          courier: { select: { name: true, vehicleType: true, zeroEarning: true } },
          moneyEvents: {
            where: {
              kind: MONEY_KIND_DELIVERY,
              deletedAt: null,
              createdAt: { gte: from, lte: to },
            },
            orderBy: { createdAt: "desc" },
            select: {
              courierId: true,
              courier: { select: { name: true } },
            },
          },
        },
      }),
      // إكراميات المندوبين
      prisma.courierWalletMiscEntry.findMany({
        where: {
          label: { contains: "[إكرامية]" },
          deletedAt: null,
          createdAt: { gte: from, lte: to },
        },
        include: { courier: { select: { name: true } } },
      }),
      // طلبات التجهيز لليوم المحدد
      prisma.order.findMany({
        where: {
          createdAt: { gte: from, lte: to },
          preparerShoppingJson: { not: null },
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
          preparerShoppingJson: { not: null },
          status: { notIn: ["cancelled", "rejected"] },
          shop: { name: { in: ADMIN_SHOP_NAMES } }
        },
        select: { createdAt: true, preparerShoppingJson: true }
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
      const deliveryEv = order.moneyEvents[0];
      const earningOwner =
        order.courierEarningForCourierId ?? deliveryEv?.courierId ?? order.assignedCourierId ?? null;
      if (!earningOwner) continue;

      const courierName =
        deliveryEv?.courier?.name ||
        order.courierEarningForCourier?.name ||
        order.courier?.name ||
        "مندوب";
      const row = getRow(earningOwner, courierName);
      row.ordersCount += 1;

      let courierEarning = order.courierEarningDinar;
      const isZeroEarning = order.courier?.zeroEarning || false;

      if (isZeroEarning) {
        courierEarning = new Decimal(0);
      } else if (courierEarning == null) {
        const vehicleType = (order as any).courierVehicleType || order.courier?.vehicleType || null;
        courierEarning = computeCourierDeliveryEarningDinar(vehicleType, order.deliveryPrice ?? null);
      }
      if (courierEarning == null) continue;

      const companyProfit = order.deliveryPrice?.minus(courierEarning) ?? new Decimal(0);
      row.courierEarning = row.courierEarning.plus(courierEarning);
      row.totalPaid = row.totalPaid.plus(courierEarning);
      row.companyNet = row.companyNet.plus(companyProfit);
    }

    for (const tip of tipEntries) {
      const courierId = tip.courierId;
      const courierName = tip.courier?.name || rows.get(courierId)?.name || "مندوب";
      const row = getRow(courierId, courierName);
      row.tipAmount = row.tipAmount.plus(tip.amountDinar);
      row.totalPaid = row.totalPaid.plus(tip.amountDinar);
      row.companyNet = row.companyNet.minus(tip.amountDinar);
    }

    const sortedRows = Array.from(rows.values()).sort((a, b) => {
      const cmp = b.companyNet.cmp(a.companyNet);
      return cmp !== 0 ? cmp : a.name.localeCompare(b.name, "ar");
    });

    const totalCourierEarning = Array.from(rows.values()).reduce((sum, row) => sum.plus(row.courierEarning), new Decimal(0));
    const totalTips = Array.from(rows.values()).reduce((sum, row) => sum.plus(row.tipAmount), new Decimal(0));
    const totalCompanyNet = Array.from(rows.values()).reduce((sum, row) => sum.plus(row.companyNet), new Decimal(0));
    const totalOrders = Array.from(rows.values()).reduce((count, row) => count + row.ordersCount, 0);

    // --- معالجة وحساب بيانات التجهيز ---
    const dayIndicators: Record<string, { hasMeat: boolean; hasFish: boolean }> = {};
    sidebarPrepOrders.forEach(order => {
      const d = new Date(order.createdAt);
      if (d.getHours() < 6) d.setDate(d.getDate() - 1);
      const dayKey = formatYMDLocal(d);

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
        meatBuyAlf: meatProducts.reduce((sum, p) => sum + Number(p.buyAlf), 0),
        meatSellAlf: meatProducts.reduce((sum, p) => sum + Number(p.sellAlf), 0),
        meatProfitAlf: meatProducts.reduce((sum, p) => sum + (Number(p.sellAlf) - Number(p.buyAlf)), 0),
        meatProductsList: meatProducts,
        hasFish: fishProducts.length > 0,
        fishBuyAlf: fishProducts.reduce((sum, p) => sum + Number(p.buyAlf), 0),
        fishSellAlf: fishProducts.reduce((sum, p) => sum + Number(p.sellAlf), 0),
        fishProfitAlf: fishProducts.reduce((sum, p) => sum + (Number(p.sellAlf) - Number(p.buyAlf)), 0),
        fishProductsList: fishProducts,
        preparerShoppingJson: json
      };
    });

    const totalPrepProfit = orderSummaries.reduce((sum, o) => sum + o.totalProfitAlf, 0);
    const totalMeatProfit = orderSummaries.reduce((sum, o) => sum + o.meatProfitAlf, 0);
    const totalFishProfit = orderSummaries.reduce((sum, o) => sum + o.fishProfitAlf, 0);

    // صافي الشركة الكلي المدمج
    const totalCompanyCombinedNet = totalCompanyNet.plus(new Decimal(totalPrepProfit * ALF_PER_DINAR));

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
            <form method="get" className="flex items-center gap-2 rounded-2xl bg-white border border-slate-200 p-2 shadow-sm">
              <span className="text-xs font-black text-slate-500">تغيير اليوم:</span>
              <input 
                type="date" 
                name="day" 
                defaultValue={selectedDayIso} 
                className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-extrabold text-slate-800 outline-none focus:border-slate-400"
                onChange={(e) => {
                  if (e.target.value) {
                    e.target.form?.submit();
                  }
                }}
              />
            </form>
          </div>
        </div>

        {/* الكروت الإحصائية الشاملة */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-3xl border border-sky-100 bg-sky-50/50 p-5 shadow-sm">
            <p className="text-xs font-bold text-sky-700 uppercase tracking-widest">صافي التوصيل (للشركة)</p>
            <p className="mt-3 text-3xl font-black text-sky-900">{formatDinarAsAlfWithUnit(totalCompanyNet)}</p>
            <div className="mt-2 flex items-center justify-between text-[10px] text-slate-500 font-bold border-t border-sky-100 pt-2">
              <span>ربح المندوبين: {formatDinarAsAlfWithUnit(totalCourierEarning)}</span>
              <span>الإكراميات: {formatDinarAsAlfWithUnit(totalTips)}</span>
            </div>
          </div>

          <div className="rounded-3xl border border-red-100 bg-red-50/50 p-5 shadow-sm">
            <p className="text-xs font-bold text-red-700 uppercase tracking-widest">أرباح القصاب 🥩</p>
            <p className="mt-3 text-3xl font-black text-red-900">{formatDinarAsAlfWithUnit(totalMeatProfit * ALF_PER_DINAR)}</p>
            <div className="mt-2 text-[10px] text-slate-500 font-bold border-t border-red-100 pt-2">
              مجموع مبيعات اللحوم الصافية
            </div>
          </div>

          <div className="rounded-3xl border border-emerald-100 bg-emerald-50/50 p-5 shadow-sm">
            <p className="text-xs font-bold text-emerald-700 uppercase tracking-widest">أرباح السماك 🐟</p>
            <p className="mt-3 text-3xl font-black text-emerald-900">{formatDinarAsAlfWithUnit(totalFishProfit * ALF_PER_DINAR)}</p>
            <div className="mt-2 text-[10px] text-slate-500 font-bold border-t border-emerald-100 pt-2">
              مجموع مبيعات الأسماك الصافية
            </div>
          </div>

          <div className="rounded-3xl bg-slate-900 text-white p-5 shadow-lg relative overflow-hidden border-b-4 border-slate-700">
            <div className="absolute right-0 bottom-0 opacity-10 text-[100px] pointer-events-none leading-none select-none">💰</div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">صافي الأرباح الكلي للشركة</p>
            <p className="mt-3 text-3xl font-black text-amber-400">{formatDinarAsAlfWithUnit(totalCompanyCombinedNet)}</p>
            <div className="mt-2 flex items-center justify-between text-[10px] text-slate-400 font-bold border-t border-slate-800 pt-2">
              <span>التوصيل: {formatDinarAsAlfWithUnit(totalCompanyNet)}</span>
              <span>التجهيز: {formatDinarAsAlfWithUnit(totalPrepProfit * ALF_PER_DINAR)}</span>
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
                      <th className="px-4 py-3 text-center">الإكرامية</th>
                      <th className="px-4 py-3 text-center">مجموعهما</th>
                      <th className="px-4 py-3 text-center">صافي الشركة</th>
                      <th className="px-4 py-3 text-center">عدد الطلبات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {sortedRows.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-4 py-10 text-center text-slate-400 font-bold italic">
                          لا توجد أرباح توصيل مسجلة لهذا اليوم.
                        </td>
                      </tr>
                    ) : (
                      sortedRows.map((row) => (
                        <tr key={row.courierId} className="transition hover:bg-slate-50">
                          <td className="px-4 py-3 font-bold text-slate-800">{row.name}</td>
                          <td className="px-4 py-3 text-center font-bold text-emerald-600">{formatDinarAsAlfWithUnit(row.courierEarning)}</td>
                          <td className="px-4 py-3 text-center font-bold text-rose-600">{formatDinarAsAlfWithUnit(row.tipAmount)}</td>
                          <td className="px-4 py-3 text-center font-bold text-sky-700">{formatDinarAsAlfWithUnit(row.totalPaid)}</td>
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
                        <td className="px-4 py-3 text-center">{formatDinarAsAlfWithUnit(totalTips)}</td>
                        <td className="px-4 py-3 text-center">{formatDinarAsAlfWithUnit(totalCourierEarning.plus(totalTips))}</td>
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
