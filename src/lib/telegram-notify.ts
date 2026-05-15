import { Decimal } from "@prisma/client/runtime/library";
import { formatDinarAsAlf, formatDinarAsAlfWithUnit } from "@/lib/money-alf";
import { prisma } from "@/lib/prisma";
import { getPublicAppUrl } from "@/lib/app-url";
import {
  escapeTelegramHtml,
  sendTelegramMessage,
  sendTelegramMessageWithKeyboard,
  sendTelegramHtmlToChat,
  sendTelegramMessageWithKeyboardToChat,
  type TelegramInlineKeyboard,
} from "@/lib/telegram";
import { getBotTokenByPurpose } from "./telegram-bots";
import { getPreparerMoneyTotals } from "./preparer-combined-wallet-totals";
import { buildCompanyPreparerPortalUrl } from "./company-preparer-portal-link";
import { buildDelegatePortalUrl } from "./delegate-link";
import { computeMandoubWalletRemainAllTimeDinar } from "./mandoub-wallet-carry";

const TARGET = "admin";
const SECTION_TELEGRAM_NEW_ORDER = "telegram_new_order_template";

export function getDefaultTelegramNewOrderTemplate(): string {
  return [
    "🏪 ({shopName} — {customerName}){vehicleEmoji}",
    "📍 {regionName}",
    "📦 {orderType}",
    "💵 {subtotal}",
    "🚚 {delivery}",
    "💰 {total}",
    "⏰ {noteTime}",
    "🔢 {orderNumber}",
    "📞 {customerPhone}",
  ].join("\n");
}

export async function getTelegramNewOrderTemplate(): Promise<string> {
  try {
    const row = await prisma.uISystemSetting.findUnique({
      where: { target_section: { target: TARGET, section: SECTION_TELEGRAM_NEW_ORDER } },
      select: { config: true },
    });
    const config = row?.config as { template?: string } | null;
    return config?.template?.trim() || getDefaultTelegramNewOrderTemplate();
  } catch {
    return getDefaultTelegramNewOrderTemplate();
  }
}

export async function saveTelegramNewOrderTemplate(template: string): Promise<void> {
  const normalized = template.trim() || getDefaultTelegramNewOrderTemplate();
  await prisma.uISystemSetting.upsert({
    where: { target_section: { target: TARGET, section: SECTION_TELEGRAM_NEW_ORDER } },
    create: { target: TARGET, section: SECTION_TELEGRAM_NEW_ORDER, config: { template: normalized } },
    update: { config: { template: normalized } },
  });
}

function alfLine(label: string, value: string): string {
  return `\u200F${label} \u200E${escapeTelegramHtml(value)}\u200E `;
}

async function formatOrderBodyLines(input: {
  shopName: string; customerName: string; regionName: string; orderType: string;
  orderSubtotal: Decimal | null; deliveryPrice: Decimal | null; totalAmount: Decimal | null;
  orderNumber: number; customerPhone: string; orderNoteTime?: string | null;
  vehiclePreference?: string | null;
}, options?: { omitPhone?: boolean }): Promise<string[]> {
  const template = await getTelegramNewOrderTemplate();

  const vehicleEmoji = input.vehiclePreference === "bike" ? " 🏍️" : (input.vehiclePreference === "car" ? " 🚗" : "");

  const replacements: Record<string, string> = {
    "{shopName}": escapeTelegramHtml(input.shopName),
    "{customerName}": escapeTelegramHtml(input.customerName?.trim() || "—"),
    "{regionName}": escapeTelegramHtml(input.regionName || "—"),
    "{orderType}": escapeTelegramHtml(input.orderType || "—"),
    "{subtotal}": `\u200E${formatDinarAsAlf(input.orderSubtotal)}\u200E`,
    "{delivery}": `\u200E${formatDinarAsAlf(input.deliveryPrice)}\u200E`,
    "{total}": `\u200E${formatDinarAsAlf(input.totalAmount)}\u200E`,
    "{noteTime}": input.orderNoteTime?.trim() ? escapeTelegramHtml(input.orderNoteTime.trim()) : "",
    "{orderNumber}": `\u200E${input.orderNumber}\u200E`,
    "{customerPhone}": options?.omitPhone ? "" : `\u200E${escapeTelegramHtml(input.customerPhone || "—")}\u200E`,
    "{vehicleEmoji}": vehicleEmoji,
  };

  let text = template;
  Object.entries(replacements).forEach(([key, val]) => {
    text = text.replaceAll(key, val);
  });

  return text.split("\n").filter(line => line.trim() !== "").map(line => `\u200F${line}`);
}

export async function notifyTelegramPreparerWalletEvent(input: {
  preparerId: string;
  kind: "take" | "give" | "order_in" | "order_out" | "transfer_in" | "transfer_out" | "transfer_rejected" | "transfer_accepted";
  amountDinar: Decimal;
  label: string;
}) {
  const totals = await getPreparerMoneyTotals(input.preparerId);
  const preparer = await prisma.companyPreparer.findUnique({ where: { id: input.preparerId } });
  
  const isIn = input.kind === "take" || input.kind === "order_in" || input.kind === "transfer_in" || input.kind === "transfer_accepted";
  const isRejected = input.kind === "transfer_rejected";

  const emoji = isRejected ? "❌ تحويل مرفوض" : isIn ? "🔴 وارد للمحفظة" : "🟢 صادر من المحفظة";
  const amount = `\u200E${formatDinarAsAlf(input.amountDinar)}\u200E`;
  const remain = totals ? `\u200E${formatDinarAsAlf(totals.remain)}\u200E` : "—";
  const dateStr = `\u200E${new Date().toLocaleDateString("ar-IQ-u-nu-latn", { dateStyle: "short" })}\u200E`;

  const text = [
    `\u200F<b>💰 حركة محفظة مجهز</b>`,
    `\u200F<b>المجهز:</b> ${escapeTelegramHtml(preparer?.name || "—")}`,
    `\u200F<b>التاريخ:</b> ${dateStr}`,
    `\u200F<b>النوع:</b> ${emoji}`,
    `\u200F<b>المبلغ:</b> ${amount}`,
    `\u200F<b>التفاصيل:</b> ${escapeTelegramHtml(input.label)}`,
    `\u200F-------------------------`,
    `\u200F<b>💰 المتبقي بذمة المجهز:</b> ${remain}`
  ].join("\n");

  const notificationBotToken = await getBotTokenByPurpose("notification");
  await sendTelegramMessage(text, { botToken: notificationBotToken });

  if (preparer?.telegramUserId) {
    const preparerBotToken = await getBotTokenByPurpose("preparer");
    await sendTelegramHtmlToChat(preparer.telegramUserId, text, preparerBotToken);
  }
}

/** إشعار للمندوب عند استلام أو قبول/رفض تحويله */
export async function notifyTelegramCourierTransferEvent(input: {
  courierId: string;
  kind: "incoming" | "accepted" | "rejected";
  amountDinar: Decimal;
  partyName: string;
  location: string;
  transferId?: string;
  botToken?: string;
}) {
  const courier = await prisma.courier.findUnique({ where: { id: input.courierId } });
  if (!courier?.telegramUserId) return;

  let text = "";
  let kb: TelegramInlineKeyboard | undefined = undefined;

  const amountStr = `\u200E${formatDinarAsAlf(input.amountDinar)}\u200E`;
  const walletTotal = await computeMandoubWalletRemainAllTimeDinar(input.courierId);
  const walletTotalStr = `\u200E${formatDinarAsAlf(walletTotal)}\u200E`;
  const walletLine = `\n\n\u200F<b>💵 عندي:</b> ${walletTotalStr}`;

  if (input.kind === "incoming") {
    text = `\u200F💰 <b>تحويل مالي واصل إليك</b>\n\n` +
           `\u200F<b>المرسل:</b> ${escapeTelegramHtml(input.partyName)}\n` +
           `\u200F<b>المبلغ:</b> ${amountStr}\n` +
           `\u200F<b>المكان:</b> ${escapeTelegramHtml(input.location)}\n\n` +
           `\u200Fهل تقبل استلام المبلغ؟` + walletLine;
    kb = {
      inline_keyboard: [
        [
          { text: "✅ قبول", callback_data: `acc_t_${input.transferId}` },
          { text: "❌ رفض", callback_data: `rej_t_${input.transferId}` }
        ]
      ]
    };
  } else if (input.kind === "accepted") {
    text = `\u200F✅ <b>تم قبول تحويلك</b>\n\n` +
           `\u200F<b>المستلم:</b> ${escapeTelegramHtml(input.partyName)}\n` +
           `\u200F<b>المبلغ:</b> ${amountStr}\n` +
           `\u200Fلقد تم خصم المبلغ من ذمتك للإدارة بنجاح.` + walletLine;
  } else if (input.kind === "rejected") {
    text = `\u200F❌ <b>تم رفض تحويلك</b>\n\n` +
           `\u200F<b>الطرف الآخر:</b> ${escapeTelegramHtml(input.partyName)}\n` +
           `\u200F<b>المبلغ:</b> ${amountStr}\n` +
           `\u200Fالمبلغ لا يزال في ذمتك، تواصل معه للتأكد.` + walletLine;
  }

  const courierBotToken = input.botToken || await getBotTokenByPurpose("courier");
  if (kb) {
    await sendTelegramMessageWithKeyboardToChat(courier.telegramUserId, text, kb, courierBotToken);
  } else {
    await sendTelegramHtmlToChat(courier.telegramUserId, text, courierBotToken);
  }
}

export async function notifyTelegramNewOrder(orderId: string): Promise<void> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { shop: true, customer: true, customerRegion: true }
  });
  if (!order) return;

  const baseUrl = getPublicAppUrl();
  const adminText = await formatNewOrderTelegramHtml({
    ...order, shopName: order.shop.name, customerName: order.customer?.name ?? "—",
    regionName: order.customerRegion?.name ?? "—", orderId: order.id
  });

  // إرسال للإدارة (رابط الإدارة)
  const notificationBotToken = await getBotTokenByPurpose("notification");
  const adminKb = buildTelegramOrderKeyboard(order.orderNumber, order.id);
  await sendTelegramMessageWithKeyboard(adminText, adminKb, notificationBotToken);

  // إرسال للمجهزين المرتبطين بالمحل
  const preparers = await prisma.companyPreparer.findMany({
    where: { active: true, telegramUserId: { not: "" }, shopLinks: { some: { shopId: order.shopId } } }
  });

  for (const prep of preparers) {
    const prepUrl = buildCompanyPreparerPortalUrl(prep.id, prep.portalToken, baseUrl);
    const prepOrderUrl = `${prepUrl.replace("/preparer", `/preparer/order/${order.id}`)}`;

    const bodyLines = await formatOrderBodyLines({
      ...order, shopName: order.shop.name, customerName: order.customer?.name ?? "—",
      regionName: order.customerRegion?.name ?? "—"
    }, { omitPhone: true });

    const prepText = `🔔 <b>طلب جديد لمحل تابع لك:</b>\n\n` + bodyLines.join("\n") + `\n\n🔗 <a href="${prepOrderUrl}">فتح الطلب من حسابك</a>`;
    const prepKb: TelegramInlineKeyboard = {
      inline_keyboard: [
        [{ text: "👤 إسناد لمندوب", callback_data: `l${order.orderNumber}` }]
      ]
    };

    const preparerBotToken = await getBotTokenByPurpose("preparer");
    await sendTelegramMessageWithKeyboardToChat(prep.telegramUserId, prepText, prepKb, preparerBotToken);
  }
}

export async function formatNewOrderTelegramHtml(input: any, options?: any): Promise<string> {
  const lines = await formatOrderBodyLines(input, options);
  if (!options?.omitAdminLink) {
    lines.push(`🔗 <a href="${escapeTelegramHtml(getPublicAppUrl() + '/admin/orders/' + input.orderId)}">رابط الإدارة</a>`);
  }
  return lines.join("\n");
}

export async function notifyTelegramMoneyEvent(input: any): Promise<void> {
  const order = await prisma.order.findUnique({
    where: { id: input.orderId },
    include: { shop: true, customer: true, customerRegion: true, courier: true }
  });
  if (!order) return;

  const baseUrl = getPublicAppUrl();
  const header = input.kind === "pickup_out" ? "💸 للعميل 💸" : "💸 من الزبون 💸";
  const body = await formatOrderBodyLines({
    ...order, 
    shopName: order.shop.name, 
    customerName: order.customer?.name ?? "",
    regionName: order.customerRegion?.name ?? "" 
  });

  const textBase = [
    `\u200F${escapeTelegramHtml(header)}`,
    `\u200F👤 ${escapeTelegramHtml(input.courierName)}`,
    alfLine("💰", formatDinarAsAlf(input.amountDinar)),
    ...body
  ].join("\n");

  // إرسال للإدارة
  const notificationBotToken = await getBotTokenByPurpose("notification");
  await sendTelegramMessage(textBase, { botToken: notificationBotToken });

  // إرسال للمندوب (رابط حسابه)
  if (order.courier?.telegramUserId) {
    const courierUrl = buildDelegatePortalUrl(order.courier.id, baseUrl);
    const courierOrderUrl = `${courierUrl.replace("/mandoub", `/mandoub/order/${order.id}`)}`;

    // إضافة المبلغ الكلي للمندوب "💵 عندي"
    const walletTotal = await computeMandoubWalletRemainAllTimeDinar(order.courier.id);
    const walletTotalStr = `\u200E${formatDinarAsAlf(walletTotal)}\u200E`;

    const courierText = textBase +
      `\n\n🔗 <a href="${courierOrderUrl}">فتح الطلب من حسابك</a>` +
      `\n\n\u200F<b>💵 عندي:</b> ${walletTotalStr}`;

    const courierBotToken = input.botToken || await getBotTokenByPurpose("courier");
    await sendTelegramHtmlToChat(order.courier.telegramUserId, courierText, courierBotToken);
  }
}

export async function notifyTelegramOrderPrepared(input: { orderId: string; botToken?: string }): Promise<void> {
  const order = await prisma.order.findUnique({
    where: { id: input.orderId },
    include: { shop: true, customer: true, customerRegion: true, courier: true }
  });
  if (!order || !order.courier?.telegramUserId) return;

  const body = await formatOrderBodyLines({
    ...order,
    shopName: order.shop.name,
    customerName: order.customer?.name ?? "",
    regionName: order.customerRegion?.name ?? ""
  });

  const walletTotal = await computeMandoubWalletRemainAllTimeDinar(order.courier.id);
  const walletTotalStr = `\u200E${formatDinarAsAlf(walletTotal)}\u200E`;

  const baseUrl = getPublicAppUrl();
  const courierUrl = buildDelegatePortalUrl(order.courier.id, baseUrl);
  const courierOrderUrl = `${courierUrl.replace("/mandoub", `/mandoub/order/${order.id}`)}`;

  const text = [
    `\u200F✅ <b>اكتمل تجهيز الطلب</b>`,
    ...body,
    `\n🔗 <a href="${courierOrderUrl}">فتح الطلب من حسابك</a>`,
    `\n\u200F<b>💵 عندي:</b> ${walletTotalStr}`
  ].join("\n");

  const notificationBotToken = await getBotTokenByPurpose("notification");
  await sendTelegramHtmlToChat(order.courier.telegramUserId, text, courierBotToken);

  await sendTelegramMessage(`\u200F✅ <b>تم تجهيز طلب #${order.orderNumber} وإسناده للمندوب ${escapeTelegramHtml(order.courier.name)}</b>`, { botToken: notificationBotToken });
}

/** إشعار عند وصول طلب جديد من المتجر الإلكتروني */
export async function notifyTelegramStoreOrder(draftId: string): Promise<void> {
  const draft = await prisma.companyPreparerShoppingDraft.findUnique({
    where: { id: draftId },
    include: { customerRegion: true }
  });
  if (!draft) return;

  const data = draft.data as any;
  const cart = (data?.webStoreCart as any[]) || [];
  const vehicleEmoji = draft.vehiclePreference === "bike" ? " 🏍️" : (draft.vehiclePreference === "car" ? " 🚗" : "");

  const text = [
    `\u200F🛒 <b>طلب جديد من المتجر</b>`,
    `\u200F🔢 <b>رقم المسودة:</b> \u200E${draft.draftNumber}\u200E`,
    `\u200F👤 <b>الزبون:</b> ${escapeTelegramHtml(draft.customerName || "—")}`,
    `\u200F📍 <b>المنطقة:</b> ${escapeTelegramHtml(draft.customerRegion?.name || "—")}`,
    `\u200F🏠 <b>العنوان:</b> ${escapeTelegramHtml(draft.customerLandmark || "—")}`,
    `\u200F📞 <b>الهاتف:</b> \u200E${escapeTelegramHtml(draft.customerPhone)}\u200E`,
    `\u200F📦 <b>النوع:</b> ${escapeTelegramHtml(data?.orderType || "تجهيز تسوق")}${vehicleEmoji}`,
    `\u200F-------------------------`,
    `\u200F<b>المحتويات:</b>`,
    ...cart.map(i => `\u200F• ${escapeTelegramHtml(i.name)} (${i.quantity || 1})`),
    `\u200F-------------------------`,
    `\u200F🔗 <a href="${getPublicAppUrl()}/admin/orders/pending?tab=preparing">فتح لوحة التجهيز</a>`
  ].join("\n");

  const notificationBotToken = await getBotTokenByPurpose("notification");
  await sendTelegramMessage(text, { botToken: notificationBotToken });
}

export async function notifyTelegramPresenceChange(input: any): Promise<void> {
  const label = input.kind === "courier" ? "مندوب" : "مجهز";
  const text = `<b>${label}:</b> ${escapeTelegramHtml(input.name)} \n${input.available ? "✅ متاح" : "⏸ غير متاح"}`;
  const notificationBotToken = await getBotTokenByPurpose("notification");
  await sendTelegramMessage(text, { botToken: notificationBotToken });
}

export async function notifyTelegramSupplierPriceUpdate(input: {
  supplierName: string;
  productName: string;
  oldPrice: Decimal | null;
  newPrice: Decimal;
  salePrice: Decimal;
}) {
  const oldStr = input.oldPrice ? formatDinarAsAlfWithUnit(input.oldPrice) : "جديد";
  const newStr = formatDinarAsAlfWithUnit(input.newPrice);
  const saleStr = formatDinarAsAlfWithUnit(input.salePrice);

  const text = [
    `<b>🍎 تحديث سعر مورد</b>`,
    `<b>المورد:</b> ${escapeTelegramHtml(input.supplierName)}`,
    `<b>المنتج:</b> ${escapeTelegramHtml(input.productName)}`,
    `-------------------------`,
    `<b>سعر الشراء القديم:</b> ${oldStr}`,
    `<b>سعر الشراء الجديد:</b> ${newStr}`,
    `<b>سعر البيع الحالي:</b> ${saleStr}`,
  ].join("\n");

  const notificationBotToken = await getBotTokenByPurpose("notification");
  await sendTelegramMessage(text, { botToken: notificationBotToken });
}

export function buildTelegramOrderKeyboard(
  orderNumber: number,
  orderId?: string,
  options?: { showBrowserLinks?: boolean; omitAdminLink?: boolean }
): TelegramInlineKeyboard {
  const on = String(orderNumber);
  return {
    inline_keyboard: [
      [{ text: "تحويل لمندوب", callback_data: `l${on}` }],
      [{ text: "تعديل الطلب", callback_data: `e${on}` }],
    ],
  };
}
