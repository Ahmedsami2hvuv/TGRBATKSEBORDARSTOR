"use server";

import { prisma } from "@/lib/prisma";
import { pushNotifyCourierNewAssignment } from "@/lib/web-push-server";
import { revalidatePath } from "next/cache";

export type BulkOrdersState = { ok?: boolean; error?: string };

const ALLOWED_STATUSES = new Set([
  "pending",
  "assigned",
  "delivering",
  "delivered",
  "cancelled",
  "archived",
]);

function getAllStrings(formData: FormData, key: string): string[] {
  return formData
    .getAll(key)
    .map((v) => (typeof v === "string" ? v : String(v)))
    .map((s) => s.trim())
    .filter(Boolean);
}

const SECRET_ADMIN_PATH = "/abo1stor3hlaa2kbr8-47";

export async function bulkUpdateOrdersStatus(
  _prev: BulkOrdersState,
  formData: FormData,
): Promise<BulkOrdersState> {
  const orderIds = getAllStrings(formData, "orderIds");
  const targetStatus = String(formData.get("targetStatus") ?? "").trim();
  const courierIdRaw = String(formData.get("courierId") ?? "").trim();
  const courierId = courierIdRaw || null;
  const directReceipt = formData.get("directReceipt") === "on";

  if (orderIds.length === 0) {
    return { error: "اختر طلباً واحداً على الأقل." };
  }
  if (!ALLOWED_STATUSES.has(targetStatus)) {
    return { error: "حالة الهدف غير صالحة." };
  }

  const selectedOrders = await prisma.order.findMany({
    where: { id: { in: orderIds } },
    include: { shop: { select: { name: true } } }
  });

  let finalOrderIds = [...orderIds];
  let skippedText = "";

  if (targetStatus === "cancelled") {
    const deliveredOrArchived = selectedOrders.filter(o => o.status === "delivered" || o.status === "archived");
    if (deliveredOrArchived.length > 0) {
      const skippedIds = new Set(deliveredOrArchived.map(o => o.id));
      finalOrderIds = orderIds.filter(id => !skippedIds.has(id));
      
      const listText = deliveredOrArchived
        .map(o => `الطلب #${o.orderNumber} من محل (${o.shop?.name || "محل"})`)
        .join("، ");
      skippedText = `ولكن لم يتم رفض [ ${listText} ] لأن حالتها 'تم التسليم' أو 'مؤرشفة' (يجب إرجاعها إلى 'جديد' أولاً).`;

      if (finalOrderIds.length === 0) {
        return { error: `لا يمكن رفض الطلبات المحددة لأن حالتها 'تم التسليم' أو 'مؤرشفة'. ${skippedText}` };
      }
    }
  }

  const needsCourier =
    targetStatus === "assigned" ||
    targetStatus === "delivering" ||
    targetStatus === "delivered";

  if (needsCourier && !courierId) {
    return { error: "اختر المندوب ثم اضغط تطبيق." };
  }

  if (courierId) {
    const c = await prisma.courier.findUnique({ where: { id: courierId } });
    if (!c) return { error: "المندوب غير موجود." };
    if (c.blocked || c.hiddenFromReports) {
      return { error: "المندوب غير متاح للإسناد (محظور أو مخفي عن الإسناد)." };
    }
  }

  const finalStatus = directReceipt ? "delivering" : targetStatus;

  await prisma.$transaction(async (tx) => {
    for (const orderId of finalOrderIds) {
      const currentOrder = selectedOrders.find((o) => o.id === orderId);
      const prevStatus = currentOrder?.status || "pending";

      // 1. تسوية الحركات المالية عند تغير حالة الطلب
      if (prevStatus !== finalStatus) {
        const { reconcileMoneyEventsOnOrderStatusChange } = await import("@/lib/order-money-reconcile");
        await reconcileMoneyEventsOnOrderStatusChange(tx, orderId, prevStatus as any, finalStatus as any);
      }

      const updateData: any = {
        status: finalStatus,
        customerPaymentReceivedAt: directReceipt ? new Date() : (targetStatus === "archived" ? undefined : null),
        archivedAt: targetStatus === "archived" ? new Date() : null,
      };

      // 2. تحديث المندوب بحسب الحالة والمدخلات
      if (targetStatus === "assigned" || targetStatus === "delivering" || targetStatus === "delivered") {
        if (courierId) {
          updateData.assignedCourierId = courierId;
        }
      } else if (targetStatus === "pending" || targetStatus === "cancelled") {
        updateData.assignedCourierId = null;
        updateData.courierEarningDinar = null;
        updateData.courierEarningForCourierId = null;
      }

      // 3. عند التسليم أو الأرشفة: احتساب أرباح التوصيل للمندوب
      const effectiveCourierId = updateData.assignedCourierId !== undefined ? updateData.assignedCourierId : currentOrder?.assignedCourierId;
      if (finalStatus === "delivered" && effectiveCourierId && currentOrder?.deliveryPrice != null) {
        const courierRecord = await tx.courier.findUnique({ where: { id: effectiveCourierId } });
        if (courierRecord) {
          const { computeCourierDeliveryEarningDinar } = await import("@/lib/courier-earnings");
          const earning = computeCourierDeliveryEarningDinar(
            courierRecord.vehicleType,
            currentOrder.deliveryPrice,
            courierRecord.zeroEarning,
          );
          updateData.courierEarningDinar = earning as any;
          updateData.courierEarningForCourierId = effectiveCourierId;
        }
      } else if (targetStatus === "archived") {
        const cid = currentOrder?.courierEarningForCourierId || effectiveCourierId;
        if (cid && (currentOrder?.courierEarningDinar == null || currentOrder?.courierEarningForCourierId == null)) {
          const courierRecord = await tx.courier.findUnique({ where: { id: cid } });
          if (courierRecord && currentOrder?.deliveryPrice != null) {
            const { computeCourierDeliveryEarningDinar } = await import("@/lib/courier-earnings");
            const earning = computeCourierDeliveryEarningDinar(
              courierRecord.vehicleType,
              currentOrder.deliveryPrice,
              courierRecord.zeroEarning,
            );
            if (earning != null) {
              updateData.courierEarningDinar = earning as any;
              updateData.courierEarningForCourierId = cid;
            }
          }
        }
      } else if (finalStatus !== "delivered" && finalStatus !== "archived") {
        updateData.courierEarningDinar = null;
        updateData.courierEarningForCourierId = null;
      }

      await tx.order.update({
        where: { id: orderId },
        data: updateData,
      });

      // 4. مزامنة التوقعات المالية مع الصناديق
      const { syncOrderCourierMoneyExpectations } = await import("@/lib/order-courier-money-sync");
      await syncOrderCourierMoneyExpectations(tx, orderId);
    }
  });

  if ((finalStatus === "assigned" || finalStatus === "delivering") && courierId) {
    const updatedOrders = await prisma.order.findMany({
      where: { id: { in: finalOrderIds } },
      select: { id: true, orderNumber: true }
    });
    for (const o of updatedOrders) {
      void pushNotifyCourierNewAssignment(courierId, o.orderNumber, o.id);
    }
  }

  if (finalStatus === "delivered" || finalStatus === "archived") {
    try {
      const { handleOrderDelivered } = await import("@/lib/order-delivery-hook");
      for (const orderId of finalOrderIds) {
        await handleOrderDelivered(orderId);
      }
    } catch (err) {
      console.error("Hook error in bulk status change:", err);
    }
  }

  revalidatePath(`${SECRET_ADMIN_PATH}/orders/tracking`);
  revalidatePath(`${SECRET_ADMIN_PATH}/orders/pending`);
  revalidatePath(`${SECRET_ADMIN_PATH}/orders/rejected`);
  revalidatePath(`${SECRET_ADMIN_PATH}/orders/archived`);
  revalidatePath(`${SECRET_ADMIN_PATH}/couriers`);
  revalidatePath("/mandoub");

  if (skippedText) {
    return { error: `تم تحويل بقية الطلبات المحددة بنجاح، ${skippedText}` };
  }

  return { ok: true };
}
