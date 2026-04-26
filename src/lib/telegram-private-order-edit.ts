/**
 * من الخاص: تعديل حقول «زبون الطلب» على سجل الطلب + تزامن Customer إن وُجد.
 */
import { revalidatePath } from "next/cache";
import { resizeImageBufferForShop } from "@/lib/image-resize";
import { MAX_ORDER_IMAGE_BYTES, saveOrderImageFromResizedBuffer } from "@/lib/order-image";
import { prisma } from "@/lib/prisma";
import {
  editTelegramMessage,
  escapeTelegramHtml,
  sendTelegramMessageWithKeyboardToChat,
  telegramDownloadFileById,
  type TelegramInlineKeyboard,
} from "@/lib/telegram";
import { syncPhoneProfileFromOrder } from "@/lib/customer-phone-profile-sync";
import { normalizeIraqMobileLocal11 } from "@/lib/whatsapp";

export const PRIV_ORD_LOC = "priv_ord_loc";
export const PRIV_ORD_ALT = "priv_ord_alt";
export const PRIV_ORD_LMK = "priv_ord_lmk";
export const PRIV_ORD_DOOR = "priv_ord_door";

async function upsertPrivOrdSession(
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
      orderNumber: null,
      payload,
    },
    update: { chatId, step, orderNumber: null, payload },
  });
}

export async function clearPrivOrdCustomerSession(telegramUserId: string): Promise<void> {
  await prisma.telegramBotSession.updateMany({
    where: { telegramUserId },
    data: { step: "idle", orderNumber: null, payload: "" },
  });
}

function normalizeUrl(raw: string): string {
  const s = raw.trim();
  if (!s) return s;
  if (/^https?:\/\//i.test(s)) return s;
  return `https://${s}`;
}

function pickTelegramImageFileId(message: {
  photo?: Array<{ file_id: string }>;
  document?: { file_id: string; mime_type?: string };
}): string | null {
  if (message.photo?.length) {
    const last = message.photo[message.photo.length - 1];
    return last?.file_id ?? null;
  }
  const d = message.document;
  if (d?.mime_type?.startsWith("image/")) return d.file_id;
  return null;
}

async function patchOrderAndLinkedCustomer(
  orderId: string,
  data: {
    customerLocationUrl?: string;
    customerLandmark?: string;
    alternatePhone?: string | null;
    customerDoorPhotoUrl?: string | null;
    customerDoorPhotoUploadedByName?: string | null;
  },
): Promise<void> {
  const locPatch: Record<string, unknown> = { ...data };
  if (data.customerLocationUrl !== undefined) {
    locPatch.customerLocationSetByCourierAt = null;
    locPatch.customerLocationUploadedByName = null;
  }
  await prisma.order.update({
    where: { id: orderId },
    data: locPatch as import("@prisma/client").Prisma.OrderUpdateInput,
  });
  await syncPhoneProfileFromOrder(orderId);
}

function revalidateOrder(orderId: string): void {
  revalidatePath("/admin/orders/tracking");
  revalidatePath("/admin/orders/pending");
  revalidatePath("/mandoub");
  revalidatePath(`/admin/orders/${orderId}/edit`);
  revalidatePath(`/admin/orders/${orderId}`);
}

export async function formatOrderCustomerEditScreen(orderNumber: number): Promise<{
  text: string;
  keyboard: TelegramInlineKeyboard;
} | null> {
  const on = String(orderNumber);
  const order = await prisma.order.findFirst({
    where: { orderNumber },
    include: { shop: { select: { name: true } }, customer: true },
  });
  if (!order) return null;
  const lines = [
    `<b>زبون الطلب #${order.orderNumber}</b>`,
    `🏪 ${escapeTelegramHtml(order.shop.name)}`,
    `📞 <code>${escapeTelegramHtml(order.customerPhone)}</code>`,
    order.alternatePhone?.trim()
      ? `📞 ثانٍ: <code>${escapeTelegramHtml(order.alternatePhone)}</code>`
      : `📞 ثانٍ: —`,
    order.customerLocationUrl.trim()
      ? `📍 لوكيشن: ${escapeTelegramHtml(order.customerLocationUrl)}`
      : `📍 لوكيشن: —`,
    order.customerLandmark.trim()
      ? `📌 أقرب نقطة: ${escapeTelegramHtml(order.customerLandmark)}`
      : `📌 أقرب نقطة: —`,
    order.customerDoorPhotoUrl ? `🖼️ صورة باب: مرفوعة` : `🖼️ صورة باب: لا`,
  ];
  const kb: TelegramInlineKeyboard["inline_keyboard"] = [
    [
      { text: "📍 اللوكيشن", callback_data: `ol${on}` },
      { text: "📌 أقرب نقطة", callback_data: `ok${on}` },
    ],
    [
      { text: "📞 رقم ثانٍ", callback_data: `oa${on}` },
      { text: "🖼️ صورة الباب", callback_data: `og${on}` },
    ],
    [{ text: "⬅️ تفاصيل الطلب", callback_data: `det${on}` }],
  ];
  return { text: lines.join("\n"), keyboard: { inline_keyboard: kb } };
}

export async function startOrderCustomerFieldEdit(input: {
  telegramUserId: string;
  chatId: string;
  messageId: number;
  orderNumber: number;
  field: "loc" | "alt" | "lmk" | "door";
}): Promise<void> {
  const { telegramUserId, chatId, messageId, orderNumber, field } = input;
  const order = await prisma.order.findFirst({ where: { orderNumber } });
  if (!order) return;
  const on = String(orderNumber);
  const steps = {
    loc: PRIV_ORD_LOC,
    alt: PRIV_ORD_ALT,
    lmk: PRIV_ORD_LMK,
    door: PRIV_ORD_DOOR,
  } as const;
  await upsertPrivOrdSession(
    telegramUserId,
    chatId,
    steps[field],
    JSON.stringify({ orderNumber }),
  );
  const prompts: Record<typeof field, string> = {
    loc: `طلب <b>#${on}</b>: أرسل رابط خرائط أو http(s).`,
    alt: `طلب <b>#${on}</b>: رقم ثانٍ (07…) أو <b>—</b> للمسح.`,
    lmk: `طلب <b>#${on}</b>: أقرب نقطة دالة.`,
    door: `طلب <b>#${on}</b>: أرسل صورة باب الزبون.`,
  };
  const kb: TelegramInlineKeyboard = {
    inline_keyboard: [[{ text: "⬅️ رجوع", callback_data: `oc${on}` }]],
  };
  await editTelegramMessage(chatId, messageId, prompts[field], kb);
}

export async function handlePrivateOrderCustomerMessage(message: {
  message_id: number;
  from?: { id: number };
  chat: { id: number };
  text?: string;
  photo?: Array<{ file_id: string }>;
  document?: { file_id: string; mime_type?: string };
}): Promise<boolean> {
  const fromId = message.from?.id;
  if (fromId == null) return false;
  const telegramUserId = String(fromId);
  const chatId = String(message.chat.id);

  const session = await prisma.telegramBotSession.findUnique({
    where: { telegramUserId },
  });
  if (!session) return false;
  const step = session.step;
  if (![PRIV_ORD_LOC, PRIV_ORD_ALT, PRIV_ORD_LMK, PRIV_ORD_DOOR].includes(step)) {
    return false;
  }

  const p = JSON.parse(session.payload || "{}") as { orderNumber?: number };
  if (p.orderNumber == null || !Number.isFinite(p.orderNumber)) return false;
  const order = await prisma.order.findFirst({
    where: { orderNumber: p.orderNumber },
    select: { id: true, orderNumber: true },
  });
  if (!order) return false;
  const on = String(order.orderNumber);
  const backKb: TelegramInlineKeyboard = {
    inline_keyboard: [[{ text: "⬅️ رجوع", callback_data: `oc${on}` }]],
  };

  if (step === PRIV_ORD_DOOR) {
    const fileId = pickTelegramImageFileId(message);
    if (!fileId) {
      await sendTelegramMessageWithKeyboardToChat(chatId, "أرسل صورة مباشرة.", backKb);
      return true;
    }
    try {
      const buf = await telegramDownloadFileById(fileId);
      const jpeg = await resizeImageBufferForShop(buf);
      const url = await saveOrderImageFromResizedBuffer(jpeg, MAX_ORDER_IMAGE_BYTES);
      await patchOrderAndLinkedCustomer(order.id, {
        customerDoorPhotoUrl: url,
        customerDoorPhotoUploadedByName: "إدارة (تيليجرام)",
      });
      revalidateOrder(order.id);
    } catch (e) {
      console.error("[priv ord door]", e);
      await sendTelegramMessageWithKeyboardToChat(chatId, "تعذّر حفظ الصورة.", backKb);
      return true;
    }
    await clearPrivOrdCustomerSession(telegramUserId);
    const d = await formatOrderCustomerEditScreen(order.orderNumber);
    if (d) {
      await sendTelegramMessageWithKeyboardToChat(chatId, `✅ تم تحديث صورة الباب.\n\n${d.text}`, d.keyboard);
    }
    return true;
  }

  const textIn = message.text?.trim() ?? "";
  if (!textIn) return true;

  if (step === PRIV_ORD_LOC) {
    const url = normalizeUrl(textIn);
    try {
      new URL(url);
    } catch {
      await sendTelegramMessageWithKeyboardToChat(chatId, "رابط غير صالح.", backKb);
      return true;
    }
    await patchOrderAndLinkedCustomer(order.id, { customerLocationUrl: url });
    revalidateOrder(order.id);
    await clearPrivOrdCustomerSession(telegramUserId);
    const d = await formatOrderCustomerEditScreen(order.orderNumber);
    if (d) {
      await sendTelegramMessageWithKeyboardToChat(chatId, `✅ تم تحديث اللوكيشن.\n\n${d.text}`, d.keyboard);
    }
    return true;
  }

  if (step === PRIV_ORD_LMK) {
    await patchOrderAndLinkedCustomer(order.id, { customerLandmark: textIn });
    revalidateOrder(order.id);
    await clearPrivOrdCustomerSession(telegramUserId);
    const d = await formatOrderCustomerEditScreen(order.orderNumber);
    if (d) {
      await sendTelegramMessageWithKeyboardToChat(chatId, `✅ تم تحديث أقرب نقطة.\n\n${d.text}`, d.keyboard);
    }
    return true;
  }

  if (step === PRIV_ORD_ALT) {
    const alt = textIn === "—" || textIn === "-" ? null : normalizeIraqMobileLocal11(textIn);
    if (textIn !== "—" && textIn !== "-" && !alt) {
      await sendTelegramMessageWithKeyboardToChat(chatId, "رقم غير صالح أو — للمسح.", backKb);
      return true;
    }
    await patchOrderAndLinkedCustomer(order.id, { alternatePhone: alt });
    revalidateOrder(order.id);
    await clearPrivOrdCustomerSession(telegramUserId);
    const d = await formatOrderCustomerEditScreen(order.orderNumber);
    if (d) {
      await sendTelegramMessageWithKeyboardToChat(chatId, `✅ تم تحديث الرقم الثانوي.\n\n${d.text}`, d.keyboard);
    }
    return true;
  }

  return false;
}

export function extendedOrderEditMenuKeyboard(orderNumber: number): TelegramInlineKeyboard {
  const on = String(orderNumber);
  return {
    inline_keyboard: [
      [
        { text: "📝 ملخص الطلبية", callback_data: `es${on}` },
        { text: "📋 حالة الطلب", callback_data: `ey${on}` },
      ],
      [
        { text: "📦 نوع الطلب", callback_data: `t${on}` },
        { text: "💵 سعر بدون توصيل", callback_data: `p${on}` },
      ],
      [
        { text: "🚚 سعر التوصيل", callback_data: `ed${on}` },
        { text: "💰 الإجمالي", callback_data: `et${on}` },
      ],
      [
        { text: "📞 رقم الزبون", callback_data: `h${on}` },
        { text: "📞 رقم ثانٍ", callback_data: `ea${on}` },
      ],
      [
        { text: "🗺️ منطقة الزبون", callback_data: `r${on}` },
        { text: "📍 لوكيشن الزبون", callback_data: `eu${on}` },
      ],
      [
        { text: "📌 أقرب نقطة", callback_data: `ek${on}` },
        { text: "🕐 وقت/ملاحظة", callback_data: `en${on}` },
      ],
      [
        { text: "🖼️ صورة الطلبية", callback_data: `ei${on}` },
        { text: "🚪 صورة باب الزبون", callback_data: `ej${on}` },
      ],
      [{ text: "💳 كلّه واصل (دفع مسبق)", callback_data: `zp${on}` }],
      [{ text: "⬅️ تفاصيل الطلب", callback_data: `det${on}` }],
    ],
  };
}
