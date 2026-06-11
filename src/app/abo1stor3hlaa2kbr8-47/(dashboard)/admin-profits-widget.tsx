import { prisma } from "@/lib/prisma";
import { formatDinarAsAlfWithUnit } from "@/lib/money-alf";
import { Decimal } from "@prisma/client/runtime/library";
import { AdminProfitsClientContent } from "./admin-profits-client-content";

const ALF_PER_DINAR = 1;

function numOrZero(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function formatYMDLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const r = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${r}`;
}

export async function AdminProfitsWidget({ selectedDay }: { selectedDay?: string }) {
  // --- احتساب التواريخ لنوبة العمل (تبدأ 6:00 صباحاً وتنتهي 5:59:59 صباحاً اليوم التالي) ---
  let from: Date;
  let defaultDayString: string;

  const now = new Date();
  let shiftStartToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 6, 0, 0, 0);
  if (now < shiftStartToday) {
    shiftStartToday.setDate(shiftStartToday.getDate() - 1);
  }
  defaultDayString = formatYMDLocal(shiftStartToday);

  const activeDayString = (selectedDay && /^\d{4}-\d{2}-\d{2}$/.test(selectedDay)) ? selectedDay : defaultDayString;
  const parts = activeDayString.split("-").map(Number);
  from = new Date(parts[0], parts[1] - 1, parts[2], 6, 0, 0, 0);

  const to = new Date(from);
  to.setDate(to.getDate() + 1);
  to.setMilliseconds(to.getMilliseconds() - 1);

  // --- جلب البيانات ---
  const [orders, allTips, allTimeOrders, allTimeTips] = await Promise.all([
    // طلبات اليوم المختار
    prisma.order.findMany({
      where: {
        status: "delivered",
        createdAt: { gte: from, lte: to }
      },
      select: {
        deliveryPrice: true,
        courierEarningDinar: true,
        createdAt: true,
        preparerShoppingJson: true,
        submittedByCompanyPreparerId: true,
        courier: { select: { id: true, name: true, zeroEarning: true, vehicleType: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    // إكراميات اليوم المختار
    prisma.courierWalletMiscEntry.findMany({
      where: {
        label: { contains: "[إكرامية]" },
        deletedAt: null,
        createdAt: { gte: from, lte: to }
      },
      select: { amountDinar: true, createdAt: true, courierId: true }
    }),
    // إحصاءات تاريخية سريعة (شاملة)
    prisma.order.findMany({
      where: { status: "delivered" },
      select: {
        deliveryPrice: true,
        courierEarningDinar: true,
        preparerShoppingJson: true,
        submittedByCompanyPreparerId: true,
        courier: { select: { zeroEarning: true, vehicleType: true } }
      }
    }),
    prisma.courierWalletMiscEntry.findMany({
      where: {
        label: { contains: "[إكرامية]" },
        deletedAt: null
      },
      select: { amountDinar: true }
    })
  ]);

  // --- حسابات اليوم المختار ---
  let todayDeliveryProfit = new Decimal(0);
  let todayPrepProfit = new Decimal(0);
  let todayPrepProductsProfit = new Decimal(0);
  let todayPrepWagesProfit = new Decimal(0);
  let todayTipsPaid = new Decimal(0);

  const courierStats: Record<
    string,
    { id: string; name: string; todayProfit: Decimal; todayTips: Decimal }
  > = {};

  for (const t of allTips) {
    todayTipsPaid = todayTipsPaid.plus(t.amountDinar);

    if (!courierStats[t.courierId]) {
      courierStats[t.courierId] = {
        id: t.courierId,
        name: "مندوب",
        todayProfit: new Decimal(0),
        todayTips: new Decimal(0),
      };
    }
    courierStats[t.courierId].todayTips = courierStats[t.courierId].todayTips.plus(t.amountDinar);
  }

  for (const o of orders) {
    if (o.deliveryPrice) {
      let p = new Decimal(0);
      if (o.courier) {
        if (o.courier.zeroEarning) {
          p = o.deliveryPrice;
        } else {
          if (o.courierEarningDinar != null) {
            p = o.deliveryPrice.minus(o.courierEarningDinar);
          } else {
            const vehicle = o.courier.vehicleType || "car";
            const earning = vehicle === "bike"
              ? o.deliveryPrice.div(2)
              : o.deliveryPrice.mul(2).div(3);
            p = o.deliveryPrice.minus(earning);
          }
        }
      } else {
        if (o.courierEarningDinar != null) {
          p = o.deliveryPrice.minus(o.courierEarningDinar);
        } else {
          p = o.deliveryPrice;
        }
      }
      todayDeliveryProfit = todayDeliveryProfit.plus(p);

      if (o.courier) {
        if (!courierStats[o.courier.id]) {
          courierStats[o.courier.id] = {
            id: o.courier.id,
            name: o.courier.name,
            todayProfit: new Decimal(0),
            todayTips: new Decimal(0),
          };
        }
        courierStats[o.courier.id].name = o.courier.name;
        courierStats[o.courier.id].todayProfit = courierStats[o.courier.id].todayProfit.plus(p);
      }
    }

    if (o.submittedByCompanyPreparerId && o.preparerShoppingJson) {
      const j = o.preparerShoppingJson as any;
      const productsProfitDinar = new Decimal(numOrZero(j?.sumSellAlf - j?.sumBuyAlf) * ALF_PER_DINAR);
      const wagesProfitDinar = new Decimal(numOrZero(j?.extraAlf) * ALF_PER_DINAR);
      const profitDinar = productsProfitDinar.plus(wagesProfitDinar);

      todayPrepProfit = todayPrepProfit.plus(profitDinar);
      todayPrepProductsProfit = todayPrepProductsProfit.plus(productsProfitDinar);
      todayPrepWagesProfit = todayPrepWagesProfit.plus(wagesProfitDinar);
    }
  }

  // --- حسابات الإجمالي الشامل ---
  let totalDeliveryProfit = new Decimal(0);
  let totalPrepProfit = new Decimal(0);
  let totalTipsPaid = new Decimal(0);

  for (const t of allTimeTips) {
    totalTipsPaid = totalTipsPaid.plus(t.amountDinar);
  }

  for (const o of allTimeOrders) {
    if (o.deliveryPrice) {
      let p = new Decimal(0);
      if (o.courier) {
        if (o.courier.zeroEarning) {
          p = o.deliveryPrice;
        } else {
          if (o.courierEarningDinar != null) {
            p = o.deliveryPrice.minus(o.courierEarningDinar);
          } else {
            const vehicle = o.courier.vehicleType || "car";
            const earning = vehicle === "bike"
              ? o.deliveryPrice.div(2)
              : o.deliveryPrice.mul(2).div(3);
            p = o.deliveryPrice.minus(earning);
          }
        }
      } else {
        if (o.courierEarningDinar != null) {
          p = o.deliveryPrice.minus(o.courierEarningDinar);
        } else {
          p = o.deliveryPrice;
        }
      }
      totalDeliveryProfit = totalDeliveryProfit.plus(p);
    }

    if (o.submittedByCompanyPreparerId && o.preparerShoppingJson) {
      const j = o.preparerShoppingJson as any;
      const productsProfitDinar = new Decimal(numOrZero(j?.sumSellAlf - j?.sumBuyAlf) * ALF_PER_DINAR);
      const wagesProfitDinar = new Decimal(numOrZero(j?.extraAlf) * ALF_PER_DINAR);
      const profitDinar = productsProfitDinar.plus(wagesProfitDinar);
      totalPrepProfit = totalPrepProfit.plus(profitDinar);
    }
  }

  const todayGross = todayDeliveryProfit.plus(todayPrepProfit);
  const allTimeGross = totalDeliveryProfit.plus(totalPrepProfit);
  const todayNet = todayGross.minus(todayTipsPaid);
  const allTimeNet = allTimeGross.minus(totalTipsPaid);

  const couriersList = Object.values(courierStats).sort((a, b) => b.todayProfit.cmp(a.todayProfit));

  const data = {
    selectedDay: activeDayString,
    todayNet: todayNet.toNumber(),
    allTimeNet: allTimeNet.toNumber(),
    todayPrepProfit: todayPrepProfit.toNumber(),
    totalPrepProfit: totalPrepProfit.toNumber(),
    todayDeliveryProfit: todayDeliveryProfit.toNumber(),
    totalDeliveryProfit: totalDeliveryProfit.toNumber(),
    todayTipsPaid: todayTipsPaid.toNumber(),
    totalTipsPaid: totalTipsPaid.toNumber(),
    couriersList: couriersList.map(c => ({
      id: c.id,
      name: c.name,
      todayProfit: c.todayProfit.toNumber(),
      todayTips: c.todayTips.toNumber()
    }))
  };

  return (
    <AdminProfitsClientContent {...data} />
  );
}
