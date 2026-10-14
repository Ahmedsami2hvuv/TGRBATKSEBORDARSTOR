import { prisma } from "@/lib/prisma";
import { getBotTokenByPurpose } from "@/lib/telegram-bots";
import { sendTelegramMessage, escapeTelegramHtml } from "@/lib/telegram";
import { pushNotifyAdminsNewStoreOrder } from "@/lib/web-push-server";

export interface CreateShopOrderInput {
  shopId: string;
  customerPhone: string;
  regionName: string;
  receiptTime: string;
  cart: Array<{
    id: string;
    name: string;
    price: number;
    quantity: number;
  }>;
}

export async function processShopStoreOrder(input: CreateShopOrderInput) {
  const { shopId, customerPhone, regionName, receiptTime, cart } = input;

  // 1. التحقق الصارم من رقم الهاتف: يجب أن يتكون من 11 رقماً صحيحاً (مثال: 07xxxxxxxxx)
  const cleanPhone = customerPhone.replace(/\D/g, "");
  if (cleanPhone.length !== 11 || !cleanPhone.startsWith("07")) {
    return {
      ok: false,
      error: "رقم الهاتف غير صحيح. يجب أن يتكون من 11 رقماً ويبدأ بـ 07 (مثال: 07733921468)",
    };
  }

  // 2. التحقق من السلة
  if (!cart || cart.length === 0) {
    return { ok: false, error: "السلة فارغة، يرجى إضافة منتجات أولاً" };
  }

  // 3. جلب بيانات المحل
  const shop = await prisma.shop.findUnique({
    where: { id: shopId },
  });

  if (!shop) {
    return { ok: false, error: "المحل غير موجود" };
  }

  if (!shop.storeEnabled) {
    return { ok: false, error: "متجر هذا المحل غير مفعل حالياً" };
  }

  // 4. حساب مجموع الطلب
  let totalPrice = 0;
  cart.forEach((item) => {
    totalPrice += Number(item.price || 0) * (item.quantity || 1);
  });

  const orderNumber = `SHOP-${Date.now().toString().slice(-6)}`;

  // 5. حفظ الطلب في قاعدة البيانات
  let savedOrder;
  try {
    savedOrder = await prisma.shopStoreOrder.create({
      data: {
        orderNumber,
        shopId: shop.id,
        shopName: shop.name,
        customerPhone: cleanPhone,
        regionName: regionName.trim(),
        receiptTime: receiptTime.trim(),
        totalPrice,
        items: cart,
        status: "pending",
      },
    });
  } catch (err: any) {
    console.error("[ShopStoreOrder] Database error:", err);
  }

  // 6. إرسال الإشعار الفوري لإدارة الموقع كما طلب صاحب المشروع حرفياً:
  // "يأتينا إشعار كطلب جديد من اسم المحل وسعر الطلب ومنطقة الزبون ونوع الطلب تجهيز تسوق ووقت الطلب الذي كتبه الزبون"
  try {
    const notifyLines = [
      `🔔 <b>طلب جديد من: ${escapeTelegramHtml(shop.name)}</b>`,
      `📦 <b>نوع الطلب:</b> تجهيز تسوق`,
      `💰 <b>سعر الطلب:</b> ${totalPrice.toLocaleString()} د.ع`,
      `📍 <b>منطقة الزبون:</b> ${escapeTelegramHtml(regionName)}`,
      `⏰ <b>وقت الطلب:</b> ${escapeTelegramHtml(receiptTime || "غير محدد")}`,
      `📞 <b>هاتف الزبون:</b> ${escapeTelegramHtml(cleanPhone)}`,
      `🔢 <b>رقم الطلب:</b> ${orderNumber}`,
      `-------------------------`,
      `<b>المنتجات المطلوبة:</b>`,
      ...cart.map((i) => `▫️ ${escapeTelegramHtml(i.name)} × ${i.quantity} (${(i.price * i.quantity).toLocaleString()} د.ع)`),
    ];

    const messageText = notifyLines.join("\n");

    // إرسال عبر بوت التيليجرام للإشعارات
    const botToken = await getBotTokenByPurpose("notification");
    if (botToken) {
      await sendTelegramMessage(messageText, { botToken }).catch((e) =>
        console.error("[ShopStoreNotify] Telegram error:", e)
      );
    }

    // إرسال ويب بوش للوحة التحكم
    await pushNotifyAdminsNewStoreOrder({
      orderNumber,
      customerName: `زبون متجر ${shop.name}`,
      regionName,
      totalAmount: totalPrice,
      cartSummary: `تجهيز تسوق - وقت الاستلام: ${receiptTime}`,
    }).catch(() => {});
  } catch (notifyErr) {
    console.error("[ShopStoreNotify] Error sending notification:", notifyErr);
  }

  // 7. تجهيز رسالة الواتساب ورابط توجيه الزبون لصاحب المحل
  const shopPhone = (shop.phone || "").replace(/\D/g, "");
  let targetWaNumber = shopPhone;
  if (targetWaNumber.startsWith("07")) {
    targetWaNumber = "964" + targetWaNumber.slice(1);
  }

  // رسالة الواتساب لصاحب المحل
  const waCartText = cart
    .map((item, index) => `${index + 1}. ${item.name} × ${item.quantity} = ${(item.price * item.quantity).toLocaleString()} د.ع`)
    .join("\n");

  const whatsappMessage = `السلام عليكم ورحمة الله وبركاته،
أرغب بطلب المنتجات التالية من متجركم (${shop.name}):

${waCartText}

المجموع الإجمالي: ${totalPrice.toLocaleString()} د.ع
📍 المنطقة: ${regionName}
⏰ وقت استلام الطلب: ${receiptTime}
📞 رقم هاتفي: ${cleanPhone}
رقم الطلب: ${orderNumber}

يرجى تأكيد وتجهيز الطلب وشكراً لكم.`;

  const whatsappUrl = targetWaNumber
    ? `https://wa.me/${targetWaNumber}?text=${encodeURIComponent(whatsappMessage)}`
    : `https://wa.me/?text=${encodeURIComponent(whatsappMessage)}`;

  return {
    ok: true,
    orderNumber,
    totalPrice,
    whatsappUrl,
    whatsappMessage,
  };
}
