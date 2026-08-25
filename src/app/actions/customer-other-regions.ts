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
  toRegionId?: string | null,
  field?: "locationUrl" | "photoUrl" | "notes" | "landmark" | "alternatePhone",
  orderId?: string | null,
  isSecondDestination?: boolean
) {
  if (!phone || !fromRegionId || (!toRegionId && !orderId)) return { success: false, message: "Missing required fields" };

  try {
    const fromProfile = await prisma.customerPhoneProfile.findUnique({
      where: { phone_regionId: { phone, regionId: fromRegionId } },
    });

    if (!fromProfile) return { success: false, message: "Profile not found" };

    let effectiveToRegionId = toRegionId;
    let orderToUpdate: any = null;

    if (orderId) {
      orderToUpdate = await prisma.order.findUnique({ where: { id: orderId } });
      if (orderToUpdate) {
        if (isSecondDestination) {
          effectiveToRegionId = orderToUpdate.secondCustomerRegionId || toRegionId;
        } else {
          effectiveToRegionId = orderToUpdate.customerRegionId || toRegionId;
        }
      }
    }

    if (effectiveToRegionId) {
      const toProfile = await prisma.customerPhoneProfile.findUnique({
        where: { phone_regionId: { phone, regionId: effectiveToRegionId } },
      });

      if (toProfile) {
        const dataToUpdate: any = {};
        if (field) {
          if (fromProfile[field] !== undefined && fromProfile[field] !== null && fromProfile[field] !== "") {
            dataToUpdate[field] = fromProfile[field];
          }
        } else {
          if (fromProfile.locationUrl) dataToUpdate.locationUrl = fromProfile.locationUrl;
          if (fromProfile.photoUrl) dataToUpdate.photoUrl = fromProfile.photoUrl;
          if (fromProfile.notes) dataToUpdate.notes = fromProfile.notes;
          if (fromProfile.landmark) dataToUpdate.landmark = fromProfile.landmark;
          if (fromProfile.alternatePhone) dataToUpdate.alternatePhone = fromProfile.alternatePhone;
        }
        
        if (Object.keys(dataToUpdate).length > 0) {
          await prisma.customerPhoneProfile.update({
            where: { id: toProfile.id },
            data: dataToUpdate,
          });
        }
      } else {
        const dataToCreate: any = {
          phone,
          regionId: effectiveToRegionId,
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
    }

    // Update order directly if orderId is provided
    if (orderId && orderToUpdate) {
      const orderUpdateData: any = {};
      
      const updateLocation = () => {
        if (fromProfile.locationUrl) {
          if (isSecondDestination) {
            orderUpdateData.secondCustomerLocationUrl = fromProfile.locationUrl;
          } else {
            orderUpdateData.customerLocationUrl = fromProfile.locationUrl;
          }
        }
      };

      const updatePhoto = () => {
        if (fromProfile.photoUrl) {
          if (isSecondDestination) {
            orderUpdateData.secondCustomerDoorPhotoUrl = fromProfile.photoUrl;
          } else {
            orderUpdateData.customerDoorPhotoUrl = fromProfile.photoUrl;
          }
        }
      };

      const updateLandmark = () => {
        if (fromProfile.landmark) {
          if (isSecondDestination) {
            orderUpdateData.secondCustomerLandmark = fromProfile.landmark;
          } else {
            orderUpdateData.customerLandmark = fromProfile.landmark;
          }
        }
      };

      const updateAlternatePhone = () => {
        if (fromProfile.alternatePhone) {
          orderUpdateData.alternatePhone = fromProfile.alternatePhone;
        }
      };

      if (!field) {
        updateLocation();
        updatePhoto();
        updateLandmark();
        updateAlternatePhone();
      } else {
        if (field === "locationUrl") updateLocation();
        if (field === "photoUrl") updatePhoto();
        if (field === "landmark") updateLandmark();
        if (field === "alternatePhone") updateAlternatePhone();
      }

      if (Object.keys(orderUpdateData).length > 0) {
        await prisma.order.update({
          where: { id: orderId },
          data: orderUpdateData,
        });
      }
    }

    return { success: true };
  } catch (error) {
    console.error("Error pulling customer profile:", error);
    return { success: false, message: "Failed to pull profile" };
  }
}
