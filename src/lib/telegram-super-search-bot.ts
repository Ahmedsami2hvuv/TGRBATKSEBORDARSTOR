/**
 * «بحث خارق» في بوت تيليجرام — يعيد استخدام runAdminSuperSearch (طلبات، زبائن، محلات، مندوبون، موظفو محلات، مجهزو شركة، مناطق).
 */
import { runAdminSuperSearch } from "@/lib/admin-super-search";
import { prisma } from "@/lib/prisma";
import {
  escapeTelegramHtml,
  sendTelegramMessageWithKeyboardToChat,
  type TelegramInlineKeyboard,
} from "@/lib/telegram";

export const TELEGRAM_SUPER_SEARCH_STEP = "telegram_super_search";

export async function upsertSuperSearchSession(telegramUserId: string, chatId: string): Promise<void> {
  await prisma.telegramBotSession.upsert({
    where: { telegramUserId },
    create: {
      telegramUserId,
      chatId,
      step: TELEGRAM_SUPER_SEARCH_STEP,
      orderNumber: null,
      payload: "",
    },
    update: {
      chatId,
      step: TELEGRAM_SUPER_SEARCH_STEP,
      orderNumber: null,
      payload: "",
    },
  });
}

export async function clearSuperSearchSession(telegramUserId: string): Promise<void> {
  await prisma.telegramBotSession.updateMany({
    where: { telegramUserId },
    data: { step: "idle", orderNumber: null, payload: "" },
  });
}

function countHits(r: Awaited<ReturnType<typeof runAdminSuperSearch>>): number {
  return (
    r.orders.length +
    r.customers.length +
    r.shops.length +
    r.couriers.length +
    r.employees.length +
    r.companyPreparers.length +
    r.regions.length +
    r.settings.length
  );
}

function formatSuperSearchTelegram(
  q: string,
  r: Awaited<ReturnType<typeof runAdminSuperSearch>>,
): { text: string; keyboard: TelegramInlineKeyboard } {
  const parts: string[] = [];
  parts.push(`<b>نتائج البحث الخارق</b> عن «${escapeTelegramHtml(q)}»\n`);

  if (r.orders.length > 0) {
    parts.push(`\n<b>📦 طلبات (${r.orders.length})</b>`);
    for (const o of r.orders.slice(0, 12)) {
      parts.push(
        `• #${o.orderNumber} — ${escapeTelegramHtml(o.status)} — ${escapeTelegramHtml(o.shopName)} — ${escapeTelegramHtml(o.customerPhone)}`,
      );
    }
    if (r.orders.length > 12) parts.push(`… و${r.orders.length - 12} أخرى`);
  }
  if (r.customers.length > 0) {
    parts.push(`\n<b>👥 زبائن (${r.customers.length})</b>`);
    for (const c of r.customers.slice(0, 10)) {
      parts.push(
        `• ${escapeTelegramHtml(c.name || "—")} — ${escapeTelegramHtml(c.phone)} — ${escapeTelegramHtml(c.shopName)}`,
      );
    }
    if (r.customers.length > 10) parts.push(`… و${r.customers.length - 10} آخرين`);
  }
  if (r.shops.length > 0) {
    parts.push(`\n<b>🏪 محلات (${r.shops.length})</b>`);
    for (const s of r.shops.slice(0, 10)) {
      parts.push(
        `• ${escapeTelegramHtml(s.name)} — ${escapeTelegramHtml(s.regionName)} — ${escapeTelegramHtml(s.phone || "—")}`,
      );
    }
  }
  if (r.couriers.length > 0) {
    parts.push(`\n<b>🏍️ مندوبون (${r.couriers.length})</b>`);
    for (const c of r.couriers.slice(0, 10)) {
      parts.push(`• ${escapeTelegramHtml(c.name)} — ${escapeTelegramHtml(c.phone)}`);
    }
  }
  if (r.employees.length > 0) {
    parts.push(`\n<b>🧑‍💼 موظفو محلات (${r.employees.length})</b>`);
    for (const e of r.employees.slice(0, 10)) {
      parts.push(`• ${escapeTelegramHtml(e.name)} — ${escapeTelegramHtml(e.phone)} — ${escapeTelegramHtml(e.shopName)}`);
    }
  }
  if (r.companyPreparers.length > 0) {
    parts.push(`\n<b>👨‍🍳 مجهزو شركة (${r.companyPreparers.length})</b>`);
    for (const p of r.companyPreparers.slice(0, 10)) {
      parts.push(
        `• ${escapeTelegramHtml(p.name)} — ${escapeTelegramHtml(p.phone || "—")}`,
      );
    }
  }
  if (r.regions.length > 0) {
    parts.push(`\n<b>🗺️ مناطق (${r.regions.length})</b>`);
    for (const reg of r.regions.slice(0, 8)) {
      parts.push(`• ${escapeTelegramHtml(reg.name)} — ${escapeTelegramHtml(reg.deliveryPrice)}`);
    }
  }
  if (r.settings.length > 0) {
    parts.push(`\n<b>⚙️ أقسام لوحة الإدارة (${r.settings.length})</b>`);
    for (const s of r.settings.slice(0, 6)) {
      parts.push(`• ${escapeTelegramHtml(s.label)}`);
    }
  }

  if (countHits(r) === 0) {
    parts.push("\nلا توجد نتائج.");
  }

  let text = parts.join("\n");
  const max = 3900;
  if (text.length > max) {
    text = text.slice(0, max) + "\n\n<i>… تم اقتصار العرض؛ استخدم استعلاماً أدق أو لوحة البحث في الموقع.</i>";
  }

  const rows: TelegramInlineKeyboard["inline_keyboard"] = [];
  const orderBtns: Array<{ text: string; callback_data: string }> = [];
  for (const o of r.orders.slice(0, 6)) {
    orderBtns.push({
      text: `طلب #${o.orderNumber}`.slice(0, 64),
      callback_data: `det${o.orderNumber}`,
    });
  }
  for (let i = 0; i < orderBtns.length; i += 2) {
    rows.push(orderBtns.slice(i, i + 2));
  }
  for (const c of r.customers.slice(0, 6)) {
    const label = `${(c.name || c.phone).slice(0, 28)}`.trim() || "زبون";
    rows.push([{ text: `👤 ${label}`.slice(0, 64), callback_data: `sqc:${c.id}` }]);
  }
  for (const s of r.shops.slice(0, 4)) {
    rows.push([{ text: `🏪 ${s.name}`.slice(0, 64), callback_data: `sh:${s.id}` }]);
  }
  rows.push([
    { text: "🔍 بحث جديد", callback_data: "superq" },
    { text: "🏠 لوحة الإدارة", callback_data: "main" },
  ]);

  return { text, keyboard: { inline_keyboard: rows } };
}

export function formatSuperSearchPromptHtml(): string {
  return (
    `<b>بحث خارق</b>\n\n` +
    `اكتب في الرسالة التالية أيًا مما يلي:\n` +
    `• رقم طلبية (أرقام فقط)\n` +
    `• رقم هاتف أو جزء منه\n` +
    `• زبون، محل، مندوب، أو موظف محل (مجهز)\n` +
    `• منطقة، ملاحظة، نوع طلب، أو أي نص في الطلب\n\n` +
    `بعد النتائج: زر <b>طلب</b> لتعديل الطلب أو زبون الطلب، أو زر <b>زبون</b> للوكيشن وصورة الباب والرقم الثانٍ.\n\n` +
    `للإلغاء: /cancel_search`
  );
}

export async function handleTelegramSuperSearchMessage(message: {
  message_id: number;
  from?: { id: number };
  chat: { id: number };
  text?: string;
}): Promise<boolean> {
  const fromId = message.from?.id;
  if (fromId == null) return false;
  const telegramUserId = String(fromId);
  const chatId = String(message.chat.id);
  const txt = message.text?.trim() ?? "";

  const session = await prisma.telegramBotSession.findUnique({
    where: { telegramUserId },
  });

  if (txt === "/cancel_search") {
    if (session?.step === TELEGRAM_SUPER_SEARCH_STEP) {
      await clearSuperSearchSession(telegramUserId);
      await sendTelegramMessageWithKeyboardToChat(
        chatId,
        "تم إلغاء البحث.",
        { inline_keyboard: [[{ text: "🏠 لوحة الإدارة", callback_data: "main" }]] },
      );
      return true;
    }
    return false;
  }

  if (session?.step !== TELEGRAM_SUPER_SEARCH_STEP) {
    return false;
  }

  if (!txt) {
    await sendTelegramMessageWithKeyboardToChat(
      chatId,
      "أرسل نصاً للبحث أو /cancel_search",
      { inline_keyboard: [[{ text: "❌ إلغاء", callback_data: "superx" }]] },
    );
    return true;
  }

  const res = await runAdminSuperSearch({
    q: txt,
    scope: "all",
    days: null,
    status: "",
    courierId: "",
    minAmount: null,
    maxAmount: null,
  });

  await clearSuperSearchSession(telegramUserId);
  const { text, keyboard } = formatSuperSearchTelegram(txt, res);
  await sendTelegramMessageWithKeyboardToChat(chatId, text, keyboard);
  return true;
}
