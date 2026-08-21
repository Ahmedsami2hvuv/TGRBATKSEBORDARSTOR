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
  customData?: any,
): Promise<void> {
  // 1. الإرسال عبر وان سيجنال (النظام الجديد) - ننتظره لضمان عدم تجميد العملية في خوادم Vercel
  if (externalIds && externalIds.length > 0) {
    console.log("OneSignal: Initiating send to", externalIds);
    try {
      await sendOneSignalNotification({
        title: payload.title,
        body: payload.body,
        url: payload.url,
        externalIds: externalIds,
        sound: payload.sound,
        data: customData,
      });
    } catch (err) {
      console.error("OneSignal Send Error:", err);
    }
  }

  // 2. الطريقة القديمة (Web Push) - سنبقيها فقط كاحتياط للأدمن حالياً
  if (!configureVapid()) return;
  const json = JSON.stringify(payload);

  // إرسال كافة إشعارات VAPID بالتوازي لتقليل وقت الانتظار من دقائق إلى ثوانٍ معدودة
  const pushPromises = subs.map(async (s) => {
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
  });

  // ننتظر انتهاء محاولات الإرسال بالتوازي مع وقت أقصى (اختياري)
  // هنا سنكتفي بإطلاقها في الخلفية أيضاً للأمان وسرعة الاستجابة
  void Promise.all(pushPromises).catch(err => console.error("VAPID Parallel Send Error:", err));
}

/** إشعار للإدارة: طلب جديد قيد الانتظار */
export async function pushNotifyAdminsNewPendingOrder(orderNumber: number): Promise<void> {
  console.log("[PushNotify] pushNotifyAdminsNewPendingOrder started for orderNumber:", orderNumber);
  try {
    const settingsRow = await getOrCreateNotificationSettings();
    const settings = audienceSettings(settingsRow, "admin");
    if (!settings.enabled) {
      console.log("[PushNotify] Admin notifications are disabled in database settings.");
      return;
    }
    const order = await prisma.order.findUnique({
      where: { orderNumber },
      select: {
        shop: { select: { name: true } },
        customerRegion: { select: { name: true } },
        totalAmount: true,
        orderSubtotal: true,
        orderNoteTime: true,
        orderType: true,
      },
    });

    if (!order) {
      console.log("[PushNotify] Warning: Order not found in database for orderNumber:", orderNumber);
    }

    const orderPrice = order?.orderSubtotal ? formatDinarAsAlf(order.orderSubtotal) : "—";
    const orderTime = order?.orderNoteTime || "فوري";

    const pendingCount = await prisma.order.count({
      where: {
        status: "pending"
      }
    });

    const title = renderNotificationTemplate(settings.titleSingle, {
      count: 1,
      orderNumber,
      shopName: order?.shop?.name ?? "—",
      regionName: order?.customerRegion?.name ?? "—",
      orderPrice,
      orderTime,
    });

    const body = renderNotificationTemplate(settings.templateSingle, {
      count: 1,
      orderNumber,
      shopName: order?.shop?.name ?? "—",
      regionName: order?.customerRegion?.name ?? "—",
      orderPrice,
      orderTime,
    });

    // معرف الأدمن العام لتلقي الإشعارات الفورية
    const adminExternalIds = ["admin_global"];

    const subs = await prisma.webPushSubscription.findMany({
      where: { audience: "admin" },
      select: { id: true, endpoint: true, p256dh: true, auth: true },
    });

    const customData = {
      type: "new_order",
      orderNumber,
      shopName: order?.shop?.name ?? "—",
      regionName: order?.customerRegion?.name ?? "—",
      orderTime,
      subtotal: order?.orderSubtotal ? Number(order.orderSubtotal) : 0, // Convert Decimal object to plain number!
      orderType: order?.orderType ?? "توصيل",
      pendingCount: pendingCount,
    };

    console.log("[PushNotify] Sending push to admin subscriptions and OneSignal with externalIds:", adminExternalIds);
    await sendToSubscriptions(subs, {
      title,
      body,
      url: `${getPublicAppUrl()}${SECRET_ADMIN_PATH}/orders/pending`,
      tag: `kse-push-admin-${orderNumber}`,
      sound: settings.soundPreset,
    }, adminExternalIds, customData);
    console.log("[PushNotify] pushNotifyAdminsNewPendingOrder completed successfully.");
  } catch (error) {
    console.error("[PushNotify] Error in pushNotifyAdminsNewPendingOrder:", error);
  }
}

/** إشعار عائم للإدارة عند وصول طلب جديد من المتجر الإلكتروني */
export async function pushNotifyAdminsNewStoreOrder(draftId: string): Promise<void> {
  console.log("[PushNotify] pushNotifyAdminsNewStoreOrder started for draftId:", draftId);
  try {
    const draft = await prisma.companyPreparerShoppingDraft.findUnique({
      where: { id: draftId },
      include: { customerRegion: { select: { name: true } } }
    });
    if (!draft) return;

    const orderTime = draft.orderTime || "فوري";
    const regionName = draft.customerRegion?.name || "منطقة عامة";
    const shopName = "المتجر الإلكتروني (خصيب ستور)";
    const orderNumber = draft.draftNumber;
    const products = (draft.data as any)?.products || [];
    const pendingCount = products.length;
    const subtotal = Number((draft.data as any)?.orderSubtotalAlf || 0);

    const title = `🚨 طلب جديد من المتجر الإلكتروني: #${orderNumber}`;
    const body = `المتجر الإلكتروني | وقت الطلب: ${orderTime} | المنطقة: ${regionName} | المواد: ${pendingCount}`;

    const adminExternalIds = ["admin_global", "admin"];
    const customData = {
      type: "store_order",
      isStoreOrder: true,
      isHasimAlert: true,
      orderNumber: orderNumber,
      shopName: shopName,
      regionName: regionName,
      orderTime: orderTime,
      orderType: "متجر حازم 🛒",
      subtotal: subtotal,
      pendingCount: pendingCount
    };

    const subs = await prisma.webPushSubscription.findMany({
      where: { audience: "admin" },
      select: { id: true, endpoint: true, p256dh: true, auth: true },
    });

    await sendToSubscriptions(subs, {
      title,
      body,
      url: `${getPublicAppUrl()}${SECRET_ADMIN_PATH}/orders/pending?tab=preparing`,
      tag: `kse-push-admin-store-${orderNumber}`,
      sound: "hasim_alert",
    }, adminExternalIds, customData);

    console.log("[PushNotify] pushNotifyAdminsNewStoreOrder completed successfully.");
  } catch (error) {
    console.error("[PushNotify] Error in pushNotifyAdminsNewStoreOrder:", error);
  }
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

  // معرف الأدمن العام لتلقي الإشعارات الفورية
  const adminExternalIds = ["admin_global"];

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
      submissionSource: true,
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

  // 1. إرسال Telegram (تم استعادته) - نطلقه كـ Promise بالتوازي لكي لا يعيق إشعار ون سيجنال الفوري
  const telegramPromise = (async () => {
    if (courier?.telegramUserId?.trim() && courierBotToken) {
      const chatId = courier.telegramUserId.trim();

      let shopName = order?.shop?.name || "—";
      if (order?.routeMode === "double" && order?.submissionSource === "staff_portal") {
        shopName = "طلب وجهتين";
      }
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

      let text = "";
      if (order?.routeMode === "double") {
        text = `🔄 <b>(طلب ذو وجهتين)</b>
🔔 تم إسناد طلب جديد إليك
📍 ${escapeTelegramHtml(regionName)}${landmark ? ` (${escapeTelegramHtml(landmark)})` : smartHint1 ? ` (استدلال: ${escapeTelegramHtml(smartHint1)})` : ""}`;
      } else {
        text = `🏪 <b>(${escapeTelegramHtml(shopName)} — ${escapeTelegramHtml(regionName)})</b>
🔔 تم إسناد طلب جديد إليك
📍 ${escapeTelegramHtml(regionName)}${landmark ? ` (${escapeTelegramHtml(landmark)})` : smartHint1 ? ` (استدلال: ${escapeTelegramHtml(smartHint1)})` : ""}`;
      }

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
  })();

  const settingsRow = await getOrCreateNotificationSettings();
  const settings = audienceSettings(settingsRow, "mandoub");
  if (!settings.enabled) {
    await telegramPromise.catch(() => {});
    return;
  }

  const orderPrice = order?.totalAmount ? formatDinarAsAlf(order.totalAmount) : "—";
  const orderTime = order?.orderNoteTime || "فوري";

  const title = renderNotificationTemplate(settings.titleSingle, {
    count: 1,
    orderNumber: finalOrderNumber,
    shopName: order?.shop?.name ?? "—",
    regionName: order?.customerRegion?.name ?? "—",
    orderPrice,
    orderTime,
  });

  const body = renderNotificationTemplate(settings.templateSingle, {
    count: 1,
    orderNumber: finalOrderNumber,
    shopName: order?.shop?.name ?? "—",
    regionName: order?.customerRegion?.name ?? "—",
    orderPrice,
    orderTime,
  });

  const subs = await prisma.webPushSubscription.findMany({
    where: { audience: "mandoub", courierId },
    select: { id: true, endpoint: true, p256dh: true, auth: true },
  });

  const path = orderId ? `/mandoub/order/${orderId}` : "/mandoub";
  const url = buildDelegatePortalUrl(courierId, getPublicAppUrl(), path);

  const customData = {
    type: "new_order",
    orderNumber: finalOrderNumber,
    shopName: order?.shop?.name ?? "—",
    regionName: order?.customerRegion?.name ?? "—",
    orderTime,
    subtotal: order?.orderSubtotal ? Number(order.orderSubtotal) : 0,
    orderType: order?.orderType ?? "توصيل",
    pendingCount: 1, // المندوب يرى طلبه فقط
  };

  // 2. إرسال OneSignal (باستخدام معرف المندوب)
  await sendToSubscriptions(subs, {
    title,
    body,
    url,
    tag: `kse-push-mandoub-${orderNumber}-${courierId}`,
    sound: settings.soundPreset,
  }, [courierId], customData);
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
        submissionSource: true,
        totalAmount: true,
        orderNoteTime: true,
      }
    }),
    input.draftId ? prisma.companyPreparerShoppingDraft.findUnique({
      where: { id: input.draftId },
      select: { customerRegion: { select: { name: true } } }
    }) : null
  ]);

  const orderPrice = order?.totalAmount ? formatDinarAsAlf(order.totalAmount) : "—";
  const orderTime = order?.orderNoteTime || "فوري";

  const vars = {
    count: 1,
    orderNumber: order?.orderNumber || detectedOrderNumber || 0,
    shopName: order?.shop?.name || "—",
    regionName: order?.customerRegion?.name || draft?.customerRegion?.name || "—",
    orderPrice,
    orderTime,
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
