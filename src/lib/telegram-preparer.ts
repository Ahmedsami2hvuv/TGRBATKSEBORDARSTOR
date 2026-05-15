import { prisma } from "@/lib/prisma";
import {
  answerCallbackQuery,
  editTelegramMessage,
  escapeTelegramHtml,
  sendTelegramMessageWithKeyboardToChat,
  type TelegramInlineKeyboard,
} from "@/lib/telegram";
import { formatDinarAsAlf } from "@/lib/money-alf";
import { getPublicAppUrl } from "@/lib/app-url";
import { buildCompanyPreparerPortalUrl } from "@/lib/company-preparer-portal-link";
import { getPreparerMoneyTotals } from "@/lib/preparer-combined-wallet-totals";
import { revalidatePath } from "next/cache";

export type PreparerTelegramCallback =
  | { kind: "main" }
  | { kind: "orders"; page: number }
  | { kind: "wallet" }
  | { kind: "detail"; orderId: string }
  | { kind: "cancel_flow" };

export function parsePreparerTelegramCallback(raw: string): PreparerTelegramCallback | null {
  const t = raw.trim();
  if (t === "p_main") return { kind: "main" };
  if (t === "p_wallet") return { kind: "wallet" };
  if (t === "p_cancel") return { kind: "cancel_flow" };

  let m = /^p_orders_(\d+)$/.exec(t);
  if (m) return { kind: "orders", page: Number(m[1]) };

  m = /^p_det:(.+)$/.exec(t);
  if (m) return { kind: "detail", orderId: m[1] };

  return null;
}

async function upsertPreparerSession(
  telegramUserId: string,
  chatId: string,
  step: string,
  payload: string,
): Promise<void> {
  await prisma.telegramBotSession.upsert({
    where: { telegramUserId },
    create: {
      telegramUserId,
      chatId,
      step,
      payload,
    },
    update: { chatId, step, payload },
  });
}

async function clearPreparerSession(telegramUserId: string): Promise<void> {
  await prisma.telegramBotSession.updateMany({
    where: { telegramUserId },
    data: { step: "idle", payload: "" },
  });
}

export async function getPreparerByTelegramUserId(telegramUserId: string) {
  return await prisma.companyPreparer.findFirst({
    where: { telegramUserId, active: true },
    include: { shopLinks: { include: { shop: true } } }
  });
}

export async function handlePreparerTelegramCallback(
  cq: {
    id: string;
    from: { id: number };
    message?: { chat: { id: number }; message_id: number; text?: string };
    data?: string;
  },
  botToken?: string,
): Promise<boolean> {
  const data = cq.data?.trim() ?? "";
  console.log(`[preparer-callback] Received from: ${cq.from.id}, data: ${data}`);

  const parsed = parsePreparerTelegramCallback(data);
  if (!parsed) {
    console.warn(`[preparer-callback] Failed to parse data: ${data}`);
    return false;
  }
  const msg = cq.message;
  if (!msg) return false;

  const chatId = String(msg.chat.id);
  const messageId = msg.message_id;
  const telegramUserId = String(cq.from.id);

  const preparer = await getPreparerByTelegramUserId(telegramUserId);
  if (!preparer) {
    console.warn(`[preparer-callback] Preparer not found for user: ${telegramUserId}`);
    await answerCallbackQuery(cq.id, "لم يتم العثور على حساب مجهز نشط مرتبط بهذا التليجرام.", true, botToken);
    return true;
  }

  console.log(`[preparer-callback] Found preparer: ${preparer.name}, Kind: ${parsed.kind}`);
  await answerCallbackQuery(cq.id, undefined, false, botToken).catch(() => {});

  try {
    switch (parsed.kind) {
      case "main": {
        await clearPreparerSession(telegramUserId);
        const { text, keyboard } = await renderPreparerHub(preparer);
        await editTelegramMessage(chatId, messageId, text, keyboard, botToken);
        return true;
      }
      case "wallet": {
        const totals = await getPreparerMoneyTotals(preparer.id);
        const baseUrl = getPublicAppUrl();
        const portalUrl = buildCompanyPreparerPortalUrl(preparer.id, preparer.portalToken, baseUrl);

        const text = [
          `<b>💰 محفظة المجهز: ${escapeTelegramHtml(preparer.name)}</b>`,
          `-------------------------`,
          `💵 المتبقي بذمتك للإدارة:`,
          `<b>${formatDinarAsAlf(totals.remain)}</b>`,
          `-------------------------`,
          `يمكنك عرض كشف الحساب المفصل من خلال الرابط أدناه.`
        ].join("\n");

        const kb: TelegramInlineKeyboard = {
          inline_keyboard: [
            [{ text: "🔗 فتح سجل المحفظة", url: portalUrl + "?tab=wallet" }],
            [{ text: "🏠 الرئيسية", callback_data: "p_main" }]
          ]
        };
        await editTelegramMessage(chatId, messageId, text, kb, botToken);
        return true;
      }
      case "orders": {
        const orders = await prisma.order.findMany({
          where: {
            status: "pending",
            shopId: { in: preparer.shopLinks.map(l => l.shopId) }
          },
          orderBy: { createdAt: "desc" },
          take: 10,
          skip: parsed.page * 10,
          include: { shop: true, customerRegion: true }
        });

        let text = `<b>📦 الطلبات المعلّقة (${preparer.shopLinks.length} محل)</b>\n\n`;
        if (orders.length === 0) {
          text += "لا توجد طلبات معلّقة حالياً.";
        } else {
          text += orders.map(o => (
            `#${o.orderNumber} — ${o.shop.name}\n` +
            `📍 ${o.customerRegion?.name || "—"} · 💰 ${formatDinarAsAlf(o.totalAmount || 0)}`
          )).join("\n\n");
        }

        const kb: TelegramInlineKeyboard = {
          inline_keyboard: [
            ...orders.map(o => ([{ text: `📦 طلب #${o.orderNumber}`, callback_data: `p_det:${o.id}` }])),
            [{ text: "🏠 الرئيسية", callback_data: "p_main" }]
          ]
        };
        await editTelegramMessage(chatId, messageId, text, kb, botToken);
        return true;
      }
      case "detail": {
        const order = await prisma.order.findUnique({
          where: { id: parsed.orderId },
          include: { shop: true, customerRegion: true, customer: true }
        });
        if (!order) return true;

        const baseUrl = getPublicAppUrl();
        const portalUrl = buildCompanyPreparerPortalUrl(preparer.id, preparer.portalToken, baseUrl);
        const orderUrl = portalUrl.replace("/preparer", `/preparer/order/${order.id}`);

        const text = [
          `<b>📦 طلب #${order.orderNumber}</b>`,
          `🏪 المحل: ${escapeTelegramHtml(order.shop.name)}`,
          `📍 المنطقة: ${escapeTelegramHtml(order.customerRegion?.name || "—")}`,
          `💰 السعر: ${formatDinarAsAlf(order.totalAmount || 0)}`,
          `📝 الملاحظة: ${escapeTelegramHtml(order.orderNoteTime || "—")}`,
          `-------------------------`,
          `اضغط على الرابط أدناه لتجهيز الطلب أو إسناده لمندوب.`
        ].join("\n");

        const kb: TelegramInlineKeyboard = {
          inline_keyboard: [
            [{ text: "🛠️ فتح وتجهيز الطلب", url: orderUrl }],
            [{ text: "⬅️ قائمة الطلبات", callback_data: "p_orders_0" }]
          ]
        };
        await editTelegramMessage(chatId, messageId, text, kb, botToken);
        return true;
      }
      case "cancel_flow": {
        await clearPreparerSession(telegramUserId);
        const { text, keyboard } = await renderPreparerHub(preparer);
        await editTelegramMessage(chatId, messageId, text, keyboard, botToken);
        return true;
      }
    }
  } catch (e) {
    console.error("[telegram preparer panel]", e);
    return true;
  }
  return false;
}

export async function renderPreparerHub(preparer: any) {
  const pendingCount = await prisma.order.count({
    where: {
      status: "pending",
      shopId: { in: preparer.shopLinks.map((l: any) => l.shopId) }
    }
  });

  const text = [
    `أهلاً بك المجهز <b>${escapeTelegramHtml(preparer.name)}</b>`,
    `عدد المحلات المسندة إليك: <b>${preparer.shopLinks.length}</b>`,
    `الطلبات المعلّقة حالياً: <b>${pendingCount}</b>`,
    `-------------------------`,
    `يمكنك استخدام الأزرار أدناه لإدارة الطلبات ومتابعة محفظتك.`
  ].join("\n");

  const kb: TelegramInlineKeyboard = {
    inline_keyboard: [
      [{ text: `📦 الطلبات المعلّقة (${pendingCount})`, callback_data: "p_orders_0" }],
      [{ text: "💰 محفظتي", callback_data: "p_wallet" }],
      [{ text: "🔗 فتح بوابة المجهز", url: buildCompanyPreparerPortalUrl(preparer.id, preparer.portalToken, getPublicAppUrl()) }]
    ]
  };

  return { text, keyboard: kb };
}

export async function handlePreparerTelegramMessage(
  message: {
    message_id: number;
    from?: { id: number };
    chat: { id: number };
    text?: string;
  },
  botToken?: string,
): Promise<boolean> {
  const fromId = message.from?.id;
  if (fromId == null) return false;
  const telegramUserId = String(fromId);
  const chatId = String(message.chat.id);

  const preparer = await getPreparerByTelegramUserId(telegramUserId);
  if (!preparer) return false;

  const txt = message.text?.trim() ?? "";
  if (txt === "/start") {
    const { text, keyboard } = await renderPreparerHub(preparer);
    await sendTelegramMessageWithKeyboardToChat(chatId, text, keyboard, botToken);
    return true;
  }

  return false;
}
