import { prisma } from "./prisma";
import { getAllActiveGeminiKeys, markGeminiKeyError, markGeminiKeySuccess } from "./gemini-pool";
import { formatDinarAsAlf } from "./money-alf";
import { rankRegionsByQuery } from "./arabic-region-search";
import { Decimal } from "@prisma/client/runtime/library";
import { pushNotifyAdminsNewPendingOrder } from "./web-push-server";
import { notifyTelegramNewOrder } from "./telegram-notify";
import { sendTelegramMessageWithKeyboardToChat } from "./telegram";

/**
 * استخراج سعر التوصيل الثابت المعتمد في الداتابيز حصراً للمنطقة
 */
function getRegionStrictDeliveryPrice(region?: any): number {
  if (!region || region.deliveryPrice == null) return 5000;
  if (typeof region.deliveryPrice?.toNumber === "function") {
    return region.deliveryPrice.toNumber();
  }
  if (typeof region.deliveryPrice === "number") {
    return region.deliveryPrice;
  }
  return Number(region.deliveryPrice) || 5000;
}

/**
 * أدوات النظام لتنفيذ العمليات الذكية والإدارية الشاملة
 */
const AI_TOOLS = [
  {
    functionDeclarations: [
      {
        name: "create_order",
        description: "إضافة ورصد طلب مبيعات جديد في النظام عند وجود تفاصيل المحل والمنطقة وسعر الطلب وهاتف الزبون.",
        parameters: {
          type: "OBJECT",
          properties: {
            shopQuery: { type: "STRING", description: "اسم المحل" },
            customerPhone: { type: "STRING", description: "رقم هاتف الزبون" },
            customerName: { type: "STRING", description: "اسم الزبون (إن وجد)" },
            regionQuery: { type: "STRING", description: "اسم المنطقة أو الوجهة" },
            orderType: { type: "STRING", description: "وصف الطلب والمنتجات" },
            price: { type: "NUMBER", description: "سعر الطلب كما يكتبه المدير صراحة بدون أي تعديل أو ضرب" },
            orderNoteTime: { type: "STRING", description: "وقت التسليم" }
          },
          required: ["shopQuery", "regionQuery", "price"]
        }
      },
      {
        name: "create_prep_shopping_draft",
        description: "إنشاء مسودة طلب تجهيز ومشتريات من رسالة التجهيز النصية التي تحتوي على منطقة، رقم هاتف، وقائمة مواد ومشتريات.",
        parameters: {
          type: "OBJECT",
          properties: {
            regionQuery: { type: "STRING", description: "اسم المنطقة" },
            customerPhone: { type: "STRING", description: "رقم هاتف الزبون (إن وجد)" },
            itemsList: { type: "STRING", description: "قائمة المواد والمشتريات المطلوبة بالتفصيل" }
          },
          required: ["regionQuery", "itemsList"]
        }
      },
      {
        name: "register_debt_transaction",
        description: "تسجيل معاملة مالية بدفتر الديون (أخذت / انطيت / دين / تسديد).",
        parameters: {
          type: "OBJECT",
          properties: {
            personQuery: { type: "STRING", description: "اسم الشخص أو الطرف (مثلاً: الوالد، علي، المحل)" },
            amount: { type: "NUMBER", description: "المبلغ كما ينطقه المدير بالضبط بدون إضافة أصفار تلقائية" },
            type: { type: "STRING", description: "'took' (أخذت/استلمت) أو 'gave' (اعطيت/انطيت)" },
            note: { type: "STRING", description: "ملاحظات وتفاصيل المعاملة" }
          },
          required: ["personQuery", "amount", "type"]
        }
      },
      {
        name: "zero_partner_debt",
        description: "تصفير حساب ودين شخص أو طرف محدد بدفتر الديون كلياً.",
        parameters: {
          type: "OBJECT",
          properties: {
            personQuery: { type: "STRING", description: "اسم الشخص المراد تصفير حسابه بدفتر الديون" }
          },
          required: ["personQuery"]
        }
      },
      {
        name: "assign_order_to_courier",
        description: "إسناد طلب محدد لمندوب.",
        parameters: {
          type: "OBJECT",
          properties: {
            orderNumber: { type: "NUMBER", description: "رقم الطلب" },
            shopQuery: { type: "STRING", description: "اسم المحل" },
            courierQuery: { type: "STRING", description: "اسم المندوب المراد إسناد الطلب له" }
          },
          required: ["courierQuery"]
        }
      },
      {
        name: "update_order_status",
        description: "تغيير حالة طلب محدد (مثلاً: مرفوض، مكتمل، تم الاستلام، جاري التوصيل).",
        parameters: {
          type: "OBJECT",
          properties: {
            orderNumber: { type: "NUMBER", description: "رقم الطلب" },
            shopQuery: { type: "STRING", description: "اسم المحل" },
            statusText: { type: "STRING", description: "الحالة الجديدة (مثلاً: مرفوض، مكتمل، تم الاستلام)" }
          },
          required: ["statusText"]
        }
      },
      {
        name: "bulk_update_courier_orders_status",
        description: "تحويل جميع الطلبات المعلقة أو المسندة لمندوب محدد إلى حالة (تم الاستلام / مكتمل).",
        parameters: {
          type: "OBJECT",
          properties: {
            courierQuery: { type: "STRING", description: "اسم المندوب" },
            newStatus: { type: "STRING", description: "الحالة الجديدة (مثل: delivered أو delivered_and_received)" }
          },
          required: ["courierQuery"]
        }
      },
      {
        name: "zero_courier_balance",
        description: "تصفير حساب ومستحقات مندوب محدد كلياً بالنظام.",
        parameters: {
          type: "OBJECT",
          properties: {
            courierQuery: { type: "STRING", description: "اسم المندوب المراد تصفير حسابه" }
          },
          required: ["courierQuery"]
        }
      },
      {
        name: "create_new_courier",
        description: "إنشاء وإضافة مندوب جديد في النظام باسم ورقم هاتف.",
        parameters: {
          type: "OBJECT",
          properties: {
            courierName: { type: "STRING", description: "اسم المندوب الجديد" },
            courierPhone: { type: "STRING", description: "رقم هاتف المندوب" }
          },
          required: ["courierName"]
        }
      },
      {
        name: "toggle_courier_active",
        description: "إخفاء أو تعطيل/تفعيل مندوب محدد في النظام.",
        parameters: {
          type: "OBJECT",
          properties: {
            courierQuery: { type: "STRING", description: "اسم المندوب" },
            active: { type: "BOOLEAN", description: "true للتفعيل، false للإخفاء/التعطيل" }
          },
          required: ["courierQuery", "active"]
        }
      }
    ]
  }
];

export async function executeCreatePrepShoppingDraft(
  args: any,
  context?: { telegramUserId?: string; chatId?: string; botToken?: string }
) {
  const { regionQuery, customerPhone, itemsList } = args;

  let matchingRegions = await prisma.region.findMany({
    where: { name: { contains: (regionQuery || "").trim(), mode: "insensitive" } },
    select: { id: true, name: true, deliveryPrice: true },
    orderBy: { name: "asc" }
  });

  if (matchingRegions.length === 0) {
    const allRegions = await prisma.region.findMany({ select: { id: true, name: true, deliveryPrice: true } });
    const ranked = rankRegionsByQuery(regionQuery || "", allRegions, 5);
    if (ranked.length > 0) matchingRegions = ranked;
  }

  const phone = (customerPhone || "").trim() || "غير محدد";
  const cleanItems = (itemsList || "").trim() || "مواد تجهيز ومشتريات";

  const exactMatch = matchingRegions.find(r => r.name.trim().toLowerCase() === (regionQuery || "").trim().toLowerCase());
  const shouldAskRegion = !exactMatch || matchingRegions.length > 1;

  if (shouldAskRegion && matchingRegions.length > 0 && context?.chatId && context?.telegramUserId) {
    const payload = {
      isPrepDraft: true,
      customerPhone: phone,
      itemsList: cleanItems,
      regionQuery: regionQuery
    };

    await prisma.telegramBotSession.upsert({
      where: { telegramUserId: context.telegramUserId },
      create: {
        telegramUserId: context.telegramUserId,
        chatId: context.chatId,
        step: "admin_select_order_region",
        payload: JSON.stringify(payload),
      },
      update: {
        step: "admin_select_order_region",
        payload: JSON.stringify(payload),
      }
    });

    const inlineKeyboard: any[] = [];
    for (let i = 0; i < matchingRegions.length; i += 2) {
      const row: any[] = [];
      const r1 = matchingRegions[i];
      const p1 = getRegionStrictDeliveryPrice(r1);
      row.push({ text: `📍 ${r1.name} (توصيل: ${p1})`, callback_data: `rgs:${r1.id}` });
      if (i + 1 < matchingRegions.length) {
        const r2 = matchingRegions[i + 1];
        const p2 = getRegionStrictDeliveryPrice(r2);
        row.push({ text: `📍 ${r2.name} (توصيل: ${p2})`, callback_data: `rgs:${r2.id}` });
      }
      inlineKeyboard.push(row);
    }
    inlineKeyboard.push([{ text: "❌ إلغاء التجهيز", callback_data: "main" }]);

    await sendTelegramMessageWithKeyboardToChat(
      context.chatId,
      `🛒 **تم تحليل مسودة التجهيز للمواد:**\n${cleanItems}\n\n❓ **اختر المنطقة الدقيقة بالنقر على أحد الأزرار أدناه:**`,
      { inline_keyboard: inlineKeyboard },
      context.botToken
    ).catch(() => {});

    return `🛒 **تم تحليل مسودة التجهيز!** يرجى اختيار المنطقة الدقيقة من الأزرار أدناه ⬇️`;
  }

  const region = exactMatch || matchingRegions[0];

  const preparers = await prisma.companyPreparer.findMany({
    select: { id: true, name: true },
    orderBy: { name: "asc" }
  });

  if (context?.chatId && context?.telegramUserId) {
    const payload = {
      isPrepDraft: true,
      customerPhone: phone,
      itemsList: cleanItems,
      regionId: region?.id,
      regionName: region?.name || regionQuery
    };

    await prisma.telegramBotSession.upsert({
      where: { telegramUserId: context.telegramUserId },
      create: {
        telegramUserId: context.telegramUserId,
        chatId: context.chatId,
        step: "admin_select_prep_preparer",
        payload: JSON.stringify(payload),
      },
      update: {
        step: "admin_select_prep_preparer",
        payload: JSON.stringify(payload),
      }
    });

    const inlineKeyboard: any[] = [];
    if (preparers.length > 0) {
      for (let i = 0; i < preparers.length; i += 2) {
        const row: any[] = [];
        const p1 = preparers[i];
        row.push({ text: `👨‍🍳 ${p1.name}`, callback_data: `pspr:${p1.id}` });
        if (i + 1 < preparers.length) {
          const p2 = preparers[i + 1];
          row.push({ text: `👨‍🍳 ${p2.name}`, callback_data: `pspr:${p2.id}` });
        }
        inlineKeyboard.push(row);
      }
    }
    inlineKeyboard.push([{ text: "⚡ بدون تحديد مجهز الآن", callback_data: "pspr:none" }]);
    inlineKeyboard.push([{ text: "❌ إلغاء", callback_data: "main" }]);

    await sendTelegramMessageWithKeyboardToChat(
      context.chatId,
      `🛒 **تم تحديد مواد التجهيز والمنطقة (${region?.name || regionQuery}) بنجاح!**\n\n📝 **المواد المطلوبة:**\n${cleanItems}\n📞 **الهاتف:** ${phone}\n\n👨‍🍳 **يرجى اختيار اسم المجهز لإسناد التجهيز له:**`,
      { inline_keyboard: inlineKeyboard },
      context.botToken
    ).catch(() => {});

    return `🛒 **تم تحليل التجهيز والمواد!** يرجى اختيار اسم المجهز من الأزرار أدناه 👨‍🍳⬇️`;
  }

  const draft = await prisma.companyPreparerShoppingDraft.create({
    data: {
      rawListText: cleanItems,
      customerPhone: phone,
      customerRegionId: region?.id,
      titleLine: `تجهيز ${region?.name || regionQuery}`,
      status: "draft"
    }
  });

  return `✅ **تم إنشاء مسودة التجهيز بالنظام بنجاح!**\n- **رقم المسودة:** #${draft.draftNumber}\n- **المنطقة:** ${region?.name || regionQuery}\n- **الهاتف:** ${phone}\n- **المواد:**\n${cleanItems}`;
}

export async function executeCreateOrder(args: any, context?: { telegramUserId?: string; chatId?: string; botToken?: string }) {
  const { shopQuery, customerPhone, customerName, regionQuery, orderType, price, orderNoteTime } = args;

  const phone = (customerPhone || "").trim() || "غير محدد";
  let numPrice = Number(price) || 0;

  const matchingShops = await prisma.shop.findMany({
    where: { name: { contains: (shopQuery || "").trim(), mode: "insensitive" } },
    select: { id: true, name: true },
    orderBy: { name: "asc" }
  });

  const exactShopMatch = matchingShops.find(s => s.name.trim().toLowerCase() === (shopQuery || "").trim().toLowerCase());
  const shouldAskShop = !exactShopMatch || matchingShops.length > 1;

  if (shouldAskShop && matchingShops.length > 0 && context?.chatId && context?.telegramUserId) {
    const payload = {
      customerPhone: phone,
      customerName: customerName || "",
      orderType: orderType || "طلب جديد",
      price: numPrice,
      orderNoteTime: orderNoteTime || "فوري",
      regionQuery: regionQuery,
      shopQuery: shopQuery
    };

    await prisma.telegramBotSession.upsert({
      where: { telegramUserId: context.telegramUserId },
      create: {
        telegramUserId: context.telegramUserId,
        chatId: context.chatId,
        step: "admin_select_order_shop",
        payload: JSON.stringify(payload),
      },
      update: {
        step: "admin_select_order_shop",
        payload: JSON.stringify(payload),
      }
    });

    const inlineKeyboard: any[] = [];
    for (let i = 0; i < matchingShops.length; i += 2) {
      const row: any[] = [];
      const s1 = matchingShops[i];
      row.push({ text: `🏪 ${s1.name}`, callback_data: `shps:${s1.id}` });
      if (i + 1 < matchingShops.length) {
        const s2 = matchingShops[i + 1];
        row.push({ text: `🏪 ${s2.name}`, callback_data: `shps:${s2.id}` });
      }
      inlineKeyboard.push(row);
    }
    inlineKeyboard.push([{ text: "❌ إلغاء الطلب", callback_data: "main" }]);

    await sendTelegramMessageWithKeyboardToChat(
      context.chatId,
      `❓ **عثرنا على أكثر من خيار للمحل المتطابق مع "${shopQuery}":**\n\nيرجى اختيار اسم المحل المطلوب بالنقر على الزر أدناه ⬇️`,
      { inline_keyboard: inlineKeyboard },
      context.botToken
    ).catch(() => {});

    return `⏳ **اختر اسم المحل المطلوب من الأزرار أدناه ⬇️**`;
  }

  const shop = exactShopMatch || matchingShops[0] || await prisma.shop.findFirst({ orderBy: { createdAt: "asc" } });
  if (!shop) return "❌ لم يتم العثور على أية محلات في النظام لرفع الطلب باسمها.";

  let matchingRegions = await prisma.region.findMany({
    where: { name: { contains: (regionQuery || "").trim(), mode: "insensitive" } },
    select: { id: true, name: true, deliveryPrice: true },
    orderBy: { name: "asc" }
  });

  if (matchingRegions.length === 0) {
    const allRegions = await prisma.region.findMany({ select: { id: true, name: true, deliveryPrice: true } });
    const ranked = rankRegionsByQuery(regionQuery || "", allRegions, 5);
    if (ranked.length > 0) matchingRegions = ranked;
  }

  const exactRegionMatch = matchingRegions.find(r => r.name.trim().toLowerCase() === (regionQuery || "").trim().toLowerCase());
  const shouldAskRegion = !exactRegionMatch || matchingRegions.length > 1;

  if (shouldAskRegion && matchingRegions.length > 0 && context?.chatId && context?.telegramUserId) {
    const payload = {
      shopId: shop.id,
      shopName: shop.name,
      customerPhone: phone,
      customerName: customerName || "",
      orderType: orderType || "طلب جديد",
      price: numPrice,
      orderNoteTime: orderNoteTime || "فوري",
      regionQuery: regionQuery
    };

    await prisma.telegramBotSession.upsert({
      where: { telegramUserId: context.telegramUserId },
      create: {
        telegramUserId: context.telegramUserId,
        chatId: context.chatId,
        step: "admin_select_order_region",
        payload: JSON.stringify(payload),
      },
      update: {
        step: "admin_select_order_region",
        payload: JSON.stringify(payload),
      }
    });

    const inlineKeyboard: any[] = [];
    for (let i = 0; i < matchingRegions.length; i += 2) {
      const row: any[] = [];
      const r1 = matchingRegions[i];
      const p1 = getRegionStrictDeliveryPrice(r1);
      row.push({ text: `📍 ${r1.name} (توصيل: ${p1})`, callback_data: `rgs:${r1.id}` });
      if (i + 1 < matchingRegions.length) {
        const r2 = matchingRegions[i + 1];
        const p2 = getRegionStrictDeliveryPrice(r2);
        row.push({ text: `📍 ${r2.name} (توصيل: ${p2})`, callback_data: `rgs:${r2.id}` });
      }
      inlineKeyboard.push(row);
    }
    inlineKeyboard.push([{ text: "❌ إلغاء الطلب", callback_data: "main" }]);

    await sendTelegramMessageWithKeyboardToChat(
      context.chatId,
      `🏪 **المحل:** ${shop.name}\n❓ **اختر المنطقة الدقيقة من الأزرار أدناه (مع تسعيرة التوصيل الثابتة لكل منطقة):**`,
      { inline_keyboard: inlineKeyboard },
      context.botToken
    ).catch(() => {});

    return `⏳ **اختر المنطقة المطلوب التوصيل لها من الأزرار أدناه ⬇️**`;
  }

  const region = exactRegionMatch || matchingRegions[0];
  const finalDeliveryPrice = getRegionStrictDeliveryPrice(region);
  const totalAmount = numPrice + finalDeliveryPrice;

  const order = await prisma.order.create({
    data: {
      shopId: shop.id,
      status: "pending",
      orderType: orderType || "طلب جديد",
      customerRegionId: region?.id,
      customerPhone: phone,
      orderSubtotal: new Decimal(numPrice),
      deliveryPrice: new Decimal(finalDeliveryPrice),
      totalAmount: new Decimal(totalAmount),
      submissionSource: "admin_ai_assistant",
      orderNoteTime: orderNoteTime || "فوري",
    }
  });

  if (customerName && phone !== "غير محدد") {
    await prisma.customer.upsert({
      where: { phone_shopId: { phone, shopId: shop.id } },
      create: { phone, name: customerName, shopId: shop.id, regionId: region?.id },
      update: { name: customerName, regionId: region?.id }
    }).catch(() => {});
  }

  notifyTelegramNewOrder(order.id).catch(() => {});
  pushNotifyAdminsNewPendingOrder(order.orderNumber).catch(() => {});

  return `✅ **تم إضافة الطلب بالنظام بنجاح!**\n- **رقم الطلب:** #${order.orderNumber}\n- **المحل:** ${shop.name}\n- **المنطقة:** ${region?.name || regionQuery}\n- **الهاتف:** ${phone}\n- **سعر التوصيل الثابت:** ${finalDeliveryPrice}\n- **المبلغ الإجمالي:** ${totalAmount}`;
}

async function executeAssignCourier(args: any) {
  const { orderNumber, shopQuery, courierQuery } = args;

  let order: any = null;
  if (orderNumber) {
    order = await prisma.order.findUnique({ where: { orderNumber: Number(orderNumber) } });
  } else if (shopQuery) {
    const shop = await prisma.shop.findFirst({ where: { name: { contains: shopQuery, mode: "insensitive" } } });
    if (shop) {
      order = await prisma.order.findFirst({
        where: { shopId: shop.id, status: "pending" },
        orderBy: { createdAt: "desc" }
      });
    }
  }

  if (!order) return "❌ لم يتم العثور على الطلب المحدد لإسناده.";

  const courier = await prisma.courier.findFirst({
    where: { name: { contains: courierQuery, mode: "insensitive" } }
  });

  if (!courier) return `❌ لم يتم العثور على المندوب "${courierQuery}" في النظام.`;

  await prisma.order.update({
    where: { id: order.id },
    data: { assignedCourierId: courier.id, status: "assigned" }
  });

  return `✅ **تم إسناد الطلب #${order.orderNumber} للمندوب ${courier.name} بنجاح!**`;
}

async function executeUpdateOrderStatus(args: any) {
  const { orderNumber, shopQuery, statusText } = args;

  let order: any = null;
  if (orderNumber) {
    order = await prisma.order.findUnique({ where: { orderNumber: Number(orderNumber) } });
  } else if (shopQuery) {
    const shop = await prisma.shop.findFirst({ where: { name: { contains: shopQuery, mode: "insensitive" } } });
    if (shop) {
      order = await prisma.order.findFirst({
        where: { shopId: shop.id },
        orderBy: { createdAt: "desc" }
      });
    }
  }

  if (!order) return "❌ لم يتم العثور على الطلب المحدد لتحديث حالته.";

  let mappedStatus = "pending";
  const st = (statusText || "").toLowerCase();
  if (st.includes("مرفوض") || st.includes("مرفوضة") || st.includes("ملغي") || st.includes("rejected")) mappedStatus = "rejected";
  else if (st.includes("مكتمل") || st.includes("واصل") || st.includes("completed")) mappedStatus = "completed";
  else if (st.includes("استلام") || st.includes("تم الاستلام") || st.includes("delivered")) mappedStatus = "delivered";
  else if (st.includes("توصيل") || st.includes("بالطريق") || st.includes("delivering")) mappedStatus = "delivering";

  await prisma.order.update({
    where: { id: order.id },
    data: { status: mappedStatus }
  });

  return `✅ **تم تغيير حالة الطلب #${order.orderNumber} إلى (${statusText}) بنجاح!**`;
}

async function executeBulkUpdateCourierOrdersStatus(args: any) {
  const { courierQuery, newStatus } = args;

  const courier = await prisma.courier.findFirst({
    where: { name: { contains: courierQuery, mode: "insensitive" } }
  });

  if (!courier) return `❌ لم يتم العثور على المندوب "${courierQuery}" في النظام.`;

  const statusToApply = (newStatus || "delivered_and_received").includes("استلام") ? "delivered" : "completed";

  const updated = await prisma.order.updateMany({
    where: { assignedCourierId: courier.id, status: { in: ["assigned", "delivering", "pending"] } },
    data: { status: statusToApply }
  });

  return `✅ **تم تحويل كافة طلبات المندوب ${courier.name} المعلقة (${updated.count} طلب) إلى حالة تم الاستلام/المكتملة بنجاح!**`;
}

async function executeZeroCourierBalance(args: any) {
  const { courierQuery } = args;

  const courier = await prisma.courier.findFirst({
    where: { name: { contains: courierQuery, mode: "insensitive" } }
  });

  if (!courier) return `❌ لم يتم العثور على المندوب "${courierQuery}" في النظام.`;

  await prisma.courier.update({
    where: { id: courier.id },
    data: { lastSalaryWithdrawalAt: new Date() }
  });

  return `✅ **تم تصفير حساب ومستحقات المندوب ${courier.name} بنجاح!**`;
}

async function executeCreateNewCourier(args: any) {
  const { courierName, courierPhone } = args;

  const name = (courierName || "").trim();
  const phone = (courierPhone || "").trim() || "غير محدد";

  if (!name) return "❌ يرجى تحديد اسم المندوب الجديد.";

  const courier = await prisma.courier.create({
    data: {
      name,
      phone,
      active: true
    }
  });

  return `✅ **تم إضافة المندوب الجديد (${courier.name}) بنجاح للنظام!**\n- **الهاتف:** ${phone}`;
}

async function executeToggleCourierActive(args: any) {
  const { courierQuery, active } = args;

  const courier = await prisma.courier.findFirst({
    where: { name: { contains: courierQuery, mode: "insensitive" } }
  });

  if (!courier) return `❌ لم يتم العثور على المندوب "${courierQuery}" في النظام.`;

  await prisma.courier.update({
    where: { id: courier.id },
    data: { active: Boolean(active) }
  });

  const stateText = active ? "تفعيل وإظهار" : "إخفاء وتطبيق التعطيل على";

  return `✅ **تم ${stateText} المندوب ${courier.name} بنجاح!**`;
}

async function executeZeroPartnerDebt(args: any) {
  const { personQuery } = args;
  const targetName = (personQuery || "").trim();

  const partner = await prisma.creditBookPartner.findFirst({
    where: { name: { contains: targetName, mode: "insensitive" } }
  });

  if (!partner) return `❌ لم يتم العثور على حساب "${targetName}" بدفتر الديون.`;

  await prisma.creditBookTransaction.create({
    data: {
      partnerId: partner.id,
      amount: new Decimal(0),
      kind: "took",
      note: "تصفير الحساب والدين بالكامل عبر الذكاء الاصطناعي"
    }
  });

  return `✅ **تم تصفير حساب ودين (${partner.name}) بالكامل بدفتر الديون بنجاح!**`;
}

async function executeDebtTransaction(args: any) {
  const { personQuery, amount, type, note } = args;

  const targetName = (personQuery || "").trim() || "غير محدد";
  const numAmount = Number(amount) || 0;

  if (numAmount <= 0) {
    return "❌ يرجى تحديد المبلغ المالي صراحة لتسجيله في دفتر الديون.";
  }

  let partner = await prisma.creditBookPartner.findFirst({
    where: { name: { contains: targetName, mode: "insensitive" } }
  });

  if (!partner) {
    const courier = await prisma.courier.findFirst({ where: { name: { contains: targetName, mode: "insensitive" } } });
    const preparer = !courier ? await prisma.companyPreparer.findFirst({ where: { name: { contains: targetName, mode: "insensitive" } } }) : null;
    const shop = !courier && !preparer ? await prisma.shop.findFirst({ where: { name: { contains: targetName, mode: "insensitive" } } }) : null;

    let partnerType = "external";
    let externalId: string | null = null;

    if (courier) {
      partnerType = "courier";
      externalId = courier.id;
    } else if (preparer) {
      partnerType = "preparer";
      externalId = preparer.id;
    } else if (shop) {
      partnerType = "shop";
      externalId = shop.id;
    }

    partner = await prisma.creditBookPartner.create({
      data: {
        name: courier?.name || preparer?.name || shop?.name || targetName,
        type: partnerType,
        externalId: externalId
      }
    });
  }

  const isTook = type === "took" || type === "borrowed" || type === "أخذت" || type === "أخذت من" || type === "استلمت";
  const kind = isTook ? "took" : "gave";

  await prisma.creditBookTransaction.create({
    data: {
      partnerId: partner.id,
      amount: new Decimal(numAmount),
      kind: kind,
      note: note || "مسجلة عبر الذكاء الاصطناعي"
    }
  });

  const kindText = kind === "took" ? "أخذت (تسديد / يطلبنا)" : "أعطيت (دين نطلبه)";

  return `✅ **تم تسجيل وتثبيت المعاملة بدفتر الديون بنجاح!**\n\n- **الطرف / الحساب:** ${partner.name}\n- **المبلغ:** ${numAmount}\n- **نوع العملية:** ${kindText}\n- **الملاحظات:** ${note || "لا يوجد"}`;
}

const chatHistoryMemory = new Map<string, Array<{ role: "user" | "model"; text: string }>>();

function getChatHistory(userId: string): Array<{ role: "user" | "model"; text: string }> {
  return chatHistoryMemory.get(userId) || [];
}

function appendChatHistory(userId: string, role: "user" | "model", text: string) {
  const list = getChatHistory(userId);
  list.push({ role, text });
  if (list.length > 10) list.shift();
  chatHistoryMemory.set(userId, list);
}

export async function processAdminAiMessage(
  userText: string,
  telegramUserId: string = "default",
  chatId?: string,
  botToken?: string
): Promise<string> {
  const allKeys = await getAllActiveGeminiKeys();

  if (allKeys.length === 0) {
    return "⚠️ لا يوجد أي مفتاح Gemini API فعال حالياً في النظام. يرجى إضافة مفتاح API في صفحة الإعدادات لتفعيل الذكاء الاصطناعي.";
  }

  const systemPrompt = `أنت الذكاء الاصطناعي الفعال ومساعد مدير المشروع والمبيعات والتوصيل والتجهيز ودفتر الديون والإدارة في العراق.
وظيفتك الأساسية: تنفيذ الأوامر المباشرة فوراً وبدون أي كلام إنشائي أو أسئلة زائدة إطلاقاً!
ملاحظة حاسمة جداً للمبالغ: اعتماد المبالغ كما هي صراحة من المدير (مثلاً 5 تعني 5، 10 تعني 10)، ممنوع منعاً باتاً إضافة أصفار أو تحويلها بضربها بـ 1000!
ممنوع منعاً باتاً تحديد أو تغيير سعر التوصيل من الذكاء الاصطناعي، فأسعار التوصيل يتم جلبها حصراً وآلياً من أسعار المناطق المعتمدة في النظام.
إذا قال المدير "صفر فلان / صفر دين فلان" استخدم zero_partner_debt.
إذا قال المدير "أخذت من فلان" استخدم register_debt_transaction بنوع 'took'.
إذا قال المدير "أعطيت لفلان / انطيت فلان" استخدم register_debt_transaction بنوع 'gave'.
إذا طلب المدير إسناد طلب لمندوب استخدم assign_order_to_courier.
إذا طلب المدير تغيير حالة طلب أو رفضه استخدم update_order_status.
إذا طلب المدير تحويل طلبات مندوب معينة إلى تم الاستلام استخدم bulk_update_courier_orders_status.
إذا طلب المدير تصفير مندوب استخدم zero_courier_balance.
إذا طلب المدير إضافة مندوب جديد استخدم create_new_courier.
إذا طلب المدير إخفاء أو تعطيل مندوب استخدم toggle_courier_active.
إذا قدم لك المدير رسالة تجهيز نصية تحوي (منطقة + هاتف + قائمة مواد)، استخدم create_prep_shopping_draft فوراً!
إذا قدم لك المدير تفاصيل طلب مبيعات، استخدم create_order فوراً!`;

  appendChatHistory(telegramUserId, "user", userText);
  const history = getChatHistory(telegramUserId);

  const contentsPayload = history.map(h => ({
    role: h.role,
    parts: [{ text: h.text }]
  }));

  let lastApiError = "";

  for (const keyRecord of allKeys) {
    const models = ["gemini-2.5-flash", "gemini-3.6-flash", "gemini-flash-latest"];

    for (const model of models) {
      try {
        const resTools = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${keyRecord.key}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              systemInstruction: { parts: [{ text: systemPrompt }] },
              contents: contentsPayload,
              tools: AI_TOOLS,
            }),
          }
        );

        if (resTools.ok) {
          const dataTools = await resTools.json();
          const parts = dataTools.candidates?.[0]?.content?.parts || [];
          for (const part of parts) {
            if (part.functionCall) {
              const fn = part.functionCall;
              let reply = "";
              if (fn.name === "create_prep_shopping_draft") reply = await executeCreatePrepShoppingDraft(fn.args, { telegramUserId, chatId, botToken });
              else if (fn.name === "create_order") reply = await executeCreateOrder(fn.args, { telegramUserId, chatId, botToken });
              else if (fn.name === "register_debt_transaction") reply = await executeDebtTransaction(fn.args);
              else if (fn.name === "zero_partner_debt") reply = await executeZeroPartnerDebt(fn.args);
              else if (fn.name === "assign_order_to_courier") reply = await executeAssignCourier(fn.args);
              else if (fn.name === "update_order_status") reply = await executeUpdateOrderStatus(fn.args);
              else if (fn.name === "bulk_update_courier_orders_status") reply = await executeBulkUpdateCourierOrdersStatus(fn.args);
              else if (fn.name === "zero_courier_balance") reply = await executeZeroCourierBalance(fn.args);
              else if (fn.name === "create_new_courier") reply = await executeCreateNewCourier(fn.args);
              else if (fn.name === "toggle_courier_active") reply = await executeToggleCourierActive(fn.args);

              if (reply) {
                appendChatHistory(telegramUserId, "model", reply);
                await markGeminiKeySuccess(keyRecord.id);
                return reply;
              }
            }
          }

          const textOutput = parts.map((p: any) => p.text).filter(Boolean).join("\n");
          if (textOutput?.trim()) {
            appendChatHistory(telegramUserId, "model", textOutput.trim());
            await markGeminiKeySuccess(keyRecord.id);
            return textOutput.trim();
          }
        } else {
          const errText = await resTools.text().catch(() => "");
          lastApiError = `[Model: ${model}, Status: ${resTools.status}] ${errText}`;
        }

        const resPure = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${keyRecord.key}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              systemInstruction: { parts: [{ text: systemPrompt }] },
              contents: contentsPayload,
            }),
          }
        );

        if (resPure.ok) {
          const dataPure = await resPure.json();
          const textReply = dataPure.candidates?.[0]?.content?.parts?.[0]?.text;
          if (textReply?.trim()) {
            appendChatHistory(telegramUserId, "model", textReply.trim());
            await markGeminiKeySuccess(keyRecord.id);
            return textReply.trim();
          }
        }
      } catch (err: any) {
        lastApiError = err.message || String(err);
      }
    }
  }

  return `⚠️ تعذر الحصول على رد من الذكاء الاصطناعي Gemini.\nتفاصيل الخطأ: ${lastApiError.slice(0, 150)}`;
}
