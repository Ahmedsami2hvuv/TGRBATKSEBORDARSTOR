import type { CourierWalletMiscDirection } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";
import {
  MONEY_KIND_DELIVERY,
  MONEY_KIND_PICKUP,
} from "@/lib/mandoub-money-events";
import { prisma } from "@/lib/prisma";

export type MandoubMoneySums = {
  sumDeliveryIn: Decimal;
  sumPickupOut: Decimal;
  /** وارد − صادر (قيمة موقّعة: سالبة عندما يتقدّم المندوب للشركة أكثر مما استلم) */
  remainingNet: Decimal;
  pickupEventsAfter: number;
  deliveryEventsAfter: number;
};

/** تجميع صادر/وارد من حركات مسجّلة باسم هذا المندوب فقط (بصمة)، بعد خط التصفير إن وُجد */
export function computeMoneySumsFromCourierEvents(
  events: Array<{
    courierId: string | null;
    kind: string;
    amountDinar: Decimal;
    createdAt: Date;
    recordedByCompanyPreparerId?: string | null;
  }>,
  courierId: string,
  baseline: Date | null,
): MandoubMoneySums {
  let sumDeliveryIn = new Decimal(0);
  let sumPickupOut = new Decimal(0);
  let pickupEventsAfter = 0;
  let deliveryEventsAfter = 0;

  for (const e of events) {
    if (!e.courierId || e.courierId !== courierId) continue;
    // حماية كارثية: إذا كانت الحركة مسجلة بواسطة مجهز، لا تدخل في حسابات المندوب الشخصية
    if (e.recordedByCompanyPreparerId) continue;

    if (baseline && e.createdAt <= baseline) continue;
    if (e.kind === MONEY_KIND_PICKUP) {
      sumPickupOut = sumPickupOut.plus(e.amountDinar);
      pickupEventsAfter++;
    } else if (e.kind === MONEY_KIND_DELIVERY) {
      sumDeliveryIn = sumDeliveryIn.plus(e.amountDinar);
      deliveryEventsAfter++;
    }
  }

  const remainingNet = sumDeliveryIn.minus(sumPickupOut);

  return {
    sumDeliveryIn,
    sumPickupOut,
    remainingNet,
    pickupEventsAfter,
    deliveryEventsAfter,
  };
}

/** يدمج معاملات «أخذت/أعطيت» خارج الطلبات في وارد/صادر المحفظة */
export function mergeMiscWalletIntoSums(
  sums: MandoubMoneySums,
  miscRows: Array<{
    direction: CourierWalletMiscDirection;
    amountDinar: Decimal;
    createdAt: Date;
  }>,
  baseline: Date | null,
): MandoubMoneySums {
  let sumDeliveryIn = sums.sumDeliveryIn;
  let sumPickupOut = sums.sumPickupOut;
  let pickupEventsAfter = sums.pickupEventsAfter;
  let deliveryEventsAfter = sums.deliveryEventsAfter;
  for (const e of miscRows) {
    if (baseline && e.createdAt <= baseline) continue;
    if (e.direction === "take") {
      sumDeliveryIn = sumDeliveryIn.plus(e.amountDinar);
      deliveryEventsAfter++;
    } else if (e.direction === "give") {
      sumPickupOut = sumPickupOut.plus(e.amountDinar);
      pickupEventsAfter++;
    }
  }
  return {
    sumDeliveryIn,
    sumPickupOut,
    remainingNet: sumDeliveryIn.minus(sumPickupOut),
    pickupEventsAfter,
    deliveryEventsAfter,
  };
}

export async function fetchMandoubMoneySumsForCourier(
  courierId: string,
  baseline: Date | null,
): Promise<MandoubMoneySums> {
  // جلب حركات الطلبات الفعلية المسجلة باسم المندوب
  // تم استثناء الحركات التي سجلها المجهز من الـ WHERE لضمان عدم تأثر المحفظة
  const orderEvents = await prisma.orderCourierMoneyEvent.findMany({
    where: {
      courierId,
      deletedAt: null,
      recordedByCompanyPreparerId: null, // استثناء حركات المجهز
      ...(baseline ? { createdAt: { gt: baseline } } : {}),
    },
    select: {
      courierId: true,
      kind: true,
      amountDinar: true,
      createdAt: true,
      recordedByCompanyPreparerId: true,
    },
  });

  const orderSums = computeMoneySumsFromCourierEvents(orderEvents, courierId, baseline);

  const miscRows = await prisma.courierWalletMiscEntry.findMany({
    where: {
      courierId,
      deletedAt: null,
      ...(baseline ? { createdAt: { gt: baseline } } : {}),
    },
    select: {
      direction: true,
      amountDinar: true,
      createdAt: true,
    },
  });

  return mergeMiscWalletIntoSums(orderSums, miscRows, baseline);
}

/** وارد/صادر الطلبات فقط — بدون أخذت/أعطيت المحفظة */
export async function fetchOrderOnlyMoneySumsForCourier(
  courierId: string,
  baseline: Date | null,
): Promise<MandoubMoneySums> {
  const orderEvents = await prisma.orderCourierMoneyEvent.findMany({
    where: {
      courierId,
      deletedAt: null,
      recordedByCompanyPreparerId: null, // استثناء حركات المجهز
      ...(baseline ? { createdAt: { gt: baseline } } : {}),
    },
    select: {
      courierId: true,
      kind: true,
      amountDinar: true,
      createdAt: true,
      recordedByCompanyPreparerId: true,
    },
  });

  return computeMoneySumsFromCourierEvents(orderEvents, courierId, baseline);
}
