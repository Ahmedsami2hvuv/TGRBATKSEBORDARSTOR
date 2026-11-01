"use server";

import { prisma } from "@/lib/prisma";
import { syncPhoneProfileFromOrder, syncSecondPhoneProfileFromOrder } from "@/lib/customer-phone-profile-sync";
import { buildUpdatedLandmarkHistory, parseLandmarkHistory } from "@/lib/landmark-history";
import { revalidatePath } from "next/cache";

export async function updateOrderLandmarkAction(
  orderId: string,
  newLandmark: string,
  isSecondDestination: boolean = false,
  updaterName?: string | null
) {
  try {
    const trimmedLandmark = newLandmark.trim();

    // 1. Fetch current order details including existing landmark and history
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        customerId: true,
        customerPhone: true,
        shopId: true,
        routeMode: true,
        customerRegionId: true,
        secondCustomerRegionId: true,
        secondCustomerPhone: true,
        customerLandmark: true,
        customerLandmarkUploadedByName: true,
        customerLandmarkHistory: true,
        secondCustomerLandmark: true,
        secondCustomerLandmarkUploadedByName: true,
        secondCustomerLandmarkHistory: true,
        updatedAt: true,
        assignedCourierId: true,
        courier: {
          select: { name: true }
        }
      }
    });

    if (!order) {
      return { error: "الطلب غير موجود" };
    }

    // Determine default updater name if not provided
    const resolvedUpdaterName =
      updaterName?.trim() ||
      (order.courier?.name ? `المندوب ${order.courier.name.trim()}` : "المندوب");

    if (isSecondDestination) {
      const oldLandmark = order.secondCustomerLandmark?.trim() || "";
      const isChanged = oldLandmark !== trimmedLandmark;

      let historyToSave = parseLandmarkHistory(order.secondCustomerLandmarkHistory);
      if (isChanged && oldLandmark) {
        historyToSave = buildUpdatedLandmarkHistory(
          order.secondCustomerLandmarkHistory,
          oldLandmark,
          order.secondCustomerLandmarkUploadedByName,
          order.updatedAt
        );
      }

      await prisma.order.update({
        where: { id: orderId },
        data: {
          secondCustomerLandmark: trimmedLandmark,
          secondCustomerLandmarkUploadedByName: resolvedUpdaterName,
          secondCustomerLandmarkHistory: historyToSave,
        }
      });

      // Synchronize the profile for the second destination
      await syncSecondPhoneProfileFromOrder(orderId);
    } else {
      const oldLandmark = order.customerLandmark?.trim() || "";
      const isChanged = oldLandmark !== trimmedLandmark;

      let historyToSave = parseLandmarkHistory(order.customerLandmarkHistory);
      if (isChanged && oldLandmark) {
        historyToSave = buildUpdatedLandmarkHistory(
          order.customerLandmarkHistory,
          oldLandmark,
          order.customerLandmarkUploadedByName,
          order.updatedAt
        );
      }

      await prisma.order.update({
        where: { id: orderId },
        data: {
          customerLandmark: trimmedLandmark,
          customerLandmarkUploadedByName: resolvedUpdaterName,
          customerLandmarkHistory: historyToSave,
        }
      });

      // Update the customer record if exists
      if (order.customerId) {
        try {
          await prisma.customer.update({
            where: { id: order.customerId },
            data: {
              customerLandmark: trimmedLandmark,
              customerLandmarkUploadedByName: resolvedUpdaterName,
              customerLandmarkHistory: historyToSave,
            }
          });
        } catch (e) {
          console.error("Non-critical customer update error:", e);
        }
      } else if (order.customerPhone) {
        const existingCustomer = await prisma.customer.findFirst({
          where: {
            shopId: order.shopId,
            phone: order.customerPhone
          }
        });
        if (existingCustomer) {
          try {
            await prisma.customer.update({
              where: { id: existingCustomer.id },
              data: {
                customerLandmark: trimmedLandmark,
                customerLandmarkUploadedByName: resolvedUpdaterName,
                customerLandmarkHistory: historyToSave,
              }
            });
          } catch (e) {
            console.error("Non-critical customer update error:", e);
          }
        }
      }

      // Synchronize the profile for the primary destination
      await syncPhoneProfileFromOrder(orderId);
    }

    // Revalidate paths so the UI updates
    revalidatePath("/mandoub");
    revalidatePath(`/mandoub/order/${orderId}`);
    revalidatePath(`/abo1stor3hlaa2kbr8-47/orders/${orderId}`);
    revalidatePath(`/abo1stor3hlaa2kbr8-47/orders/pending`);

    return { ok: true };
  } catch (error: any) {
    console.error("Error updating landmark:", error);
    return { error: error.message || "حدث خطأ أثناء حفظ التعديل" };
  }
}
