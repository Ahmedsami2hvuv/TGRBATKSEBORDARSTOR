/**
 * بوت المحلات (خاص المدير): شاشة المحل تعرض العملاء (يرفعون الطلب) فقط؛ زبائن التوصيل من الإدارة / البحث الخارق.
 */
import { revalidatePath } from "next/cache";
import { rankRegionsByQuery } from "@/lib/arabic-region-search";
import { resizeImageBufferForShop } from "@/lib/image-resize";
import { MAX_ORDER_IMAGE_BYTES, saveShopPhotoFromResizedBuffer } from "@/lib/order-image";
import { prisma } from "@/lib/prisma";
import { getPublicAppUrl } from "@/lib/app-url";
import {
  answerCallbackQuery,
  editTelegramMessage,
  escapeTelegramHtml,
  sendTelegramMessageWithKeyboardToChat,
  telegramDownloadFileById,
  type TelegramInlineKeyboard,
} from "@/lib/telegram";
import { normalizeIraqMobileLocal11 } from "@/lib/whatsapp";

export const SHOP_LIST_PAGE_SIZE = 10;

export type ShopTelegramCallback =
  | { kind: "hub"; page: number }
  | { kind: "add_start" }
  | { kind: "find_start" }
  | { kind: "skip_photo" }
  | { kind: "cancel_flow" }
  | { kind: "detail"; shopId: string }
  | { kind: "edit_menu"; shopId: string }
  | { kind: "edit_name"; shopId: string }
  | { kind: "edit_location"; shopId: string }
  | { kind: "edit_region_search"; shopId: string }
  | { kind: "edit_photo"; shopId: string }
  | { kind: "create_region_pick"; regionId: string }
  | { kind: "edit_region_pick"; regionId: string }
  | { kind: "delete_confirm"; shopId: string }
  | { kind: "delete_yes"; shopId: string }
  | { kind: "employee_menu"; employeeId: string }
  | { kind: "employee_add"; shopId: string }
  | { kind: "employee_edit_name"; employeeId: string }
  | { kind: "employee_edit_phone"; employeeId: string }
  | { kind: "customer_menu"; customerId: string }
  | { kind: "customer_orders"; customerId: string }
  | { kind: "customer_edit_name"; customerId: string }
  | { kind: "customer_edit_phone"; customerId: string }
  | { kind: "customer_del_confirm"; customerId: string }
  | { kind: "customer_del_yes"; customerId: string };

export function parseShopTelegramCallback(raw: string): ShopTelegramCallback | null {
  const t = raw.trim();
  if (t.length > 64) return null;
  if (t === "shadd") return { kind: "add_start" };
  if (t === "shfind") return { kind: "find_start" };
  if (t === "shskp") return { kind: "skip_photo" };
  if (t === "shcancel") return { kind: "cancel_flow" };
  let m = /^shub(\d+)$/.exec(t);
  if (m) {
    const page = Number(m[1]);
    if (Number.isFinite(page) && page >= 0) return { kind: "hub", page };
  }
  m = /^sh:([a-z0-9]+)$/.exec(t);
  if (m?.[1]) return { kind: "detail", shopId: m[1] };
  m = /^she:([a-z0-9]+)$/.exec(t);
  if (m?.[1]) return { kind: "edit_menu", shopId: m[1] };
  m = /^shn:([a-z0-9]+)$/.exec(t);
  if (m?.[1]) return { kind: "edit_name", shopId: m[1] };
  m = /^shl:([a-z0-9]+)$/.exec(t);
  if (m?.[1]) return { kind: "edit_location", shopId: m[1] };
  m = /^shrs:([a-z0-9]+)$/.exec(t);
  if (m?.[1]) return { kind: "edit_region_search", shopId: m[1] };
  m = /^shp:([a-z0-9]+)$/.exec(t);
  if (m?.[1]) return { kind: "edit_photo", shopId: m[1] };
  m = /^scr:([a-z0-9]+)$/.exec(t);
  if (m?.[1]) return { kind: "create_region_pick", regionId: m[1] };
  m = /^hsr:([a-z0-9]+)$/.exec(t);
  if (m?.[1]) return { kind: "edit_region_pick", regionId: m[1] };
  m = /^shd:([a-z0-9]+)$/.exec(t);
  if (m?.[1]) return { kind: "delete_confirm", shopId: m[1] };
  m = /^shy:([a-z0-9]+)$/.exec(t);
  if (m?.[1]) return { kind: "delete_yes", shopId: m[1] };
  m = /^sem:([a-z0-9]+)$/.exec(t);
  if (m?.[1]) return { kind: "employee_menu", employeeId: m[1] };
  m = /^sea:([a-z0-9]+)$/.exec(t);
  if (m?.[1]) return { kind: "employee_add", shopId: m[1] };
  m = /^sca:([a-z0-9]+)$/.exec(t);
  if (m?.[1]) return { kind: "employee_add", shopId: m[1] };
  m = /^enm:([a-z0-9]+)$/.exec(t);
  if (m?.[1]) return { kind: "employee_edit_name", employeeId: m[1] };
  m = /^enp:([a-z0-9]+)$/.exec(t);
  if (m?.[1]) return { kind: "employee_edit_phone", employeeId: m[1] };
  m = /^scm:([a-z0-9]+)$/.exec(t);
  if (m?.[1]) return { kind: "customer_menu", customerId: m[1] };
  m = /^sot:([a-z0-9]+)$/.exec(t);
  if (m?.[1]) return { kind: "customer_orders", customerId: m[1] };
  m = /^sen:([a-z0-9]+)$/.exec(t);
  if (m?.[1]) return { kind: "customer_edit_name", customerId: m[1] };
  m = /^sep:([a-z0-9]+)$/.exec(t);
  if (m?.[1]) return { kind: "customer_edit_phone", customerId: m[1] };
  m = /^scd:([a-z0-9]+)$/.exec(t);
  if (m?.[1]) return { kind: "customer_del_confirm", customerId: m[1] };
  m = /^scy:([a-z0-9]+)$/.exec(t);
  if (m?.[1]) return { kind: "customer_del_yes", customerId: m[1] };
  return null;
}

function normalizeUrl(raw: string): string {
  const s = raw.trim();
  if (!s) return s;
  if (/^https?:\/\//i.test(s)) return s;
  return `https://${s}`;
}

async function upsertShopSession(
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

async function clearShopSession(telegramUserId: string): Promise<void> {
  await prisma.telegramBotSession.updateMany({
    where: { telegramUserId },
    data: { step: "idle", orderNumber: null, payload: "" },
  });
}

type ShopDraft = {
  name?: string;
  regionId?: string;
  locationUrl?: string;
  photoUrl?: string;
};

function hubKeyboard(page: number, total: number): TelegramInlineKeyboard["inline_keyboard"] {
  const totalPages = Math.max(1, Math.ceil(total / SHOP_LIST_PAGE_SIZE));
  const nav: Array<{ text: string; callback_data: string }> = [];
  if (page > 0) nav.push({ text: "⬅️ السابق", callback_data: `shub${page - 1}` });
  nav.push({ text: "🏠 رئيسية", callback_data: "main" });
  if (page < totalPages - 1) nav.push({ text: "التالي ➡️", callback_data: `shub${page + 1}` });
  return [nav];
}

export async function renderShopsTelegramHub(page: number): Promise<{
  text: string;
  keyboard: TelegramInlineKeyboard;
}> {
  const total = await prisma.shop.count();
  const shops = await prisma.shop.findMany({
    orderBy: { name: "asc" },
    skip: page * SHOP_LIST_PAGE_SIZE,
    take: SHOP_LIST_PAGE_SIZE,
    select: { id: true, name: true, region: { select: { name: true } } },
  });
  const totalPages = Math.max(1, Math.ceil(total / SHOP_LIST_PAGE_SIZE));
  const header =
    `<b>المحلات</b> — صفحة ${page + 1} / ${totalPages} (إجمالي ${total})\n\n` +
    `اضغط اسم المحل للتفاصيل والتعديل. أو استخدم «بحث» ثم اكتب جزءاً من الاسم.\n\n`;
  const rows: TelegramInlineKeyboard["inline_keyboard"] = [];
  for (const s of shops) {
    const label = `${s.name} (${s.region.name})`.slice(0, 64);
    rows.push([{ text: label, callback_data: `sh:${s.id}` }]);
  }
  rows.push([
    { text: "➕ إضافة محل", callback_data: "shadd" },
    { text: "🔍 بحث بالاسم", callback_data: "shfind" },
  ]);
  rows.push(...hubKeyboard(page, total));
  return {
    text: header + (shops.length === 0 ? "لا توجد محلات بعد." : ""),
    keyboard: { inline_keyboard: rows },
  };
}

async function formatShopDetail(shopId: string): Promise<{
  text: string;
  keyboard: TelegramInlineKeyboard;
} | null> {
  const shop = await prisma.shop.findUnique({
    where: { id: shopId },
    include: {
      region: true,
      employees: { orderBy: { name: "asc" }, take: 40, select: { id: true, name: true, phone: true } },
    },
  });
  if (!shop) return null;
  const loc = normalizeUrl(shop.locationUrl);
  let locLine = escapeTelegramHtml(shop.locationUrl);
  try {
    const u = new URL(loc);
    locLine = `<a href="${escapeTelegramHtml(u.toString())}">فتح اللوكيشن على الخرائط</a>`;
  } catch {
    locLine = escapeTelegramHtml(shop.locationUrl);
  }
  const lines = [
    `<b>${escapeTelegramHtml(shop.name)}</b>`,
    `🗺️ المنطقة: ${escapeTelegramHtml(shop.region.name)}`,
    `📞 الهاتف: ${escapeTelegramHtml(shop.phone || "—")}`,
    `📍 اللوكيشن: ${locLine}`,
    shop.ownerName ? `👤 صاحب المحل: ${escapeTelegramHtml(shop.ownerName)}` : null,
    shop.photoUrl ? `🖼️ صورة: مرفوعة` : `🖼️ صورة: لا`,
  ].filter(Boolean);
  lines.push(
    "",
    "<b>من يفعل ماذا؟</b>",
    "• <b>العميل</b> (مسجّل أدناه ضمن «العملاء»): ي<b>رفع الطلب</b> من رابط المحل.",
    "• <b>الإدارة</b>: تدير الطلبات وت<b>سنّد</b>ها للمندوب.",
    "• <b>المندوب</b>: ي<b>ستلم</b> الطلب وي<b>سلّم</b>ه لـ<b>الزبون</b> (وجهة التوصيل).",
    "",
    "<b>العملاء</b> <i>— من يرفع الطلب من رابط المحل</i>",
    "اضغط زراً أدناه لكل عميل — وليس لزبائن التوصيل.",
    "",
  );
  if (shop.employees.length === 0) {
    lines.push("لا يوجد عملاء مسجّلون. أضفهم من الرابط أدناه أو من لوحة الإدارة.");
  } else {
    lines.push(`عدد العملاء: <b>${shop.employees.length}</b>`);
  }
  lines.push(
    "",
    "<i>زبائن التوصيل (وجهة التسليم) لا تُعرض هنا — من لوحة الإدارة «بيانات الزبائن» أو «بحث خارق» في البوت.</i>",
  );
  const base = getPublicAppUrl();
  const kbRows: TelegramInlineKeyboard["inline_keyboard"] = [
    [
      { text: "✏️ تعديل الاسم", callback_data: `shn:${shop.id}` },
      { text: "🌍 تعديل المنطقة", callback_data: `shrs:${shop.id}` },
    ],
    [
      { text: "📍 تعديل اللوكيشن", callback_data: `shl:${shop.id}` },
      { text: "🖼️ تعديل الصورة", callback_data: `shp:${shop.id}` },
    ],
    [
      { text: "➕ إضافة عميل", callback_data: `sea:${shop.id}` },
      {
        text: "🔗 إدارة العملاء (لوحة)",
        url: `${base}/admin/shops/${shop.id}/employees`,
      },
    ],
  ];
  for (const e of shop.employees) {
    const short = (e.name?.trim() || e.phone).slice(0, 52) || "عميل";
    kbRows.push([{ text: `📤 عميل: ${short}`.slice(0, 64), callback_data: `sem:${e.id}` }]);
  }
  kbRows.push([
    { text: "🗑️ حذف المحل", callback_data: `shd:${shop.id}` },
    { text: "⬅️ قائمة المحلات", callback_data: "shub0" },
  ]);
  return { text: lines.join("\n"), keyboard: { inline_keyboard: kbRows } };
}

async function formatEmployeeMenu(employeeId: string): Promise<{
  text: string;
  keyboard: TelegramInlineKeyboard;
} | null> {
  const emp = await prisma.employee.findUnique({
    where: { id: employeeId },
    include: { shop: { select: { id: true, name: true } } },
  });
  if (!emp) return null;
  const base = getPublicAppUrl();
  const lines = [
    `<b>عميل المحل</b> <i>(يرفع الطلب — ليس زبون توصيل)</i>`,
    `<b>${escapeTelegramHtml(emp.name.trim() || "—")}</b>`,
    `📞 <code>${escapeTelegramHtml(emp.phone)}</code>`,
    `🏪 ${escapeTelegramHtml(emp.shop.name)}`,
  ];
  const rows: TelegramInlineKeyboard["inline_keyboard"] = [
    [
      { text: "✏️ الاسم", callback_data: `enm:${emp.id}` },
      { text: "✏️ الهاتف", callback_data: `enp:${emp.id}` },
    ],
    [
      {
        text: "🔗 تعديل في لوحة الإدارة",
        url: `${base}/admin/shops/${emp.shopId}/employees/${emp.id}/edit`,
      },
    ],
    [
      {
        text: "🔗 صفحة عملاء المحل",
        url: `${base}/admin/shops/${emp.shopId}/employees`,
      },
    ],
    [{ text: "⬅️ المحل", callback_data: `sh:${emp.shopId}` }],
  ];
  return { text: lines.join("\n"), keyboard: { inline_keyboard: rows } };
}

async function formatCustomerMenu(customerId: string): Promise<{
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
  const profileRegionId = cust.customerRegionId ?? cust.shop.regionId;
  const [ordersInShop, profile] = await Promise.all([
    prisma.order.count({ where: { shopId: cust.shopId, customerId: cust.id } }),
    prisma.customerPhoneProfile.findUnique({
      where: { phone_regionId: { phone: cust.phone, regionId: profileRegionId } },
      select: { id: true },
    }),
  ]);
  const base = getPublicAppUrl();
  const phoneQ = encodeURIComponent(cust.phone);
  const lines = [
    `<b>زبون التوصيل</b> <i>(وجهة التسليم — ليس رافع الطلب)</i>`,
    `<b>${escapeTelegramHtml(cust.name?.trim() || cust.phone)}</b>`,
    `🏪 المحل: ${escapeTelegramHtml(cust.shop.name)}`,
    `🗺️ المنطقة: ${escapeTelegramHtml(regionName)}`,
    `📞 الهاتف: <code>${escapeTelegramHtml(cust.phone)}</code>`,
    cust.alternatePhone
      ? `📞 ثانٍ: <code>${escapeTelegramHtml(cust.alternatePhone)}</code>`
      : null,
    cust.customerLocationUrl.trim()
      ? `📍 لوكيشن: ${escapeTelegramHtml(cust.customerLocationUrl)}`
      : null,
    cust.customerLandmark.trim() ? `📌 أقرب نقطة: ${escapeTelegramHtml(cust.customerLandmark)}` : null,
    cust.customerDoorPhotoUrl ? `🖼️ صورة باب: مرفوعة` : null,
    `📦 طلبات في هذا المحل: ${ordersInShop}`,
  ].filter(Boolean);
  const row1: Array<{ text: string; callback_data?: string; url?: string }> = [
    { text: "📋 طلبيات زبون التوصيل", callback_data: `sot:${cust.id}` },
  ];
  row1.push({
    text: "🔗 معلومات الزبون في اللوحة",
    url: `${base}/admin/customers/info?phone=${phoneQ}`,
  });
  const rows: TelegramInlineKeyboard["inline_keyboard"] = [row1];
  if (profile) {
    rows.push([
      {
        text: "🔗 الملف المرجعي",
        url: `${base}/admin/customers/profiles/${profile.id}/edit`,
      },
    ]);
  }
  rows.push([
    { text: "✏️ الاسم", callback_data: `sen:${cust.id}` },
    { text: "✏️ الهاتف", callback_data: `sep:${cust.id}` },
  ]);
  rows.push([{ text: "🗑️ حذف زبون التوصيل", callback_data: `scd:${cust.id}` }]);
  rows.push([{ text: "⬅️ المحل", callback_data: `sh:${cust.shopId}` }]);
  return { text: lines.join("\n"), keyboard: { inline_keyboard: rows } };
}

async function formatCustomerOrders(customerId: string): Promise<{
  text: string;
  keyboard: TelegramInlineKeyboard;
} | null> {
  const cust = await prisma.customer.findUnique({
    where: { id: customerId },
    include: { shop: { select: { name: true } } },
  });
  if (!cust) return null;
  const orders = await prisma.order.findMany({
    where: { shopId: cust.shopId, customerId: cust.id },
    orderBy: [{ createdAt: "desc" }, { orderNumber: "desc" }],
    take: 25,
    select: { orderNumber: true, status: true, createdAt: true, summary: true },
  });
  const lines = [
    `<b>طلبيات زبون التوصيل</b> — ${escapeTelegramHtml(cust.name?.trim() || cust.phone)}`,
    `🏪 ${escapeTelegramHtml(cust.shop.name)}`,
    "",
    orders.length === 0
      ? "لا توجد طلبات مرتبطة بهذا الزبون في هذا المحل."
      : orders
          .map((o) => {
            const sum = o.summary?.trim().slice(0, 40) || "—";
            const st = escapeTelegramHtml(o.status);
            return `#${o.orderNumber} — ${st} — ${escapeTelegramHtml(sum)}`;
          })
          .join("\n"),
  ];
  const kb: TelegramInlineKeyboard["inline_keyboard"] = [
    [
      { text: "⬅️ حساب زبون التوصيل", callback_data: `scm:${cust.id}` },
      { text: "⬅️ المحل", callback_data: `sh:${cust.shopId}` },
    ],
  ];
  return { text: lines.join("\n"), keyboard: { inline_keyboard: kb } };
}

export async function handleShopTelegramCallback(cq: {
  id: string;
  from: { id: number };
  message?: { chat: { id: number }; message_id: number; text?: string };
  data?: string;
}): Promise<boolean> {
  const parsed = parseShopTelegramCallback(cq.data?.trim() ?? "");
  if (!parsed) return false;
  const msg = cq.message;
  if (!msg) {
    await answerCallbackQuery(cq.id);
    return true;
  }
  const chatId = String(msg.chat.id);
  const messageId = msg.message_id;
  const telegramUserId = String(cq.from.id);

  await answerCallbackQuery(cq.id).catch(() => {});

  try {
    switch (parsed.kind) {
      case "cancel_flow": {
        await clearShopSession(telegramUserId);
        const hub = await renderShopsTelegramHub(0);
        await editTelegramMessage(chatId, messageId, hub.text, hub.keyboard).catch(() => {});
        return true;
      }
      case "hub": {
        const hub = await renderShopsTelegramHub(parsed.page);
        await editTelegramMessage(chatId, messageId, hub.text, hub.keyboard);
        return true;
      }
      case "add_start": {
        await upsertShopSession(telegramUserId, chatId, "shop_create_name", JSON.stringify({ draft: {} as ShopDraft }));
        await editTelegramMessage(
          chatId,
          messageId,
          `<b>إضافة محل</b>\n\nاكتب <b>اسم المحل</b> في رسالة تالية.\n\nللإلغاء: /cancel_shop`,
          {
            inline_keyboard: [[{ text: "❌ إلغاء", callback_data: "shcancel" }]],
          },
        );
        return true;
      }
      case "find_start": {
        await upsertShopSession(telegramUserId, chatId, "shop_search_name", "");
        await editTelegramMessage(
          chatId,
          messageId,
          `<b>بحث عن محل</b>\n\nاكتب جزءاً من اسم المحل لعرض النتائج.\n\nللإلغاء: /cancel_shop`,
          {
            inline_keyboard: [[{ text: "❌ إلغاء", callback_data: "shcancel" }]],
          },
        );
        return true;
      }
      case "detail": {
        const d = await formatShopDetail(parsed.shopId);
        if (!d) {
          await editTelegramMessage(chatId, messageId, "المحل غير موجود.", {
            inline_keyboard: [[{ text: "⬅️ المحلات", callback_data: "shub0" }]],
          });
          return true;
        }
        await editTelegramMessage(chatId, messageId, d.text, d.keyboard);
        return true;
      }
      case "edit_menu": {
        const d = await formatShopDetail(parsed.shopId);
        if (!d) return true;
        await editTelegramMessage(chatId, messageId, d.text, d.keyboard);
        return true;
      }
      case "edit_name": {
        await upsertShopSession(telegramUserId, chatId, "shop_edit_name", JSON.stringify({ shopId: parsed.shopId }));
        await editTelegramMessage(
          chatId,
          messageId,
          `اكتب <b>الاسم الجديد</b> للمحل.\n\nللإلغاء: /cancel_shop`,
          { inline_keyboard: [[{ text: "❌ إلغاء", callback_data: "shcancel" }]] },
        );
        return true;
      }
      case "edit_location": {
        await upsertShopSession(telegramUserId, chatId, "shop_edit_location", JSON.stringify({ shopId: parsed.shopId }));
        await editTelegramMessage(
          chatId,
          messageId,
          `أرسل <b>رابط خرائط Google</b> أو نصاً يبدأ بـ http(s) للوكيشن.\n\nللإلغاء: /cancel_shop`,
          { inline_keyboard: [[{ text: "❌ إلغاء", callback_data: "shcancel" }]] },
        );
        return true;
      }
      case "edit_region_search": {
        await upsertShopSession(
          telegramUserId,
          chatId,
          "shop_edit_region_query",
          JSON.stringify({ shopId: parsed.shopId }),
        );
        await editTelegramMessage(
          chatId,
          messageId,
          `اكتب اسم <b>المنطقة</b> للبحث ثم اختر من القائمة.\n\nللإلغاء: /cancel_shop`,
          { inline_keyboard: [[{ text: "❌ إلغاء", callback_data: "shcancel" }]] },
        );
        return true;
      }
      case "edit_photo": {
        await upsertShopSession(telegramUserId, chatId, "shop_edit_photo", JSON.stringify({ shopId: parsed.shopId }));
        await editTelegramMessage(
          chatId,
          messageId,
          `أرسل <b>صورة المحل</b> كصورة (وليس ملفاً).\n\nللإلغاء: /cancel_shop`,
          { inline_keyboard: [[{ text: "❌ إلغاء", callback_data: "shcancel" }]] },
        );
        return true;
      }
      case "edit_region_pick": {
        const session = await prisma.telegramBotSession.findUnique({ where: { telegramUserId } });
        if (!session || session.step !== "shop_edit_region_query") return true;
        const p = JSON.parse(session.payload || "{}") as { shopId?: string };
        if (!p.shopId) return true;
        const region = await prisma.region.findUnique({ where: { id: parsed.regionId } });
        if (!region) return true;
        await prisma.shop.update({
          where: { id: p.shopId },
          data: { regionId: region.id },
        });
        revalidatePath("/admin/shops");
        await clearShopSession(telegramUserId);
        const d = await formatShopDetail(p.shopId);
        if (d) await editTelegramMessage(chatId, messageId, `✅ تم تحديث المنطقة.\n\n${d.text}`, d.keyboard);
        return true;
      }
      case "create_region_pick": {
        const session = await prisma.telegramBotSession.findUnique({ where: { telegramUserId } });
        if (!session || session.step !== "shop_create_region_query") return true;
        const draft = JSON.parse(session.payload || "{}") as { draft?: ShopDraft };
        const region = await prisma.region.findUnique({ where: { id: parsed.regionId } });
        if (!region || !draft.draft?.name) return true;
        draft.draft.regionId = region.id;
        await upsertShopSession(
          telegramUserId,
          chatId,
          "shop_create_location",
          JSON.stringify({ draft: draft.draft }),
        );
        await editTelegramMessage(
          chatId,
          messageId,
          `<b>اللوكيشن</b>\n\nأرسل رابط خرائط Google أو رابطاً يبدأ بـ https لموقع المحل.\n\nللإلغاء: /cancel_shop`,
          { inline_keyboard: [[{ text: "❌ إلغاء", callback_data: "shcancel" }]] },
        );
        return true;
      }
      case "skip_photo": {
        const session = await prisma.telegramBotSession.findUnique({ where: { telegramUserId } });
        if (!session || session.step !== "shop_create_photo") return true;
        const { draft } = JSON.parse(session.payload || "{}") as { draft?: ShopDraft };
        if (!draft?.name || !draft.regionId || !draft.locationUrl) return true;
        await prisma.shop.create({
          data: {
            name: draft.name,
            ownerName: "",
            phone: "",
            photoUrl: "",
            locationUrl: draft.locationUrl,
            regionId: draft.regionId,
          },
        });
        revalidatePath("/admin/shops");
        await clearShopSession(telegramUserId);
        const hub = await renderShopsTelegramHub(0);
        await editTelegramMessage(chatId, messageId, `✅ تم إنشاء المحل.\n\n${hub.text}`, hub.keyboard);
        return true;
      }
      case "delete_confirm": {
        await editTelegramMessage(
          chatId,
          messageId,
          `⚠️ تأكيد حذف المحل وجميع زبائنه وموظفيه المرتبطين به؟`,
          {
            inline_keyboard: [
              [
                { text: "✅ نعم احذف", callback_data: `shy:${parsed.shopId}` },
                { text: "❌ لا", callback_data: `sh:${parsed.shopId}` },
              ],
            ],
          },
        );
        return true;
      }
      case "delete_yes": {
        await prisma.shop.delete({ where: { id: parsed.shopId } });
        revalidatePath("/admin/shops");
        const hub = await renderShopsTelegramHub(0);
        await editTelegramMessage(chatId, messageId, `✅ تم حذف المحل.\n\n${hub.text}`, hub.keyboard);
        return true;
      }
      case "employee_menu": {
        await clearShopSession(telegramUserId);
        const d = await formatEmployeeMenu(parsed.employeeId);
        if (!d) {
          await editTelegramMessage(chatId, messageId, "العميل غير موجود.", {
            inline_keyboard: [[{ text: "⬅️ المحلات", callback_data: "shub0" }]],
          });
          return true;
        }
        await editTelegramMessage(chatId, messageId, d.text, d.keyboard);
        return true;
      }
      case "employee_add": {
        const shopRow = await prisma.shop.findUnique({ where: { id: parsed.shopId }, select: { id: true } });
        if (!shopRow) {
          await editTelegramMessage(chatId, messageId, "المحل غير موجود.", {
            inline_keyboard: [[{ text: "⬅️ المحلات", callback_data: "shub0" }]],
          });
          return true;
        }
        await upsertShopSession(
          telegramUserId,
          chatId,
          "shop_emp_add_phone",
          JSON.stringify({ shopId: parsed.shopId }),
        );
        await editTelegramMessage(
          chatId,
          messageId,
          `<b>إضافة عميل</b> <i>(يرفع الطلب من رابط المحل)</i>\n\n` +
            `أرسل <b>رقم هاتفه</b> العراقي (07…).\n\nللإلغاء: /cancel_shop`,
          { inline_keyboard: [[{ text: "❌ إلغاء", callback_data: `sh:${parsed.shopId}` }]] },
        );
        return true;
      }
      case "employee_edit_name": {
        const emp = await prisma.employee.findUnique({ where: { id: parsed.employeeId }, select: { id: true } });
        if (!emp) {
          await editTelegramMessage(chatId, messageId, "العميل غير موجود.", {
            inline_keyboard: [[{ text: "⬅️ المحلات", callback_data: "shub0" }]],
          });
          return true;
        }
        await upsertShopSession(
          telegramUserId,
          chatId,
          "shop_edit_employee_name",
          JSON.stringify({ employeeId: parsed.employeeId }),
        );
        await editTelegramMessage(
          chatId,
          messageId,
          `اكتب <b>الاسم الجديد</b> للعميل.\n\nللإلغاء: /cancel_shop`,
          { inline_keyboard: [[{ text: "❌ إلغاء", callback_data: `sem:${parsed.employeeId}` }]] },
        );
        return true;
      }
      case "employee_edit_phone": {
        const emp = await prisma.employee.findUnique({ where: { id: parsed.employeeId }, select: { id: true } });
        if (!emp) {
          await editTelegramMessage(chatId, messageId, "العميل غير موجود.", {
            inline_keyboard: [[{ text: "⬅️ المحلات", callback_data: "shub0" }]],
          });
          return true;
        }
        await upsertShopSession(
          telegramUserId,
          chatId,
          "shop_edit_employee_phone",
          JSON.stringify({ employeeId: parsed.employeeId }),
        );
        await editTelegramMessage(
          chatId,
          messageId,
          `أرسل <b>رقم الهاتف الجديد</b> العراقي (07…).\n\nللإلغاء: /cancel_shop`,
          { inline_keyboard: [[{ text: "❌ إلغاء", callback_data: `sem:${parsed.employeeId}` }]] },
        );
        return true;
      }
      case "customer_menu": {
        await clearShopSession(telegramUserId);
        const d = await formatCustomerMenu(parsed.customerId);
        if (!d) {
          await editTelegramMessage(chatId, messageId, "زبون التوصيل غير موجود.", {
            inline_keyboard: [[{ text: "⬅️ المحلات", callback_data: "shub0" }]],
          });
          return true;
        }
        await editTelegramMessage(chatId, messageId, d.text, d.keyboard);
        return true;
      }
      case "customer_orders": {
        const d = await formatCustomerOrders(parsed.customerId);
        if (!d) {
          await editTelegramMessage(chatId, messageId, "زبون التوصيل غير موجود.", {
            inline_keyboard: [[{ text: "⬅️ المحلات", callback_data: "shub0" }]],
          });
          return true;
        }
        await editTelegramMessage(chatId, messageId, d.text, d.keyboard);
        return true;
      }
      case "customer_edit_name": {
        await upsertShopSession(
          telegramUserId,
          chatId,
          "shop_edit_customer_name",
          JSON.stringify({ customerId: parsed.customerId }),
        );
        await editTelegramMessage(
          chatId,
          messageId,
          `اكتب <b>الاسم الجديد</b> للزبون.\n\nللإلغاء: /cancel_shop`,
          { inline_keyboard: [[{ text: "❌ إلغاء", callback_data: `scm:${parsed.customerId}` }]] },
        );
        return true;
      }
      case "customer_edit_phone": {
        await upsertShopSession(
          telegramUserId,
          chatId,
          "shop_edit_customer_phone",
          JSON.stringify({ customerId: parsed.customerId }),
        );
        await editTelegramMessage(
          chatId,
          messageId,
          `أرسل <b>رقم هاتف زبون التوصيل</b> العراقي (مثال 07xxxxxxxx).\n\nللإلغاء: /cancel_shop`,
          { inline_keyboard: [[{ text: "❌ إلغاء", callback_data: `scm:${parsed.customerId}` }]] },
        );
        return true;
      }
      case "customer_del_confirm": {
        const cust = await prisma.customer.findUnique({
          where: { id: parsed.customerId },
          include: { shop: { select: { name: true } } },
        });
        if (!cust) return true;
        await editTelegramMessage(
          chatId,
          messageId,
          `حذف <b>زبون التوصيل</b> «${escapeTelegramHtml(cust.name || cust.phone)}» من محل «${escapeTelegramHtml(cust.shop.name)}»؟`,
          {
            inline_keyboard: [
              [
                { text: "✅ حذف", callback_data: `scy:${cust.id}` },
                { text: "❌ إلغاء", callback_data: `scm:${cust.id}` },
              ],
            ],
          },
        );
        return true;
      }
      case "customer_del_yes": {
        const cust = await prisma.customer.findUnique({ where: { id: parsed.customerId } });
        if (!cust) return true;
        const shopId = cust.shopId;
        await prisma.customer.delete({ where: { id: parsed.customerId } });
        revalidatePath("/admin/shops");
        revalidatePath("/admin/customers");
        const d = await formatShopDetail(shopId);
        if (d) await editTelegramMessage(chatId, messageId, `✅ تم حذف زبون التوصيل.\n\n${d.text}`, d.keyboard);
        return true;
      }
      default:
        return true;
    }
  } catch (e) {
    console.error("[telegram shop]", e);
    return true;
  }
}

async function finishCreateShop(telegramUserId: string, chatId: string, draft: ShopDraft): Promise<void> {
  if (!draft.name || !draft.regionId || !draft.locationUrl) return;
  await prisma.shop.create({
    data: {
      name: draft.name,
      ownerName: "",
      phone: "",
      photoUrl: draft.photoUrl ?? "",
      locationUrl: draft.locationUrl,
      regionId: draft.regionId,
    },
  });
  revalidatePath("/admin/shops");
  await clearShopSession(telegramUserId);
  const hub = await renderShopsTelegramHub(0);
  await sendTelegramMessageWithKeyboardToChat(chatId, `✅ تم إنشاء المحل.\n\n${hub.text}`, hub.keyboard);
}

export async function handleShopTelegramMessage(message: {
  message_id: number;
  from?: { id: number };
  chat: { id: number };
  text?: string;
  photo?: Array<{ file_id: string; file_size?: number; width?: number; height?: number }>;
  document?: { file_id: string; mime_type?: string; file_name?: string };
}): Promise<boolean> {
  const fromId = message.from?.id;
  if (fromId == null) return false;
  const telegramUserId = String(fromId);
  const chatId = String(message.chat.id);

  const session = await prisma.telegramBotSession.findUnique({
    where: { telegramUserId },
  });
  if (!session || session.step === "idle" || !session.step.startsWith("shop_")) {
    const txt = message.text?.trim() ?? "";
    if (txt === "/cancel_shop") {
      await clearShopSession(telegramUserId);
      await sendTelegramMessageWithKeyboardToChat(
        chatId,
        "تم الإلغاء.",
        { inline_keyboard: [[{ text: "📋 المحلات", callback_data: "shub0" }]] },
      );
      return true;
    }
    return false;
  }

  const step = session.step;

  if (step === "shop_search_name") {
    const q = message.text?.trim() ?? "";
    if (!q) return true;
    const shops = await prisma.shop.findMany({
      where: { name: { contains: q, mode: "insensitive" } },
      orderBy: { name: "asc" },
      take: 20,
      select: { id: true, name: true, region: { select: { name: true } } },
    });
    await clearShopSession(telegramUserId);
    const rows: TelegramInlineKeyboard["inline_keyboard"] = [];
    for (const s of shops) {
      rows.push([{ text: `${s.name} (${s.region.name})`.slice(0, 64), callback_data: `sh:${s.id}` }]);
    }
    rows.push([{ text: "⬅️ كل المحلات", callback_data: "shub0" }]);
    await sendTelegramMessageWithKeyboardToChat(
      chatId,
      shops.length === 0
        ? `لا توجد نتائج لـ «${escapeTelegramHtml(q)}».`
        : `<b>نتائج البحث</b> عن «${escapeTelegramHtml(q)}»`,
      { inline_keyboard: rows },
    );
    return true;
  }

  if (step === "shop_create_name") {
    const name = message.text?.trim() ?? "";
    if (!name) return true;
    const draft: ShopDraft = { name };
    await upsertShopSession(
      telegramUserId,
      chatId,
      "shop_create_region_query",
      JSON.stringify({ draft }),
    );
    await sendTelegramMessageWithKeyboardToChat(
      chatId,
      `المنطقة: اكتب اسماً للبحث عن المنطقة.`,
      { inline_keyboard: [[{ text: "❌ إلغاء", callback_data: "shcancel" }]] },
    );
    return true;
  }

  if (step === "shop_create_region_query") {
    const q = message.text?.trim() ?? "";
    if (!q) return true;
    const { draft } = JSON.parse(session.payload || "{}") as { draft?: ShopDraft };
    if (!draft?.name) return true;
    const all = await prisma.region.findMany({ select: { id: true, name: true } });
    const ranked = rankRegionsByQuery(q, all, 8);
    if (ranked.length === 0) {
      await sendTelegramMessageWithKeyboardToChat(
        chatId,
        "لم نجد منطقة. جرّب اسماً آخر.",
        { inline_keyboard: [[{ text: "❌ إلغاء", callback_data: "shcancel" }]] },
      );
      return true;
    }
    const rows: TelegramInlineKeyboard["inline_keyboard"] = ranked.map((r) => [
      { text: r.name.slice(0, 64), callback_data: `scr:${r.id}` },
    ]);
    rows.push([{ text: "❌ إلغاء", callback_data: "shcancel" }]);
    await sendTelegramMessageWithKeyboardToChat(chatId, "اختر المنطقة:", { inline_keyboard: rows });
    return true;
  }

  if (step === "shop_create_location") {
    const raw = message.text?.trim() ?? "";
    if (!raw) return true;
    const url = normalizeUrl(raw);
    try {
      new URL(url);
    } catch {
      await sendTelegramMessageWithKeyboardToChat(
        chatId,
        "الرابط غير صالح. أرسل رابطاً كاملاً يبدأ بـ http(s).",
        { inline_keyboard: [[{ text: "❌ إلغاء", callback_data: "shcancel" }]] },
      );
      return true;
    }
    const { draft } = JSON.parse(session.payload || "{}") as { draft?: ShopDraft };
    if (!draft?.regionId) return true;
    draft.locationUrl = url;
    await upsertShopSession(
      telegramUserId,
      chatId,
      "shop_create_photo",
      JSON.stringify({ draft }),
    );
    await sendTelegramMessageWithKeyboardToChat(
      chatId,
      `الصورة: أرسل صورة للمحل، أو اضغط «بدون صورة».`,
      {
        inline_keyboard: [
          [{ text: "⏭️ بدون صورة", callback_data: "shskp" }],
          [{ text: "❌ إلغاء", callback_data: "shcancel" }],
        ],
      },
    );
    return true;
  }

  if (step === "shop_create_photo") {
    const fileId = pickTelegramImageFileId(message);
    if (!fileId) {
      await sendTelegramMessageWithKeyboardToChat(
        chatId,
        "أرسل صورة (صورة مباشرة) أو اضغط «بدون صورة».",
        {
          inline_keyboard: [
            [{ text: "⏭️ بدون صورة", callback_data: "shskp" }],
            [{ text: "❌ إلغاء", callback_data: "shcancel" }],
          ],
        },
      );
      return true;
    }
    const { draft } = JSON.parse(session.payload || "{}") as { draft?: ShopDraft };
    if (!draft?.name || !draft.regionId || !draft.locationUrl) return true;
    try {
      const buf = await telegramDownloadFileById(fileId);
      const jpeg = await resizeImageBufferForShop(buf);
      const photoUrl = await saveShopPhotoFromResizedBuffer(jpeg, MAX_ORDER_IMAGE_BYTES);
      draft.photoUrl = photoUrl;
      await finishCreateShop(telegramUserId, chatId, draft);
    } catch (e) {
      console.error("[shop photo]", e);
      await sendTelegramMessageWithKeyboardToChat(
        chatId,
        "تعذّر معالجة الصورة. جرّب صورة أصغر أو بدون صورة.",
        {
          inline_keyboard: [
            [{ text: "⏭️ بدون صورة", callback_data: "shskp" }],
            [{ text: "❌ إلغاء", callback_data: "shcancel" }],
          ],
        },
      );
    }
    return true;
  }

  if (step === "shop_edit_name") {
    const name = message.text?.trim() ?? "";
    if (!name) return true;
    const p = JSON.parse(session.payload || "{}") as { shopId?: string };
    if (!p.shopId) return true;
    await prisma.shop.update({ where: { id: p.shopId }, data: { name } });
    revalidatePath("/admin/shops");
    await clearShopSession(telegramUserId);
    const d = await formatShopDetail(p.shopId);
    if (d) {
      await sendTelegramMessageWithKeyboardToChat(chatId, `✅ تم تحديث الاسم.\n\n${d.text}`, d.keyboard);
    }
    return true;
  }

  if (step === "shop_edit_location") {
    const raw = message.text?.trim() ?? "";
    if (!raw) return true;
    const url = normalizeUrl(raw);
    try {
      new URL(url);
    } catch {
      await sendTelegramMessageWithKeyboardToChat(chatId, "رابط غير صالح.", {
        inline_keyboard: [[{ text: "❌ إلغاء", callback_data: "shcancel" }]],
      });
      return true;
    }
    const p = JSON.parse(session.payload || "{}") as { shopId?: string };
    if (!p.shopId) return true;
    await prisma.shop.update({ where: { id: p.shopId }, data: { locationUrl: url } });
    revalidatePath("/admin/shops");
    await clearShopSession(telegramUserId);
    const d = await formatShopDetail(p.shopId);
    if (d) await sendTelegramMessageWithKeyboardToChat(chatId, `✅ تم تحديث اللوكيشن.\n\n${d.text}`, d.keyboard);
    return true;
  }

  if (step === "shop_edit_region_query") {
    const q = message.text?.trim() ?? "";
    if (!q) return true;
    const p = JSON.parse(session.payload || "{}") as { shopId?: string };
    if (!p.shopId) return true;
    const all = await prisma.region.findMany({ select: { id: true, name: true } });
    const ranked = rankRegionsByQuery(q, all, 8);
    if (ranked.length === 0) {
      await sendTelegramMessageWithKeyboardToChat(chatId, "لم نجد منطقة.", {
        inline_keyboard: [[{ text: "❌ إلغاء", callback_data: "shcancel" }]],
      });
      return true;
    }
    const rows: TelegramInlineKeyboard["inline_keyboard"] = ranked.map((r) => [
      { text: r.name.slice(0, 64), callback_data: `hsr:${r.id}` },
    ]);
    rows.push([{ text: "❌ إلغاء", callback_data: "shcancel" }]);
    await sendTelegramMessageWithKeyboardToChat(chatId, "اختر المنطقة:", { inline_keyboard: rows });
    return true;
  }

  if (step === "shop_edit_photo") {
    const fileId = pickTelegramImageFileId(message);
    if (!fileId) {
      await sendTelegramMessageWithKeyboardToChat(chatId, "أرسل صورة.", {
        inline_keyboard: [[{ text: "❌ إلغاء", callback_data: "shcancel" }]],
      });
      return true;
    }
    const p = JSON.parse(session.payload || "{}") as { shopId?: string };
    if (!p.shopId) return true;
    try {
      const buf = await telegramDownloadFileById(fileId);
      const jpeg = await resizeImageBufferForShop(buf);
      const photoUrl = await saveShopPhotoFromResizedBuffer(jpeg, MAX_ORDER_IMAGE_BYTES);
      await prisma.shop.update({ where: { id: p.shopId }, data: { photoUrl } });
      revalidatePath("/admin/shops");
      await clearShopSession(telegramUserId);
      const d = await formatShopDetail(p.shopId);
      if (d) await sendTelegramMessageWithKeyboardToChat(chatId, `✅ تم تحديث الصورة.\n\n${d.text}`, d.keyboard);
    } catch (e) {
      console.error("[shop edit photo]", e);
      await sendTelegramMessageWithKeyboardToChat(chatId, "تعذّر حفظ الصورة.", {
        inline_keyboard: [[{ text: "❌ إلغاء", callback_data: "shcancel" }]],
      });
    }
    return true;
  }

  if (step === "shop_emp_add_phone") {
    const phone = normalizeIraqMobileLocal11(message.text?.trim() ?? "");
    if (!phone) {
      const p = JSON.parse(session.payload || "{}") as { shopId?: string };
      await sendTelegramMessageWithKeyboardToChat(chatId, "رقم غير صالح. جرّب 07…", {
        inline_keyboard: [[{ text: "❌ إلغاء", callback_data: p.shopId ? `sh:${p.shopId}` : "shcancel" }]],
      });
      return true;
    }
    const p = JSON.parse(session.payload || "{}") as { shopId?: string };
    if (!p.shopId) return true;
    await upsertShopSession(
      telegramUserId,
      chatId,
      "shop_emp_add_name",
      JSON.stringify({ shopId: p.shopId, phone }),
    );
    await sendTelegramMessageWithKeyboardToChat(
      chatId,
      `اكتب <b>اسم العميل</b> (من يرفع الطلب).`,
      { inline_keyboard: [[{ text: "❌ إلغاء", callback_data: `sh:${p.shopId}` }]] },
    );
    return true;
  }

  if (step === "shop_emp_add_name") {
    const name = message.text?.trim() ?? "";
    if (!name) return true;
    const p = JSON.parse(session.payload || "{}") as { shopId?: string; phone?: string };
    if (!p.shopId || !p.phone) return true;
    const shopRow = await prisma.shop.findUnique({ where: { id: p.shopId }, select: { id: true } });
    if (!shopRow) return true;
    await prisma.employee.create({
      data: {
        shopId: p.shopId,
        name,
        phone: p.phone,
      },
    });
    revalidatePath("/admin/shops");
    revalidatePath(`/admin/shops/${p.shopId}/employees`);
    await clearShopSession(telegramUserId);
    const d = await formatShopDetail(p.shopId);
    if (d) {
      await sendTelegramMessageWithKeyboardToChat(chatId, `✅ تمت إضافة العميل.\n\n${d.text}`, d.keyboard);
    }
    return true;
  }

  if (step === "shop_edit_employee_name") {
    const name = message.text?.trim() ?? "";
    if (!name) return true;
    const p = JSON.parse(session.payload || "{}") as { employeeId?: string };
    if (!p.employeeId) return true;
    const emp = await prisma.employee.findUnique({ where: { id: p.employeeId }, select: { shopId: true } });
    if (!emp) return true;
    await prisma.employee.update({ where: { id: p.employeeId }, data: { name } });
    revalidatePath("/admin/shops");
    revalidatePath(`/admin/shops/${emp.shopId}/employees`);
    revalidatePath(`/admin/shops/${emp.shopId}/employees/${p.employeeId}/edit`);
    await clearShopSession(telegramUserId);
    const d = await formatEmployeeMenu(p.employeeId);
    if (d) {
      await sendTelegramMessageWithKeyboardToChat(chatId, `✅ تم تحديث الاسم.\n\n${d.text}`, d.keyboard);
    }
    return true;
  }

  if (step === "shop_edit_employee_phone") {
    const p = JSON.parse(session.payload || "{}") as { employeeId?: string };
    if (!p.employeeId) return true;
    const phone = normalizeIraqMobileLocal11(message.text?.trim() ?? "");
    if (!phone) {
      await sendTelegramMessageWithKeyboardToChat(chatId, "رقم غير صالح. جرّب 07…", {
        inline_keyboard: [[{ text: "❌ إلغاء", callback_data: `sem:${p.employeeId}` }]],
      });
      return true;
    }
    const emp = await prisma.employee.findUnique({ where: { id: p.employeeId }, select: { shopId: true } });
    if (!emp) return true;
    await prisma.employee.update({ where: { id: p.employeeId }, data: { phone } });
    revalidatePath("/admin/shops");
    revalidatePath(`/admin/shops/${emp.shopId}/employees`);
    revalidatePath(`/admin/shops/${emp.shopId}/employees/${p.employeeId}/edit`);
    await clearShopSession(telegramUserId);
    const d = await formatEmployeeMenu(p.employeeId);
    if (d) {
      await sendTelegramMessageWithKeyboardToChat(chatId, `✅ تم تحديث الهاتف.\n\n${d.text}`, d.keyboard);
    }
    return true;
  }

  if (step === "shop_edit_customer_name") {
    const name = message.text?.trim() ?? "";
    if (!name) return true;
    const p = JSON.parse(session.payload || "{}") as { customerId?: string };
    if (!p.customerId) return true;
    await prisma.customer.update({ where: { id: p.customerId }, data: { name } });
    revalidatePath("/admin/shops");
    revalidatePath("/admin/customers");
    await clearShopSession(telegramUserId);
    const d = await formatCustomerMenu(p.customerId);
    if (d) {
      await sendTelegramMessageWithKeyboardToChat(chatId, `✅ تم تحديث اسم الزبون.\n\n${d.text}`, d.keyboard);
    }
    return true;
  }

  if (step === "shop_edit_customer_phone") {
    const p = JSON.parse(session.payload || "{}") as { customerId?: string };
    if (!p.customerId) return true;
    const phone = normalizeIraqMobileLocal11(message.text?.trim() ?? "");
    if (!phone) {
      await sendTelegramMessageWithKeyboardToChat(chatId, "رقم غير صالح. جرّب 07…", {
        inline_keyboard: [[{ text: "❌ إلغاء", callback_data: `scm:${p.customerId}` }]],
      });
      return true;
    }
    await prisma.customer.update({ where: { id: p.customerId }, data: { phone } });
    revalidatePath("/admin/shops");
    revalidatePath("/admin/customers");
    await clearShopSession(telegramUserId);
    const d = await formatCustomerMenu(p.customerId);
    if (d) {
      await sendTelegramMessageWithKeyboardToChat(chatId, `✅ تم تحديث هاتف الزبون.\n\n${d.text}`, d.keyboard);
    }
    return true;
  }

  return false;
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
