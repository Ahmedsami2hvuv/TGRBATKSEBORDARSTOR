/**
 * لوحة إدارية في المحادثة الخاصة مع البوت — TELEGRAM_ADMIN_USER_IDS أو TELEGRAM_ADMIN_USER_ID.
 * التنقّل والبيانات عبر callbacks (بدون روابط متصفح).
 */
import { ADMIN_TILES, isTileEnabled } from "@/lib/admin-nav";
import { getPublicAppUrl } from "@/lib/app-url";
import { formatDinarAsAlf, parseAlfInputToDinarDecimalRequired } from "@/lib/money-alf";
import { parseQuickOrder } from "@/lib/flexible-order-parse";
import { prisma } from "@/lib/prisma";
import { rankRegionsByQuery } from "@/lib/arabic-region-search";
import { normalizeIraqMobileLocal11 } from "@/lib/whatsapp";
import { Decimal } from "@prisma/client/runtime/library";
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
import { buildTelegramOrderKeyboard, formatNewOrderTelegramHtml, notifyTelegramNewOrder } from "@/lib/telegram-notify";
import { pushNotifyAdminsNewPendingOrder } from "@/lib/web-push-server";

export const TELEGRAM_ADMIN_ORDERS_PAGE_SIZE = 8;

export async function getTelegramAdminUserIdSet(): Promise<Set<string>> {
  const ids = new Set<string>();

  // إضافة المعرف الخاص بك كمطور/مدير أساسي لضمان عدم انقطاع الخدمة أثناء التحديث
  ids.add("937732530");

  // من قاعدة البيانات - الجدول الجديد
  try {
    const admins = await prisma.telegramAdmin.findMany({
      where: { active: true },
      select: { telegramUserId: true }
    });
    for (const a of admins) {
      if (a.telegramUserId) ids.add(a.telegramUserId);
    }
  } catch (e) {
    console.error("Error fetching telegramAdmins from DB:", e);
  }

  // ملاحظة: تم إلغاء نظام الـ IDs القديم (appNotificationSettings) بناءً على الطلب

  // من البيئة (Env Vars)
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

export async function isTelegramAdminUser(telegramUserId: number | undefined): Promise<boolean> {
  if (telegramUserId == null) return false;
  const set = await getTelegramAdminUserIdSet();
  const isAllowed = set.has(String(telegramUserId));

  if (!isAllowed) {
    console.warn(`[telegram-admin] Unauthorized access attempt by user ID: ${telegramUserId}. Allowed IDs: ${Array.from(set).join(', ')}`);
  }

  return isAllowed;
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
  | { kind: "cust_field_door"; customerId: string }
  | { kind: "qadd" }
  | { kind: "qadj"; field: "price" | "del"; amount: number }
  | { kind: "cr_detail"; id: string }
  | { kind: "cr_edit"; id: string }
  | { kind: "cr_toggle_block"; id: string }
  | { kind: "cr_delete"; id: string }
  | { kind: "cr_add" }
  | { kind: "pr_detail"; id: string }
  | { kind: "pr_edit"; id: string }
  | { kind: "pr_toggle_active"; id: string }
  | { kind: "pr_delete"; id: string }
  | { kind: "pr_add" }
  | { kind: "rg_detail"; id: string }
  | { kind: "rg_edit_name"; id: string }
  | { kind: "rg_edit_price"; id: string }
  | { kind: "rg_adj_price"; id: string; amount: number };

export function parseTelegramAdminCallback(raw: string): ParsedTelegramAdminCallback | null {
  const t = raw.trim();
  if (t === "main") return { kind: "main" };
  if (t === "superq") return { kind: "super_search_start" };
  if (t === "superx") return { kind: "super_search_cancel" };
  if (t === "qadd") return { kind: "qadd" };
  if (t === "cr_add") return { kind: "cr_add" };
  if (t === "pr_add") return { kind: "pr_add" };

  let m = /^qadj:(p|d):(-?\d+)$/.exec(t);
  if (m) {
    const field = m[1] === "p" ? "price" : "del";
    const amount = Number(m[2]);
    return { kind: "qadj", field, amount };
  }

  // Couriers
  m = /^crd:(.+)$/.exec(t);
  if (m) return { kind: "cr_detail", id: m[1] };
  m = /^cre:(.+)$/.exec(t);
  if (m) return { kind: "cr_edit", id: m[1] };
  m = /^crb:(.+)$/.exec(t);
  if (m) return { kind: "cr_toggle_block", id: m[1] };
  m = /^crx:(.+)$/.exec(t);
  if (m) return { kind: "cr_delete", id: m[1] };

  // Preparers
  m = /^prd:(.+)$/.exec(t);
  if (m) return { kind: "pr_detail", id: m[1] };
  m = /^pre:(.+)$/.exec(t);
  if (m) return { kind: "pr_edit", id: m[1] };
  m = /^pra:(.+)$/.exec(t);
  if (m) return { kind: "pr_toggle_active", id: m[1] };
  m = /^prx:(.+)$/.exec(t);
  if (m) return { kind: "pr_delete", id: m[1] };

  // Regions
  m = /^rgd:(.+)$/.exec(t);
  if (m) return { kind: "rg_detail", id: m[1] };
  m = /^rgen:(.+)$/.exec(t);
  if (m) return { kind: "rg_edit_name", id: m[1] };
  m = /^rgep:(.+)$/.exec(t);
  if (m) return { kind: "rg_edit_price", id: m[1] };
  m = /^rga:(.+):(-?\d+)$/.exec(t);
  if (m) return { kind: "rg_adj_price", id: m[1], amount: Number(m[2]) };

  const sec = /^s:(.+)$/.exec(t);
  if (sec?.[1]) {
    const slug = sec[1].trim();
    if (slug.length > 0 && slug.length <= 48) return { kind: "section", slug };
  }
  m = /^ord(\d+)$/.exec(t);
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

function getTileEmoji(slug: string): string {
  const emojis: Record<string, string> = {
    "new-orders": "📥",
    "order-tracking": "🚚",
    "admin-create-order": "➕",
    "archived-orders": "📦",
    "rejected-orders": "❌",
    "reports": "📊",
    "prep-notices": "🔔",
    "new-customer-profile": "👤",
    "customers": "👥",
    "couriers": "🛵",
    "courier-map": "🗺️",
    "preparers": "👨‍🍳",
    "suppliers": "🏢",
    "employees": "👷",
    "shops": "🏪",
    "regions": "📍",
    "wa-buttons": "📲",
    "super-search": "🔍",
    "store": "🛒",
    "settings": "⚙️",
    "notification-settings": "🔔",
  };
  return emojis[slug] || "🔹";
}

function adminMainKeyboard(): TelegramInlineKeyboard {
  const rows: TelegramInlineKeyboard["inline_keyboard"] = [];
  rows.push([{ text: "🔍 البحث الخارق (كل شيء)", callback_data: "superq" }]);
  rows.push([{ text: "📥 الطلبات المعلّقة", callback_data: "pend0" }]);
  const tiles = ADMIN_TILES.filter((t) => isTileEnabled(t.slug));
  for (let i = 0; i < tiles.length; i += 2) {
    const a = tiles[i];
    const b = tiles[i + 1];

    // Skip tiles that might have English names or are redundant in this context
    if (a.slug === "ai-settings" || a.slug === "legacy-kse-profiles-batch") continue;

    const row: Array<{ text: string; callback_data: string }> = [
      { text: `${getTileEmoji(a.slug)} ${a.label}`.slice(0, 64), callback_data: `s:${a.slug}` },
    ];
    if (b && b.slug !== "ai-settings" && b.slug !== "legacy-kse-profiles-batch") {
      row.push({ text: `${getTileEmoji(b.slug)} ${b.label}`.slice(0, 64), callback_data: `s:${b.slug}` });
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
  if (page < totalPages - 1) {
    nav.push({ text: "التالي ➡️", callback_data: `${navPrefix}${page + 1}` });
  }

  const rows: TelegramInlineKeyboard["inline_keyboard"] = [];
  if (nav.length > 0) rows.push(nav);

  rows.push([{ text: "🔙 رجوع", callback_data: "main" }, { text: "🏠 الرئيسية", callback_data: "main" }]);

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
        { text: "🔙 رجوع للقائمة", callback_data: "ord0" },
        { text: "🏠 الرئيسية", callback_data: "main" },
      ],
    ],
  };
}

function backOnlyKeyboard(): TelegramInlineKeyboard {
  return {
    inline_keyboard: [[{ text: "🔙 رجوع", callback_data: "main" }, { text: "🏠 الرئيسية", callback_data: "main" }]]
  };
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
      const rows = await prisma.companyPreparer.findMany({
        orderBy: { name: "asc" },
        take: 30,
        select: { id: true, name: true, active: true },
      });

      if (rows.length === 0) {
        return {
          text: "<b>المجهزين</b>\n\nلا يوجد مجهزون مسجلون حالياً.",
          keyboard: {
            inline_keyboard: [
              [{ text: "➕ إضافة مجهز جديد", callback_data: "pr_add" }],
              [{ text: "🔙 رجوع", callback_data: "main" }]
            ]
          }
        };
      }

      const text = `<b>قائمة المجهزين (${rows.length})</b>\n\nاختر مجهزاً للإدارة:`;
      const kb: TelegramInlineKeyboard = {
        inline_keyboard: []
      };

      for (let i = 0; i < rows.length; i += 2) {
        const row: any[] = [];
        const p1 = rows[i];
        row.push({ text: `${p1.active ? '✅ ' : '❌ '}${p1.name}`, callback_data: `prd:${p1.id}` });
        if (i + 1 < rows.length) {
          const p2 = rows[i + 1];
          row.push({ text: `${p2.active ? '✅ ' : '❌ '}${p2.name}`, callback_data: `prd:${p2.id}` });
        }
        kb.inline_keyboard.push(row);
      }

      kb.inline_keyboard.push([{ text: "➕ إضافة مجهز جديد", callback_data: "pr_add" }]);
      kb.inline_keyboard.push([{ text: "🏠 الرئيسية", callback_data: "main" }]);

      return { text, keyboard: kb };
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
        take: 30,
        select: {
          id: true,
          name: true,
          phone: true,
          blocked: true,
          vehicleType: true,
        },
      });

      if (rows.length === 0) {
        return {
          text: "<b>المندوبين</b>\n\nلا يوجد مندوبون مسجلون حالياً.",
          keyboard: {
            inline_keyboard: [
              [{ text: "➕ إضافة مندوب جديد", callback_data: "cr_add" }],
              [{ text: "🔙 رجوع", callback_data: "main" }]
            ]
          }
        };
      }

      const text = `<b>قائمة المناديب (${rows.length})</b>\n\nاختر مندوباً لعرض التفاصيل أو التعديل:`;
      const kb: TelegramInlineKeyboard = {
        inline_keyboard: []
      };

      for (let i = 0; i < rows.length; i += 2) {
        const row: any[] = [];
        const c1 = rows[i];
        row.push({ text: `${c1.blocked ? '🚫 ' : ''}${c1.name}`, callback_data: `crd:${c1.id}` });
        if (i + 1 < rows.length) {
          const c2 = rows[i + 1];
          row.push({ text: `${c2.blocked ? '🚫 ' : ''}${c2.name}`, callback_data: `crd:${c2.id}` });
        }
        kb.inline_keyboard.push(row);
      }

      kb.inline_keyboard.push([{ text: "➕ إضافة مندوب جديد", callback_data: "cr_add" }]);
      kb.inline_keyboard.push([{ text: "🏠 الرئيسية", callback_data: "main" }]);

      return { text, keyboard: kb };
    }
    case "shops": {
      return renderShopsTelegramHub(0);
    }
    case "regions": {
      const rows = await prisma.region.findMany({
        orderBy: { name: "asc" },
        take: 35,
        select: { id: true, name: true, deliveryPrice: true },
      });
      if (rows.length === 0) {
        return { text: "<b>المناطق</b>\n\nلا يوجد مناطق.", keyboard: backOnlyKeyboard() };
      }

      const text = `<b>إدارة المناطق (${rows.length})</b>\n\nاختر منطقة لتعديل سعر التوصيل:`;
      const kb: TelegramInlineKeyboard = {
        inline_keyboard: []
      };

      for (let i = 0; i < rows.length; i += 2) {
        const row: any[] = [];
        const r1 = rows[i];
        row.push({ text: `${r1.name} (${formatDinarAsAlf(r1.deliveryPrice)})`, callback_data: `rgd:${r1.id}` });
        if (i + 1 < rows.length) {
          const r2 = rows[i + 1];
          row.push({ text: `${r2.name} (${formatDinarAsAlf(r2.deliveryPrice)})`, callback_data: `rgd:${r2.id}` });
        }
        kb.inline_keyboard.push(row);
      }

      kb.inline_keyboard.push([{ text: "🔙 رجوع", callback_data: "main" }]);
      return { text, keyboard: kb };
    }
    case "employees": {
      const rows = await prisma.employee.findMany({
        orderBy: { name: "asc" },
        take: 30,
        select: {
          id: true,
          name: true,
          phone: true,
          telegramUserId: true,
          shop: { select: { name: true } },
        },
      });

      if (rows.length === 0) {
        return {
          text: "<b>الموظفين</b>\n\nلا يوجد موظفون مسجلون. تتم إضافة الموظفين عادةً من خلال لوحة تحكم المحلات.",
          keyboard: backOnlyKeyboard()
        };
      }

      const text = `<b>موظفو المحلات (${rows.length})</b>\n\nقائمة الموظفين وربط الحسابات:`;
      const lines = rows.map(r => {
        const linkStatus = r.telegramUserId ? "🔗 مربوط" : "❌ غير مربوط";
        return `• ${escapeTelegramHtml(r.name)} (${escapeTelegramHtml(r.shop.name)})\n  📱 ${escapeTelegramHtml(r.phone)} — ${linkStatus}`;
      });

      return {
        text: `${text}\n\n${lines.join("\n\n")}`,
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

export async function sendTelegramAdminMainMenu(chatId: string, botToken?: string): Promise<void> {
  await sendTelegramMessageWithKeyboardToChat(chatId, formatAdminPanelWelcomeHtml(), adminMainKeyboard(), botToken);
}

export async function handleTelegramAdminPrivateMessage(message: {
  message_id: number;
  from?: { id: number };
  chat: { id: number };
  text?: string;
}, botToken?: string): Promise<boolean> {
  const fromId = message.from?.id;
  const telegramUserId = String(fromId || "");
  const chatId = String(message.chat.id);
  const txt = message.text?.trim() ?? "";

  // Rescue & Debug: رد فوري للتأكد من وصول الرسالة للخادم
  if (txt === "/start" || txt === "start") {
     console.log(`[admin-panel] Received /start from ${telegramUserId}`);
  }

  if (fromId == null || !(await isTelegramAdminUser(fromId))) {
    // إبلاغ المستخدم غير المصرح له بهويته (مهم جداً للمزامنة)
    const { sendTelegramHtmlToChat } = await import("./telegram");
    await sendTelegramHtmlToChat(
      chatId,
      `⚠️ <b>نظام الإدارة: تم استلام رسالتك</b>\n\n` +
      `لكن حسابك غير مسجل كمدير حالياً.\n` +
      `معرفك (ID): <code>${telegramUserId}</code>\n\n` +
      `<i>يرجى إرسال هذا الرقم للمطور أو إضافته في الإعدادات.</i>`,
      botToken
    ).catch(() => {});
    return false;
  }

  if (!isTelegramPrivateChat(message.chat, fromId)) return false;

  if (txt.startsWith("/")) {
    const cmd = txt.split(/\s+/)[0]?.toLowerCase() ?? "";
    if (cmd === "/start" || cmd === "/admin") {
      await sendTelegramAdminMainMenu(chatId, botToken);
      return true;
    }
    return false;
  }

  // التحقق من الجلسات النشطة (إضافة/تعديل)
  const session = await prisma.telegramBotSession.findUnique({ where: { telegramUserId } });
  if (session && session.step !== "idle") {
    if (txt === "تجاهل" || txt === "الغاء" || txt === "إلغاء") {
      await prisma.telegramBotSession.update({ where: { telegramUserId }, data: { step: "idle", payload: "" } });
      await sendTelegramMessageWithKeyboardToChat(chatId, "❌ تم إلغاء العملية.", adminMainKeyboard(), botToken);
      return true;
    }

    if (session.step === "add_courier_name") {
      await prisma.telegramBotSession.update({
        where: { telegramUserId },
        data: { step: "add_courier_phone", payload: JSON.stringify({ name: txt }) }
      });
      await sendTelegramMessageWithKeyboardToChat(chatId, `✅ الاسم: ${txt}\n\nيرجى إرسال رقم هاتف المندوب:`, {
        inline_keyboard: [[{ text: "❌ إلغاء", callback_data: "s:couriers" }]]
      });
      return true;
    }

    if (session.step === "add_courier_phone") {
      const p = JSON.parse(session.payload || "{}");
      const phone = normalizeIraqMobileLocal11(txt);
      if (!phone) {
        await sendTelegramMessageWithKeyboardToChat(chatId, "❌ رقم الهاتف غير صحيح. يرجى إرسال رقم هاتف عراقي صالح:");
        return true;
      }
      const courier = await prisma.courier.create({
        data: { name: p.name, phone, vehicleType: "دراجة" }
      });
      await prisma.telegramBotSession.update({ where: { telegramUserId }, data: { step: "idle", payload: "" } });
      await sendTelegramMessageWithKeyboardToChat(chatId, `✅ تم إضافة المندوب <b>${courier.name}</b> بنجاح!`, {
        inline_keyboard: [[{ text: "📦 عرض المندوب", callback_data: `crd:${courier.id}` }], [{ text: "🏠 الرئيسية", callback_data: "main" }]]
      });
      return true;
    }

    if (session.step === "add_preparer_name") {
      const prep = await prisma.companyPreparer.create({ data: { name: txt, active: true } });
      await prisma.telegramBotSession.update({ where: { telegramUserId }, data: { step: "idle", payload: "" } });
      await sendTelegramMessageWithKeyboardToChat(chatId, `✅ تم إضافة المجهز <b>${prep.name}</b> بنجاح!`, {
        inline_keyboard: [[{ text: "👤 عرض المجهز", callback_data: `prd:${prep.id}` }], [{ text: "🏠 الرئيسية", callback_data: "main" }]]
      });
      return true;
    }

    if (session.step === "edit_region_name") {
      const p = JSON.parse(session.payload || "{}");
      await prisma.region.update({ where: { id: p.id }, data: { name: txt } });
      await prisma.telegramBotSession.update({ where: { telegramUserId }, data: { step: "idle", payload: "" } });
      await sendTelegramMessageWithKeyboardToChat(chatId, "✅ تم تحديث اسم المنطقة بنجاح.", {
        inline_keyboard: [[{ text: "🔙 رجوع للمنطقة", callback_data: `rgd:${p.id}` }]]
      });
      return true;
    }

    if (session.step === "edit_region_price") {
      const p = JSON.parse(session.payload || "{}");
      const price = parseAlfInputToDinarDecimalRequired(txt);
      if (!price.ok) {
        await sendTelegramMessageWithKeyboardToChat(chatId, "❌ السعر غير صالح. يرجى إرسال رقم (مثلاً 3.5):");
        return true;
      }
      await prisma.region.update({ where: { id: p.id }, data: { deliveryPrice: new Decimal(price.value) } });
      await prisma.telegramBotSession.update({ where: { telegramUserId }, data: { step: "idle", payload: "" } });
      await sendTelegramMessageWithKeyboardToChat(chatId, "✅ تم تحديث سعر التوصيل بنجاح.", {
        inline_keyboard: [[{ text: "🔙 رجوع للمنطقة", callback_data: `rgd:${p.id}` }]]
      });
      return true;
    }

    if (session.step === "admin_quick_order_time") {
      const p = JSON.parse(session.payload || "{}");
      p.orderNoteTime = txt;
      await prisma.telegramBotSession.update({
        where: { telegramUserId },
        data: { step: "admin_quick_order_confirm", payload: JSON.stringify(p) }
      });
      const { text, keyboard } = formatQuickOrderConfirm(p);
      await sendTelegramMessageWithKeyboardToChat(chatId, text, keyboard);
      return true;
    }

    if (session.step === "await_courier_name") {
      const p = JSON.parse(session.payload || "{}");
      await prisma.courier.update({ where: { id: p.id }, data: { name: txt } });
      await prisma.telegramBotSession.update({ where: { telegramUserId }, data: { step: "idle", payload: "" } });
      await sendTelegramMessageWithKeyboardToChat(chatId, "✅ تم تحديث اسم المندوب بنجاح.", {
        inline_keyboard: [[{ text: "🔙 رجوع للمندوب", callback_data: `crd:${p.id}` }]]
      });
      return true;
    }
  }

  // إذا لم يكن هناك جلسة، قد يكون نص لإنشاء طلب سريع
  return await handleAdminQuickOrderMessage(message);
}

async function handleAdminQuickOrderMessage(message: {
  chat: { id: number };
  text?: string;
  from?: { id: number };
}): Promise<boolean> {
  const txt = message.text?.trim();
  if (!txt) return false;

  const parsed = parseQuickOrder(txt);
  if (!parsed.phone || parsed.price === null) return false;

  // البحث عن المنطقة
  let region = null;
  if (parsed.regionQuery) {
    region = await prisma.region.findFirst({
      where: { name: { contains: parsed.regionQuery, mode: 'insensitive' } }
    });

    if (!region) {
      const all = await prisma.region.findMany({ select: { id: true, name: true, deliveryPrice: true } });
      const ranked = rankRegionsByQuery(parsed.regionQuery, all, 1);
      if (ranked.length > 0) {
        region = await prisma.region.findUnique({ where: { id: ranked[0].id } });
      }
    }
  }

  const deliveryPrice = region?.deliveryPrice.toNumber() || 0;

  const payload = {
    phone: parsed.phone,
    price: parsed.price,
    type: parsed.orderType || "غير محدد",
    regionId: region?.id,
    regionName: region?.name || parsed.regionQuery || "غير محدد",
    deliveryPrice: Number(deliveryPrice),
    orderNoteTime: ""
  };

  await prisma.telegramBotSession.upsert({
    where: { telegramUserId: String(message.from?.id) },
    create: {
      telegramUserId: String(message.from?.id),
      chatId: String(message.chat.id),
      step: "admin_quick_order_time",
      payload: JSON.stringify(payload),
    },
    update: {
      step: "admin_quick_order_time",
      payload: JSON.stringify(payload),
    }
  });

  await sendTelegramMessageWithKeyboardToChat(String(message.chat.id), "❓ <b>شوكت تحب يجيلك المندوب؟</b>\n(أرسل الوقت، مثلاً: هسه، باجر، بـ 4 العصر...)", {
    inline_keyboard: [[{ text: "❌ إلغاء", callback_data: "main" }]]
  });

  return true;
}

function formatQuickOrderConfirm(p: any) {
  const total = Number(p.price) + Number(p.deliveryPrice);
  const text =
    `<b>تأكيد الطلب السريع</b>\n\n` +
    `نوع الطلب: ${escapeTelegramHtml(p.type)}\n` +
    `المنطقة: ${escapeTelegramHtml(p.regionName)}\n` +
    `الهاتف: <code>${p.phone}</code>\n` +
    `الوقت: <b>${escapeTelegramHtml(p.orderNoteTime || "فوري")}</b>\n\n` +
    `💰 السعر: <b>${formatDinarAsAlf(p.price)}</b>\n` +
    `🚚 التوصيل: <b>${formatDinarAsAlf(p.deliveryPrice)}</b>\n` +
    `💵 الإجمالي: <b>${formatDinarAsAlf(total)}</b>\n\n` +
    `هل تريد إضافة هذا الطلب للنظام؟`;

  const kb: TelegramInlineKeyboard = {
    inline_keyboard: [
      [
        { text: "➖ 1", callback_data: "qadj:p:-1" },
        { text: "سعر الطلب", callback_data: "none" },
        { text: "➕ 1", callback_data: "qadj:p:1" },
      ],
      [
        { text: "➖ 1", callback_data: "qadj:d:-1" },
        { text: "أجرة التوصيل", callback_data: "none" },
        { text: "➕ 1", callback_data: "qadj:d:1" },
      ],
      [
        { text: "✅ إضافة مباشر", callback_data: "qadd" },
        { text: "❌ تجاهل", callback_data: "main" }
      ]
    ]
  };
  return { text, keyboard: kb };
}

export async function handleTelegramAdminCallback(
  cq: {
    id: string;
    from: { id: number };
    message?: { chat: { id: number }; message_id: number; text?: string };
    data?: string;
  },
  botToken?: string,
): Promise<boolean> {
  const fromId = cq.from?.id;
  console.log(`[admin-callback] Received from: ${fromId}, data: ${cq.data}`);

  if (fromId == null || !(await isTelegramAdminUser(fromId))) {
    console.warn(`[admin-callback] Permission denied for user: ${fromId}`);
    return false;
  }
  const msg = cq.message;
  if (!msg) {
    console.warn(`[admin-callback] No message object in callback`);
    return false;
  }
  if (!isTelegramPrivateChat(msg.chat, fromId)) {
    console.warn(`[admin-callback] Not a private chat: ${msg.chat.id}`);
    return false;
  }

  const parsed = parseTelegramAdminCallback(cq.data?.trim() ?? "");
  if (!parsed) {
    console.warn(`[admin-callback] Failed to parse data: ${cq.data}`);
    return false;
  }

  console.log(`[admin-callback] Parsed Kind: ${parsed.kind}`);
  await answerCallbackQuery(cq.id, undefined, false, botToken).catch(() => {});

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
          botToken,
        );
        if (!edited.ok) {
          await sendTelegramAdminMainMenu(chatId, botToken);
        }
        return true;
      }
      case "super_search_start": {
        await upsertSuperSearchSession(telegramUserId, chatId);
        const kb: TelegramInlineKeyboard = {
          inline_keyboard: [[{ text: "❌ إلغاء", callback_data: "superx" }]],
        };
        const edited = await editTelegramMessage(chatId, messageId, formatSuperSearchPromptHtml(), kb, botToken);
        if (!edited.ok) {
          await sendTelegramMessageWithKeyboardToChat(chatId, formatSuperSearchPromptHtml(), kb, botToken);
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
          botToken,
        );
        if (!edited.ok) {
          await sendTelegramAdminMainMenu(chatId, botToken);
        }
        return true;
      }
      case "super_search_customer": {
        await clearSuperSearchSession(telegramUserId).catch(() => {});
        const d = await formatSuperSearchCustomerDetail(parsed.customerId);
        if (!d) {
          await editTelegramMessage(chatId, messageId, "الزبون غير موجود.", {
            inline_keyboard: [[{ text: "🔍 بحث جديد", callback_data: "superq" }]],
          }, botToken).catch(() => {});
          return true;
        }
        const edited = await editTelegramMessage(chatId, messageId, d.text, d.keyboard, botToken);
        if (!edited.ok) {
          await sendTelegramMessageWithKeyboardToChat(chatId, d.text, d.keyboard, botToken);
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
        if (parsed.slug === "shops") {
          // إذا دخل قسم المحلات، نفعّل وضع البحث التلقائي
          await prisma.telegramBotSession.upsert({
            where: { telegramUserId },
            create: { telegramUserId, chatId, step: "shop_search_name", payload: "" },
            update: { step: "shop_search_name", payload: "" },
          });
        }
        const { text, keyboard } = await renderAdminSection(parsed.slug);
        const edited = await editTelegramMessage(chatId, messageId, text, keyboard, botToken);
        if (!edited.ok) {
          await sendTelegramMessageWithKeyboardToChat(chatId, text, keyboard, botToken);
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
        const edited = await editTelegramMessage(chatId, messageId, text, kb, botToken);
        if (!edited.ok) {
          await sendTelegramMessageWithKeyboardToChat(chatId, text, kb, botToken);
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
        const edited = await editTelegramMessage(chatId, messageId, text, kb, botToken);
        if (!edited.ok) {
          await sendTelegramMessageWithKeyboardToChat(chatId, text, kb, botToken);
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
        const edited = await editTelegramMessage(chatId, messageId, text, kb, botToken);
        if (!edited.ok) {
          await sendTelegramMessageWithKeyboardToChat(chatId, text, kb, botToken);
        }
        return true;
      }
      case "detail": {
        const order = await loadOrderForAdminDetail(parsed.orderNumber);
        if (!order) {
          const errKb: TelegramInlineKeyboard = {
            inline_keyboard: [[{ text: "🔙 رجوع", callback_data: "ord0" }, { text: "🏠 الرئيسية", callback_data: "main" }]],
          };
          await editTelegramMessage(chatId, messageId, "❌ الطلب غير موجود.", errKb, botToken).catch(() => {});
          return true;
        }
        const customerName = order.customer?.name?.trim() || "—";
        const regionName = order.customerRegion?.name ?? "—";
        const body = await formatNewOrderTelegramHtml(
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
            customerLocationUrl: order.customerLocationUrl,
            customerLandmark: order.customerLandmark,
          },
          { omitAdminLink: true },
        );
        const text = `<b>📦 تفاصيل الطلب #${order.orderNumber}</b>\n\n${body}`;
        const kb = orderDetailKeyboard(order.orderNumber, order.id);
        const edited = await editTelegramMessage(chatId, messageId, text, kb, botToken);
        if (!edited.ok) {
          await sendTelegramMessageWithKeyboardToChat(chatId, text, kb, botToken);
        }
        return true;
      }
      case "qadd": {
        const session = await prisma.telegramBotSession.findUnique({ where: { telegramUserId } });
        if (!session || session.step !== "admin_quick_order_confirm") return true;
        const p = JSON.parse(session.payload || "{}");

        // المحل الافتراضي للإدارة (أو أول محل في النظام)
        const defaultShop = await prisma.shop.findFirst({ orderBy: { createdAt: 'asc' } });
        if (!defaultShop) {
          await answerCallbackQuery(cq.id, "لا يوجد محل في النظام لرفع الطلب باسمه", true, botToken);
          return true;
        }

        const order = await prisma.order.create({
          data: {
            shopId: defaultShop.id,
            status: "pending",
            orderType: p.type,
            customerRegionId: p.regionId,
            customerPhone: p.phone,
            orderSubtotal: new Decimal(p.price),
            deliveryPrice: new Decimal(p.deliveryPrice),
            totalAmount: new Decimal(Number(p.price) + Number(p.deliveryPrice)),
            submissionSource: "admin_quick_order",
            orderNoteTime: p.orderNoteTime || "فوري",
          },
        });

        await prisma.telegramBotSession.update({
          where: { telegramUserId },
          data: { step: "idle", payload: "" }
        });

        await notifyTelegramNewOrder(order.id, botToken).catch(() => {});
        void pushNotifyAdminsNewPendingOrder(order.orderNumber).catch(() => {});

        await editTelegramMessage(chatId, messageId, `✅ تم إنشاء الطلب السريع بنجاح!\n\nرقم الطلب: <b>#${order.orderNumber}</b>`, {
          inline_keyboard: [[{ text: "📦 تفاصيل الطلب", callback_data: `det${order.orderNumber}` }], [{ text: "🏠 الرئيسية", callback_data: "main" }]]
        }, botToken);
        return true;
      }
      case "rg_detail": {
        const region = await prisma.region.findUnique({ where: { id: parsed.id } });
        if (!region) {
          await answerCallbackQuery(cq.id, "المنطقة غير موجودة", true, botToken);
          return true;
        }
        const text =
          `<b>📍 إدارة منطقة: ${escapeTelegramHtml(region.name)}</b>\n\n` +
          `💰 سعر التوصيل الحالي: <b>${formatDinarAsAlf(region.deliveryPrice)}</b>\n\n` +
          `يمكنك تعديل السعر باستخدام الأزرار أدناه أو إرسال سعر جديد كرسالة.`;

        const kb: TelegramInlineKeyboard = {
          inline_keyboard: [
            [
              { text: "➖ 1.0", callback_data: `rga:${region.id}:-1000` },
              { text: "تعديل السعر", callback_data: "none" },
              { text: "➕ 1.0", callback_data: `rga:${region.id}:1000` },
            ],
            [
              { text: "➖ 0.5", callback_data: `rga:${region.id}:-500` },
              { text: "➕ 0.5", callback_data: `rga:${region.id}:500` },
            ],
            [
              { text: "📝 إدخال سعر يدوي", callback_data: `rgep:${region.id}` },
              { text: "🏷️ تعديل الاسم", callback_data: `rgen:${region.id}` },
            ],
            [{ text: "🔙 رجوع للمناطق", callback_data: "s:regions" }]
          ]
        };
        await editTelegramMessage(chatId, messageId, text, kb, botToken);
        return true;
      }
      case "rg_adj_price": {
        const region = await prisma.region.findUnique({ where: { id: parsed.id } });
        if (!region) return true;
        const newPrice = Math.max(0, region.deliveryPrice.toNumber() + parsed.amount / 1000);
        await prisma.region.update({
          where: { id: region.id },
          data: { deliveryPrice: new Decimal(newPrice) }
        });
        // إعادة عرض التفاصيل
        return await handleTelegramAdminCallback({ ...cq, data: `rgd:${region.id}` });
      }
      case "rg_edit_name": {
        await prisma.telegramBotSession.upsert({
          where: { telegramUserId },
          create: { telegramUserId, chatId, step: "edit_region_name", payload: JSON.stringify({ id: parsed.id }) },
          update: { step: "edit_region_name", payload: JSON.stringify({ id: parsed.id }) },
        });
        await sendTelegramMessageWithKeyboardToChat(chatId, "⌨️ أرسل الاسم الجديد للمنطقة:", {
          inline_keyboard: [[{ text: "❌ إلغاء", callback_data: `rgd:${parsed.id}` }]]
        });
        return true;
      }
      case "rg_edit_price": {
        await prisma.telegramBotSession.upsert({
          where: { telegramUserId },
          create: { telegramUserId, chatId, step: "edit_region_price", payload: JSON.stringify({ id: parsed.id }) },
          update: { step: "edit_region_price", payload: JSON.stringify({ id: parsed.id }) },
        });
        await sendTelegramMessageWithKeyboardToChat(chatId, "⌨️ أرسل سعر التوصيل الجديد (مثلاً 3.5 أو 5):", {
          inline_keyboard: [[{ text: "❌ إلغاء", callback_data: `rgd:${parsed.id}` }]]
        });
        return true;
      }
      case "qadj": {
        const session = await prisma.telegramBotSession.findUnique({ where: { telegramUserId } });
        if (!session || session.step !== "admin_quick_order_confirm") return true;
        const p = JSON.parse(session.payload || "{}");

        if (parsed.field === "price") {
          p.price = Math.max(0, Number(p.price) + Number(parsed.amount));
        } else {
          p.deliveryPrice = Math.max(0, Number(p.deliveryPrice) + Number(parsed.amount));
        }

        await prisma.telegramBotSession.update({
          where: { telegramUserId },
          data: { payload: JSON.stringify(p) }
        });

        const { text, keyboard } = formatQuickOrderConfirm(p);
        await editTelegramMessage(chatId, messageId, text, keyboard, botToken);
        return true;
      }

      case "cr_detail": {
        const courier = await prisma.courier.findUnique({ where: { id: parsed.id } });
        if (!courier) {
          await answerCallbackQuery(cq.id, "المندوب غير موجود", true, botToken);
          return true;
        }
        const text =
          `<b>بيانات المندوب: ${escapeTelegramHtml(courier.name)}</b>\n\n` +
          `📞 الهاتف: <code>${courier.phone}</code>\n` +
          `🚗 المركبة: ${courier.vehicleType || "غير محدد"}\n` +
          `🛡️ الحالة: ${courier.blocked ? "🚫 محظور" : "✅ نشط"}\n` +
          `📍 متاح للإسناد: ${courier.availableForAssignment ? "نعم" : "لا"}\n\n` +
          `اختر إجراءً:`;

        const kb: TelegramInlineKeyboard = {
          inline_keyboard: [
            [
              { text: courier.blocked ? "🔓 إلغاء الحظر" : "🚫 حظر المندوب", callback_data: `crb:${courier.id}` },
              { text: "✏️ تعديل البيانات", callback_data: `cre:${courier.id}` },
            ],
            [{ text: "🗑️ حذف المندوب نهائياً", callback_data: `crx:${courier.id}` }],
            [{ text: "🔙 رجوع للقائمة", callback_data: "s:couriers" }],
          ],
        };
        await editTelegramMessage(chatId, messageId, text, kb, botToken);
        return true;
      }
      case "cr_toggle_block": {
        const courier = await prisma.courier.findUnique({ where: { id: parsed.id } });
        if (!courier) return true;
        await prisma.courier.update({
          where: { id: parsed.id },
          data: { blocked: !courier.blocked },
        });
        await handleTelegramAdminCallback({ ...cq, data: `crd:${parsed.id}` });
        return true;
      }
      case "cr_delete": {
        // تأكيد الحذف
        const kb: TelegramInlineKeyboard = {
          inline_keyboard: [
            [
              { text: "✅ نعم، احذف", callback_data: `crx_confirm:${parsed.id}` },
              { text: "❌ تراجع", callback_data: `crd:${parsed.id}` },
            ],
          ],
        };
        await editTelegramMessage(chatId, messageId, "<b>⚠️ تنبيه تأكيد الحذف</b>\n\nهل أنت متأكد من حذف هذا المندوب نهائياً من النظام؟ لا يمكن التراجع عن هذا الإجراء.", kb, botToken);
        return true;
      }
      case "cr_edit": {
        await prisma.telegramBotSession.upsert({
          where: { telegramUserId },
          create: { telegramUserId, chatId, step: "await_courier_name", payload: JSON.stringify({ id: parsed.id }) },
          update: { step: "await_courier_name", payload: JSON.stringify({ id: parsed.id }) },
        });
        await editTelegramMessage(chatId, messageId, "<b>تعديل المندوب</b>\n\nأرسل الاسم الجديد للمندوب الآن (أو أرسل 'تجاهل' للإبقاء على الحالي):", {
          inline_keyboard: [[{ text: "❌ إلغاء", callback_data: `crd:${parsed.id}` }]],
        }, botToken);
        return true;
      }
      case "cr_add": {
        await prisma.telegramBotSession.upsert({
          where: { telegramUserId },
          create: { telegramUserId, chatId, step: "add_courier_name", payload: "{}" },
          update: { step: "add_courier_name", payload: "{}" },
        });
        await editTelegramMessage(chatId, messageId, "<b>إضافة مندوب جديد</b>\n\nيرجى إرسال اسم المندوب الرباعي:", {
          inline_keyboard: [[{ text: "❌ إلغاء", callback_data: "s:couriers" }]],
        }, botToken);
        return true;
      }

      // Preparers
      case "pr_detail": {
        const prep = await prisma.companyPreparer.findUnique({ where: { id: parsed.id } });
        if (!prep) return true;
        const text =
          `<b>بيانات المجهز: ${escapeTelegramHtml(prep.name)}</b>\n\n` +
          `🛡️ الحالة: ${prep.active ? "✅ نشط" : "❌ معطل"}\n\n` +
          `اختر إجراءً:`;
        const kb: TelegramInlineKeyboard = {
          inline_keyboard: [
            [
              { text: prep.active ? "❌ تعطيل" : "✅ تفعيل", callback_data: `pra:${prep.id}` },
              { text: "✏️ تعديل الاسم", callback_data: `pre:${prep.id}` },
            ],
            [{ text: "🗑️ حذف المجهز", callback_data: `prx:${prep.id}` }],
            [{ text: "🔙 رجوع للقائمة", callback_data: "s:preparers" }],
          ],
        };
        await editTelegramMessage(chatId, messageId, text, kb, botToken);
        return true;
      }
      case "pr_toggle_active": {
        const prep = await prisma.companyPreparer.findUnique({ where: { id: parsed.id } });
        if (!prep) return true;
        await prisma.companyPreparer.update({
          where: { id: parsed.id },
          data: { active: !prep.active },
        });
        await handleTelegramAdminCallback({ ...cq, data: `prd:${parsed.id}` });
        return true;
      }
      case "pr_add": {
        await prisma.telegramBotSession.upsert({
          where: { telegramUserId },
          create: { telegramUserId, chatId, step: "add_preparer_name", payload: "{}" },
          update: { step: "add_preparer_name", payload: "{}" },
        });
        await editTelegramMessage(chatId, messageId, "<b>إضافة مجهز جديد</b>\n\nيرجى إرسال اسم المجهز:", {
          inline_keyboard: [[{ text: "❌ إلغاء", callback_data: "s:preparers" }]],
        }, botToken);
        return true;
      }
    }
  } catch (e) {
    console.error("[telegram admin panel]", e);
    return true;
  }
}
