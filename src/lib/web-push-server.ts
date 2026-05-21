import webpush from "web-push";
import { getPublicAppUrl } from "@/lib/app-url";
import { buildDelegatePortalUrl } from "@/lib/delegate-link";
import { audienceSettings, getOrCreateNotificationSettings } from "@/lib/notification-settings";
import { renderNotificationTemplate } from "@/lib/notification-template";
import { prisma } from "@/lib/prisma";
import { getBotTokenByPurpose } from "@/lib/telegram-bots";
import { escapeTelegramHtml, sendTelegramHtmlToChat, sendTelegramMessageWithKeyboardToChat } from "@/lib/telegram";
import { resolvePublicAssetSrc } from "@/lib/image-url";
import { formatDinarAsAlf } from "@/lib/money-alf";
import { normalizeIraqMobileLocal11 } from "@/lib/whatsapp";

const SECRET_ADMIN_PATH = "/abo1stor3hlaa2kbr8-47";

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
        ? `${base}${SECRET_ADMIN_PATH}`
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
      sound: payload.sound,
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
    url: `${getPublicAppUrl()}${SECRET_ADMIN_PATH}/orders/pending`,
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
    url: `${getPublicAppUrl()}${SECRET_ADMIN_PATH}`,
    tag: `kse-presence-${input.kind}-${Date.now()}`,
  }, adminExternalIds);
}

/** إشعار للمندوب: إسناد طلب */
export async function pushNotifyCourierNewAssignment(
  courierId: string,
  orderNumber: number,
  orderId?: string
): Promise<void> {
  // جلب بيانات الطلب أولاً لاستخدامها في الإشعار
  const order = await prisma.order.findFirst({
    where: {
      OR: [
        { id: orderId || "undefined" },
        { orderNumber: orderNumber }
      ]
    },
    select: {
      orderNumber: true,
      orderType: true,
      orderSubtotal: true,
      deliveryPrice: true,
      totalAmount: true,
      customerPhone: true,
      alternatePhone: true,
      secondCustomerPhone: true,
      customerLocationUrl: true,
      secondCustomerLocationUrl: true,
      customerDoorPhotoUrl: true,
      secondCustomerDoorPhotoUrl: true,
      customerLandmark: true,
      secondCustomerLandmark: true,
      summary: true,
      orderNoteTime: true,
      routeMode: true,
      customerRegionId: true,
      secondCustomerRegionId: true,
      customer: { select: { customerLocationUrl: true } },
      shop: { select: { name: true, locationUrl: true } },
      customerRegion: { select: { name: true } },
      secondCustomerRegion: { select: { name: true } },
    },
  });

  const finalOrderNumber = order?.orderNumber || orderNumber;

  const courier = await prisma.courier.findUnique({
    where: { id: courierId },
    select: { telegramUserId: true },
  });

  const courierBotToken = await getBotTokenByPurpose("courier");
  console.log(`[pushNotifyCourierNewAssignment] courierId=${courierId} telegramUserId=${courier?.telegramUserId ?? "missing"} botToken=${courierBotToken ? "found" : "missing"}`);

  // 1. إرسال Telegram (تم استعادته)
  if (courier?.telegramUserId?.trim() && courierBotToken) {
    const chatId = courier.telegramUserId.trim();

    const shopName = order?.shop?.name || "—";
    const regionName = order?.customerRegion?.name || "—";
    const secondRegionName = order?.secondCustomerRegion?.name || "";
    const landmark = order?.customerLandmark || "";
    const secondLandmark = order?.secondCustomerLandmark || "";
    const summary = order?.summary || "";
    const noteTime = order?.orderNoteTime || "الان";

    const orderType = order?.orderType || "—";
    const subtotal = order?.orderSubtotal ? formatDinarAsAlf(order.orderSubtotal) : "—";
    const delivery = order?.deliveryPrice ? formatDinarAsAlf(order.deliveryPrice) : "—";
    const total = order?.totalAmount ? formatDinarAsAlf(order.totalAmount) : "—";
    const phone = order?.customerPhone || "—";
    const altPhone = order?.secondCustomerPhone || order?.alternatePhone || "—";

    const isValidUrl = (u: string | null | undefined) => {
      const trimmed = (u || "").trim();
      if (!trimmed) return false;
      return trimmed.startsWith("http") || trimmed.includes("maps.") || trimmed.includes("goo.gl") || /^-?\d+\.\d+,\s*-?\d+\.\d+$/.test(trimmed);
    };

    const formatAsUrl = (u: string | null | undefined) => {
      let trimmed = (u || "").trim();
      if (!trimmed) return "";
      if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) return trimmed;
      if (trimmed.includes("maps.") || trimmed.includes("goo.gl") || trimmed.includes("google.com")) return "https://" + trimmed;
      // معالجة الإحداثيات الخام مثل 33.123,44.123
      if (/^-?\d+\.\d+,\s*-?\d+\.\d+$/.test(trimmed) || /^-?\d+\.\d+,-?\d+\.\d+$/.test(trimmed)) {
        return `https://www.google.com/maps/search/?api=1&query=${trimmed.replace(/\s/g, "")}`;
      }
      return "https://" + trimmed;
    };

    let loc1Raw = order?.customerLocationUrl || order?.customer?.customerLocationUrl || "";
    if (!isValidUrl(loc1Raw) && order?.customerPhone && order?.customerRegionId) {
      const norm = normalizeIraqMobileLocal11(order.customerPhone);
      if (norm) {
        const profile = await prisma.customerPhoneProfile.findUnique({
          where: { phone_regionId: { phone: norm, regionId: order.customerRegionId } }
        });
        if (isValidUrl(profile?.locationUrl)) loc1Raw = profile.locationUrl || "";
      }
    }

    let loc2Raw = order?.secondCustomerLocationUrl || "";
    if (!isValidUrl(loc2Raw) && order?.secondCustomerPhone && order?.secondCustomerRegionId) {
      const norm = normalizeIraqMobileLocal11(order.secondCustomerPhone);
      if (norm) {
        const profile = await prisma.customerPhoneProfile.findUnique({
          where: { phone_regionId: { phone: norm, regionId: order.secondCustomerRegionId } }
        });
        if (isValidUrl(profile?.locationUrl)) loc2Raw = profile.locationUrl || "";
      }
    }

    const shopLoc = isValidUrl(order?.shop?.locationUrl) ? formatAsUrl(order!.shop!.locationUrl) : "";
    const loc1 = isValidUrl(loc1Raw) ? formatAsUrl(loc1Raw) : "";
    const loc2 = isValidUrl(loc2Raw) ? formatAsUrl(loc2Raw) : "";

    // ذكاء اصطناعي للعنوان إذا لم يوجد لاندمارك
    const smartHint1 = !landmark.trim() && order?.customerRegion?.name ? `${order.customerRegion.name}` : "";
    const smartHint2 = !secondLandmark.trim() && order?.secondCustomerRegion?.name ? `${order.secondCustomerRegion.name}` : "";

    let text = `🏪 <b>(${escapeTelegramHtml(shopName)} — ${escapeTelegramHtml(regionName)})</b>
🔔 تم إسناد طلب جديد إليك
📍 ${escapeTelegramHtml(regionName)}${landmark ? ` (${escapeTelegramHtml(landmark)})` : smartHint1 ? ` (استدلال: ${escapeTelegramHtml(smartHint1)})` : ""}`;

    if (secondRegionName) {
      text += `\n📍 ${escapeTelegramHtml(secondRegionName)}${secondLandmark ? ` (${escapeTelegramHtml(secondLandmark)})` : smartHint2 ? ` (استدلال: ${escapeTelegramHtml(smartHint2)})` : ""}`;
    }

    text += `\n📦 ${escapeTelegramHtml(orderType)}
💵 ${escapeTelegramHtml(subtotal)}
🚚 ${escapeTelegramHtml(delivery)}
💰 <b>${escapeTelegramHtml(total)}</b>
⏰ ${escapeTelegramHtml(noteTime)}
🔢 #${escapeTelegramHtml(String(finalOrderNumber))}
📞 ${escapeTelegramHtml(phone)}`;

    if (altPhone && altPhone !== "—") {
      text += `\n📞 ${escapeTelegramHtml(altPhone)}`;
    }

    // إضافة اللوكيشنات قبل الملاحظات
    if (shopLoc || loc1 || loc2) {
      text += `\n`;
      if (shopLoc) text += `\n📍 <a href="${escapeTelegramHtml(shopLoc)}">لوكيشن المحل</a>`;

      if (order?.routeMode === "double") {
        if (loc1) text += `\n📍 <a href="${escapeTelegramHtml(loc1)}">لوكيشن المرسل</a>`;
        if (loc2) text += `\n📍 <a href="${escapeTelegramHtml(loc2)}">لوكيشن المستلم</a>`;
      } else {
        if (loc1) text += `\n📍 <a href="${escapeTelegramHtml(loc1)}">لوكيشن الزبون</a>`;
      }
    }

    if (summary) {
      text += `\n\n📝 <b>الملاحظات:</b>\n${escapeTelegramHtml(summary)}`;
    }

    text += `\n\nيمكنك الضغط على الأزرار أدناه للتحكم بالطلب.`;

    const buttons = [];

    // صف أزرار اللوكيشنات
    const locationButtons = [];
    if (shopLoc) locationButtons.push({ text: "🏬 لوكيشن المحل", url: shopLoc });
    if (order?.routeMode === "double") {
      if (loc1) locationButtons.push({ text: "📍 لوكيشن المرسل", url: loc1 });
      if (loc2) locationButtons.push({ text: "📍 لوكيشن المستلم", url: loc2 });
    } else {
      if (loc1) locationButtons.push({ text: "📍 لوكيشن الزبون", url: loc1 });
    }
    if (locationButtons.length > 0) {
      buttons.push(locationButtons);
    }

    const baseUrl = getPublicAppUrl();
    const getFullUrl = (src: string | null | undefined) => {
      if (!src) return undefined;
      const resolved = resolvePublicAssetSrc(src);
      if (!resolved) return undefined;
      if (resolved.startsWith("http")) return resolved;
      return `${baseUrl}${resolved.startsWith("/") ? "" : "/"}${resolved}`;
    };

    // صف أزرار صور الأبواب
    const photoButtons = [];
    const door1 = getFullUrl(order?.customerDoorPhotoUrl);
    if (door1) {
      photoButtons.push({ text: "🖼️ باب العميل", url: door1 });
    }
    const door2 = getFullUrl(order?.secondCustomerDoorPhotoUrl);
    if (door2) {
      photoButtons.push({ text: "🖼️ باب الزبون", url: door2 });
    }
    if (photoButtons.length > 0) {
      buttons.push(photoButtons);
    }

    // الأزرار الأساسية
    buttons.push([
      { text: "📦 فتح الطلب", callback_data: `co_order_${finalOrderNumber}` },
      { text: "📦 طلبياتي", callback_data: "co_orders_0" },
    ]);
    buttons.push([{ text: "💼 محفظتي", callback_data: "co_wallet_0" }]);

    const kb = { inline_keyboard: buttons };

    const sent = await sendTelegramMessageWithKeyboardToChat(chatId, text, kb, courierBotToken).catch((err) => {
      console.error(`[pushNotifyCourierNewAssignment] sendTelegramMessageWithKeyboardToChat failed:`, err);
      return { ok: false, error: err?.message ?? "send failed" };
    });
    console.log(`[pushNotifyCourierNewAssignment] first message sent: ${sent.ok}`);
  } else if (courier?.telegramUserId?.trim()) {
    console.warn(`[pushNotifyCourierNewAssignment] courier bot token missing; cannot send Telegram notify to ${courier.telegramUserId}`);
  } else {
    console.warn(`[pushNotifyCourierNewAssignment] courier record missing telegramUserId for courierId=${courierId}`);
  }

  const settingsRow = await getOrCreateNotificationSettings();
  const settings = audienceSettings(settingsRow, "mandoub");
  if (!settings.enabled) return;

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

export async function pushNotifyCourierAssignmentRemoved(
  courierId: string,
  orderNumber: number,
  orderId?: string,
): Promise<void> {
  const courier = await prisma.courier.findUnique({
    where: { id: courierId },
    select: { telegramUserId: true },
  });
  const courierBotToken = await getBotTokenByPurpose("courier");
  console.log(`[pushNotifyCourierAssignmentRemoved] courierId=${courierId} telegramUserId=${courier?.telegramUserId ?? "missing"} botToken=${courierBotToken ? "found" : "missing"}`);
  if (!courier?.telegramUserId?.trim() || !courierBotToken) return;

  const chatId = courier.telegramUserId.trim();
  const text = `<b>عذراً، الطلب #${escapeTelegramHtml(String(orderNumber))} ليس لك وتم تغيير المندوب.</b>`;
  const kb = {
    inline_keyboard: [[{ text: "🏠 الرئيسية", callback_data: "co_main" }]],
  };
  await sendTelegramMessageWithKeyboardToChat(chatId, text, kb, courierBotToken).catch(() => {});
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

  // إذا لم يكن هناك طلب أو مسودة، فهو إشعار يدوي (Manual Notice) من الإدارة
  if (!input.orderId && !input.draftId) {
    const subs = await prisma.webPushSubscription.findMany({
      where: { audience: "preparer", preparerId: input.preparerId },
      select: { id: true, endpoint: true, p256dh: true, auth: true },
    });
    await sendToSubscriptions(subs, {
      title: input.title,
      body: input.body || "",
      url: `${getPublicAppUrl()}/preparer/preparation`,
      tag: `preparer-manual-${Date.now()}`,
      sound: settings.soundPreset,
    }, [input.preparerId]);
    return;
  }

  // محاولة جلب بيانات الطلب أو المسودة لتعبئة القالب
  const orderNumMatch = (input.title + (input.body || "")).match(/#(\d+)/);
  const detectedOrderNumber = orderNumMatch ? parseInt(orderNumMatch[1]) : 0;

  const [order, draft] = await Promise.all([
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
    input.draftId ? prisma.companyPreparerShoppingDraft.findUnique({
      where: { id: input.draftId },
      select: { customerRegion: { select: { name: true } } }
    }) : null
  ]);

  const vars = {
    count: 1,
    orderNumber: order?.orderNumber || detectedOrderNumber || 0,
    shopName: order?.shop?.name || "—",
    regionName: order?.customerRegion?.name || draft?.customerRegion?.name || "—",
  };

  let finalTitle = renderNotificationTemplate(settings.titleSingle, vars);
  let finalBody = "";

  if (order?.submissionSource === "web_store" && settings.templateWebsite) {
    finalBody = renderNotificationTemplate(settings.templateWebsite, vars);
  } else if (input.draftId && settings.templateMultiple) {
    // تم استخدام templateMultiple هنا بناءً على تصميم واجهة الإعدادات للمجهز
    finalBody = renderNotificationTemplate(settings.templateMultiple, vars);
  } else {
    finalBody = renderNotificationTemplate(settings.templateSingle, vars);
  }

  // إذا فشل القالب في إنتاج نص (غير محتمل)، نستخدم النص القادم من الإدارة كاحتياط
  const displayTitle = finalTitle || input.title;
  const displayBody = finalBody || input.body || "";

  const subs = await prisma.webPushSubscription.findMany({
    where: { audience: "preparer", preparerId: input.preparerId },
    select: { id: true, endpoint: true, p256dh: true, auth: true },
  });

  await sendToSubscriptions(subs, {
    title: displayTitle,
    body: displayBody,
    url: `${getPublicAppUrl()}/preparer/preparation`,
    tag: `kse-push-preparer-${input.preparerId}-${vars.orderNumber || Date.now()}`,
    sound: settings.soundPreset,
  }, [input.preparerId]);
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
    url: `${getPublicAppUrl()}/${opts.targetRole === "admin" ? SECRET_ADMIN_PATH.slice(1) : opts.targetRole}`,
    tag: `portal-chat-${opts.threadId}`,
  }, externalIds.length > 0 ? externalIds : undefined);
}
