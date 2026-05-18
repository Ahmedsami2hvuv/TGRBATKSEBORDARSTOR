"use server";

import { Decimal } from "@prisma/client/runtime/library";
import { unlink } from "fs/promises";
import path from "path";
import { cookies } from "next/headers";
import { syncPhoneProfileFromOrder } from "@/lib/customer-phone-profile-sync";
import { computeCourierDeliveryEarningDinar } from "@/lib/courier-earnings";
import {
  MAX_ORDER_IMAGE_BYTES,
  saveOrderImageUploaded,
  saveCustomerDoorPhotoUploaded,
} from "@/lib/order-image";
import { syncOrderCourierMoneyExpectations } from "@/lib/order-courier-money-sync";
import { prisma } from "@/lib/prisma";
import { deleteFromR2, getUploadsRoot } from "@/lib/upload-storage";
import { MAX_VOICE_NOTE_BYTES, saveVoiceNoteUploaded } from "@/lib/voice-note";
import { parseOptionalAlfInputToDinar } from "@/lib/money-alf";
import { ORDER_UPLOADER_ADMIN_LABEL } from "@/lib/order-uploader-label";
import { normalizeIraqMobileLocal11 } from "@/lib/whatsapp";
import { adminCookieName, verifyAdminToken } from "@/lib/auth";
import { reconcileMoneyEventsOnOrderStatusChange } from "@/lib/order-money-reconcile";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { withReversePickupPrefix } from "@/lib/order-type-flags";

async function assertAdmin(): Promise<boolean> {
  const jar = await cookies();
  const t = jar.get(adminCookieName)?.value ?? "";
  return !!(t && (await verifyAdminToken(t)));
}

function revalidateAdminOrderPaths(orderId: string) {
  revalidatePath("/admin/orders/tracking");
  revalidatePath("/admin/orders/pending");
  revalidatePath("/admin/orders/rejected");
  revalidatePath("/admin/orders/archived");
  revalidatePath("/mandoub");
  revalidatePath(`/admin/orders/${orderId}/edit`);
  revalidatePath(`/admin/orders/${orderId}`);
}

export type AdminOrderLocationAction = {
  ok?: boolean;
  error?: string;
  locationUrl?: string;
};

export async function clearOrderCustomerLocationAdmin(
  orderId: string,
): Promise<AdminOrderLocationAction> {
  if (!(await assertAdmin())) return { error: "غير مصرّح" };
  const existing = await prisma.order.findUnique({ where: { id: orderId } });
  if (!existing) return { error: "الطلب غير موجود" };

  await prisma.order.update({
    where: { id: orderId },
    data: {
      customerLocationUrl: "",
      customerLocationSetByCourierAt: null,
      customerLocationUploadedByName: null,
    },
  });

  if (existing.customerId) {
    await prisma.customer.update({
      where: { id: existing.customerId },
      data: { customerLocationUrl: "" },
    });
  }

  await syncPhoneProfileFromOrder(orderId, { forceClearLocation: true });
  revalidateAdminOrderPaths(orderId);
  return { ok: true };
}

export async function setAdminOrderCustomerLocationFromGeolocation(
  orderId: string,
  lat: number,
  lng: number,
): Promise<AdminOrderLocationAction> {
  if (!(await assertAdmin())) return { error: "غير مصرّح" };
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return { error: "تعذّر قراءة الإحداثيات." };
  const mapsUrl = `https://www.google.com/maps?q=${lat},${lng}`;
  const existing = await prisma.order.findUnique({ where: { id: orderId } });
  if (!existing) return { error: "الطلب غير موجود" };

  await prisma.order.update({
    where: { id: orderId },
    data: {
      customerLocationUrl: mapsUrl,
      customerLocationSetByCourierAt: null,
      customerLocationUploadedByName: ORDER_UPLOADER_ADMIN_LABEL,
    },
  });
  await syncPhoneProfileFromOrder(orderId);
  revalidateAdminOrderPaths(orderId);
  return { ok: true, locationUrl: mapsUrl };
}

export async function deleteOrderImageAdmin(orderId: string): Promise<OrderEditState> {
  if (!(await assertAdmin())) return { error: "غير مصرّح" };
  const existing = await prisma.order.findUnique({
    where: { id: orderId },
    select: { imageUrl: true }
  });

  if (existing?.imageUrl) {
    await deleteFromR2(existing.imageUrl);
  }

  await prisma.order.update({
    where: { id: orderId },
    data: {
      imageUrl: null,
      orderImageUploadedByName: null,
    },
  });

  revalidateAdminOrderPaths(orderId);
  revalidatePath(`/preparer/order/${orderId}`);
  return { ok: true };
}

async function unlinkUploadIfAny(url: string | null | undefined): Promise<void> {
  const u = url?.trim();
  if (!u || !u.startsWith("/uploads/")) return;
  try {
    const rel = u.replace(/^\/uploads\/?/, "");
    await unlink(path.join(getUploadsRoot(), rel));
  } catch {}
}

export type PendingCustomerImport = {
  customerId: string;
  regionName: string | null;
  customerName: string;
  locationUrl: string;
  landmark: string;
  alternatePhone: string;
  hasDoorPhoto: boolean;
  doorPhotoUrl: string;
};

export type OrderEditState = {
  error?: string;
  ok?: boolean;
  pendingCustomerImport?: PendingCustomerImport;
};

export async function updateOrderAdmin(
  orderId: string,
  _prev: OrderEditState,
  formData: FormData,
): Promise<OrderEditState> {
  if (!(await assertAdmin())) return { error: "غير مصرّح" };

  const isBlocked = formData.get("isBlocked") === "on";
  const shopId = String(formData.get("shopId") ?? "").trim();
  const status = String(formData.get("status") ?? "").trim();
  const orderTypeRaw = String(formData.get("orderType") ?? "").trim();
  const summary = String(formData.get("summary") ?? "").trim();
  const customerPhone = String(formData.get("customerPhone") ?? "").trim();
  const alternatePhone = String(formData.get("alternatePhone") ?? "").trim();
  const customerLocationUrl = String(formData.get("customerLocationUrl") ?? "").trim();
  const customerLandmark = String(formData.get("customerLandmark") ?? "").trim();
  const customerRegionId = String(formData.get("customerRegionId") ?? "").trim();
  const orderNoteTime = String(formData.get("orderNoteTime") ?? "").trim();
  const courierRaw = String(formData.get("assignedCourierId") ?? "").trim();
  const customerIdRaw = String(formData.get("customerId") ?? "").trim();
  const submittedByEmployeeIdRaw = String(formData.get("submittedByEmployeeId") ?? "").trim();
  const prepaidAll = formData.get("prepaidAll") === "on";
  const reversePickup = formData.get("reversePickup") === "on";

  const orderType = withReversePickupPrefix(orderTypeRaw, reversePickup);

  if (!orderNoteTime) return { error: "وقت الطلب إجباري" };

  const sub = parseOptionalAlfInputToDinar(String(formData.get("orderSubtotal") ?? ""));
  const del = parseOptionalAlfInputToDinar(String(formData.get("deliveryPrice") ?? ""));
  const tot = parseOptionalAlfInputToDinar(String(formData.get("totalAmount") ?? ""));

  if (!sub.ok) return { error: "سعر الطلب غير صالح" };
  if (!del.ok) return { error: "سعر التوصيل غير صالح" };
  if (!tot.ok) return { error: "المجموع غير صالح" };

  const subVal = sub.value;
  const delVal = del.value;
  const totVal = tot.value;

  const existing = await prisma.order.findUnique({ where: { id: orderId } });
  if (!existing) return { error: "الطلب غير موجود" };

  const shop = await prisma.shop.findUnique({ where: { id: shopId } });
  if (!shop) return { error: "المحل غير موجود" };

  const phoneLocal = normalizeIraqMobileLocal11(customerPhone);
  if (!phoneLocal) return { error: "رقم الزبون غير صالح" };

  const importChoice = String(formData.get("customerImportChoice") ?? "").trim();
  let effectiveLocationUrl = customerLocationUrl;
  let effectiveLandmark = customerLandmark;
  let effectiveLinkedCustomerId: string | null = customerIdRaw || null;
  let doorPhotoFromImport: string | undefined;

  if (importChoice === "confirm") {
    const importId = String(formData.get("importCustomerId") ?? "").trim();
    const importCust = await prisma.customer.findFirst({ where: { id: importId, shopId, phone: phoneLocal } });
    if (importCust) {
      effectiveLinkedCustomerId = importCust.id;
      effectiveLocationUrl = importCust.customerLocationUrl?.trim() || customerLocationUrl;
      effectiveLandmark = importCust.customerLandmark?.trim() || customerLandmark;
      if (importCust.customerDoorPhotoUrl?.trim()) doorPhotoFromImport = importCust.customerDoorPhotoUrl.trim();
    }
  }

  let nextImageUrl: string | undefined = undefined;
  const orderImg = formData.get("orderImage");
  if (orderImg instanceof File && orderImg.size > 0) {
    try {
      // مسح الصورة القديمة إذا وجدت قبل رفع الجديدة
      if (existing.imageUrl) {
        await deleteFromR2(existing.imageUrl);
      }
      nextImageUrl = await saveOrderImageUploaded(orderImg, MAX_ORDER_IMAGE_BYTES);
    } catch (e: any) {
      console.error("Order image upload failed:", e);
      return { error: "حجم الصورة كبير جداً أو التنسيق غير مدعوم." };
    }
  }

  const totalFromSubDel = subVal != null && delVal != null
      ? new Decimal(subVal).plus(new Decimal(delVal))
      : totVal != null ? new Decimal(totVal) : null;

  let nextArchivedAt: Date | null | undefined = undefined;
  if (existing.status !== status) {
    if (status === "archived") nextArchivedAt = new Date();
    else if (existing.status === "archived") nextArchivedAt = null;
  }

  let assignedCourierId: string | null = courierRaw || null;
  if (status === "pending" || status === "cancelled" || status === "archived") assignedCourierId = null;

  await prisma.$transaction(async (tx) => {
    if (existing.status !== status) {
      await reconcileMoneyEventsOnOrderStatusChange(tx, orderId, existing.status, status);
    }

    const updateData: Parameters<typeof tx.order.update>[0]["data"] = {
      shopId,
      submittedByEmployeeId: submittedByEmployeeIdRaw || null,
      customerId: effectiveLinkedCustomerId,
      status,
      orderType,
      summary,
      customerPhone: phoneLocal,
      alternatePhone: alternatePhone.trim() ? normalizeIraqMobileLocal11(alternatePhone) : null,
      customerLocationUrl: effectiveLocationUrl,
      customerLandmark: effectiveLandmark,
      customerRegionId: customerRegionId || null,
      orderSubtotal: subVal,
      deliveryPrice: delVal,
      totalAmount: totalFromSubDel,
      orderNoteTime,
      assignedCourierId,
      ...(nextImageUrl != null ? { imageUrl: nextImageUrl, orderImageUploadedByName: ORDER_UPLOADER_ADMIN_LABEL } : {}),
      prepaidAll,
      ...(nextArchivedAt !== undefined ? { archivedAt: nextArchivedAt } : {}),
    };

    if (status === "delivered" && assignedCourierId && delVal != null) {
      const courier = await tx.courier.findUnique({ where: { id: assignedCourierId } });
      if (courier) {
        const earning = computeCourierDeliveryEarningDinar(
          courier.vehicleType,
          new Decimal(delVal),
        );
        updateData.courierEarningDinar = earning;
        updateData.courierEarningForCourierId = earning != null ? assignedCourierId : null;
      }
    }

    await tx.order.update({
      where: { id: orderId },
      data: updateData,
    });
    await syncOrderCourierMoneyExpectations(tx, orderId);
  });

  await syncPhoneProfileFromOrder(orderId);

  if (isBlocked) {
    await blockCustomerAction(phoneLocal);
  } else {
    // We don't automatically unblock globally when one order is edited,
    // but we can unblock for this region if needed.
    // For now, let's keep it consistent.
  }

  revalidateAdminOrderPaths(orderId);
  if (status === "archived") redirect("/admin/orders/archived");
  redirect("/admin/orders/tracking");
}

export async function blockCustomerAction(phone: string) {
  if (!(await assertAdmin())) return { error: "غير مصرّح" };
  const phoneLocal = normalizeIraqMobileLocal11(phone);
  if (!phoneLocal) return { error: "بيانات غير صالحة" };

  const BLOCKED_PREFIX = "🔴 الزبون ممنوع من التوصيل";

  await prisma.$transaction(async (tx) => {
    // 1. Add to Global Block List
    await tx.globalBlockedPhone.upsert({
      where: { phone: phoneLocal },
      create: { phone: phoneLocal },
      update: {},
    });

    // 2. Update all existing profiles for this phone to be isBlocked = true
    const profiles = await tx.customerPhoneProfile.findMany({
      where: { phone: phoneLocal },
    });

    for (const profile of profiles) {
      const nextLandmark = profile.landmark.includes(BLOCKED_PREFIX)
        ? profile.landmark
        : `${BLOCKED_PREFIX} ${profile.landmark}`.trim();

      await tx.customerPhoneProfile.update({
        where: { id: profile.id },
        data: {
          isBlocked: true,
          landmark: nextLandmark,
        },
      });
    }

    // 3. Update all active orders for this phone in ANY region
    await tx.order.updateMany({
      where: {
        customerPhone: phoneLocal,
        status: { in: ["pending", "assigned", "delivering"] },
      },
      data: {
        customerLandmark: {
          set: BLOCKED_PREFIX, // Note: We might want to prepend if we had the original landmark, but order might have its own.
        },
      },
    });
  });

  return { ok: true };
}

export async function unblockCustomerAction(phone: string) {
  if (!(await assertAdmin())) return { error: "غير مصرّح" };
  const phoneLocal = normalizeIraqMobileLocal11(phone);
  if (!phoneLocal) return { error: "بيانات غير صالحة" };

  const BLOCKED_PREFIX = "🔴 الزبون ممنوع من التوصيل";

  await prisma.$transaction(async (tx) => {
    // 1. Remove from Global Block List
    await tx.globalBlockedPhone.deleteMany({
      where: { phone: phoneLocal },
    });

    // 2. Update all profiles
    const profiles = await tx.customerPhoneProfile.findMany({
      where: { phone: phoneLocal },
    });

    for (const profile of profiles) {
      const nextLandmark = profile.landmark.replace(BLOCKED_PREFIX, "").trim();
      await tx.customerPhoneProfile.update({
        where: { id: profile.id },
        data: {
          isBlocked: false,
          landmark: nextLandmark,
        },
      });
    }

    // Note: We don't easily know the original landmark for orders to restore it,
    // but usually unblocking is followed by manual correction or next order prefill.
  });

  return { ok: true };
}
