"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { isAdminSession } from "@/lib/admin-session";
import { prisma } from "@/lib/prisma";

const SECRET_ADMIN_PATH = "/abo1stor3hlaa2kbr8-47";

function revalidateOrderPaths(orderId: string) {
  revalidatePath(`${SECRET_ADMIN_PATH}/orders/tracking`);
  revalidatePath(`${SECRET_ADMIN_PATH}/orders/pending`);
  revalidatePath(`${SECRET_ADMIN_PATH}/orders/${orderId}/edit`);
  revalidatePath(`${SECRET_ADMIN_PATH}/orders/${orderId}`);
  revalidatePath("/mandoub");
}

async function requireAdminOrRedirect() {
  if (!(await isAdminSession())) {
    redirect(`${SECRET_ADMIN_PATH}/login`);
  }
}

export async function adminToggleOrderShopCostPaid(formData: FormData): Promise<void> {
  await requireAdminOrRedirect();
  const orderId = String(formData.get("orderId") ?? "").trim();
  if (!orderId) return;
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) return;
  await prisma.order.update({
    where: { id: orderId },
    data: { shopCostPaidAt: order.shopCostPaidAt ? null : new Date() },
  });
  revalidateOrderPaths(orderId);
}

export async function adminToggleOrderCustomerPaymentReceived(formData: FormData): Promise<void> {
  await requireAdminOrRedirect();
  const orderId = String(formData.get("orderId") ?? "").trim();
  if (!orderId) return;
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) return;
  await prisma.order.update({
    where: { id: orderId },
    data: {
      customerPaymentReceivedAt: order.customerPaymentReceivedAt ? null : new Date(),
    },
  });
  revalidateOrderPaths(orderId);
}

export async function adminToggleOrderCourierCashSettled(formData: FormData): Promise<void> {
  await requireAdminOrRedirect();
  const orderId = String(formData.get("orderId") ?? "").trim();
  if (!orderId) return;
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) return;
  await prisma.order.update({
    where: { id: orderId },
    data: { courierCashSettledAt: order.courierCashSettledAt ? null : new Date() },
  });
  revalidateOrderPaths(orderId);
}

export async function adminMarkOrderPickedUp(formData: FormData): Promise<void> {
  await requireAdminOrRedirect();
  const orderId = String(formData.get("orderId") ?? "").trim();
  if (!orderId) return;
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order || order.status !== "assigned") return;
  await prisma.order.update({
    where: { id: orderId },
    data: { status: "delivering" },
  });
  revalidateOrderPaths(orderId);
}

export async function adminMarkOrderDelivered(formData: FormData): Promise<void> {
  await requireAdminOrRedirect();
  const orderId = String(formData.get("orderId") ?? "").trim();
  if (!orderId) return;
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order || order.status !== "delivering") return;
  await prisma.order.update({
    where: { id: orderId },
    data: { status: "delivered" },
  });
  revalidateOrderPaths(orderId);
}
