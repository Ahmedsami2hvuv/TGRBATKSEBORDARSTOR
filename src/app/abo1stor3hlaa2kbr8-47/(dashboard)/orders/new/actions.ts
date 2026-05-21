"use server";

import { randomBytes } from "node:crypto";
import { Decimal } from "@prisma/client/runtime/library";
import { revalidatePath } from "next/cache";
import {
  MAX_ORDER_IMAGE_BYTES,
  saveOrderImageUploaded,
  saveCustomerDoorPhotoUploaded,
} from "@/lib/order-image";
import { ORDER_UPLOADER_ADMIN_LABEL } from "@/lib/order-uploader-label";
import { prisma } from "@/lib/prisma";
import { notifyTelegramNewOrder } from "@/lib/telegram-notify";
import { pushNotifyAdminsNewPendingOrder } from "@/lib/web-push-server";
import {
  MAX_VOICE_NOTE_BYTES,
  saveVoiceNoteUploaded,
} from "@/lib/voice-note";
import { parseAlfInputToDinarDecimalRequired } from "@/lib/money-alf";
import {
  syncPhoneProfileFromOrder,
  syncSecondPhoneProfileFromOrder,
} from "@/lib/customer-phone-profile-sync";
import { normalizeIraqMobileLocal11 } from "@/lib/whatsapp";
import { PreparerShoppingDraftStatus } from "@prisma/client";
import { isAdminSession } from "@/lib/admin-session";
import { ADMIN_OFFICE_LABEL, ADMIN_SHOP_NAMES } from "@/lib/admin-order-from-admin-constants";
import { courierAssignableWhere } from "@/lib/courier-assignable";

const SECRET_ADMIN_PATH = "/abo1stor3hlaa2kbr8-47";

export type AdminCreateOrderState = { ok?: boolean; error?: string; draftIds?: string[] };

type AdminSubmissionMode = "from_shop" | "admin_one_face" | "two_faces" | "preparation";

const SYSTEM_ADMIN_SHOP_NAME = ADMIN_OFFICE_LABEL;
const SYSTEM_ADMIN_PHONE = "07733921568";

async function getOrCreateSystemAdminShop(): Promise<{ id: string, regionId: string, photoUrl: string | null }> {
  let shop = await prisma.shop.findFirst({
    where: { name: { in: ADMIN_SHOP_NAMES } }
  });

  if (!shop) {
    const firstRegion = await prisma.region.findFirst();
    if (!firstRegion) throw new Error("يجب إضافة منطقة واحدة على الأقل في النظام.");

    shop = await prisma.shop.create({
      data: {
        name: SYSTEM_ADMIN_SHOP_NAME,
        phone: SYSTEM_ADMIN_PHONE,
        locationUrl: "",
        regionId: firstRegion.id,
      }
    });
  } else {
    const data: { name?: string; phone?: string } = {};
    if (shop.name !== SYSTEM_ADMIN_SHOP_NAME) data.name = SYSTEM_ADMIN_SHOP_NAME;
    if (shop.phone !== SYSTEM_ADMIN_PHONE) data.phone = SYSTEM_ADMIN_PHONE;

    if (Object.keys(data).length > 0) {
      shop = await prisma.shop.update({
        where: { id: shop.id },
        data,
      });
    }
  }

  return { id: shop.id, regionId: shop.regionId, photoUrl: shop.photoUrl || null };
}

async function upsertCustomerByPhone(opts: {
  shopId: string;
  phone: string;
  regionId: string | null;
  locationUrl?: string;
  landmark?: string;
  doorPhotoUrl?: string | null;
  alternatePhone?: string | null;
}): Promise<{ id: string }> {
  const { shopId, phone, regionId, locationUrl, landmark, doorPhotoUrl, alternatePhone } = opts;

  const existing = await prisma.customer.findFirst({
    where: { shopId, phone },
  });

  const data = {
    customerRegionId: regionId,
    customerLocationUrl: locationUrl ?? "",
    customerLandmark: landmark ?? "",
    customerDoorPhotoUrl: doorPhotoUrl ?? null,
    alternatePhone: alternatePhone || null,
  };

  if (existing) {
    return prisma.customer.update({
      where: { id: existing.id },
      data,
      select: { id: true },
    });
  }

  return prisma.customer.create({
    data: {
      shopId,
      phone,
      name: "",
      ...data,
    },
    select: { id: true },
  });
}

export async function createAdminOrder(
  _prev: AdminCreateOrderState,
  formData: FormData,
): Promise<AdminCreateOrderState> {
  const admin = await isAdminSession();
  if (!admin) return { error: "غير مصرّح (Admin session required)." };

  const modeRaw = String(formData.get("adminSubmissionMode") ?? "from_shop").trim();
  const adminSubmissionMode: AdminSubmissionMode =
    modeRaw === "admin_one_face" || modeRaw === "two_faces" || modeRaw === "preparation" || modeRaw === "prep_draft"
      ? (modeRaw === "prep_draft" ? "preparation" : modeRaw)
      : "from_shop";

  // --- Handling Preparation Draft Mode ---
  if (adminSubmissionMode === "preparation") {
    const preparerIds = formData.getAll("preparerIds").map(String).map(s => s.trim()).filter(Boolean);
    if (preparerIds.length === 0) return { error: "اختر مجهّزاً واحداً على الأقل للإسناد." };

    const titleLine = String(formData.get("orderType") ?? formData.get("prepTitleLine") ?? "").trim();
    const rawListText = String(formData.get("rawListText") ?? "").trim();
    const productsCsv = String(formData.get("productsCsv") ?? "").trim();
    const customerRegionId = String(formData.get("firstCustomerRegionId") ?? formData.get("customerRegionId") ?? "").trim();
    const customerPhone = String(formData.get("firstCustomerPhone") ?? formData.get("prepCustomerPhone") ?? "").trim();
    const customerName = String(formData.get("customerName") ?? "").trim();
    const customerLandmark = String(formData.get("firstCustomerLandmark") ?? formData.get("customerLandmark") ?? "").trim();
    const orderNoteTime = String(formData.get("orderNoteTime") ?? formData.get("prepOrderTime") ?? "").trim();

    if (!titleLine || !productsCsv || !customerRegionId || !orderNoteTime) {
      return { error: "بيانات ناقصة — تأكد من عنوان الطلب والمنطقة والمنتجات ووقت الطلب." };
    }

    const phoneLocal = normalizeIraqMobileLocal11(customerPhone) || customerPhone;

    // فحص الحظر العالمي قبل إنشاء مسودة التجهيز من الأدمن
    const isGlobalBlocked = await prisma.globalBlockedPhone.findUnique({
      where: { phone: phoneLocal },
    });
    if (isGlobalBlocked) {
      return { error: `عذراً، الرقم ${phoneLocal} محظور عالمياً ولا يمكن إنشاء طلب له.` };
    }

    const lines = productsCsv.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    const products = lines.map((line) => ({ line, buyAlf: null, sellAlf: null, pricedBy: null }));

    const groupId = randomBytes(8).toString("hex");

    const createdDraftIds: string[] = [];
    for (const preparerId of preparerIds) {
      const draft = await prisma.companyPreparerShoppingDraft.create({
        data: {
          preparerId,
          status: PreparerShoppingDraftStatus.draft,
          titleLine,
          rawListText,
          customerRegionId,
          customerPhone: phoneLocal,
          customerName,
          customerLandmark,
          orderTime: orderNoteTime,
          data: {
            version: 1,
            products,
            groupId,
            fromAdminId: "admin",
            fromAdminName: "الإدارة"
          },
        },
        select: { id: true },
      });
      createdDraftIds.push(draft.id);

      await prisma.companyPreparerPrepNotice.create({
        data: {
          preparerId,
          title: titleLine,
          body: titleLine,
        },
      });
    }

    revalidatePath(`${SECRET_ADMIN_PATH}/orders/pending`);
    return { ok: true, draftIds: createdDraftIds };
  }

  const routeMode: "single" | "double" = adminSubmissionMode === "two_faces" ? "double" : "single";

  let adminOrderCode = String(formData.get("adminOrderCode") ?? "").trim();
  if (!adminOrderCode) {
    adminOrderCode = `ADM-${randomBytes(5).toString("hex").toUpperCase()}`;
  }

  let targetShopId = "";
  if (adminSubmissionMode === "from_shop") {
    targetShopId = String(formData.get("shopId") ?? "").trim();
    if (!targetShopId) return { error: "اختر المحل." };
  } else {
    const systemShop = await getOrCreateSystemAdminShop();
    targetShopId = systemShop.id;
  }

  const orderType = String(formData.get("orderType") ?? "").trim();
  const summary = String(formData.get("summary") ?? "").trim();
  const orderNoteTime = String(formData.get("orderNoteTime") ?? "").trim();

  const firstPhoneRaw = String(formData.get("firstCustomerPhone") ?? "").trim();
  const firstAlternatePhone = String(formData.get("firstCustomerAlternatePhone") ?? "").trim();
  const firstRegionIdRaw = String(formData.get("firstCustomerRegionId") ?? "").trim();
  const firstLocationUrl = String(formData.get("firstCustomerLocationUrl") ?? "").trim();
  const firstLandmark = String(formData.get("firstCustomerLandmark") ?? "").trim();

  const secondPhoneRaw = String(formData.get("secondCustomerPhone") ?? "").trim();
  const secondAlternatePhone = String(formData.get("secondCustomerAlternatePhone") ?? "").trim();
  const secondRegionIdRaw = String(formData.get("secondCustomerRegionId") ?? "").trim();
  const secondLocationUrl = String(formData.get("secondCustomerLocationUrl") ?? "").trim();
  const secondLandmark = String(formData.get("secondCustomerLandmark") ?? "").trim();

  if (!orderType) return { error: "نوع الطلب مطلوب." };
  if (!orderNoteTime) return { error: "وقت الطلب إجباري." };

  const firstPhone = normalizeIraqMobileLocal11(firstPhoneRaw);
  if (!firstPhone) return { error: "رقم الزبون غير صالح." };

  // فحص الحظر العالمي للرقم الأول
  const isFirstBlocked = await prisma.globalBlockedPhone.findUnique({
    where: { phone: firstPhone },
  });
  if (isFirstBlocked) {
    return { error: `عذراً، رقم الزبون (${firstPhone}) محظور عالمياً.` };
  }

  if (!firstRegionIdRaw) return { error: "منطقة الزبون مطلوبة." };

  let secondPhone: string | null = null;
  let secondRegionId: string | null = null;
  if (routeMode === "double") {
    secondPhone = normalizeIraqMobileLocal11(secondPhoneRaw);
    if (!secondPhone) return { error: "رقم المستلم غير صالح." };

    // فحص الحظر العالمي للرقم الثاني (المستلم) في حال الطلب بوجهين
    const isSecondBlocked = await prisma.globalBlockedPhone.findUnique({
      where: { phone: secondPhone },
    });
    if (isSecondBlocked) {
      return { error: `عذراً، رقم المستلم (${secondPhone}) محظور عالمياً.` };
    }

    if (!secondRegionIdRaw) return { error: "منطقة المستلم مطلوبة." };
    secondRegionId = secondRegionIdRaw;
  }

  const subtotalParsed = parseAlfInputToDinarDecimalRequired(
    String(formData.get("orderSubtotal") ?? ""),
  );
  if (!subtotalParsed.ok) return { error: "سعر الطلب غير صالح." };

  const [shop, firstRegion] = await Promise.all([
    prisma.shop.findUnique({ where: { id: targetShopId }, include: { region: true } }),
    prisma.region.findUnique({ where: { id: firstRegionIdRaw } }),
  ]);

  if (!shop || !firstRegion) return { error: "المعلومات الأساسية غير موجودة." };

  let secondRegion = null;
  if (secondRegionId) {
    secondRegion = await prisma.region.findUnique({ where: { id: secondRegionId } });
  }

  const orderImg = formData.get("orderImage");
  const firstDoor = formData.get("firstCustomerDoorPhoto");
  const secondDoor = formData.get("secondCustomerDoorPhoto");
  const voice = formData.get("voiceNote");

  const firstExistingDoorUrl = String(formData.get("firstExistingDoorPhotoUrl") ?? "").trim();
  const secondExistingDoorUrl = String(formData.get("secondExistingDoorPhotoUrl") ?? "").trim();

  let imageUrl: string | null = null;
  let firstDoorUrl: string | null = firstExistingDoorUrl || null;
  let secondDoorUrl: string | null = secondExistingDoorUrl || null;
  let voiceNoteUrl: string | null = null;

  try {
    if (orderImg instanceof File && orderImg.size > 0) imageUrl = await saveOrderImageUploaded(orderImg, MAX_ORDER_IMAGE_BYTES);
    if (firstDoor instanceof File && firstDoor.size > 0) firstDoorUrl = await saveCustomerDoorPhotoUploaded(firstDoor, MAX_ORDER_IMAGE_BYTES);
    if (secondDoor instanceof File && secondDoor.size > 0) secondDoorUrl = await saveCustomerDoorPhotoUploaded(secondDoor, MAX_ORDER_IMAGE_BYTES);
    if (voice instanceof File && voice.size > 0) voiceNoteUrl = await saveVoiceNoteUploaded(voice, MAX_VOICE_NOTE_BYTES);
  } catch (e) {
    return { error: "تعذّر حفظ الملفات المرفقة." };
  }

  const firstCustomerRow = await upsertCustomerByPhone({
    shopId: targetShopId,
    phone: firstPhone,
    regionId: firstRegionIdRaw,
    locationUrl: firstLocationUrl,
    landmark: firstLandmark,
    doorPhotoUrl: firstDoorUrl,
    alternatePhone: firstAlternatePhone,
  });

  if (routeMode === "double" && secondPhone && secondRegionId) {
    await upsertCustomerByPhone({
      shopId: targetShopId,
      phone: secondPhone,
      regionId: secondRegionId,
      locationUrl: secondLocationUrl,
      landmark: secondLandmark,
      doorPhotoUrl: secondDoorUrl,
      alternatePhone: secondAlternatePhone,
    });
  }

  const shopDel = shop.region.deliveryPrice;
  const firstDel = firstRegion.deliveryPrice;
  const secondDel = secondRegion?.deliveryPrice ?? new Decimal(0);

  const delivery = adminSubmissionMode === "admin_one_face"
    ? firstDel
    : (routeMode === "double"
        ? Decimal.max(shopDel, firstDel, secondDel)
        : Decimal.max(shopDel, firstDel));

  const total = new Decimal(subtotalParsed.value).plus(delivery);

  const submittedByEmployeeId = String(formData.get("linkedCustomerId") ?? "").trim() || null;
  const assignedCourierRaw = String(formData.get("assignedCourierId") ?? "").trim();
  let assignedCourierId: string | null = null;
  if (assignedCourierRaw) {
    const courier = await prisma.courier.findFirst({
      where: { ...courierAssignableWhere, id: assignedCourierRaw },
      select: { id: true },
    });
    if (!courier) return { error: "المندوب المختار غير متاح للإسناد حالياً." };
    assignedCourierId = courier.id;
  }

  const order = await prisma.order.create({
    data: {
      shopId: targetShopId,
      customerId: firstCustomerRow.id,
      status: assignedCourierId ? "assigned" : "pending",
      routeMode,
      adminOrderCode,
      submissionSource: "admin_portal",
      submittedByEmployeeId,
      assignedCourierId,
      summary,
      orderType,
      orderNoteTime,
      customerPhone: firstPhone,
      alternatePhone: firstAlternatePhone || null,
      customerRegionId: firstRegionIdRaw,
      customerLocationUrl: firstLocationUrl,
      customerLandmark: firstLandmark,
      customerDoorPhotoUrl: firstDoorUrl || null,
      secondCustomerPhone: routeMode === "double" ? secondPhone : null,
      secondCustomerRegionId: routeMode === "double" ? secondRegionId : null,
      secondCustomerLocationUrl: routeMode === "double" ? secondLocationUrl : "",
      secondCustomerLandmark: routeMode === "double" ? secondLandmark : "",
      secondCustomerDoorPhotoUrl: routeMode === "double" ? (secondDoorUrl || null) : null,
      orderSubtotal: subtotalParsed.value,
      deliveryPrice: delivery,
      totalAmount: total,
      imageUrl,
      voiceNoteUrl,
      shopDoorPhotoUrl: shop.photoUrl?.trim() || null,
      orderImageUploadedByName: imageUrl ? ORDER_UPLOADER_ADMIN_LABEL : null,
      customerDoorPhotoUploadedByName: firstDoorUrl ? ORDER_UPLOADER_ADMIN_LABEL : null,
    },
  });

  await syncPhoneProfileFromOrder(order.id);
  if (routeMode === "double") await syncSecondPhoneProfileFromOrder(order.id);

  if (assignedCourierId) {
    void pushNotifyCourierNewAssignment(assignedCourierId, order.orderNumber, order.id);
  }
  void notifyTelegramNewOrder(order.id);
  void pushNotifyAdminsNewPendingOrder(order.orderNumber);

  revalidatePath(`${SECRET_ADMIN_PATH}/orders/pending`);
  revalidatePath(`${SECRET_ADMIN_PATH}/orders/tracking`);
  return { ok: true };
}
