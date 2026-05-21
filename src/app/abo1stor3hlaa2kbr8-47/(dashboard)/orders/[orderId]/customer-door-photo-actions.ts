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
import { deleteFromR2 } from "@/lib/upload-storage";
import { syncPhoneProfileFromOrder } from "@/lib/customer-phone-profile-sync";

const SECRET_ADMIN_PATH = "/abo1stor3hlaa2kbr8-47";

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
      customerDoorPhotoUrl: true,
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
    if (order.customerDoorPhotoUrl) {
      await deleteFromR2(order.customerDoorPhotoUrl);
    }
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
    select: { id: true, shopId: true, shopDoorPhotoUrl: true },
  });
  if (!order) return { error: "الطلب غير موجود" };

  const file = formData.get("shopDoorPhoto");
  if (!(file instanceof File) || file.size <= 0) return { error: "اختر صورة أولاً" };

  const shop = await prisma.shop.findUnique({
    where: { id: order.shopId },
    select: { photoUrl: true }
  }) as any;

  let photoUrl: string;
  try {
    // مسح صورة الطلب القديمة
    if (order.shopDoorPhotoUrl) {
      await deleteFromR2(order.shopDoorPhotoUrl);
    }

    // مسح صورة المحل الحالية إذا لم تكن هي "الأصلية"
    const originalPhoto = shop?.originalPhotoUrl || shop?.photoUrl;
    if (shop?.photoUrl && shop.photoUrl !== originalPhoto) {
      await deleteFromR2(shop.photoUrl);
    }

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

  // تحديث صورة المحل الحالية (هذه تصبح الصورة رقم 2)
  await prisma.shop.update({
    where: { id: order.shopId },
    data: { photoUrl },
  });

  revalidatePath(`${SECRET_ADMIN_PATH}/orders/tracking`);
  revalidatePath(`${SECRET_ADMIN_PATH}/orders/pending`);
  revalidatePath(`${SECRET_ADMIN_PATH}/orders/${order.id}`);
  revalidatePath(`${SECRET_ADMIN_PATH}/orders/${order.id}/edit`);
  revalidatePath(`${SECRET_ADMIN_PATH}/shops`);
  revalidatePath(`${SECRET_ADMIN_PATH}/shops/${order.shopId}/edit`);
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
    select: { id: true, imageUrl: true },
  });
  if (!order) return { error: "الطلب غير موجود" };

  const file = formData.get("orderPhoto");
  if (!(file instanceof File) || file.size <= 0) return { error: "اختر صورة أولاً" };

  let photoUrl: string;
  try {
    if (order.imageUrl) {
      await deleteFromR2(order.imageUrl);
    }
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

  revalidatePath(`${SECRET_ADMIN_PATH}/orders/tracking`);
  revalidatePath(`${SECRET_ADMIN_PATH}/orders/pending`);
  revalidatePath(`${SECRET_ADMIN_PATH}/orders/${order.id}`);
  revalidatePath(`${SECRET_ADMIN_PATH}/orders/${order.id}/edit`);
  revalidatePath("/mandoub");
  return { ok: true };
}

export async function uploadCustomerLocationFromView(
  orderId: string,
  _prev: CustomerDoorPhotoState,
  formData: FormData,
): Promise<CustomerDoorPhotoState> {
  const latRaw = formData.get("lat");
  const lngRaw = formData.get("lng");
  const targetRaw = String(formData.get("target") ?? "first");
  const isSecond = targetRaw === "second";

  const lat = typeof latRaw === "string" ? Number(latRaw) : NaN;
  const lng = typeof lngRaw === "string" ? Number(lngRaw) : NaN;

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return { error: "إحداثيات غير صالحة" };
  }
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return { error: "إحداثيات خارج النطاق" };
  }

  const mapsUrl = `https://www.google.com/maps?q=${lat},${lng}`;

  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) return { error: "الطلب غير موجود" };

  try {
    await prisma.order.update({
      where: { id: orderId },
      data: isSecond ? {
        secondCustomerLocationUrl: mapsUrl,
        customerLocationSetByCourierAt: null,
        customerLocationUploadedByName: ORDER_UPLOADER_ADMIN_LABEL,
      } : {
        customerLocationUrl: mapsUrl,
        customerLocationSetByCourierAt: null,
        customerLocationUploadedByName: ORDER_UPLOADER_ADMIN_LABEL,
      },
    });

    await syncPhoneProfileFromOrder(orderId);

    revalidatePath(`${SECRET_ADMIN_PATH}/orders/tracking`);
    revalidatePath(`${SECRET_ADMIN_PATH}/orders/pending`);
    revalidatePath(`${SECRET_ADMIN_PATH}/orders/${orderId}`);
    revalidatePath(`${SECRET_ADMIN_PATH}/orders/${orderId}/edit`);
    revalidatePath("/mandoub");
    return { ok: true };
  } catch {
    return { error: "فشل التحديث" };
  }
}

export async function deleteOrderImageAction(orderId: string): Promise<CustomerDoorPhotoState> {
  const existing = await prisma.order.findUnique({ where: { id: orderId }, select: { imageUrl: true } });
  if (existing?.imageUrl) {
    await deleteFromR2(existing.imageUrl);
  }
  await prisma.order.update({
    where: { id: orderId },
    data: { imageUrl: null, orderImageUploadedByName: null },
  });
  revalidatePath(`${SECRET_ADMIN_PATH}/orders/${orderId}`);
  return { ok: true };
}

export async function deleteCustomerDoorPhotoAction(orderId: string): Promise<CustomerDoorPhotoState> {
  const existing = await prisma.order.findUnique({ where: { id: orderId }, select: { customerDoorPhotoUrl: true } });
  if (existing?.customerDoorPhotoUrl) {
    await deleteFromR2(existing.customerDoorPhotoUrl);
  }
  await prisma.order.update({
    where: { id: orderId },
    data: { customerDoorPhotoUrl: null, customerDoorPhotoUploadedByName: null },
  });
  // ملاحظة: قد تحتاج لمزامنة PhoneProfile إن كان هذا السلوك مطلوباً
  revalidatePath(`${SECRET_ADMIN_PATH}/orders/${orderId}`);
  return { ok: true };
}

export async function deleteShopDoorPhotoAction(orderId: string): Promise<CustomerDoorPhotoState> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { id: true, shopDoorPhotoUrl: true },
  });
  if (!order) return { error: "الطلب غير موجود" };

  if (order.shopDoorPhotoUrl) {
    await deleteFromR2(order.shopDoorPhotoUrl);
  }

  await prisma.order.update({
    where: { id: orderId },
    data: { shopDoorPhotoUrl: null, shopDoorPhotoUploadedByName: null },
  });

  // لا نمسح صورة المحل الأساسية لأنها قد تُستخدم في طلبيات أخرى
  // هذا يضمن أن مسح صورة واحدة لا يؤثر على الطلبيات الأخرى

  revalidatePath(`${SECRET_ADMIN_PATH}/orders/${orderId}`);
  revalidatePath(`${SECRET_ADMIN_PATH}/shops`);
  return { ok: true };
}

export async function revertShopDoorPhotoToOriginal(orderId: string): Promise<CustomerDoorPhotoState> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { id: true, shopId: true, shopDoorPhotoUrl: true, shop: { select: { photoUrl: true } } },
  }) as any;
  if (!order) return { error: "الطلب غير موجود" };

  const original = order.shop.originalPhotoUrl || order.shop.photoUrl;
  if (!original) return { error: "لا توجد صورة أصلية للمحل" };

  // إذا كانت الصورة الحالية في الطلب ليست هي الأصل، نمسحها
  if (order.shopDoorPhotoUrl && order.shopDoorPhotoUrl !== original) {
    await deleteFromR2(order.shopDoorPhotoUrl);
  }

  // إذا كانت صورة المحل الحالية ليست هي الأصل، نمسحها
  if (order.shop.photoUrl && order.shop.photoUrl !== original) {
    await deleteFromR2(order.shop.photoUrl);
  }

  await prisma.order.update({
    where: { id: orderId },
    data: {
      shopDoorPhotoUrl: original,
      shopDoorPhotoUploadedByName: "الأصلية",
    },
  });

  await prisma.shop.update({
    where: { id: order.shopId },
    data: { photoUrl: original }
  });

  revalidatePath(`${SECRET_ADMIN_PATH}/orders/${orderId}`);
  revalidatePath(`${SECRET_ADMIN_PATH}/shops`);
  return { ok: true };
}
