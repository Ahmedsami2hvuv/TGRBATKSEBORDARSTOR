import { CourierWalletMiscDirection, WalletPeerPartyKind } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";
import { prisma } from "@/lib/prisma";
import {
  answerCallbackQuery,
  editTelegramMessage,
  escapeTelegramHtml,
  sendTelegramMessageWithKeyboardToChat,
  sendTelegramMessageWithKeyboard,
  type TelegramInlineKeyboard,
} from "@/lib/telegram";
import {
  formatDinarAsAlf,
  normalizeDigits,
  parseAlfInputToDinarDecimalRequired,
  parseAlfInputToDinarNumber,
} from "@/lib/money-alf";
import { getPublicAppUrl } from "@/lib/app-url";
import { buildCompanyPreparerPortalUrl, verifyCompanyPreparerPortalQuery } from "@/lib/company-preparer-portal-link";
import { getPreparerMoneyTotals } from "@/lib/preparer-combined-wallet-totals";
import { rankRegionsByQuery, normalizeArabicSearch } from "@/lib/arabic-region-search";
import { extractPhoneFromText, parseQuickOrder } from "@/lib/flexible-order-parse";
import { normalizeIraqMobileLocal11 } from "@/lib/whatsapp";
import {
  notifyTelegramNewOrder,
  notifyTelegramCourierTransferEvent,
  notifyTelegramPreparerTransferEvent,
} from "@/lib/telegram-notify";
import { pushNotifyAdminsNewPendingOrder } from "@/lib/web-push-server";
import { transferOrderToCourierInternal } from "@/lib/order-assign-courier";
import { syncPhoneProfileFromOrder } from "@/lib/customer-phone-profile-sync";
import { getBotTokenByPurpose } from "@/lib/telegram-bots";
import { resolvePartyDisplayName, writeLedgerEntriesForAcceptedTransfer } from "./wallet-peer-transfer";
import { getCourierByTelegramUserId } from "./telegram-courier-panel";
import { revalidatePath } from "next/cache";

export type PreparerTelegramCallback =
  | { kind: "main" }
  | { kind: "orders"; page: number }
  | { kind: "wallet" }
  | { kind: "detail"; orderId: string }
  | { kind: "new_order" }
  | { kind: "shop_pick"; shopId: string }
  | { kind: "region_pick"; regionId: string }
  | { kind: "assign_courier"; orderId: string }
  | { kind: "assign_courier_exec"; orderId: string; courierId: string }
  | { kind: "cancel_flow" }
  | { kind: "assign_start_by_num"; orderNumber: number }
  | { kind: "wallet_take" }
  | { kind: "wallet_give" }
  | { kind: "wallet_transfer_start" }
  | { kind: "wallet_transfer_type"; target: "courier" | "preparer" }
  | { kind: "wallet_transfer_pick"; type: "courier" | "preparer"; id: string }
  | { kind: "wallet_transfer_accept"; transferId: string }
  | { kind: "wallet_transfer_reject"; transferId: string };

export function parsePreparerTelegramCallback(raw: string): PreparerTelegramCallback | null {
  const t = raw.trim();
  if (t === "p_main") return { kind: "main" };
  if (t === "p_wallet") return { kind: "wallet" };
  if (t === "p_new") return { kind: "new_order" };
  if (t === "p_cancel") return { kind: "cancel_flow" };
  if (t === "p_w_take") return { kind: "wallet_take" };
  if (t === "p_w_give") return { kind: "wallet_give" };
  if (t === "p_w_trans") return { kind: "wallet_transfer_start" };
  if (t === "p_w_tt:c") return { kind: "wallet_transfer_type", target: "courier" };
  if (t === "p_w_tt:p") return { kind: "wallet_transfer_type", target: "preparer" };

  let m = /^p_orders_(\d+)$/.exec(t);
  if (m) return { kind: "orders", page: Number(m[1]) };

  m = /^p_det:(.+)$/.exec(t);
  if (m) return { kind: "detail", orderId: m[1] };

  m = /^p_shop:([a-zA-Z0-9_-]+)$/.exec(t);
  if (m) return { kind: "shop_pick", shopId: m[1] };

  m = /^p_region:([a-zA-Z0-9_-]+)$/.exec(t);
  if (m) return { kind: "region_pick", regionId: m[1] };

  m = /^p_ac:([a-zA-Z0-9_-]+)$/.exec(t);
  if (m) return { kind: "assign_courier", orderId: m[1] };

  m = /^p_ace:([a-zA-Z0-9_-]+):([a-zA-Z0-9_-]+)$/.exec(t);
  if (m) return { kind: "assign_courier_exec", orderId: m[1], courierId: m[2] };

  m = /^p_w_tp:(c|p):([a-zA-Z0-9_-]+)$/.exec(t);
  if (m) return { kind: "wallet_transfer_pick", type: m[1] === "c" ? "courier" : "preparer", id: m[2] };

  m = /^p_w_tacc:(.+)$/.exec(t);
  if (m) return { kind: "wallet_transfer_accept", transferId: m[1] };

  m = /^p_w_trej:(.+)$/.exec(t);
  if (m) return { kind: "wallet_transfer_reject", transferId: m[1] };

  // دعم الاختصارات من الإشعارات
  m = /^l(\d+)$/.exec(t);
  if (m) return { kind: "assign_start_by_num", orderNumber: Number(m[1]) };

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

async function getPreparerSession(telegramUserId: string) {
  return await prisma.telegramBotSession.findUnique({
    where: { telegramUserId },
  });
}

async function getPreparerByTelegramUserId(telegramUserId: string) {
  return await prisma.companyPreparer.findFirst({
    where: { telegramUserId, active: true },
    include: { shopLinks: { include: { shop: true } } }
  });
}

type PreparerNewOrderPayload = {
  shopId?: string;
  shopName?: string;
  customerPhone: string;
  customerRegionId?: string;
  customerRegionName?: string;
  orderType: string;
  orderNoteTime: string;
  totalAmountDinar: number;
  preparerId: string;
  portalToken: string;
  telegramUserId: string;
};

function findShopIdFromText(text: string, shopLinks: Array<{ shop: { id: string; name: string } }>): string | null {
  const normalized = normalizeArabicSearch(text);
  const exactMatches = shopLinks.filter((link) => normalizeArabicSearch(link.shop.name) === normalized);
  if (exactMatches.length === 1) return exactMatches[0].shop.id;

  const substringMatches = shopLinks.filter((link) => {
    const shopName = normalizeArabicSearch(link.shop.name);
    return normalized.includes(shopName) || shopName.includes(normalized);
  });
  if (substringMatches.length === 1) return substringMatches[0].shop.id;

  const firstLine = text.split("\n").map((line) => line.trim()).find(Boolean) ?? "";
  const normalizedFirstLine = normalizeArabicSearch(firstLine);
  const firstLineMatches = shopLinks.filter((link) => normalizeArabicSearch(link.shop.name).includes(normalizedFirstLine));
  if (firstLineMatches.length === 1) return firstLineMatches[0].shop.id;

  return null;
}

async function askPreparerToPickShop(
  chatId: string,
  botToken: string | undefined,
  telegramUserId: string,
  payload: PreparerNewOrderPayload,
  shopLinks: Array<{ shop: { id: string; name: string } }>,
): Promise<void> {
  const keyboard: TelegramInlineKeyboard = {
    inline_keyboard: [
      ...shopLinks.map((link) => [{ text: link.shop.name, callback_data: `p_shop:${link.shop.id}` }]),
      [{ text: "❌ إلغاء", callback_data: "p_cancel" }],
      [{ text: "🏠 الرئيسية", callback_data: "p_main" }]
    ]
  };
  await upsertPreparerSession(telegramUserId, chatId, "preparer_new_order_shop", JSON.stringify(payload));
  await sendTelegramMessageWithKeyboardToChat(chatId,
    `أختر المحل المرتبط بالطلب السريع ثم اختر المنطقة.

إذا كان النص يحتوي على اسم المحل، سيتم اختياره تلقائياً.`,
    keyboard,
    botToken,
  );
}

async function askPreparerToPickRegion(
  chatId: string,
  botToken: string | undefined,
  telegramUserId: string,
  payload: PreparerNewOrderPayload,
  regions: Array<{ id: string; name: string }>,
): Promise<void> {
  const keyboard: TelegramInlineKeyboard = {
    inline_keyboard: [
      ...regions.map((region) => [{ text: region.name, callback_data: `p_region:${region.id}` }]),
      [{ text: "❌ إلغاء", callback_data: "p_cancel" }],
      [{ text: "🏠 الرئيسية", callback_data: "p_main" }]
    ]
  };
  await upsertPreparerSession(telegramUserId, chatId, "preparer_new_order_region", JSON.stringify(payload));
  await sendTelegramMessageWithKeyboardToChat(chatId,
    `اختر المنطقة للطلب السريع الذي قمت بإرساله.

الزبون: ${escapeTelegramHtml(payload.customerPhone)}
السعر: ${formatDinarAsAlf(new Decimal(payload.totalAmountDinar))}

إذا لم تجد المنطقة المناسبة، ارسل نص الطلب مرة أخرى مع اسم المنطقة بشكل أوضح.`,
    keyboard,
    botToken,
  );
}

async function createPreparerOrder(
  chatId: string,
  botToken: string | undefined,
  payload: PreparerNewOrderPayload,
): Promise<void> {
  if (!payload.shopId || !payload.customerRegionId) {
    await sendTelegramMessageWithKeyboardToChat(chatId,
      "لا يمكن إنشاء الطلب لأن بيانات المحل أو المنطقة غير مكتملة.",
      { inline_keyboard: [[{ text: "🏠 الرئيسية", callback_data: "p_main" }]] },
      botToken,
    );
    return;
  }

  const [shop, region] = await Promise.all([
    prisma.shop.findUnique({ where: { id: payload.shopId } }),
    prisma.region.findUnique({ where: { id: payload.customerRegionId } }),
  ]);

  if (!shop || !region) {
    await sendTelegramMessageWithKeyboardToChat(chatId,
      "خطأ في بيانات الطلب، يرجى المحاولة مرة أخرى.",
      { inline_keyboard: [[{ text: "🏠 الرئيسية", callback_data: "p_main" }]] },
      botToken,
    );
    return;
  }

  const customerPhone = normalizeIraqMobileLocal11(payload.customerPhone) ?? payload.customerPhone;
  const price = new Decimal(payload.totalAmountDinar);

  const order = await prisma.order.create({
    data: {
      shopId: shop.id,
      status: "pending",
      orderType: payload.orderType || "تجهيز سريع",
      customerRegionId: region.id,
      customerPhone,
      orderSubtotal: price,
      deliveryPrice: new Decimal(0),
      totalAmount: price,
      submissionSource: "company_preparer",
      submittedByCompanyPreparerId: payload.preparerId,
      orderNoteTime: payload.orderNoteTime || "فوري",
      summary: `طلب سريع من تيليجرام من ${shop.name}\n${payload.orderNoteTime}`,
    }
  });

  await syncPhoneProfileFromOrder(order.id).catch(() => {});
  await notifyTelegramNewOrder(order.id).catch(() => {});
  void pushNotifyAdminsNewPendingOrder(order.orderNumber).catch(() => {});
  revalidatePath("/preparer");

  await sendTelegramMessageWithKeyboardToChat(chatId,
    `✅ تم رفع الطلب السريع بنجاح!
رقم الطلب: <b>#${order.orderNumber}</b>
المحل: <b>${escapeTelegramHtml(shop.name)}</b>
المنطقة: <b>${escapeTelegramHtml(region.name)}</b>
السعر: <b>${formatDinarAsAlf(price)}</b>`,
    { inline_keyboard: [[{ text: "🏠 الرئيسية", callback_data: "p_main" }]] },
    botToken,
  );
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
  const isTransferAction = parsed.kind === "wallet_transfer_accept" || parsed.kind === "wallet_transfer_reject";

  if (!preparer && !isTransferAction) {
    console.warn(`[preparer-callback] Preparer not found for user: ${telegramUserId}`);
    await answerCallbackQuery(cq.id, "لم يتم العثور على حساب مجهز نشط مرتبط بهذا التليجرام.", true, botToken);
    return true;
  }

  console.log(`[preparer-callback] Found user, Kind: ${parsed.kind}`);
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
        const { text, keyboard } = await renderPreparerWallet(preparer);
        await editTelegramMessage(chatId, messageId, text, keyboard, botToken);
        return true;
      }
      case "wallet_take":
      case "wallet_give": {
        const step = parsed.kind === "wallet_take" ? "preparer_wallet_take" : "preparer_wallet_give";
        await upsertPreparerSession(telegramUserId, chatId, step, "");
        const actionText = parsed.kind === "wallet_take" ? "أخذت (وارد)" : "أعطيت (صادر)";
        await sendTelegramMessageWithKeyboardToChat(chatId,
          `<b>تسجيل حركة: ${actionText}</b>\n\nأرسل رسالة من سطرين:\nالسطر الأول: المبلغ\nالسطر الثاني: اسم المعاملة أو الملاحظة`,
          { inline_keyboard: [[{ text: "❌ إلغاء", callback_data: "p_wallet" }]] },
          botToken
        );
        return true;
      }
      case "wallet_transfer_start": {
        const kb: TelegramInlineKeyboard = {
          inline_keyboard: [
            [{ text: "🧑‍✈️ إلى مندوب", callback_data: "p_w_tt:c" }],
            [{ text: "👨‍🍳 إلى مجهز آخر", callback_data: "p_w_tt:p" }],
            [{ text: "❌ إلغاء", callback_data: "p_wallet" }]
          ]
        };
        await editTelegramMessage(chatId, messageId, "اختر نوع الطرف الذي ترغب بالتحويل إليه:", kb, botToken);
        return true;
      }
      case "wallet_transfer_type": {
        if (parsed.target === "courier") {
          const couriers = await prisma.courier.findMany({
            where: { blocked: false, hiddenFromReports: false },
            orderBy: { name: "asc" },
            take: 20
          });
          const rows = couriers.map(c => ([{ text: c.name, callback_data: `p_w_tp:c:${c.id}` }]));
          rows.push([{ text: "⬅️ رجوع", callback_data: "p_w_trans" }]);
          await editTelegramMessage(chatId, messageId, "اختر المندوب المستلم:", { inline_keyboard: rows }, botToken);
        } else {
          const preparers = await prisma.companyPreparer.findMany({
            where: { active: true, id: { not: preparer.id } },
            orderBy: { name: "asc" },
            take: 20
          });
          const rows = preparers.map(p => ([{ text: p.name, callback_data: `p_w_tp:p:${p.id}` }]));
          rows.push([{ text: "⬅️ رجوع", callback_data: "p_w_trans" }]);
          await editTelegramMessage(chatId, messageId, "اختر المجهز المستلم:", { inline_keyboard: rows }, botToken);
        }
        return true;
      }
      case "wallet_transfer_pick": {
        const payload = JSON.stringify({ targetType: parsed.type, targetId: parsed.id });
        await upsertPreparerSession(telegramUserId, chatId, "preparer_wallet_transfer_note", payload);

        let targetName = "الطرف المختار";
        if (parsed.type === "courier") {
          const c = await prisma.courier.findUnique({ where: { id: parsed.id } });
          if (c) targetName = c.name;
        } else {
          const p = await prisma.companyPreparer.findUnique({ where: { id: parsed.id } });
          if (p) targetName = p.name;
        }

        const totals = await getPreparerMoneyTotals(preparer.id);
        const remainStr = formatDinarAsAlf(totals?.remain || 0);

        await sendTelegramMessageWithKeyboardToChat(chatId,
          `<b>تحويل مبلغ إلى: ${escapeTelegramHtml(targetName)}</b>\n` +
          `المتبقي بذمتك للإدارة حالياً: <b>${remainStr}</b>\n\n` +
          `أرسل رسالة من سطرين:\nالسطر الأول: المبلغ\nالسطر الثاني: مكان التحويل أو ملاحظة`,
          { inline_keyboard: [[{ text: "❌ إلغاء", callback_data: "p_wallet" }]] },
          botToken
        );
        return true;
      }
      case "wallet_transfer_accept": {
        const transfer = await prisma.walletPeerTransfer.findUnique({ where: { id: parsed.transferId } });
        if (!transfer || transfer.status !== "pending") {
          await answerCallbackQuery(cq.id, "هذا التحويل لم يعد متاحاً.", true, botToken);
          return true;
        }

        const courier = !preparer ? await getCourierByTelegramUserId(telegramUserId) : null;
        const isRecipient = (transfer.toEmployeeId && (preparer?.walletEmployeeId === transfer.toEmployeeId)) ||
                            (transfer.toCourierId && (courier?.id === transfer.toCourierId));

        if (!isRecipient) {
          await answerCallbackQuery(cq.id, "عذراً، هذا التحويل ليس موجهاً إليك.", true, botToken);
          return true;
        }

        await prisma.$transaction(async (tx) => {
          const updated = await tx.walletPeerTransfer.update({
            where: { id: transfer.id },
            data: { status: "accepted", respondedAt: new Date() }
          });
          await writeLedgerEntriesForAcceptedTransfer(tx, updated);
        });

        if (preparer) {
          const fromLabel = await resolvePartyDisplayName(transfer.fromKind, transfer.fromCourierId, transfer.fromEmployeeId);
          const toLabel = await resolvePartyDisplayName(transfer.toKind, transfer.toCourierId, transfer.toEmployeeId);

          await notifyTelegramPreparerTransferEvent({
            preparerId: preparer.id,
            kind: "accepted",
            amountDinar: transfer.amountDinar,
            partyName: fromLabel,
            location: transfer.handoverLocation,
            botToken
          });

          const { text, keyboard } = await renderPreparerWallet(preparer);
          await editTelegramMessage(chatId, messageId, text, keyboard, botToken);
        } else if (courier) {
          // إذا كان المستلم مندوباً، نحدث رسالة القبول في بوت المندوب
          const text = `✅ <b>تم قبول التحويل من ${fromLabel} بقيمة ${formatDinarAsAlf(transfer.amountDinar)} بنجاح.</b>`;
          // يمكننا هنا محاولة إعادة عرض محفظة المندوب إذا كان لدينا دالة جاهزة في ملف المندوب،
          // ولكن حالياً سنكتفي برسالة التأكيد.
          await editTelegramMessage(chatId, messageId, text, { inline_keyboard: [[{ text: "💼 محفظتي", callback_data: "co_wallet_all_0" }]] }, botToken);
        } else {
          await editTelegramMessage(chatId, messageId, `✅ <b>تم قبول التحويل بنجاح.</b>`, { inline_keyboard: [] }, botToken);
        }

        // إشعار للمرسل
        let senderTgId: string | null = null;
        let isSenderCourier = false;
        if (transfer.fromEmployeeId) {
          const s = await prisma.companyPreparer.findFirst({ where: { walletEmployeeId: transfer.fromEmployeeId } });
          senderTgId = s?.telegramUserId || null;
        } else if (transfer.fromCourierId) {
          const s = await prisma.courier.findUnique({ where: { id: transfer.fromCourierId } });
          senderTgId = s?.telegramUserId || null;
          isSenderCourier = true;
        }

        if (senderTgId) {
           let senderBotToken = botToken;
           if (isSenderCourier) {
             senderBotToken = await getBotTokenByPurpose("courier") || botToken;
           }
           await sendTelegramMessageWithKeyboardToChat(senderTgId, `✅ <b>${toLabel}</b> قبل تحويلك بقيمة <b>${formatDinarAsAlf(transfer.amountDinar)}</b>.`, { inline_keyboard: [] }, senderBotToken).catch(() => {});
        }
        return true;
      }
      case "wallet_transfer_reject": {
        const transfer = await prisma.walletPeerTransfer.findUnique({ where: { id: parsed.transferId } });
        if (!transfer || transfer.status !== "pending") return true;

        const courier = !preparer ? await getCourierByTelegramUserId(telegramUserId) : null;
        const isRecipient = (transfer.toEmployeeId && preparer?.walletEmployeeId === transfer.toEmployeeId) ||
                            (transfer.toCourierId && courier?.id === transfer.toCourierId);

        if (!isRecipient) {
          await answerCallbackQuery(cq.id, "عذراً، هذا تحويل ليس موجهاً إليك.", true, botToken);
          return true;
        }

        await prisma.walletPeerTransfer.update({
          where: { id: transfer.id },
          data: { status: "rejected", respondedAt: new Date() }
        });

        const toLabel = await resolvePartyDisplayName(transfer.toKind, transfer.toCourierId, transfer.toEmployeeId);

        if (preparer) {
          const fromLabel = await resolvePartyDisplayName(transfer.fromKind, transfer.fromCourierId, transfer.fromEmployeeId);
          await notifyTelegramPreparerTransferEvent({
            preparerId: preparer.id,
            kind: "rejected",
            amountDinar: transfer.amountDinar,
            partyName: fromLabel,
            location: transfer.handoverLocation,
            botToken
          });
          const { text, keyboard } = await renderPreparerWallet(preparer);
          await editTelegramMessage(chatId, messageId, text, keyboard, botToken);
        } else {
          await editTelegramMessage(chatId, messageId, "❌ تم رفض التحويل.", { inline_keyboard: [] }, botToken);
        }

        // إشعار للمرسل
        let senderTgId: string | null = null;
        let isSenderCourier = false;
        if (transfer.fromEmployeeId) {
          const s = await prisma.companyPreparer.findFirst({ where: { walletEmployeeId: transfer.fromEmployeeId } });
          senderTgId = s?.telegramUserId || null;
        } else if (transfer.fromCourierId) {
          const s = await prisma.courier.findUnique({ where: { id: transfer.fromCourierId } });
          senderTgId = s?.telegramUserId || null;
          isSenderCourier = true;
        }

        if (senderTgId) {
           let senderBotToken = botToken;
           if (isSenderCourier) {
             senderBotToken = await getBotTokenByPurpose("courier") || botToken;
           }
           await sendTelegramMessageWithKeyboardToChat(senderTgId, `❌ <b>${toLabel}</b> رفض تحويلك بقيمة <b>${formatDinarAsAlf(transfer.amountDinar)}</b>.`, { inline_keyboard: [] }, senderBotToken).catch(() => {});
        }
        return true;
      }
      case "new_order": {
        await clearPreparerSession(telegramUserId);
        const text = [
          `<b>➕ إنشاء طلب جديد</b>`,
          `أرسل رسالة واحدة تحتوي على: اسم المحل، رقم الزبون، السعر، ونوع الطلب أو الملاحظة.`,
          `إذا كانت المنطقة منفصلة أضفها كسطر قبل نوع الطلب.`,
          `\nمثال:\nمحل الفارس\nالمنطقة: الرصافه\n07701234567\n1500\nفوري – تسليم بعد نصف ساعة`
        ].join("\n\n");
        const kb: TelegramInlineKeyboard = {
          inline_keyboard: [
            [{ text: "🏠 الرئيسية", callback_data: "p_main" }]
          ]
        };
        await sendTelegramMessageWithKeyboardToChat(chatId, text, kb, botToken);
        return true;
      }
      case "shop_pick": {
        const session = await getPreparerSession(telegramUserId);
        if (!session?.payload || session.step !== "preparer_new_order_shop") return true;
        const payload = JSON.parse(session.payload || "{}") as any;
        payload.shopId = parsed.shopId;
        const shopLink = preparer.shopLinks.find((link: any) => link.shop.id === parsed.shopId);
        if (shopLink) payload.shopName = shopLink.shop.name;
        payload.preparerId = preparer.id;
        payload.portalToken = preparer.portalToken;
        payload.telegramUserId = telegramUserId;

        const regions = await prisma.region.findMany({ select: { id: true, name: true } });
        await askPreparerToPickRegion(chatId, botToken, telegramUserId, payload, regions);
        return true;
      }
      case "region_pick": {
        const session = await getPreparerSession(telegramUserId);
        if (!session?.payload || session.step !== "preparer_new_order_region") return true;
        const payload = JSON.parse(session.payload || "{}") as any;
        payload.customerRegionId = parsed.regionId;
        payload.preparerId = preparer.id;
        payload.portalToken = preparer.portalToken;
        payload.telegramUserId = telegramUserId;
        await clearPreparerSession(telegramUserId);
        await createPreparerOrder(chatId, botToken, payload);
        return true;
      }
      case "assign_courier": {
        const order = await prisma.order.findUnique({ where: { id: parsed.orderId }, include: { shop: true } });
        if (!order) {
          await sendTelegramMessageWithKeyboardToChat(chatId, "الطلب غير موجود.", { inline_keyboard: [[{ text: "🏠 الرئيسية", callback_data: "p_main" }]] }, botToken);
          return true;
        }
        const couriers = await prisma.courier.findMany({
          where: {
            blocked: false,
            hiddenFromReports: false,
          },
          orderBy: { name: "asc" },
          take: 10,
        });
        if (couriers.length === 0) {
          await sendTelegramMessageWithKeyboardToChat(chatId, "لا توجد أسماء مندوبين متاحة حالياً.", { inline_keyboard: [[{ text: "🏠 الرئيسية", callback_data: "p_main" }]] }, botToken);
          return true;
        }
        const rows = couriers.map((courier) => ([{
          text: courier.name || "مندوب",
          callback_data: `p_ace:${order.id}:${courier.id}`,
        }]));
        rows.push([{ text: "🏠 الرئيسية", callback_data: "p_main" }]);
        const text = [
          `اختر مندوباً لإسناد الطلب #${order.orderNumber}:`,
          `المحل: ${escapeTelegramHtml(order.shop.name)}`
        ].join("\n\n");
        await sendTelegramMessageWithKeyboardToChat(chatId, text, { inline_keyboard: rows }, botToken);
        return true;
      }
      case "assign_courier_exec": {
        const order = await prisma.order.findUnique({ where: { id: parsed.orderId } });
        const result = await transferOrderToCourierInternal(parsed.orderId, parsed.courierId, { bypassCourierAvailability: true });
        const text = result.ok
          ? `✅ تم إسناد الطلب #${order?.orderNumber} بنجاح.`
          : `⚠️ ${escapeTelegramHtml(result.error)}`;

        const kb: TelegramInlineKeyboard = {
          inline_keyboard: [
            [{ text: "🔄 تغيير المندوب", callback_data: `p_ac:${parsed.orderId}` }],
            [{ text: "🏠 الرئيسية", callback_data: "p_main" }]
          ]
        };
        await editTelegramMessage(chatId, messageId, text, kb, botToken);
        return true;
      }
      case "assign_start_by_num": {
        const order = await prisma.order.findUnique({ where: { orderNumber: parsed.orderNumber } });
        if (!order) {
          await answerCallbackQuery(cq.id, `الطلب #${parsed.orderNumber} غير موجود.`, true, botToken);
          return true;
        }
        // تحويل الطلب إلى معالجة assign_courier الاعتيادية
        const couriers = await prisma.courier.findMany({
          where: { blocked: false, hiddenFromReports: false },
          orderBy: { name: "asc" },
          take: 20,
        });
        if (couriers.length === 0) {
          await answerCallbackQuery(cq.id, "لا توجد أسماء مندوبين متاحة حالياً.", true, botToken);
          return true;
        }
        const rows = couriers.map((courier) => ([{
          text: courier.name || "مندوب",
          callback_data: `p_ace:${order.id}:${courier.id}`,
        }]));
        rows.push([{ text: "🏠 الرئيسية", callback_data: "p_main" }]);
        const text = `اختر مندوباً لإسناد الطلب #${order.orderNumber}:`;
        await editTelegramMessage(chatId, messageId, text, { inline_keyboard: rows }, botToken);
        return true;
      }
      case "orders": {
        const orders = await prisma.order.findMany({
          where: {
            status: "pending",
            shopId: { in: preparer.shopLinks.map((l: any) => l.shopId) }
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
          include: { shop: true, customerRegion: true, courier: true }
        });
        if (!order) return true;

        const baseUrl = getPublicAppUrl();
        const portalUrl = buildCompanyPreparerPortalUrl(preparer.id, preparer.portalToken, baseUrl);
        const orderUrl = portalUrl.replace("/preparer", `/preparer/order/${order.id}`);
        const courierLine = order.courier ? `المندوب: ${escapeTelegramHtml(order.courier.name)}` : "";

        const text = [
          `<b>📦 طلب #${order.orderNumber}</b>`,
          `🏪 المحل: ${escapeTelegramHtml(order.shop.name)}`,
          `📍 المنطقة: ${escapeTelegramHtml(order.customerRegion?.name || "—")}`,
          `💰 السعر: ${formatDinarAsAlf(order.totalAmount || 0)}`,
          `📝 الملاحظة: ${escapeTelegramHtml(order.orderNoteTime || "—")}`,
          courierLine,
          `-------------------------`,
          `اضغط على الرابط أدناه لتجهيز الطلب أو إسناده لمندوب.`
        ].filter(Boolean).join("\n");

        const kb: TelegramInlineKeyboard = {
          inline_keyboard: [
            [{ text: "🛠️ فتح وتجهيز الطلب", url: orderUrl }],
            [{ text: order.assignedCourierId ? "🔄 تغيير المندوب" : "🧑‍✈️ إسند للمندوب", callback_data: `p_ac:${order.id}` }],
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

export async function renderPreparerWallet(preparer: any, prefix?: string) {
  const totals = await getPreparerMoneyTotals(preparer.id);
  const wid = preparer.walletEmployeeId;

  let txLines = "";
  if (wid) {
    const recent = await prisma.employeeWalletMiscEntry.findMany({
      where: { employeeId: wid, deletedAt: null },
      orderBy: { createdAt: "desc" },
      take: 15
    });
    if (recent.length > 0) {
      txLines = "\n<b>آخر 15 حركة:</b>\n" + recent.map(r =>
        `${r.direction === "take" ? "➕" : "➖"} ${formatDinarAsAlf(r.amountDinar)} : ${escapeTelegramHtml(r.label || "—")}`
      ).join("\n");
    }
  }

  const textLines = [];
  if (prefix) {
    textLines.push(prefix);
    textLines.push(`-------------------------`);
  }
  textLines.push(`<b>💰 محفظة المجهز: ${escapeTelegramHtml(preparer.name)}</b>`);
  textLines.push(`-------------------------`);
  textLines.push(`📥 الوارد (أخذت): <b>${formatDinarAsAlf(totals?.ward || 0)}</b>`);
  textLines.push(`📤 الصادر (أعطيت): <b>${formatDinarAsAlf(totals?.sader || 0)}</b>`);
  textLines.push(`💵 المتبقي بذمتك للإدارة: <b>${formatDinarAsAlf(totals?.remain || 0)}</b>`);
  textLines.push(`-------------------------`);
  if (txLines) textLines.push(txLines);
  textLines.push(`-------------------------`);
  textLines.push(`يمكنك استخدام الأزرار أدناه لتسجيل الحركات المالية أو التحويل.`);

  const kb: TelegramInlineKeyboard = {
    inline_keyboard: [
      [
        { text: "➕ أخذت", callback_data: "p_w_take" },
        { text: "➖ أعطيت", callback_data: "p_w_give" }
      ],
      [{ text: "💸 تحويل مبلغ", callback_data: "p_w_trans" }],
      [{ text: "🏠 الرئيسية", callback_data: "p_main" }]
    ]
  };

  return { text: textLines.join("\n"), keyboard: kb };
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
      [{ text: "➕ طلب سريع", callback_data: "p_new" }],
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
  const txt = message.text?.trim() ?? "";

  // 1. رابط التفعيل (Registration via Link)
  if (txt.includes("/preparer") && (txt.includes("exp=") || txt.includes("token="))) {
    try {
      const p = txt.match(/[?&]p=([^&]+)/)?.[1];
      const exp = (txt.match(/[?&]exp=([^&]+)/)?.[1]) || (txt.match(/[?&]token=([^&]+)/)?.[1]);
      const s = txt.match(/[?&]s=([^&]+)/)?.[1];

      if (p && exp) {
        console.log(`[preparer-reg] Attempting link registration: p=${p}, exp=${exp.substring(0, 10)}...`);
        const v = verifyCompanyPreparerPortalQuery(p, exp, s);
        if (v.ok) {
          const updated = await prisma.companyPreparer.update({
            where: { id: v.preparerId },
            data: { telegramUserId, portalToken: v.token, active: true }
          });
          console.log(`[preparer-reg] Success: Preparer ${updated.name} (ID: ${updated.id}) linked to TG:${telegramUserId}`);
          const { text, keyboard } = await renderPreparerHub(updated);
          await sendTelegramMessageWithKeyboardToChat(chatId,
            `✅ تم ربط حسابك بنجاح مجهزنا <b>${escapeTelegramHtml(updated.name)}</b>!\n\nيمكنك الآن استلام الإشعارات وإدارة الطلبات.`,
            keyboard, botToken
          );
          return true;
        } else {
          console.warn(`[preparer-reg] Verification failed: ${v.reason}`);
        }
      }
    } catch (e) {
      console.error("[preparer-reg] Error:", e);
    }
  }

  const preparer = await getPreparerByTelegramUserId(telegramUserId);
  if (!preparer) return false;
  if (txt === "/start") {
    const { text, keyboard } = await renderPreparerHub(preparer);
    await sendTelegramMessageWithKeyboardToChat(chatId, text, keyboard, botToken);
    return true;
  }

  const session = await getPreparerSession(telegramUserId);

  // معالجة جلسات المحفظة (أخذت / أعطيت)
  if (session?.step === "preparer_wallet_take" || session?.step === "preparer_wallet_give") {
    const lines = txt.split("\n").map(l => l.trim()).filter(Boolean);
    if (lines.length < 2) {
      await sendTelegramMessageWithKeyboardToChat(chatId, "الرجاء إرسال سطرين:\n1. المبلغ\n2. اسم المعاملة", { inline_keyboard: [[{ text: "❌ إلغاء", callback_data: "p_wallet" }]] }, botToken);
      return true;
    }
    const amount = parseAlfInputToDinarNumber(lines[0]!);
    if (amount == null) {
      await sendTelegramMessageWithKeyboardToChat(chatId, "المبلغ غير صحيح. الرجاء إدخال رقم صحيح في السطر الأول.", { inline_keyboard: [[{ text: "❌ إلغاء", callback_data: "p_wallet" }]] }, botToken);
      return true;
    }
    const label = lines.slice(1).join(" ");
    const direction = session.step === "preparer_wallet_take" ? CourierWalletMiscDirection.take : CourierWalletMiscDirection.give;

    if (preparer.walletEmployeeId) {
      await prisma.employeeWalletMiscEntry.create({
        data: {
          employeeId: preparer.walletEmployeeId,
          direction,
          amountDinar: amount,
          label,
        }
      });
      await clearPreparerSession(telegramUserId);
      const actionLabel = direction === "take" ? "أخذت" : "أعطيت";
      const prefix = `✅ <b>تم تسجيل المعاملة</b>\n${actionLabel} ${formatDinarAsAlf(amount)} ${escapeTelegramHtml(label)}`;
      const { text, keyboard } = await renderPreparerWallet(preparer, prefix);
      await sendTelegramMessageWithKeyboardToChat(chatId, text, keyboard, botToken);
    } else {
      await sendTelegramMessageWithKeyboardToChat(chatId, "لا يوجد حساب مالي مرتبط بك. يرجى مراجعة الإدارة.", { inline_keyboard: [[{ text: "🏠 الرئيسية", callback_data: "p_main" }]] }, botToken);
    }
    return true;
  }

  // معالجة جلسة التحويل
  if (session?.step === "preparer_wallet_transfer_note") {
    const payload = JSON.parse(session.payload || "{}");
    const lines = txt.split("\n").map(l => l.trim()).filter(Boolean);
    if (lines.length < 2) {
      await sendTelegramMessageWithKeyboardToChat(chatId, "الرجاء إرسال سطرين:\n1. المبلغ\n2. مكان التحويل", { inline_keyboard: [[{ text: "❌ إلغاء", callback_data: "p_wallet" }]] }, botToken);
      return true;
    }
    const amount = parseAlfInputToDinarNumber(lines[0]!);
    if (amount == null) {
      await sendTelegramMessageWithKeyboardToChat(chatId, "المبلغ غير صحيح.", { inline_keyboard: [[{ text: "❌ إلغاء", callback_data: "p_wallet" }]] }, botToken);
      return true;
    }
    const location = lines.slice(1).join(" ");

    const transfer = await prisma.walletPeerTransfer.create({
      data: {
        amountDinar: amount,
        handoverLocation: location,
        status: "pending",
        fromKind: WalletPeerPartyKind.employee,
        fromEmployeeId: preparer.walletEmployeeId,
        toKind: payload.targetType === "courier" ? WalletPeerPartyKind.courier : WalletPeerPartyKind.employee,
        toCourierId: payload.targetType === "courier" ? payload.targetId : null,
        toEmployeeId: payload.targetType === "preparer" ? (await prisma.companyPreparer.findUnique({ where: { id: payload.targetId } }))?.walletEmployeeId : null,
      }
    });

    await clearPreparerSession(telegramUserId);
    const prefix = `⏳ <b>تم إرسال طلب التحويل بقيمة ${formatDinarAsAlf(amount)} بانتظار الموافقة.</b>`;
    const { text: walletText, keyboard: walletKb } = await renderPreparerWallet(preparer, prefix);
    await sendTelegramMessageWithKeyboardToChat(chatId, walletText, walletKb, botToken);

    const fromLabel = await resolvePartyDisplayName(WalletPeerPartyKind.employee, null, preparer.walletEmployeeId);

    // إرسال إشعار للمستلم باستخدام الدوال الجاهزة لتوحيد التنسيق
    if (payload.targetType === "courier") {
      await notifyTelegramCourierTransferEvent({
        courierId: payload.targetId,
        kind: "incoming",
        amountDinar: new Decimal(amount),
        partyName: fromLabel,
        location,
        transferId: transfer.id
      });
    } else {
      const targetPrep = await prisma.companyPreparer.findUnique({ where: { id: payload.targetId } });
      if (targetPrep) {
        await notifyTelegramPreparerTransferEvent({
          preparerId: targetPrep.id,
          kind: "incoming",
          amountDinar: new Decimal(amount),
          partyName: fromLabel,
          location,
          transferId: transfer.id
        });
      }
    }
    return true;
  }

  if (session?.step === "preparer_new_order_region") {
    await sendTelegramMessageWithKeyboardToChat(chatId,
      "الرجاء اختيار المنطقة من القائمة أو أعد إرسال طلبك مع اسم المنطقة بشكل أوضح.",
      { inline_keyboard: [[{ text: "🏠 الرئيسية", callback_data: "p_main" }]] },
      botToken,
    );
    return true;
  }

  const parsed = parseQuickOrder(txt);
  if (!parsed.phone || parsed.price == null) {
    // محاولة البحث عن المحلات باستخدام البحث المطور
    const normalizedTxt = normalizeArabicSearch(txt);
    const searchMatches = preparer.shopLinks.filter(link => {
      const shopName = normalizeArabicSearch(link.shop.name);
      return shopName.includes(normalizedTxt) || normalizedTxt.includes(shopName);
    });

    if (searchMatches.length > 0 && txt.length >= 2) {
      const text = `🔍 <b>نتائج البحث عن المحلات: "${escapeTelegramHtml(txt)}"</b>\n\nاختر المحل لبدء إنشاء طلب سريع له:`;
      const kb: TelegramInlineKeyboard = {
        inline_keyboard: [
          ...searchMatches.map(m => [{ text: m.shop.name, callback_data: `p_shop:${m.shop.id}` }]),
          [{ text: "🏠 الرئيسية", callback_data: "p_main" }]
        ]
      };
      await sendTelegramMessageWithKeyboardToChat(chatId, text, kb, botToken);
      return true;
    }

    await sendTelegramMessageWithKeyboardToChat(chatId,
      `لم يتم التعرف على رقم الهاتف أو السعر في نص الطلب.

أرسل رسالة واحدة تحتوي على: اسم المحل، رقم الزبون، السعر، ونوع الطلب أو ملاحظة.
مثال:\nمحل الفارس\nالمنطقة: الرصافه\n07701234567\n1500\nفوري – تسليم بعد نصف ساعة`,
      { inline_keyboard: [[{ text: "➕ طلب سريع", callback_data: "p_new" }], [{ text: "🏠 الرئيسية", callback_data: "p_main" }]] },
      botToken,
    );
    return true;
  }

  const payload: PreparerNewOrderPayload = {
    customerPhone: parsed.phone,
    totalAmountDinar: parsed.price,
    orderType: "تجهيز سريع",
    orderNoteTime: parsed.orderType || "فوري",
    customerRegionName: parsed.regionQuery || "",
    preparerId: preparer.id,
    portalToken: preparer.portalToken,
    telegramUserId,
  };

  if (preparer.shopLinks.length === 1) {
    payload.shopId = preparer.shopLinks[0]!.shop.id;
    payload.shopName = preparer.shopLinks[0]!.shop.name;
  } else {
    const shopId = findShopIdFromText(txt, preparer.shopLinks);
    if (shopId) {
      payload.shopId = shopId;
      payload.shopName = preparer.shopLinks.find((link) => link.shop.id === shopId)?.shop.name;
    }
  }

  // تحسين استخراج المنطقة: إذا كان السطر الأول هو اسم المحل، ننتقل للسطر التالي
  if (payload.shopName && parsed.remainingLines.length > 1) {
    const firstLineNormalized = normalizeArabicSearch(parsed.remainingLines[0] || "");
    const shopNameNormalized = normalizeArabicSearch(payload.shopName);
    if (firstLineNormalized.includes(shopNameNormalized) || shopNameNormalized.includes(firstLineNormalized)) {
      payload.customerRegionName = parsed.remainingLines[1] || "";
      payload.orderNoteTime = parsed.remainingLines.slice(2).join(" ") || parsed.orderType || "فوري";
    }
  }

  if (!payload.shopId) {
    await askPreparerToPickShop(chatId, botToken, telegramUserId, payload, preparer.shopLinks);
    return true;
  }

  const allRegions = await prisma.region.findMany({ select: { id: true, name: true } });
  const regionQuery = payload.customerRegionName || parsed.regionQuery;
  if (regionQuery) {
    const ranked = rankRegionsByQuery(regionQuery, allRegions, 10);
    if (ranked.length === 1) {
      payload.customerRegionId = ranked[0].id;
      payload.customerRegionName = ranked[0].name;
      await clearPreparerSession(telegramUserId);
      await createPreparerOrder(chatId, botToken, payload);
      return true;
    }
    if (ranked.length > 0) {
      await askPreparerToPickRegion(chatId, botToken, telegramUserId, payload, ranked.map((row) => ({ id: row.id, name: row.name })));
      return true;
    }
  }

  await askPreparerToPickRegion(chatId, botToken, telegramUserId, payload, allRegions);
  return true;
}
