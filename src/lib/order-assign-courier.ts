import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { pushNotifyCourierNewAssignment } from "@/lib/web-push-server";

export type AssignCourierInternalOpts = {
  /** إسناد من المجهز: السماح حتى لو المندوب أوقف «متاح للإسناد» */
  bypassCourierAvailability?: boolean;
};

/** إسناد طلب معلّق إلى مندوب — نفس منطق لوحة الإدارة (بدون حقول إضافية). */
export async function assignPendingOrderToCourierInternal(
  orderId: string,
  courierId: string,
  opts?: AssignCourierInternalOpts,
): Promise<{ ok: true } | { error: string }> {
  const order = await prisma.order.findFirst({
    where: { id: orderId, status: "pending" },
    select: { id: true, orderNumber: true },
  });
  if (!order) {
    return { error: "الطلب غير متاح أو تم إسناده مسبقاً" };
  }
  const courier = await prisma.courier.findUnique({
    where: { id: courierId },
  });
  if (!courier) {
    return { error: "المندوب غير موجود" };
  }
  if (courier.blocked) {
    return { error: "المندوب محظور ولا يمكن إسناد طلبات له" };
  }
  if (courier.hiddenFromReports) {
    return { error: "المندوب مخفي عن الإسناد ولا يمكن إسناد طلبات له" };
  }
  if (!opts?.bypassCourierAvailability && !courier.availableForAssignment) {
    return { error: "المندوب غير متاح للإسناد حالياً (وضع «غير موجود»)" };
  }

  await prisma.order.update({
    where: { id: orderId },
    data: {
      assignedCourierId: courierId,
      status: "assigned",
    },
  });

  void pushNotifyCourierNewAssignment(courierId, order.orderNumber);

  revalidatePath("/admin/orders/pending");
  revalidatePath("/admin/couriers");
  revalidatePath("/admin/orders/tracking");
  revalidatePath("/mandoub");
  revalidatePath(`/admin/orders/${orderId}`);
  return { ok: true };
}

/** تحويل/إسناد الطلب إلى مندوب (pending/assigned/delivering). */
export async function transferOrderToCourierInternal(
  orderId: string,
  courierId: string,
  opts?: AssignCourierInternalOpts,
): Promise<{ ok: true } | { error: string }> {
  const order = await prisma.order.findFirst({
    where: { id: orderId, status: { in: ["pending", "assigned", "delivering"] } },
    select: {
      id: true,
      status: true,
      orderNumber: true,
      assignedCourierId: true,
    },
  });
  if (!order) {
    return { error: "لا يمكن تحويل هذا الطلب بحالته الحالية" };
  }
  const courier = await prisma.courier.findUnique({
    where: { id: courierId },
  });
  if (!courier) {
    return { error: "المندوب غير موجود" };
  }
  if (courier.blocked) {
    return { error: "المندوب محظور ولا يمكن إسناد طلبات له" };
  }
  if (courier.hiddenFromReports) {
    return { error: "المندوب مخفي عن الإسناد ولا يمكن إسناد طلبات له" };
  }
  if (!opts?.bypassCourierAvailability && !courier.availableForAssignment) {
    return { error: "المندوب غير متاح للإسناد حالياً (وضع «غير موجود»)" };
  }

  await prisma.order.update({
    where: { id: orderId },
    data: {
      assignedCourierId: courierId,
      status: order.status === "pending" ? "assigned" : order.status,
    },
  });

  const shouldNotifyMandoub =
    // نُخطر عند:
    // - الطلب كان pending (أول إسناد)
    // - أو المندوب الحالي (المخزن سابقاً) يختلف، حتى لو كان null (حالة غير متوقعة ولكن قد تحصل)
    order.status === "pending" || order.assignedCourierId !== courierId;
  if (shouldNotifyMandoub) {
    void pushNotifyCourierNewAssignment(courierId, order.orderNumber).catch((e) => {
      console.error("[pushNotifyCourierNewAssignment] failed:", e);
    });
  }

  revalidatePath("/admin/orders/pending");
  revalidatePath("/admin/couriers");
  revalidatePath("/admin/orders/tracking");
  revalidatePath("/mandoub");
  revalidatePath(`/admin/orders/${orderId}`);
  return { ok: true };
}
