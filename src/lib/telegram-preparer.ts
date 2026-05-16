import { Decimal } from "@prisma/client/runtime/library";
import { prisma } from "@/lib/prisma";
import {
  answerCallbackQuery,
  editTelegramMessage,
  escapeTelegramHtml,
  sendTelegramMessageWithKeyboardToChat,
  type TelegramInlineKeyboard,
} from "@/lib/telegram";
import {
  formatDinarAsAlf,
  parseAlfInputToDinarDecimalRequired,
  parseAlfInputToDinarNumber,
} from "@/lib/money-alf";
import { getPublicAppUrl } from "@/lib/app-url";
import { buildCompanyPreparerPortalUrl, verifyCompanyPreparerPortalQuery } from "@/lib/company-preparer-portal-link";
import { getPreparerMoneyTotals } from "@/lib/preparer-combined-wallet-totals";
import { rankRegionsByQuery } from "@/lib/arabic-region-search";
import { extractPhoneFromText, parseQuickOrder } from "@/lib/flexible-order-parse";
import { normalizeIraqMobileLocal11 } from "@/lib/whatsapp";
import { notifyTelegramNewOrder } from "@/lib/telegram-notify";
import { pushNotifyAdminsNewPendingOrder } from "@/lib/web-push-server";
import { transferOrderToCourierInternal } from "@/lib/order-assign-courier";
import { syncPhoneProfileFromOrder } from "@/lib/customer-phone-profile-sync";
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
  | { kind: "cancel_flow" };

export function parsePreparerTelegramCallback(raw: string): PreparerTelegramCallback | null {
  const t = raw.trim();
  if (t === "p_main") return { kind: "main" };
  if (t === "p_wallet") return { kind: "wallet" };
  if (t === "p_new") return { kind: "new_order" };
  if (t === "p_cancel") return { kind: "cancel_flow" };

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
  const normalized = text.toLowerCase();
  const exactMatches = shopLinks.filter((link) => link.shop.name.toLowerCase() === normalized);
  if (exactMatches.length === 1) return exactMatches[0].shop.id;

  const substringMatches = shopLinks.filter((link) =>
    normalized.includes(link.shop.name.toLowerCase()) || link.shop.name.toLowerCase().includes(normalized)
  );
  if (substringMatches.length === 1) return substringMatches[0].shop.id;

  const firstLine = text.split("\n").map((line) => line.trim()).find(Boolean) ?? "";
  const firstLineMatches = shopLinks.filter((link) => link.shop.name.toLowerCase().includes(firstLine.toLowerCase()));
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
        const result = await transferOrderToCourierInternal(parsed.orderId, parsed.courierId, { bypassCourierAvailability: true });
        const text = result.ok
          ? `✅ تم إسناد الطلب بنجاح.`
          : `⚠️ ${escapeTelegramHtml(result.error)}`;
        await sendTelegramMessageWithKeyboardToChat(chatId, text, { inline_keyboard: [[{ text: "🏠 الرئيسية", callback_data: "p_main" }]] }, botToken);
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

  const preparer = await getPreparerByTelegramUserId(telegramUserId);
  if (!preparer) return false;

  const txt = message.text?.trim() ?? "";
  if (txt === "/start") {
    const { text, keyboard } = await renderPreparerHub(preparer);
    await sendTelegramMessageWithKeyboardToChat(chatId, text, keyboard, botToken);
    return true;
  }

  const session = await getPreparerSession(telegramUserId);
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

  if (!payload.shopId) {
    await askPreparerToPickShop(chatId, botToken, telegramUserId, payload, preparer.shopLinks);
    return true;
  }

  const allRegions = await prisma.region.findMany({ select: { id: true, name: true } });
  if (parsed.regionQuery) {
    const ranked = rankRegionsByQuery(parsed.regionQuery, allRegions, 10);
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
