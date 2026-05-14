"use server";

import { prisma } from "@/lib/prisma";
import { Decimal } from "@prisma/client/runtime/library";
import { normalizeIraqMobileLocal11 } from "@/lib/whatsapp";
import { notifyTelegramStoreOrder } from "@/lib/telegram-notify";

export type OrderFormState = {
  error?: string;
  ok?: boolean;
  orderNumber?: string;
  whatsappMessage?: string;
};

export async function submitStoreOrder(_prev: any, formData: FormData): Promise<OrderFormState> {
  const phone = formData.get("phone") as string;
  const regionId = formData.get("regionId") as string;
  const deliveryPriceOverriden = Number(formData.get("deliveryPrice") || 0);
  const vehiclePreference = formData.get("vehiclePreference") as string || null;
  const landmark = formData.get("landmark") as string || "";
  const cartJson = formData.get("cart") as string;

  if (!phone || !regionId || !cartJson) {
    return { error: "يرجى ملء جميع الحقول المطلوبة" };
  }

  const phoneLocal = normalizeIraqMobileLocal11(phone) || phone;

  const cart = JSON.parse(cartJson);
  if (!Array.isArray(cart) || cart.length === 0) {
    return { error: "السلة فارغة" };
  }

  // Calculate totals and build summary
  let subtotal = 0;
  let summaryParts: string[] = [];

  cart.forEach((item: any) => {
    subtotal += Number(item.price || 0) * (item.quantity || 1);
    summaryParts.push(`${item.name} (${item.quantity || 1})`);
  });

  const region = await prisma.region.findUnique({ where: { id: regionId } });
  if (!region) return { error: "المنطقة غير صالحة" };

  const basePrice = Number(region.deliveryPrice);
  const finalDeliveryPrice = deliveryPriceOverriden > basePrice ? deliveryPriceOverriden : basePrice;

  const totalAmount = subtotal + finalDeliveryPrice;

  try {
    // الحصول على محل "خصيب ستور" أو إنشاؤه إذا لم يكن موجوداً
    let shop = await prisma.shop.findFirst({
      where: { name: { contains: "خصيب", mode: "insensitive" } }
    });

    if (!shop) {
      shop = await prisma.shop.findFirst({
        where: { name: { contains: "متجر", mode: "insensitive" } }
      });
    }

    if (!shop) {
      shop = await prisma.shop.findFirst();
    }

    if (!shop) {
      return { error: "لا يوجد محل مفعل لاستقبال الطلبات حالياً" };
    }

    // البحث عن عميل أو إنشاؤه لهذا المحل
    let customer = await prisma.customer.findFirst({
      where: { shopId: shop.id, phone: phoneLocal }
    });

    if (!customer) {
      customer = await prisma.customer.create({
        data: {
          shopId: shop.id,
          phone: phoneLocal,
          customerRegionId: regionId,
          customerLandmark: landmark,
        }
      });
    }

    const draft = await prisma.$transaction(async (tx) => {
      // إنشاء مسودة تجهيز فقط لكي تظهر في تبويب "قيد التجهيز" للإدارة للتسعير والإسناد
      return tx.companyPreparerShoppingDraft.create({
        data: {
          preparerId: null, // سيبقى فارغاً حتى يسنده الأدمن لمجهز معين
          customerPhone: phoneLocal,
          customerRegionId: regionId,
          customerLandmark: landmark,
          titleLine: "طلب من المتجر الالكتروني",
          rawListText: summaryParts.join("\n"),
          status: "draft",
          vehiclePreference: vehiclePreference,
          data: {
            version: 1,
            products: cart.map(i => ({
              line: i.name,
              qty: i.quantity || 1,
              buyAlf: "", // نتركها فارغة لكي يضطر المجهز لتسعيرها وتجهيزها
              sellAlf: "", // نتركها فارغة لضمان ظهورها كغير مجهزة
              isFromStore: true,
              supplierId: i.supplierId || null,
              productId: i.productId || i.id
            })),
            webStoreCart: cart
          }
        }
      });
    });

    // Notify via Telegram
    void notifyTelegramStoreOrder(draft.id);

    const numericOrderNumber = String(draft.draftNumber);
    const productLines = cart.map((item: any) => `- ${item.name} × ${item.quantity || 1}`);
    const whatsappMessage = [
      "لقد قمت بالطلب من خصيب ستور ارجو تجهيز طلبي",
      `رقم طلبي هو: ${numericOrderNumber}`,
      "المنتجات:",
      ...productLines,
    ].join("\n");

    return {
      ok: true,
      orderNumber: numericOrderNumber,
      whatsappMessage,
    };
  } catch (e) {
    console.error("Order creation failed", e);
    return { error: "فشل في إرسال الطلب، يرجى المحاولة لاحقاً" };
  }
}
