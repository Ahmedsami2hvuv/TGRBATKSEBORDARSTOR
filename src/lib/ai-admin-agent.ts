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
 * أدوات النظام لتنفيذ العمليات الذكية
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
        description: "إنشاء مسودة طلب تجهيز ومشتريات من رسالة التجهيز النصية التي تحتوي على منطقة، رقم هاتف، وقائمة مواد ومشتريات (مثل: طماطة، خيار، بتيته، بصل).",
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
        name: "assign_order_to_courier",
        description: "إسناد طلب لمندوب محدد.",
        parameters: {
          type: "OBJECT",
          properties: {
            orderNumber: { type: "NUMBER", description: "رقم الطلب" },
            shopQuery: { type: "STRING", description: "اسم المحل" },
            courierQuery: { type: "STRING", description: "اسم المندوب" }
          },
          required: ["courierQuery"]
        }
      },
      {
        name: "register_debt_transaction",
        description: "تسجيل معاملة مالية بدفتر الديون (أخذت / انطيت / دين / تسديد).",
        parameters: {
          type: "OBJECT",
          properties: {
            personQuery: { type: "STRING", description: "اسم الشخص أو الطرف (مثلاً: الوالد، علي، المحل)" },
            amount: { type: "NUMBER", description: "المبلغ كما ينطقه المدير بالضبط (مثلاً 5 أو 10) بدون إضافة أصفار تلقائية" },
            type: { type: "STRING", description: "'took' (أخذت/استلمت) أو 'gave' (اعطيت/انطيت)" },
            note: { type: "STRING", description: "ملاحظات وتفاصيل المعاملة" }
          },
          required: ["personQuery", "amount", "type"]
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
  const cleanItems = (itemsList || "").trim() || "مواد تجهيز عامة";

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

  // جلب كافة المجهزين المسجلين بالنظام بدون أي تصفية خاطئة!
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

  // 1. فحص المحلات المتشابهة
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

  // 2. فحص المناطق المتشابهة
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

/**
 * التسجيل الفعلي والمباشر للمعاملات المالية في دفتر الديون (Credit Book)
 */
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

/**
 * المحرك المباشر والحي للذكاء الاصطناعي Gemini AI
 */
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

  const systemPrompt = `أنت الذكاء الاصطناعي الفعال ومساعد مدير المشروع والمبيعات والتوصيل والتجهيز ودفتر الديون في العراق.
وظيفتك الأساسية: تنفيذ الأوامر المباشرة فوراً وبدون أي كلام إنشائي أو أسئلة زائدة إطلاقاً!
ملاحظة حاسمة جداً للمبالغ: اعتماد المبالغ كما هي صراحة من المدير (مثلاً 5 تعني 5، 10 تعني 10)، ممنوع منعاً باتاً إضافة أصفار أو تحويلها بضربها بـ 1000!
ممنوع منعاً باتاً تحديد أو تغيير سعر التوصيل من الذكاء الاصطناعي، فأسعار التوصيل يتم جلبها حصراً وآلياً من أسعار المناطق المعتمدة في النظام.
إذا قال المدير "أخذت من فلان" استخدم register_debt_transaction بنوع 'took'.
إذا قال المدير "أعطيت لفلان / انطيت فلان" استخدم register_debt_transaction بنوع 'gave'.
إذا قدم لك المدير رسالة تجهيز نصية تحوي (منطقة + هاتف + قائمة مواد كـ طماطة وخيار وبتيته وبصل)، استخدم create_prep_shopping_draft فوراً وحافظ على قائمة المنتجات كاملة!
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
              else if (fn.name === "assign_order_to_courier") reply = await executeAssignCourier(fn.args);
              else if (fn.name === "register_debt_transaction") reply = await executeDebtTransaction(fn.args);

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

  return `⚠️ تعذر الحصول على رد من الذكاء الاصطناعي Gemini.\nتأكد من أن المفتاح المضاف فعال ولم ينتهِ رصيده.\nتفاصيل الخطأ: ${lastApiError.slice(0, 150)}`;
}
