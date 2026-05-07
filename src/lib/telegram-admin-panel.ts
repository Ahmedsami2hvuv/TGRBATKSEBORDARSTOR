/**
 * لوحة إدارية في المحادثة الخاصة مع البوت — TELEGRAM_ADMIN_USER_IDS أو TELEGRAM_ADMIN_USER_ID.
 * التنقّل والبيانات عبر callbacks (بدون روابط متصفح).
 */
import { ADMIN_TILES, isTileEnabled } from "@/lib/admin-nav";
import { getPublicAppUrl } from "@/lib/app-url";
import { formatDinarAsAlf } from "@/lib/money-alf";
import { prisma } from "@/lib/prisma";
import {
  answerCallbackQuery,
  editTelegramMessage,
  escapeTelegramHtml,
  sendTelegramMessageWithKeyboardToChat,
  type TelegramInlineKeyboard,
} from "@/lib/telegram";
import { renderShopsTelegramHub } from "@/lib/telegram-shop";
import {
  clearPrivCustomerSession,
  formatSuperSearchCustomerDetail,
  startSuperSearchCustomerFieldEdit,
} from "@/lib/telegram-private-customer-edit";
import {
  clearSuperSearchSession,
  formatSuperSearchPromptHtml,
  upsertSuperSearchSession,
} from "@/lib/telegram-super-search-bot";
import { buildTelegramOrderKeyboard, formatNewOrderTelegramHtml } from "@/lib/telegram-notify";

export const TELEGRAM_ADMIN_ORDERS_PAGE_SIZE = 8;

export function getTelegramAdminUserIdSet(): Set<string> {
  const ids = new Set<string>();
  const plural = process.env.TELEGRAM_ADMIN_USER_IDS?.trim();
  if (plural) {
    for (const s of plural.split(/[\s,]+/).map((x) => x.trim()).filter(Boolean)) {
      ids.add(s);
    }
  }
  const single = process.env.TELEGRAM_ADMIN_USER_ID?.trim();
  if (single) {
    ids.add(single);
  }
  return ids;
}

export function isTelegramAdminUser(telegramUserId: number | undefined): boolean {
  if (telegramUserId == null) return false;
  const set = getTelegramAdminUserIdSet();
  if (set.size === 0) return false;
  return set.has(String(telegramUserId));
}

export function isTelegramPrivateChat(chat: { id: number }, fromUserId: number): boolean {
  return chat.id === fromUserId;
}

export type ParsedTelegramAdminCallback =
  | { kind: "main" }
  | { kind: "orders"; page: number }
  | { kind: "detail"; orderNumber: number }
  | { kind: "section"; slug: string }
  | { kind: "pending"; page: number }
  | { kind: "cancelled"; page: number }
  | { kind: "super_search_start" }
  | { kind: "super_search_cancel" }
  | { kind: "super_search_customer"; customerId: string }
  | { kind: "cust_field_loc"; customerId: string }
  | { kind: "cust_field_alt"; customerId: string }
  | { kind: "cust_field_lmk"; customerId: string }
  | { kind: "cust_field_door"; customerId: string };

export function parseTelegramAdminCallback(raw: string): ParsedTelegramAdminCallback | null {
  const t = raw.trim();
  if (t === "main") return { kind: "main" };
  if (t === "superq") return { kind: "super_search_start" };
  if (t === "superx") return { kind: "super_search_cancel" };
  const sec = /^s:(.+)$/.exec(t);
  if (sec?.[1]) {
    const slug = sec[1].trim();
    if (slug.length > 0 && slug.length <= 48) return { kind: "section", slug };
  }
  let m = /^ord(\d+)$/.exec(t);
  if (m) {
    const page = Number(m[1]);
    if (!Number.isFinite(page) || page < 0) return null;
    return { kind: "orders", page };
  }
  m = /^pend(\d+)$/.exec(t);
  if (m) {
    const page = Number(m[1]);
    if (!Number.isFinite(page) || page < 0) return null;
    return { kind: "pending", page };
  }
  m = /^canc(\d+)$/.exec(t);
  if (m) {
    const page = Number(m[1]);
    if (!Number.isFinite(page) || page < 0) return null;
    return { kind: "cancelled", page };
  }
  m = /^det(\d+)$/.exec(t);
  if (m) {
    const orderNumber = Number(m[1]);
    if (!Number.isFinite(orderNumber) || orderNumber < 1) return null;
    return { kind: "detail", orderNumber };
  }
  m = /^sqc:([a-z0-9]+)$/.exec(t);
  if (m?.[1]) return { kind: "super_search_customer", customerId: m[1] };
  m = /^cul:([a-z0-9]+)$/.exec(t);
  if (m?.[1]) return { kind: "cust_field_loc", customerId: m[1] };
  m = /^cua:([a-z0-9]+)$/.exec(t);
  if (m?.[1]) return { kind: "cust_field_alt", customerId: m[1] };
  m = /^cuk:([a-z0-9]+)$/.exec(t);
  if (m?.[1]) return { kind: "cust_field_lmk", customerId: m[1] };
  m = /^cud:([a-z0-9]+)$/.exec(t);
  if (m?.[1]) return { kind: "cust_field_door", customerId: m[1] };
  return null;
}

function adminBaseUrl(): string {
  return getPublicAppUrl().replace(/\/+$/, "");
}

function adminMainKeyboard(): TelegramInlineKeyboard {
  const rows: TelegramInlineKeyboard["inline_keyboard"] = [];
  rows.push([{ text: "🔍 بحث خارق (كل شيء)", callback_data: "superq" }]);
  rows.push([{ text: "📥 الطلبات المعلّقة", callback_data: "pend0" }]);
  const tiles = ADMIN_TILES.filter((t) => isTileEnabled(t.slug));
  for (let i = 0; i < tiles.length; i += 2) {
    const a = tiles[i];
    const b = tiles[i + 1];
    const row: Array<{ text: string; callback_data: string }> = [
      { text: `${a.emoji} ${a.label}`.slice(0, 64), callback_data: `s:${a.slug}` },
    ];
    if (b) {
      row.push({ text: `${b.emoji} ${b.label}`.slice(0, 64), callback_data: `s:${b.slug}` });
    }
    rows.push(row);
  }
  rows.push([{ text: "📋 أحدث الطلبات (كل الحالات)", callback_data: "ord0" }]);
  rows.push([{ text: "🏠 تحديث القائمة الرئيسية", callback_data: "main" }]);
  return { inline_keyboard: rows };
}

export function formatAdminPanelWelcomeHtml(): string {
  const base = escapeTelegramHtml(adminBaseUrl());
  return (
    `<b>لوحة الإدارة</b>\n` +
    `عنوان الخادم: ${base}\n\n` +
    `«بحث خارق» يبحث في الطلبات والزبائن والمحلات والمندوبين وموظفي المحلات ومجهزي الشركة والمناطق.\n` +
    `اختر قسماً للعرض أو إدارة الطلبات بالأزرار.\n` +
    `تعديل الحقول بـ«رد على رسالة» يبقى من مجموعة الإشعارات كما سابقاً.`
  );
}

async function countOrdersTotal(): Promise<number> {
  return prisma.order.count();
}

async function countOrdersByStatus(status: string): Promise<number> {
  return prisma.order.count({ where: { status } });
}

export async function loadOrdersPageForAdmin(
  page: number,
  pageSize: number,
): Promise<
  Array<{
    id: string;
    orderNumber: number;
    status: string;
    shopName: string;
    customerPhone: string;
    totalAmount: import("@prisma/client/runtime/library").Decimal | null;
  }>
> {
  const skip = page * pageSize;
  const rows = await prisma.order.findMany({
    orderBy: { createdAt: "desc" },
    skip,
    take: pageSize,
    select: {
      id: true,
      orderNumber: true,
      status: true,
      customerPhone: true,
      totalAmount: true,
      shop: { select: { name: true } },
    },
  });
  return rows.map((r) => ({
    id: r.id,
    orderNumber: r.orderNumber,
    status: r.status,
    shopName: r.shop.name,
    customerPhone: r.customerPhone,
    totalAmount: r.totalAmount,
  }));
}

async function loadOrdersPageByStatus(
  status: string,
  page: number,
  pageSize: number,
): Promise<
  Array<{
    id: string;
    orderNumber: number;
    status: string;
    shopName: string;
    customerPhone: string;
    totalAmount: import("@prisma/client/runtime/library").Decimal | null;
  }>
> {
  const skip = page * pageSize;
  const rows = await prisma.order.findMany({
    where: { status },
    orderBy: { createdAt: "desc" },
    skip,
    take: pageSize,
    select: {
      id: true,
      orderNumber: true,
      status: true,
      customerPhone: true,
      totalAmount: true,
      shop: { select: { name: true } },
    },
  });
  return rows.map((r) => ({
    id: r.id,
    orderNumber: r.orderNumber,
    status: r.status,
    shopName: r.shop.name,
    customerPhone: r.customerPhone,
    totalAmount: r.totalAmount,
  }));
}

function formatOrdersListMessage(
  title: string,
  orders: Awaited<ReturnType<typeof loadOrdersPageForAdmin>>,
  page: number,
  pageSize: number,
  total: number,
): string {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const header = `<b>${escapeTelegramHtml(title)}</b> — صفحة ${page + 1} / ${totalPages} (إجمالي ${total})\n\n`;
  if (orders.length === 0) {
    return header + "لا توجد بيانات.";
  }
  const lines = orders.map((o) => {
    const alf = formatDinarAsAlf(o.totalAmount);
    return (
      `🔢 <b>#${o.orderNumber}</b> — ${escapeTelegramHtml(o.status)} — ` +
      `${escapeTelegramHtml(o.shopName)}\n` +
      `   📞 ${escapeTelegramHtml(o.customerPhone)} · 💰 ${escapeTelegramHtml(alf)} `
    );
  });
  return header + lines.join("\n\n");
}

function ordersListKeyboard(
  page: number,
  pageSize: number,
  total: number,
  orders: Awaited<ReturnType<typeof loadOrdersPageForAdmin>>,
  navPrefix: "ord" | "pend" | "canc",
): TelegramInlineKeyboard {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const nav: Array<{ text: string; callback_data: string }> = [];
  if (page > 0) {
    nav.push({ text: "⬅️ السابق", callback_data: `${navPrefix}${page - 1}` });
  }
  nav.push({ text: "🏠 لوحة الإدارة", callback_data: "main" });
  if (page < totalPages - 1) {
    nav.push({ text: "التالي ➡️", callback_data: `${navPrefix}${page + 1}` });
  }
  const rows: TelegramInlineKeyboard["inline_keyboard"] = [nav];
  for (const o of orders) {
    rows.push([
      {
        text: `📦 طلب #${o.orderNumber}`.slice(0, 64),
        callback_data: `det${o.orderNumber}`,
      },
    ]);
  }
  return { inline_keyboard: rows };
}

async function loadOrderForAdminDetail(orderNumber: number) {
  return prisma.order.findFirst({
    where: { orderNumber },
    include: {
      shop: { include: { region: true } },
      customer: true,
      customerRegion: true,
      secondCustomerRegion: true,
    },
  });
}

function orderDetailKeyboard(orderNumber: number, orderId: string): TelegramInlineKeyboard {
  const on = String(orderNumber);
  const main = buildTelegramOrderKeyboard(orderNumber, orderId, { showBrowserLinks: false });
  return {
    inline_keyboard: [
      [
        { text: "👤 تعديل زبون الطلب", callback_data: `oc${on}` },
        { text: "📝 تعديل الطلب (كل الحقول)", callback_data: `em${on}` },
      ],
      ...main.inline_keyboard,
      [
        { text: "⬅️ أحدث الطلبات", callback_data: "ord0" },
        { text: "🏠 الرئيسية", callback_data: "main" },
      ],
    ],
  };
}

function backOnlyKeyboard(): TelegramInlineKeyboard {
  return { inline_keyboard: [[{ text: "🏠 لوحة الإدارة", callback_data: "main" }]] };
}

async function renderAdminSection(slug: string): Promise<{ text: string; keyboard: TelegramInlineKeyboard }> {
  switch (slug) {
    case "new-orders": {
      const total = await countOrdersByStatus("pending");
      const orders = await loadOrdersPageByStatus("pending", 0, TELEGRAM_ADMIN_ORDERS_PAGE_SIZE);
      const text = formatOrdersListMessage("الطلبات المعلّقة", orders, 0, TELEGRAM_ADMIN_ORDERS_PAGE_SIZE, total);
      const kb = ordersListKeyboard(0, TELEGRAM_ADMIN_ORDERS_PAGE_SIZE, total, orders, "pend");
      return { text, keyboard: kb };
    }
    case "order-tracking": {
      const total = await countOrdersTotal();
      const orders = await loadOrdersPageForAdmin(0, TELEGRAM_ADMIN_ORDERS_PAGE_SIZE);
      const text = formatOrdersListMessage("أحدث الطلبات (كل الحالات)", orders, 0, TELEGRAM_ADMIN_ORDERS_PAGE_SIZE, total);
      const kb = ordersListKeyboard(0, TELEGRAM_ADMIN_ORDERS_PAGE_SIZE, total, orders, "ord");
      return { text, keyboard: kb };
    }
    case "rejected-orders": {
      const total = await countOrdersByStatus("cancelled");
      const orders = await loadOrdersPageByStatus("cancelled", 0, TELEGRAM_ADMIN_ORDERS_PAGE_SIZE);
      const text = formatOrdersListMessage("الطلبات الملغاة / المرفوضة", orders, 0, TELEGRAM_ADMIN_ORDERS_PAGE_SIZE, total);
      const kb = ordersListKeyboard(0, TELEGRAM_ADMIN_ORDERS_PAGE_SIZE, total, orders, "canc");
      return { text, keyboard: kb };
    }
    case "admin-create-order": {
      return {
        text:
          `<b>إضافة طلب من الإدارة</b>\n\n` +
          `إنشاء طلب كامل (صور، وجهتان، خيارات متعددة) غير متاح بعد من البوت.\n` +
          `يمكنك إدارة الطلبات الموجودة من قوائم الطلبات أدناه.`,
        keyboard: backOnlyKeyboard(),
      };
    }
    case "courier-map": {
      return {
        text:
          `<b>خريطة المندوبين</b>\n\n` +
          `عرض الخريطة التفاعلية غير متاح داخل التليجرام.\n` +
          `يمكنك من هنا عرض آخر مواقع المندوبين في قسم «المندوبين» أدناه.`,
        keyboard: backOnlyKeyboard(),
      };
    }
    case "preparers": {
      return {
        text:
          `<b>المجهزين (فريق الإدارة)</b>\n\n` +
          `قسم التقييم في الواجهة: «المجهزين» — ليسوا موظفي المحل.\n` +
          `موظفو المحل يُضافون من «المحلات».\n` +
          `تقرير الطلبات المرفوعة من الروابط: «التقارير → طلبات موظفي المحل».`,
        keyboard: backOnlyKeyboard(),
      };
    }
    case "reports": {
      const [pending, assigned, delivering, delivered, cancelled, allCount] = await Promise.all([
        countOrdersByStatus("pending"),
        countOrdersByStatus("assigned"),
        countOrdersByStatus("delivering"),
        countOrdersByStatus("delivered"),
        countOrdersByStatus("cancelled"),
        prisma.order.count(),
      ]);
      const text =
        `<b>ملخص سريع</b>\n\n` +
        `إجمالي الطلبات: <b>${allCount}</b>\n` +
        `معلّق: ${pending}\n` +
        `مسنّد: ${assigned}\n` +
        `قيد التوصيل: ${delivering}\n` +
        `تم التسليم: ${delivered}\n` +
        `ملغى: ${cancelled}`;
      return { text, keyboard: backOnlyKeyboard() };
    }
    case "customers": {
      const rows = await prisma.customer.findMany({
        orderBy: { updatedAt: "desc" },
        take: 12,
        select: { name: true, phone: true, shop: { select: { name: true } } },
      });
      if (rows.length === 0) {
        return { text: "<b>الزبائن</b>\n\nلا يوجد زبائن.", keyboard: backOnlyKeyboard() };
      }
      const lines = rows.map(
        (r) =>
          `• ${escapeTelegramHtml(r.name?.trim() || "—")} — ${escapeTelegramHtml(r.phone)} — ${escapeTelegramHtml(r.shop.name)}`,
      );
      return {
        text: `<b>آخر الزبائن</b>\n\n${lines.join("\n")}`,
        keyboard: backOnlyKeyboard(),
      };
    }
    case "couriers": {
      const rows = await prisma.courier.findMany({
        orderBy: { name: "asc" },
        take: 25,
        select: {
          name: true,
          phone: true,
          blocked: true,
          hiddenFromReports: true,
          availableForAssignment: true,
          vehicleType: true,
        },
      });
      if (rows.length === 0) {
        return { text: "<b>المندوبين</b>\n\nلا يوجد مندوبون.", keyboard: backOnlyKeyboard() };
      }
      const lines = rows.map((r) => {
        const flags = [
          r.blocked ? "محظور" : null,
          r.hiddenFromReports ? "مخفي" : null,
          r.availableForAssignment === false ? "غير متاح للإسناد" : null,
        ]
          .filter(Boolean)
          .join("، ");
        return `• ${escapeTelegramHtml(r.name)} — ${escapeTelegramHtml(r.phone)} — ${r.vehicleType}${flags ? ` (${flags})` : ""}`;
      });
      return {
        text: `<b>المندوبين</b>\n\n${lines.join("\n")}`,
        keyboard: backOnlyKeyboard(),
      };
    }
    case "shops": {
      return renderShopsTelegramHub(0);
    }
    case "regions": {
      const rows = await prisma.region.findMany({
        orderBy: { name: "asc" },
        take: 35,
        select: { name: true, deliveryPrice: true },
      });
      if (rows.length === 0) {
        return { text: "<b>المناطق</b>\n\nلا يوجد مناطق.", keyboard: backOnlyKeyboard() };
      }
      const lines = rows.map(
        (r) => `• ${escapeTelegramHtml(r.name)} — توصيل ${escapeTelegramHtml(formatDinarAsAlf(r.deliveryPrice))} `,
      );
      return {
        text: `<b>المناطق</b>\n\n${lines.join("\n")}`,
        keyboard: backOnlyKeyboard(),
      };
    }
    case "employees": {
      const rows = await prisma.employee.findMany({
        orderBy: { name: "asc" },
        take: 25,
        select: { name: true, phone: true, shop: { select: { name: true } } },
      });
      if (rows.length === 0) {
        return { text: "<b>الموظفين</b>\n\nلا يوجد موظفون.", keyboard: backOnlyKeyboard() };
      }
      const lines = rows.map(
        (r) => `• ${escapeTelegramHtml(r.name)} — ${escapeTelegramHtml(r.phone)} — ${escapeTelegramHtml(r.shop.name)}`,
      );
      return {
        text: `<b>موظفو المحلات</b>\n\n${lines.join("\n")}`,
        keyboard: backOnlyKeyboard(),
      };
    }
    case "settings":
    case "notification-settings": {
      const row = await prisma.appNotificationSettings.findUnique({ where: { id: 1 } });
      const text = row
        ? `<b>الإعدادات</b>\n\n` +
          `<b>إشعارات المتصفح</b>\n` +
          `إدارة: ${row.adminEnabled ? "مفعّل" : "معطّل"} — صوت: ${row.adminSoundEnabled ? "نعم" : "لا"} — نغمة: ${escapeTelegramHtml(row.adminSoundPreset)}\n` +
          `مندوب: ${row.mandoubEnabled ? "مفعّل" : "معطّل"} — صوت: ${row.mandoubSoundEnabled ? "نعم" : "لا"} — نغمة: ${escapeTelegramHtml(row.mandoubSoundPreset)}\n\n` +
          `تغيير القوالب والنغمات التفصيلية من لوحة الإعدادات فقط.`
        : `<b>الإعدادات</b>\n\nلا توجد إعدادات محفوظة.`;
      return { text, keyboard: backOnlyKeyboard() };
    }
    default: {
      const tile = ADMIN_TILES.find((x) => x.slug === slug);
      const label = tile ? `${tile.emoji} ${tile.label}` : slug;
      return {
        text: `<b>${escapeTelegramHtml(label)}</b>\n\nلا يتوفر عرض تفصيلي لهذا القسم في البوت بعد.`,
        keyboard: backOnlyKeyboard(),
      };
    }
  }
}

export async function sendTelegramAdminMainMenu(chatId: string): Promise<void> {
  await sendTelegramMessageWithKeyboardToChat(chatId, formatAdminPanelWelcomeHtml(), adminMainKeyboard());
}

export async function handleTelegramAdminPrivateMessage(message: {
  message_id: number;
  from?: { id: number };
  chat: { id: number };
  text?: string;
}): Promise<void> {
  const fromId = message.from?.id;
  if (fromId == null || !isTelegramAdminUser(fromId)) return;
  if (!isTelegramPrivateChat(message.chat, fromId)) return;
  const txt = message.text?.trim() ?? "";
  if (!txt.startsWith("/")) return;
  const cmd = txt.split(/\s+/)[0]?.toLowerCase() ?? "";
  if (cmd !== "/start" && cmd !== "/admin") return;
  await sendTelegramAdminMainMenu(String(message.chat.id));
}

export async function handleTelegramAdminCallback(cq: {
  id: string;
  from: { id: number };
  message?: { chat: { id: number }; message_id: number; text?: string };
  data?: string;
}): Promise<boolean> {
  const fromId = cq.from?.id;
  if (fromId == null || !isTelegramAdminUser(fromId)) return false;
  const msg = cq.message;
  if (!msg) return false;
  if (!isTelegramPrivateChat(msg.chat, fromId)) return false;

  const parsed = parseTelegramAdminCallback(cq.data?.trim() ?? "");
  if (!parsed) {
    await answerCallbackQuery(cq.id, "أمر غير مدعوم", true).catch(() => {});
    return true;
  }

  await answerCallbackQuery(cq.id).catch(() => {});

  const chatId = String(msg.chat.id);
  const messageId = msg.message_id;
  const telegramUserId = String(fromId);

  try {
    switch (parsed.kind) {
      case "main": {
        await clearSuperSearchSession(telegramUserId).catch(() => {});
        await prisma.telegramBotSession.updateMany({
          where: {
            telegramUserId,
            OR: [{ step: { startsWith: "priv_" } }, { step: { startsWith: "await_" } }],
          },
          data: { step: "idle", orderNumber: null, payload: "" },
        });
        const edited = await editTelegramMessage(
          chatId,
          messageId,
          formatAdminPanelWelcomeHtml(),
          adminMainKeyboard(),
        );
        if (!edited.ok) {
          await sendTelegramAdminMainMenu(chatId);
        }
        return true;
      }
      case "super_search_start": {
        await upsertSuperSearchSession(telegramUserId, chatId);
        const kb: TelegramInlineKeyboard = {
          inline_keyboard: [[{ text: "❌ إلغاء", callback_data: "superx" }]],
        };
        const edited = await editTelegramMessage(chatId, messageId, formatSuperSearchPromptHtml(), kb);
        if (!edited.ok) {
          await sendTelegramMessageWithKeyboardToChat(chatId, formatSuperSearchPromptHtml(), kb);
        }
        return true;
      }
      case "super_search_cancel": {
        await clearSuperSearchSession(telegramUserId);
        await clearPrivCustomerSession(telegramUserId).catch(() => {});
        await prisma.telegramBotSession.updateMany({
          where: { telegramUserId, step: { startsWith: "priv_" } },
          data: { step: "idle", orderNumber: null, payload: "" },
        });
        const edited = await editTelegramMessage(
          chatId,
          messageId,
          formatAdminPanelWelcomeHtml(),
          adminMainKeyboard(),
        );
        if (!edited.ok) {
          await sendTelegramAdminMainMenu(chatId);
        }
        return true;
      }
      case "super_search_customer": {
        await clearSuperSearchSession(telegramUserId).catch(() => {});
        const d = await formatSuperSearchCustomerDetail(parsed.customerId);
        if (!d) {
          await editTelegramMessage(chatId, messageId, "الزبون غير موجود.", {
            inline_keyboard: [[{ text: "🔍 بحث جديد", callback_data: "superq" }]],
          }).catch(() => {});
          return true;
        }
        const edited = await editTelegramMessage(chatId, messageId, d.text, d.keyboard);
        if (!edited.ok) {
          await sendTelegramMessageWithKeyboardToChat(chatId, d.text, d.keyboard);
        }
        return true;
      }
      case "cust_field_loc": {
        await startSuperSearchCustomerFieldEdit({
          telegramUserId,
          chatId,
          messageId,
          customerId: parsed.customerId,
          field: "loc",
        });
        return true;
      }
      case "cust_field_alt": {
        await startSuperSearchCustomerFieldEdit({
          telegramUserId,
          chatId,
          messageId,
          customerId: parsed.customerId,
          field: "alt",
        });
        return true;
      }
      case "cust_field_lmk": {
        await startSuperSearchCustomerFieldEdit({
          telegramUserId,
          chatId,
          messageId,
          customerId: parsed.customerId,
          field: "lmk",
        });
        return true;
      }
      case "cust_field_door": {
        await startSuperSearchCustomerFieldEdit({
          telegramUserId,
          chatId,
          messageId,
          customerId: parsed.customerId,
          field: "door",
        });
        return true;
      }
      case "section": {
        const { text, keyboard } = await renderAdminSection(parsed.slug);
        const edited = await editTelegramMessage(chatId, messageId, text, keyboard);
        if (!edited.ok) {
          await sendTelegramMessageWithKeyboardToChat(chatId, text, keyboard);
        }
        return true;
      }
      case "orders": {
        const pageSize = TELEGRAM_ADMIN_ORDERS_PAGE_SIZE;
        const [total, orders] = await Promise.all([
          countOrdersTotal(),
          loadOrdersPageForAdmin(parsed.page, pageSize),
        ]);
        const text = formatOrdersListMessage(
          "أحدث الطلبات",
          orders,
          parsed.page,
          pageSize,
          total,
        );
        const kb = ordersListKeyboard(parsed.page, pageSize, total, orders, "ord");
        const edited = await editTelegramMessage(chatId, messageId, text, kb);
        if (!edited.ok) {
          await sendTelegramMessageWithKeyboardToChat(chatId, text, kb);
        }
        return true;
      }
      case "pending": {
        const pageSize = TELEGRAM_ADMIN_ORDERS_PAGE_SIZE;
        const total = await countOrdersByStatus("pending");
        const orders = await loadOrdersPageByStatus("pending", parsed.page, pageSize);
        const text = formatOrdersListMessage(
          "الطلبات المعلّقة",
          orders,
          parsed.page,
          pageSize,
          total,
        );
        const kb = ordersListKeyboard(parsed.page, pageSize, total, orders, "pend");
        const edited = await editTelegramMessage(chatId, messageId, text, kb);
        if (!edited.ok) {
          await sendTelegramMessageWithKeyboardToChat(chatId, text, kb);
        }
        return true;
      }
      case "cancelled": {
        const pageSize = TELEGRAM_ADMIN_ORDERS_PAGE_SIZE;
        const total = await countOrdersByStatus("cancelled");
        const orders = await loadOrdersPageByStatus("cancelled", parsed.page, pageSize);
        const text = formatOrdersListMessage(
          "الطلبات الملغاة",
          orders,
          parsed.page,
          pageSize,
          total,
        );
        const kb = ordersListKeyboard(parsed.page, pageSize, total, orders, "canc");
        const edited = await editTelegramMessage(chatId, messageId, text, kb);
        if (!edited.ok) {
          await sendTelegramMessageWithKeyboardToChat(chatId, text, kb);
        }
        return true;
      }
      case "detail": {
        const order = await loadOrderForAdminDetail(parsed.orderNumber);
        if (!order) {
          const errKb: TelegramInlineKeyboard = {
            inline_keyboard: [[{ text: "⬅️ أحدث الطلبات", callback_data: "ord0" }]],
          };
          await editTelegramMessage(chatId, messageId, "❌ الطلب غير موجود.", errKb).catch(() => {});
          return true;
        }
        const customerName = order.customer?.name?.trim() || "—";
        const regionName = order.customerRegion?.name ?? "—";
        const body = formatNewOrderTelegramHtml(
          {
            shopName: order.shop.name,
            customerName,
            regionName,
            orderType: order.orderType,
            orderSubtotal: order.orderSubtotal,
            deliveryPrice: order.deliveryPrice,
            totalAmount: order.totalAmount,
            orderNumber: order.orderNumber,
            customerPhone: order.customerPhone,
            orderNoteTime: order.orderNoteTime,
            orderId: order.id,
          },
          { omitAdminLink: true },
        );
        const text = `<b>تفاصيل الطلب</b>\n\n${body}`;
        const kb = orderDetailKeyboard(order.orderNumber, order.id);
        const edited = await editTelegramMessage(chatId, messageId, text, kb);
        if (!edited.ok) {
          await sendTelegramMessageWithKeyboardToChat(chatId, text, kb);
        }
        return true;
      }
    }
  } catch (e) {
    console.error("[telegram admin panel]", e);
    return true;
  }
}
