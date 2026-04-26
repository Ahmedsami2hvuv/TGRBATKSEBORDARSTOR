import { Decimal } from "@prisma/client/runtime/library";
import { MONEY_KIND_DELIVERY, MONEY_KIND_PICKUP } from "@/lib/mandoub-money-events";
import { prisma } from "@/lib/prisma";

/** مجموع وارد/صادر من حركات الطلبات (OrderCourierMoneyEvent) لكل الطلبات التي تخص محلات محددة. */
export async function sumOrderMoneyEventsForShopIds(
  shopIds: string[],
  preparerId: string,
): Promise<{
  sumDeliveryIn: Decimal;
  sumPickupOut: Decimal;
  remainingNet: Decimal;
}> {
  if (shopIds.length === 0 || !preparerId.trim()) {
    const z = new Decimal(0);
    return { sumDeliveryIn: z, sumPickupOut: z, remainingNet: z };
  }

  const shopFilter = { shopId: { in: shopIds } };

  const [pickupAgg, deliveryAgg] = await Promise.all([
    prisma.orderCourierMoneyEvent.aggregate({
      where: {
        deletedAt: null,
        kind: MONEY_KIND_PICKUP,
        order: shopFilter,
        recordedByCompanyPreparerId: preparerId,
      },
      _sum: { amountDinar: true },
    }),
    prisma.orderCourierMoneyEvent.aggregate({
      where: {
        deletedAt: null,
        kind: MONEY_KIND_DELIVERY,
        order: shopFilter,
        recordedByCompanyPreparerId: preparerId,
      },
      _sum: { amountDinar: true },
    }),
  ]);

  const sumPickupOut = pickupAgg._sum.amountDinar ?? new Decimal(0);
  const sumDeliveryIn = deliveryAgg._sum.amountDinar ?? new Decimal(0);
  return {
    sumDeliveryIn,
    sumPickupOut,
    remainingNet: sumDeliveryIn.minus(sumPickupOut),
  };
}
