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

  // عند الأرشفة: لا نمسح المندوب الحالي لكي يبقى مسجلاً مع الطلبية في الأرشيف
  const data: any = {
    status: directReceipt ? "delivering" : targetStatus,
    customerPaymentReceivedAt: directReceipt ? new Date() : (targetStatus === "archived" ? undefined : null),
    ...(targetStatus === "archived"
      ? { archivedAt: new Date() }
      : {
          archivedAt: null,
          assignedCourierId: needsCourier ? courierId : null
        }),
  };

  await prisma.order.updateMany({
    where: { id: { in: orderIds } },
    data,
  });

  if (targetStatus === "assigned" && courierId) {
    const updatedOrders = await prisma.order.findMany({
      where: { id: { in: orderIds } },
      select: { id: true, orderNumber: true }
    });
    for (const o of updatedOrders) {
      void pushNotifyCourierNewAssignment(courierId, o.orderNumber, o.id);
    }
  }

  revalidatePath(`${SECRET_ADMIN_PATH}/orders/tracking`);
  revalidatePath(`${SECRET_ADMIN_PATH}/orders/pending`);
  revalidatePath(`${SECRET_ADMIN_PATH}/orders/rejected`);
  revalidatePath(`${SECRET_ADMIN_PATH}/orders/archived`);
  revalidatePath(`${SECRET_ADMIN_PATH}/couriers`);
  revalidatePath("/mandoub");

  return { ok: true };
}
