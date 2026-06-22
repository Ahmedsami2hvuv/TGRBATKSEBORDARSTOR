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

export async function pullCustomerProfileDetails(
  phone: string, 
  fromRegionId: string, 
  toRegionId: string,
  field?: "locationUrl" | "photoUrl" | "notes" | "landmark" | "alternatePhone"
) {
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
      const dataToUpdate: any = {};
      if (field) {
        dataToUpdate[field] = fromProfile[field] || toProfile[field];
      } else {
        dataToUpdate.locationUrl = toProfile.locationUrl || fromProfile.locationUrl;
        dataToUpdate.photoUrl = toProfile.photoUrl || fromProfile.photoUrl;
        dataToUpdate.notes = toProfile.notes || fromProfile.notes;
        dataToUpdate.landmark = toProfile.landmark || fromProfile.landmark;
        dataToUpdate.alternatePhone = toProfile.alternatePhone || fromProfile.alternatePhone;
      }
      
      await prisma.customerPhoneProfile.update({
        where: { id: toProfile.id },
        data: dataToUpdate,
      });
    } else {
      const dataToCreate: any = {
        phone,
        regionId: toRegionId,
        locationUrl: "",
        photoUrl: "",
        notes: "",
        landmark: "",
        alternatePhone: null,
      };
      
      if (field) {
        dataToCreate[field] = fromProfile[field];
      } else {
        dataToCreate.locationUrl = fromProfile.locationUrl;
        dataToCreate.photoUrl = fromProfile.photoUrl;
        dataToCreate.notes = fromProfile.notes;
        dataToCreate.landmark = fromProfile.landmark;
        dataToCreate.alternatePhone = fromProfile.alternatePhone;
      }
      
      await prisma.customerPhoneProfile.create({
        data: dataToCreate,
      });
    }

    return { success: true };
  } catch (error) {
    console.error("Error pulling customer profile:", error);
    return { success: false, message: "Failed to pull profile" };
  }
}
