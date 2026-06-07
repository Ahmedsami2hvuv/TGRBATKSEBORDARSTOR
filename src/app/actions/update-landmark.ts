"use server";

import { prisma } from "@/lib/prisma";
import { syncPhoneProfileFromOrder, syncSecondPhoneProfileFromOrder } from "@/lib/customer-phone-profile-sync";
import { revalidatePath } from "next/cache";

export async function updateOrderLandmarkAction(
  orderId: string,
  newLandmark: string,
  isSecondDestination: boolean = false
) {
  try {
    const trimmedLandmark = newLandmark.trim();

    // 1. Fetch the order details
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
        secondCustomerPhone: true
      }
    });

    if (!order) {
      return { error: "الطلب غير موجود" };
    }

    if (isSecondDestination) {
      // Update the second destination landmark
      await prisma.order.update({
        where: { id: orderId },
        data: { secondCustomerLandmark: trimmedLandmark }
      });

      // Synchronize the profile for the second destination
      await syncSecondPhoneProfileFromOrder(orderId);
    } else {
      // Update the primary customer landmark
      await prisma.order.update({
        where: { id: orderId },
        data: { customerLandmark: trimmedLandmark }
      });

      // Update the customer record if exists
      if (order.customerId) {
        await prisma.customer.update({
          where: { id: order.customerId },
          data: { customerLandmark: trimmedLandmark }
        });
      } else if (order.customerPhone) {
        // Find if there is an existing customer profile with this phone and shopId to update
        const existingCustomer = await prisma.customer.findFirst({
          where: {
            shopId: order.shopId,
            phone: order.customerPhone
          }
        });
        if (existingCustomer) {
          await prisma.customer.update({
            where: { id: existingCustomer.id },
            data: { customerLandmark: trimmedLandmark }
          });
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
