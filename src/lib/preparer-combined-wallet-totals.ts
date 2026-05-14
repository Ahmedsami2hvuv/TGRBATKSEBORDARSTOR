import { Decimal } from "@prisma/client/runtime/library";
import { prisma } from "@/lib/prisma";
import {
  sumMiscGiveForEmployee,
  sumMiscTakeForEmployee,
  sumPendingIncomingForEmployee,
  sumPendingOutgoingForEmployee,
} from "@/lib/wallet-peer-transfer";
import { sumOrderMoneyEventsForShopIds } from "@/lib/preparer-shop-order-money-totals";

/**
 * وارد/صادر/متبقي للمجهز: حركات طلبات محلاته + أخذت/أعطيت + تحويلات معلّقة (نفس منطق المندوب).
 */
export async function getPreparerMoneyTotals(preparerId: string): Promise<{
  ward: Decimal;
  sader: Decimal;
  remain: Decimal;
} | null> {
  const preparer = await prisma.companyPreparer.findFirst({
    where: { id: preparerId, active: true },
    select: {
      shopLinks: { select: { shopId: true } },
      walletEmployeeId: true,
    },
  });
  if (!preparer) return null;

  const shopIds = preparer.shopLinks.map((l) => l.shopId);
  const orderSums = await sumOrderMoneyEventsForShopIds(shopIds, preparerId);

  let ward = orderSums.sumDeliveryIn;
  let sader = orderSums.sumPickupOut;
  let pendingOutgoing = new Decimal(0);

  const wid = preparer.walletEmployeeId;
  if (wid) {
    const [miscTake, miscGive, pOut] = await Promise.all([
      sumMiscTakeForEmployee(wid),
      sumMiscGiveForEmployee(wid),
      sumPendingOutgoingForEmployee(wid),
    ]);
    ward = ward.plus(miscTake);
    sader = sader.plus(miscGive);
    pendingOutgoing = pOut;
  }

  return {
    ward,
    sader,
    remain: ward.minus(sader).minus(pendingOutgoing),
  };
}
