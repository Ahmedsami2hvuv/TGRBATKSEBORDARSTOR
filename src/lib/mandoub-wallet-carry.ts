import { Decimal } from "@prisma/client/runtime/library";
import { CourierWalletMiscDirection, WalletPeerPartyKind } from "@prisma/client";
import { MONEY_KIND_DELIVERY, MONEY_KIND_PICKUP } from "@/lib/mandoub-money-events";
import { prisma } from "@/lib/prisma";

/**
 * حساب "مربع الإدارة" (ما بذمة المندوب للشركة).
 * المعادلة: (إجمالي الوارد) - (إجمالي الصادر) - (الأرباح المستحقة) - (التحويلات المقبولة للإدارة).
 */
export async function computeMandoubAdminTotalAllTimeDinar(courierId: string): Promise<Decimal> {
  const [sumOrderWard, sumOrderSader, sumMiscTake, sumMiscGive, earnings, tips, sumTransfersToAdmin] = await Promise.all([
    prisma.orderCourierMoneyEvent.aggregate({
      where: {
        courierId,
        deletedAt: null,
        kind: MONEY_KIND_DELIVERY,
        recordedByCompanyPreparerId: null
      },
      _sum: { amountDinar: true },
    }),
    prisma.orderCourierMoneyEvent.aggregate({
      where: {
        courierId,
        deletedAt: null,
        kind: MONEY_KIND_PICKUP,
        recordedByCompanyPreparerId: null
      },
      _sum: { amountDinar: true },
    }),
    prisma.courierWalletMiscEntry.aggregate({
      where: { courierId, deletedAt: null, direction: CourierWalletMiscDirection.take },
      _sum: { amountDinar: true },
    }),
    prisma.courierWalletMiscEntry.aggregate({
      where: { courierId, deletedAt: null, direction: CourierWalletMiscDirection.give },
      _sum: { amountDinar: true },
    }),
    computeMandoubEarningsAllTimeDinar(courierId),
    computeMandoubTipsAllTimeDinar(courierId),
    // جلب مجموع التحويلات المقبولة التي أرسلها المندوب للإدارة
    prisma.walletPeerTransfer.aggregate({
      where: {
        fromCourierId: courierId,
        toKind: WalletPeerPartyKind.admin,
        status: "accepted"
      },
      _sum: { amountDinar: true }
    })
  ]);

  const ward = (sumOrderWard._sum.amountDinar ?? new Decimal(0)).plus(sumMiscTake._sum.amountDinar ?? new Decimal(0));
  const sader = (sumOrderSader._sum.amountDinar ?? new Decimal(0)).plus(sumMiscGive._sum.amountDinar ?? new Decimal(0));
  const transfers = sumTransfersToAdmin._sum.amountDinar ?? new Decimal(0);

  // الخصم يتم من ذمة الإدارة هنا: نخصم الأرباح (التوصيل) ونخصم الإكراميات أيضاً لأنها ملك المندوب
  return ward.minus(sader).minus(earnings).minus(tips).minus(transfers);
}

/** متبقي المحفظة (الكاش الفعلي من الطلبات) - لا يتأثر بالتحويلات للإدارة */
export async function computeMandoubWalletRemainAllTimeDinar(courierId: string): Promise<Decimal> {
  const [sumOrderWard, sumOrderSader, sumMiscTake, sumMiscGive] = await Promise.all([
    prisma.orderCourierMoneyEvent.aggregate({
      where: {
        courierId,
        deletedAt: null,
        kind: MONEY_KIND_DELIVERY,
        recordedByCompanyPreparerId: null
      },
      _sum: { amountDinar: true }
    }),
    prisma.orderCourierMoneyEvent.aggregate({
      where: {
        courierId,
        deletedAt: null,
        kind: MONEY_KIND_PICKUP,
        recordedByCompanyPreparerId: null
      },
      _sum: { amountDinar: true }
    }),
    prisma.courierWalletMiscEntry.aggregate({
      where: { courierId, deletedAt: null, direction: CourierWalletMiscDirection.take },
      _sum: { amountDinar: true }
    }),
    prisma.courierWalletMiscEntry.aggregate({
      where: { courierId, deletedAt: null, direction: CourierWalletMiscDirection.give },
      _sum: { amountDinar: true }
    }),
  ]);
  const ward = (sumOrderWard._sum.amountDinar ?? new Decimal(0)).plus(sumMiscTake._sum.amountDinar ?? new Decimal(0));
  const sader = (sumOrderSader._sum.amountDinar ?? new Decimal(0)).plus(sumMiscGive._sum.amountDinar ?? new Decimal(0));

  return ward.minus(sader);
}

export function mandoubWalletRemainDinar(
  carryOverDinar: Decimal | null | undefined,
  remainingNetMerged: Decimal,
  pendingIncomingSum: Decimal,
  pendingOutgoingSum: Decimal,
): Decimal {
  const c = carryOverDinar ?? new Decimal(0);
  return c.plus(remainingNetMerged).plus(pendingIncomingSum).minus(pendingOutgoingSum);
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
  const res = await prisma.order.aggregate({
    where: { courierEarningForCourierId: courierId, status: { in: ["delivered", "archived"] } },
    _sum: { courierEarningDinar: true },
  });
  return res._sum.courierEarningDinar ?? new Decimal(0);
}
