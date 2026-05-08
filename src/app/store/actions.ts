"use server";

import { prisma } from "@/lib/prisma";

export type OrderFormState = {
  error?: string;
  ok?: boolean;
  orderNumber?: string;
  whatsappMessage?: string;
};

export async function submitStoreOrder(_prev: any, formData: FormData): Promise<OrderFormState> {
  const phone = formData.get("phone") as string;
  const regionId = formData.get("regionId") as string;
  const landmark = formData.get("landmark") as string || "";
  const cartJson = formData.get("cart") as string;

  if (!phone || !regionId || !cartJson) {
    return { error: "يرجى ملء جميع الحقول المطلوبة" };
  }

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

  const totalAmount = subtotal + Number(region.deliveryPrice);

  try {
    // الحصول على محل "خصيب ستور" أو إنشاؤه إذا لم يكن موجوداً
    let shop = await prisma.shop.findFirst({
      where: { name: { contains: "خصيب", mode: "insensitive" } }
    });

    if (!shop) {
      // إذا لم يوجد، نبحث عن أي محل يحتوي كلمة "متجر"
      shop = await prisma.shop.findFirst({
        where: { name: { contains: "متجر", mode: "insensitive" } }
      });
    }

    // إذا لم يوجد أي محل مناسب، نستخدم أول محل متاح أو ننشئ واحداً افتراضياً
    if (!shop) {
      shop = await prisma.shop.findFirst();
    }

    // إنشاء مسودة تجهيز مباشرة لكي تظهر في تبويب "قيد التجهيز" للإدارة
    const draft = await prisma.companyPreparerShoppingDraft.create({
      data: {
        preparerId: null, // سيبقى فارغاً حتى يسحبه مجهز معين أو يوجهه الأدمن
        customerPhone: phone,
        customerRegionId: regionId,
        customerLandmark: landmark,
        titleLine: "طلب من المتجر الالكتروني",
        rawListText: summaryParts.join("\n"),
        status: "draft",
        data: {
          version: 1,
          products: cart.map(i => ({
            line: i.name,
            qty: i.quantity || 1,
            buyAlf: "0",
            sellAlf: (Number(i.price || 0) / 1000).toString(),
            isFromStore: true,
            supplierId: i.supplierId || null, // تمرير معرف المورد إن وجد
            productId: i.productId || i.id // تمرير معرف المنتج الأصلي
          })),
          webStoreCart: cart
        }
      }
    });

    // Notify via Telegram
    try {
      const { sendTelegramMessage, escapeTelegramHtml } = await import("@/lib/telegram");

      const telegramText = [
        `🛒 <b>طلب تجهيز جديد (المتجر الالكتروني)</b>`,
        `🔢 <b>رقم المسودة:</b> <code>${draft.id.slice(-6)}</code>`,
        `📞 <b>الهاتف:</b> <code>${escapeTelegramHtml(phone)}</code>`,
        `📍 <b>المنطقة:</b> ${escapeTelegramHtml(region.name)}`,
        `🏠 <b>نقطة دالة:</b> ${escapeTelegramHtml(landmark)}`,
        `-------------------------`,
        `📦 <b>المحتويات:</b>`,
        ...cart.map((i: any) => {
          return `• ${escapeTelegramHtml(i.name)} (${i.quantity || 1})`;
        }),
        `-------------------------`,
        `🔗 <a href="${process.env.NEXT_PUBLIC_APP_URL || ''}/admin/orders/pending?tab=preparing">فتح لوحة التجهيز</a>`
      ].join("\n");

      await sendTelegramMessage(telegramText);
    } catch (teleErr) {
      console.error("Telegram notification failed", teleErr);
    }

    const numericOrderNumber = String(draft.orderNumber);
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
