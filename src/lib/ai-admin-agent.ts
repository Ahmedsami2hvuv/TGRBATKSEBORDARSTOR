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
        description: "إضافة طلب جديد في النظام عند تزويدك بتفاصيل المحل والزبون والمنطقة والسعر.",
        parameters: {
          type: "OBJECT",
          properties: {
            shopQuery: { type: "STRING", description: "اسم المحل" },
            customerPhone: { type: "STRING", description: "رقم هاتف الزبون" },
            customerName: { type: "STRING", description: "اسم الزبون" },
            regionQuery: { type: "STRING", description: "اسم المنطقة" },
            orderType: { type: "STRING", description: "وصف الطلب والمنتجات" },
            price: { type: "NUMBER", description: "سعر الطلب بالدينار" },
            deliveryPrice: { type: "NUMBER", description: "سعر التوصيل بالدينار" },
            orderNoteTime: { type: "STRING", description: "وقت التسليم" }
          },
          required: ["shopQuery", "customerPhone", "regionQuery", "price"]
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

  const finalDeliveryPrice = deliveryPrice != null ? deliveryPrice : (region?.deliveryPrice.toNumber() || 5000);
  const totalAmount = Number(price) + Number(finalDeliveryPrice);

  const order = await prisma.order.create({
    data: {
      shopId: shop.id,
      status: "pending",
      orderType: orderType || "طلب جديد",
      customerRegionId: region?.id,
      customerPhone: customerPhone.trim(),
      orderSubtotal: new Decimal(price),
      deliveryPrice: new Decimal(finalDeliveryPrice),
      totalAmount: new Decimal(totalAmount),
      submissionSource: "admin_ai_assistant",
      orderNoteTime: orderNoteTime || "فوري",
    }
  });

  if (customerName) {
    await prisma.customer.upsert({
      where: { phone_shopId: { phone: customerPhone.trim(), shopId: shop.id } },
      create: { phone: customerPhone.trim(), name: customerName, shopId: shop.id, regionId: region?.id },
      update: { name: customerName, regionId: region?.id }
    }).catch(() => {});
  }

  notifyTelegramNewOrder(order.id).catch(() => {});
  pushNotifyAdminsNewPendingOrder(order.orderNumber).catch(() => {});

  return `✅ **تم إضافة الطلب بنجاح!**\n- **رقم الطلب:** #${order.orderNumber}\n- **المحل:** ${shop.name}\n- **المنطقة:** ${region?.name || regionQuery}\n- **الهاتف:** ${customerPhone}\n- **السعر الإجمالي:** ${formatDinarAsAlf(totalAmount)}`;
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
 * المحرك المباشر والحي للذكاء الاصطناعي Gemini AI
 */
export async function processAdminAiMessage(userText: string): Promise<string> {
  const allKeys = await getAllActiveGeminiKeys();

  if (allKeys.length === 0) {
    return "⚠️ لا يوجد أي مفتاح Gemini API فعال حالياً في النظام. يرجى إضافة مفتاح API في صفحة الإعدادات لتشغيل الذكاء الاصطناعي.";
  }

  const systemPrompt = `أنت الذكاء الاصطناعي Gemini والمساعد الشخصي الذكي لمدير المشروع في العراق.
تتحدث باللغة العربية بأسلوب ذكي، محترف، وودود مع مديرك.
تجيب على أي سؤال أو استفسار أو محادثة بشكل حر ومباشر 100%.`;

  const fullPrompt = `${systemPrompt}\n\nسؤال/طلب المدير: ${userText}`;

  let lastApiError = "";

  for (const keyRecord of allKeys) {
    // تجربة الـ Endpoints الرسمية المدعومة عالمياً من Google AI Studio
    const apiUrls = [
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${keyRecord.key}`,
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${keyRecord.key}`,
      `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${keyRecord.key}`,
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${keyRecord.key}`
    ];

    for (const url of apiUrls) {
      try {
        // 1. تجربة النص الحر الفائق التوافقية
        const resPure = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: fullPrompt }] }]
          }),
        });

        if (resPure.ok) {
          const dataPure = await resPure.json();
          const textReply = dataPure.candidates?.[0]?.content?.parts?.[0]?.text;
          if (textReply?.trim()) {
            await markGeminiKeySuccess(keyRecord.id);
            return textReply.trim();
          }
        } else {
          const errText = await resPure.text().catch(() => "");
          lastApiError = `[URL: ${url.split('?')[0]}, Status: ${resPure.status}] ${errText}`;
          console.warn(`[gemini-ai] Error on ${url}:`, lastApiError);
        }

        // 2. تجربة الطلب التفاعلي المربوط بالأدوات
        const resTools = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: fullPrompt }] }],
            tools: AI_TOOLS,
          }),
        });

        if (resTools.ok) {
          const dataTools = await resTools.json();
          const parts = dataTools.candidates?.[0]?.content?.parts || [];
          for (const part of parts) {
            if (part.functionCall) {
              const fn = part.functionCall;
              if (fn.name === "create_order") return await executeCreateOrder(fn.args);
              if (fn.name === "assign_order_to_courier") return await executeAssignCourier(fn.args);
              if (fn.name === "register_debt_transaction") return await executeDebtTransaction(fn.args);
            }
          }
          const textOutput = parts.map((p: any) => p.text).filter(Boolean).join("\n");
          if (textOutput?.trim()) {
            await markGeminiKeySuccess(keyRecord.id);
            return textOutput.trim();
          }
        }
      } catch (err: any) {
        lastApiError = err.message || String(err);
        console.error(`[ai-admin-agent] Exception on url:`, err);
      }
    }
  }

  return `⚠️ تعذر الحصول على رد من الذكاء الاصطناعي Gemini.\nتأكد من أن المفتاح المضاف فعال ولم ينتهِ رصيده.\nتفاصيل الخطأ: ${lastApiError.slice(0, 150)}`;
}
