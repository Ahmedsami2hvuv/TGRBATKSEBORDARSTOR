import type { Prisma } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";
import { computeCourierDeliveryEarningDinar } from "@/lib/courier-earnings";
import {
  MONEY_KIND_DELIVERY,
  MONEY_KIND_PICKUP,
} from "@/lib/mandoub-money-events";

/**
 * يضبط حالة الطلب وأجر المندوب بحسب وجود صادر/وارد فعّالين (بعد حذف ناعم لمعاملة).
 */
export async function syncOrderStatusFromActiveMoneyEvents(
  tx: Prisma.TransactionClient,
  orderId: string,
): Promise<void> {
  const order = await tx.order.findUnique({ where: { id: orderId } });
  if (!order) return;

  const hasPickup = await tx.orderCourierMoneyEvent.findFirst({
    where: { orderId, kind: MONEY_KIND_PICKUP, deletedAt: null },
  });
  const hasDelivery = await tx.orderCourierMoneyEvent.findFirst({
    where: { orderId, kind: MONEY_KIND_DELIVERY, deletedAt: null },
  });

  if (hasPickup && hasDelivery) {
    // صاحب أجر التوصيل: المندوب الذي سجّل حركة الوارد، وليس بالضرورة المسند حالياً.
    const deliveryCourierId = hasDelivery.courierId;
    let earning: Decimal | null = order.courierEarningDinar;
    let earningFor: string | null = order.courierEarningForCourierId;
    if (deliveryCourierId) {
      const courier = await tx.courier.findUnique({
        where: { id: deliveryCourierId },
      });
      if (courier && order.deliveryPrice != null) {
        const computed = computeCourierDeliveryEarningDinar(
          courier.vehicleType,
          order.deliveryPrice,
        );
        if (computed != null) {
          earning = computed;
          earningFor = deliveryCourierId;
        }
      }
    }
    await tx.order.update({
      where: { id: orderId },
      data: {
        status: "delivered",
        courierEarningDinar: earning,
        courierEarningForCourierId: earningFor,
      },
    });
    return;
  }

  if (hasPickup && !hasDelivery) {
    await tx.order.update({
      where: { id: orderId },
      data: {
        status: "delivering",
      },
    });
    return;
  }

  if (!hasPickup && hasDelivery) {
    // وارد بدون صادر (بيانات نادرة) — أقرب حالة قبل «تم التسليم» الكامل
    await tx.order.update({
      where: { id: orderId },
      data: {
        status: "delivering",
      },
    });
    return;
  }

  await tx.order.update({
    where: { id: orderId },
    data: {
      status: "assigned",
    },
  });
}
