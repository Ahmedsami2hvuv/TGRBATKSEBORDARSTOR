import { prisma } from "./prisma";
import {
  sendTelegramHtmlToChat,
  sendTelegramMessageWithKeyboardToChat,
  type TelegramInlineKeyboard,
} from "./telegram";
import { verifyEmployeeOrderPortalQuery } from "./employee-order-portal-link";

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
      const welcomeMsg = `<b>أهلاً بك يا ${employee.name}</b>\nمن محل <b>${employee.shop.name}</b>\n\nلقد تم التعرف على حسابك بنجاح. يمكنك استخدام الأزرار أدناه:`;

      const portalUrl = v.url;

      const keyboard: TelegramInlineKeyboard = {
        inline_keyboard: [
          [
            { text: "📦 رفع طلب جديد", url: portalUrl },
          ],
          [
            { text: "📜 سجل الطلبات", url: portalUrl.replace("/order", "/order/history") },
            { text: "📊 إحصائياتي", url: portalUrl.replace("/order", "/order/account") }
          ]
        ]
      };

      await sendTelegramMessageWithKeyboardToChat(chatId, welcomeMsg, keyboard, botToken);
      return;
    }
  }

  // الرد الافتراضي
  if (text.startsWith("/start")) {
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
  const { answerCallbackQuery } = await import("./telegram");
  await answerCallbackQuery(cb.id, "جاري المعالجة...", false, botToken).catch(() => {});
}
