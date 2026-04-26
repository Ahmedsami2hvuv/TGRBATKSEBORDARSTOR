import { Decimal } from "@prisma/client/runtime/library";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import {
  escapeTelegramHtml,
  sendTelegramMessageWithKeyboardToChat,
  sendTelegramPhotoToChat,
  editTelegramMessage,
  deleteTelegramMessage,
  sendTelegramHtmlToChat,
  answerCallbackQuery,
  sendTelegramMessageWithForceReply,
  sendTelegramMessageRemoveKeyboard,
  sendTelegramLocationRequestKeyboard,
  telegramDownloadFileById,
  type TelegramInlineKeyboard,
  type TgUpdate, // تم التصحيح هنا
} from "@/lib/telegram";
import { formatDinarAsAlf, parseAlfInputToDinarDecimalRequired } from "@/lib/money-alf";
import { resizeImageBufferForShop } from "@/lib/image-resize";
import { MAX_ORDER_IMAGE_BYTES, saveOrderImageFromResizedBuffer } from "@/lib/order-image";
import { notifyTelegramMoneyEvent } from "@/lib/telegram-notify";
import { getPublicAppUrl } from "@/lib/app-url";
import { resolvePublicAssetSrc } from "@/lib/image-url";
import { mandoubOrderDetailInclude } from "@/lib/mandoub-order-queries";
import { computeMandoubTotalsForCourier } from "@/lib/mandoub-courier-totals";
import { computeCourierDeliveryEarningDinar } from "@/lib/courier-earnings";
import { fetchOrderOnlyMoneySumsForCourier } from "@/lib/mandoub-courier-event-totals";
import {
  fetchWalletInOutDisplayForCourier,
  resolvePartyDisplayName,
} from "@/lib/wallet-peer-transfer";
import {
  dinarAmountsMatchExpected,
  LEDGER_KIND_TRANSFER_PENDING_IN,
  LEDGER_KIND_TRANSFER_PENDING_OUT,
  MISC_LEDGER_KIND_GIVE,
  MISC_LEDGER_KIND_TAKE,
  MONEY_KIND_DELIVERY,
  MONEY_KIND_PICKUP,
} from "@/lib/mandoub-money-events";
import {
  mandoubHandToAdminDinar,
  computeMandoubWalletRemainAllTimeDinar,
} from "@/lib/mandoub-wallet-carry";
import { normalizeIraqMobileLocal11, telHref, whatsappMeUrl } from "@/lib/whatsapp";

type CourierMainKeyboardKind = "main" | "orders" | "wallet";

function alfLine(label: string, value: string): string {
  return `${label} ${value} الف`;
}

function courierDirLabel(kind: string): string {
  if (kind === LEDGER_KIND_TRANSFER_PENDING_OUT) return "صادر معلّق";
  if (kind === LEDGER_KIND_TRANSFER_PENDING_IN) return "وارد معلّق";
  if (kind === MONEY_KIND_PICKUP) return "صادر";
  if (kind === MONEY_KIND_DELIVERY) return "وارد";
  if (kind === MISC_LEDGER_KIND_TAKE) return "أخذت";
  if (kind === MISC_LEDGER_KIND_GIVE) return "أعطيت";
  return kind;
}

export async function getCourierByTelegramUserId(
  telegramUserId: string,
): Promise<{
  id: string;
  name: string;
  mandoubTotalsResetAt: Date | null;
  mandoubWalletCarryOverDinar: Decimal;
  vehicleType: "car" | "bike";
} | null> {
  const c = await prisma.courier.findUnique({
    where: { telegramUserId },
    select: {
      id: true,
      name: true,
      mandoubTotalsResetAt: true,
      mandoubWalletCarryOverDinar: true,
      vehicleType: true,
    },
  });
  return c;
}

function buildCourierKeyboard(kind: CourierMainKeyboardKind): TelegramInlineKeyboard {
  if (kind === "orders") {
    return {
      inline_keyboard: [
        [{ text: "📦 طلبياتي", callback_data: "co_orders_0" }, { text: "💼 محفظتي", callback_data: "co_wallet_0" }],
        [{ text: "🏠 الرئيسية", callback_data: "co_main" }],
      ],
    };
  }
  if (kind === "wallet") {
    return {
      inline_keyboard: [
        [{ text: "💼 محفظتي", callback_data: "co_wallet_0" }, { text: "📦 طلبياتي", callback_data: "co_orders_0" }],
        [{ text: "🏠 الرئيسية", callback_data: "co_main" }],
      ],
    };
  }
  return {
    inline_keyboard: [
      [
        { text: "📦 طلبياتي", callback_data: "co_orders_0" },
        { text: "💼 محفظتي", callback_data: "co_wallet_0" },
      ],
    ],
  };
}

type CourierCallback =
  | { kind: "main" }
  | { kind: "orders"; page: number }
  | { kind: "order_detail"; orderNumber: number }
  | { kind: "order_wa_menu"; orderNumber: number }
  | { kind: "order_call_menu"; orderNumber: number }
  | { kind: "order_call_dial"; orderNumber: number; who: "s" | "c" | "2" }
  | { kind: "order_loc_menu"; orderNumber: number }
  | { kind: "order_loc_gps"; orderNumber: number }
  | { kind: "order_photo_one"; orderNumber: number; slot: "shop" | "order" | "cust" }
  | { kind: "order_photos"; orderNumber: number }
  | { kind: "order_edit_menu"; orderNumber: number }
  | { kind: "order_edit_field"; orderNumber: number; field: "phone" | "alt" | "lmk" | "loc" }
  | { kind: "order_pickup"; orderNumber: number }
  | { kind: "order_delivery"; orderNumber: number }
  | { kind: "wallet"; tab: WalletTab; page: number };

type WalletTab =
  | "all"
  | "remain_site"
  | "earnings"
  | "wallet_in"
  | "wallet_out"
  | "remain_wallet"
  | "handover_admin"
  | "transfers";

const WALLET_TAB_LABELS: Record<WalletTab, string> = {
  all: "الكل",
  remain_site: "متبقي من الموقع",
  earnings: "أرباحي",
  wallet_in: "وارد من المحفظة",
  wallet_out: "صادر من المحفظة",
  remain_wallet: "متبقي المحفظة",
  handover_admin: "يسلم للإدارة",
  transfers: "تحويلات معلّقة",
};

function parseWalletTab(raw: string): WalletTab | null {
  const tab = raw.trim();
  const allowed: Record<string, WalletTab> = {
    all: "all",
    remain_site: "remain_site",
    earnings: "earnings",
    wallet_in: "wallet_in",
    wallet_out: "wallet_out",
    remain_wallet: "remain_wallet",
    handover_admin: "handover_admin",
    transfers: "transfers",
  };
  return allowed[tab] ?? null;
}

function parseCourierCallbackData(raw: string): CourierCallback | null {
  const t = raw.trim();
  if (t === "co_main") return { kind: "main" };
  const mo = /^co_orders_(\d+)$/.exec(t);
  if (mo) return { kind: "orders", page: Number(mo[1]) };
  const md = /^co_order_(\d+)$/.exec(t);
  if (md) return { kind: "order_detail", orderNumber: Number(md[1]) };

  const wa = /^co_wa_(\d+)$/.exec(t);
  if (wa) return { kind: "order_wa_menu", orderNumber: Number(wa[1]) };

  const call = /^co_call_(\d+)$/.exec(t);
  if (call) return { kind: "order_call_menu", orderNumber: Number(call[1]) };

  const loc = /^co_loc_(\d+)$/.exec(t);
  if (loc) return { kind: "order_loc_menu", orderNumber: Number(loc[1]) };

  const locGps = /^co_lg_(\d+)$/.exec(t);
  if (locGps) return { kind: "order_loc_gps", orderNumber: Number(locGps[1]) };

  const callgo = /^co_callgo_(\d+)_(s|c|2)$/.exec(t);
  if (callgo) return { kind: "order_call_dial", orderNumber: Number(callgo[1]), who: callgo[2] as "s" | "c" | "2" };

  const psh = /^co_psh_(\d+)$/.exec(t);
  if (psh) return { kind: "order_photo_one", orderNumber: Number(psh[1]), slot: "shop" };
  const por = /^co_por_(\d+)$/.exec(t);
  if (por) return { kind: "order_photo_one", orderNumber: Number(por[1]), slot: "order" };
  const pcu = /^co_pcu_(\d+)$/.exec(t);
  if (pcu) return { kind: "order_photo_one", orderNumber: Number(pcu[1]), slot: "cust" };

  const pphotos = /^co_photos_(\d+)$/.exec(t);
  if (pphotos) return { kind: "order_photos", orderNumber: Number(pphotos[1]) };

  const ed = /^co_edit_(\d+)$/.exec(t);
  if (ed) return { kind: "order_edit_menu", orderNumber: Number(ed[1]) };
  const ep = /^co_ep_(\d+)$/.exec(t);
  if (ep) return { kind: "order_edit_field", orderNumber: Number(ep[1]), field: "phone" };
  const ea = /^co_ea_(\d+)$/.exec(t);
  if (ea) return { kind: "order_edit_field", orderNumber: Number(ea[1]), field: "alt" };
  const el = /^co_el_(\d+)$/.exec(t);
  if (el) return { kind: "order_edit_field", orderNumber: Number(el[1]), field: "lmk" };
  const eu = /^co_eu_(\d+)$/.exec(t);
  if (eu) return { kind: "order_edit_field", orderNumber: Number(eu[1]), field: "loc" };

  const pickup = /^co_pick_(\d+)$/.exec(t);
  if (pickup) return { kind: "order_pickup", orderNumber: Number(pickup[1]) };

  const delivery = /^co_deliv_(\d+)$/.exec(t);
  if (delivery) return { kind: "order_delivery", orderNumber: Number(delivery[1]) };

  // Backward compatibility: old callbacks were `co_wallet_<page>` (tab=all).
  const mwOld = /^co_wallet_(\d+)$/.exec(t);
  if (mwOld) return { kind: "wallet", tab: "all", page: Number(mwOld[1]) };

  // New callbacks: `co_wallet_<tab>_<page>`.
  const mw = /^co_wallet_([a-z_]+)_(\d+)$/.exec(t);
  if (mw) {
    const tab = parseWalletTab(mw[1]);
    const page = Number(mw[2]);
    if (!tab) return null;
    if (!Number.isFinite(page) || page < 0) return null;
    return { kind: "wallet", tab, page };
  }

  return null;
}

function statusAr(status: string): string {
  switch (status) {
    case "assigned":
      return "بانتظار المندوب";
    case "delivering":
      return "عند المندوب (تم الاستلام)";
    case "delivered":
      return "تم التسليم";
    case "archived":
      return "مؤرشف";
    default:
      return status;
  }
}

export async function handleCourierStart({
  chatId,
  telegramUserId,
}: {
  chatId: string;
  telegramUserId: string;
}): Promise<void> {
  const courier = await getCourierByTelegramUserId(telegramUserId);
  if (!courier) return;
  const text =
    `<b>أهلاً ${escapeTelegramHtml(courier.name)}</b>\n` +
    `اختر من الأزرار:\n` +
    `📦 طلبياتي — تفاصيل الطلبات والمسار\n` +
    `💼 محفظتي — أرقام ووارد/صادر وسجل العمليات`;

  await sendTelegramMessageWithKeyboardToChat(chatId, text, buildCourierKeyboard("main"));
}

async function loadCourierOrdersForTelegram(courierId: string, page: number) {
  const pageSize = 8;
  return prisma.order.findMany({
    where: {
      assignedCourierId: courierId,
      status: { in: ["assigned", "delivering", "delivered", "archived"] },
    },
    orderBy: { createdAt: "desc" },
    skip: page * pageSize,
    take: pageSize,
    include: {
      shop: { select: { name: true, region: { select: { name: true } } } },
      customer: { select: { name: true, phone: true } },
      customerRegion: { select: { name: true } },
      secondCustomerRegion: { select: { name: true } },
    },
  });
}

function buildOrdersKeyboard(
  orders: Array<{
    orderNumber: number;
    shopName?: string | null;
    customerRegionName?: string | null;
  }>,
): TelegramInlineKeyboard {
  const rows: Array<Array<{ text: string; callback_data: string }>> = [];
  const orderBtns = orders.map((o) => {
    const shop = (o.shopName ?? "").trim();
    const region = (o.customerRegionName ?? "").trim();
    const parts = [`#${o.orderNumber}`, shop, region].filter(Boolean);
    const label = parts.join(" ").replace(/\s+/g, " ").trim();
    return {
      text: (label || `#${o.orderNumber}`).slice(0, 64),
      callback_data: `co_order_${o.orderNumber}`,
    };
  });
  for (let i = 0; i < orderBtns.length; i += 2) {
    rows.push(orderBtns.slice(i, i + 2));
  }
  rows.push([{ text: "🏠 الرئيسية", callback_data: "co_main" }]);
  return { inline_keyboard: rows };
}

type CourierOrderDetailForTelegram = {
  id: string;
  shop?:
    | {
        name?: string | null;
        phone?: string | null;
        locationUrl?: string | null;
        region?: { name?: string | null } | null;
      }
    | null;
  customer?:
    | {
        name?: string | null;
        phone?: string | null;
        alternatePhone?: string | null;
        customerLocationUrl?: string | null;
        customerLandmark?: string | null;
        customerDoorPhotoUrl?: string | null;
      }
    | null;
  customerRegion?: { name?: string | null } | null;
  secondCustomerRegion?: { name?: string | null } | null;
  orderNumber: number;
  status: string;
  orderType?: string | null;
  customerLocationUrl?: string | null;
  customerLandmark?: string | null;
  routeMode?: string | null;
  secondCustomerLocationUrl?: string | null;
  secondCustomerLandmark?: string | null;
  secondCustomerPhone?: string | null;
  orderNoteTime?: string | null;
  orderSubtotal?: Decimal | null;
  deliveryPrice?: Decimal | null;
  totalAmount?: Decimal | null;
  customerPhone?: string | null;
  alternatePhone?: string | null;

  shopDoorPhotoUrl?: string | null;
  shopDoorPhotoUploadedByName?: string | null;
  customerDoorPhotoUrl?: string | null;
  customerDoorPhotoUploadedByName?: string | null;
  imageUrl?: string | null;
  orderImageUploadedByName?: string | null;
};

function mergedOrderCustomerLoc(order: CourierOrderDetailForTelegram): string {
  return (
    order.customerLocationUrl?.trim() || order.customer?.customerLocationUrl?.trim() || ""
  );
}

function formatOrderDetailHtml(order: CourierOrderDetailForTelegram): string {
  const shopName = order.shop?.name?.trim() || "—";
  const shopRegionName = order.shop?.region?.name?.trim() || "—";

  const customerName = order.customer?.name?.trim() || "—";
  const customerPhone = order.customer?.phone?.trim() || order.customerPhone || "—";
  const customerRegionName = order.customerRegion?.name?.trim() || "—";

  const orderType = order.orderType?.trim() || "—";

  const mergedCustomerLocUrl = mergedOrderCustomerLoc(order);
  const mainLocLine = mergedCustomerLocUrl
    ? `📍 الموقع: <a href="${escapeTelegramHtml(mergedCustomerLocUrl)}">فتح الموقع</a>`
    : `📍 الموقع: —`;

  const mergedLandmark =
    order.customerLandmark?.trim() || order.customer?.customerLandmark?.trim() || "";
  const landmarkLine = mergedLandmark ? `📌 أقرب نقطة دالة: ${escapeTelegramHtml(mergedLandmark)}` : "";

  const altPhone =
    order.alternatePhone?.trim() || order.customer?.alternatePhone?.trim() || "";

  const lines: string[] = [
    `<b>📦 طلب #${order.orderNumber}</b>`,
    `🏪 ${escapeTelegramHtml(shopName)}`,
    `🗺️ عنوان المحل: ${escapeTelegramHtml(shopRegionName)}`,
    `👤 ${escapeTelegramHtml(customerName)} · 📞 ${escapeTelegramHtml(customerPhone)}`,
  ];
  if (altPhone) {
    lines.push(`📞 ثانٍ: ${escapeTelegramHtml(altPhone)}`);
  }
  lines.push(
    `🗺️ عنوان الزبون: ${escapeTelegramHtml(customerRegionName)}`,
    `📌 الحالة: ${escapeTelegramHtml(statusAr(order.status))}`,
    `📦 نوع الطلب: ${escapeTelegramHtml(orderType)}`,
    alfLine("💵", order.orderSubtotal != null ? formatDinarAsAlf(order.orderSubtotal) : "—"),
    alfLine("🚚", order.deliveryPrice != null ? formatDinarAsAlf(order.deliveryPrice) : "—"),
    alfLine("💰", order.totalAmount != null ? formatDinarAsAlf(order.totalAmount) : "—"),
    mainLocLine,
  );

  if (landmarkLine) lines.push(landmarkLine);

  if (order.orderNoteTime) {
    lines.push(`⏱️ وقت ملاحظة الطلب: ${escapeTelegramHtml(order.orderNoteTime)}`);
  }

  // Double destination: only show extra landmark/region if present
  if (order.routeMode === "double") {
    const loc2 = order.secondCustomerLocationUrl?.trim();
    const region2 = order.secondCustomerRegion?.name?.trim() || "—";
    lines.push(``);
    lines.push(`<b>الوجهة الثانية</b>`);
    lines.push(`🗺️ ${escapeTelegramHtml(region2)}`);
    lines.push(loc2 ? `📍 الموقع 2: <a href="${escapeTelegramHtml(loc2)}">فتح الموقع</a>` : `📍 الموقع 2: —`);
    const lmk2 = order.secondCustomerLandmark?.trim() || "";
    if (lmk2) lines.push(`📌 أقرب نقطة دالة 2: ${escapeTelegramHtml(lmk2)}`);
  }

  return lines.join("\n");
}

function toAbsoluteAssetUrl(raw: string | null | undefined): string | null {
  const resolved = resolvePublicAssetSrc(raw);
  if (!resolved) return null;
  if (resolved.startsWith("http://") || resolved.startsWith("https://")) return resolved;
  const base = getPublicAppUrl();
  const p = resolved.startsWith("/") ? resolved : `/${resolved}`;
  return `${base}${p}`;
}

function buildCourierOrderDetailKeyboard(opts: {
  order: CourierOrderDetailForTelegram;
  courier: { id: string };
  hasCustomerLocation: boolean;
}): TelegramInlineKeyboard {
  const { order, hasCustomerLocation } = opts;
  const on = String(order.orderNumber);

  const inline: TelegramInlineKeyboard["inline_keyboard"] = [];

  inline.push([
    { text: "💬 واتس اب", callback_data: `co_wa_${on}` },
    { text: "📞 اتصال", callback_data: `co_call_${on}` },
  ]);

  if (order.status === "assigned" || order.status === "delivering") {
    inline.push([
      { text: "✅ تم استلام الطلب", callback_data: `co_pick_${on}` },
      { text: "✅ تم تسليم الطلب", callback_data: `co_deliv_${on}` },
    ]);
  }

  inline.push([
    { text: "📷 باب العميل", callback_data: `co_psh_${on}` },
    { text: "📷 الطلب", callback_data: `co_por_${on}` },
    { text: "📷 باب الزبون", callback_data: `co_pcu_${on}` },
  ]);

  inline.push([{ text: "📍 لكيشن", callback_data: `co_loc_${on}` }]);

  if (!hasCustomerLocation) {
    inline.push([{ text: "📍 إضافة لكيشن (GPS)", callback_data: `co_lg_${on}` }]);
  }

  inline.push([{ text: "✏️ تعديل الطلب", callback_data: `co_edit_${on}` }]);

  inline.push([{ text: "⬅️ طلبياتي", callback_data: "co_orders_0" }]);
  inline.push([{ text: "🏠 الرئيسية", callback_data: "co_main" }]);

  return { inline_keyboard: inline };
}

async function loadCourierOrderDetailForTelegram(courierId: string, orderNumber: number) {
  return prisma.order.findFirst({
    where: { orderNumber, assignedCourierId: courierId },
    include: {
      shop: { include: { region: true } },
      customer: true,
      customerRegion: true,
      secondCustomerRegion: true,
    },
  });
}

/** يحذف رسالة الطلب ثم يرسل نسخة جديدة — يعمل حتى لو كانت الرسالة السابقة صورة، ويُحدّث الواجهة بعد كل إجراء. */
async function deleteThenSendCourierMessage(opts: {
  chatId: string;
  messageId: number;
  text: string;
  keyboard: TelegramInlineKeyboard;
}): Promise<void> {
  await deleteTelegramMessage(opts.chatId, opts.messageId).catch(() => {});
  const sent = await sendTelegramMessageWithKeyboardToChat(opts.chatId, opts.text, opts.keyboard);
  if (!sent.ok) {
    console.error("[telegram-courier-panel] deleteThenSend failed:", sent.error);
  }
}

async function loadCourierWalletTelegramLedgerLines(
  courierId: string,
  page: number,
  tab: WalletTab,
) {
  const pageSize = 10;
  const take = 80;
  const [
    orderEvents,
    miscEntries,
    pendingTransfers,
  ] = await Promise.all([
    prisma.orderCourierMoneyEvent.findMany({
      where: { courierId, recordedByCompanyPreparerId: null },
      orderBy: { createdAt: "desc" },
      take,
      include: {
        order: { select: { id: true, orderNumber: true, shop: { select: { name: true } } } },
      },
    }),
    prisma.courierWalletMiscEntry.findMany({
      where: { courierId },
      orderBy: { createdAt: "desc" },
      take,
    }),
    prisma.walletPeerTransfer.findMany({
      where: {
        status: "pending",
        OR: [{ fromCourierId: courierId }, { toCourierId: courierId }],
      },
      orderBy: { createdAt: "desc" },
      take,
    }),
  ]);

  const orderLines = orderEvents.map((e) => ({
    source: "order" as const,
    id: e.id,
    kind: e.kind,
    amountDinar: Number(e.amountDinar),
    createdAt: e.createdAt.toISOString(),
    orderId: e.orderId,
    orderNumber: e.order.orderNumber,
    shopName: e.order.shop.name?.trim() || "—",
    deletedAt: e.deletedAt ? e.deletedAt.toISOString() : null,
  }));

  const miscLines = miscEntries.map((e) => ({
    source: "misc" as const,
    id: e.id,
    kind: e.direction === "take" ? MISC_LEDGER_KIND_TAKE : MISC_LEDGER_KIND_GIVE,
    amountDinar: Number(e.amountDinar),
    createdAt: e.createdAt.toISOString(),
    miscLabel: e.label.trim() || "—",
    deletedAt: e.deletedAt ? e.deletedAt.toISOString() : null,
  }));

  const transferLines: Array<{
    source: "transfer_pending";
    id: string;
    kind: string;
    amountDinar: number;
    createdAt: string;
    miscLabel: string;
    deletedAt: null;
  }> = [];

  for (const t of pendingTransfers) {
    if (t.fromCourierId === courierId) {
      const toLabel = await resolvePartyDisplayName(t.toKind, t.toCourierId, t.toEmployeeId);
      const loc = t.handoverLocation.trim() || "—";
      transferLines.push({
        source: "transfer_pending",
        id: t.id,
        kind: LEDGER_KIND_TRANSFER_PENDING_OUT,
        amountDinar: Number(t.amountDinar),
        createdAt: t.createdAt.toISOString(),
        miscLabel: `تحويل معلّق: إلى ${toLabel} — مكان التسليم: ${loc}`,
        deletedAt: null,
      });
    }
    if (t.toCourierId === courierId) {
      const fromLabel = await resolvePartyDisplayName(t.fromKind, t.fromCourierId, t.fromEmployeeId);
      const loc = t.handoverLocation.trim() || "—";
      transferLines.push({
        source: "transfer_pending",
        id: t.id,
        kind: LEDGER_KIND_TRANSFER_PENDING_IN,
        amountDinar: Number(t.amountDinar),
        createdAt: t.createdAt.toISOString(),
        miscLabel: `تحويل معلّق: من ${fromLabel} — مكان التسليم: ${loc}`,
        deletedAt: null,
      });
    }
  }

  const merged = [
    ...orderLines.map((l) => ({ ...l, miscLabel: null as string | null })),
    ...miscLines,
    ...transferLines,
  ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const filtered = (() => {
    switch (tab) {
      case "all":
      case "remain_wallet":
      case "earnings":
        // earnings and remain_wallet are shown using the same underlying ledger subset.
        return merged;
      case "remain_site":
      case "handover_admin":
        return merged.filter((l) => l.source === "order");
      case "wallet_in":
        return merged.filter((l) => l.source === "misc" && l.kind === MISC_LEDGER_KIND_TAKE);
      case "wallet_out":
        return merged.filter((l) => l.source === "misc" && l.kind === MISC_LEDGER_KIND_GIVE);
      case "transfers":
        return merged.filter((l) => l.source === "transfer_pending");
      default:
        return merged;
    }
  })();

  return filtered.slice(page * pageSize, page * pageSize + pageSize);
}

export async function buildCourierWalletTelegramText(
  courier: {
    id: string;
    name: string;
    mandoubTotalsResetAt: Date | null;
    mandoubWalletCarryOverDinar: Decimal;
  },
  tab: WalletTab,
  page: number,
): Promise<{ text: string; keyboard: TelegramInlineKeyboard }> {
  const baseline = courier.mandoubTotalsResetAt;
  const orderOnlySums = await fetchOrderOnlyMoneySumsForCourier(courier.id, baseline);
  const walletInOutDisplay = await fetchWalletInOutDisplayForCourier(courier.id, baseline);

  const orders = await prisma.order.findMany({
    where: {
      status: { in: ["assigned", "delivering", "delivered"] },
      OR: [
        { assignedCourierId: courier.id },
        { courierEarningForCourierId: courier.id },
      ],
    },
    include: mandoubOrderDetailInclude,
    orderBy: { createdAt: "desc" },
  });
  const ordersNorm = orders.map((o) => ({
    ...o,
    moneyEvents: o.moneyEvents.map((e) => ({
      ...e,
      courierId: e.courierId ?? undefined,
    })),
  }));
  const orderMetrics = computeMandoubTotalsForCourier(ordersNorm, courier.id, baseline);

  const walletRemain = await computeMandoubWalletRemainAllTimeDinar(courier.id);
  const handToAdmin = mandoubHandToAdminDinar(walletRemain, orderMetrics.sumEarnings);

  const ledgerLines = await loadCourierWalletTelegramLedgerLines(courier.id, page, tab);

  const remainSiteValue = formatDinarAsAlf(orderOnlySums.remainingNet);
  const walletInValue = formatDinarAsAlf(walletInOutDisplay.walletIn);
  const walletOutValue = formatDinarAsAlf(walletInOutDisplay.walletOut);
  const earningsValue = formatDinarAsAlf(orderMetrics.sumEarnings);
  const walletRemainValue = formatDinarAsAlf(walletRemain);
  const handToAdminValue = formatDinarAsAlf(handToAdmin);

  const header = `<b>💼 محفظتي</b>\n<i>العرض: ${WALLET_TAB_LABELS[tab]}</i>\n\n`;

  const bodyLines = ledgerLines
    .map((l) => {
      const dir = courierDirLabel(l.kind);
      const amt = formatDinarAsAlf(new Decimal(l.amountDinar));
      const dt = new Date(l.createdAt).toLocaleString("ar-IQ-u-nu-latn", { dateStyle: "medium", timeStyle: "short" });
      if (l.source === "order") {
        return `• ${dir}: ${amt} الف\n  طلب #${l.orderNumber} — ${escapeTelegramHtml(l.shopName)}\n  ${dt}`;
      }
      return `• ${dir}: ${amt} الف\n  ${escapeTelegramHtml(l.miscLabel ?? "—")}\n  ${dt}`;
    })
    .join("\n");

  const text = header + (bodyLines.length ? bodyLines : "لا توجد بيانات حالياً لهذا العرض.");

  const tabBtn = (code: WalletTab, label: string): { text: string; callback_data: string } => {
    const prefix = tab === code ? "✅ " : "";
    return {
      text: `${prefix}${label}`.slice(0, 64),
      callback_data: `co_wallet_${code}_0`,
    };
  };

  const keyboard: TelegramInlineKeyboard = {
    inline_keyboard: [
      [
        tabBtn("remain_site", `متبقي من الموقع: ${remainSiteValue} الف`),
        tabBtn("wallet_in", `وارد: ${walletInValue} الف`),
        tabBtn("wallet_out", `صادر: ${walletOutValue} الف`),
      ],
      [
        tabBtn("earnings", `أرباحي: ${earningsValue} الف`),
        tabBtn("transfers", "تحويلات معلّقة"),
        tabBtn("handover_admin", `يسلم للإدارة: ${handToAdminValue} الف`),
      ],
      [tabBtn("remain_wallet", `متبقي المحفظة: ${walletRemainValue} الف`), tabBtn("all", "الكل")],
      [{ text: "🏠 الرئيسية", callback_data: "co_main" }],
      [
        { text: "◀️ السابق", callback_data: `co_wallet_${tab}_${Math.max(0, page - 1)}` },
        { text: "التالي ▶️", callback_data: `co_wallet_${tab}_${page + 1}` },
      ],
    ],
  };

  return { text, keyboard };
}

async function buildCourierOrdersTextAndKeyboard(courier: { id: string; name: string }, page: number): Promise<{ text: string; keyboard: TelegramInlineKeyboard }> {
  const orders = await loadCourierOrdersForTelegram(courier.id, page);
  const lines: string[] = [];
  if (orders.length === 0) {
    lines.push("لا توجد طلبات حالياً.");
  } else {
    for (const o of orders) {
      const shopName = o.shop?.name?.trim() || "—";
      lines.push(
        `• <b>#${o.orderNumber}</b> — ${escapeTelegramHtml(shopName)} — ${escapeTelegramHtml(statusAr(o.status))}`,
      );
    }
  }
  const text = `<b>📦 طلبياتي</b>\n${lines.join("\n")}`;
  const keyboard = buildOrdersKeyboard(
    orders.map((o) => ({
      orderNumber: o.orderNumber,
      shopName: o.shop?.name ?? "",
      customerRegionName: o.customerRegion?.name ?? o.shop?.region?.name ?? "",
    })),
  );
  return { text, keyboard };
}

function revalidateCourierOrder(orderId: string): void {
  revalidatePath("/mandoub");
  revalidatePath("/mandoub/wallet");
  revalidatePath(`/mandoub/order/${orderId}`);
}

async function upsertCourierSession(
  telegramUserId: string,
  chatId: string,
  step: string,
  orderNumber: number | null,
  payload: string,
): Promise<void> {
  await prisma.telegramBotSession.upsert({
    where: { telegramUserId },
    create: { telegramUserId, chatId, step, orderNumber, payload },
    update: { chatId, step, orderNumber, payload },
  });
}

async function clearCourierSession(telegramUserId: string): Promise<void> {
  await prisma.telegramBotSession.updateMany({
    where: { telegramUserId },
    data: { step: "idle", orderNumber: null, payload: "" },
  });
}

function pickCourierPhotoFileId(message: {
  photo?: Array<{ file_id: string }>;
  document?: { file_id: string; mime_type?: string };
}): string | null {
  if (message.photo?.length) {
    return message.photo[message.photo.length - 1]?.file_id ?? null;
  }
  const d = message.document;
  if (d?.mime_type?.startsWith("image/")) return d.file_id;
  return null;
}

function normalizeCourierMapsUrl(raw: string): string {
  const s = raw.trim();
  if (!s) return s;
  if (/^https?:\/\//i.test(s)) return s;
  return `https://${s}`;
}

async function beginCourierPickupAmountStep(
  chatId: string,
  telegramUserId: string,
  orderNumber: number,
  expectedAlf: string,
): Promise<void> {
  const res = await sendTelegramMessageWithForceReply(
    chatId,
    `<b>💳 استلام الطلب — طلب #${orderNumber}</b>\n` +
      `المتوقع تقريباً: <b>${escapeTelegramHtml(expectedAlf)}</b> ألف\n\n` +
      `أرسل المبلغ الذي دفعته للعميل <b>بالألف</b> (ردّ على هذه الرسالة):`,
    { placeholder: "بالألف" },
  );
  if (!res.ok || res.messageId == null) return;
  await upsertCourierSession(
    telegramUserId,
    chatId,
    "courier_pickup_amt",
    orderNumber,
    JSON.stringify({ promptMessageId: res.messageId }),
  );
}

async function beginCourierDeliveryAmountStep(
  chatId: string,
  telegramUserId: string,
  orderNumber: number,
  expectedAlf: string,
): Promise<void> {
  const res = await sendTelegramMessageWithForceReply(
    chatId,
    `<b>💸 استلام من الزبون — طلب #${orderNumber}</b>\n` +
      `المتوقع تقريباً: <b>${escapeTelegramHtml(expectedAlf)}</b> ألف\n\n` +
      `أرسل المبلغ الذي استلمته من الزبون <b>بالألف</b> (ردّ على هذه الرسالة):`,
    { placeholder: "بالألف" },
  );
  if (!res.ok || res.messageId == null) return;
  await upsertCourierSession(
    telegramUserId,
    chatId,
    "courier_delivery_amt",
    orderNumber,
    JSON.stringify({ promptMessageId: res.messageId }),
  );
}

async function completeCourierPickupTx(
  courier: { id: string; name: string },
  order: NonNullable<Awaited<ReturnType<typeof loadCourierOrderDetailForTelegram>>>,
  amountDinar: Decimal,
  matches: boolean,
  mismatchNote: string,
): Promise<void> {
  const expected = order.orderSubtotal;
  if (expected == null) return;
  await prisma.$transaction(async (tx) => {
    await tx.orderCourierMoneyEvent.create({
      data: {
        orderId: order.id,
        courierId: courier.id,
        kind: MONEY_KIND_PICKUP,
        amountDinar,
        expectedDinar: expected,
        matchesExpected: matches,
        mismatchReason: "",
        mismatchNote,
      },
    });
    if (order.status === "assigned") {
      await tx.order.update({
        where: { id: order.id },
        data: { status: "delivering" },
      });
    }
  });
  revalidateCourierOrder(order.id);
  void notifyTelegramMoneyEvent({
    orderId: order.id,
    kind: MONEY_KIND_PICKUP,
    amountDinar,
    expectedDinar: expected,
    matchesExpected: matches,
    courierName: courier.name,
  }).catch(() => {});
}

async function completeCourierDeliveryTx(
  courier: { id: string; name: string; vehicleType: "car" | "bike" },
  order: NonNullable<Awaited<ReturnType<typeof loadCourierOrderDetailForTelegram>>>,
  amountDinar: Decimal,
  matches: boolean,
  mismatchNote: string,
): Promise<void> {
  const expected = order.totalAmount;
  if (expected == null) return;
  let earning: Decimal | null = null;
  let earningFor: string | null = null;
  if (order.deliveryPrice != null) {
    earning = computeCourierDeliveryEarningDinar(courier.vehicleType, order.deliveryPrice);
    earningFor = earning != null ? courier.id : null;
  }
  await prisma.$transaction(async (tx) => {
    await tx.orderCourierMoneyEvent.create({
      data: {
        orderId: order.id,
        courierId: courier.id,
        kind: MONEY_KIND_DELIVERY,
        amountDinar,
        expectedDinar: expected,
        matchesExpected: matches,
        mismatchReason: "",
        mismatchNote,
      },
    });
    await tx.order.update({
      where: { id: order.id },
      data: {
        status: "delivered",
        courierEarningDinar: earning,
        courierEarningForCourierId: earningFor,
      },
    });
  });
  revalidateCourierOrder(order.id);
  void notifyTelegramMoneyEvent({
    orderId: order.id,
    kind: MONEY_KIND_DELIVERY,
    amountDinar,
    expectedDinar: expected,
    matchesExpected: matches,
    courierName: courier.name,
  }).catch(() => {});
}

export async function handleCourierCallback({
  cq,
  courier,
}: {
  cq: NonNullable<TgUpdate["callback_query"]>;
  courier: {
    id: string;
    name: string;
    mandoubTotalsResetAt: Date | null;
    mandoubWalletCarryOverDinar: Decimal;
    vehicleType: "car" | "bike";
  };
}): Promise<void> {
  const chatId = String(cq.message?.chat.id);
  const telegramUserId = String(cq.from.id);

  await answerCallbackQuery(cq.id).catch(() => {});

  const data = cq.data?.trim() ?? "";
  const parsed = parseCourierCallbackData(data);
  if (!parsed) {
    if (cq.message) {
      await deleteThenSendCourierMessage({
        chatId,
        messageId: cq.message.message_id,
        text: "أمر غير صالح",
        keyboard: buildCourierKeyboard("main"),
      });
    }
    return;
  }

  if (!cq.message) return;

  if (parsed.kind === "main") {
    const text =
      `<b>أهلاً ${escapeTelegramHtml(courier.name)}</b>\n` +
      `اختر من الأزرار:`;
    await deleteThenSendCourierMessage({
      chatId,
      messageId: cq.message.message_id,
      text,
      keyboard: buildCourierKeyboard("main"),
    });
    return;
  }

  if (parsed.kind === "orders") {
    const { text, keyboard } = await buildCourierOrdersTextAndKeyboard(courier, parsed.page);
    await deleteThenSendCourierMessage({
      chatId,
      messageId: cq.message.message_id,
      text,
      keyboard,
    });
    return;
  }

  if (parsed.kind === "order_detail") {
    const order = await loadCourierOrderDetailForTelegram(courier.id, parsed.orderNumber);
    if (!order) {
      const text = "الطلب غير موجود أو غير مسند لك.";
      await sendTelegramMessageWithKeyboardToChat(
        chatId,
        text,
        buildCourierKeyboard("main"),
      ).catch(() => {});
      return;
    }

    const hasCustomerLocation = Boolean(mergedOrderCustomerLoc(order));

    const text = formatOrderDetailHtml(order);
    const keyboard = buildCourierOrderDetailKeyboard({
      order,
      courier: { id: courier.id },
      hasCustomerLocation,
    });
    await deleteThenSendCourierMessage({
      chatId,
      messageId: cq.message.message_id,
      text,
      keyboard,
    });
    return;
  }

  if (parsed.kind === "order_wa_menu") {
    const order = await loadCourierOrderDetailForTelegram(courier.id, parsed.orderNumber);
    if (!order) {
      await sendTelegramHtmlToChat(chatId, "⚠️ الطلب غير موجود أو غير مسند لك.").catch(() => {});
      return;
    }
    const on = String(order.orderNumber);
    const shopPhone = order.shop?.phone?.trim() || "";
    const customerPhone = order.customerPhone?.trim() || order.customer?.phone?.trim() || "";
    const customer2Phone = order.secondCustomerPhone?.trim() || "";

    const waText = `طلبية #${on} — ${order.shop?.name?.trim() || ""}`;

    const waRows: Array<Array<{ text: string; url: string }>> = [];
    const pushIfValid = (btn: { text: string; url: string }) => {
      if (btn.url && btn.url !== "#") waRows.push([btn]);
    };

    // استخدام wa.me بدلاً من whatsapp:// لأن بعض عملاء تيليجرام لا يسمحون بفتح الـ deep link.
    pushIfValid({ text: "🏪 واتساب عميل", url: whatsappMeUrl(shopPhone, waText) });
    pushIfValid({ text: "👤 واتساب زبون", url: whatsappMeUrl(customerPhone, waText) });
    if (customer2Phone)
      pushIfValid({ text: "👤 واتساب زبون 2", url: whatsappMeUrl(customer2Phone, waText) });

    const back: Array<Array<{ text: string; callback_data: string }>> = [
      [{ text: "⬅️ رجوع", callback_data: `co_order_${on}` }],
    ];

    const keyboard: TelegramInlineKeyboard = {
      inline_keyboard: [...waRows, ...back],
    };

    const text = `<b>واتس اب</b>\nاختر الشخص للاتصال:`;
    await deleteThenSendCourierMessage({
      chatId,
      messageId: cq.message.message_id,
      text,
      keyboard,
    });
    return;
  }

  if (parsed.kind === "order_call_menu") {
    const order = await loadCourierOrderDetailForTelegram(courier.id, parsed.orderNumber);
    if (!order) {
      await sendTelegramHtmlToChat(chatId, "⚠️ الطلب غير موجود أو غير مسند لك.").catch(() => {});
      return;
    }
    const on = String(order.orderNumber);

    const shopPhone = order.shop?.phone?.trim() || "";
    const customerPhone = order.customerPhone?.trim() || order.customer?.phone?.trim() || "";
    const customer2Phone = order.secondCustomerPhone?.trim() || "";

    const rows: Array<Array<{ text: string; callback_data: string }>> = [];
    if (shopPhone) rows.push([{ text: "🏪 اتصال عميل", callback_data: `co_callgo_${on}_s` }]);
    if (customerPhone) rows.push([{ text: "👤 اتصال زبون", callback_data: `co_callgo_${on}_c` }]);
    if (customer2Phone.trim()) rows.push([{ text: "👤 اتصال زبون 2", callback_data: `co_callgo_${on}_2` }]);

    if (rows.length === 0) {
      await deleteThenSendCourierMessage({
        chatId,
        messageId: cq.message.message_id,
        text: `<b>📞 اتصال</b>\nلا توجد أرقام مسجّلة لهذا الطلب.`,
        keyboard: { inline_keyboard: [[{ text: "⬅️ رجوع", callback_data: `co_order_${on}` }]] },
      });
      return;
    }

    const keyboard: TelegramInlineKeyboard = {
      inline_keyboard: [...rows, [{ text: "⬅️ رجوع", callback_data: `co_order_${on}` }]],
    };

    const text =
      `<b>📞 اتصال</b>\nاختر الشخص — ستصلك رسالة فيها رابط اتصال يعمل على الهاتف:`;
    await deleteThenSendCourierMessage({
      chatId,
      messageId: cq.message.message_id,
      text,
      keyboard,
    });
    return;
  }

  if (parsed.kind === "order_call_dial") {
    const order = await loadCourierOrderDetailForTelegram(courier.id, parsed.orderNumber);
    if (!order) {
      await answerCallbackQuery(cq.id, "الطلب غير موجود", true).catch(() => {});
      return;
    }
    const shopPhone = order.shop?.phone?.trim() || "";
    const customerPhone = order.customerPhone?.trim() || order.customer?.phone?.trim() || "";
    const customer2Phone = order.secondCustomerPhone?.trim() || "";
    const phone =
      parsed.who === "s" ? shopPhone : parsed.who === "c" ? customerPhone : customer2Phone;
    const href = telHref(phone);
    if (href === "#") {
      await answerCallbackQuery(cq.id, "لا يوجد رقم", true).catch(() => {});
      return;
    }
    const on = String(order.orderNumber);
    const body =
      `<b>📞 اتصال</b>\n` +
      `الرقم: <code>${escapeTelegramHtml(phone)}</code>\n\n` +
      `<a href="${escapeTelegramHtml(href)}">اضغط للاتصال من الجهاز</a>`;
    await sendTelegramMessageWithKeyboardToChat(chatId, body, {
      inline_keyboard: [[{ text: "⬅️ رجوع للطلب", callback_data: `co_order_${on}` }]],
    }).catch(() => {});
    return;
  }

  if (parsed.kind === "order_loc_menu") {
    const order = await loadCourierOrderDetailForTelegram(courier.id, parsed.orderNumber);
    if (!order) {
      await answerCallbackQuery(cq.id, "الطلب غير موجود", true).catch(() => {});
      return;
    }

    const on = String(order.orderNumber);

    const customerLoc =
      order.customerLocationUrl?.trim() || order.customer?.customerLocationUrl?.trim() || "";
    const shopLoc = order.shop?.locationUrl?.trim() || "";

    const customerBtn: { text: string; url?: string; callback_data?: string } = customerLoc
      ? { text: "📍 لكيشن الزبون", url: customerLoc }
      : { text: "📍 إضافة لكيشن الزبون (GPS)", callback_data: `co_lg_${on}` };

    const rows: Array<Array<{ text: string; url?: string; callback_data?: string }>> = [];
    rows.push([customerBtn]);

    if (shopLoc) {
      rows.push([{ text: "🏬 لكيشن عميل", url: shopLoc }]);
    }

    const keyboard: TelegramInlineKeyboard = {
      inline_keyboard: [...rows, [{ text: "⬅️ رجوع", callback_data: `co_order_${on}` }]],
    };

    const text = `<b>لكيشن</b>\nاختر الخيار:`;
    await deleteThenSendCourierMessage({
      chatId,
      messageId: cq.message.message_id,
      text,
      keyboard,
    });
    return;
  }

  if (parsed.kind === "order_photo_one") {
    const order = await loadCourierOrderDetailForTelegram(courier.id, parsed.orderNumber);
    if (!order) {
      await answerCallbackQuery(cq.id, "الطلب غير موجود", true).catch(() => {});
      return;
    }
    const shopDoor = (order.shopDoorPhotoUrl ?? "").trim();
    const customerDoor = (order.customerDoorPhotoUrl ?? order.customer?.customerDoorPhotoUrl ?? "").trim();
    const orderImg = (order.imageUrl ?? "").trim();
    const raw =
      parsed.slot === "shop" ? shopDoor : parsed.slot === "order" ? orderImg : customerDoor;
    const abs = toAbsoluteAssetUrl(raw);
    if (abs) {
      const cap =
        parsed.slot === "shop"
          ? `🏪 صورة العميل — طلب #${order.orderNumber}`
          : parsed.slot === "order"
            ? `📦 صورة الطلب — طلب #${order.orderNumber}`
            : `👤 صورة الزبون — طلب #${order.orderNumber}`;
      await sendTelegramPhotoToChat(chatId, abs, escapeTelegramHtml(cap)).catch(() => {});
      return;
    }
    const slotKey = parsed.slot === "shop" ? "sh" : parsed.slot === "order" ? "or" : "cu";
    const res = await sendTelegramMessageWithForceReply(
      chatId,
      `<b>لا توجد صورة بعد</b>\nأرسل الصورة هنا (ردّ على هذه الرسالة):`,
      { placeholder: "صورة" },
    );
    if (!res.ok || res.messageId == null) return;
    await upsertCourierSession(
      telegramUserId,
      chatId,
      `courier_photo_${slotKey}`,
      order.orderNumber,
      JSON.stringify({ promptMessageId: res.messageId }),
    );
    return;
  }

  if (parsed.kind === "order_edit_menu") {
    const order = await loadCourierOrderDetailForTelegram(courier.id, parsed.orderNumber);
    if (!order) {
      await answerCallbackQuery(cq.id, "الطلب غير موجود", true).catch(() => {});
      return;
    }
    const on = String(order.orderNumber);
    const kb: TelegramInlineKeyboard = {
      inline_keyboard: [
        [
          { text: "📞 رقم الزبون", callback_data: `co_ep_${on}` },
          { text: "📞 رقم ثانٍ", callback_data: `co_ea_${on}` },
        ],
        [
          { text: "📌 أقرب نقطة", callback_data: `co_el_${on}` },
          { text: "📍 رابط خرائط", callback_data: `co_eu_${on}` },
        ],
        [{ text: "⬅️ رجوع", callback_data: `co_order_${on}` }],
      ],
    };
    await deleteThenSendCourierMessage({
      chatId,
      messageId: cq.message.message_id,
      text: `<b>✏️ تعديل الطلب #${order.orderNumber}</b>\nاختر الحقل:`,
      keyboard: kb,
    });
    return;
  }

  if (parsed.kind === "order_edit_field") {
    const order = await loadCourierOrderDetailForTelegram(courier.id, parsed.orderNumber);
    if (!order) {
      await answerCallbackQuery(cq.id, "الطلب غير موجود", true).catch(() => {});
      return;
    }
    const on = String(order.orderNumber);
    const prompts: Record<typeof parsed.field, string> = {
      phone: `طلب <b>#${on}</b>: أرسل رقم الزبون (07…):`,
      alt: `طلب <b>#${on}</b>: رقم ثانٍ أو اكتب <b>—</b> للمسح:`,
      lmk: `طلب <b>#${on}</b>: أقرب نقطة دالة:`,
      loc: `طلب <b>#${on}</b>: أرسل رابط خرائط (http…):`,
    };
    const step = `courier_edit_${parsed.field}`;
    const res = await sendTelegramMessageWithForceReply(chatId, prompts[parsed.field], {
      placeholder: "…",
    });
    if (!res.ok || res.messageId == null) return;
    await upsertCourierSession(
      telegramUserId,
      chatId,
      step,
      order.orderNumber,
      JSON.stringify({ promptMessageId: res.messageId }),
    );
    return;
  }

  if (parsed.kind === "order_loc_gps") {
    const order = await loadCourierOrderDetailForTelegram(courier.id, parsed.orderNumber);
    if (!order) {
      await answerCallbackQuery(cq.id, "الطلب غير موجود", true).catch(() => {});
      return;
    }
    await upsertCourierSession(telegramUserId, chatId, "courier_await_gps", order.orderNumber, "{}");
    await sendTelegramLocationRequestKeyboard(
      chatId,
      `<b>📍 موقع الزبون — طلب #${order.orderNumber}</b>\n` +
        `اضغط الزر لإرسال موقعك (GPS). سيُحفظ كموقع الزبون.`,
    ).catch(() => {});
    return;
  }

  if (parsed.kind === "order_pickup") {
    const order = await loadCourierOrderDetailForTelegram(courier.id, parsed.orderNumber);
    if (!order) {
      await answerCallbackQuery(cq.id, "الطلب غير موجود", true).catch(() => {});
      return;
    }
    if (order.status !== "assigned") {
      await answerCallbackQuery(cq.id, "لا يمكن تنفيذ الدفع بهذا الوقت.", true).catch(() => {});
      return;
    }
    if (order.orderSubtotal == null) {
      await answerCallbackQuery(cq.id, "سعر الطلب غير محدد.", true).catch(() => {});
      return;
    }
    const expectedAlf = formatDinarAsAlf(order.orderSubtotal);
    await beginCourierPickupAmountStep(chatId, telegramUserId, order.orderNumber, expectedAlf);
    return;
  }

  if (parsed.kind === "order_delivery") {
    const order = await loadCourierOrderDetailForTelegram(courier.id, parsed.orderNumber);
    if (!order) {
      await answerCallbackQuery(cq.id, "الطلب غير موجود", true).catch(() => {});
      return;
    }
    if (order.status !== "delivering") {
      await answerCallbackQuery(cq.id, "لا يمكن تنفيذ الاستلام بهذا الوقت.", true).catch(() => {});
      return;
    }
    if (order.totalAmount == null) {
      await answerCallbackQuery(cq.id, "المبلغ الكلي غير محدد.", true).catch(() => {});
      return;
    }
    const expectedAlf = formatDinarAsAlf(order.totalAmount);
    await beginCourierDeliveryAmountStep(chatId, telegramUserId, order.orderNumber, expectedAlf);
    return;
  }

  if (parsed.kind === "wallet") {
    const { text, keyboard } = await buildCourierWalletTelegramText(courier, parsed.tab, parsed.page);
    await editTelegramMessage(chatId, cq.message.message_id, text, keyboard).catch(async () => {
      await sendTelegramMessageWithKeyboardToChat(chatId, text, keyboard);
    });
    return;
  }
}

export async function processCourierTelegramSessionMessage(
  message: NonNullable<TgUpdate["message"]>,
  courier: { id: string; name: string; vehicleType: "car" | "bike" },
): Promise<boolean> {
  const telegramUserId = String(message.from?.id ?? "");
  const chatId = String(message.chat.id);

  const session = await prisma.telegramBotSession.findUnique({
    where: { telegramUserId },
  });
  if (!session?.step.startsWith("courier_")) return false;

  const gpsLoc = (message as { location?: { latitude: number; longitude: number } }).location;
  if (session.step === "courier_await_gps" && gpsLoc) {
    const orderNumber = session.orderNumber;
    if (orderNumber == null) return false;
    const order = await loadCourierOrderDetailForTelegram(courier.id, orderNumber);
    if (!order) {
      await clearCourierSession(telegramUserId);
      return true;
    }
    const lat = gpsLoc.latitude;
    const lng = gpsLoc.longitude;
    const mapsUrl = `https://www.google.com/maps?q=${lat},${lng}`;
    const label = courier.name.trim() || "مندوب";
    await prisma.$transaction(async (tx) => {
      await tx.order.update({
        where: { id: order.id },
        data: {
          customerLocationUrl: mapsUrl,
          customerLocationSetByCourierAt: new Date(),
          customerLocationUploadedByName: label,
        },
      });
      if (order.customerId) {
        await tx.customer.update({
          where: { id: order.customerId },
          data: { customerLocationUrl: mapsUrl },
        });
      }
    });
    revalidateCourierOrder(order.id);
    await clearCourierSession(telegramUserId);
    await sendTelegramMessageRemoveKeyboard(
      chatId,
      `تم حفظ موقع الزبون لطلب <b>#${order.orderNumber}</b>.`,
    ).catch(() => {});
    return true;
  }

  if (/^courier_photo_(sh|or|cu)$/.test(session.step)) {
    const slot = session.step === "courier_photo_sh" ? "shop" : session.step === "courier_photo_or" ? "order" : "cust";
    let promptMessageId: number;
    try {
      promptMessageId = JSON.parse(session.payload || "{}").promptMessageId;
    } catch {
      return false;
    }
    if (message.reply_to_message?.message_id !== promptMessageId) return false;
    const fileId = pickCourierPhotoFileId(message);
    if (!fileId) {
      await sendTelegramMessageWithKeyboardToChat(
        chatId,
        "أرسل صورة صالحة (ملف صورة).",
        { inline_keyboard: [] },
      ).catch(() => {});
      return true;
    }
    const orderNumber = session.orderNumber;
    if (orderNumber == null) return false;
    const order = await loadCourierOrderDetailForTelegram(courier.id, orderNumber);
    if (!order) {
      await clearCourierSession(telegramUserId);
      return true;
    }
    try {
      const buf = await telegramDownloadFileById(fileId);
      const jpeg = await resizeImageBufferForShop(buf);
      const url = await saveOrderImageFromResizedBuffer(jpeg, MAX_ORDER_IMAGE_BYTES);
      const uploader = courier.name.trim() || "مندوب";
      if (slot === "shop") {
        await prisma.order.update({
          where: { id: order.id },
          data: { shopDoorPhotoUrl: url, shopDoorPhotoUploadedByName: uploader },
        });
      } else if (slot === "order") {
        await prisma.order.update({
          where: { id: order.id },
          data: { imageUrl: url, orderImageUploadedByName: uploader },
        });
      } else {
        await prisma.$transaction(async (tx) => {
          await tx.order.update({
            where: { id: order.id },
            data: {
              customerDoorPhotoUrl: url,
              customerDoorPhotoUploadedByName: uploader,
            },
          });
          if (order.customerId) {
            await tx.customer.update({
              where: { id: order.customerId },
              data: { customerDoorPhotoUrl: url },
            });
          }
        });
      }
      revalidateCourierOrder(order.id);
    } catch (e) {
      console.error("[courier telegram photo]", e);
      await sendTelegramMessageWithKeyboardToChat(chatId, "تعذّر حفظ الصورة.", {
        inline_keyboard: [],
      }).catch(() => {});
    }
    await clearCourierSession(telegramUserId);
    await sendTelegramMessageWithKeyboardToChat(
      chatId,
      "تم حفظ الصورة.",
      { inline_keyboard: [[{ text: "⬅️ فتح الطلب", callback_data: `co_order_${order.orderNumber}` }]] },
    ).catch(() => {});
    return true;
  }

  const textIn = message.text?.trim() ?? "";
  if (!textIn) return false;

  let promptMessageId: number;
  try {
    promptMessageId = JSON.parse(session.payload || "{}").promptMessageId;
  } catch {
    return false;
  }
  if (message.reply_to_message?.message_id !== promptMessageId) return false;

  const orderNumber = session.orderNumber;
  if (orderNumber == null) return false;
  const order = await loadCourierOrderDetailForTelegram(courier.id, orderNumber);
  if (!order) {
    await clearCourierSession(telegramUserId);
    return true;
  }

  if (session.step === "courier_pickup_amt") {
    const parsed = parseAlfInputToDinarDecimalRequired(textIn);
    if (!parsed.ok) {
      await sendTelegramMessageWithForceReply(
        chatId,
        "❌ المبلغ غير صالح. أدخل رقماً بالألف (ردّ على هذه الرسالة):",
        { placeholder: "بالألف" },
      );
      return true;
    }
    const amountDinar = new Decimal(parsed.value);
    if (amountDinar.lt(0)) {
      await sendTelegramMessageWithForceReply(chatId, "❌ المبلغ لا يمكن أن يكون سالباً.", {
        placeholder: "بالألف",
      });
      return true;
    }
    const expected = order.orderSubtotal;
    if (expected == null) {
      await clearCourierSession(telegramUserId);
      return true;
    }
    const agg = await prisma.orderCourierMoneyEvent.aggregate({
      where: {
        orderId: order.id,
        kind: MONEY_KIND_PICKUP,
        deletedAt: null,
        recordedByCompanyPreparerId: null,
      },
      _sum: { amountDinar: true },
    });
    const paidSoFar = agg._sum.amountDinar ?? new Decimal(0);
    const nextPaid = paidSoFar.plus(amountDinar);
    const matches = dinarAmountsMatchExpected(nextPaid, expected);
    const needsNote = amountDinar.eq(0) || !matches;

    if (needsNote) {
      const res = await sendTelegramMessageWithForceReply(
        chatId,
        "❗ المبلغ مختلف عن المتوقع أو صفر. اكتب ملاحظة (سبب الفرق) — ردّ على هذه الرسالة:",
        { placeholder: "ملاحظة" },
      );
      if (!res.ok || res.messageId == null) return true;
      await upsertCourierSession(
        telegramUserId,
        chatId,
        "courier_pickup_note",
        orderNumber,
        JSON.stringify({
          promptMessageId: res.messageId,
          amountDinar: amountDinar.toFixed(4),
        }),
      );
      return true;
    }

    await completeCourierPickupTx(courier, order, amountDinar, matches, "");
    await clearCourierSession(telegramUserId);
    await sendTelegramMessageWithKeyboardToChat(
      chatId,
      "تم تسجيل دفع العميل.",
      { inline_keyboard: [[{ text: "⬅️ فتح الطلب", callback_data: `co_order_${order.orderNumber}` }]] },
    ).catch(() => {});
    return true;
  }

  if (session.step === "courier_pickup_note") {
    const payload = JSON.parse(session.payload || "{}") as { amountDinar?: string };
    const amountDinar = new Decimal(payload.amountDinar ?? "0");
    const mismatchNote = textIn.trim();
    if (!mismatchNote) {
      await sendTelegramMessageWithForceReply(chatId, "❌ الملاحظة مطلوبة.", { placeholder: "ملاحظة" });
      return true;
    }
    const expected = order.orderSubtotal;
    if (expected == null) return false;
    const agg = await prisma.orderCourierMoneyEvent.aggregate({
      where: {
        orderId: order.id,
        kind: MONEY_KIND_PICKUP,
        deletedAt: null,
        recordedByCompanyPreparerId: null,
      },
      _sum: { amountDinar: true },
    });
    const paidSoFar = agg._sum.amountDinar ?? new Decimal(0);
    const nextPaid = paidSoFar.plus(amountDinar);
    const matches = dinarAmountsMatchExpected(nextPaid, expected);

    await completeCourierPickupTx(courier, order, amountDinar, matches, mismatchNote);
    await clearCourierSession(telegramUserId);
    await sendTelegramMessageWithKeyboardToChat(
      chatId,
      "تم تسجيل دفع العميل.",
      { inline_keyboard: [[{ text: "⬅️ فتح الطلب", callback_data: `co_order_${order.orderNumber}` }]] },
    ).catch(() => {});
    return true;
  }

  if (session.step === "courier_delivery_amt") {
    const parsed = parseAlfInputToDinarDecimalRequired(textIn);
    if (!parsed.ok) {
      await sendTelegramMessageWithForceReply(
        chatId,
        "❌ المبلغ غير صالح. أدخل رقماً بالألف (ردّ على هذه الرسالة):",
        { placeholder: "بالألف" },
      );
      return true;
    }
    const amountDinar = new Decimal(parsed.value);
    if (amountDinar.lt(0)) {
      await sendTelegramMessageWithForceReply(chatId, "❌ المبلغ لا يمكن أن يكون سالباً.", {
        placeholder: "بالألف",
      });
      return true;
    }
    const expected = order.totalAmount;
    if (expected == null) {
      await clearCourierSession(telegramUserId);
      return true;
    }
    const agg = await prisma.orderCourierMoneyEvent.aggregate({
      where: {
        orderId: order.id,
        kind: MONEY_KIND_DELIVERY,
        deletedAt: null,
        recordedByCompanyPreparerId: null,
      },
      _sum: { amountDinar: true },
    });
    const receivedSoFar = agg._sum.amountDinar ?? new Decimal(0);
    const nextReceived = receivedSoFar.plus(amountDinar);
    const matches = dinarAmountsMatchExpected(nextReceived, expected);
    const needsNote = amountDinar.eq(0) || !matches;

    if (needsNote) {
      const res = await sendTelegramMessageWithForceReply(
        chatId,
        "❗ المبلغ مختلف عن المتوقع أو صفر. اكتب ملاحظة — ردّ على هذه الرسالة:",
        { placeholder: "ملاحظة" },
      );
      if (!res.ok || res.messageId == null) return true;
      await upsertCourierSession(
        telegramUserId,
        chatId,
        "courier_delivery_note",
        orderNumber,
        JSON.stringify({
          promptMessageId: res.messageId,
          amountDinar: amountDinar.toFixed(4),
        }),
      );
      return true;
    }

    await completeCourierDeliveryTx(courier, order, amountDinar, matches, "");
    await clearCourierSession(telegramUserId);
    await sendTelegramMessageWithKeyboardToChat(
      chatId,
      "تم تسجيل استلام من الزبون وإتمام التسليم.",
      { inline_keyboard: [[{ text: "⬅️ فتح الطلب", callback_data: `co_order_${order.orderNumber}` }]] },
    ).catch(() => {});
    return true;
  }

  if (session.step === "courier_delivery_note") {
    const payload = JSON.parse(session.payload || "{}") as { amountDinar?: string };
    const amountDinar = new Decimal(payload.amountDinar ?? "0");
    const mismatchNote = textIn.trim();
    if (!mismatchNote) {
      await sendTelegramMessageWithForceReply(chatId, "❌ الملاحظة مطلوبة.", { placeholder: "ملاحظة" });
      return true;
    }
    const expected = order.totalAmount;
    if (expected == null) return false;
    const agg = await prisma.orderCourierMoneyEvent.aggregate({
      where: {
        orderId: order.id,
        kind: MONEY_KIND_DELIVERY,
        deletedAt: null,
        recordedByCompanyPreparerId: null,
      },
      _sum: { amountDinar: true },
    });
    const receivedSoFar = agg._sum.amountDinar ?? new Decimal(0);
    const nextReceived = receivedSoFar.plus(amountDinar);
    const matches = dinarAmountsMatchExpected(nextReceived, expected);

    await completeCourierDeliveryTx(courier, order, amountDinar, matches, mismatchNote);
    await clearCourierSession(telegramUserId);
    await sendTelegramMessageWithKeyboardToChat(
      chatId,
      "تم تسجيل استلام من الزبون.",
      { inline_keyboard: [[{ text: "⬅️ فتح الطلب", callback_data: `co_order_${order.orderNumber}` }]] },
    ).catch(() => {});
    return true;
  }

  if (session.step === "courier_edit_phone") {
    const phone = normalizeIraqMobileLocal11(textIn);
    if (!phone) {
      await sendTelegramMessageWithForceReply(chatId, "❌ رقم غير صالح (07…).", { placeholder: "07" });
      return true;
    }
    await prisma.$transaction(async (tx) => {
      await tx.order.update({ where: { id: order.id }, data: { customerPhone: phone } });
      if (order.customerId) {
        await tx.customer.update({ where: { id: order.customerId }, data: { phone } });
      }
    });
    revalidateCourierOrder(order.id);
    await clearCourierSession(telegramUserId);
    await sendTelegramMessageWithKeyboardToChat(
      chatId,
      "تم تحديث رقم الزبون.",
      { inline_keyboard: [[{ text: "⬅️ فتح الطلب", callback_data: `co_order_${order.orderNumber}` }]] },
    ).catch(() => {});
    return true;
  }

  if (session.step === "courier_edit_alt") {
    const alt =
      textIn === "—" || textIn === "-" ? null : normalizeIraqMobileLocal11(textIn);
    if (textIn !== "—" && textIn !== "-" && !alt) {
      await sendTelegramMessageWithForceReply(
        chatId,
        "❌ رقم غير صالح أو اكتب — للمسح.",
        { placeholder: "07" },
      );
      return true;
    }
    await prisma.$transaction(async (tx) => {
      await tx.order.update({ where: { id: order.id }, data: { alternatePhone: alt } });
      if (order.customerId) {
        await tx.customer.update({ where: { id: order.customerId }, data: { alternatePhone: alt } });
      }
    });
    revalidateCourierOrder(order.id);
    await clearCourierSession(telegramUserId);
    await sendTelegramMessageWithKeyboardToChat(
      chatId,
      "تم تحديث الرقم الثانٍ.",
      { inline_keyboard: [[{ text: "⬅️ فتح الطلب", callback_data: `co_order_${order.orderNumber}` }]] },
    ).catch(() => {});
    return true;
  }

  if (session.step === "courier_edit_lmk") {
    await prisma.$transaction(async (tx) => {
      await tx.order.update({
        where: { id: order.id },
        data: { customerLandmark: textIn },
      });
      if (order.customerId) {
        await tx.customer.update({
          where: { id: order.customerId },
          data: { customerLandmark: textIn },
        });
      }
    });
    revalidateCourierOrder(order.id);
    await clearCourierSession(telegramUserId);
    await sendTelegramMessageWithKeyboardToChat(
      chatId,
      "تم تحديث أقرب نقطة دالة.",
      { inline_keyboard: [[{ text: "⬅️ فتح الطلب", callback_data: `co_order_${order.orderNumber}` }]] },
    ).catch(() => {});
    return true;
  }

  if (session.step === "courier_edit_loc") {
    const url = normalizeCourierMapsUrl(textIn);
    try {
      new URL(url);
    } catch {
      await sendTelegramMessageWithForceReply(chatId, "❌ رابط غير صالح.", { placeholder: "http" });
      return true;
    }
    await prisma.$transaction(async (tx) => {
      await tx.order.update({
        where: { id: order.id },
        data: {
          customerLocationUrl: url,
          customerLocationSetByCourierAt: null,
          customerLocationUploadedByName: null,
        },
      });
      if (order.customerId) {
        await tx.customer.update({
          where: { id: order.customerId },
          data: { customerLocationUrl: url },
        });
      }
    });
    revalidateCourierOrder(order.id);
    await clearCourierSession(telegramUserId);
    await sendTelegramMessageWithKeyboardToChat(
      chatId,
      "تم تحديث رابط الخرائط.",
      { inline_keyboard: [[{ text: "⬅️ فتح الطلب", callback_data: `co_order_${order.orderNumber}` }]] },
    ).catch(() => {});
    return true;
  }

  return false;
}

export async function handleCourierPrivateTextMessage({
  message,
  courier,
  telegramUserId,
}: {
  message: NonNullable<TgUpdate["message"]>;
  courier: {
    id: string;
    name: string;
    mandoubTotalsResetAt: Date | null;
    mandoubWalletCarryOverDinar: Decimal;
    vehicleType: "car" | "bike";
  };
  telegramUserId: string;
}): Promise<void> {
  const chatId = String(message.chat.id);
  const txt = message.text?.trim() ?? "";
  if (txt === "/start" || txt === "start") {
    await handleCourierStart({ chatId, telegramUserId });
    return;
  }

  if (
    await processCourierTelegramSessionMessage(message, {
      id: courier.id,
      name: courier.name,
      vehicleType: courier.vehicleType,
    })
  ) {
    return;
  }

  const msgLoc = (message as { location?: unknown }).location;
  if (message.photo?.length || msgLoc || message.document) {
    return;
  }

  if (!txt) {
    return;
  }

  const mainText =
    `<b>أهلاً ${escapeTelegramHtml(courier.name)}</b>\n` +
    `اختر من الأزرار:`;
  await sendTelegramMessageWithKeyboardToChat(chatId, mainText, buildCourierKeyboard("main")).catch(() => {});
}