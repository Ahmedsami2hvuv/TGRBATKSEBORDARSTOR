"use server";

import { randomUUID } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { uploadsAbsoluteDir } from "@/lib/upload-storage";
import {
  MAX_ORDER_IMAGE_BYTES,
  inferImageMime,
  saveOrderImageUploaded,
  saveCustomerDoorPhotoUploaded,
  saveShopDoorPhotoUploaded,
} from "@/lib/order-image";
import type { Prisma } from "@prisma/client";
import { isCourierPortalBlocked } from "@/lib/courier-delegate-access";
import { verifyDelegatePortalQuery } from "@/lib/delegate-link";
import { hasCustomerLocationUrl } from "@/lib/order-location";
import { reconcileMoneyEventsOnOrderStatusChange } from "@/lib/order-money-reconcile";
import {
  syncPhoneProfileFromOrder,
  syncSecondPhoneProfileFromOrder,
} from "@/lib/customer-phone-profile-sync";
import { prisma } from "@/lib/prisma";
import { safeMandoubReturn } from "@/lib/mandoub-loc-flash-url";
import { digitsOnly, normalizeIraqMobileLocal11 } from "@/lib/whatsapp";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

async function verifyDelegateAllowed(
  c: string,
  exp: string,
  s: string,
): Promise<{ ok: true; courierId: string } | { ok: false }> {
  const v = verifyDelegatePortalQuery(c, exp, s);
  if (!v.ok) return { ok: false };
  if (await isCourierPortalBlocked(v.courierId)) return { ok: false };
  return { ok: true, courierId: v.courierId };
}

function revalidateMandoubPaths(nextUrl: string) {
  revalidatePath("/mandoub");
  revalidatePath("/mandoub/wallet");
  const path = nextUrl.split("?")[0];
  if (path.startsWith("/mandoub/order/")) {
    revalidatePath(path);
  }
}

async function updateOrderWithMandoubStatusReconcile(
  orderId: string,
  prevStatus: string,
  data: Prisma.OrderUpdateInput,
) {
  const nextStatus =
    typeof data.status === "string" ? data.status : prevStatus;
  if (typeof data.status === "string" && nextStatus !== prevStatus) {
    await prisma.$transaction(async (tx) => {
      await reconcileMoneyEventsOnOrderStatusChange(tx, orderId, prevStatus, nextStatus);
      await tx.order.update({ where: { id: orderId }, data });
    });
  } else {
    await prisma.order.update({ where: { id: orderId }, data });
  }
}

async function courierUploaderLabel(courierId: string): Promise<string> {
  const row = await prisma.courier.findUnique({
    where: { id: courierId },
    select: { name: true },
  });
  return row?.name?.trim() || "مندوب";
}

/** يحدّث الطلب إلى «تم التسليم» بعد التحقق من الرابط الموقّع */
export async function markOrderDelivered(formData: FormData) {
  const c = String(formData.get("c") ?? "");
  const exp = String(formData.get("exp") ?? "");
  const s = String(formData.get("s") ?? "");
  const orderId = String(formData.get("orderId") ?? "").trim();
  const nextRaw = String(formData.get("next") ?? "/mandoub");

  const v = await verifyDelegateAllowed(c, exp, s);
  if (!v.ok) {
    redirect("/mandoub");
  }
  if (!orderId) {
    redirect(safeMandoubReturn(nextRaw));
  }

  const order = await prisma.order.findFirst({
    where: { id: orderId, assignedCourierId: v.courierId },
  });
  if (!order) {
    redirect(safeMandoubReturn(nextRaw));
  }
  if (order.status !== "assigned" && order.status !== "delivering") {
    redirect(safeMandoubReturn(nextRaw));
  }

  await prisma.order.update({
    where: { id: orderId },
    data: { status: "delivered" },
  });

  revalidateMandoubPaths(nextRaw);
  redirect(safeMandoubReturn(nextRaw));
}

/** المندوب أكّد استلام الطلب من المحل → «عند المندوب» */
export async function markOrderPickedUp(formData: FormData) {
  const c = String(formData.get("c") ?? "");
  const exp = String(formData.get("exp") ?? "");
  const s = String(formData.get("s") ?? "");
  const orderId = String(formData.get("orderId") ?? "").trim();
  const nextRaw = String(formData.get("next") ?? "/mandoub");

  const v = await verifyDelegateAllowed(c, exp, s);
  if (!v.ok) {
    redirect("/mandoub");
  }
  if (!orderId) {
    redirect(safeMandoubReturn(nextRaw));
  }

  const order = await prisma.order.findFirst({
    where: { id: orderId, assignedCourierId: v.courierId },
  });
  if (!order || order.status !== "assigned") {
    redirect(safeMandoubReturn(nextRaw));
  }

  await prisma.order.update({
    where: { id: orderId },
    data: { status: "delivering" },
  });

  revalidateMandoubPaths(nextRaw);
  redirect(safeMandoubReturn(nextRaw));
}

export type UploadDoorPhotoState = { error?: string; ok?: boolean };

/** رفع صورة المحل من جهاز المندوب — ملف فقط (يُخزَّن في shopDoorPhotoUrl) */
export async function uploadShopDoorPhoto(
  _prev: UploadDoorPhotoState,
  formData: FormData,
): Promise<UploadDoorPhotoState> {
  const c = String(formData.get("c") ?? "");
  const exp = String(formData.get("exp") ?? "");
  const s = String(formData.get("s") ?? "");
  const orderId = String(formData.get("orderId") ?? "").trim();
  const nextRaw = String(formData.get("next") ?? "/mandoub");

  const v = await verifyDelegateAllowed(c, exp, s);
  if (!v.ok) {
    return { error: "الرابط غير صالح. حدّث الصفحة." };
  }
  if (!orderId) {
    return { error: "معرّف الطلب مفقود" };
  }

  const file = formData.get("doorPhoto");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "اختر صورة من المعرض أو الكاميرا" };
  }

  const order = await prisma.order.findFirst({
    where: { id: orderId, assignedCourierId: v.courierId },
  });
  if (!order) {
    return { error: "الطلب غير موجود أو غير مسند إليك" };
  }

  let url: string;
  try {
    url = await saveShopDoorPhotoUploaded(file, MAX_ORDER_IMAGE_BYTES);
  } catch (e) {
    const code = e instanceof Error ? e.message : "";
    if (code === "IMAGE_TOO_LARGE") {
      return { error: "حجم الصورة كبير (الحد 10 ميجابايت)" };
    }
    if (code === "IMAGE_BAD_TYPE") {
      return { error: "استخدم JPG أو PNG أو Webp" };
    }
    if (code === "IMAGE_STORAGE_FAILED") {
      return {
        error:
          "تعذّر حفظ الصورة على الخادم. جرّب صورة أصغر أو أعد المحاولة لاحقاً.",
      };
    }
    return { error: "تعذّر حفظ الصورة" };
  }

  const uploadedBy = await courierUploaderLabel(v.courierId);
  await prisma.order.update({
    where: { id: orderId },
    data: { shopDoorPhotoUrl: url, shopDoorPhotoUploadedByName: uploadedBy },
  });
  await prisma.shop.update({
    where: { id: order.shopId },
    data: { photoUrl: url },
  });

  revalidateMandoubPaths(nextRaw);
  redirect(safeMandoubReturn(nextRaw));
}

export type MandoubEditCustomerState = {
  error?: string;
  ok?: boolean;
  flash?: "cleared" | "saved";
};

/** تعديل بيانات الزبون على الطلب + مزامنة سجل Customer */
export async function updateMandoubCustomerDetails(
  _prev: MandoubEditCustomerState,
  formData: FormData,
): Promise<MandoubEditCustomerState> {
  const c = String(formData.get("c") ?? "");
  const exp = String(formData.get("exp") ?? "");
  const s = String(formData.get("s") ?? "");
  const orderId = String(formData.get("orderId") ?? "").trim();
  const nextRaw = String(formData.get("next") ?? "/mandoub");
  const customerPhone = String(formData.get("customerPhone") ?? "").trim();
  const customerLocationUrl = String(formData.get("customerLocationUrl") ?? "").trim();
  const customerLandmark = String(formData.get("customerLandmark") ?? "").trim();
  const alternateRaw = String(formData.get("alternatePhone") ?? "").trim();
  const statusRaw = String(formData.get("status") ?? "").trim();

  const v = await verifyDelegateAllowed(c, exp, s);
  if (!v.ok) {
    return { error: "الرابط غير صالح." };
  }

  const phone = normalizeIraqMobileLocal11(customerPhone);
  if (!phone) {
    return {
      error:
        "رقم الزبون غير صالح. جرّب أي صيغة شائعة (07… أو +964… أو مع مسافات).",
    };
  }

  let alternateDigits: string | null = null;
  if (alternateRaw.trim()) {
    const alt = normalizeIraqMobileLocal11(alternateRaw);
    if (!alt) {
      return { error: "الرقم الثاني غير صالح أو اتركه فارغاً." };
    }
    if (alt === phone) {
      return { error: "الرقم الثاني يجب أن يختلف عن رقم الزبون الأساسي." };
    }
    alternateDigits = alt;
  }

  const order = await prisma.order.findFirst({
    where: { id: orderId, assignedCourierId: v.courierId },
  });
  if (!order) {
    return { error: "الطلب غير موجود أو غير مسند لك" };
  }

  const prevLocationUrl =
    order.customerLocationUrl?.trim() || "";
  const customerLocationUrlMerged =
    customerLocationUrl.trim() || prevLocationUrl;

  const prevLandmark =
    order.customerLandmark?.trim() || "";
  const customerLandmarkMerged =
    customerLandmark.trim() || prevLandmark;

  const locationUrlChanged = prevLocationUrl !== customerLocationUrlMerged;
  const clearCourierGpsFlag = locationUrlChanged
    ? ({
        customerLocationSetByCourierAt: null as Date | null,
        customerLocationUploadedByName: null as string | null,
      })
    : ({} as Record<string, never>);

  const mandoubAllowed = new Set(["assigned", "delivering", "delivered"]);
  let statusPatch: { status: string } | undefined;
  if (statusRaw) {
    if (!mandoubAllowed.has(statusRaw)) {
      return { error: "حالة الطلب غير صالحة" };
    }
    statusPatch = { status: statusRaw };
  }

  if (order.customerId) {
    await prisma.customer.update({
      where: { id: order.customerId },
      data: { phone },
    });
  } else {
    const existing = await prisma.customer.findFirst({
      where: { shopId: order.shopId, phone },
    });
    if (existing) {
      await prisma.customer.update({
        where: { id: existing.id },
        data: { phone },
      });
      await updateOrderWithMandoubStatusReconcile(orderId, order.status, {
        customer: { connect: { id: existing.id } },
        customerPhone: phone,
        customerLocationUrl: customerLocationUrlMerged,
        customerLandmark: customerLandmarkMerged,
        alternatePhone: alternateDigits,
        ...statusPatch,
        ...clearCourierGpsFlag,
      });
      await syncPhoneProfileFromOrder(orderId);
      revalidateMandoubPaths(nextRaw);
      redirect(safeMandoubReturn(nextRaw));
    }
    const created = await prisma.customer.create({
      data: {
        shopId: order.shopId,
        phone,
        name: "",
        customerRegionId: order.customerRegionId,
        customerLocationUrl: "",
        customerLandmark: "",
        alternatePhone: null,
        customerDoorPhotoUrl: null,
      },
    });
    await updateOrderWithMandoubStatusReconcile(orderId, order.status, {
      customer: { connect: { id: created.id } },
      customerPhone: phone,
      customerLocationUrl: customerLocationUrlMerged,
      customerLandmark: customerLandmarkMerged,
      alternatePhone: alternateDigits,
      ...statusPatch,
      ...clearCourierGpsFlag,
    });
    await syncPhoneProfileFromOrder(orderId);
    revalidateMandoubPaths(nextRaw);
    redirect(safeMandoubReturn(nextRaw));
  }

  await updateOrderWithMandoubStatusReconcile(orderId, order.status, {
    customerPhone: phone,
    customerLocationUrl: customerLocationUrlMerged,
    customerLandmark: customerLandmarkMerged,
    alternatePhone: alternateDigits,
    ...statusPatch,
    ...clearCourierGpsFlag,
  });

  await syncPhoneProfileFromOrder(orderId);
  revalidateMandoubPaths(nextRaw);
  redirect(safeMandoubReturn(nextRaw));
}

/**
 * حفظ موقع المندوب الحالي كرابط خرائط (لوكيشن الزبون).
 * بدون `replace=1` يُرفض إن وُجد لوكيشن مسبقاً؛ مع `replace=1` يُستبدل الموقع القديم.
 */
export async function setMandoubCustomerLocationFromGeolocation(
  _prev: MandoubEditCustomerState,
  formData: FormData,
): Promise<MandoubEditCustomerState> {
  const c = String(formData.get("c") ?? "");
  const exp = String(formData.get("exp") ?? "");
  const s = String(formData.get("s") ?? "");
  const orderId = String(formData.get("orderId") ?? "").trim();
  const nextRaw = String(formData.get("next") ?? "/mandoub");
  const replaceRaw = String(formData.get("replace") ?? "").trim();
  const replace = replaceRaw === "1" || replaceRaw === "true";
  const latRaw = formData.get("lat");
  const lngRaw = formData.get("lng");
  const lat =
    typeof latRaw === "string"
      ? Number(latRaw)
      : latRaw != null
        ? Number(latRaw)
        : NaN;
  const lng =
    typeof lngRaw === "string"
      ? Number(lngRaw)
      : lngRaw != null
        ? Number(lngRaw)
        : NaN;

  const v = await verifyDelegateAllowed(c, exp, s);
  if (!v.ok) {
    return { error: "الرابط غير صالح." };
  }
  if (!orderId) {
    return { error: "معرّف الطلب مفقود" };
  }
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return { error: "تعذّر قراءة الإحداثيات. أعد المحاولة." };
  }
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return { error: "إحداثيات خارج النطاق." };
  }

  const mapsUrl = `https://www.google.com/maps?q=${lat},${lng}`;

  const order = await prisma.order.findFirst({
    where: { id: orderId, assignedCourierId: v.courierId },
  });
  if (!order) {
    return { error: "الطلب غير موجود أو غير مسند لك" };
  }

  if (
    !replace &&
    hasCustomerLocationUrl(
      order.customerLocationUrl,
      undefined,
    )
  ) {
    return { error: "يوجد لوكيشن للزبون مسبقاً. استخدم تعديل الطلب لتغييره." };
  }

  const uploadedBy = await courierUploaderLabel(v.courierId);

  await prisma.order.update({
    where: { id: orderId },
    data: {
      customerLocationUrl: mapsUrl,
      customerLocationSetByCourierAt: new Date(),
      customerLocationUploadedByName: uploadedBy,
    },
  });

  await syncPhoneProfileFromOrder(orderId);
  revalidateMandoubPaths(nextRaw);
  return { ok: true, flash: "saved" as const };
}

/** مسح رابط موقع الزبون من الطلب وسجل العميل المرتبط (لو وجد). */
export async function clearMandoubCustomerLocation(
  _prev: MandoubEditCustomerState,
  formData: FormData,
): Promise<MandoubEditCustomerState> {
  const c = String(formData.get("c") ?? "");
  const exp = String(formData.get("exp") ?? "");
  const s = String(formData.get("s") ?? "");
  const orderId = String(formData.get("orderId") ?? "").trim();
  const nextRaw = String(formData.get("next") ?? "/mandoub");

  const v = await verifyDelegateAllowed(c, exp, s);
  if (!v.ok) {
    return { error: "الرابط غير صالح." };
  }
  if (!orderId) {
    return { error: "معرّف الطلب مفقود" };
  }

  const order = await prisma.order.findFirst({
    where: { id: orderId, assignedCourierId: v.courierId },
  });
  if (!order) {
    return { error: "الطلب غير موجود أو غير مسند لك" };
  }

  await prisma.order.update({
    where: { id: orderId },
    data: {
      customerLocationUrl: "",
      customerLocationSetByCourierAt: null,
      customerLocationUploadedByName: null,
    },
  });

  if (order.customerId) {
    await prisma.customer.update({
      where: { id: order.customerId },
      data: { customerLocationUrl: "" },
    });
  }

  await syncPhoneProfileFromOrder(orderId, { forceClearLocation: true } as any);
  revalidateMandoubPaths(nextRaw);
  return { ok: true, flash: "cleared" as const };
}

export type UploadCustomerDoorState = { error?: string };

/** رفع صورة باب الزبون — يحدّث الطلب وسجل الزبون */
export async function uploadMandoubCustomerDoorPhoto(
  _prev: UploadCustomerDoorState,
  formData: FormData,
): Promise<UploadCustomerDoorState> {
  const c = String(formData.get("c") ?? "");
  const exp = String(formData.get("exp") ?? "");
  const s = String(formData.get("s") ?? "");
  const orderId = String(formData.get("orderId") ?? "").trim();
  const nextRaw = String(formData.get("next") ?? "/mandoub");

  const v = await verifyDelegateAllowed(c, exp, s);
  if (!v.ok) {
    return { error: "الرابط غير صالح." };
  }
  if (!orderId) {
    return { error: "معرّف الطلب مفقود" };
  }

  const file = formData.get("customerDoorPhoto");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "التقط صورة أو اختر ملفاً من المعرض" };
  }

  const order = await prisma.order.findFirst({
    where: { id: orderId, assignedCourierId: v.courierId },
  });
  if (!order) {
    return { error: "الطلب غير موجود أو غير مسند لك" };
  }

  let url: string;
  try {
    url = await saveCustomerDoorPhotoUploaded(file, MAX_ORDER_IMAGE_BYTES);
  } catch (e) {
    const code = e instanceof Error ? e.message : "";
    if (code === "IMAGE_TOO_LARGE") {
      return { error: "حجم الصورة كبير (الحد 10 ميجابايت)" };
    }
    if (code === "IMAGE_BAD_TYPE") {
      return { error: "استخدم JPG أو PNG أو Webp" };
    }
    if (code === "IMAGE_STORAGE_FAILED") {
      return {
        error:
          "تعذّر حفظ الصورة على الخادم. جرّب صورة أصغر أو أعد المحاولة لاحقاً.",
      };
    }
    return { error: "تعذّر حفظ الصورة" };
  }

  const uploadedBy = await courierUploaderLabel(v.courierId);
  await prisma.order.update({
    where: { id: orderId },
    data: {
      customerDoorPhotoUrl: url,
      customerDoorPhotoUploadedByName: uploadedBy,
    },
  });

  const phone = digitsOnly(order.customerPhone);
  if (!order.customerId && phone.length === 11) {
    const cust = await prisma.customer.findFirst({
      where: { shopId: order.shopId, phone },
    });
    if (cust) {
      await prisma.order.update({
        where: { id: orderId },
        data: { customerId: cust.id },
      });
    }
  }

  await syncPhoneProfileFromOrder(orderId);
  revalidateMandoubPaths(nextRaw);
  redirect(safeMandoubReturn(nextRaw));
}

/** لـ `<form action>` بدون useActionState — متوافق مع توقيع Next.js 16 */
export async function uploadMandoubCustomerDoorPhotoSubmit(formData: FormData): Promise<void> {
  const result = await uploadMandoubCustomerDoorPhoto({}, formData);
  if (result.error) {
    const nextRaw = String(formData.get("next") ?? "/mandoub");
    redirect(safeMandoubReturn(nextRaw));
  }
}

/** رفع صورة باب الوجهة الثانية — لطلبات الوجهتين */
export async function uploadMandoubSecondCustomerDoorPhotoSubmit(
  formData: FormData,
): Promise<void> {
  const c = String(formData.get("c") ?? "");
  const exp = String(formData.get("exp") ?? "");
  const s = String(formData.get("s") ?? "");
  const orderId = String(formData.get("orderId") ?? "").trim();
  const nextRaw = String(formData.get("next") ?? "/mandoub");

  const v = await verifyDelegateAllowed(c, exp, s);
  if (!v.ok || !orderId) {
    redirect(safeMandoubReturn(nextRaw));
  }

  const file = formData.get("secondCustomerDoorPhoto");
  if (!(file instanceof File) || file.size === 0) {
    redirect(safeMandoubReturn(nextRaw));
  }

  const order = await prisma.order.findFirst({
    where: { id: orderId, assignedCourierId: v.courierId },
  });
  if (!order) {
    redirect(safeMandoubReturn(nextRaw));
  }

  let url: string;
  try {
    url = await saveCustomerDoorPhotoUploaded(file, MAX_ORDER_IMAGE_BYTES);
  } catch {
    redirect(safeMandoubReturn(nextRaw));
  }

  const uploadedBy = await courierUploaderLabel(v.courierId);
  await prisma.order.update({
    where: { id: orderId },
    data: {
      secondCustomerDoorPhotoUrl: url,
      secondCustomerDoorPhotoUploadedByName: uploadedBy,
    },
  });

  await syncSecondPhoneProfileFromOrder(orderId);
  revalidateMandoubPaths(nextRaw);
  redirect(safeMandoubReturn(nextRaw));
}

/** استبدال صورة الطلبية من المندوب — كاميرا أو معرض */
export async function uploadMandoubOrderImageSubmit(formData: FormData): Promise<void> {
  const c = String(formData.get("c") ?? "");
  const exp = String(formData.get("exp") ?? "");
  const s = String(formData.get("s") ?? "");
  const orderId = String(formData.get("orderId") ?? "").trim();
  const nextRaw = String(formData.get("next") ?? "/mandoub");

  const v = await verifyDelegateAllowed(c, exp, s);
  if (!v.ok) {
    redirect("/mandoub");
  }
  if (!orderId) {
    redirect(safeMandoubReturn(nextRaw));
  }

  const file = formData.get("orderImage");
  if (!(file instanceof File) || file.size === 0) {
    redirect(safeMandoubReturn(nextRaw));
  }

  const order = await prisma.order.findFirst({
    where: { id: orderId, assignedCourierId: v.courierId },
  });
  if (!order) {
    redirect(safeMandoubReturn(nextRaw));
  }

  let url: string;
  try {
    url = await saveOrderImageUploaded(file, MAX_ORDER_IMAGE_BYTES);
  } catch {
    redirect(safeMandoubReturn(nextRaw));
  }

  const uploadedBy = await courierUploaderLabel(v.courierId);
  await prisma.order.update({
    where: { id: orderId },
    data: { imageUrl: url, orderImageUploadedByName: uploadedBy },
  });

  revalidateMandoubPaths(nextRaw);
  redirect(safeMandoubReturn(nextRaw));
}

async function verifyDelegateOrder(
  formData: FormData,
): Promise<
  | { ok: false; next: string }
  | { ok: true; courierId: string; orderId: string; next: string }
> {
  const c = String(formData.get("c") ?? "");
  const exp = String(formData.get("exp") ?? "");
  const s = String(formData.get("s") ?? "");
  const orderId = String(formData.get("orderId") ?? "").trim();
  const nextRaw = String(formData.get("next") ?? "/mandoub");
  const next = safeMandoubReturn(nextRaw);
  const v = await verifyDelegateAllowed(c, exp, s);
  if (!v.ok || !orderId) {
    return { ok: false, next };
  }
  return { ok: true, courierId: v.courierId, orderId, next };
}

/** تبديل: دفع حساب العميل (المحل) */
export async function toggleOrderShopCostPaid(formData: FormData) {
  const r = await verifyDelegateOrder(formData);
  if (!r.ok) redirect(r.next);
  const order = await prisma.order.findFirst({
    where: { id: r.orderId, assignedCourierId: r.courierId },
  });
  if (!order) redirect(r.next);
  await prisma.order.update({
    where: { id: r.orderId },
    data: { shopCostPaidAt: order.shopCostPaidAt ? null : new Date() },
  });
  revalidateMandoubPaths(r.next);
  redirect(r.next);
}

/** تبديل: استلام تكاليف من الزبون */
export async function toggleOrderCustomerPaymentReceived(formData: FormData) {
  const r = await verifyDelegateOrder(formData);
  if (!r.ok) redirect(r.next);
  const order = await prisma.order.findFirst({
    where: { id: r.orderId, assignedCourierId: r.courierId },
  });
  if (!order) redirect(r.next);
  await prisma.order.update({
    where: { id: r.orderId },
    data: {
      customerPaymentReceivedAt: order.customerPaymentReceivedAt ? null : new Date(),
    },
  });
  revalidateMandoubPaths(r.next);
  redirect(r.next);
}

/** تبديل: تسوية تكاليف المندوب */
export async function toggleOrderCourierCashSettled(formData: FormData) {
  const r = await verifyDelegateOrder(formData);
  if (!r.ok) redirect(r.next);
  const order = await prisma.order.findFirst({
    where: { id: r.orderId, assignedCourierId: r.courierId },
  });
  if (!order) redirect(r.next);
  await prisma.order.update({
    where: { id: r.orderId },
    data: { courierCashSettledAt: order.courierCashSettledAt ? null : new Date() },
  });
  revalidateMandoubPaths(r.next);
  redirect(r.next);
}

export type MandoubBulkStatusState = { error?: string; ok?: boolean };

/** تحديد عدة طلبات من القائمة وتعيين حالتها (بانتظار المندوب / تم الاستلام / تم التسليم) */
export async function bulkSetMandoubOrdersStatus(
  _prev: MandoubBulkStatusState,
  formData: FormData,
): Promise<MandoubBulkStatusState> {
  const c = String(formData.get("c") ?? "");
  const exp = String(formData.get("exp") ?? "");
  const s = String(formData.get("s") ?? "");
  const orderIdsRaw = String(formData.get("orderIds") ?? "").trim();
  const targetStatus = String(formData.get("targetStatus") ?? "").trim();

  const v = await verifyDelegateAllowed(c, exp, s);
  if (!v.ok) {
    return { error: "الرابط غير صالح." };
  }

  const allowed = new Set(["assigned", "delivering", "delivered"]);
  if (!allowed.has(targetStatus)) {
    return { error: "الحالة غير صالحة." };
  }

  const ids = orderIdsRaw
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
  if (ids.length === 0) {
    return { error: "لم يُحدد أي طلب." };
  }

  for (const id of ids) {
    const order = await prisma.order.findFirst({
      where: { id, assignedCourierId: v.courierId },
    });
    if (!order) {
      continue;
    }
    if (order.status === "archived") {
      continue;
    }
    await updateOrderWithMandoubStatusReconcile(id, order.status, {
      status: targetStatus,
    });
  }

  revalidatePath("/mandoub");
  return { ok: true };
}

export type RevertShopDoorPhotoState = { error?: string; ok?: boolean };

/** الرجوع إلى صورة باب المحل الأصلية */
export async function revertShopDoorPhotoToOriginal(
  _prev: RevertShopDoorPhotoState,
  formData: FormData,
): Promise<RevertShopDoorPhotoState> {
  const c = String(formData.get("c") ?? "");
  const exp = String(formData.get("exp") ?? "");
  const s = String(formData.get("s") ?? "");
  const orderId = String(formData.get("orderId") ?? "").trim();
  const nextRaw = String(formData.get("next") ?? "/mandoub");

  const v = await verifyDelegateAllowed(c, exp, s);
  if (!v.ok) {
    return { error: "الرابط غير صالح." };
  }
  if (!orderId) {
    return { error: "معرّف الطلب مفقود" };
  }

  const order = await prisma.order.findFirst({
    where: { id: orderId, assignedCourierId: v.courierId },
    select: { id: true, shop: { select: { photoUrl: true } } },
  });
  if (!order) {
    return { error: "الطلب غير موجود أو غير مسند إليك" };
  }
  if (!order.shop.photoUrl) {
    return { error: "لا توجد صورة أصلية للمحل" };
  }

  await prisma.order.update({
    where: { id: orderId },
    data: {
      shopDoorPhotoUrl: order.shop.photoUrl,
      shopDoorPhotoUploadedByName: "الأصلية",
    },
  });

  revalidateMandoubPaths(nextRaw);
  redirect(safeMandoubReturn(nextRaw));
}
