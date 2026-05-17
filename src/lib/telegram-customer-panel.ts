import { prisma } from "./prisma";
import {
  sendTelegramHtmlToChat,
  sendTelegramMessageWithKeyboardToChat,
  type TelegramInlineKeyboard,
} from "./telegram";
import { buildEmployeeOrderPortalUrl, verifyEmployeeOrderPortalQuery } from "./employee-order-portal-link";
import { getPublicAppUrl } from "./app-url";

/**
 * بناء لوحة تحكم العميل (الموظف)
 */
function buildCustomerKeyboard(portalUrl: string): TelegramInlineKeyboard {
  return {
    inline_keyboard: [
      [
        { text: "📦 رفع طلب جديد", url: portalUrl },
      ],
      [
        { text: "📜 سجل الطلبات", url: portalUrl.replace("/order", "/order/history") },
        { text: "📊 إحصائياتي", url: portalUrl.replace("/order", "/order/account") }
      ],
      [
        { text: "🚪 تسجيل الخروج", callback_data: "logout" }
      ]
    ]
  };
}

/**
 * معالجة رسائل بوت العملاء الخاصة
 */
export async function handleCustomerPrivateMessage(msg: any, botToken: string): Promise<void> {
  const telegramUserId = String(msg.from.id);
  const chatId = String(msg.chat.id);
  const text = msg.text?.trim() || "";

  // دالة لمحاولة استخراج البيانات من الرابط (سواء كان في الـ start أو كرسالة عادية)
  const tryParsePortalUrl = async (input: string) => {
    try {
      let urlStr = input;
      // إذا كان النص قادماً من /start payload
      if (input.startsWith("/start ")) {
        const payload = input.split(" ")[1];

        // التعامل مع الروابط المختصرة المخزنة في SchemaPlaceholder
        if (payload.startsWith("pl_")) {
          const stored = await prisma.schemaPlaceholder.findUnique({
            where: { id: payload }
          });
          if (stored && stored.note.startsWith("http")) {
            urlStr = stored.note;
          } else {
            return null;
          }
        } else {
          // المحاولة القديمة: Base64
          try {
            urlStr = Buffer.from(payload, "base64").toString("utf-8");
          } catch {
            return null;
          }
        }
      }

      const urlObj = new URL(urlStr);
      const e = urlObj.searchParams.get("e");
      const exp = urlObj.searchParams.get("exp");
      const s = urlObj.searchParams.get("s");

      if (e && exp && s) {
        const v = verifyEmployeeOrderPortalQuery(e, exp, s);
        return { ok: v.ok, employeeId: v.employeeId, url: urlStr };
      }
    } catch (err) {
      return null;
    }
    return null;
  };

  const v = await tryParsePortalUrl(text);

  if (v && v.ok) {
    const employee = await prisma.employee.findUnique({
      where: { id: v.employeeId },
      include: { shop: true }
    });

    if (employee) {
      // إلغاء أي ربط سابق لهذا المستخدم لضمان عدم حدوث خطأ Unique constraint
      await prisma.employee.updateMany({
        where: { telegramUserId },
        data: { telegramUserId: null }
      });

      // ربط الحساب بالتيليجرام
      await prisma.employee.update({
        where: { id: employee.id },
        data: { telegramUserId }
      });

      const welcomeMsg = `<b>أهلاً بك يا ${employee.name}</b>\nمن محل <b>${employee.shop.name}</b>\n\nلقد تم تفعيل حسابك بنجاح. يمكنك استخدام الأزرار أدناه:`;

      await sendTelegramMessageWithKeyboardToChat(chatId, welcomeMsg, buildCustomerKeyboard(v.url), botToken);
      return;
    }
  }

  // إذا لم يكن رابطاً، نتحقق إذا كان المستخدم مسجلاً مسبقاً
  const existingEmployee = await prisma.employee.findUnique({
    where: { telegramUserId },
    include: { shop: true }
  });

  if (existingEmployee) {
    const portalUrl = buildEmployeeOrderPortalUrl(existingEmployee.id, existingEmployee.orderPortalToken, getPublicAppUrl());
    const msgText = `<b>لوحة تحكم ${existingEmployee.name}</b>\nمحل: <b>${existingEmployee.shop.name}</b>`;
    await sendTelegramMessageWithKeyboardToChat(chatId, msgText, buildCustomerKeyboard(portalUrl), botToken);
    return;
  }

  // الرد الافتراضي
  if (text.startsWith("/start")) {
    // في حال كان المستخدم مسجلاً وطلب /start، نعرض له اللوحة مباشرة
    const employee = await prisma.employee.findUnique({
      where: { telegramUserId },
      include: { shop: true }
    });

    if (employee) {
      const portalUrl = buildEmployeeOrderPortalUrl(employee.id, employee.orderPortalToken, getPublicAppUrl());
      const msgText = `<b>لوحة تحكم ${employee.name}</b>\nمحل: <b>${employee.shop.name}</b>`;
      await sendTelegramMessageWithKeyboardToChat(chatId, msgText, buildCustomerKeyboard(portalUrl), botToken);
      return;
    }

    await sendTelegramHtmlToChat(
      chatId,
      "مرحباً بك في بوت العملاء.\n\nيرجى العودة لصفحة المتصفح والضغط على زر <b>(إرسال الرابط للبوت)</b> ليتم تفعيل خياراتك هنا.",
      botToken
    );
    return;
  }

  await sendTelegramHtmlToChat(
    chatId,
    "عذراً، لم أتعرف على هذا الرابط. يرجى إرسال رابط بوابة العميل الصحيح من المتصفح.",
    botToken
  );
}

/**
 * معالجة الـ Callbacks لبوت العملاء
 */
export async function handleCustomerCallback(cb: any, botToken: string): Promise<void> {
  const { answerCallbackQuery, editTelegramMessage } = await import("./telegram");
  const telegramUserId = String(cb.from.id);
  const chatId = String(cb.message.chat.id);

  if (cb.data === "logout") {
    await prisma.employee.updateMany({
      where: { telegramUserId },
      data: { telegramUserId: null }
    });

    await prisma.telegramBotSession.updateMany({
      where: { telegramUserId },
      data: { step: "idle", payload: "" }
    });

    await answerCallbackQuery(cb.id, "تم تسجيل الخروج بنجاح", false, botToken).catch(() => {});
    await editTelegramMessage(
      chatId,
      cb.message.message_id,
      "<b>تم تسجيل الخروج</b>\n\nتم إلغاء ربط حسابك بهذا البوت. يمكنك إعادة الربط في أي وقت من خلال البوابة.",
      { inline_keyboard: [] },
      botToken
    ).catch(() => {});
    return;
  }

  await answerCallbackQuery(cb.id, "جاري المعالجة...", false, botToken).catch(() => {});
}
