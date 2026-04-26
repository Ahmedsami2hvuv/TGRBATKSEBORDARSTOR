"use server";

import { revalidatePath } from "next/cache";
import {
  MAX_ORDER_IMAGE_BYTES,
  saveOrderImageUploaded,
  saveCustomerDoorPhotoUploaded,
  saveShopDoorPhotoUploaded,
} from "@/lib/order-image";
import { ORDER_UPLOADER_ADMIN_LABEL } from "@/lib/order-uploader-label";
import { prisma } from "@/lib/prisma";
import { syncPhoneProfileFromOrder } from "@/lib/customer-phone-profile-sync";

export type CustomerDoorPhotoState = { ok?: boolean; error?: string };

export async function uploadCustomerDoorPhotoFromView(
  orderId: string,
  _prev: CustomerDoorPhotoState,
  formData: FormData,
): Promise<CustomerDoorPhotoState> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      customerId: true,
      customerPhone: true,
      shopId: true,
    },
  });
  if (!order) {
    return { error: "الطلب غير موجود" };
  }

  const file = formData.get("customerDoorPhoto");
  if (!(file instanceof File) || file.size <= 0) {
    return { error: "اختر صورة أولاً" };
  }

  let photoUrl: string;
  try {
    photoUrl = await saveCustomerDoorPhotoUploaded(file, MAX_ORDER_IMAGE_BYTES);
  } catch (e) {
    const code = e instanceof Error ? e.message : "";
    if (code === "IMAGE_TOO_LARGE") {
      return { error: "الصورة كبيرة جداً (الحد 10 ميجابايت)" };
    }
    if (code === "IMAGE_BAD_TYPE") {
      return { error: "نوع الصورة غير مدعوم (JPG أو PNG أو Webp)" };
    }
    if (code === "IMAGE_STORAGE_FAILED") {
      return { error: "تعذّر حفظ الصورة على الخادم" };
    }
    return { error: "تعذّر رفع الصورة" };
  }

  await prisma.order.update({
    where: { id: order.id },
    data: {
      customerDoorPhotoUrl: photoUrl,
      customerDoorPhotoUploadedByName: ORDER_UPLOADER_ADMIN_LABEL,
    },
  });

  await syncPhoneProfileFromOrder(order.id);

  // ملاحظة: لا نستدعي revalidatePath هنا لأن المستخدم قد يكون في صفحة التعديل
  // ويريد متابعة إدخال البيانات دون انتظار لحاقة الصفحة. سيتم التحديث عند حفظ الطلب.
  return { ok: true };
}

function parseUploadError(e: unknown): string {
  const code = e instanceof Error ? e.message : "";
  if (code === "IMAGE_TOO_LARGE") return "الصورة كبيرة جداً (الحد 10 ميجابايت)";
  if (code === "IMAGE_BAD_TYPE") return "نوع الصورة غير مدعوم (JPG أو PNG أو Webp)";
  if (code === "IMAGE_STORAGE_FAILED") return "تعذّر حفظ الصورة على الخادم";
  return "تعذّر رفع الصورة";
}

export async function uploadShopDoorPhotoFromView(
  orderId: string,
  _prev: CustomerDoorPhotoState,
  formData: FormData,
): Promise<CustomerDoorPhotoState> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { id: true, shopId: true },
  });
  if (!order) return { error: "الطلب غير موجود" };

  const file = formData.get("shopDoorPhoto");
  if (!(file instanceof File) || file.size <= 0) return { error: "اختر صورة أولاً" };

  let photoUrl: string;
  try {
    photoUrl = await saveShopDoorPhotoUploaded(file, MAX_ORDER_IMAGE_BYTES);
  } catch (e) {
    return { error: parseUploadError(e) };
  }

  await prisma.order.update({
    where: { id: order.id },
    data: {
      shopDoorPhotoUrl: photoUrl,
      shopDoorPhotoUploadedByName: ORDER_UPLOADER_ADMIN_LABEL,
    },
  });

  // صورة باب المحل يجب أن تكون "صورة المحل الحالية" ليتم عرضها في جميع الطلبات (قديم/جديد).
  await prisma.shop.update({
    where: { id: order.shopId },
    data: { photoUrl },
  });

  revalidatePath("/admin/orders/tracking");
  revalidatePath("/admin/orders/pending");
  revalidatePath(`/admin/orders/${order.id}`);
  revalidatePath(`/admin/orders/${order.id}/edit`);
  revalidatePath("/admin/shops");
  revalidatePath(`/admin/shops/${order.shopId}/edit`);
  revalidatePath("/mandoub");
  return { ok: true };
}

export async function uploadOrderImageFromView(
  orderId: string,
  _prev: CustomerDoorPhotoState,
  formData: FormData,
): Promise<CustomerDoorPhotoState> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { id: true },
  });
  if (!order) return { error: "الطلب غير موجود" };

  const file = formData.get("orderPhoto");
  if (!(file instanceof File) || file.size <= 0) return { error: "اختر صورة أولاً" };

  let photoUrl: string;
  try {
    photoUrl = await saveOrderImageUploaded(file, MAX_ORDER_IMAGE_BYTES);
  } catch (e) {
    return { error: parseUploadError(e) };
  }

  await prisma.order.update({
    where: { id: order.id },
    data: {
      imageUrl: photoUrl,
      orderImageUploadedByName: ORDER_UPLOADER_ADMIN_LABEL,
    },
  });

  revalidatePath("/admin/orders/tracking");
  revalidatePath("/admin/orders/pending");
  revalidatePath(`/admin/orders/${order.id}`);
  revalidatePath(`/admin/orders/${order.id}/edit`);
  revalidatePath("/mandoub");
  return { ok: true };
}

export async function uploadCustomerLocationFromView(
  orderId: string,
  _prev: CustomerDoorPhotoState,
  formData: FormData,
): Promise<CustomerDoorPhotoState> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      customerId: true,
      customerPhone: true,
      shopId: true,
    },
  });
  if (!order) return { error: "الطلب غير موجود" };

  const lat = Number(formData.get("lat"));
  const lng = Number(formData.get("lng"));
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return { error: "تعذّر قراءة موقع الجهاز" };
  }
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return { error: "إحداثيات غير صالحة" };
  }

  const mapsUrl = `https://www.google.com/maps?q=${lat},${lng}`;

  await prisma.order.update({
    where: { id: order.id },
    data: {
      customerLocationUrl: mapsUrl,
      customerLocationSetByCourierAt: null,
      customerLocationUploadedByName: ORDER_UPLOADER_ADMIN_LABEL,
    },
  });

  await syncPhoneProfileFromOrder(order.id);

  revalidatePath("/admin/orders/tracking");
  revalidatePath("/admin/orders/pending");
  revalidatePath(`/admin/orders/${order.id}`);
  revalidatePath(`/admin/orders/${order.id}/edit`);
  revalidatePath("/mandoub");
  return { ok: true };
}

export async function deleteOrderImageAction(orderId: string): Promise<CustomerDoorPhotoState> {
  await prisma.order.update({
    where: { id: orderId },
    data: { imageUrl: null, orderImageUploadedByName: null },
  });
  revalidatePath(`/admin/orders/${orderId}`);
  return { ok: true };
}

export async function deleteCustomerDoorPhotoAction(orderId: string): Promise<CustomerDoorPhotoState> {
  await prisma.order.update({
    where: { id: orderId },
    data: { customerDoorPhotoUrl: null, customerDoorPhotoUploadedByName: null },
  });
  // ملاحظة: قد تحتاج لمزامنة PhoneProfile إن كان هذا السلوك مطلوباً
  revalidatePath(`/admin/orders/${orderId}`);
  return { ok: true };
}

export async function deleteShopDoorPhotoAction(orderId: string): Promise<CustomerDoorPhotoState> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { id: true },
  });
  if (!order) return { error: "الطلب غير موجود" };

  await prisma.order.update({
    where: { id: orderId },
    data: { shopDoorPhotoUrl: null, shopDoorPhotoUploadedByName: null },
  });

  // لا نمسح صورة المحل الأساسية لأنها قد تُستخدم في طلبيات أخرى
  // هذا يضمن أن مسح صورة واحدة لا يؤثر على الطلبيات الأخرى

  revalidatePath(`/admin/orders/${orderId}`);
  revalidatePath("/admin/shops");
  return { ok: true };
}

export async function revertShopDoorPhotoToOriginal(orderId: string): Promise<CustomerDoorPhotoState> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { id: true, shopId: true, shop: { select: { photoUrl: true } } },
  });
  if (!order) return { error: "الطلب غير موجود" };
  if (!order.shop.photoUrl) return { error: "لا توجد صورة أصلية للمحل" };

  await prisma.order.update({
    where: { id: orderId },
    data: {
      shopDoorPhotoUrl: order.shop.photoUrl,
      shopDoorPhotoUploadedByName: "الأصلية",
    },
  });

  revalidatePath(`/admin/orders/${orderId}`);
  revalidatePath("/admin/shops");
  return { ok: true };
}
