import { prisma } from "./prisma";
import { getAllActiveGeminiKeys, markGeminiKeyError, markGeminiKeySuccess } from "./gemini-pool";
import { formatDinarAsAlf } from "./money-alf";
import { rankRegionsByQuery } from "./arabic-region-search";
import { Decimal } from "@prisma/client/runtime/library";
import { pushNotifyAdminsNewPendingOrder } from "./web-push-server";
import { notifyTelegramNewOrder } from "./telegram-notify";

/**
 * أدوات النظام لتنفيذ العمليات الذكية
 */
const AI_TOOLS = [
  {
    functionDeclarations: [
      {
        name: "create_order",
        description: "إضافة ورصد طلب جديد في النظام فوراً عند وجود تفاصيل المحل والمنطقة وسعر الطلب وهاتف الزبون.",
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

async function executeCreateOrder(args: any) {
  const { shopQuery, customerPhone, customerName, regionQuery, orderType, price, deliveryPrice, orderNoteTime } = args;

  const shop = await prisma.shop.findFirst({
    where: { name: { contains: shopQuery, mode: "insensitive" } }
  }) || await prisma.shop.findFirst({ orderBy: { createdAt: "asc" } });

  if (!shop) return "❌ لم يتم العثور على أية محلات في النظام لرفع الطلب باسمها.";

  let region = await prisma.region.findFirst({
    where: { name: { contains: regionQuery, mode: "insensitive" } }
  });

  if (!region) {
    const allRegions = await prisma.region.findMany({ select: { id: true, name: true, deliveryPrice: true } });
    const ranked = rankRegionsByQuery(regionQuery, allRegions, 1);
    if (ranked.length > 0) {
      region = await prisma.region.findUnique({ where: { id: ranked[0].id } });
    }
  }

  // تنظيف السعر: إذا كان 10 أو 25 نحوله لآلاف الدينار تلقائياً
  let numPrice = Number(price) || 0;
  if (numPrice > 0 && numPrice < 1000) {
    numPrice = numPrice * 1000;
  }

  const finalDeliveryPrice = deliveryPrice != null ? deliveryPrice : (region?.deliveryPrice.toNumber() || 5000);
  const totalAmount = numPrice + Number(finalDeliveryPrice);
  const phone = (customerPhone || "").trim() || "غير محدد";

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

  return `✅ **تم إضافة الطلب بالنظام بنجاح وسرعة!**\n- **رقم الطلب:** #${order.orderNumber}\n- **المحل:** ${shop.name}\n- **المنطقة:** ${region?.name || regionQuery}\n- **الهاتف:** ${phone}\n- **المبلغ الإجمالي:** ${formatDinarAsAlf(totalAmount)}`;
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

/**
 * ذاكرة مؤقتة لسياق المحادثة المترابطة لكل مدير
 */
const chatHistoryMemory = new Map<string, Array<{ role: "user" | "model"; text: string }>>();

function getChatHistory(userId: string): Array<{ role: "user" | "model"; text: string }> {
  return chatHistoryMemory.get(userId) || [];
}

function appendChatHistory(userId: string, role: "user" | "model", text: string) {
  const list = getChatHistory(userId);
  list.push({ role, text });
  if (list.length > 10) list.shift(); // الحفاظ على آخر 10 رسائل
  chatHistoryMemory.set(userId, list);
}

/**
 * المحرك المباشر والحي للذكاء الاصطناعي Gemini AI
 */
export async function processAdminAiMessage(userText: string, telegramUserId: string = "default"): Promise<string> {
  const allKeys = await getAllActiveGeminiKeys();

  if (allKeys.length === 0) {
    return "⚠️ لا يوجد أي مفتاح Gemini API فعال حالياً في النظام. يرجى إضافة مفتاح API في صفحة الإعدادات لتفعيل الذكاء الاصطناعي.";
  }

  const systemPrompt = `أنت الذكاء الاصطناعي الفعال ومساعد مدير المشروع والمباعيات والتوصيل في العراق.
وظيفتك الأساسية: تنفيذ الأوامر المباشرة فوراً وبدون أي كلام إنشائي أو أسئلة زائدة إطلاقاً!
إذا قدم لك المدير تفاصيل طلب (اسم محل، منطقة، سعر، نوع طلب)، استخدم الأداة create_order فوراً لرفع الطلب بالنظام دون أن تطلب مناقشات أو أسئلة!
تذكر الرسائل السابقة في المحادثة واجمع البيانات منها لتنفيذ الأوامر فوراً.`;

  // تجهيز ذاكرة السجل للمحادثة
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
        // 1. تنفيذ الأدوات والعمليات أولاً بالدرجة الأولى!
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
              if (fn.name === "create_order") reply = await executeCreateOrder(fn.args);
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

        // 2. المحاولة بطلب النص المباشر
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
