import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export const mandoubOrderDetailInclude = {
  shop: { include: { region: true } },
  customerRegion: true,
  secondCustomerRegion: true,
  submittedBy: { select: { phone: true, name: true } },
  submittedByCompanyPreparer: { select: { phone: true, name: true } },
  customer: {
    select: {
      id: true,
      customerDoorPhotoUrl: true,
      customerLocationUrl: true,
      customerLandmark: true,
      alternatePhone: true,
    },
  },
  courier: { select: { name: true, phone: true, vehicleType: true } },
  moneyEvents: {
    orderBy: { createdAt: "asc" as const },
    include: {
      courier: { select: { name: true } },
      recordedByCompanyPreparer: { select: { name: true } },
    },
  },
} satisfies Prisma.OrderInclude;

export type MandoubOrderDetailPayload = Prisma.OrderGetPayload<{
  include: typeof mandoubOrderDetailInclude;
}>;

export async function findMandoubOrderForCourier(
  orderId: string,
  courierId: string,
): Promise<MandoubOrderDetailPayload | null> {
  return prisma.order.findFirst({
    where: {
      id: orderId,
      status: { in: ["assigned", "delivering", "delivered"] },
      OR: [
        { assignedCourierId: courierId },
        { courierEarningForCourierId: courierId },
      ],
    },
    include: mandoubOrderDetailInclude,
  });
}
