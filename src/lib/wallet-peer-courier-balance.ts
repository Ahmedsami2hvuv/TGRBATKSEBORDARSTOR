import { Decimal } from "@prisma/client/runtime/library";
import { computeMandoubWalletRemainAllTimeDinar } from "@/lib/mandoub-wallet-carry";
import { prisma } from "@/lib/prisma";
import { sumPendingOutgoingForCourier } from "@/lib/wallet-peer-transfer";

/** متبقي المحفظة كما في صفحة المندوب + المبلغ المتاح للتحويل بعد خصم التحويلات المعلّقة */
export async function getCourierWalletRemainAndTransferAvailability(courierId: string): Promise<{
  walletRemain: Decimal;
  pendingOutgoing: Decimal;
  availableForTransfer: Decimal;
}> {
  const courier = await prisma.courier.findUnique({
    where: { id: courierId },
    select: { id: true },
  });
  if (!courier) {
    return {
      walletRemain: new Decimal(0),
      pendingOutgoing: new Decimal(0),
      availableForTransfer: new Decimal(0),
    };
  }
  const [pendingOutgoing, walletRemainAll] = await Promise.all([
    sumPendingOutgoingForCourier(courierId),
    computeMandoubWalletRemainAllTimeDinar(courierId),
  ]);
  return {
    walletRemain: walletRemainAll,
    pendingOutgoing,
    /** متاح للتحويل = الرصيد المؤكد − التحويلات المعلّقة الصادرة */
    availableForTransfer: walletRemainAll.minus(pendingOutgoing),
  };
}
