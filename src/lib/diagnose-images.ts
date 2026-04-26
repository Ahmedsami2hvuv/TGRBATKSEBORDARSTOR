import { prisma } from "./prisma";

export async function diagnoseImages() {
  const category = await prisma.storeCategory.findFirst({
    where: { photoUrl: { not: "" } },
    select: { photoUrl: true }
  });

  const profile = await prisma.customerPhoneProfile.findFirst({
    where: { photoUrl: { not: "" } },
    select: { photoUrl: true }
  });

  const order = await prisma.order.findFirst({
    where: { customerDoorPhotoUrl: { not: null } },
    select: { customerDoorPhotoUrl: true }
  });

  return {
    categorySample: category?.photoUrl?.substring(0, 50),
    profileSample: profile?.photoUrl?.substring(0, 50),
    orderSample: order?.customerDoorPhotoUrl?.substring(0, 50),
  };
}
