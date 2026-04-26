"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { isAdminSession } from "@/lib/admin-session";
import { prisma } from "@/lib/prisma";

function revalidateOrderPaths(orderId: string) {
  revalidatePath("/admin/orders/tracking");
  revalidatePath("/admin/orders/pending");
  revalidatePath(`/admin/orders/${orderId}/edit`);
  revalidatePath(`/admin/orders/${orderId}`);
  revalidatePath("/mandoub");
}

async function requireAdminOrRedirect() {
  if (!(await isAdminSession())) {
    redirect("/admin/login");
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
