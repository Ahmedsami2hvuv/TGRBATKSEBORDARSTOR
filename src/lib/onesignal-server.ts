/**
 * مدير إرسال إشعارات OneSignal من السيرفر باستخدام fetch المباشر.
 */

function cleanAppId(value: string | undefined, defaultValue: string): string {
  if (!value) return defaultValue;
  const cleaned = value.replace(/['"\r\n\s]/g, "").trim();
  // التحقق من UUID صالح (36 حرفاً من أرقام وحروف وشرطات)
  const uuidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
  if (!uuidRegex.test(cleaned)) {
    console.warn(`[OneSignal] Provided App ID "${cleaned}" is not a valid UUID. Using default: "${defaultValue}"`);
    return defaultValue;
  }
  return cleaned;
}

function cleanApiKey(value: string | undefined, defaultValue: string): string {
  if (!value) return defaultValue;
  const cleaned = value.replace(/['"\r\n\s]/g, "").trim();
  // مفتاح ون سجنل يبدأ دائماً بـ os_v2_app_
  if (!cleaned.startsWith("os_v2_app_") || cleaned.length < 50) {
    console.warn(`[OneSignal] Provided API Key is not valid. Using default.`);
    return defaultValue;
  }
  return cleaned;
}

const ONESIGNAL_APP_ID = cleanAppId(process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID, "5c2acf6f-f2c0-40f2-830d-138f8a9e8c0a");
const ONESIGNAL_REST_API_KEY = cleanApiKey(process.env.ONESIGNAL_REST_API_KEY, "os_v2_app_mkgte2e73jaf3dihclicnailqqjep2tkhmqenbvhxwic6b4giwfe3nbgxf27rt36y6i2ggjenzvgkfkueiwp5if4yhxcbisqnzryofy");

const ONESIGNAL_MANDOB_APP_ID = cleanAppId(process.env.ONESIGNAL_MANDOB_APP_ID, "628d3268-9fda-405d-8d07-12d026810b84");
const ONESIGNAL_MANDOB_REST_API_KEY = cleanApiKey(process.env.ONESIGNAL_MANDOB_REST_API_KEY, "os_v2_app_mkgte2e73jaf3dihclicnailqqjep2tkhmqenbvhxwic6b4giwfe3nbgxf27rt36y6i2ggjenzvgkfkueiwp5if4yhxcbisqnzryofy");

const ONESIGNAL_PREPARER_APP_ID = cleanAppId(process.env.NEXT_PUBLIC_ONESIGNAL_PREPARER_APP_ID || process.env.ONESIGNAL_PREPARER_APP_ID, "55661893-9b93-4b63-b0e9-03b250fc3667");
const ONESIGNAL_PREPARER_REST_API_KEY = cleanApiKey(process.env.ONESIGNAL_PREPARER_REST_API_KEY, "os_v2_app_kvtbre43snfwhmhjaozfb7bwm73kfy57wwtusb5y46f3kh5vdfqyud4z4gkrgvchs5rvupjsuma5ndrs7dzksohznw477atu2pco6sq");

const ONESIGNAL_EMPLOYEE_APP_ID = cleanAppId(process.env.ONESIGNAL_EMPLOYEE_APP_ID, "5487c703-2ecb-487c-8a99-1af4eb7f945b");
const ONESIGNAL_EMPLOYEE_REST_API_KEY = cleanApiKey(process.env.ONESIGNAL_EMPLOYEE_REST_API_KEY, "os_v2_app_ksd4oazoznehzcuzdl2ow74ulo47l5ivtozek3fckxhta6tii3kb3rr2risxyicphxsizhnh2f6a77pley4pq7tivmuwavfz5okpcaa");

export async function sendOneSignalNotification(options: {
  title: string;
  body: string;
  url: string;
  externalIds: string[];
  sound?: string;
  data?: any;
  targetApp?: "admin" | "mandob" | "preparer" | "employee";
  isSilent?: boolean;
  sendAfter?: string; // الجدولة المباشرة في ون سجنل
}): Promise<{ success: boolean; id?: string; error?: string }> {
  const isAdmin = options.externalIds.includes("admin_global") || options.targetApp === "admin";
  const isPreparer = options.targetApp === "preparer";
  const isEmployee = options.targetApp === "employee";
  
  let targetAppId = ONESIGNAL_MANDOB_APP_ID;
  let targetApiKey = ONESIGNAL_MANDOB_REST_API_KEY;

  if (isAdmin) {
    targetAppId = ONESIGNAL_APP_ID;
    targetApiKey = ONESIGNAL_REST_API_KEY;
  } else if (isPreparer) {
    targetAppId = ONESIGNAL_PREPARER_APP_ID;
    targetApiKey = ONESIGNAL_PREPARER_REST_API_KEY;
  } else if (isEmployee) {
    targetAppId = ONESIGNAL_EMPLOYEE_APP_ID;
    targetApiKey = ONESIGNAL_EMPLOYEE_REST_API_KEY;
  }

  if (!targetApiKey) {
    const errorMsg = `REST API Key is not configured for ${isAdmin ? 'Admin' : isPreparer ? 'Preparer' : isEmployee ? 'Employee' : 'Mandob'}`;
    console.warn(`[OneSignal] ${errorMsg}.`);
    return { success: false, error: errorMsg };
  }

  const notification: any = {
    app_id: targetAppId,
    target_channel: "push",
    url: options.url,
    data: options.data,
    android_visibility: 1,
    priority: 10,
    huawei_priority: 10,
    web_push_priority: "high",
  };

  // تطبيق الجدولة المباشرة إذا كانت محددة
  if (options.sendAfter) {
    notification.send_after = options.sendAfter;
  }

  if (options.isSilent) {
    notification.content_available = true;
  } else {
    notification.contents = {
      ar: options.body,
      en: options.body,
    };
    notification.headings = {
      ar: options.title,
      en: options.title,
    };
    if (options.sound) {
      notification.android_sound = options.sound;
      notification.ios_sound = `${options.sound}.wav`;
    }
    notification.android_accent_color = "4f46e5";
    notification.small_icon = "ic_stat_onesignal_default";

    if (options.data?.isHasimAlert) {
      notification.android_channel_id = "hasim_floating_alert_channel";
      notification.android_group = "hasim_alerts";
      notification.android_accent_color = "10b981";
      if (!options.sound) {
         notification.android_sound = "hasim_alert";
      }
      notification.android_background_layout = {
        headings_color: "FF10B981",
        contents_color: "FF334155"
      };
    }

  }

  if (isAdmin) {
    notification.filters = [
      { field: "tag", key: "role", relation: "=", value: "admin" }
    ];
  } else {
    notification.include_aliases = {
      external_id: options.externalIds,
    };
    notification.include_external_user_ids = options.externalIds;
  }

  try {
    const targetAppName = isAdmin ? 'Admin' : isPreparer ? 'Preparer' : isEmployee ? 'Employee' : 'Mandob';
    console.log(`[OneSignal] Sending notification to OneSignal API (${targetAppName})...`);
    const response = await fetch("https://onesignal.com/api/v1/notifications", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Key ${targetApiKey.trim()}`,
      },
      body: JSON.stringify(notification),
      signal: AbortSignal.timeout(6000),
    });

    const isOk = response.ok;
    const responseData = isOk ? await response.json() : await response.text();
    
    if (isOk) {
      console.log(`[OneSignal] Notification successfully sent to ${targetAppName}:`, responseData);
      if (responseData && responseData.errors && responseData.errors.length > 0) {
        return { 
          success: false, 
          error: `OneSignal Warning: ${responseData.errors.join(", ")}` 
        };
      }
      return { success: true, id: responseData.id };
    } else {
      console.error(`[OneSignal] API responded with error for ${targetAppName}:`, response.status, responseData);
      return { 
        success: false, 
        error: `OneSignal Error (Status ${response.status}): ${typeof responseData === "string" ? responseData : JSON.stringify(responseData)}` 
      };
    }
  } catch (e: any) {
    console.error("[OneSignal] Fetch exception occurred:", e);
    return { success: false, error: e.message || "Unknown network error" };
  }
}

export async function cancelOneSignalNotification(options: {
  notificationId: string;
  targetApp?: "admin" | "mandob" | "preparer" | "employee";
}): Promise<{ success: boolean; error?: string }> {
  const isPreparer = options.targetApp === "preparer";
  const isEmployee = options.targetApp === "employee";
  const isAdmin = options.targetApp === "admin" || options.targetApp === undefined;

  let targetAppId = ONESIGNAL_MANDOB_APP_ID;
  let targetApiKey = ONESIGNAL_MANDOB_REST_API_KEY;

  if (isAdmin) {
    targetAppId = ONESIGNAL_APP_ID;
    targetApiKey = ONESIGNAL_REST_API_KEY;
  } else if (isPreparer) {
    targetAppId = ONESIGNAL_PREPARER_APP_ID;
    targetApiKey = ONESIGNAL_PREPARER_REST_API_KEY;
  } else if (isEmployee) {
    targetAppId = ONESIGNAL_EMPLOYEE_APP_ID;
    targetApiKey = ONESIGNAL_EMPLOYEE_REST_API_KEY;
  }

  try {
    console.log(`[OneSignal] Canceling notification ${options.notificationId} on App: ${options.targetApp || "mandob"}...`);
    const response = await fetch(`https://onesignal.com/api/v1/notifications/${options.notificationId}?app_id=${targetAppId}`, {
      method: "DELETE",
      headers: {
        "Authorization": `Key ${targetApiKey.trim()}`,
      },
    });

    const isOk = response.ok;
    const responseData = isOk ? await response.json() : await response.text();

    if (isOk) {
      console.log(`[OneSignal] Notification canceled successfully:`, responseData);
      return { success: true };
    } else {
      console.error(`[OneSignal] API responded with error on cancel:`, response.status, responseData);
      return { success: false, error: `OneSignal Error ${response.status}: ${responseData}` };
    }
  } catch (e: any) {
    console.error("[OneSignal] Exception on cancel:", e);
    return { success: false, error: e.message || "Unknown error" };
  }
}

export async function notifyOneSignalPreparerAssignment(input: {
  preparerId: string;
  orderId: string;
  isDraft: boolean;
}) {
  const { prisma } = await import("@/lib/prisma");
  const { getPublicAppUrl } = await import("@/lib/app-url");
  const { buildCompanyPreparerPortalUrl } = await import("@/lib/company-preparer-portal-link");

  const preparer = await prisma.companyPreparer.findUnique({ where: { id: input.preparerId } });
  if (!preparer) return;

  let titleLine = "";
  let productsData: any[] = [];
  let draftIdForUrl = "";
  let shopName = "مجهز";
  let regionName = "—";
  let orderTime = "فوري";
  let orderType = "تجهيز";
  let subtotal = 0;
  let orderNumber = 0;

  if (input.isDraft) {
    const draft = await prisma.companyPreparerShoppingDraft.findUnique({
      where: { id: input.orderId },
      include: {
        customerRegion: { select: { name: true } }
      }
    });
    if (!draft) return;
    titleLine = draft.titleLine;
    productsData = (draft.data as any)?.products || [];
    draftIdForUrl = draft.id;
    shopName = draft.titleLine.split(" - ")[0] || "مسودة طلب";
    orderNumber = parseInt(draft.id.replace(/[^0-9]/g, "").slice(0, 6)) || 0;
    regionName = draft.customerRegion?.name || "—";
    orderTime = draft.orderTime || "فوري";
    orderType = (draft.data as any)?.orderType || "تجهيز";
    subtotal = Number((draft.data as any)?.orderSubtotalAlf || 0);
  } else {
    const order = await prisma.order.findUnique({
      where: { id: input.orderId },
      include: {
        shop: { select: { name: true } },
        customerRegion: { select: { name: true } }
      }
    });
    if (!order) return;
    titleLine = `طلب #${order.orderNumber} - ${order.orderType}`;
    productsData = (order.preparerShoppingJson as any)?.products || [];
    draftIdForUrl = order.id;
    shopName = order.shop?.name || "المحل";
    regionName = order.customerRegion?.name || "—";
    orderTime = order.orderNoteTime || "فوري";
    orderType = order.orderType || "توصيل";
    subtotal = Number(order.orderSubtotal || 0);
    orderNumber = order.orderNumber;
  }

  // بناء محتوى الإشعار وإخفاء رقم الزبون
  let bodyLines: string[] = [];
  productsData.forEach((p: any) => {
    let line = `• ${p.line || "منتج"} (${p.qty || 1})`;
    // تحديد المنتجات المسندة لمجهز آخر
    if (p.assignedPreparerId && p.assignedPreparerId !== input.preparerId && p.assignedPreparerName) {
      line += ` [مسند لمجهز آخر: ${p.assignedPreparerName}]`;
    }
    bodyLines.push(line);
  });

  const bodyText = bodyLines.length > 0 ? bodyLines.join("\n") : titleLine;

  const baseUrl = getPublicAppUrl();
  const preparerUrl = buildCompanyPreparerPortalUrl(preparer.id, preparer.portalToken, baseUrl);
  const finalUrl = input.isDraft ? `${preparerUrl.replace("/preparer", `/preparer/preparation/draft/${draftIdForUrl}`)}` : `${preparerUrl.replace("/preparer", `/preparer/order/${draftIdForUrl}`)}`;

  await sendOneSignalNotification({
    title: `طلب تجهيز: ${titleLine}`,
    body: bodyText,
    url: finalUrl,
    externalIds: [preparer.id],
    targetApp: "preparer",
    data: {
      type: "new_order",
      orderNumber: orderNumber,
      shopName: shopName,
      regionName: regionName,
      orderTime: orderTime,
      orderType: orderType,
      subtotal: subtotal,
      productsText: bodyText
    }
  });
}

export async function notifyStaffEmployeeOrderStatusChange(orderId: string, newStatus: string) {
  const { prisma } = await import("@/lib/prisma");
  const { getPublicAppUrl } = await import("@/lib/app-url");
  const { buildStaffEmployeePortalUrl } = await import("@/lib/staff-employee-portal-link");

  try {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        customerRegion: { select: { name: true } }
      }
    });

    if (!order) return;

    let staffId: string | null = null;

    // 1. فحص preparerShoppingJson في الطلب
    const json = order.preparerShoppingJson as any;
    if (json && typeof json === "object") {
      staffId = json.staffId || null;
    }

    // 2. إذا لم يكن موجوداً، نبحث في المسودات المرتبطة
    if (!staffId) {
      const draft = await prisma.companyPreparerShoppingDraft.findFirst({
        where: { sentOrderId: orderId },
        select: { data: true }
      });
      if (draft && draft.data && typeof draft.data === "object") {
        staffId = (draft.data as any).fromStaffEmployeeId || null;
      }
    }

    if (!staffId) return; // غير مرتبط بموظف

    const staff = await prisma.staffEmployee.findUnique({
      where: { id: staffId },
      select: { id: true, portalToken: true, active: true }
    });

    if (!staff || !staff.active) return;

    // تحديد محتوى الإشعار بناء على الحالة الجديدة
    let title = "";
    let body = "";

    if (newStatus === "delivering") {
      title = `تم استلام الطلب #${order.orderNumber}`;
      body = `المندوب استلم الطلب وهو الآن في الطريق إلى الزبون (${order.customerRegion?.name || ""})`;
    } else if (newStatus === "delivered") {
      title = `تم تسليم الطلب #${order.orderNumber} 🎉`;
      body = `تم تسليم الطلب بنجاح إلى الزبون. تم تسجيل أرباحك في رصيدك.`;
    } else if (newStatus === "canceled") {
      title = `تم إلغاء الطلب #${order.orderNumber} ❌`;
      body = `نأسف، تم إلغاء الطلب من قبل الإدارة أو المندوب.`;
    } else {
      return; // لا نرسل للحالات الأخرى
    }

    const baseUrl = getPublicAppUrl();
    const portalUrl = buildStaffEmployeePortalUrl(staff.id, staff.portalToken, baseUrl);
    const finalUrl = `${portalUrl.replace("/staff/portal", "/staff/portal/submitted")}`;

    await sendOneSignalNotification({
      title,
      body,
      url: finalUrl,
      externalIds: [staff.id],
      targetApp: "employee",
      data: {
        type: "staff_order_status",
        orderNumber: order.orderNumber,
        status: newStatus,
        title: title,
        body: body
      }
    });
    console.log(`[OneSignal] Sent status change notification to staff ${staff.id} for order #${order.orderNumber}`);
  } catch (err) {
    console.error("Failed to send status change notification to staff:", err);
  }
}

export async function notifyOneSignalPreparersForShopOrder(shopId: string, orderId: string) {
  const { prisma } = await import("@/lib/prisma");
  try {
    const preparerLinks = await prisma.preparerShop.findMany({
      where: { shopId },
      select: { preparerId: true }
    });

    if (preparerLinks.length === 0) return;

    console.log(`[OneSignal] Found ${preparerLinks.length} preparer(s) for shop ${shopId}. Sending notifications...`);
    for (const link of preparerLinks) {
      void notifyOneSignalPreparerAssignment({
        preparerId: link.preparerId,
        orderId,
        isDraft: false
      }).catch((e) => console.error("Error sending order notification to preparer:", e));
    }
  } catch (err) {
    console.error("Failed to notify preparers for shop order:", err);
  }
}


export async function notifyOneSignalAdminStoreOrder(draftId: string) {
  const { prisma } = await import("@/lib/prisma");
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

  const title = `🚨 طلب جديد حازم من المتجر الإلكتروني: #${orderNumber}`;
  const body = `المتجر الإلكتروني | وقت الطلب: ${orderTime} | المنطقة: ${regionName} | عدد المواد: ${pendingCount}`;

  // إرسال الإشعار الحازم الفوري لتطبيق الأدمن OneSignal
  await sendOneSignalNotification({
    title,
    body,
    url: "/abo1stor3hlaa2kbr8-47/orders/pending?tab=preparing",
    externalIds: ["admin_global", "admin"],
    targetApp: "admin",
    sound: "hasim_alert",
    data: {
      type: "store_order",
      isStoreOrder: true,
      isHasimAlert: true,
      orderNumber: orderNumber,
      shopName: shopName,
      regionName: regionName,
      orderTime: orderTime,
      orderType: "طلب متجر حازم",
      subtotal: subtotal,
      pendingCount: pendingCount
    }
  });

  console.log(`[OneSignal] Sent HASIM store order notification for draft #${orderNumber}`);
}

