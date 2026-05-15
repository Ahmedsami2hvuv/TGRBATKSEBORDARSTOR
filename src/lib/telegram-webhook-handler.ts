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
  const botPurpose = bot.purpose; // 'admin' | 'courier' | 'shop' | etc.

  if (body.callback_query) {
    const cb = body.callback_query;

    // توجيه بناءً على نوع البوت
    if (botPurpose === "admin") {
      await handleTelegramAdminCallback(cb, botToken);
    }
    else if (botPurpose === "courier") {
      const courier = await getCourierByTelegramUserId(String(cb.from.id));
      if (courier) {
        await handleCourierCallback({ cq: cb, courier: courier as any, botToken });
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
    else if (botPurpose === "courier") {
      const courier = await getCourierByTelegramUserId(String(msg.from?.id || ""));
      if (courier) {
        await handleCourierPrivateTextMessage({
          message: msg,
          courier: courier as any,
          telegramUserId: String(msg.from.id),
          botToken
        });
      }
    }
    else if (botPurpose === "shop") {
      await handleShopTelegramMessage(msg, botToken);
    }
    else if (botPurpose === "preparer") {
      await handlePreparerTelegramMessage(msg);
    }
    else if (botPurpose === "supplier") {
      await handleSupplierTelegramMessage(msg);
    }
  }
}
