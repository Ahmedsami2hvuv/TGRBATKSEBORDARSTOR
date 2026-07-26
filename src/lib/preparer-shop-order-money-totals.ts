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

/**
 * مزامنة تلقائية: أي طلبية مجهزة (submittedByCompanyPreparerId != null) ولها سعر orderSubtotal > 0
 * ولم يُسجل لها معاملة صادر (pickup_out) باسم المجهز، يتم إنشاؤها فوراً في قاعدة البيانات.
 * تنبيه هامي: يتم استبعاد طلبيات الدين (orderType: "دين") نهائياً لأنها ليست تسديداً مالياً صادراً من المجهز للمحل.
 */
export async function ensureMissingPreparerMoneyEvents(preparerId?: string, shopId?: string) {
  try {
    // 1. تنظيف وتصفية أي معاملات تسديد آلي خاطئة سابقة تم إنشاؤها لطلبيات من نوع "دين"
    await prisma.orderCourierMoneyEvent.updateMany({
      where: {
        deletedAt: null,
        kind: MONEY_KIND_PICKUP,
        order: {
          OR: [
            { orderType: { contains: "دين" } },
            { summary: { contains: "دين تم تسجيله بواسطة المجهز" } },
          ],
        },
      },
      data: {
        deletedAt: new Date(),
        deletedReason: "manual_admin",
        deletedByDisplayName: "نظام التصحيح الآلي لطلبيات الدين",
        mismatchNote: "حذف آلي لمعاملة تسديد غير صحيحة لطلب دين",
      },
    });

    // 2. المزامنة فقط للطلبيات العادية واستبعاد طلبيات الدين كلياً
    const whereCondition: any = {
      submittedByCompanyPreparerId: preparerId ? preparerId : { not: null },
      orderSubtotal: { gt: 0 },
      AND: [
        { orderType: { notIn: ["دين", "دين محلي", "دين محل"] } },
        { orderType: { not: { contains: "دين" } } },
        { summary: { not: { contains: "دين تم تسجيله بواسطة المجهز" } } },
      ],
      ...(shopId ? { shopId } : {}),
    };

    const preparerOrders = await prisma.order.findMany({
      where: whereCondition,
      select: {
        id: true,
        orderSubtotal: true,
        submittedByCompanyPreparerId: true,
        moneyEvents: {
          where: {
            kind: MONEY_KIND_PICKUP,
            deletedAt: null,
          },
          select: {
            id: true,
            recordedByCompanyPreparerId: true,
          },
        },
      },
    });

    for (const order of preparerOrders) {
      const pId = order.submittedByCompanyPreparerId;
      if (!pId) continue;

      const hasPreparerPickup = order.moneyEvents.some(
        (me) => me.recordedByCompanyPreparerId === pId
      );

      if (!hasPreparerPickup && order.orderSubtotal) {
        await prisma.orderCourierMoneyEvent.create({
          data: {
            orderId: order.id,
            amountDinar: order.orderSubtotal,
            kind: MONEY_KIND_PICKUP,
            recordedByCompanyPreparerId: pId,
            expectedDinar: order.orderSubtotal,
            matchesExpected: true,
            mismatchReason: "",
            mismatchNote: "تسديد صادر آلي من المجهز عند المزامنة",
          },
        });
      }
    }
  } catch (err) {
    console.error("ensureMissingPreparerMoneyEvents error:", err);
  }
}


