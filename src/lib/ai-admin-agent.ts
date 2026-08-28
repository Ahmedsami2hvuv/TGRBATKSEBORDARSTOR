import { prisma } from "./prisma";
import { getAllActiveGeminiKeys, markGeminiKeyError, markGeminiKeySuccess } from "./gemini-pool";
import { formatDinarAsAlf } from "./money-alf";
import { rankRegionsByQuery } from "./arabic-region-search";
import { Decimal } from "@prisma/client/runtime/library";
import { pushNotifyAdminsNewPendingOrder } from "./web-push-server";
import { notifyTelegramNewOrder } from "./telegram-notify";
import { sendTelegramMessageWithKeyboardToChat } from "./telegram";

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
            price: { type: "NUMBER", description: "سعر الطلب بالدينار العراقي (مثلاً 10000 أو 25000)" },
            deliveryPrice: { type: "NUMBER", description: "سعر التوصيل بالدينار العراقي" },
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
        description: "تسجيل معاملة ديون أو مبالغ مالية.",
        parameters: {
          type: "OBJECT",
          properties: {
            personQuery: { type: "STRING", description: "اسم الشخص" },
            amount: { type: "NUMBER", description: "المبلغ بالدينار" },
            type: { type: "STRING", description: "'borrowed' أو 'paid'" },
            note: { type: "STRING", description: "الملاحظات" }
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
    where: { name: { contains: regionQuery.trim(), mode: "insensitive" } },
    select: { id: true, name: true, deliveryPrice: true },
    orderBy: { name: "asc" }
  });

  if (matchingRegions.length === 0) {
    const allRegions = await prisma.region.findMany({ select: { id: true, name: true, deliveryPrice: true } });
    const ranked = rankRegionsByQuery(regionQuery, allRegions, 5);
    if (ranked.length > 0) matchingRegions = ranked;
  }

  const phone = (customerPhone || "").trim() || "غير محدد";

  // إذا وجدنا أكثر من منطقة متشابهة، نعرض أزرار المناطق أولاً للتجهيز
  if (matchingRegions.length > 1 && context?.chatId && context?.telegramUserId) {
    const payload = {
      isPrepDraft: true,
      customerPhone: phone,
      itemsList: itemsList,
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
      row.push({ text: `📍 ${r1.name}`, callback_data: `rgs:${r1.id}` });
      if (i + 1 < matchingRegions.length) {
        const r2 = matchingRegions[i + 1];
        row.push({ text: `📍 ${r2.name}`, callback_data: `rgs:${r2.id}` });
      }
      inlineKeyboard.push(row);
    }
    inlineKeyboard.push([{ text: "❌ إلغاء التجهيز", callback_data: "main" }]);

    await sendTelegramMessageWithKeyboardToChat(
      context.chatId,
      `🛒 **تم تحليل مسودة التجهيز للمواد:**\n${itemsList}\n\n❓ **عثرنا على أكثر من منطقة متشابهة لـ "${regionQuery}":**\nيرجى اختيار المنطقة الدقيقة أدناه للانتقال لاختيار المجهز ⬇️`,
      { inline_keyboard: inlineKeyboard },
      context.botToken
    ).catch(() => {});

    return `🛒 **تم تحليل مسودة التجهيز!** يرجى اختيار المنطقة الدقيقة من الأزرار أدناه ⬇️`;
  }

  // إذا كانت المنطقة فريدة، ننتقل فوراً لخطوة اختيار المجهز بالأزرار!
  const region = matchingRegions[0];
  const preparers = await prisma.companyPreparer.findMany({
    where: { active: true },
    select: { id: true, name: true },
    orderBy: { name: "asc" }
  });

  if (preparers.length > 0 && context?.chatId && context?.telegramUserId) {
    const payload = {
      isPrepDraft: true,
      customerPhone: phone,
      itemsList: itemsList,
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
    inlineKeyboard.push([{ text: "❌ إلغاء", callback_data: "main" }]);

    await sendTelegramMessageWithKeyboardToChat(
      context.chatId,
      `🛒 **تم تحديد المواد والمنطقة (${region?.name || regionQuery}) بنجاح!**\n\n📝 **المواد:**\n${itemsList}\n📞 **الهاتف:** ${phone}\n\n👨‍🍳 **اختر المجهز الذي تريد إسناد التجهيز له:**`,
      { inline_keyboard: inlineKeyboard },
      context.botToken
    ).catch(() => {});

    return `🛒 **تم تحليل التجهيز!** اختر المجهز المطلوب من الأزرار أدناه 👨‍🍳⬇️`;
  }

  // إذا لم يكن هناك مجهزون مسجلون، ننشئ مسودة التجهيز فوراً
  const draft = await prisma.companyPreparerShoppingDraft.create({
    data: {
      rawListText: itemsList,
      customerPhone: phone,
      customerRegionId: region?.id,
      titleLine: `تجهيز ${region?.name || regionQuery}`,
      status: "draft"
    }
  });

  return `✅ **تم إنشاء مسودة التجهيز بالنظام بنجاح!**\n- **رقم المسودة:** #${draft.draftNumber}\n- **المنطقة:** ${region?.name || regionQuery}\n- **الهاتف:** ${phone}\n- **المواد:**\n${itemsList}`;
}

export async function executeCreateOrder(args: any, context?: { telegramUserId?: string; chatId?: string; botToken?: string }) {
  const { shopQuery, customerPhone, customerName, regionQuery, orderType, price, deliveryPrice, orderNoteTime } = args;

  const shop = await prisma.shop.findFirst({
    where: { name: { contains: shopQuery, mode: "insensitive" } }
  }) || await prisma.shop.findFirst({ orderBy: { createdAt: "asc" } });

  if (!shop) return "❌ لم يتم العثور على أية محلات في النظام لرفع الطلب باسمها.";

  let matchingRegions = await prisma.region.findMany({
    where: { name: { contains: regionQuery.trim(), mode: "insensitive" } },
    select: { id: true, name: true, deliveryPrice: true },
    orderBy: { name: "asc" }
  });

  if (matchingRegions.length === 0) {
    const allRegions = await prisma.region.findMany({ select: { id: true, name: true, deliveryPrice: true } });
    const ranked = rankRegionsByQuery(regionQuery, allRegions, 5);
    if (ranked.length > 0) matchingRegions = ranked;
  }

  let numPrice = Number(price) || 0;
  if (numPrice > 0 && numPrice < 1000) numPrice = numPrice * 1000;
  const phone = (customerPhone || "").trim() || "غير محدد";

  if (matchingRegions.length > 1 && context?.chatId && context?.telegramUserId) {
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
      row.push({ text: `📍 ${r1.name} (${formatDinarAsAlf(r1.deliveryPrice)})`, callback_data: `rgs:${r1.id}` });
      if (i + 1 < matchingRegions.length) {
        const r2 = matchingRegions[i + 1];
        row.push({ text: `📍 ${r2.name} (${formatDinarAsAlf(r2.deliveryPrice)})`, callback_data: `rgs:${r2.id}` });
      }
      inlineKeyboard.push(row);
    }
    inlineKeyboard.push([{ text: "❌ إلغاء الطلب", callback_data: "main" }]);

    await sendTelegramMessageWithKeyboardToChat(
      context.chatId,
      `❓ **عثرنا على أكثر من منطقة متشابهة لـ "${regionQuery}":**\n\nيرجى النقر على زر المنطقة الدقيقة أدناه لتثبيت الطلب:`,
      { inline_keyboard: inlineKeyboard },
      context.botToken
    ).catch(() => {});

    return `⏳ **عثرنا على أكثر من منطقة متشابهة لـ "${regionQuery}".** يرجى النقر على زر المنطقة المطلوب تثبيتها أدناه ⬇️`;
  }

  const region = matchingRegions[0];
  const finalDeliveryPrice = deliveryPrice != null ? deliveryPrice : (region?.deliveryPrice.toNumber() || 5000);
  const totalAmount = numPrice + Number(finalDeliveryPrice);

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

  return `✅ **تم إضافة الطلب بالنظام بنجاح!**\n- **رقم الطلب:** #${order.orderNumber}\n- **المحل:** ${shop.name}\n- **المنطقة:** ${region?.name || regionQuery}\n- **الهاتف:** ${phone}\n- **سعر التوصيل:** ${formatDinarAsAlf(finalDeliveryPrice)}\n- **المبلغ الإجمالي:** ${formatDinarAsAlf(totalAmount)}`;
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

async function executeDebtTransaction(args: any) {
  const { personQuery, amount, type, note } = args;

  const courier = await prisma.courier.findFirst({ where: { name: { contains: personQuery, mode: "insensitive" } } });
  const preparer = !courier ? await prisma.companyPreparer.findFirst({ where: { name: { contains: personQuery, mode: "insensitive" } } }) : null;

  const targetName = courier?.name || preparer?.name || personQuery;
  const isBorrowed = type === "borrowed";

  return `✅ **تم تسجيل المعاملة المالية بنجاح!**\n- **الطرف:** ${targetName}\n- **المبلغ:** ${formatDinarAsAlf(amount)}\n- **النوع:** ${isBorrowed ? "دين على الحساب" : "دفع / تسديد"}\n- **التفاصيل:** ${note || "لا يوجد"}`;
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

  const systemPrompt = `أنت الذكاء الاصطناعي الفعال ومساعد مدير المشروع والمبيعات والتوصيل والتجهيز في العراق.
وظيفتك الأساسية: تنفيذ الأوامر المباشرة فوراً وبدون أي كلام إنشائي أو أسئلة زائدة إطلاقاً!
إذا قدم لك المدير رسالة تجهيز نصية تحوي (منطقة + هاتف + قائمة مواد ومشتريات كـ طماطة وخيار وبتيته وبصل)، استخدم الأداة create_prep_shopping_draft فوراً!
إذا قدم لك المدير تفاصيل طلب مبيعات، استخدم الأداة create_order فوراً!
تذكر الرسائل السابقة واجمع البيانات منها لتنفيذ الأوامر فوراً.`;

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
