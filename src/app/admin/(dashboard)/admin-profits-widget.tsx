import { prisma } from "@/lib/prisma";
import { formatDinarAsAlfWithUnit } from "@/lib/money-alf";
import { Decimal } from "@prisma/client/runtime/library";
import { payCourierTipAction } from "./couriers/tip-actions";

const ALF_PER_DINAR = 1000;

function numOrZero(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export async function AdminProfitsWidget() {
  const now = new Date();
  let startOfToday: Date;
  if (now.getHours() >= 6) {
    startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 6, 0, 0, 0);
  } else {
    startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 6, 0, 0, 0);
  }

  // --- جلب البيانات ---
  const [orders, allTips] = await Promise.all([
    prisma.order.findMany({
      where: { status: "delivered" },
      select: {
        deliveryPrice: true,
        courierEarningDinar: true,
        createdAt: true,
        preparerShoppingJson: true,
        submittedByCompanyPreparerId: true,
        courier: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.courierWalletMiscEntry.findMany({
      where: {
        label: { contains: "[إكرامية]" },
        deletedAt: null
      },
      select: { amountDinar: true, createdAt: true, courierId: true }
    })
  ]);

  let totalDeliveryProfit = new Decimal(0);
  let todayDeliveryProfit = new Decimal(0);
  let totalPrepProfit = new Decimal(0);
  let todayPrepProfit = new Decimal(0);
  let totalPrepProductsProfit = new Decimal(0);
  let todayPrepProductsProfit = new Decimal(0);
  let totalPrepWagesProfit = new Decimal(0);
  let todayPrepWagesProfit = new Decimal(0);
  let totalTipsPaid = new Decimal(0);
  let todayTipsPaid = new Decimal(0);

  const courierStats: Record<
    string,
    { id: string; name: string; totalProfit: Decimal; todayProfit: Decimal; totalTips: Decimal; todayTips: Decimal }
  > = {};

  for (const t of allTips) {
    const isToday = t.createdAt >= startOfToday;
    totalTipsPaid = totalTipsPaid.plus(t.amountDinar);
    if (isToday) todayTipsPaid = todayTipsPaid.plus(t.amountDinar);

    if (!courierStats[t.courierId]) {
      courierStats[t.courierId] = {
        id: t.courierId,
        name: "مندوب",
        totalProfit: new Decimal(0),
        todayProfit: new Decimal(0),
        totalTips: new Decimal(0),
        todayTips: new Decimal(0),
      };
    }
    courierStats[t.courierId].totalTips = courierStats[t.courierId].totalTips.plus(t.amountDinar);
    if (isToday) {
      courierStats[t.courierId].todayTips = courierStats[t.courierId].todayTips.plus(t.amountDinar);
    }
  }

  for (const o of orders) {
    const isToday = o.createdAt >= startOfToday;
    if (o.deliveryPrice && o.courierEarningDinar) {
      const p = o.deliveryPrice.minus(o.courierEarningDinar);
      totalDeliveryProfit = totalDeliveryProfit.plus(p);
      if (isToday) todayDeliveryProfit = todayDeliveryProfit.plus(p);

      if (o.courier) {
        if (!courierStats[o.courier.id]) {
          courierStats[o.courier.id] = {
            id: o.courier.id,
            name: o.courier.name,
            totalProfit: new Decimal(0),
            todayProfit: new Decimal(0),
            totalTips: new Decimal(0),
            todayTips: new Decimal(0),
          };
        }
        courierStats[o.courier.id].name = o.courier.name;
        courierStats[o.courier.id].totalProfit = courierStats[o.courier.id].totalProfit.plus(p);
        if (isToday) courierStats[o.courier.id].todayProfit = courierStats[o.courier.id].todayProfit.plus(p);
      }
    }

    if (o.submittedByCompanyPreparerId && o.preparerShoppingJson) {
      const j = o.preparerShoppingJson as any;
      const productsProfitDinar = new Decimal(numOrZero(j?.sumSellAlf - j?.sumBuyAlf) * ALF_PER_DINAR);
      const wagesProfitDinar = new Decimal(numOrZero(j?.extraAlf) * ALF_PER_DINAR);
      const profitDinar = productsProfitDinar.plus(wagesProfitDinar);

      totalPrepProfit = totalPrepProfit.plus(profitDinar);
      totalPrepProductsProfit = totalPrepProductsProfit.plus(productsProfitDinar);
      totalPrepWagesProfit = totalPrepWagesProfit.plus(wagesProfitDinar);
      
      if (isToday) {
        todayPrepProfit = todayPrepProfit.plus(profitDinar);
        todayPrepProductsProfit = todayPrepProductsProfit.plus(productsProfitDinar);
        todayPrepWagesProfit = todayPrepWagesProfit.plus(wagesProfitDinar);
      }
    }
  }

  const todayGross = todayDeliveryProfit.plus(todayPrepProfit);
  const allTimeGross = totalDeliveryProfit.plus(totalPrepProfit);
  const todayNet = todayGross.minus(todayTipsPaid);
  const allTimeNet = allTimeGross.minus(totalTipsPaid);

  const couriersList = Object.values(courierStats).sort((a, b) => b.totalProfit.cmp(a.totalProfit));

  return (
    <section className="kse-glass-dark my-8 flex flex-col gap-6 rounded-[1.25rem] border border-amber-200/50 p-5 sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 shadow-inner shadow-white/20">
            <span className="text-2xl text-white">💰</span>
          </div>
          <div>
            <h2 className="text-lg font-black text-amber-900">سجل أرباح الشركة التفصيلي</h2>
            <p className="mt-1 text-xs font-semibold text-amber-700/80">ملخص الأرباح (بعد استقطاع الإكراميات)</p>
          </div>
        </div>
        <div className="flex flex-col gap-3 rounded-xl bg-white/60 p-3 shadow-sm sm:min-w-[240px]">
          <div className="flex items-center justify-between gap-3 border-b border-amber-100/50 pb-2">
            <span className="text-xs font-bold text-slate-600">صافي الأرباح (اليوم)</span>
            <span className="text-sm font-black text-emerald-600">{formatDinarAsAlfWithUnit(todayNet)}</span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs font-bold text-slate-600">صافي الأرباح (الشاملة)</span>
            <span className="text-sm font-black text-sky-600">{formatDinarAsAlfWithUnit(allTimeNet)}</span>
          </div>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <div className="rounded-xl border border-sky-100 bg-white p-4 shadow-sm">
          <h3 className="mb-4 text-sm font-bold text-sky-900">أرباح التجهيز</h3>
          <div className="rounded-lg border border-sky-100 bg-sky-50 p-3">
            <div className="mb-1 flex items-center justify-between text-xs"><span className="text-slate-500">اليوم:</span><span className="font-bold text-emerald-600">{formatDinarAsAlfWithUnit(todayPrepProfit)}</span></div>
            <div className="flex items-center justify-between text-xs"><span className="text-slate-500">الإجمالي:</span><span className="font-bold text-sky-700">{formatDinarAsAlfWithUnit(totalPrepProfit)}</span></div>
          </div>
        </div>
        <div className="rounded-xl border border-emerald-100 bg-white p-4 shadow-sm">
          <h3 className="mb-4 text-sm font-bold text-emerald-900">أرباح التوصيل</h3>
          <div className="rounded-lg border border-emerald-100 bg-emerald-50 p-3">
            <div className="mb-1 flex items-center justify-between text-xs"><span className="text-slate-500">اليوم:</span><span className="font-bold text-emerald-600">{formatDinarAsAlfWithUnit(todayDeliveryProfit)}</span></div>
            <div className="flex items-center justify-between text-xs"><span className="text-slate-500">الإجمالي:</span><span className="font-bold text-sky-700">{formatDinarAsAlfWithUnit(totalDeliveryProfit)}</span></div>
          </div>
        </div>
        <div className="rounded-xl border border-rose-100 bg-white p-4 shadow-sm">
          <h3 className="mb-4 text-sm font-bold text-rose-900">الإكراميات</h3>
          <div className="rounded-lg border border-rose-100 bg-rose-50 p-3">
            <div className="mb-1 flex items-center justify-between text-xs"><span className="text-slate-500">اليوم:</span><span className="font-bold text-rose-600">{formatDinarAsAlfWithUnit(todayTipsPaid)}</span></div>
            <div className="flex items-center justify-between text-xs"><span className="text-slate-500">الإجمالي:</span><span className="font-bold text-rose-700">{formatDinarAsAlfWithUnit(totalTipsPaid)}</span></div>
          </div>
        </div>
      </div>

      {couriersList.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden mt-2">
          <div className="overflow-x-auto">
            <table className="w-full text-right text-sm text-slate-600">
              <thead className="bg-slate-50 border-b border-slate-100 text-xs font-semibold text-slate-500">
                <tr>
                  <th className="px-4 py-3">المندوب</th>
                  <th className="px-4 py-3 text-center">أرباح اليوم</th>
                  <th className="px-4 py-3 text-center">دفع إكرامية</th>
                  <th className="px-4 py-3 text-center">إكراميات اليوم</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {couriersList.map((c) => (
                  <tr key={c.id} className="transition hover:bg-slate-50">
                    <td className="px-4 py-3 font-bold text-slate-800">{c.name}</td>
                    <td className="px-4 py-3 text-center font-bold text-emerald-600">{formatDinarAsAlfWithUnit(c.todayProfit)}</td>
                    <td className="px-4 py-3 text-center">
                      <form action={payCourierTipAction} className="flex items-center justify-center gap-1">
                        <input type="hidden" name="courierId" value={c.id} />
                        <input type="number" step="any" inputMode="decimal" name="amountAlf" placeholder="0" required className="w-12 rounded border border-amber-200 px-1 py-1 text-xs outline-none" />
                        <button type="submit" className="rounded bg-amber-500 px-2 py-1 text-[10px] font-bold text-white hover:bg-amber-600">دفع</button>
                      </form>
                    </td>
                    <td className="px-4 py-3 text-center font-bold text-rose-600">{formatDinarAsAlfWithUnit(c.todayTips)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}
