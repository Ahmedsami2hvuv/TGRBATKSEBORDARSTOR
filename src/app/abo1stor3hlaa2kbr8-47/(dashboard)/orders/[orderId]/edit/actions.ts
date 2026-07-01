"use server";

import { Decimal } from "@prisma/client/runtime/library";
import { unlink } from "fs/promises";
import path from "path";
import { cookies } from "next/headers";
import { syncPhoneProfileFromOrder, syncSecondPhoneProfileFromOrder } from "@/lib/customer-phone-profile-sync";
import { computeCourierDeliveryEarningDinar } from "@/lib/courier-earnings";
import { notifyTelegramStaffOrderUpdate } from "@/lib/telegram-notify";
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

const SECRET_ADMIN_PATH = "/abo1stor3hlaa2kbr8-47";

function revalidateAdminOrderPaths(orderId: string) {
  revalidatePath(`${SECRET_ADMIN_PATH}/orders/tracking`);
  revalidatePath(`${SECRET_ADMIN_PATH}/orders/pending`);
  revalidatePath(`${SECRET_ADMIN_PATH}/orders/rejected`);
  revalidatePath(`${SECRET_ADMIN_PATH}/orders/archived`);
  revalidatePath("/mandoub");
  revalidatePath(`${SECRET_ADMIN_PATH}/orders/${orderId}/edit`);
  revalidatePath(`${SECRET_ADMIN_PATH}/orders/${orderId}`);
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
  await syncSecondPhoneProfileFromOrder(orderId);
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
    const root = getUploadsRoot();
    if (!root) return;
    const absPath = path.join(String(root), rel);
    await unlink(absPath);
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

  const secondCustomerPhone = String(formData.get("secondCustomerPhone") ?? "").trim();
  const secondCustomerAlternatePhone = String(formData.get("secondCustomerAlternatePhone") ?? "").trim();
  const secondCustomerLocationUrl = String(formData.get("secondCustomerLocationUrl") ?? "").trim();
  const secondCustomerLandmark = String(formData.get("secondCustomerLandmark") ?? "").trim();
  const secondCustomerRegionId = String(formData.get("secondCustomerRegionId") ?? "").trim();

  const orderNoteTime = String(formData.get("orderNoteTime") ?? "").trim();
  const courierRaw = String(formData.get("assignedCourierId") ?? "").trim();
  const customerIdRaw = String(formData.get("customerId") ?? "").trim();
  const submittedByEmployeeIdRaw = String(formData.get("submittedByEmployeeId") ?? "").trim();
  const prepaidAll = formData.get("prepaidAll") === "on";
  const reversePickup = formData.get("reversePickup") === "on";

  const orderType = withReversePickupPrefix(orderTypeRaw, reversePickup);

  if (!orderNoteTime) {
    // لم نعد نجبر وقت الطلب لكي لا يفشل التحديث، يمكن تركه فارغاً.
  }

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

    // منطق تحديث أرباح الموظف إذا كان الطلب من بوابة الموظفين (routeMode = double)
    let nextPreparerShoppingJson = existing.preparerShoppingJson;
    if (existing.routeMode === "double" && nextPreparerShoppingJson && typeof nextPreparerShoppingJson === "object") {
      const json = { ...(nextPreparerShoppingJson as any) };
      const oldSub = existing.orderSubtotal ? new Decimal(existing.orderSubtotal) : new Decimal(0);
      const newSub = subVal ? new Decimal(subVal) : new Decimal(0);

      if (!oldSub.equals(newSub)) {
        const diff = newSub.minus(oldSub);
        const oldProfit = new Decimal(json.staffProfit || 0);
        // الربح الجديد = الربح القديم + الفرق (سواء زيادة أو نقصان)
        json.staffProfit = oldProfit.plus(diff).toNumber();
        nextPreparerShoppingJson = json;
      }
    }

  const updateData: any = {
      shop: { connect: { id: shopId } },
      submittedBy: submittedByEmployeeIdRaw ? { connect: { id: submittedByEmployeeIdRaw } } : { disconnect: true },
      customer: effectiveLinkedCustomerId ? { connect: { id: effectiveLinkedCustomerId } } : { disconnect: true },
      status,
      orderType,
      summary,
      customerPhone: phoneLocal,
      alternatePhone: alternatePhone.trim() ? normalizeIraqMobileLocal11(alternatePhone) : null,
      customerLocationUrl: effectiveLocationUrl,
      customerLandmark: effectiveLandmark,
      customerRegion: customerRegionId ? { connect: { id: customerRegionId } } : { disconnect: true },

      secondCustomerPhone: secondCustomerPhone ? normalizeIraqMobileLocal11(secondCustomerPhone) : null,
      secondCustomerAlternatePhone: secondCustomerAlternatePhone ? normalizeIraqMobileLocal11(secondCustomerAlternatePhone) : null,
      secondCustomerLocationUrl,
      secondCustomerLandmark,
      secondCustomerRegion: secondCustomerRegionId ? { connect: { id: secondCustomerRegionId } } : { disconnect: true },

      orderSubtotal: subVal,
      deliveryPrice: delVal,
      totalAmount: totalFromSubDel,
      orderNoteTime,
      courier: assignedCourierId ? { connect: { id: assignedCourierId } } : { disconnect: true },
      preparerShoppingJson: nextPreparerShoppingJson || undefined,
      prepaidAll,
    };

    if (nextImageUrl != null) {
      updateData.imageUrl = nextImageUrl;
      updateData.orderImageUploadedByName = ORDER_UPLOADER_ADMIN_LABEL;
    }

    if (nextArchivedAt !== undefined) {
      updateData.archivedAt = nextArchivedAt;
    }

    if (status === "delivered" && assignedCourierId && delVal != null) {
      const courier = await tx.courier.findUnique({ where: { id: assignedCourierId } });
      if (courier) {
        const earning = computeCourierDeliveryEarningDinar(
          courier.vehicleType,
          new Decimal(delVal),
          courier.zeroEarning,
        );
        updateData.courierEarningDinar = earning;
        if (earning != null) {
          updateData.courierEarningForCourier = { connect: { id: assignedCourierId } };
        } else {
          updateData.courierEarningForCourier = { disconnect: true };
        }
      }
    } else {
      updateData.courierEarningDinar = null;
      updateData.courierEarningForCourier = { disconnect: true };
    }

    await tx.order.update({
      where: { id: orderId },
      data: updateData,
    });
    await syncOrderCourierMoneyExpectations(tx, orderId);
  });

  if (status === "delivered") {
    try {
      const { handleOrderDelivered } = await import("@/lib/order-delivery-hook");
      await handleOrderDelivered(orderId);
    } catch (err) {
      console.error("Hook error in edit order status change:", err);
    }
  }

  // إشعار الموظف في حال تغير حالة الطلب
  if (existing.routeMode === "double" && existing.preparerShoppingJson && typeof existing.preparerShoppingJson === "object") {
    const json = existing.preparerShoppingJson as any;
    if (json.staffId && existing.status !== status) {
      void notifyTelegramStaffOrderUpdate({
        staffId: json.staffId,
        orderNumber: existing.orderNumber,
        orderId: existing.id,
        status: status,
        profitAmount: json.staffProfit
      }).catch(console.error);
    }
  }

  await syncPhoneProfileFromOrder(orderId);
  await syncSecondPhoneProfileFromOrder(orderId);

  if (isBlocked) {
    await blockCustomerAction(phoneLocal);
  } else {
    // We don't automatically unblock globally when one order is edited,
    // but we can unblock for this region if needed.
    // For now, let's keep it consistent.
  }

  revalidateAdminOrderPaths(orderId);
  if (status === "archived") redirect("/abo1stor3hlaa2kbr8-47/orders/archived");
  redirect("/abo1stor3hlaa2kbr8-47/orders/tracking");
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
    const activeOrders = await tx.order.findMany({
      where: {
        customerPhone: phoneLocal,
        status: { in: ["pending", "assigned", "delivering"] },
      },
      select: { id: true, customerLandmark: true },
    });

    for (const order of activeOrders) {
      const nextLandmark = order.customerLandmark.includes(BLOCKED_PREFIX)
        ? order.customerLandmark
        : `${BLOCKED_PREFIX} ${order.customerLandmark}`.trim();

      await tx.order.update({
        where: { id: order.id },
        data: { customerLandmark: nextLandmark },
      });
    }
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
