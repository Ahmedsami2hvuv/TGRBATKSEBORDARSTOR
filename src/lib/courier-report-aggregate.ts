import { Decimal } from "@prisma/client/runtime/library";
import {
  MONEY_KIND_DELIVERY,
  MONEY_KIND_PICKUP,
} from "@/lib/mandoub-money-events";
import { formatDinarAsAlf } from "@/lib/money-alf";
import { prisma } from "@/lib/prisma";

export type CourierReportSummaryRow = {
  courierId: string;
  name: string;
  phone: string;
  /** وارد — استلام من الزبون (delivery_in) */
  incomingAlf: string;
  /** صادر — تسليم للعميل (pickup_out) */
  outgoingAlf: string;
  ordersCount: number;
  /** جمع كلفة التوصيل من الطلبات في النطاق */
  deliveryFeesAlf: string;
  /** أجر التوصيل المستحق (طلبات مُسلَّمة ضمن النطاق) */
  earningAlf: string;
};

function sumToAlf(v: Decimal | null | undefined): string {
  if (v == null) return "—";
  return formatDinarAsAlf(v);
}

export async function getCourierReportSummary(
  from: Date,
  to: Date,
): Promise<CourierReportSummaryRow[]> {
  const couriers = await prisma.courier.findMany({
    where: { blocked: false },
    orderBy: { name: "asc" },
    select: { id: true, name: true, phone: true },
  });
  const ids = couriers.map((c) => c.id);
  if (ids.length === 0) return [];

  const [pickupGroups, deliveryGroups, orderGroups, earningGroups] = await Promise.all([
    prisma.orderCourierMoneyEvent.groupBy({
      by: ["courierId"],
      where: {
        courierId: { in: ids },
        kind: MONEY_KIND_PICKUP,
        deletedAt: null,
        createdAt: { gte: from, lte: to },
      },
      _sum: { amountDinar: true },
    }),
    prisma.orderCourierMoneyEvent.groupBy({
      by: ["courierId"],
      where: {
        courierId: { in: ids },
        kind: MONEY_KIND_DELIVERY,
        deletedAt: null,
        createdAt: { gte: from, lte: to },
      },
      _sum: { amountDinar: true },
    }),
    prisma.order.groupBy({
      by: ["assignedCourierId"],
      where: {
        assignedCourierId: { in: ids },
        createdAt: { gte: from, lte: to },
      },
      _count: { id: true },
      _sum: { deliveryPrice: true },
    }),
    prisma.order.groupBy({
      by: ["assignedCourierId"],
      where: {
        assignedCourierId: { in: ids },
        createdAt: { gte: from, lte: to },
        status: "delivered",
        courierEarningDinar: { not: null },
      },
      _sum: { courierEarningDinar: true },
    }),
  ]);

  const pickupMap = new Map(
    pickupGroups.map((g) => [g.courierId, g._sum.amountDinar]),
  );
  const deliveryMap = new Map(
    deliveryGroups.map((g) => [g.courierId, g._sum.amountDinar]),
  );
  const orderMap = new Map(
    orderGroups.map((g) => [
      g.assignedCourierId as string,
      { count: g._count.id, delivery: g._sum.deliveryPrice },
    ]),
  );
  const earningMap = new Map(
    earningGroups.map((g) => [g.assignedCourierId as string, g._sum.courierEarningDinar]),
  );

  return couriers.map((c) => {
    const og = orderMap.get(c.id);
    return {
      courierId: c.id,
      name: c.name,
      phone: c.phone,
      incomingAlf: sumToAlf(deliveryMap.get(c.id)),
      outgoingAlf: sumToAlf(pickupMap.get(c.id)),
      ordersCount: og?.count ?? 0,
      deliveryFeesAlf: sumToAlf(og?.delivery),
      earningAlf: sumToAlf(earningMap.get(c.id)),
    };
  });
}
