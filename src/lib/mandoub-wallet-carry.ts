import { Decimal } from "@prisma/client/runtime/library";
import { CourierWalletMiscDirection, WalletPeerPartyKind } from "@prisma/client";
import { MONEY_KIND_DELIVERY, MONEY_KIND_PICKUP } from "@/lib/mandoub-money-events";
import { prisma } from "@/lib/prisma";
import { computeCourierDeliveryEarningDinar } from "@/lib/courier-earnings";

/**
 * حساب "مربع الإدارة" (ما بذمة المندوب للشركة).
 * المعادلة: (إجمالي الوارد) - (إجمالي الصادر) - (الأرباح المستحقة) - (التحويلات المقبولة للإدارة).
 */
export async function computeMandoubAdminTotalAllTimeDinar(courierId: string): Promise<Decimal> {
  const [orderSums, miscGroups, earnings, sumTransfersToAdmin, tipsTakeRes] = await Promise.all([
    prisma.orderCourierMoneyEvent.groupBy({
      by: ['kind'],
      where: {
        courierId,
        deletedAt: null,
        recordedByCompanyPreparerId: null
      },
      _sum: { amountDinar: true },
    }),
    prisma.courierWalletMiscEntry.groupBy({
      by: ['direction'],
      where: { courierId, deletedAt: null },
      _sum: { amountDinar: true },
    }),
    computeMandoubEarningsAllTimeDinar(courierId),
    // جلب مجموع التحويلات المقبولة التي أرسلها المندوب للإدارة
    prisma.walletPeerTransfer.aggregate({
      where: {
        fromCourierId: courierId,
        toKind: WalletPeerPartyKind.admin,
        status: "accepted"
      },
      _sum: { amountDinar: true }
    }),
    prisma.courierWalletMiscEntry.aggregate({
      where: { courierId, deletedAt: null, direction: CourierWalletMiscDirection.take, label: { contains: "[إكرامية]" } },
      _sum: { amountDinar: true }
    })
  ]);

  const sumOrderWard = orderSums.find(g => g.kind === MONEY_KIND_DELIVERY)?._sum.amountDinar ?? new Decimal(0);
  const sumOrderSader = orderSums.find(g => g.kind === MONEY_KIND_PICKUP)?._sum.amountDinar ?? new Decimal(0);

  const sumMiscTake = miscGroups.find(g => g.direction === CourierWalletMiscDirection.take)?._sum.amountDinar ?? new Decimal(0);
  const sumMiscGive = miscGroups.find(g => g.direction === CourierWalletMiscDirection.give)?._sum.amountDinar ?? new Decimal(0);

  const ward = sumOrderWard.plus(sumMiscTake);
  const sader = sumOrderSader.plus(sumMiscGive);
  const transfers = sumTransfersToAdmin._sum.amountDinar ?? new Decimal(0);

  const tipsTakeDinar = tipsTakeRes._sum.amountDinar ?? new Decimal(0);

  // الخصم يتم من ذمة الإدارة هنا: نخصم الأرباح (التوصيل) ونخصم الإكراميات التي نوعها take لأنها تزيد الوارد. أما give فمخصومة مسبقاً من الصادر.
  return ward.minus(sader).minus(earnings).minus(tipsTakeDinar).minus(transfers);
}

/** متبقي المحفظة (الكاش الفعلي من الطلبات) - لا يتأثر بالتحويلات للإدارة */
export async function computeMandoubWalletRemainAllTimeDinar(courierId: string): Promise<Decimal> {
  const [orderSums, miscGroups] = await Promise.all([
    prisma.orderCourierMoneyEvent.groupBy({
      by: ['kind'],
      where: {
        courierId,
        deletedAt: null,
        recordedByCompanyPreparerId: null
      },
      _sum: { amountDinar: true }
    }),
    prisma.courierWalletMiscEntry.groupBy({
      by: ['direction'],
      where: { courierId, deletedAt: null },
      _sum: { amountDinar: true }
    }),
  ]);

  const sumOrderWard = orderSums.find(g => g.kind === MONEY_KIND_DELIVERY)?._sum.amountDinar ?? new Decimal(0);
  const sumOrderSader = orderSums.find(g => g.kind === MONEY_KIND_PICKUP)?._sum.amountDinar ?? new Decimal(0);

  const sumMiscTake = miscGroups.find(g => g.direction === CourierWalletMiscDirection.take)?._sum.amountDinar ?? new Decimal(0);
  const sumMiscGive = miscGroups.find(g => g.direction === CourierWalletMiscDirection.give)?._sum.amountDinar ?? new Decimal(0);

  const ward = sumOrderWard.plus(sumMiscTake);
  const sader = sumOrderSader.plus(sumMiscGive);

  return ward.minus(sader);
}


export function mandoubWalletRemainDinar(
  carryOverDinar: Decimal | null | undefined,
  remainingNetMerged: Decimal,
  _pendingIncomingSum: Decimal, // تم إهمالها بناءً على طلب المستخدم: لا يضاف التحويل إلا بعد القبول
  pendingOutgoingSum: Decimal,
): Decimal {
  const c = carryOverDinar ?? new Decimal(0);
  // الرصيد الفعلي هو الرصيد الصافي المدمج + المبلغ المدور - الحوالات التي أرسلها المندوب ولم تقبل بعد (لأنها خرجت من يده)
  return c.plus(remainingNetMerged).minus(pendingOutgoingSum);
}

export function mandoubHandToAdminDinar(walletRemain: Decimal, sumEarnings: Decimal): Decimal {
  return walletRemain.minus(sumEarnings);
}

export async function computeMandoubTipsAllTimeDinar(courierId: string): Promise<Decimal> {
  const res = await prisma.courierWalletMiscEntry.aggregate({
    where: {
      courierId,
      deletedAt: null,
      label: { contains: "[إكرامية]" }
    },
    _sum: { amountDinar: true }
  });
  return res._sum.amountDinar ?? new Decimal(0);
}

export async function computeMandoubEarningsAllTimeDinar(courierId: string): Promise<Decimal> {
  const agg = await prisma.order.aggregate({
    where: {
      status: { in: ["delivered", "archived"] },
      courierEarningForCourierId: courierId,
      courierEarningDinar: { not: null }
    },
    _sum: {
      courierEarningDinar: true
    }
  });
  return agg._sum.courierEarningDinar ?? new Decimal(0);
}
