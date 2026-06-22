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
}

export async function pullCustomerProfileDetails(phone: string, fromRegionId: string, toRegionId: string) {
  if (!phone || !fromRegionId || !toRegionId) return { success: false, message: "Missing required fields" };

  try {
    const fromProfile = await prisma.customerPhoneProfile.findUnique({
      where: { phone_regionId: { phone, regionId: fromRegionId } },
    });

    if (!fromProfile) return { success: false, message: "Profile not found" };

    const toProfile = await prisma.customerPhoneProfile.findUnique({
      where: { phone_regionId: { phone, regionId: toRegionId } },
    });

    if (toProfile) {
      await prisma.customerPhoneProfile.update({
        where: { id: toProfile.id },
        data: {
          locationUrl: toProfile.locationUrl || fromProfile.locationUrl,
          photoUrl: toProfile.photoUrl || fromProfile.photoUrl,
          notes: toProfile.notes || fromProfile.notes,
          landmark: toProfile.landmark || fromProfile.landmark,
          alternatePhone: toProfile.alternatePhone || fromProfile.alternatePhone,
        },
      });
    } else {
      await prisma.customerPhoneProfile.create({
        data: {
          phone,
          regionId: toRegionId,
          locationUrl: fromProfile.locationUrl,
          photoUrl: fromProfile.photoUrl,
          notes: fromProfile.notes,
          landmark: fromProfile.landmark,
          alternatePhone: fromProfile.alternatePhone,
        },
      });
    }

    return { success: true };
  } catch (error) {
    console.error("Error pulling customer profile:", error);
    return { success: false, message: "Failed to pull profile" };
  }
}
