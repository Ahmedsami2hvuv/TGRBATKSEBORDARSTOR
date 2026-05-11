import { prisma } from "@/lib/prisma";
import { formatDinarAsAlfWithUnit } from "@/lib/money-alf";
import { Decimal } from "@prisma/client/runtime/library";
import { payCourierTipAction } from "./couriers/tip-actions";
import { AdminProfitsClientContent } from "./admin-profits-client-content";

const ALF_PER_DINAR = 1;

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
    <AdminProfitsClientContent
      todayNet={todayNet.toNumber()}
      allTimeNet={allTimeNet.toNumber()}
      todayPrepProfit={todayPrepProfit.toNumber()}
      totalPrepProfit={totalPrepProfit.toNumber()}
      todayDeliveryProfit={todayDeliveryProfit.toNumber()}
      totalDeliveryProfit={totalDeliveryProfit.toNumber()}
      todayTipsPaid={todayTipsPaid.toNumber()}
      totalTipsPaid={totalTipsPaid.toNumber()}
      couriersList={couriersList.map(c => ({
        id: c.id,
        name: c.name,
        todayProfit: c.todayProfit.toNumber(),
        todayTips: c.todayTips.toNumber()
      }))}
    />
  );
}
