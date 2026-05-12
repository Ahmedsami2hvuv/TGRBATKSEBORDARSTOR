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

type PushPayload = { title: string; body: string; url: string; tag: string; sound?: string };

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

  const base = getPublicAppUrl();
  const tagBase = `kse-test-${Date.now()}`;
  const hasVapid = isWebPushConfigured();

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
      select: { id: true, endpoint: true, p256dh: true, auth: true, courierId: true, preparerId: true },
    });

    const externalIds: string[] = subs
      .map(s => s.courierId || s.preparerId)
      .filter((id): id is string => !!id);

    if (aud === "mandoub") {
      const allCouriers = await prisma.courier.findMany({ select: { id: true } });
      allCouriers.forEach(c => {
        if (!externalIds.includes(c.id)) externalIds.push(c.id);
      });
    }

    if (aud === "admin") {
      externalIds.push("admin_global");
    }

    const url =
      aud === "admin"
        ? `${base}/admin`
        : aud === "mandoub"
          ? `${base}/mandoub`
          : aud === "employee"
            ? `${base}/client/order`
            : `${base}/`;

    const dummyVars = {
      count: 5,
      orderNumber: 1234,
      shopName: "محل تجريبي",
      regionName: "المنصورة",
    };

    const renderedTitle = renderNotificationTemplate(opts.title, dummyVars);
    const renderedBody = renderNotificationTemplate(opts.body, dummyVars);

    await sendToSubscriptions(subs, {
      title: `🔔 [تجربة] ${renderedTitle}`,
      body: renderedBody,
      url,
      tag: `${tagBase}-${aud}`,
    }, externalIds);
    empty[aud] = subs.length || externalIds.length;
  }

  return { counts: empty, vapidConfigured: hasVapid };
}

/** أولوية عالية + TTL طويل: يقلّل تأخير التسليم عند إغلاق التطبيق أو وضع الطاقة على الجوال */
const WEB_PUSH_HTTP_OPTIONS = { TTL: 86400, urgency: "high" as const };

import { sendOneSignalNotification } from "@/lib/onesignal-server";

async function sendToSubscriptions(
  subs: { id: string; endpoint: string; p256dh: string; auth: string }[],
  payload: PushPayload,
  externalIds?: string[],
): Promise<void> {
  // 1. الإرسال عبر وان سيجنال (النظام الجديد)
  if (externalIds && externalIds.length > 0) {
    console.log("OneSignal: Sending to", externalIds);
    await sendOneSignalNotification({
      title: payload.title,
      body: payload.body,
      url: payload.url,
      externalIds: externalIds,
    });
  }

  // 2. الطريقة القديمة (Web Push) - سنبقيها فقط كاحتياط للأدمن حالياً
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
      // حذف الاشتراكات القديمة المعطلة
      const status = (e as { statusCode?: number }).statusCode;
      if (status === 410 || status === 404) {
        await prisma.webPushSubscription.delete({ where: { id: s.id } }).catch(() => {});
      }
    }
  }
}

/** إشعار للإدارة: طلب جديد قيد الانتظار */
export async function pushNotifyAdminsNewPendingOrder(orderNumber: number): Promise<void> {
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

  const title = renderNotificationTemplate(settings.titleSingle, {
    count: 1,
    orderNumber,
    shopName: order?.shop?.name ?? "—",
    regionName: order?.customerRegion?.name ?? "—",
  });

  const body = renderNotificationTemplate(settings.templateSingle, {
    count: 1,
    orderNumber,
    shopName: order?.shop?.name ?? "—",
    regionName: order?.customerRegion?.name ?? "—",
  });

  // جلب معرفات الموظفين (الأدمن) + المعرف العام للأدمن
  const adminEmployees = await prisma.employee.findMany({
    where: { role: "admin" },
    select: { id: true }
  });
  const adminExternalIds = [...adminEmployees.map(e => e.id), "admin_global"];

  const subs = await prisma.webPushSubscription.findMany({
    where: { audience: "admin" },
    select: { id: true, endpoint: true, p256dh: true, auth: true },
  });
  await sendToSubscriptions(subs, {
    title,
    body,
    url: `${getPublicAppUrl()}/admin/orders/pending`,
    tag: `kse-push-admin-${orderNumber}`,
    sound: settings.soundPreset,
  }, adminExternalIds);
}

/** إشعار للإدارة: تغيّر توفر مندوب/مجهز */
export async function pushNotifyAdminsPresenceChange(input: {
  kind: "courier" | "preparer";
  name: string;
  available: boolean;
}): Promise<void> {
  const settingsRow = await getOrCreateNotificationSettings();
  const settings = audienceSettings(settingsRow, "admin");
  if (!settings.enabled) return;

  const title =
    input.kind === "courier" ? "مندوب — التوفر" : "مجهز — التوفر";
  const body = `${input.name.trim() || "—"} — ${input.available ? "متاح للإسناد" : "غير متاح"}`;

  // جلب معرفات الأدمن
  const adminEmployees = await prisma.employee.findMany({
    where: { role: "admin" },
    select: { id: true }
  });
  const adminExternalIds = [...adminEmployees.map(e => e.id), "admin_global"];

  const subs = await prisma.webPushSubscription.findMany({
    where: { audience: "admin" },
    select: { id: true, endpoint: true, p256dh: true, auth: true },
  });
  await sendToSubscriptions(subs, {
    title,
    body,
    url: `${getPublicAppUrl()}/admin`,
    tag: `kse-presence-${input.kind}-${Date.now()}`,
  }, adminExternalIds);
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

  // 1. إرسال Telegram (تم استعادته)
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
    await sendTelegramMessageWithKeyboardToChat(chatId, text, kb).catch(() => {});
  }

  const settingsRow = await getOrCreateNotificationSettings();
  const settings = audienceSettings(settingsRow, "mandoub");
  if (!settings.enabled) return;

  const order = await prisma.order.findFirst({
    where: {
      OR: [
        { id: orderId || "undefined" },
        { orderNumber: orderNumber }
      ]
    },
    select: {
      orderNumber: true,
      shop: { select: { name: true } },
      customerRegion: { select: { name: true } },
    },
  });

  const finalOrderNumber = order?.orderNumber || orderNumber;

  const title = renderNotificationTemplate(settings.titleSingle, {
    count: 1,
    orderNumber: finalOrderNumber,
    shopName: order?.shop?.name ?? "—",
    regionName: order?.customerRegion?.name ?? "—",
  });

  const body = renderNotificationTemplate(settings.templateSingle, {
    count: 1,
    orderNumber: finalOrderNumber,
    shopName: order?.shop?.name ?? "—",
    regionName: order?.customerRegion?.name ?? "—",
  });

  const subs = await prisma.webPushSubscription.findMany({
    where: { audience: "mandoub", courierId },
    select: { id: true, endpoint: true, p256dh: true, auth: true },
  });

  const path = orderId ? `/mandoub/order/${orderId}` : "/mandoub";
  const url = buildDelegatePortalUrl(courierId, getPublicAppUrl(), path);

  // 2. إرسال OneSignal (باستخدام معرف المندوب)
  await sendToSubscriptions(subs, {
    title,
    body,
    url,
    tag: `kse-push-mandoub-${orderNumber}-${courierId}`,
    sound: settings.soundPreset,
  }, [courierId]);
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
  let title = "";

  if (order?.submissionSource === "web_store" && settings.templateWebsite) {
    title = renderNotificationTemplate(settings.titleSingle, { count: 1, orderNumber, shopName, regionName });
    body = renderNotificationTemplate(settings.templateWebsite, { count: 1, orderNumber, shopName, regionName });
  } else if (input.draftId && settings.templateMultiple) {
    title = renderNotificationTemplate(settings.titleSingle, { count: 1, orderNumber, shopName, regionName });
    body = renderNotificationTemplate(settings.templateMultiple, { count: 1, orderNumber, shopName, regionName });
  } else {
    title = renderNotificationTemplate(settings.titleSingle, { count: 1, orderNumber, shopName, regionName });
    body = renderNotificationTemplate(settings.templateSingle, { count: 1, orderNumber, shopName, regionName });
  }

  // 1. إرسال Telegram إذا توفر المعرف
  if (preparer?.telegramUserId?.trim()) {
    const chatId = preparer.telegramUserId.trim();
    const text = `<b>${escapeTelegramHtml(title || input.title)}</b>\n\n${escapeTelegramHtml(body || rawBody)}`;
    const kb = {
      inline_keyboard: [[{ text: "📦 فتح قائمة التجهيز", callback_data: "pr_prep_0" }]],
    };
    await sendTelegramMessageWithKeyboardToChat(chatId, text, kb).catch(() => {});
  }

  // 2. إرسال Web Push إذا كان مفعلاً
  if (!settings.enabled) return;

  const subs = await prisma.webPushSubscription.findMany({
    where: { audience: "preparer", preparerId: input.preparerId },
    select: { id: true, endpoint: true, p256dh: true, auth: true },
  });

  await sendToSubscriptions(subs, {
    title: title || input.title || `تنبيه من لوحة المجهز`,
    body,
    url: `${getPublicAppUrl()}/preparer/preparation`,
    tag: `kse-push-preparer-${input.preparerId}-${orderNumber || Date.now()}`,
    sound: settings.soundPreset,
  }, [input.preparerId]); // تمرير معرف المجهز لوان سيجنال
}

/** إشعار دردشة */
export async function pushNotifyChatNewMessage(opts: {
  targetRole: "admin" | "mandoub" | "preparer" | "supplier";
  targetActorId: string;
  senderName: string;
  text: string;
  threadId: string;
}): Promise<void> {
  const where: any = { audience: opts.targetRole === "admin" ? "admin" : opts.targetRole === "mandoub" ? "mandoub" : opts.targetRole === "preparer" ? "preparer" : "supplier" };
  if (opts.targetRole === "mandoub") where.courierId = opts.targetActorId;
  if (opts.targetRole === "preparer") where.preparerId = opts.targetActorId;
  if (opts.targetRole === "supplier") where.supplierId = opts.targetActorId;

  const subs = await prisma.webPushSubscription.findMany({
    where,
    select: { id: true, endpoint: true, p256dh: true, auth: true },
  });

  const externalIds: string[] = [];
  if (opts.targetActorId) {
    externalIds.push(opts.targetActorId);
  } else if (opts.targetRole === "admin") {
    externalIds.push("admin_global");
  }

  await sendToSubscriptions(subs, {
    title: `💬 [جديد] رسالة من ${opts.senderName}`,
    body: opts.text.slice(0, 100),
    url: `${getPublicAppUrl()}/${opts.targetRole === "admin" ? "admin" : opts.targetRole}`,
    tag: `portal-chat-${opts.threadId}`,
  }, externalIds.length > 0 ? externalIds : undefined);
}
