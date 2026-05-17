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

  // التعامل مع أمر البداية /start
  if (text.startsWith("/start")) {
    const parts = text.split(" ");
    if (parts.length > 1) {
      const payloadBase64 = parts[1];
      try {
        const decodedUrl = Buffer.from(payloadBase64, "base64").toString("utf-8");
        // استخراج الباراميترات من الرابط
        const urlObj = new URL(decodedUrl);
        const e = urlObj.searchParams.get("e");
        const exp = urlObj.searchParams.get("exp");
        const s = urlObj.searchParams.get("s");

        const v = verifyEmployeeOrderPortalQuery(e, exp, s);
        if (v.ok) {
          const employee = await prisma.employee.findUnique({
            where: { id: v.employeeId },
            include: { shop: true }
          });

          if (employee) {
            // ربط اليوزر تليجرام بالموظف/المحل إذا لم يكن مرتبطاً (اختياري حسب منطقك)
            // هنا سنكتفي بالترحيب وعرض الخيارات

            const welcomeMsg = `<b>أهلاً بك يا ${employee.name}</b>\nمن محل <b>${employee.shop.name}</b>\n\nيمكنك الآن إدارة طلباتك من هنا.`;

            const keyboard: TelegramInlineKeyboard = {
              inline_keyboard: [
                [
                  { text: "📦 رفع طلب جديد", url: decodedUrl },
                ],
                [
                  { text: "📜 سجل الطلبات", url: `${urlObj.origin}/client/order/history?e=${e}&exp=${exp}&s=${s}` },
                  { text: "📊 إحصائياتي", url: `${urlObj.origin}/client/order/account?e=${e}&exp=${exp}&s=${s}` }
                ]
              ]
            };

            await sendTelegramMessageWithKeyboardToChat(chatId, welcomeMsg, keyboard, botToken);
            return;
          }
        }
      } catch (err) {
        console.error("[customer bot] payload error:", err);
      }
    }
  }

  // الرد الافتراضي
  await sendTelegramHtmlToChat(
    chatId,
    "مرحباً بك في بوت العملاء.\n\nيرجى فتح رابط بوابة العميل المرسل إليك من قبل المكتب للوصول إلى خياراتك.",
    botToken
  );
}

/**
 * معالجة الـ Callbacks لبوت العملاء
 */
export async function handleCustomerCallback(cb: any, botToken: string): Promise<void> {
  // حالياً لا توجد أزرار انلاين تحتاج معالجة خلفية، لكن يمكن إضافة المنطق هنا مستقبلاً
  const { answerCallbackQuery } = await import("./telegram");
  await answerCallbackQuery(cb.id, "جاري المعالجة...", false, botToken).catch(() => {});
}
