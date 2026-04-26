/**
 * تعديل بيانات زبون (جدول Customer) من البحث الخارق في الخاص — لوكيشن، أقرب نقطة، رقم ثانٍ، صورة باب.
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
import { normalizeIraqMobileLocal11 } from "@/lib/whatsapp";

export const PRIV_CUST_LOC = "priv_cust_loc";
export const PRIV_CUST_ALT = "priv_cust_alt";
export const PRIV_CUST_LMK = "priv_cust_lmk";
export const PRIV_CUST_DOOR = "priv_cust_door";

async function upsertPrivSession(
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

export async function clearPrivCustomerSession(telegramUserId: string): Promise<void> {
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

export async function formatSuperSearchCustomerDetail(customerId: string): Promise<{
  text: string;
  keyboard: TelegramInlineKeyboard;
} | null> {
  const cust = await prisma.customer.findUnique({
    where: { id: customerId },
    include: {
      shop: { include: { region: true } },
      customerRegion: true,
    },
  });
  if (!cust) return null;
  const regionName = cust.customerRegion?.name ?? cust.shop.region.name;
  const lines = [
    `<b>زبون (بحث خارق)</b>`,
    `<b>${escapeTelegramHtml(cust.name?.trim() || "—")}</b>`,
    `🏪 ${escapeTelegramHtml(cust.shop.name)}`,
    `🗺️ ${escapeTelegramHtml(regionName)}`,
    `📞 <code>${escapeTelegramHtml(cust.phone)}</code>`,
    cust.alternatePhone
      ? `📞 ثانٍ: <code>${escapeTelegramHtml(cust.alternatePhone)}</code>`
      : `📞 ثانٍ: —`,
    cust.customerLocationUrl.trim()
      ? `📍 لوكيشن: ${escapeTelegramHtml(cust.customerLocationUrl)}`
      : `📍 لوكيشن: —`,
    cust.customerLandmark.trim()
      ? `📌 أقرب نقطة: ${escapeTelegramHtml(cust.customerLandmark)}`
      : `📌 أقرب نقطة: —`,
    cust.customerDoorPhotoUrl ? `🖼️ صورة باب: مرفوعة` : `🖼️ صورة باب: لا`,
  ];
  const kb: TelegramInlineKeyboard["inline_keyboard"] = [
    [
      { text: "📍 تعديل اللوكيشن", callback_data: `cul:${cust.id}` },
      { text: "📌 أقرب نقطة", callback_data: `cuk:${cust.id}` },
    ],
    [
      { text: "📞 رقم ثانٍ", callback_data: `cua:${cust.id}` },
      { text: "🖼️ صورة الباب", callback_data: `cud:${cust.id}` },
    ],
    [
      { text: "🔍 بحث جديد", callback_data: "superq" },
      { text: "🏠 الرئيسية", callback_data: "main" },
    ],
  ];
  return { text: lines.join("\n"), keyboard: { inline_keyboard: kb } };
}

export async function syncCustomerToOpenOrders(
  customerId: string,
  patch: {
    customerLocationUrl?: string;
    customerLandmark?: string;
    alternatePhone?: string | null;
    customerDoorPhotoUrl?: string | null;
  },
): Promise<void> {
  const cust = await prisma.customer.findUnique({
    where: { id: customerId },
    select: { id: true, phone: true, shopId: true },
  });
  if (!cust) return;
  const data: Record<string, unknown> = {};
  if (patch.customerLocationUrl !== undefined) {
    data.customerLocationUrl = patch.customerLocationUrl;
    data.customerLocationSetByCourierAt = null;
    data.customerLocationUploadedByName = null;
  }
  if (patch.customerLandmark !== undefined) data.customerLandmark = patch.customerLandmark;
  if (patch.alternatePhone !== undefined) data.alternatePhone = patch.alternatePhone;
  if (patch.customerDoorPhotoUrl !== undefined) {
    data.customerDoorPhotoUrl = patch.customerDoorPhotoUrl;
    data.customerDoorPhotoUploadedByName = "إدارة (تيليجرام)";
  }
  if (Object.keys(data).length === 0) return;
  await prisma.order.updateMany({
    where: {
      shopId: cust.shopId,
      customerPhone: cust.phone,
      status: { in: ["pending", "assigned", "delivering"] },
    },
    data: data as import("@prisma/client").Prisma.OrderUpdateManyMutationInput,
  });
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

export async function handlePrivateCustomerEditMessage(message: {
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
  if (![PRIV_CUST_LOC, PRIV_CUST_ALT, PRIV_CUST_LMK, PRIV_CUST_DOOR].includes(step)) {
    return false;
  }

  const p = JSON.parse(session.payload || "{}") as { customerId?: string };
  if (!p.customerId) return false;

  if (step === PRIV_CUST_DOOR) {
    const fileId = pickTelegramImageFileId(message);
    if (!fileId) {
      await sendTelegramMessageWithKeyboardToChat(
        chatId,
        "أرسل صورة (صورة مباشرة) لباب الزبون.",
        { inline_keyboard: [[{ text: "⬅️ رجوع", callback_data: `sqc:${p.customerId}` }]] },
      );
      return true;
    }
    try {
      const buf = await telegramDownloadFileById(fileId);
      const jpeg = await resizeImageBufferForShop(buf);
      const url = await saveOrderImageFromResizedBuffer(jpeg, MAX_ORDER_IMAGE_BYTES);
      await prisma.customer.update({
        where: { id: p.customerId },
        data: { customerDoorPhotoUrl: url },
      });
      await syncCustomerToOpenOrders(p.customerId, { customerDoorPhotoUrl: url });
      revalidatePath("/admin/shops");
      revalidatePath("/admin/customers");
    } catch (e) {
      console.error("[priv cust door]", e);
      await sendTelegramMessageWithKeyboardToChat(
        chatId,
        "تعذّر حفظ الصورة. جرّب أصغر.",
        { inline_keyboard: [[{ text: "⬅️ رجوع", callback_data: `sqc:${p.customerId}` }]] },
      );
      return true;
    }
    await clearPrivCustomerSession(telegramUserId);
    const d = await formatSuperSearchCustomerDetail(p.customerId);
    if (d) {
      await sendTelegramMessageWithKeyboardToChat(chatId, `✅ تم تحديث صورة الباب.\n\n${d.text}`, d.keyboard);
    }
    return true;
  }

  const textIn = message.text?.trim() ?? "";
  if (!textIn) return true;

  if (step === PRIV_CUST_LOC) {
    const url = normalizeUrl(textIn);
    try {
      new URL(url);
    } catch {
      await sendTelegramMessageWithKeyboardToChat(
        chatId,
        "رابط غير صالح. أرسل http(s)…",
        { inline_keyboard: [[{ text: "⬅️ رجوع", callback_data: `sqc:${p.customerId}` }]] },
      );
      return true;
    }
    await prisma.customer.update({
      where: { id: p.customerId },
      data: { customerLocationUrl: url },
    });
    await syncCustomerToOpenOrders(p.customerId, { customerLocationUrl: url });
    revalidatePath("/admin/shops");
    revalidatePath("/admin/customers");
    await clearPrivCustomerSession(telegramUserId);
    const d = await formatSuperSearchCustomerDetail(p.customerId);
    if (d) {
      await sendTelegramMessageWithKeyboardToChat(chatId, `✅ تم تحديث اللوكيشن.\n\n${d.text}`, d.keyboard);
    }
    return true;
  }

  if (step === PRIV_CUST_LMK) {
    await prisma.customer.update({
      where: { id: p.customerId },
      data: { customerLandmark: textIn },
    });
    await syncCustomerToOpenOrders(p.customerId, { customerLandmark: textIn });
    revalidatePath("/admin/shops");
    revalidatePath("/admin/customers");
    await clearPrivCustomerSession(telegramUserId);
    const d = await formatSuperSearchCustomerDetail(p.customerId);
    if (d) {
      await sendTelegramMessageWithKeyboardToChat(chatId, `✅ تم تحديث أقرب نقطة.\n\n${d.text}`, d.keyboard);
    }
    return true;
  }

  if (step === PRIV_CUST_ALT) {
    const alt = textIn === "—" || textIn === "-" ? null : normalizeIraqMobileLocal11(textIn);
    if (textIn !== "—" && textIn !== "-" && !alt) {
      await sendTelegramMessageWithKeyboardToChat(
        chatId,
        "رقم غير صالح أو اكتب — لمسح الرقم الثانوي.",
        { inline_keyboard: [[{ text: "⬅️ رجوع", callback_data: `sqc:${p.customerId}` }]] },
      );
      return true;
    }
    await prisma.customer.update({
      where: { id: p.customerId },
      data: { alternatePhone: alt },
    });
    await syncCustomerToOpenOrders(p.customerId, { alternatePhone: alt });
    revalidatePath("/admin/shops");
    revalidatePath("/admin/customers");
    await clearPrivCustomerSession(telegramUserId);
    const d = await formatSuperSearchCustomerDetail(p.customerId);
    if (d) {
      await sendTelegramMessageWithKeyboardToChat(chatId, `✅ تم تحديث الرقم الثانوي.\n\n${d.text}`, d.keyboard);
    }
    return true;
  }

  return false;
}

export async function startSuperSearchCustomerFieldEdit(input: {
  telegramUserId: string;
  chatId: string;
  messageId: number;
  customerId: string;
  field: "loc" | "alt" | "lmk" | "door";
}): Promise<void> {
  const { telegramUserId, chatId, messageId, customerId, field } = input;
  const cust = await prisma.customer.findUnique({ where: { id: customerId } });
  if (!cust) return;

  const steps = {
    loc: PRIV_CUST_LOC,
    alt: PRIV_CUST_ALT,
    lmk: PRIV_CUST_LMK,
    door: PRIV_CUST_DOOR,
  } as const;
  const step = steps[field];
  await upsertPrivSession(telegramUserId, chatId, step, JSON.stringify({ customerId }));

  const prompts: Record<typeof field, string> = {
    loc: `أرسل <b>رابط خرائط</b> أو نصاً يبدأ بـ http(s) للوكيشن.\n\nللإلغاء: اضغط رجوع.`,
    alt: `أرسل <b>رقم الهاتف الثانوي</b> العراقي (07…) أو اكتب <b>—</b> لمسحه.\n\nللإلغاء: رجوع.`,
    lmk: `اكتب <b>أقرب نقطة دالة</b>.\n\nللإلغاء: رجوع.`,
    door: `أرسل <b>صورة باب الزبون</b> كصورة.\n\nللإلغاء: رجوع.`,
  };

  const kb: TelegramInlineKeyboard = {
    inline_keyboard: [[{ text: "⬅️ رجوع", callback_data: `sqc:${customerId}` }]],
  };
  await editTelegramMessage(chatId, messageId, prompts[field], kb);
}
