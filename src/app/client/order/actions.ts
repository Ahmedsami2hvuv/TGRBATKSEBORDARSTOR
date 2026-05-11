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
import { notifyTelegramNewOrder } from "@/lib/telegram-notify";
import { getCustomerOrderWhatsappTemplate, renderWhatsappTemplate } from "@/lib/whatsapp-template-settings";
import { whatsappMeUrl } from "@/lib/whatsapp";

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

    revalidatePath("/admin/orders/pending");
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

    if (!orderType) return { error: "نوع الطلب مطلوب" };
    if (!customerRegionId) return { error: "اختر المنطقة" };
    if (!orderTime.trim()) return { error: "وقت الطلب إجباري" };

    const phoneLocal = normalizeIraqMobileLocal11(customerPhone);
    if (!phoneLocal) return { error: "رقم الهاتف غير صحيح" };

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
    const imageFile = formData.get("orderImage");
    if (imageFile instanceof File && imageFile.size > 0) {
      imageUrl = await saveOrderImageUploaded(imageFile, MAX_ORDER_IMAGE_BYTES).catch(() => null);
    }

    let voiceNoteUrl: string | null = null;
    const voiceFile = formData.get("voiceNote");
    if (voiceFile instanceof File && voiceFile.size > 0) {
      voiceNoteUrl = await saveVoiceNoteUploaded(voiceFile, MAX_VOICE_NOTE_BYTES).catch(() => null);
    }

    // إنشاء/تحديث العميل بأمان (تجنب الحقول التي قد لا تكون موجودة في DB)
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

    const order = await prisma.order.create({
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
    void notifyTelegramNewOrder(order.id).catch(() => null);
    void pushNotifyAdminsNewPendingOrder(order.orderNumber).catch(() => null);

    const waTemplate = await getCustomerOrderWhatsappTemplate();
    const waMessage = renderWhatsappTemplate({
      template: waTemplate,
      shopName: submitter.shopId, // Usually we want shop.name, but let's see what's available
      regionName: custRegion.id, // Usually we want region.name
      orderItems: notes,
      orderNumber: order.orderNumber,
    });

    // Attempt to get names instead of IDs if possible
    const fullShop = await prisma.shop.findUnique({ where: { id: submitter.shopId }, select: { name: true } });
    const fullRegion = await prisma.region.findUnique({ where: { id: custRegion.id }, select: { name: true } });

    const finalWaMessage = renderWhatsappTemplate({
      template: waTemplate,
      shopName: fullShop?.name || submitter.shopId,
      regionName: fullRegion?.name || custRegion.id,
      orderItems: notes,
      orderNumber: order.orderNumber,
    });

    const waUrl = whatsappMeUrl(OWNER_WHATSAPP_PHONE, finalWaMessage);

    revalidatePath("/admin/orders/pending");
    return { ok: true, waUrl };
  } catch (err: any) {
    console.error("Submit Error:", err);
    return { error: "فشل إرسال الطلب: " + (err.message || "خطأ داخلي") };
  }
}
