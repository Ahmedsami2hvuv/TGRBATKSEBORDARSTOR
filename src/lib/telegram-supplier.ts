import { prisma } from "@/lib/prisma";
import {
  answerCallbackQuery,
  editTelegramMessage,
  escapeTelegramHtml,
  sendTelegramMessageWithKeyboardToChat,
  type TelegramInlineKeyboard,
} from "@/lib/telegram";
import { getPublicAppUrl } from "@/lib/app-url";

export type SupplierTelegramCallback =
  | { kind: "main" }
  | { kind: "products" }
  | { kind: "wallet" };

export function parseSupplierTelegramCallback(raw: string): SupplierTelegramCallback | null {
  const t = raw.trim();
  if (t === "sup_main") return { kind: "main" };
  if (t === "sup_products") return { kind: "products" };
  if (t === "sup_wallet") return { kind: "wallet" };
  return null;
}

export async function getSupplierByTelegramUserId(telegramUserId: string) {
  return await prisma.storeSupplier.findFirst({
    where: { telegramUserId, active: true }
  });
}

export async function handleSupplierTelegramCallback(
  cq: {
    id: string;
    from: { id: number };
    message?: { chat: { id: number }; message_id: number; text?: string };
    data?: string;
  },
  botToken?: string,
): Promise<boolean> {
  const parsed = parseSupplierTelegramCallback(cq.data?.trim() ?? "");
  if (!parsed) return false;
  const msg = cq.message;
  if (!msg) return false;

  const chatId = String(msg.chat.id);
  const messageId = msg.message_id;
  const telegramUserId = String(cq.from.id);

  const supplier = await getSupplierByTelegramUserId(telegramUserId);
  if (!supplier) {
    await answerCallbackQuery(cq.id, "لم يتم العثور على حساب مورد نشط مرتبط بهذا التليجرام.", true, botToken);
    return true;
  }

  await answerCallbackQuery(cq.id, undefined, false, botToken).catch(() => {});

  switch (parsed.kind) {
    case "main": {
      const { text, keyboard } = await renderSupplierHub(supplier);
      await editTelegramMessage(chatId, messageId, text, keyboard);
      return true;
    }
    case "products": {
      const products = await prisma.storeProduct.findMany({
        where: { supplierId: supplier.id },
        take: 10,
        orderBy: { name: "asc" }
      });

      let text = `<b>📦 منتجاتك</b>\n\n`;
      if (products.length === 0) {
        text += "لا توجد منتجات مسجلة باسمك حالياً.";
      } else {
        text += products.map(p => `• ${p.name} - ${p.salePrice}`).join("\n");
      }

      const kb: TelegramInlineKeyboard = {
        inline_keyboard: [[{ text: "🏠 الرئيسية", callback_data: "sup_main" }]]
      };
      await editTelegramMessage(chatId, messageId, text, kb);
      return true;
    }
    case "wallet": {
      const text = `<b>💰 المحفظة</b>\n\nسيتم عرض الرصيد والعمليات المالية هنا قريباً.`;
      const kb: TelegramInlineKeyboard = {
        inline_keyboard: [[{ text: "🏠 الرئيسية", callback_data: "sup_main" }]]
      };
      await editTelegramMessage(chatId, messageId, text, kb);
      return true;
    }
  }
  return false;
}

export async function renderSupplierHub(supplier: any) {
  const productsCount = await prisma.storeProduct.count({
    where: { supplierId: supplier.id }
  });

  const text = [
    `أهلاً بك المورد <b>${escapeTelegramHtml(supplier.name)}</b>`,
    `عدد منتجاتك: <b>${productsCount}</b>`,
    `-------------------------`,
    `استخدم الأزرار أدناه لمتابعة منتجاتك ومبيعاتك.`
  ].join("\n");

  const kb: TelegramInlineKeyboard = {
    inline_keyboard: [
      [{ text: "📦 منتجاتي", callback_data: "sup_products" }],
      [{ text: "💰 محفظتي", callback_data: "sup_wallet" }],
      [{ text: "🔗 فتح لوحة المورد", url: `${getPublicAppUrl()}/supplier?token=${supplier.portalToken}` }]
    ]
  };

  return { text, keyboard: kb };
}

export async function handleSupplierTelegramMessage(message: {
  message_id: number;
  from?: { id: number };
  chat: { id: number };
  text?: string;
}): Promise<boolean> {
  const fromId = message.from?.id;
  if (fromId == null) return false;
  const telegramUserId = String(fromId);
  const chatId = String(message.chat.id);

  const supplier = await getSupplierByTelegramUserId(telegramUserId);
  if (!supplier) return false;

  const txt = message.text?.trim() ?? "";
  if (txt === "/start") {
    const { text, keyboard } = await renderSupplierHub(supplier);
    await sendTelegramMessageWithKeyboardToChat(chatId, text, keyboard);
    return true;
  }

  return false;
}
