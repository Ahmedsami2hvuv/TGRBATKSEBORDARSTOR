"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { Decimal } from "@prisma/client/runtime/library";
import { pushNotifyCourierNewAssignment, pushNotifyAdminsNewPendingOrder } from "@/lib/web-push-server";
import { notifyTelegramNewOrder } from "@/lib/telegram-notify";

export async function createReverseOrderFromExisting(orderId: string): Promise<{
  ok: boolean;
  error?: string;
  newOrderId?: string;
  orderNumber?: number;
}> {
  try {
    if (!orderId) {
      return { ok: false, error: "معرّف الطلب غير موجود" };
    }

    // 1. جلب بيانات الطلب الحالي بالكامل
    const originalOrder = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        customerRegion: { select: { id: true, name: true, deliveryPrice: true } },
        shop: { select: { id: true, name: true, phone: true, ownerName: true, locationUrl: true, photoUrl: true } },
        courier: { select: { id: true, name: true } },
        submittedBy: { select: { id: true, phone: true, name: true } },
        submittedByCompanyPreparer: { select: { id: true, phone: true, name: true } },
      },
    });

    if (!originalOrder) {
      return { ok: false, error: "الطلب الأصلي غير موجود" };
    }

    // 2. حساب أجور التوصيل والمبالغ
    const deliveryPriceDecimal = originalOrder.customerRegion?.deliveryPrice != null
      ? new Decimal(originalOrder.customerRegion.deliveryPrice)
      : (originalOrder.deliveryPrice != null ? new Decimal(originalOrder.deliveryPrice) : new Decimal(0));

    const subtotalDecimal = new Decimal(0); // سعر الطلب 0 كما طُلب
    const totalDecimal = subtotalDecimal.plus(deliveryPriceDecimal);

    // 3. تحديد المندوب المسند والحالة والعميل التابع للمحل
    const assignedCourierId = originalOrder.assignedCourierId || null;
    const initialStatus = assignedCourierId ? "assigned" : "pending";

    let submittedByEmployeeId = originalOrder.submittedByEmployeeId || null;
    if (originalOrder.shopId) {
      const firstEmp = await prisma.employee.findFirst({
        where: { shopId: originalOrder.shopId },
        select: { id: true, phone: true },
      });
      if (firstEmp) {
        if (!submittedByEmployeeId) submittedByEmployeeId = firstEmp.id;
        if (!originalOrder.shop?.phone && firstEmp.phone) {
          await prisma.shop.update({
            where: { id: originalOrder.shopId },
            data: { phone: firstEmp.phone },
          }).catch(() => {});
        }
      }
    }

    // 4. إنشاء الطلب العكسي
    const newOrder = await prisma.order.create({
      data: {
        shopId: originalOrder.shopId,
        customerId: originalOrder.customerId,
        submittedByEmployeeId: submittedByEmployeeId,
        submittedByCompanyPreparerId: originalOrder.submittedByCompanyPreparerId || null,
        shopDoorPhotoUrl: originalOrder.shopDoorPhotoUrl || originalOrder.shop?.photoUrl || null,
        shopDoorPhotoUploadedByName: originalOrder.shopDoorPhotoUploadedByName || null,
        status: initialStatus,
        routeMode: "single",
        adminOrderCode: "",
        submissionSource: originalOrder.submissionSource || "admin_portal",
        summary: `طلب عكسي مرتبط بالطلب #${originalOrder.orderNumber}`,
        orderType: "طلب عكسي: استرجاع",
        orderNoteTime: "الآن",
        customerPhone: originalOrder.customerPhone,
        alternatePhone: originalOrder.alternatePhone,
        customerRegionId: originalOrder.customerRegionId,
        customerLocationUrl: originalOrder.customerLocationUrl || "",
        customerLandmark: originalOrder.customerLandmark || "",
        customerDoorPhotoUrl: originalOrder.customerDoorPhotoUrl || null,
        customerDoorPhotoUploadedByName: originalOrder.customerDoorPhotoUploadedByName || null,
        assignedCourierId: assignedCourierId,
        orderSubtotal: subtotalDecimal,
        deliveryPrice: deliveryPriceDecimal,
        totalAmount: totalDecimal,
        prepaidAll: false,
      },
      select: {
        id: true,
        orderNumber: true,
        assignedCourierId: true,
      },
    });

    // 5. إشعار المندوب إذا كان مسنداً
    if (newOrder.assignedCourierId) {
      void pushNotifyCourierNewAssignment(newOrder.assignedCourierId, newOrder.orderNumber, newOrder.id).catch(() => {});
    } else {
      void pushNotifyAdminsNewPendingOrder(newOrder.orderNumber).catch(() => {});
      void notifyTelegramNewOrder(newOrder.id).catch(() => {});
    }

    // 6. تحديث الكاش
    revalidatePath("/abo1stor3hlaa2kbr8-47/orders");
    revalidatePath(`/abo1stor3hlaa2kbr8-47/orders/${originalOrder.id}`);
    revalidatePath(`/abo1stor3hlaa2kbr8-47/orders/${newOrder.id}`);
    revalidatePath("/mandoub");

    return {
      ok: true,
      newOrderId: newOrder.id,
      orderNumber: newOrder.orderNumber,
    };
  } catch (err: any) {
    console.error("[createReverseOrderFromExisting] Error:", err);
    return { ok: false, error: err?.message || "تعذر إنشاء الطلب العكسي" };
  }
}
