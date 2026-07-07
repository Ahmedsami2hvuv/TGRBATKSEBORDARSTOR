"use server";

import { Decimal } from "@prisma/client/runtime/library";
import { revalidatePath } from "next/cache";
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
import { pushNotifyAdminsNewPendingOrder, pushNotifyPreparerNewNotice } from "@/lib/web-push-server";
import { notifyTelegramNewOrder, notifyTelegramOrderCanceledByClient } from "@/lib/telegram-notify";
import { withReversePickupPrefix } from "@/lib/order-type-flags";

const SECRET_ADMIN_PATH = "/abo1stor3hlaa2kbr8-47";

import { getCustomerOrderWhatsappTemplate, renderWhatsappTemplate, getNewOrderAlertWhatsappTemplate, renderNewOrderAlertTemplate } from "@/lib/whatsapp-template-settings";
import { whatsappMeUrl, normalizeIraqMobileLocal11 } from "@/lib/whatsapp";

const OWNER_WHATSAPP_PHONE = "+9647733921468";

export type ClientOrderState = { error?: string; ok?: boolean; waUrl?: string };
export type EmployeePreparationState = { error?: string; ok?: boolean; draftId?: string; preparerName?: string };

export async function submitEmployeePreparationDraft(
  _prev: EmployeePreparationState,
  formData: FormData,
): Promise<EmployeePreparationState> {
  try {
    const e = String(formData.get("e") ?? "").trim();
    const exp = String(formData.get("exp") ?? "").trim();
    const sig = String(formData.get("s") ?? "").trim();
    const v = verifyEmployeeOrderPortalQuery(e, exp, sig);

    if (!v.ok) {
      return { error: "الرابط غير صالح أو منتهٍ." };
    }

    const submitter = await prisma.employee.findUnique({
      where: { id: v.employeeId },
      select: { id: true, name: true, shopId: true, orderPortalToken: true },
    });

    if (!submitter || submitter.orderPortalToken !== v.token) {
      return { error: "الموظف غير موجود أو الرابط غير صالح." };
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
      return { error: "بيانات ناقصة." };
    }

    const phoneLocal = normalizeIraqMobileLocal11(customerPhone);
    if (!phoneLocal) return { error: "رقم الهاتف غير صحيح." };

    // Global block check
    const isGlobalBlocked = await prisma.globalBlockedPhone.findUnique({
      where: { phone: phoneLocal },
    });
    if (isGlobalBlocked) {
      return { error: "عذراً، هذا الرقم محظور عالمياً ولا يمكن إنشاء طلب تجهيز له." };
    }

    const region = await prisma.region.findUnique({
      where: { id: customerRegionId },
      select: { id: true },
    });
    if (!region) return { error: "المنطقة غير صالحة." };

    // البحث عن مجهز للمحل
    const shopLink = await prisma.preparerShop.findFirst({
      where: { shopId: submitter.shopId },
      include: { preparer: true },
    });

    const lines = productsCsv.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    const products = lines.map(line => ({ line, buyAlf: null, sellAlf: null }));

    const draft = await prisma.companyPreparerShoppingDraft.create({
      data: {
        preparerId: shopLink?.preparerId ?? null,
        status: "draft",
        titleLine,
        rawListText,
        customerRegionId: region.id,
        customerPhone: phoneLocal,
        customerName,
        customerLandmark,
        orderTime,
        data: {
          version: 1,
          products,
          fromEmployeeId: submitter.id,
          fromEmployeeName: submitter.name,
        },
      },
    }).catch(async (err) => {
      console.warn("Draft creation with extra fields failed, trying minimal version:", err.message);
      return prisma.companyPreparerShoppingDraft.create({
        data: {
          preparerId: shopLink?.preparerId ?? null,
          status: "draft",
          titleLine,
          rawListText,
          customerRegionId: region.id,
          customerPhone: phoneLocal,
          customerName,
          customerLandmark,
          orderTime,
        }
      });
    });

    if (shopLink?.preparerId) {
      const notice = await prisma.companyPreparerPrepNotice.create({
        data: {
          preparerId: shopLink.preparerId,
          title: "طلب تجهيز جديد",
          body: `طلب جديد من ${submitter.name} لمحل ${submitter.shopId}`,
        },
      }).catch(() => null);

      if (notice) {
        void pushNotifyPreparerNewNotice({
          preparerId: shopLink.preparerId,
          title: notice.title,
          body: notice.body,
          draftId: draft.id,
        }).catch(() => {});
      }
    }

    revalidatePath(`${SECRET_ADMIN_PATH}/orders/pending`);
    return { ok: true, draftId: draft.id, preparerName: shopLink?.preparer?.name };
  } catch (err: any) {
    console.error("Prep Draft Error:", err);
    return { error: "فشل إنشاء طلب التجهيز: " + (err.message || "خطأ داخلي") };
  }
}

/** اسم الدالة submitOrder مطلوب ليتطابق مع الاستدعاء في الكلاينت */
export async function submitOrder(
  _prev: ClientOrderState,
  formData: FormData,
): Promise<ClientOrderState> {
  try {
    const e = String(formData.get("e") ?? "").trim();
    const exp = String(formData.get("exp") ?? "").trim();
    const sig = String(formData.get("s") ?? "").trim();
    const v = verifyEmployeeOrderPortalQuery(e, exp, sig);

    if (!v.ok) {
      return { error: "الرابط غير صالح أو منتهٍ. اطلب رابطاً جديداً." };
    }

    const submitter = await prisma.employee.findUnique({
      where: { id: v.employeeId },
      select: {
        id: true,
        shopId: true,
        orderPortalToken: true,
        shop: {
          select: {
            photoUrl: true,
            region: { select: { deliveryPrice: true } },
          },
        },
      },
    });

    if (!submitter || submitter.orderPortalToken !== v.token) {
      return { error: "الموظف غير موجود أو الرابط غير صالح." };
    }

    const orderType = String(formData.get("orderType") ?? "").trim();
    const orderSubtotalRaw = String(formData.get("orderSubtotal") ?? "").trim();
    const customerPhone = String(formData.get("customerPhone") ?? "").trim();
    const customerRegionId = String(formData.get("customerRegionId") ?? "").trim();
    const orderTime = String(formData.get("orderTime") ?? "").trim();
    const notes = String(formData.get("notes") ?? "").trim();
    const customerNameRaw = String(formData.get("customerName") ?? "").trim();
    // تم تعطيل لوكيشن الزبون نهائياً في بوابة العميل.
    const customerLocationUrl = "";
    const customerLandmark = String(formData.get("customerLandmark") ?? "").trim();
    const prepaidAll = formData.get("prepaidAll") === "on";
    const reversePickup = formData.get("reversePickup") === "on";
    const vehiclePreference = formData.get("vehiclePreference") as string || null;
    const deliveryPriceOverride = formData.get("deliveryPrice") ? Number(formData.get("deliveryPrice")) : null;
    const editOrderNumberRaw = formData.get("editOrderNumber");
    const editOrderNumber = editOrderNumberRaw ? Number(editOrderNumberRaw) : null;

    if (!orderType) return { error: "نوع الطلب مطلوب" };
    if (!customerRegionId) return { error: "اختر المنطقة" };
    if (!orderTime.trim()) return { error: "وقت الطلب إجباري" };

    const phoneLocal = normalizeIraqMobileLocal11(customerPhone);
    if (!phoneLocal) return { error: "رقم الهاتف غير صحيح" };

    // Global block check
    const isGlobalBlocked = await prisma.globalBlockedPhone.findUnique({
      where: { phone: phoneLocal },
    });
    if (isGlobalBlocked) {
      return { error: "عذراً، هذا الرقم محظور من التوصيل حالياً." };
    }

    let existingOrder = null;
    if (editOrderNumber !== null && !isNaN(editOrderNumber)) {
      existingOrder = await prisma.order.findFirst({
        where: {
          orderNumber: editOrderNumber,
          shopId: submitter.shopId,
          status: { in: ["pending", "assigned"] }
        }
      });
      if (!existingOrder) {
        return { error: "الطلب غير موجود أو تم استلامه من قبل المندوب ولا يمكن تعديله." };
      }
    }

    // معالجة السعر
    const subtotalNum = parseAlfInputToDinarNumber(orderSubtotalRaw.replace(/,/g, ".").trim()) || 0;
    const subtotal = new Decimal(subtotalNum);

    // جلب بيانات الموظف والمحل
    const shopDel = submitter.shop.region.deliveryPrice.toNumber();

    const custRegion = await prisma.region.findUnique({
      where: { id: customerRegionId },
      select: { id: true, deliveryPrice: true }
    });
    if (!custRegion) return { error: "المنطقة غير صالحة" };

    const custDel = custRegion.deliveryPrice.toNumber();

    const defaultDelivery = new Decimal(Math.max(shopDel, custDel));
    const delivery = (deliveryPriceOverride !== null && deliveryPriceOverride >= Number(defaultDelivery))
        ? new Decimal(deliveryPriceOverride)
        : defaultDelivery;

    const total = subtotal.plus(delivery);

    // الصور والصوت
    let imageUrl: string | null = null;
    const imageFiles = formData.getAll("orderImage");
    const imageFile = imageFiles.find((f) => f instanceof File && f.size > 0) as File | undefined;

    if (imageFile) {
      imageUrl = await saveOrderImageUploaded(imageFile, MAX_ORDER_IMAGE_BYTES).catch(() => null);
    }

    let voiceNoteUrl: string | null = null;
    const voiceFile = formData.get("voiceNote");
    if (voiceFile instanceof File && voiceFile.size > 0) {
      voiceNoteUrl = await saveVoiceNoteUploaded(voiceFile, MAX_VOICE_NOTE_BYTES).catch(() => null);
    }

    // إنشاء/تحديث الزبون (المستلم) بأمان
    let customerRow = await prisma.customer.findFirst({
      where: { shopId: submitter.shopId, phone: phoneLocal },
      select: { id: true }
    });

    if (!customerRow) {
      customerRow = await prisma.customer.create({
        data: {
          shopId: submitter.shopId,
          phone: phoneLocal,
          name: customerNameRaw,
          customerRegionId: custRegion.id,
          customerLocationUrl,
          customerLandmark,
        },
        select: { id: true },
      }).catch(async (err) => {
        console.warn("Failed to create customer with full details, retrying minimal:", err.message);
        return prisma.customer.create({
          data: {
            shopId: submitter.shopId,
            phone: phoneLocal,
            name: customerNameRaw,
          },
          select: { id: true },
        });
      });
    }

    // إنشاء أو تحديث الطلب
    let order;
    if (existingOrder) {
      const updateData: any = {
        summary: notes.trim(),
        orderType: withReversePickupPrefix(orderType, reversePickup),
        customerLandmark,
        customerRegionId: custRegion.id,
        deliveryPrice: delivery,
        orderSubtotal: subtotal,
        totalAmount: total,
        customerPhone: phoneLocal,
        orderNoteTime: orderTime.trim(),
        prepaidAll,
        vehiclePreference,
      };

      if (imageUrl) {
        updateData.imageUrl = imageUrl;
      }
      if (voiceNoteUrl) {
        updateData.voiceNoteUrl = voiceNoteUrl;
      }

      order = await prisma.order.update({
        where: { id: existingOrder.id },
        data: updateData,
        select: { id: true, orderNumber: true },
      });
    } else {
      // إنشاء الطلب مع معالجة استباقية للأعمدة المفقودة
      const orderData: any = {
        shopId: submitter.shopId,
        customerId: customerRow.id,
        status: "pending",
        summary: notes.trim(),
        orderType: withReversePickupPrefix(orderType, reversePickup),
        customerLocationUrl,
        customerLandmark,
        customerRegionId: custRegion.id,
        deliveryPrice: delivery,
        orderSubtotal: subtotal,
        totalAmount: total,
        customerPhone: phoneLocal,
        orderNoteTime: orderTime.trim(),
        imageUrl,
        voiceNoteUrl,
        shopDoorPhotoUrl: submitter.shop.photoUrl,
        submissionSource: "customer_via_employee_link",
        submittedByEmployeeId: submitter.id,
        prepaidAll,
        vehiclePreference,
      };

      order = await prisma.order.create({
        data: orderData,
        select: { id: true, orderNumber: true },
      }).catch(async (err) => {
        console.error("Primary order create failed, trying fallback:", err.message);

        // بناء بيانات احتياطية تحتوي فقط على الحقول القديمة والمضمونة 100%
        const fallbackData = {
          shopId: orderData.shopId,
          customerId: orderData.customerId,
          status: "pending",
          summary: orderData.summary,
          orderType: orderData.orderType,
          customerLocationUrl: orderData.customerLocationUrl,
          customerLandmark: orderData.customerLandmark,
          customerRegionId: orderData.customerRegionId,
          deliveryPrice: orderData.deliveryPrice,
          orderSubtotal: orderData.orderSubtotal,
          totalAmount: orderData.totalAmount,
          customerPhone: orderData.customerPhone,
          orderNoteTime: orderData.orderNoteTime,
          imageUrl: orderData.imageUrl,
          voiceNoteUrl: orderData.voiceNoteUrl,
          shopDoorPhotoUrl: orderData.shopDoorPhotoUrl,
        };

        return prisma.order.create({
          data: fallbackData,
          select: { id: true, orderNumber: true },
        });
      });
    }

    // مزامنة المرجع (بشكل غير متزامن)
    void upsertCustomerPhoneProfileFromOrderSnapshot({
      phone: phoneLocal,
      regionId: custRegion.id,
      locationUrl: customerLocationUrl,
      landmark: customerLandmark,
      doorPhotoUrl: "",
      alternatePhone: null,
    }).catch(() => null);

    // تنبيهات (بشكل غير متزامن)
    if (!existingOrder) {
      void notifyTelegramNewOrder(order.id).catch(() => null);
      await pushNotifyAdminsNewPendingOrder(order.orderNumber).catch(() => null);
      // إشعار المجهزين المسند إليهم هذا المحل
      const { notifyOneSignalPreparersForShopOrder } = await import("@/lib/onesignal-server");
      void notifyOneSignalPreparersForShopOrder(submitter.shopId, order.id).catch(() => null);
    }

    // جلب أسماء المناطق والمحلات للرسالة
    const fullShop = await prisma.shop.findUnique({
      where: { id: submitter.shopId },
      include: { region: true }
    });
    const fullRegion = await prisma.region.findUnique({ where: { id: custRegion.id } });

    // صياغة رسالة العميل (صاحب المحل) للواتساب
    const clientArea = fullShop?.region?.name || "منطقتكم";
    const customerArea = fullRegion?.name || "منطقة الزبون";

    const alertTemplate = await getNewOrderAlertWhatsappTemplate();
    const finalWaMessage = renderNewOrderAlertTemplate({
      template: alertTemplate,
      statusLabel: existingOrder ? "تم تعديل تفاصيل الطلب عبر النظام" : "لقد قام العميل برفع طلب جديد عبر النظام",
      shopName: fullShop?.name || submitter.shopId,
      clientArea,
      customerArea,
      orderType: withReversePickupPrefix(orderType, reversePickup),
      customerPhone: phoneLocal,
      subtotal: subtotalNum.toLocaleString(),
      delivery: delivery.toNumber().toLocaleString(),
      total: total.toNumber().toLocaleString(),
      notes: notes || "لا يوجد",
      orderNumber: order.orderNumber,
      orderTime: orderTime || "غير محدد",
    });

    const waUrl = whatsappMeUrl(OWNER_WHATSAPP_PHONE, finalWaMessage);

    revalidatePath(`${SECRET_ADMIN_PATH}/orders/pending`);
    return { ok: true, waUrl };
  } catch (err: any) {
    console.error("Submit Error:", err);
    return { error: "فشل إرسال الطلب: " + (err.message || "خطأ داخلي") };
  }
}

export async function updateCustomerUiMode(
  formData: FormData
) {
  const phone = String(formData.get("phone") ?? "").trim();
  const shopId = String(formData.get("shopId") ?? "").trim();
  const uiMode = String(formData.get("uiMode") ?? "learn");

  const phoneLocal = normalizeIraqMobileLocal11(phone);
  if (!phoneLocal || !shopId) return;

  await prisma.customer.updateMany({
    where: { phone: phoneLocal, shopId },
    data: { uiMode }
  });
}

export async function cancelClientOrder(formData: FormData): Promise<{ ok?: boolean; error?: string }> {
  try {
    const orderNumber = Number(formData.get("orderNumber"));
    const e = String(formData.get("e") ?? "");
    const exp = String(formData.get("exp") ?? "");
    const s = String(formData.get("s") ?? "");

    const v = verifyEmployeeOrderPortalQuery(e, exp, s);
    if (!v.ok) return { error: "الرابط غير صالح أو منتهي الصلاحية." };

    const order = await prisma.order.findUnique({
      where: { orderNumber },
      select: { id: true, status: true, shopId: true }
    });

    if (!order) {
      return { error: "الطلب غير موجود." };
    }

    if (order.status !== "pending" && order.status !== "assigned") {
      return { error: "عذراً، لا يمكن إلغاء الطلب في حالته الحالية (ربما تم استلامه من المندوب)." };
    }

    // التأكد من أن الطلب يخص نفس المحل المرتبط بالرابط
    const employee = await prisma.employee.findUnique({
      where: { id: v.employeeId },
      select: { shopId: true }
    });

    if (!employee || employee.shopId !== order.shopId) {
      return { error: "غير مصرح لك بإلغاء هذا الطلب." };
    }

    await prisma.order.update({
      where: { orderNumber },
      data: { status: "cancelled" }
    });

    // إرسال إشعار تليجرام عند الإلغاء
    void notifyTelegramOrderCanceledByClient(order.id).catch(() => null);

    revalidatePath("/client/order/history");
    revalidatePath(`${SECRET_ADMIN_PATH}/orders/pending`);
    revalidatePath(`${SECRET_ADMIN_PATH}/orders/tracking`);

    return { ok: true };
  } catch (err: any) {
    console.error("Cancel Order Error:", err);
    return { error: "فشل إلغاء الطلب: " + (err.message || "خطأ داخلي") };
  }
}

export async function sendNoCarsAlertTelegram(formData: FormData): Promise<{ ok?: boolean; error?: string }> {
  try {
    const customerPhone = String(formData.get("customerPhone") ?? "").trim();
    const customerName = String(formData.get("customerName") ?? "زبون").trim();
    const shopName = String(formData.get("shopName") ?? "المحل").trim();
    const noCarsMode = String(formData.get("noCarsMode") ?? "all_day").trim();

    if (!customerPhone) {
      return { error: "رقم الهاتف مطلوب لإرسال الإشعار." };
    }

    const phoneLocal = normalizeIraqMobileLocal11(customerPhone);
    if (!phoneLocal) {
      return { error: "رقم الهاتف غير صالح." };
    }

    // تحديد النص المماثل لوضعية عدم وجود السيارات
    let modeText = "اليوم بأكمله";
    if (noCarsMode === "morning") modeText = "صباحاً";
    if (noCarsMode === "evening") modeText = "مساءً";

    // صياغة الرسالة المطلوبة
    const text = [
      `⚠️ <b>امتناع عن رفع طلب بسبب السيارات</b>`,
      `👤 <b>العميل:</b> ${customerName}`,
      `📞 <b>الهاتف:</b> <code>${phoneLocal}</code>`,
      `🏢 <b>من محل:</b> ${shopName}`,
      `-------------------------`,
      `مرحبا قام <b>${customerName}</b>`,
      `من <b>${shopName}</b>`,
      `بالامتناع عن رفع الطلب لان طلبه يحتاج سياره هل تريد التحدث اليه`,
      `-------------------------`,
      `وضعية التفعيل: ${modeText}`
    ].join("\n");

    // إنشاء رابط الواتساب لمراسلة العميل
    const waUrl = whatsappMeUrl(phoneLocal, `مرحباً ${customerName}، هل واجهتك مشكلة في توصيل طلبك من محل ${shopName}؟`);

    const replyMarkup = {
      inline_keyboard: [
        [
          {
            text: "💬 مراسلة العميل عبر الواتساب",
            url: waUrl
          }
        ]
      ]
    };

    const { getBotTokenByPurpose } = await import("@/lib/telegram-bots");
    const { sendTelegramMessageWithKeyboard } = await import("@/lib/telegram");

    const notificationBotToken = await getBotTokenByPurpose("notification");
    await sendTelegramMessageWithKeyboard(text, replyMarkup, notificationBotToken);

    return { ok: true };
  } catch (err: any) {
    console.error("sendNoCarsAlertTelegram error:", err);
    return { error: err?.message || "فشل إرسال الإشعار" };
  }
}
