/**
 * مدير إرسال إشعارات OneSignal من السيرفر باستخدام fetch المباشر.
 */

const ONESIGNAL_APP_ID = process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID || "5c2acf6f-f2c0-40f2-830d-138f8a9e8c0a";
const ONESIGNAL_REST_API_KEY = process.env.ONESIGNAL_REST_API_KEY;

const ONESIGNAL_MANDOB_APP_ID = process.env.ONESIGNAL_MANDOB_APP_ID || "628d3268-9fda-405d-8d07-12d026810b84";
const ONESIGNAL_MANDOB_REST_API_KEY = process.env.ONESIGNAL_MANDOB_REST_API_KEY;

const ONESIGNAL_PREPARER_APP_ID = process.env.NEXT_PUBLIC_ONESIGNAL_PREPARER_APP_ID || process.env.ONESIGNAL_PREPARER_APP_ID || "TODO_ENTER_PREPARER_APP_ID";
const ONESIGNAL_PREPARER_REST_API_KEY = process.env.ONESIGNAL_PREPARER_REST_API_KEY;

const ONESIGNAL_EMPLOYEE_APP_ID = process.env.ONESIGNAL_EMPLOYEE_APP_ID || "5487c703-2ecb-487c-8a99-1af4eb7f945b";
const ONESIGNAL_EMPLOYEE_REST_API_KEY = process.env.ONESIGNAL_EMPLOYEE_REST_API_KEY || "os_v2_app_ksd4oazoznehzcuzdl2ow74ulo47l5ivtozek3fckxhta6tii3kb3rr2risxyicphxsizhnh2f6a77pley4pq7tivmuwavfz5okpcaa";

export async function sendOneSignalNotification(options: {
  title: string;
  body: string;
  url: string;
  externalIds: string[];
  sound?: string;
  data?: any;
  targetApp?: "admin" | "mandob" | "preparer" | "employee";
}): Promise<boolean> {
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
    console.warn(`[OneSignal] REST API Key is not configured for ${isAdmin ? 'Admin' : isPreparer ? 'Preparer' : isEmployee ? 'Employee' : 'Mandob'}.`);
    return false;
  }

  const notification: any = {
    app_id: targetAppId,
    contents: {
      ar: options.body,
      en: options.body,
    },
    headings: {
      ar: options.title,
      en: options.title,
    },
    target_channel: "push",
    url: options.url,
    data: options.data,
    android_sound: options.sound,
    ios_sound: options.sound ? `${options.sound}.wav` : undefined,
    android_visibility: 1,
    priority: 10,
    huawei_priority: 10,
    web_push_priority: "high",
    android_accent_color: "4f46e5",
    small_icon: "ic_stat_onesignal_default",
  };

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
    console.log(`[OneSignal] Sending notification to OneSignal API (${isAdmin ? 'Admin' : 'Mandob'})...`);
    const response = await fetch("https://onesignal.com/api/v1/notifications", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Key ${targetApiKey.trim()}`,
      },
      body: JSON.stringify(notification),
    });

    const data = await response.ok ? await response.json() : await response.text();
    if (response.ok) {
      console.log(`[OneSignal] Notification successfully sent to ${isAdmin ? 'Admin' : 'Mandob'}:`, data);
      return true;
    } else {
      console.error("[OneSignal] API responded with error:", response.status, data);
      return false;
    }
  } catch (e) {
    console.error("[OneSignal] Fetch exception occurred:", e);
    return false;
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

