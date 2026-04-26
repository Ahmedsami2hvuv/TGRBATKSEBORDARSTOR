"use server";

import { Decimal } from "@prisma/client/runtime/library";
import { revalidatePath } from "next/cache";
import { PreparerShoppingDraftStatus } from "@prisma/client";
import { parseAlfInputToDinarNumber } from "@/lib/money-alf";
import { verifyEmployeeOrderPortalQuery } from "@/lib/employee-order-portal-link";
import {
  MAX_ORDER_IMAGE_BYTES,
  saveOrderImageUploaded,
  saveCustomerDoorPhotoUploaded,
} from "@/lib/order-image";
import { MAX_VOICE_NOTE_BYTES, saveVoiceNoteUploaded } from "@/lib/voice-note";
import { prisma } from "@/lib/prisma";
import { upsertCustomerPhoneProfileFromOrderSnapshot } from "@/lib/customer-phone-profile-sync";
import { pushNotifyAdminsNewPendingOrder } from "@/lib/web-push-server";
import { notifyTelegramNewOrder } from "@/lib/telegram-notify";
import { withReversePickupPrefix } from "@/lib/order-type-flags";
import { normalizeIraqMobileLocal11 } from "@/lib/whatsapp";

export type ClientOrderState = { error?: string; ok?: boolean };
export type EmployeePreparationState = {
  error?: string;
  ok?: boolean;
  preparerName?: string;
  draftId?: string;
};

function formatCustomerSummaryNote(raw: string): string {
  return raw.trim();
}

/** اسم الدالة submitOrder مطلوب ليتطابق مع الاستدعاء في الكلاينت */
export async function submitOrder(
  _prev: ClientOrderState,
  formData: FormData,
): Promise<ClientOrderState> {
  return submitClientOrder(_prev, formData);
}

export async function submitClientOrder(
  _prev: ClientOrderState,
  formData: FormData,
): Promise<ClientOrderState> {
  const e = String(formData.get("e") ?? "").trim();
  const exp = String(formData.get("exp") ?? "").trim();
  const sig = String(formData.get("s") ?? "").trim();
  const v = verifyEmployeeOrderPortalQuery(e, exp, sig);
  if (!v.ok) {
    return {
      error: "الرابط غير صاالح أو منتهٍ. اطلب رابطاً جديداً من موظف المحل.",
    };
  }

  const orderType = String(formData.get("orderType") ?? "").trim();
  const orderSubtotalRaw = String(formData.get("orderSubtotal") ?? "").trim();
  const customerPhone = String(formData.get("customerPhone") ?? "").trim();
  const alternatePhoneRaw = String(formData.get("alternatePhone") ?? "").trim();
  const customerRegionId = String(formData.get("customerRegionId") ?? "").trim();
  const orderTime = String(formData.get("orderTime") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();
  const customerNameRaw = String(formData.get("customerName") ?? "").trim();
  const customerLocationUrl = String(formData.get("customerLocationUrl") ?? "").trim();
  const customerLandmark = String(formData.get("customerLandmark") ?? "").trim();
  const prepaidAll = formData.get("prepaidAll") === "on";
  const reversePickup = formData.get("reversePickup") === "on";
  const editOrderNumberRaw = String(formData.get("editOrderNumber") ?? "").trim();
  const editOrderNumber = Number.parseInt(editOrderNumberRaw, 10);
  const isEditMode = Number.isInteger(editOrderNumber) && editOrderNumber > 0;

  const imageFile = formData.get("orderImage");
  const doorPhotoFile = formData.get("customerDoorPhoto");
  const voiceFile = formData.get("voiceNote");

  if (!orderType) {
    return { error: "نوع الطلب مطلوب" };
  }
  const normalizedOrderType = withReversePickupPrefix(orderType, reversePickup);
  if (!orderTime.trim()) {
    return { error: "وقت الطلب إجباري" };
  }
  if (!customerRegionId) {
    return { error: "اختر منطقة الزبون من البحث" };
  }

  const phoneLocal = normalizeIraqMobileLocal11(customerPhone);
  if (!phoneLocal) {
    return {
      error:
        "رقم الزبون غير صالح. يمكنك إدخاله بأي صيغة شائعة (مثل 07… أو +964… أو مع مسافات).",
    };
  }

  const normalizedSub = orderSubtotalRaw.replace(/,/g, ".").trim();
  let subtotal = new Decimal(0);
  if (normalizedSub) {
    const subtotalNum = parseAlfInputToDinarNumber(normalizedSub);
    if (subtotalNum == null) {
      return { error: "سعر الطلب غير صالح (أدخل المبلغ بالألف، مثال: 10 أو 10.5)" };
    }
    if (subtotalNum < 0) {
      return { error: "سعر الطلب لا يمكن أن يكون سالباً" };
    }
    subtotal = new Decimal(subtotalNum);
  }

  let imageUrl: string | null = null;
  if (imageFile instanceof File && imageFile.size > 0) {
    try {
      imageUrl = await saveOrderImageUploaded(imageFile, MAX_ORDER_IMAGE_BYTES);
    } catch (e) {
      const code = e instanceof Error ? e.message : "";
      if (code === "IMAGE_TOO_LARGE") {
        return { error: "حجم الصورة كبير جداً (الحد 10 ميجابايت)" };
      }
      if (code === "IMAGE_BAD_TYPE") {
        return { error: "نوع الصورة غير مدعوم (استخدم JPG أو PNG أو Webp)" };
      }
      if (code === "IMAGE_STORAGE_FAILED") {
        return {
          error:
            "تعذّر حفظ الصورة على الخادم. جرّب صورة أصغر أو أرسل الطلب دون صورة.",
        };
      }
      return { error: "تعذّر حفظ الصورة. حاول مرة أخرى." };
    }
  }

  let doorPhotoUrl: string | null = null;
  if (doorPhotoFile instanceof File && doorPhotoFile.size > 0) {
    try {
      doorPhotoUrl = await saveCustomerDoorPhotoUploaded(doorPhotoFile, MAX_ORDER_IMAGE_BYTES);
    } catch (e) {
      console.error("Failed to save door photo:", e);
    }
  }

  let voiceNoteUrl: string | null = null;
  if (voiceFile instanceof File && voiceFile.size > 0) {
    try {
      voiceNoteUrl = await saveVoiceNoteUploaded(voiceFile, MAX_VOICE_NOTE_BYTES);
    } catch (e) {
      const code = e instanceof Error ? e.message : "";
      if (code === "VOICE_TOO_LARGE") {
        return { error: "الملاحظة الصوتية كبيرة جداً (الحدّ حوالي 10 ثوانٍ)" };
      }
      if (code === "VOICE_BAD_TYPE") {
        return { error: "صيغة الصوت غير مدعومة. سجّل من المتصفح مرة أخرى." };
      }
      if (code === "VOICE_STORAGE_FAILED") {
        return {
          error:
            "تعذّر حفظ التسجيل الصوتي على الخادم. أرسل الطلب دون صوت أو جرّب لاحقاً.",
        };
      }
      return { error: "تعذّر حفظ الملاحظة الصوتية." };
    }
  }

  const submitter = await prisma.employee.findUnique({
    where: { id: v.employeeId },
    include: { shop: { include: { region: true } } },
  });
  if (!submitter) {
    return { error: "الموظف غير موجود" };
  }
  if (submitter.orderPortalToken !== v.token) {
    return { error: "الرابط غير صالح. اطلب رابطاً جديداً من الإدارة." };
  }
  const shop = submitter.shop;

  const custRegion = await prisma.region.findUnique({
    where: { id: customerRegionId },
  });
  if (!custRegion) {
    return { error: "منطقة الزبون غير صالحة" };
  }

  const shopDel = shop.region.deliveryPrice;
  const custDel = custRegion.deliveryPrice;
  const delivery = shopDel.greaterThan(custDel) ? shopDel : custDel;
  const total = subtotal.plus(delivery);

  const existingCustomer = await prisma.customer.findFirst({
    where: { shopId: shop.id, phone: phoneLocal },
  });

  const phoneRegionProfile = await prisma.customerPhoneProfile.findUnique({
    where: {
      phone_regionId: { phone: phoneLocal, regionId: customerRegionId },
    },
  });

  const locMerged =
    customerLocationUrl.trim() ||
    phoneRegionProfile?.locationUrl?.trim() ||
    "";
  const lmMerged =
    customerLandmark.trim() ||
    phoneRegionProfile?.landmark?.trim() ||
    "";

  let alternateMerged: string | null = null;
  if (alternatePhoneRaw.trim()) {
    const altLocal = normalizeIraqMobileLocal11(alternatePhoneRaw);
    if (!altLocal) {
      return {
        error:
          "الرقام الثاني غير صالح. أدخل رقماً عراقياً صحيحاً أو اترك الحقل فارغاً.",
      };
    }
    if (altLocal === phoneLocal) {
      return { error: "الرقم الثاني يجب أن يختلف عن رقم الزبون الأساسي." };
    }
    alternateMerged = altLocal;
  } else if (phoneRegionProfile?.alternatePhone?.trim()) {
    alternateMerged = phoneRegionProfile.alternatePhone.trim();
  }

  const customerDoorPrefill = phoneRegionProfile?.photoUrl?.trim() || null;

  const customerRow = existingCustomer
    ? await prisma.customer.update({
        where: { id: existingCustomer.id },
        data: {
          name:
            customerNameRaw ||
            existingCustomer.name?.trim() ||
            "",
          customerRegionId: custRegion.id,
          customerLocationUrl: locMerged,
          customerLandmark: lmMerged,
          alternatePhone: alternateMerged,
          customerDoorPhotoUrl: doorPhotoUrl ?? existingCustomer.customerDoorPhotoUrl ?? customerDoorPrefill,
        },
      })
    : await prisma.customer.create({
        data: {
          shopId: shop.id,
          phone: phoneLocal,
          name: customerNameRaw,
          customerRegionId: custRegion.id,
          customerLocationUrl: locMerged,
          customerLandmark: lmMerged,
          alternatePhone: alternateMerged,
          customerDoorPhotoUrl: doorPhotoUrl ?? customerDoorPrefill,
        },
      });

  const orderNoteTimeOnly = orderTime.trim();
  const summaryFromCustomerNotes = formatCustomerSummaryNote(notes);

  const orderImageUploaderName = imageUrl
    ? submitter.name?.trim() || "موظف المحل"
    : null;

  let order: { id: string; orderNumber: number };
  if (isEditMode) {
    const existingOrder = await prisma.order.findFirst({
      where: {
        orderNumber: editOrderNumber,
        shopId: shop.id,
        customerPhone: phoneLocal,
        status: { in: ["pending", "assigned"] },
      },
      select: {
        id: true,
        orderNumber: true,
        imageUrl: true,
        orderImageUploadedByName: true,
        voiceNoteUrl: true,
        customerDoorPhotoUrl: true,
      },
    });
    if (!existingOrder) {
      return {
        error:
          "لا يمكن تعديل هذا الطلب. التعديل متاح فقط لنفس رقم الزبون وفي حالة طلب جديد أو بانتظار المندوب.",
      };
    }
    order = await prisma.order.update({
      where: { id: existingOrder.id },
      data: {
        customerId: customerRow.id,
        summary: summaryFromCustomerNotes,
        orderType: normalizedOrderType,
        customerLocationUrl: locMerged,
        customerLandmark: lmMerged,
        customerRegionId: custRegion.id,
        deliveryPrice: delivery,
        orderSubtotal: subtotal,
        totalAmount: total,
        customerPhone: phoneLocal,
        alternatePhone: alternateMerged,
        orderNoteTime: orderNoteTimeOnly,
        imageUrl: imageUrl ?? existingOrder.imageUrl,
        orderImageUploadedByName:
          imageUrl != null ? orderImageUploaderName : existingOrder.orderImageUploadedByName,
        voiceNoteUrl: voiceNoteUrl ?? existingOrder.voiceNoteUrl,
        shopDoorPhotoUrl: shop.photoUrl?.trim() || null,
        customerDoorPhotoUrl: doorPhotoUrl ?? existingOrder.customerDoorPhotoUrl ?? customerDoorPrefill,
        submissionSource: "customer_via_employee_link",
        submittedByEmployeeId: submitter.id,
        submittedByCompanyPreparerId: null,
        prepaidAll,
      },
      select: { id: true, orderNumber: true },
    });
  } else {
    order = await prisma.order.create({
      data: {
        shopId: shop.id,
        customerId: customerRow.id,
        status: "pending",
        summary: summaryFromCustomerNotes,
        orderType: normalizedOrderType,
        customerLocationUrl: locMerged,
        customerLandmark: lmMerged,
        customerRegionId: custRegion.id,
        deliveryPrice: delivery,
        orderSubtotal: subtotal,
        totalAmount: total,
        customerPhone: phoneLocal,
        alternatePhone: alternateMerged,
        orderNoteTime: orderNoteTimeOnly,
        imageUrl,
        orderImageUploadedByName: orderImageUploaderName,
        voiceNoteUrl,
        shopDoorPhotoUrl: shop.photoUrl?.trim() || null,
        customerDoorPhotoUrl: doorPhotoUrl ?? customerDoorPrefill,
        submissionSource: "customer_via_employee_link",
        submittedByEmployeeId: submitter.id,
        submittedByCompanyPreparerId: null,
        prepaidAll,
      },
      select: { id: true, orderNumber: true },
    });
  }

  await upsertCustomerPhoneProfileFromOrderSnapshot({
    phone: phoneLocal,
    regionId: custRegion.id,
    locationUrl: locMerged,
    landmark: lmMerged,
    doorPhotoUrl: doorPhotoUrl ?? customerDoorPrefill ?? "",
    alternatePhone: alternateMerged,
  });

  if (!isEditMode) {
    void notifyTelegramNewOrder(order.id);
    void pushNotifyAdminsNewPendingOrder(order.orderNumber);
  }

  revalidatePath("/admin/orders/pending");
  revalidatePath(`/admin/shops/${shop.id}/edit`);
  revalidatePath(`/admin/shops/${shop.id}/employees`);
  return { ok: true };
}

export async function submitEmployeePreparationDraft(
  _prev: EmployeePreparationState,
  formData: FormData,
): Promise<EmployeePreparationState> {
  const e = String(formData.get("e") ?? "").trim();
  const exp = String(formData.get("exp") ?? "").trim();
  const sig = String(formData.get("s") ?? "").trim();
  const v = verifyEmployeeOrderPortalQuery(e, exp, sig);
  if (!v.ok) {
    return { error: "الرابط غير صالح أو منتهٍ. اطلب رابطاً جديداً من الإدارة." };
  }

  const titleLine = String(formData.get("titleLine") ?? "").trim();
  const rawListText = String(formData.get("rawListText") ?? "").trim();
  const productsCsv = String(formData.get("productsCsv") ?? "").trim();
  const customerRegionId = String(formData.get("customerRegionId") ?? "").trim();
  const customerPhone = String(formData.get("customerPhone") ?? "").trim();
  const customerName = String(formData.get("customerName") ?? "").trim();
  const customerLandmark = String(formData.get("customerLandmark") ?? "").trim();
  const orderTime = String(formData.get("orderTime") ?? "").trim();

  if (!titleLine || !productsCsv || !customerRegionId || !orderTime) {
    return { error: "بيانات ناقصة — تأكد من عنوان الطلب والمنطقة والمنتجات ووقت الطلب." };
  }
  const phoneLocal = normalizeIraqMobileLocal11(customerPhone);
  if (!phoneLocal) {
    return {
      error:
        "رقم الزبون غير صالح. يمكنك إدخاله بأي صيغة شائعة (مثل 07… أو +964… أو مع مسافات).",
    };
  }
  const region = await prisma.region.findUnique({ where: { id: customerRegionId }, select: { id: true } });
  if (!region) return { error: "منطقة الزبون غير صالحة." };

  const employee = await prisma.employee.findUnique({
    where: { id: v.employeeId },
    select: { id: true, name: true, shopId: true, orderPortalToken: true },
  });
  if (!employee) return { error: "الموظف غير موجود." };
  if (employee.orderPortalToken !== v.token) {
    return { error: "الرابط غير صالح. اطلب رابطاً جديداً من الإدارة." };
  }

  const preparerLink = await prisma.preparerShop.findFirst({
    where: {
      shopId: employee.shopId,
      canSubmitOrders: true,
      preparer: { active: true, availableForAssignment: true },
    },
    orderBy: { assignedAt: "asc" },
    select: { preparerId: true, preparer: { select: { name: true } } },
  });
  if (!preparerLink) {
    return { error: "لا يوجد مجهّز متاح لهذا المحل حالياً. فعّل المجهزين من الإدارة أو حاول لاحقاً." };
  }

  const lines = productsCsv
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length === 0) {
    return { error: "لا توجد منتجات في القائمة." };
  }
  const products = lines.map((line) => ({ line, buyAlf: null as number | null, sellAlf: null as number | null }));

  const draft = await prisma.companyPreparerShoppingDraft.create({
    data: {
      preparerId: preparerLink.preparerId,
      status: PreparerShoppingDraftStatus.draft,
      titleLine,
      rawListText,
      customerRegionId,
      customerPhone: phoneLocal,
      customerName,
      customerLandmark,
      orderTime,
      placesCount: null,
      data: {
        version: 1,
        products,
        fromEmployeeId: employee.id,
        fromEmployeeName: employee.name,
      },
    },
    select: { id: true },
  });

  await prisma.companyPreparerPrepNotice.create({
    data: {
      preparerId: preparerLink.preparerId,
      title: "طلب تجهيز جديد من موظف",
      body: `تم تحويل طلب تجهيز جديد للمحل إلى خانتك من الموظف ${employee.name.trim() || "—"}.`,
    },
  });

  revalidatePath("/preparer/preparation");
  revalidatePath("/preparer");
  return { ok: true, draftId: draft.id, preparerName: preparerLink.preparer.name };
}
