/**
 * Telegram Bot API — إرسال للمجموعة، أزرار، واستدعاءات عامة.
 * المتغيرات: TELEGRAM_BOT_TOKEN، TELEGRAM_GROUP_CHAT_ID، واختياري TELEGRAM_WEBHOOK_SECRET و TELEGRAM_ADMIN_USER_ID / TELEGRAM_ADMIN_USER_IDS (لوحة الإدارة في الخاص).
 */
import { getPublicAppUrl } from "@/lib/app-url";

// --- الأنواع المضافة لحل مشكلة البناء ---
export type TelegramMessage = {
  message_id: number;
  from?: { id: number; first_name?: string };
  chat: { id: number };
  text?: string;
  photo?: Array<{ file_id: string; file_size?: number; width?: number; height?: number }>;
  document?: { file_id: string; mime_type?: string; file_name?: string };
  reply_to_message?: { message_id: number };
  location?: { latitude: number; longitude: number };
};

export type TelegramCallbackQuery = {
  id: string;
  from: { id: number; first_name?: string };
  message: TelegramMessage;
  data?: string;
};

export type TgUpdate = {
  update_id: number;
  message?: TelegramMessage;
  callback_query?: TelegramCallbackQuery;
};
// ----------------------------------------

export function normalizeTelegramGroupChatId(raw: string): string {
  const t = raw.trim();
  if (!t) return t;
  if (t.startsWith("-")) return t;
  if (/^\d+$/.test(t)) {
    return `-100${t}`;
  }
  return t;
}

export function escapeTelegramHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export type TelegramInlineKeyboard = {
  inline_keyboard: Array<Array<{ text: string; callback_data?: string; url?: string }>>;
};

async function telegramRaw(method: string, body: Record<string, unknown>): Promise<{
  ok: boolean;
  description?: string;
  result?: unknown;
}> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    return { ok: false, description: "TELEGRAM_BOT_TOKEN غير مضبوط" };
  }
  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await res.json()) as { ok?: boolean; description?: string; result?: unknown };
  return {
    ok: data.ok === true,
    description: data.description,
    result: data.result,
  };
}

let lastWebhookEnsureAt = 0;
const WEBHOOK_ENSURE_EVERY_MS = 5 * 60 * 1000;

async function ensureTelegramWebhookConfigured(): Promise<void> {
  const now = Date.now();
  if (now - lastWebhookEnsureAt < WEBHOOK_ENSURE_EVERY_MS) return;
  lastWebhookEnsureAt = now;

  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  if (!token) return;
  const base = getPublicAppUrl().trim();
  if (!base || base.startsWith("http://localhost")) return;
  const desiredUrl = `${base.replace(/\/+$/, "")}/api/telegram/webhook`;
  const desiredSecret = process.env.TELEGRAM_WEBHOOK_SECRET?.trim() || "";

  const info = await telegramRaw("getWebhookInfo", {});
  const current = (info.result ?? {}) as {
    url?: string;
    has_custom_certificate?: boolean;
    pending_update_count?: number;
  };
  const sameUrl = (current.url ?? "").trim() === desiredUrl;
  if (sameUrl) return;

  const body: Record<string, unknown> = {
    url: desiredUrl,
    allowed_updates: ["message", "callback_query"],
    drop_pending_updates: false,
  };
  if (desiredSecret) body.secret_token = desiredSecret;
  await telegramRaw("setWebhook", body);
}

export async function sendTelegramMessage(text: string): Promise<{
  ok: boolean;
  error?: string;
}> {
  await ensureTelegramWebhookConfigured().catch(() => {});
  const chatIdRaw = process.env.TELEGRAM_GROUP_CHAT_ID;
  if (!chatIdRaw) {
    return { ok: false, error: "TELEGRAM_GROUP_CHAT_ID غير مضبوط" };
  }
  const chatId = normalizeTelegramGroupChatId(chatIdRaw);
  const data = await telegramRaw("sendMessage", {
    chat_id: chatId,
    text,
    parse_mode: "HTML",
    disable_web_page_preview: true,
  });
  if (!data.ok) {
    return { ok: false, error: data.description ?? "sendMessage failed" };
  }
  return { ok: true };
}

export async function sendTelegramMessageWithKeyboardToChat(
  chatId: string,
  text: string,
  replyMarkup: TelegramInlineKeyboard,
): Promise<{ ok: boolean; error?: string; messageId?: number }> {
  await ensureTelegramWebhookConfigured().catch(() => {});
  const data = await telegramRaw("sendMessage", {
    chat_id: chatId,
    text,
    parse_mode: "HTML",
    disable_web_page_preview: true,
    reply_markup: replyMarkup,
  });
  if (!data.ok) {
    return { ok: false, error: (data as { description?: string }).description };
  }
  const result = data.result as { message_id?: number } | undefined;
  return { ok: true, messageId: result?.message_id };
}

export async function sendTelegramPhotoToChat(
  chatId: string,
  photoUrl: string,
  caption?: string,
  replyMarkup?: TelegramInlineKeyboard,
): Promise<{ ok: boolean; error?: string; messageId?: number }> {
  await ensureTelegramWebhookConfigured().catch(() => {});
  const body: Record<string, unknown> = {
    chat_id: chatId,
    photo: photoUrl,
    parse_mode: "HTML",
    caption: caption ?? "",
  };
  if (replyMarkup) body.reply_markup = replyMarkup;

  const data = await telegramRaw("sendPhoto", body);
  if (!data.ok) {
    return { ok: false, error: (data as { description?: string }).description };
  }
  const result = data.result as { message_id?: number } | undefined;
  return { ok: true, messageId: result?.message_id };
}

export async function sendTelegramMessageWithKeyboard(
  text: string,
  replyMarkup: TelegramInlineKeyboard,
): Promise<{ ok: boolean; error?: string; messageId?: number }> {
  const chatIdRaw = process.env.TELEGRAM_GROUP_CHAT_ID;
  if (!chatIdRaw) {
    return { ok: false, error: "TELEGRAM_GROUP_CHAT_ID غير مضبوط" };
  }
  const chatId = normalizeTelegramGroupChatId(chatIdRaw);
  return sendTelegramMessageWithKeyboardToChat(chatId, text, replyMarkup);
}

export async function editTelegramMessage(
  chatId: string,
  messageId: number,
  text: string,
  replyMarkup?: TelegramInlineKeyboard,
): Promise<{ ok: boolean; error?: string }> {
  const body: Record<string, unknown> = {
    chat_id: chatId,
    message_id: messageId,
    text,
    parse_mode: "HTML",
    disable_web_page_preview: true,
  };
  if (replyMarkup) {
    body.reply_markup = replyMarkup;
  }
  const data = await telegramRaw("editMessageText", body);
  if (!data.ok) {
    return { ok: false, error: (data as { description?: string }).description };
  }
  return { ok: true };
}

/** تغيير أزرار الرسالة فقط — عندما يبقى النص كما هو (بدون خطأ «message is not modified»). */
export async function editTelegramMessageReplyMarkup(
  chatId: string,
  messageId: number,
  replyMarkup: TelegramInlineKeyboard,
): Promise<{ ok: boolean; error?: string }> {
  const data = await telegramRaw("editMessageReplyMarkup", {
    chat_id: chatId,
    message_id: messageId,
    reply_markup: replyMarkup,
  });
  if (!data.ok) {
    return { ok: false, error: (data as { description?: string }).description };
  }
  return { ok: true };
}

/** حذف رسالة (مثلاً قبل إرسال رسالة جديدة بدل التعديل — يتجنب فشل edit على رسائل صورة). */
export async function deleteTelegramMessage(
  chatId: string,
  messageId: number,
): Promise<{ ok: boolean; error?: string }> {
  const data = await telegramRaw("deleteMessage", {
    chat_id: chatId,
    message_id: messageId,
  });
  if (!data.ok) {
    return { ok: false, error: (data as { description?: string }).description };
  }
  return { ok: true };
}

/** رسالة نصية HTML في محادثة خاصة (تنبيهات أخطاء بدون أزرار). */
export async function sendTelegramHtmlToChat(
  chatId: string,
  text: string,
): Promise<{ ok: boolean; error?: string }> {
  await ensureTelegramWebhookConfigured().catch(() => {});
  const data = await telegramRaw("sendMessage", {
    chat_id: chatId,
    text,
    parse_mode: "HTML",
    disable_web_page_preview: true,
  });
  if (!data.ok) {
    return { ok: false, error: (data as { description?: string }).description };
  }
  return { ok: true };
}

export async function answerCallbackQuery(
  callbackQueryId: string,
  text?: string,
  showAlert?: boolean,
): Promise<void> {
  await telegramRaw("answerCallbackQuery", {
    callback_query_id: callbackQueryId,
    text: text?.slice(0, 200),
    show_alert: showAlert ?? false,
  });
}

/** رسالة في محادثة معيّنة مع طلب رد (للبحث عن المنطقة وغيره من المجموعة). */
export async function sendTelegramMessageWithForceReply(
  chatId: string,
  text: string,
  options?: { placeholder?: string },
): Promise<{ ok: boolean; messageId?: number; error?: string }> {
  const data = await telegramRaw("sendMessage", {
    chat_id: chatId,
    text,
    parse_mode: "HTML",
    disable_web_page_preview: true,
    reply_markup: {
      force_reply: true,
      input_field_placeholder: options?.placeholder?.slice(0, 64),
    },
  });
  if (!data.ok) {
    return { ok: false, error: (data as { description?: string }).description };
  }
  const result = data.result as { message_id?: number } | undefined;
  return { ok: true, messageId: result?.message_id };
}

/** إزالة لوحة المفاتيح (بعد طلب موقع مثلاً). */
export async function sendTelegramMessageRemoveKeyboard(
  chatId: string,
  text: string,
): Promise<{ ok: boolean; messageId?: number; error?: string }> {
  const data = await telegramRaw("sendMessage", {
    chat_id: chatId,
    text,
    parse_mode: "HTML",
    disable_web_page_preview: true,
    reply_markup: { remove_keyboard: true },
  });
  if (!data.ok) {
    return { ok: false, error: (data as { description?: string }).description };
  }
  const result = data.result as { message_id?: number } | undefined;
  return { ok: true, messageId: result?.message_id };
}

/** لوحة مفاتيح عادية بطلب موقع GPS (لا تدعمها الأزرار المضمّنة). */
export async function sendTelegramLocationRequestKeyboard(
  chatId: string,
  text: string,
): Promise<{ ok: boolean; messageId?: number; error?: string }> {
  const data = await telegramRaw("sendMessage", {
    chat_id: chatId,
    text,
    parse_mode: "HTML",
    disable_web_page_preview: true,
    reply_markup: {
      keyboard: [[{ text: "📍 إرسال موقعي الآن", request_location: true }]],
      resize_keyboard: true,
      one_time_keyboard: true,
    },
  });
  if (!data.ok) {
    return { ok: false, error: (data as { description?: string }).description };
  }
  const result = data.result as { message_id?: number } | undefined;
  return { ok: true, messageId: result?.message_id };
}

/** تنزيل ملف من خوادم تيليجرام (صورة مستلمة من المستخدم). */
export async function telegramDownloadFileById(fileId: string): Promise<Buffer> {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  if (!token) {
    throw new Error("TELEGRAM_BOT_TOKEN غير مضبوط");
  }
  const data = await telegramRaw("getFile", { file_id: fileId });
  if (!data.ok) {
    throw new Error(data.description ?? "getFile failed");
  }
  const filePath = (data.result as { file_path?: string } | undefined)?.file_path;
  if (!filePath) {
    throw new Error("no file_path");
  }
  const url = `https://api.telegram.org/file/bot${token}/${filePath}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`telegram file download ${res.status}`);
  }
  return Buffer.from(await res.arrayBuffer());
}

/** يتحقق من سرّ الـ webhook (يُضاف عند setWebhook كـ secret_token). */
export function verifyTelegramWebhookSecret(headers: Headers): boolean {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET?.trim();
  if (!secret) return true;
  const got = headers.get("x-telegram-bot-api-secret-token")?.trim();
  const ok = got === secret;
  if (!ok) {
    console.warn(
      "[telegram webhook] TELEGRAM_WEBHOOK_SECRET is set but the request header x-telegram-bot-api-secret-token is missing or wrong. Re-run setWebhook with the same secret_token, or remove TELEGRAM_WEBHOOK_SECRET.",
    );
  }
  return ok;
}