"use server";

import { prisma } from "@/lib/prisma";

export async function getCustomerOtherRegionsDetails(phone: string, currentRegionId?: string | null) {
  if (!phone) return [];

  const profiles = await prisma.customerPhoneProfile.findMany({
    where: {
      phone,
      ...(currentRegionId ? { regionId: { not: currentRegionId } } : {}),
      OR: [
        { locationUrl: { not: "" } },
        { photoUrl: { not: "" } },
        { notes: { not: "" } },
        { landmark: { not: "" } },
        { alternatePhone: { not: null } },
      ],
    },
    include: {
      region: { select: { name: true } },
    },
    orderBy: { updatedAt: "desc" },
  });

  return profiles;
}
