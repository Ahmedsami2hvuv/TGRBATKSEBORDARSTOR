import { TelegramBot } from "@prisma/client";
import {
  handleTelegramAdminCallback,
  handleTelegramAdminPrivateMessage,
} from "./telegram-admin-panel";
import {
  handleCourierCallback,
  handleCourierPrivateTextMessage,
  getCourierByTelegramUserId,
} from "./telegram-courier-panel";
import {
  handleShopTelegramCallback,
  handleShopTelegramMessage,
} from "./telegram-shop";
import {
  handlePreparerTelegramCallback,
  handlePreparerTelegramMessage,
} from "./telegram-preparer";
import {
  handleSupplierTelegramCallback,
  handleSupplierTelegramMessage,
} from "./telegram-supplier";

/**
 * معالج الـ Webhook الرئيسي.
 * وظيفته التوجيه (Routing) بناءً على غرض البوت (Purpose) المذكور في قاعدة البيانات.
 */
export async function handleTelegramWebhook(body: any, bot: TelegramBot): Promise<void> {
  const botToken = bot.token;
  const botPurpose = bot.purpose?.trim().toLowerCase(); // Normalize purpose

  console.log(`[handleTelegramWebhook] Bot: ${bot.name} (${botPurpose}), Update Type: ${body.callback_query ? 'callback_query' : body.message ? 'message' : 'unknown'}`);

  if (body.callback_query) {
    const cb = body.callback_query;
    const data = cb.data ?? "";
    console.log(`[handleTelegramWebhook] Callback Data: ${data}, From: ${cb.from.id}`);

    // السماح بمعالجة أزرار المجهزين (مثل قبول/رفض التحويلات) في كافة البوتات
    if (data.startsWith("p_")) {
      const handled = await handlePreparerTelegramCallback(cb, botToken);
      if (handled) return;
    }

    // توجيه بناءً على نوع البوت
    if (botPurpose === "admin" || botPurpose === "notification") {
      const isNotificationBot = botPurpose === "notification";
      const handled = await handleTelegramAdminCallback(cb, botToken, { isNotificationBot });
      if (!handled) {
        const { answerCallbackQuery } = await import("./telegram");
        await answerCallbackQuery(cb.id, "ليس لديك صلاحية أو الأمر غير معروف.", true, botToken).catch(() => {});
      }
    }
    else if (botPurpose === "courier") {
      const courier = await getCourierByTelegramUserId(String(cb.from.id));
      if (courier) {
        await handleCourierCallback({ cq: cb, courier: courier as any, botToken });
      } else {
        const { answerCallbackQuery } = await import("./telegram");
        await answerCallbackQuery(cb.id, "حساب المندوب غير مفعّل أو غير موجود.", true, botToken).catch(() => {});
      }
    }
    else if (botPurpose === "shop") {
      await handleShopTelegramCallback(cb, botToken);
    }
    else if (botPurpose === "preparer") {
      await handlePreparerTelegramCallback(cb, botToken);
    }
    else if (botPurpose === "supplier") {
      await handleSupplierTelegramCallback(cb, botToken);
    } else {
      console.warn(`[handleTelegramWebhook] No handler for bot purpose: ${botPurpose}`);
      const { answerCallbackQuery } = await import("./telegram");
      await answerCallbackQuery(cb.id, `نظام ${botPurpose} غير مبرمج للاستجابة للأزرار بعد.`, false, botToken).catch(() => {});
    }
    return;
  }

  if (body.message) {
    const msg = body.message;
    if (!msg.text && !msg.photo && !msg.location) return;

    // توجيه الرسائل الخاصة بناءً على نوع البوت
    if (botPurpose === "admin") {
      await handleTelegramAdminPrivateMessage(msg, botToken);
    }
    else if (botPurpose === "notification") {
      // رد بسيط لبوت الإشعارات للتأكد من عمله
      const { sendTelegramHtmlToChat } = await import("./telegram");
      await sendTelegramHtmlToChat(String(msg.from.id), "🔔 هذا هو بوت الإشعارات، وظيفته إرسال التنبيهات فقط.", botToken);
    }
    else if (botPurpose === "courier") {
      await handleCourierPrivateTextMessage({
        message: msg,
        telegramUserId: String(msg.from.id),
        botToken
      });
    }
    else if (botPurpose === "shop") {
      const handled = await handleShopTelegramMessage(msg, botToken);
      if (!handled) {
        const { sendTelegramHtmlToChat } = await import("./telegram");
        await sendTelegramHtmlToChat(
          String(msg.from.id),
          `<b>🏪 بوت المحلات</b>\n\nحسابك غير مسجل كصاحب محل أو موظف.\nالمعرف الخاص بك (ID): <code>${msg.from.id}</code>\n\nيرجى تزويد الإدارة بالمعرف أعلاه لتفعيل حسابك.`,
          botToken
        );
      }
    }
    else if (botPurpose === "preparer") {
      const handled = await handlePreparerTelegramMessage(msg, botToken);
      if (!handled) {
        const { sendTelegramHtmlToChat } = await import("./telegram");
        await sendTelegramHtmlToChat(
          String(msg.from.id),
          `<b>👨‍🍳 بوت المجهزين</b>\n\nحسابك غير مسجل كمجهز في النظام.\nالمعرف الخاص بك (ID): <code>${msg.from.id}</code>`,
          botToken
        );
      }
    }
    else if (botPurpose === "supplier") {
      const handled = await handleSupplierTelegramMessage(msg, botToken);
      if (!handled) {
        const { sendTelegramHtmlToChat } = await import("./telegram");
        await sendTelegramHtmlToChat(
          String(msg.from.id),
          `<b>🚛 بوت الموردين</b>\n\nحسابك غير مسجل كمورد.\nالمعرف الخاص بك (ID): <code>${msg.from.id}</code>`,
          botToken
        );
      }
    }
    else {
      // رد الطوارئ: إذا وصل البوت إلى هنا ولم يرد، نرسل رسالة ترحيبية بسيطة للتأكد من الاتصال
      const { sendTelegramHtmlToChat } = await import("./telegram");
      await sendTelegramHtmlToChat(
        String(msg.from.id),
        `✅ تم استلام رسالتك بنجاح في نظام **${botPurpose}**.\n\n` +
        `معرفك (ID): <code>${msg.from.id}</code>\n` +
        `هذا الرد يظهر لأن النظام قيد التشغيل والـ Webhook يعمل بشكل صحيح.`,
        botToken
      );
    }
  }
}
