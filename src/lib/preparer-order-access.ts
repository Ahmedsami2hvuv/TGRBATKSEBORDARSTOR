import { prisma } from "@/lib/prisma";

/** يتحقق أن المجهز نشط ومربوط بالمحل (أي صلاحية متابعة) */
export async function preparerHasShopAccess(
  preparerId: string,
  shopId: string,
): Promise<boolean> {
  const row = await prisma.preparerShop.findUnique({
    where: {
      preparerId_shopId: { preparerId, shopId },
    },
  });
  return Boolean(row);
}

export async function preparerCanSubmitForShop(
  preparerId: string,
  shopId: string,
): Promise<boolean> {
  const row = await prisma.preparerShop.findUnique({
    where: {
      preparerId_shopId: { preparerId, shopId },
    },
  });
  return Boolean(row?.canSubmitOrders);
}
