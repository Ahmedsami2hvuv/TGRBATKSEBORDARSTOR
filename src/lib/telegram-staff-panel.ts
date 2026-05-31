import { prisma } from "./prisma";
import {
  sendTelegramHtmlToChat,
  sendTelegramMessageWithKeyboardToChat,
  answerCallbackQuery,
  editTelegramMessage,
  TelegramInlineKeyboard
} from "./telegram";
import { getStaffPortalLink } from "./staff-employee-portal-link";

export async function handleStaffTelegramMessage(msg: any, botToken: string) {
  const chatId = String(msg.chat.id);
  const text = msg.text || "";
  const telegramUserId = String(msg.from.id);

  // 1. معالجة التفعيل (Start Payload)
  if (text.startsWith("/start staff_")) {
    const staffId = text.replace("/start staff_", "").trim();
    const staff = await prisma.staffEmployee.findUnique({ where: { id: staffId } });

    if (staff) {
      await prisma.staffEmployee.update({
        where: { id: staffId },
        data: { telegramUserId }
      });

      await sendTelegramHtmlToChat(
        chatId,
        `<b>✅ تم تفعيل حسابك بنجاح!</b>\n\nأهلاً بك يا <b>${staff.name}</b> في نظام الإشعارات.\nستصلك هنا تنبيهات عند استلام أو تسليم الطلبات التي ترفعها.`,
        botToken
      );
      await sendStaffMainMenu(chatId, staff, botToken);
      return true;
    }
  }

  // البحث عن الموظف بواسطة معرف التيليجرام
  const staff = await prisma.staffEmployee.findFirst({
    where: { telegramUserId, active: true }
  });

  if (!staff) return false;

  if (text === "/start" || text === "القائمة الرئيسية") {
    await sendStaffMainMenu(chatId, staff, botToken);
    return true;
  }

  return false;
}

export async function handleStaffTelegramCallback(cb: any, botToken: string) {
  const chatId = String(cb.message.chat.id);
  const messageId = cb.message.message_id;
  const data = cb.data || "";
  const telegramUserId = String(cb.from.id);

  const staff = await prisma.staffEmployee.findFirst({
    where: { telegramUserId, active: true }
  });

  if (!staff) {
    await answerCallbackQuery(cb.id, "الحساب غير مفعّل.", true, botToken);
    return;
  }

  if (data === "staff_profits") {
    await showStaffProfits(chatId, messageId, staff, botToken);
    await answerCallbackQuery(cb.id, "", false, botToken);
  } else if (data === "staff_main") {
    const { text, keyboard } = await getStaffMainMenuData(staff);
    await editTelegramMessage(chatId, messageId, text, keyboard, botToken);
    await answerCallbackQuery(cb.id, "", false, botToken);
  } else if (data.startsWith("staff_order_")) {
      const orderId = data.replace("staff_order_", "");
      await showStaffOrderDetails(chatId, messageId, orderId, botToken);
      await answerCallbackQuery(cb.id, "", false, botToken);
  }
}

async function getStaffMainMenuData(staff: any) {
    const portalLink = getStaffPortalLink(staff.id);
    const text = `<b>👋 أهلاً بك يا ${staff.name}</b>\n\nيمكنك متابعة أرباحك وإشعارات طلباتك من هنا.`;
    const keyboard: TelegramInlineKeyboard = {
        inline_keyboard: [
            [{ text: "💰 أرباحي (المحفظة)", callback_data: "staff_profits" }],
            [{ text: "🌐 فتح بوابة الموظف", url: portalLink }],
        ]
    };
    return { text, keyboard };
}

async function sendStaffMainMenu(chatId: string, staff: any, botToken: string) {
    const { text, keyboard } = await getStaffMainMenuData(staff);
    await sendTelegramMessageWithKeyboardToChat(chatId, text, keyboard, botToken);
}

async function showStaffProfits(chatId: string, messageId: number, staff: any, botToken: string) {
    // جلب الطلبات الأخيرة (آخر 5 طلبات تم تسليمها)
    const orders = await prisma.order.findMany({
        where: {
            preparerShoppingJson: { path: ["staffId"], equals: staff.id },
            status: "delivered"
        },
        orderBy: { createdAt: "desc" },
        take: 5
    });

    // حساب إجمالي الأرباح غير المستلمة
    const allDelivered = await prisma.order.findMany({
        where: {
            preparerShoppingJson: { path: ["staffId"], equals: staff.id },
            status: "delivered"
        }
    });

    const pendingProfit = allDelivered.reduce((acc, o) => {
        const json = o.preparerShoppingJson as any;
        return acc + (json?.staffProfit && !json?.profitSettled ? Number(json.staffProfit) : 0);
    }, 0);

    let text = `<b>💰 محفظة الأرباح</b>\n\n`;
    text += `▫️ أرباح بانتظار الاستلام: <b>${pendingProfit.toLocaleString()} د.ع</b>\n\n`;
    text += `<b>آخر الطلبات المسلمة:</b>`;

    const keyboard: TelegramInlineKeyboard = { inline_keyboard: [] };

    if (orders.length === 0) {
        text += `\n<i>لا توجد طلبات مسلمة مؤخراً.</i>`;
    } else {
        for (const o of orders) {
            const json = o.preparerShoppingJson as any;
            const statusIcon = json.profitSettled ? "✅" : "⏳";
            keyboard.inline_keyboard.push([{
                text: `${statusIcon} طلب #${o.id.slice(-5).toUpperCase()} - ${json.staffProfit} د.ع`,
                callback_data: `staff_order_${o.id}`
            }]);
        }
    }

    keyboard.inline_keyboard.push([{ text: "🔙 العودة", callback_data: "staff_main" }]);

    await editTelegramMessage(chatId, messageId, text, keyboard, botToken);
}

async function showStaffOrderDetails(chatId: string, messageId: number, orderId: string, botToken: string) {
    const order = await prisma.order.findUnique({
        where: { id: orderId },
        include: { courier: true, customerRegion: true, secondCustomerRegion: true }
    });

    if (!order) return;
    const json = order.preparerShoppingJson as any;

    let text = `<b>📦 تفاصيل الطلب #${order.id.slice(-6).toUpperCase()}</b>\n\n`;
    text += `📝 الوصف: ${order.summary || "طلب ذو وجهتين"}\n`;
    text += `💰 ربحك: <b>${json?.staffProfit} د.ع</b>\n`;
    text += `🚚 المندوب: ${order.courier?.name || "غير محدد"}\n`;
    text += `📍 من: ${order.customerRegion?.name || "غير محدد"}\n`;
    text += `📍 إلى: ${order.secondCustomerRegion?.name || "غير محدد"}\n`;
    text += `🏁 الحالة: ${order.status === 'delivered' ? '✅ تم التسليم' : '🚚 قيد التوصيل'}\n`;
    text += `💵 التسوية: ${json?.profitSettled ? '✅ تم استلام الربح' : '⏳ بانتظار الاستلام'}`;

    const keyboard: TelegramInlineKeyboard = {
        inline_keyboard: [[{ text: "🔙 عودة للأرباح", callback_data: "staff_profits" }]]
    };

    await editTelegramMessage(chatId, messageId, text, keyboard, botToken);
}

/**
 * إرسال إشعار للموظف عند استلام المندوب للطلب
 */
export async function notifyStaffOrderPickedUp(orderId: string) {
    const order = await prisma.order.findUnique({
        where: { id: orderId },
        include: { courier: true, customerRegion: true, secondCustomerRegion: true }
    });

    if (!order) return;
    const json = order.preparerShoppingJson as any;
    const staffId = json?.staffId;
    if (!staffId) return;

    const staff = await prisma.staffEmployee.findUnique({ where: { id: staffId } });
    if (!staff || !staff.telegramUserId) return;

    // جلب توكن بوت الموظفين
    const bot = await prisma.telegramBot.findFirst({ where: { purpose: "employee", active: true } });
    if (!bot) return;

    const text = `<b>🚚 تم استلام طلبك!</b>\n\n` +
        `المندوب <b>${order.courier?.name}</b> قام باستلام الطلب وهو الآن في طريقه للتوصيل.\n\n` +
        `📱 بائع: ${order.customerPhone} (${order.customerRegion?.name})\n` +
        `📱 مشترٍ: ${order.secondCustomerPhone} (${order.secondCustomerRegion?.name})\n` +
        `💰 ربحك المتوقع: <b>${json.staffProfit} د.ع</b>`;

    await sendTelegramHtmlToChat(staff.telegramUserId, text, bot.token);
}

/**
 * إرسال إشعار للموظف عند تسليم الطلب
 */
export async function notifyStaffOrderDelivered(orderId: string) {
    const order = await prisma.order.findUnique({
        where: { id: orderId },
        include: { courier: true, customerRegion: true, secondCustomerRegion: true }
    });

    if (!order) return;
    const json = order.preparerShoppingJson as any;
    const staffId = json?.staffId;
    if (!staffId) return;

    const staff = await prisma.staffEmployee.findUnique({ where: { id: staffId } });
    if (!staff || !staff.telegramUserId) return;

    const bot = await prisma.telegramBot.findFirst({ where: { purpose: "employee", active: true } });
    if (!bot) return;

    // حساب الأرباح الكلية المعلقة
    const allDelivered = await prisma.order.findMany({
        where: {
            preparerShoppingJson: { path: ["staffId"], equals: staffId },
            status: "delivered"
        }
    });

    const totalPending = allDelivered.reduce((acc, o) => {
        const j = o.preparerShoppingJson as any;
        return acc + (j?.staffProfit && !j?.profitSettled ? Number(j.staffProfit) : 0);
    }, 0);

    const text = `<b>✅ تم تسليم الطلب بنجاح!</b>\n\n` +
        `المندوب <b>${order.courier?.name}</b> سلم الطلب للمشتري.\n\n` +
        `📱 بائع: ${order.customerPhone} (${order.customerRegion?.name})\n` +
        `📱 مشترٍ: ${order.secondCustomerPhone} (${order.secondCustomerRegion?.name})\n` +
        `💵 سعر البائع: ${order.orderSubtotal || 0} د.ع\n` +
        `🚚 كلفة التوصيل: ${order.deliveryPrice || 0} د.ع\n` +
        `💰 ربحك من هذا الطلب: <b>${json.staffProfit} د.ع</b>\n\n` +
        `📉 إجمالي أرباحك بانتظار الاستلام: <b>${totalPending.toLocaleString()} د.ع</b>`;

    const keyboard: TelegramInlineKeyboard = {
        inline_keyboard: [[{ text: "💰 عرض المحفظة", callback_data: "staff_profits" }]]
    };

    await sendTelegramMessageWithKeyboardToChat(staff.telegramUserId, text, keyboard, bot.token);
}
