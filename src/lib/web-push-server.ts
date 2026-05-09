import webpush from "web-push";
import { getPublicAppUrl } from "@/lib/app-url";
import { buildDelegatePortalUrl } from "@/lib/delegate-link";
import { audienceSettings, getOrCreateNotificationSettings } from "@/lib/notification-settings";
import { renderNotificationTemplate } from "@/lib/notification-template";
import { prisma } from "@/lib/prisma";
import { escapeTelegramHtml, sendTelegramMessageWithKeyboardToChat } from "@/lib/telegram";

function configureVapid(): boolean {
  const pub = process.env.VAPID_PUBLIC_KEY?.trim();
  const priv = process.env.VAPID_PRIVATE_KEY?.trim();
  const subject = process.env.VAPID_SUBJECT?.trim() || "mailto:noreply@localhost";
  if (!pub || !priv) return false;
  webpush.setVapidDetails(subject, pub, priv);
  return true;
}

/** يُستخدم في الواجهة لإظهار زر الاشتراك فقط عند توفر المفاتيح */
export function isWebPushConfigured(): boolean {
  return !!(process.env.VAPID_PUBLIC_KEY?.trim() && process.env.VAPID_PRIVATE_KEY?.trim());
}

export function getVapidPublicKeyForClient(): string | null {
  return process.env.VAPID_PUBLIC_KEY?.trim() || process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim() || null;
}

type PushPayload = { title: string; body: string; url: string; tag: string };

export type TestPushAudience = "admin" | "mandoub" | "employee" | "customer";

export async function sendTestPushBroadcast(opts: {
  title: string;
  body: string;
  audiences: TestPushAudience[];
}): Promise<{ counts: Record<TestPushAudience, number>; vapidConfigured: boolean }> {
  const empty: Record<TestPushAudience, number> = {
    admin: 0,
    mandoub: 0,
    employee: 0,
    customer: 0,
  };
  if (!isWebPushConfigured()) {
    return { counts: empty, vapidConfigured: false };
  }
  const base = getPublicAppUrl();
  const tagBase = `kse-test-${Date.now()}`;

  for (const aud of opts.audiences) {
    const where =
      aud === "admin"
        ? { audience: "admin" }
        : aud === "mandoub"
          ? { audience: "mandoub" }
          : aud === "employee"
            ? { audience: "employee" }
            : { audience: "customer" };

    const subs = await prisma.webPushSubscription.findMany({
      where,
      select: { id: true, endpoint: true, p256dh: true, auth: true },
    });

    const url =
      aud === "admin"
        ? `${base}/admin`
        : aud === "mandoub"
          ? `${base}/mandoub`
          : aud === "employee"
            ? `${base}/client/order`
            : `${base}/`;

    await sendToSubscriptions(subs, {
      title: opts.title,
      body: opts.body,
      url,
      tag: `${tagBase}-${aud}`,
    });
    empty[aud] = subs.length;
  }

  return { counts: empty, vapidConfigured: true };
}

/** أولوية عالية + TTL طويل: يقلّل تأخير التسليم عند إغلاق التطبيق أو وضع الطاقة على الجوال */
const WEB_PUSH_HTTP_OPTIONS = { TTL: 86400, urgency: "high" as const };

async function sendToSubscriptions(
  subs: { id: string; endpoint: string; p256dh: string; auth: string }[],
  payload: PushPayload,
): Promise<void> {
  if (!configureVapid()) return;
  const json = JSON.stringify(payload);
  for (const s of subs) {
    try {
      await webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        json,
        WEB_PUSH_HTTP_OPTIONS,
      );
    } catch (e: unknown) {
      const status = (e as { statusCode?: number }).statusCode;
      if (status === 410 || status === 404) {
        await prisma.webPushSubscription.delete({ where: { id: s.id } }).catch(() => {});
      }
    }
  }
}

/** إشعار للإدارة: طلب جديد قيد الانتظار */
export async function pushNotifyAdminsNewPendingOrder(orderNumber: number): Promise<void> {
  if (!isWebPushConfigured()) return;
  const settingsRow = await getOrCreateNotificationSettings();
  const settings = audienceSettings(settingsRow, "admin");
  if (!settings.enabled) return;
  const order = await prisma.order.findUnique({
    where: { orderNumber },
    select: {
      shop: { select: { name: true } },
      customerRegion: { select: { name: true } },
    },
  });

  const body = renderNotificationTemplate(settings.templateSingle, {
    count: 1,
    orderNumber,
    shopName: order?.shop?.name ?? "—",
    regionName: order?.customerRegion?.name ?? "—",
  });
  const subs = await prisma.webPushSubscription.findMany({
    where: { audience: "admin" },
    select: { id: true, endpoint: true, p256dh: true, auth: true },
  });
  await sendToSubscriptions(subs, {
    title: "لوحة الإدارة — طلب جديد",
    body,
    url: `${getPublicAppUrl()}/admin/orders/pending`,
    tag: `kse-push-admin-${orderNumber}`,
  });
}

/** إشعار للإدارة: تغيّر توفر مندوب/مجهز */
export async function pushNotifyAdminsPresenceChange(input: {
  kind: "courier" | "preparer";
  name: string;
  available: boolean;
}): Promise<void> {
  if (!isWebPushConfigured()) return;
  const settingsRow = await getOrCreateNotificationSettings();
  const settings = audienceSettings(settingsRow, "admin");
  if (!settings.enabled) return;

  const title =
    input.kind === "courier" ? "مندوب — التوفر" : "مجهز — التوفر";
  const body = `${input.name.trim() || "—"} — ${input.available ? "متاح للإسناد" : "غير متاح"}`;
  const subs = await prisma.webPushSubscription.findMany({
    where: { audience: "admin" },
    select: { id: true, endpoint: true, p256dh: true, auth: true },
  });
  await sendToSubscriptions(subs, {
    title,
    body,
    url: `${getPublicAppUrl()}/admin`,
    tag: `kse-presence-${input.kind}-${Date.now()}`,
  });
}

/** إشعار للمندوب: إسناد طلب */
export async function pushNotifyCourierNewAssignment(
  courierId: string,
  orderNumber: number,
  orderId?: string
): Promise<void> {
  const courier = await prisma.courier.findUnique({
    where: { id: courierId },
    select: { telegramUserId: true },
  });
  if (courier?.telegramUserId?.trim()) {
    const chatId = courier.telegramUserId.trim();
    const text = `<b>تم إسناد طلب جديد لك</b>\n\n🔢 رقم الطلب: <b>#${escapeTelegramHtml(String(
      orderNumber,
    ))}</b>\n\nاختر:`;
    const kb = {
      inline_keyboard: [
        [
          { text: "📦 فتح الطلب", callback_data: `co_order_${orderNumber}` },
          { text: "📦 طلبياتي", callback_data: "co_orders_0" },
        ],
        [{ text: "💼 محفظتي", callback_data: "co_wallet_0" }],
      ],
    };
    try {
      await sendTelegramMessageWithKeyboardToChat(chatId, text, kb);
    } catch (e) {
      console.error("[pushNotifyCourierNewAssignment] telegram send failed:", e);
    }
  }
  if (!isWebPushConfigured()) return;
  const settingsRow = await getOrCreateNotificationSettings();
  const settings = audienceSettings(settingsRow, "mandoub");
  if (!settings.enabled) return;
  const order = orderId
    ? await prisma.order.findUnique({
        where: { id: orderId },
        select: {
          shop: { select: { name: true } },
          customerRegion: { select: { name: true } },
        },
      })
    : null;

  const body = renderNotificationTemplate(settings.templateSingle, {
    count: 1,
    orderNumber,
    shopName: order?.shop?.name ?? "—",
    regionName: order?.customerRegion?.name ?? "—",
  });
  const subs = await prisma.webPushSubscription.findMany({
    where: { audience: "mandoub", courierId },
    select: { id: true, endpoint: true, p256dh: true, auth: true },
  });
  const path = orderId ? `/mandoub/order/${orderId}` : "/mandoub";
  const url = buildDelegatePortalUrl(courierId, getPublicAppUrl(), path);
  await sendToSubscriptions(subs, {
    title: "لوحة المندوب — طلب جديد",
    body,
    url,
    tag: `kse-push-mandoub-${orderNumber}-${courierId}`,
  });
}

/** إشعار للمجهز: طلب تجهيز جديد أو إسناد من الموقع */
export async function pushNotifyPreparerNewNotice(input: {
  preparerId: string;
  title: string;
  body?: string;
  orderId?: string;
  draftId?: string;
}): Promise<void> {
  const settingsRow = await getOrCreateNotificationSettings();
  const settings = audienceSettings(settingsRow, "preparer");

  const rawTitle = input.title || "";
  const rawBody = input.body || "";

  // محاولة استخراج رقم الطلب إذا لم يتوفر معرف صريح
  let orderNumber = 0;
  let shopName = "—";
  let regionName = "—";

  const orderNumMatch = (rawTitle + rawBody).match(/#(\d+)/);
  const detectedOrderNumber = orderNumMatch ? parseInt(orderNumMatch[1]) : 0;

  // جلب تفاصيل الطلب أو المسودة وملء البيانات
  const [order, draft, preparer] = await Promise.all([
    prisma.order.findFirst({
      where: {
        OR: [
          { id: input.orderId || "undefined" },
          { orderNumber: detectedOrderNumber > 0 ? detectedOrderNumber : -1 }
        ]
      },
      select: {
        orderNumber: true,
        shop: { select: { name: true } },
        customerRegion: { select: { name: true } },
        submissionSource: true
      }
    }),
    input.draftId
      ? prisma.companyPreparerShoppingDraft.findUnique({
          where: { id: input.draftId },
          select: { customerRegion: { select: { name: true } } }
        })
      : null,
    prisma.companyPreparer.findUnique({
      where: { id: input.preparerId },
      select: { telegramUserId: true }
    })
  ]);

  if (order) {
    orderNumber = order.orderNumber;
    shopName = order.shop?.name || "—";
    regionName = order.customerRegion?.name || "—";
  } else if (draft) {
    regionName = draft.customerRegion?.name || "—";
  }

  let body = "";
  if (order?.submissionSource === "web_store" && settings.templateWebsite) {
    body = renderNotificationTemplate(settings.templateWebsite, { count: 1, orderNumber, shopName, regionName });
  } else if (input.draftId && settings.templateMultiple) {
    body = renderNotificationTemplate(settings.templateMultiple, { count: 1, orderNumber, shopName, regionName });
  } else {
    body = renderNotificationTemplate(settings.templateSingle, { count: 1, orderNumber, shopName, regionName });
  }

  // 1. إرسال Telegram إذا توفر المعرف
  if (preparer?.telegramUserId?.trim()) {
    const chatId = preparer.telegramUserId.trim();
    const text = `<b>${escapeTelegramHtml(input.title)}</b>\n\n${escapeTelegramHtml(body || rawBody)}`;
    const kb = {
      inline_keyboard: [[{ text: "📦 فتح قائمة التجهيز", callback_data: "pr_prep_0" }]],
    };
    await sendTelegramMessageWithKeyboardToChat(chatId, text, kb).catch(() => {});
  }

  // 2. إرسال Web Push إذا كان مفعلاً
  if (!isWebPushConfigured() || !settings.enabled) return;

  const subs = await prisma.webPushSubscription.findMany({
    where: { audience: "preparer", preparerId: input.preparerId },
    select: { id: true, endpoint: true, p256dh: true, auth: true },
  });

  await sendToSubscriptions(subs, {
    title: "لوحة المجهز — إشعار جديد",
    body,
    url: `${getPublicAppUrl()}/preparer/preparation`,
    tag: `kse-push-preparer-${input.preparerId}-${orderNumber || Date.now()}`,
  });
}

/** إشعار دردشة */
export async function pushNotifyChatNewMessage(opts: {
  targetRole: "admin" | "mandoub" | "preparer" | "supplier";
  targetActorId: string;
  senderName: string;
  text: string;
  threadId: string;
}): Promise<void> {
  if (!isWebPushConfigured()) return;

  const where: any = { audience: opts.targetRole === "admin" ? "admin" : opts.targetRole === "mandoub" ? "mandoub" : opts.targetRole === "preparer" ? "preparer" : "supplier" };
  if (opts.targetRole === "mandoub") where.courierId = opts.targetActorId;
  if (opts.targetRole === "preparer") where.preparerId = opts.targetActorId;
  if (opts.targetRole === "supplier") where.supplierId = opts.targetActorId;

  const subs = await prisma.webPushSubscription.findMany({
    where,
    select: { id: true, endpoint: true, p256dh: true, auth: true },
  });

  if (subs.length === 0) return;

  await sendToSubscriptions(subs, {
    title: `رسالة من ${opts.senderName}`,
    body: opts.text.slice(0, 100),
    url: `${getPublicAppUrl()}/${opts.targetRole === "admin" ? "admin" : opts.targetRole}`,
    tag: `portal-chat-${opts.threadId}`,
  });
}
