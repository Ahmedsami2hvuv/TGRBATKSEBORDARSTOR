"use server";

import { prisma } from "@/lib/prisma";

export async function getCustomerOtherRegionsDetails(phone: string, currentRegionId?: string | null, currentRegionName?: string | null) {
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

  if (currentRegionName) {
    const trimmedName = currentRegionName.trim();
    return profiles.filter(p => p.region?.name?.trim() !== trimmedName);
  }

  return profiles;

  return profiles;
}
