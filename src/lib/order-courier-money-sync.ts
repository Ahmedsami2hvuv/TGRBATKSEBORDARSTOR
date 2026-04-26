import { Decimal } from "@prisma/client/runtime/library";
import type { Prisma } from "@prisma/client";
import { computeCourierDeliveryEarningDinar } from "@/lib/courier-earnings";
import {
  dinarAmountsMatchExpected,
  MONEY_KIND_DELIVERY,
  MONEY_KIND_PICKUP,
} from "@/lib/mandoub-money-events";
import { computeDeliveryPriceFromRegions } from "@/lib/order-delivery-compute";
import { prisma } from "@/lib/prisma";

/** يحدّث المبلغ المتوقع في حركات الصادر/الوارد بعد تغيير أسعار الطلب. */
export async function syncOrderCourierMoneyExpectations(
  tx: Prisma.TransactionClient,
  orderId: string,
): Promise<void> {
  const order = await tx.order.findUnique({
    where: { id: orderId },
    include: {
      moneyEvents: { where: { deletedAt: null }, orderBy: { createdAt: "asc" } },
    },
  });
  if (!order) return;

  const pickupExpected =
    order.orderSubtotal != null ? order.orderSubtotal : null;
  const deliveryExpected =
    order.totalAmount != null ? order.totalAmount : null;

  const sorted = [...order.moneyEvents].sort((a, b) => {
    const t = a.createdAt.getTime() - b.createdAt.getTime();
    if (t !== 0) return t;
    return a.id.localeCompare(b.id);
  });

  let pickupCum = new Decimal(0);
  let deliveryCum = new Decimal(0);

  for (const ev of sorted) {
    let expected: Decimal | null = null;
    let cumulativeAfter: Decimal;

    if (ev.kind === MONEY_KIND_PICKUP) {
      expected = pickupExpected;
      pickupCum = pickupCum.plus(ev.amountDinar);
      cumulativeAfter = pickupCum;
    } else if (ev.kind === MONEY_KIND_DELIVERY) {
      expected = deliveryExpected;
      deliveryCum = deliveryCum.plus(ev.amountDinar);
      cumulativeAfter = deliveryCum;
    } else {
      continue;
    }

    if (expected == null) continue;

    await tx.orderCourierMoneyEvent.update({
      where: { id: ev.id },
      data: {
        expectedDinar: expected,
        matchesExpected: dinarAmountsMatchExpected(cumulativeAfter, expected),
      },
    });
  }
}

/** إعادة حساب التوصيل والمجموع وأجر المندوب لكل طلب يستخدم هذه المنطقة (بعد تعديل سعر المنطقة). */
export async function resyncOrdersAfterRegionPriceChange(
  regionId: string,
): Promise<{ updated: number }> {
  const orders = await prisma.order.findMany({
    where: {
      OR: [{ customerRegionId: regionId }, { secondCustomerRegionId: regionId }],
    },
    select: { id: true },
  });

  let updated = 0;
  for (const { id } of orders) {
    await prisma.$transaction(async (tx) => {
      const o = await tx.order.findUnique({
        where: { id },
        include: {
          shop: { include: { region: true } },
          customerRegion: true,
          secondCustomerRegion: true,
        },
      });
      if (!o?.customerRegion || !o.shop?.region) {
        return;
      }

      const delivery = computeDeliveryPriceFromRegions({
        shopRegionDelivery: o.shop.region.deliveryPrice,
        customerRegionDelivery: o.customerRegion.deliveryPrice,
        secondRegionDelivery: o.secondCustomerRegion?.deliveryPrice ?? null,
        routeMode: o.routeMode,
      });

      const sub = o.orderSubtotal;
      const total = sub != null ? sub.plus(delivery) : null;

      const data: Prisma.OrderUncheckedUpdateInput = {
        deliveryPrice: delivery,
        totalAmount: total,
      };

      const deliveryEv = await tx.orderCourierMoneyEvent.findFirst({
        where: {
          orderId: o.id,
          kind: MONEY_KIND_DELIVERY,
          deletedAt: null,
        },
        orderBy: { createdAt: "desc" },
      });
      const earningCourierId = deliveryEv?.courierId ?? o.assignedCourierId;
      if (o.status === "delivered" && earningCourierId && delivery != null) {
        const courier = await tx.courier.findUnique({
          where: { id: earningCourierId },
        });
        if (courier) {
          const earning = computeCourierDeliveryEarningDinar(
            courier.vehicleType,
            delivery,
          );
          data.courierEarningDinar = earning;
          data.courierEarningForCourierId =
            earning != null ? earningCourierId : null;
        }
      }

      await tx.order.update({
        where: { id: o.id },
        data,
      });

      await syncOrderCourierMoneyExpectations(tx, o.id);
    });
    updated += 1;
  }

  return { updated };
}
