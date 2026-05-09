"use server";

import { prisma } from "@/lib/prisma";
import { Decimal } from "@prisma/client/runtime/library";
import { normalizeIraqMobileLocal11 } from "@/lib/whatsapp";

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

  const totalAmount = subtotal + Number(region.deliveryPrice);

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

    const { order, draft } = await prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<Array<{ next_number: bigint | number | string }>>`
        SELECT nextval(pg_get_serial_sequence('"Order"', 'orderNumber')) AS next_number
      `;
      const raw = rows[0]?.next_number;
      const nextOrderNumber = typeof raw === "bigint" ? Number(raw) : Number(raw ?? 0);
      if (!Number.isFinite(nextOrderNumber) || nextOrderNumber <= 0) {
        throw new Error("Failed to reserve next real order number");
      }

      const prepJson = {
        version: 1,
        reservedOrderNumber: nextOrderNumber,
        products: cart.map(i => ({
          line: i.name,
          qty: i.quantity || 1,
          buyAlf: "0",
          sellAlf: (Number(i.price || 0) / 1000).toString(),
          isFromStore: true,
          supplierId: i.supplierId || null,
          productId: i.productId || i.id
        })),
        webStoreCart: cart
      };

      // إنشاء طلب حقيقي بمصدر web_store لكي يظهر في "طلبات المتجر" للمجهز
      const createdOrder = await tx.order.create({
        data: {
          shopId: shop!.id,
          customerId: customer!.id,
          status: "pending",
          submissionSource: "web_store",
          customerPhone: phoneLocal,
          customerRegionId: regionId,
          customerLandmark: landmark,
          orderSubtotal: new Decimal(subtotal),
          deliveryPrice: region.deliveryPrice,
          totalAmount: new Decimal(totalAmount),
          summary: summaryParts.join("\n"),
          orderNumber: nextOrderNumber,
          preparerShoppingJson: prepJson
        }
      });

      // إنشاء مسودة تجهيز وربطها بالطلب
      const createdDraft = await tx.companyPreparerShoppingDraft.create({
        data: {
          preparerId: null,
          customerPhone: phoneLocal,
          customerRegionId: regionId,
          customerLandmark: landmark,
          titleLine: "طلب من المتجر الالكتروني",
          rawListText: summaryParts.join("\n"),
          status: "draft",
          sentOrderId: createdOrder.id,
          data: prepJson
        }
      });

      return { order: createdOrder, draft: createdDraft };
    });

    // Notify via Telegram
    try {
      const { sendTelegramMessage, escapeTelegramHtml } = await import("@/lib/telegram");

      const telegramText = [
        `🛒 <b>طلب تجهيز جديد (المتجر الالكتروني)</b>`,
        `🔢 <b>رقم الطلب:</b> <code>${order.orderNumber}</code>`,
        `📞 <b>الهاتف:</b> <code>${escapeTelegramHtml(phoneLocal)}</code>`,
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

    const numericOrderNumber = String(order.orderNumber);
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
