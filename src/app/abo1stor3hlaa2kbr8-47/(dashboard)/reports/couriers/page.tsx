import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { ad } from "@/lib/admin-ui";
import { formatYMDLocal } from "@/lib/report-dates";
import { formatDinarAsAlfWithUnit } from "@/lib/money-alf";
import { Decimal } from "@prisma/client/runtime/library";
import { MONEY_KIND_DELIVERY } from "@/lib/mandoub-money-events";
import { computeCourierDeliveryEarningDinar } from "@/lib/courier-earnings";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "أرباح المندوبين — أبو الأكبر للتوصيل",
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

const SECRET_ADMIN_PATH = "/abo1stor3hlaa2kbr8-47";

export default async function CouriersReportPage({ searchParams }: Props) {
  try {
    const sp = await searchParams;
    const today = new Date();
    const defaultDay = formatYMDLocal(today);
    const selectedDayIso = parseSelectedDay(sp.day) || defaultDay;
    const [year, month, date] = selectedDayIso.split("-").map(Number);
    const selectedDate = new Date(year, month - 1, date);
    const from = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate(), 0, 0, 0, 0);
    const to = new Date(from);
    to.setHours(23, 59, 59, 999);

    const dayList = Array.from({ length: 21 }, (_, index) => {
      const d = new Date(today);
      d.setDate(d.getDate() - index);
      return formatYMDLocal(d);
    });


  const [orders, tipEntries] = await Promise.all([
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
        courier: { select: { name: true, vehicleType: true } },
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
    prisma.courierWalletMiscEntry.findMany({
      where: {
        label: { contains: "[إكرامية]" },
        deletedAt: null,
        createdAt: { gte: from, lte: to },
      },
      include: { courier: { select: { name: true } } },
    }),
  ]);

  const rows = new Map<string, CourierProfitRow>();

  function getRow(courierId: string, courierName: string) {
    const existing = rows.get(courierId);
    if (existing) return existing;
    const row = ensureCourierRow(courierId, courierName);
    rows.set(courierId, row);
    return row;
  }

  for (const order of orders) {
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
    if (courierEarning == null) {
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
  const totalPaid = Array.from(rows.values()).reduce((sum, row) => sum.plus(row.totalPaid), new Decimal(0));
  const totalCompanyNet = Array.from(rows.values()).reduce((sum, row) => sum.plus(row.companyNet), new Decimal(0));
  const totalOrders = Array.from(rows.values()).reduce((count, row) => count + row.ordersCount, 0);

  return (
    <div className="space-y-6" dir="rtl">
      <p className={ad.muted}>
        <Link href={`${SECRET_ADMIN_PATH}/reports`} className={ad.link}>
          ← التقارير
        </Link>
      </p>

      <div>
        <h1 className={ad.h1}>أرباح المندوبين</h1>
        <p className={`mt-3 ${ad.lead}`}>
          عرض أرباح المندوبين اليومية وقيمة الإكراميات، مع صافي أرباح الشركة بعد خصم الإكراميات.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
        <div className="space-y-3 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-black text-slate-500 uppercase tracking-widest">اختر اليوم</h2>
          {dayList.map((day) => (
            <Link
              key={day}
              href={{ pathname: `${SECRET_ADMIN_PATH}/reports/couriers`, query: { day } }}
              className={`block rounded-2xl px-4 py-3 text-sm font-bold transition-all ${
                day === selectedDayIso
                  ? "bg-slate-900 text-white shadow-lg scale-[1.02]"
                  : "text-slate-600 hover:bg-slate-50"
              }`}
            >
              {day}
            </Link>
          ))}
        </div>


        <div className="space-y-5">
          <div className={`${ad.section} rounded-3xl border border-slate-200 bg-white p-6 shadow-sm`}>
            <form method="get" className="grid gap-3 sm:grid-cols-[1fr_auto] items-end">
              <label className="flex flex-col gap-2">
                <span className={ad.label}>اليوم</span>
                <input type="date" name="day" defaultValue={selectedDayIso} className={ad.input} />
              </label>
              <button type="submit" className={ad.btnPrimary}>
                تحديث
              </button>
            </form>
          </div>

          <div className="grid gap-4 sm:grid-cols-4">
            <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">ربح المندوب</p>
              <p className="mt-3 text-2xl font-black text-emerald-700">{formatDinarAsAlfWithUnit(totalCourierEarning)}</p>
            </div>
            <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">الإكراميات</p>
              <p className="mt-3 text-2xl font-black text-rose-700">{formatDinarAsAlfWithUnit(totalTips)}</p>
            </div>
            <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">مجموعهما</p>
              <p className="mt-3 text-2xl font-black text-sky-700">{formatDinarAsAlfWithUnit(totalPaid)}</p>
            </div>
            <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">صافي الشركة</p>
              <p className="mt-3 text-2xl font-black text-slate-900">{formatDinarAsAlfWithUnit(totalCompanyNet)}</p>
            </div>
          </div>

          <div className="overflow-x-auto rounded-3xl border border-slate-200 bg-white shadow-sm">
            <table className="w-full min-w-[48rem] text-right text-sm text-slate-600">
              <thead className="bg-slate-50 border-b border-slate-100 text-xs font-semibold text-slate-500">
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
                    <td colSpan={6} className="px-4 py-10 text-center text-slate-500">
                      لا توجد بيانات لأرباح المندوبين لهذا اليوم.
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
                      <td className="px-4 py-3 text-center text-slate-700">{row.ordersCount}</td>
                    </tr>
                  ))
                )}
              </tbody>
              {sortedRows.length > 0 && (
                <tfoot className="bg-slate-50 text-xs font-semibold text-slate-600">
                  <tr>
                    <td className="px-4 py-3 text-right">الإجمالي</td>
                    <td className="px-4 py-3 text-center">{formatDinarAsAlfWithUnit(totalCourierEarning)}</td>
                    <td className="px-4 py-3 text-center">{formatDinarAsAlfWithUnit(totalTips)}</td>
                    <td className="px-4 py-3 text-center">{formatDinarAsAlfWithUnit(totalPaid)}</td>
                    <td className="px-4 py-3 text-center">{formatDinarAsAlfWithUnit(totalCompanyNet)}</td>
                    <td className="px-4 py-3 text-center">{totalOrders}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      </div>
    </div>
  );
  } catch (error) {
    console.error("Courier report render failed:", error);
    return (
      <div className="space-y-6" dir="rtl">
        <p className={ad.muted}>
          <Link href={`${SECRET_ADMIN_PATH}/reports`} className={ad.link}>
            ← التقارير
          </Link>
        </p>
        <div>
          <h1 className={ad.h1}>أرباح المندوبين</h1>
          <p className={`mt-3 ${ad.lead}`}>
            حدث خطأ أثناء تحميل التقرير. حاول التحديث أو اتصل بالدعم.
          </p>
        </div>
      </div>
    );
  }
}
