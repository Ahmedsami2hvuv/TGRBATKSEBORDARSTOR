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
import { syncPhoneProfileFromOrder, syncSecondPhoneProfileFromOrder } from "@/lib/customer-phone-profile-sync";

const SECRET_ADMIN_PATH = "/abo1stor3hlaa2kbr8-47";

export type CustomerDoorPhotoState = { ok?: boolean; error?: string; photoUrl?: string };

function isValidUploadFile(f: unknown): f is File {
  return Boolean(
    f &&
    typeof f === "object" &&
    "size" in f &&
    typeof (f as any).size === "number" &&
    (f as any).size > 0 &&
    "arrayBuffer" in f &&
    typeof (f as any).arrayBuffer === "function"
  );
}

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
      customerRegionId: true,
      shopId: true,
      customerDoorPhotoUrl: true,
      secondCustomerDoorPhotoUrl: true,
    },
  });
  if (!order) {
    return { error: "الطلب غير موجود" };
  }

  const file = formData.get("customerDoorPhoto");
  const targetRaw = String(formData.get("target") ?? "first");
  const isSecond = targetRaw === "second";

  if (!isValidUploadFile(file)) {
    return { error: "اختر صورة أولاً" };
  }

  let photoUrl: string;
  try {
    const currentUrl = isSecond ? order.secondCustomerDoorPhotoUrl : order.customerDoorPhotoUrl;
    if (currentUrl) {
      try {
        await deleteFromR2(currentUrl);
      } catch (delErr) {
        console.error("Non-critical delete error from R2:", delErr);
      }
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

  try {
    await prisma.order.update({
      where: { id: order.id },
      data: isSecond ? {
        secondCustomerDoorPhotoUrl: photoUrl,
        secondCustomerDoorPhotoUploadedByName: ORDER_UPLOADER_ADMIN_LABEL,
      } : {
        customerDoorPhotoUrl: photoUrl,
        customerDoorPhotoUploadedByName: ORDER_UPLOADER_ADMIN_LABEL,
      },
    });

    if (!isSecond && order.customerId) {
      try {
        await prisma.customer.update({
          where: { id: order.customerId },
          data: { customerDoorPhotoUrl: photoUrl },
        });
      } catch (custErr) {
        console.error("Non-critical customer update error:", custErr);
      }
    }
  } catch (dbErr: any) {
    console.error("Failed to update order with customer door photo:", dbErr);
    return { error: "تعذّر حفظ الصورة في بيانات الطلب" };
  }

  try {
    if (isSecond) {
      await syncSecondPhoneProfileFromOrder(order.id);
    } else {
      await syncPhoneProfileFromOrder(order.id);
    }
  } catch (syncErr) {
    console.error("Non-critical profile sync error:", syncErr);
  }

  try {
    revalidatePath(`${SECRET_ADMIN_PATH}/orders/tracking`);
    revalidatePath(`${SECRET_ADMIN_PATH}/orders/pending`);
    revalidatePath(`${SECRET_ADMIN_PATH}/orders/${order.id}`);
    revalidatePath(`${SECRET_ADMIN_PATH}/orders/${order.id}/edit`);
    revalidatePath(`/mandoub/order/${order.id}`);
    revalidatePath("/mandoub");
  } catch {
    /* ignore revalidation errors */
  }

  return { ok: true, photoUrl };
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
  if (!isValidUploadFile(file)) return { error: "اختر صورة أولاً" };

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

  const file =
    formData.get("orderPhoto") ||
    formData.get("orderImage") ||
    formData.get("orderImageCamera") ||
    formData.get("orderImageGallery");
  if (!isValidUploadFile(file)) return { error: "اختر صورة أولاً" };

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
  revalidatePath(`/mandoub/order/${order.id}`);
  return { ok: true, photoUrl };
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

    if (isSecond) {
      await syncSecondPhoneProfileFromOrder(orderId);
    } else {
      await syncPhoneProfileFromOrder(orderId);
    }

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

export async function pasteCustomerLocationFromView(
  orderId: string,
  _prev: CustomerDoorPhotoState,
  formData: FormData,
): Promise<CustomerDoorPhotoState> {
  const urlRaw = formData.get("locationUrl");
  const targetRaw = String(formData.get("target") ?? "first");
  const isSecond = targetRaw === "second";

  if (typeof urlRaw !== "string" || !urlRaw.trim()) {
    return { error: "يرجى إدخال رابط الموقع الجغرافي" };
  }
  const locationUrl = urlRaw.trim();

  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) return { error: "الطلب غير موجود" };

  try {
    await prisma.order.update({
      where: { id: orderId },
      data: isSecond ? {
        secondCustomerLocationUrl: locationUrl,
        customerLocationSetByCourierAt: null,
        customerLocationUploadedByName: ORDER_UPLOADER_ADMIN_LABEL,
      } : {
        customerLocationUrl: locationUrl,
        customerLocationSetByCourierAt: null,
        customerLocationUploadedByName: ORDER_UPLOADER_ADMIN_LABEL,
      },
    });

    if (isSecond) {
      await syncSecondPhoneProfileFromOrder(orderId);
    } else {
      await syncPhoneProfileFromOrder(orderId);
    }

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
  revalidatePath(`${SECRET_ADMIN_PATH}/orders/tracking`);
  revalidatePath(`${SECRET_ADMIN_PATH}/orders/pending`);
  revalidatePath(`${SECRET_ADMIN_PATH}/orders/${orderId}`);
  revalidatePath(`${SECRET_ADMIN_PATH}/orders/${orderId}/edit`);
  revalidatePath("/mandoub");
  return { ok: true };
}

export async function deleteCustomerDoorPhotoAction(
  orderId: string,
  isSecond: boolean = false
): Promise<CustomerDoorPhotoState> {
  const existing = await prisma.order.findUnique({
    where: { id: orderId },
    select: { customerDoorPhotoUrl: true, secondCustomerDoorPhotoUrl: true }
  });

  const urlToDelete = isSecond ? existing?.secondCustomerDoorPhotoUrl : existing?.customerDoorPhotoUrl;

  if (urlToDelete) {
    await deleteFromR2(urlToDelete);
  }

  await prisma.order.update({
    where: { id: orderId },
    data: isSecond ? {
      secondCustomerDoorPhotoUrl: null
    } : {
      customerDoorPhotoUrl: null,
      customerDoorPhotoUploadedByName: null
    },
  });
  revalidatePath(`${SECRET_ADMIN_PATH}/orders/tracking`);
  revalidatePath(`${SECRET_ADMIN_PATH}/orders/pending`);
  revalidatePath(`${SECRET_ADMIN_PATH}/orders/${orderId}`);
  revalidatePath(`${SECRET_ADMIN_PATH}/orders/${orderId}/edit`);
  revalidatePath("/mandoub");
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

  revalidatePath(`${SECRET_ADMIN_PATH}/orders/tracking`);
  revalidatePath(`${SECRET_ADMIN_PATH}/orders/pending`);
  revalidatePath(`${SECRET_ADMIN_PATH}/orders/${orderId}`);
  revalidatePath(`${SECRET_ADMIN_PATH}/orders/${orderId}/edit`);
  revalidatePath(`${SECRET_ADMIN_PATH}/shops`);
  revalidatePath("/mandoub");
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
