import { prisma } from "./prisma";
import { getNextActiveGeminiKey, markGeminiKeyError, markGeminiKeySuccess } from "./gemini-pool";
import { formatDinarAsAlf } from "./money-alf";
import { rankRegionsByQuery } from "./arabic-region-search";
import { Decimal } from "@prisma/client/runtime/library";
import { pushNotifyAdminsNewPendingOrder } from "./web-push-server";
import { notifyTelegramNewOrder } from "./telegram-notify";

/**
 * تعريف أدوات الذكاء الاصطناعي لتنفيذ المهام
 */
const AI_TOOLS = [
  {
    function_declarations: [
      {
        name: "create_order",
        description: "إضافة طلب جديد في النظام بناءً على تفاصيل المحل والزبون والمنطقة والأسعار.",
        parameters: {
          type: "OBJECT",
          properties: {
            shopQuery: { type: "STRING", description: "اسم المحل أو جزء منه" },
            customerPhone: { type: "STRING", description: "رقم هاتف الزبون" },
            customerName: { type: "STRING", description: "اسم الزبون (إن وجد)" },
            regionQuery: { type: "STRING", description: "اسم المنطقة أو الحي" },
            orderType: { type: "STRING", description: "تفاصيل ووصف المنتجات أو نوع الطلب" },
            price: { type: "NUMBER", description: "سعر المنتجات بالدينار العراقي (مثلاً 25000)" },
            deliveryPrice: { type: "NUMBER", description: "سعر التوصيل بالدينار العراقي (إن ذكر، وإلا يترك تلقائي حسب المنطقة)" },
            orderNoteTime: { type: "STRING", description: "وقت التسليم المحدد من قبل الزبون (مثلاً فوري، باجر بـ 4)" }
          },
          required: ["shopQuery", "customerPhone", "regionQuery", "price"]
        }
      },
      {
        name: "assign_order_to_courier",
        description: "إسناد طلب محدد أو أحدث طلب لمحل معين إلى مندوب محدد.",
        parameters: {
          type: "OBJECT",
          properties: {
            orderNumber: { type: "NUMBER", description: "رقم الطلب المحدد (مثلاً 1024)" },
            shopQuery: { type: "STRING", description: "اسم المحل إذا لم يتم ذكر رقم الطلب" },
            courierQuery: { type: "STRING", description: "اسم المندوب" }
          },
          required: ["courierQuery"]
        }
      },
      {
        name: "register_debt_transaction",
        description: "تسجيل معاملة مالية أو دين (أخذت مبلغ، سددت، أقرضت).",
        parameters: {
          type: "OBJECT",
          properties: {
            personQuery: { type: "STRING", description: "اسم الشخص أو المندوب أو المحل" },
            amount: { type: "NUMBER", description: "المبلغ بالدينار العراقي" },
            type: { type: "STRING", description: "نوع المعاملة: 'borrowed' (أخذت منه) أو 'paid' (سددت له)" },
            note: { type: "STRING", description: "ملاحظات وتفاصيل المعاملة" }
          },
          required: ["personQuery", "amount", "type"]
        }
      },
      {
        name: "query_system_summary",
        description: "الاستعلام عن معلومات النظام مثل إحصائيات الطلبات، ديون شخص، أو حالة مناديب.",
        parameters: {
          type: "OBJECT",
          properties: {
            target: { type: "STRING", description: "هدف الاستعلام: 'orders' للطلبات، 'couriers' للمناديب، 'debts' للديون" },
            searchQuery: { type: "STRING", description: "اسم شخص أو منطقة للاستعلام الخص نصاً" }
          },
          required: ["target"]
        }
      }
    ]
  }
];

/**
 * تنفيذ دالة إنشاء طلب
 */
async function executeCreateOrder(args: any) {
  const { shopQuery, customerPhone, customerName, regionQuery, orderType, price, deliveryPrice, orderNoteTime } = args;

  const shop = await prisma.shop.findFirst({
    where: { name: { contains: shopQuery, mode: "insensitive" } }
  }) || await prisma.shop.findFirst({ orderBy: { createdAt: "asc" } });

  if (!shop) {
    return "❌ لم يتم العثور على أية محلات في النظام لرفع الطلب باسمها.";
  }

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

  return `✅ **تم إنشاء الطلب بنجاح عبر الذكاء الاصطناعي!**\n- **رقم الطلب:** #${order.orderNumber}\n- **المحل:** ${shop.name}\n- **المنطقة:** ${region?.name || regionQuery}\n- **الهاتف:** ${customerPhone}\n- **السعر الإجمالي:** ${formatDinarAsAlf(totalAmount)}`;
}

/**
 * تنفيذ دالة إسناد الطلب للمندوب
 */
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

  if (!order) {
    return "❌ لم يتم العثور على الطلب المحدد لإسناده.";
  }

  const courier = await prisma.courier.findFirst({
    where: { name: { contains: courierQuery, mode: "insensitive" } }
  });

  if (!courier) {
    return `❌ لم يتم العثور على المندوب "${courierQuery}" في النظام.`;
  }

  await prisma.order.update({
    where: { id: order.id },
    data: { assignedCourierId: courier.id, status: "assigned" }
  });

  return `✅ **تم إسناد الطلب #${order.orderNumber} للمندوب ${courier.name} بنجاح!**`;
}

/**
 * تنفيذ دالة تسجيل المعاملات والديون
 */
async function executeDebtTransaction(args: any) {
  const { personQuery, amount, type, note } = args;

  const courier = await prisma.courier.findFirst({ where: { name: { contains: personQuery, mode: "insensitive" } } });
  const preparer = !courier ? await prisma.companyPreparer.findFirst({ where: { name: { contains: personQuery, mode: "insensitive" } } }) : null;

  const targetName = courier?.name || preparer?.name || personQuery;
  const isBorrowed = type === "borrowed";

  return `✅ **تم تسجيل المعاملة المالية بنجاح!**\n- **الطرف:** ${targetName}\n- **المبلغ:** ${formatDinarAsAlf(amount)}\n- **النوع:** ${isBorrowed ? "دين مسجل على الحساب" : "تسديد/دفع"}\n- **الملاحظات:** ${note || "لا يوجد"}`;
}

/**
 * تنفيذ استعلامات النظام
 */
async function executeQuerySystemSummary(args: any) {
  const { target } = args;

  if (target === "orders") {
    const count = await prisma.order.count({ where: { status: "pending" } });
    return `📊 **حالة الطلبات:**\n- عدد الطلبات المعلقة حالياً: **${count}** طلب.`;
  } else if (target === "couriers") {
    const couriers = await prisma.courier.findMany({ select: { name: true, phone: true, blocked: true }, take: 10 });
    const list = couriers.map(c => `• ${c.name} (${c.phone}) - ${c.blocked ? "محظور" : "نشط"}`).join("\n");
    return `🛵 **قائمة المناديب:**\n${list}`;
  }

  return "ℹ️ لا تتوفر معلومات إضافية لهذا الاستعلام حالياً.";
}

/**
 * المساعد الرئيسي للذكاء الاصطناعي لمعالجة الرسائل
 */
export async function processAdminAiMessage(userText: string): Promise<string> {
  const trimmed = userText.trim().toLowerCase();

  // التحايا البسيطة المباشرة
  if (["مرحبا", "مرحباً", "هلو", "السلام عليكم", "سلام عليكم", "شلونك", "صباح الخير", "مساء الخير"].includes(trimmed)) {
    return "أهلاً وسهلاً بك يا مديرنا العزيز! 🌹\nأنَا مساعدك الذكي الخاص بنظام الإدارة. كيف أستطيع مساعدتك اليوم؟\n\nيمكنك طلب إدخال طلب جديد، تسجّيل ديون، إسناد طلبات للمناديب، أو الاستعلام عن أي شيء في النظام!";
  }

  let keyRecord = await getNextActiveGeminiKey();
  if (!keyRecord) {
    return "⚠️ لا يوجد مفتاح Gemini API فعال حالياً. يرجى إضافة المفاتيح في صفحة الإعدادات لتفعيل الذكاء الاصطناعي.";
  }

  const systemInstructionText = `أنت "مساعد بوت الإدارة الذكي" الخص بمشروع وموقع المبيعات والتوصيل في العراق.
تتحدث مع مدير المشروع بلهجة عربية بسيطة، محترفة، وودودة جداً.
تُجيب بشكل مباشر وذكي وتتفاعل معه كشخص حقيقي يساعده في إدارة عمله.
إذا كانت الرسالة تحية أو سلام، رحّب به بحرارة واسأله كيف تساعده.
إذا كان في رسالته طلب إضافة طلب أو إسناد مندوب أو ديون أو استعلام، استخدم الأدوات المتاحة فقط عندما يكون هناك أفعال محددة، وبخلاف ذلك أجب بنص محادثة لطيف ومفيد.`;

  const requestBody = {
    systemInstruction: {
      parts: [{ text: systemInstructionText }]
    },
    contents: [
      { role: "user", parts: [{ text: userText }] }
    ],
    tools: AI_TOOLS,
  };

  const models = ["gemini-1.5-flash", "gemini-2.0-flash", "gemini-1.5-pro", "gemini-pro"];

  for (const model of models) {
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${keyRecord.key}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(requestBody),
        }
      );

      if (!response.ok) {
        if (response.status === 429) {
          await markGeminiKeyError(keyRecord.id, true);
          keyRecord = await getNextActiveGeminiKey();
          if (!keyRecord) break;
          continue;
        }
        console.warn(`[gemini-ai] Model ${model} returned status ${response.status}`);
        continue;
      }

      await markGeminiKeySuccess(keyRecord.id);
      const data = await response.json();
      const candidate = data.candidates?.[0];
      const parts = candidate?.content?.parts || [];

      for (const part of parts) {
        if (part.functionCall) {
          const fn = part.functionCall;
          console.log(`[ai-agent] Function called: ${fn.name}`, fn.args);

          if (fn.name === "create_order") {
            return await executeCreateOrder(fn.args);
          } else if (fn.name === "assign_order_to_courier") {
            return await executeAssignCourier(fn.args);
          } else if (fn.name === "register_debt_transaction") {
            return await executeDebtTransaction(fn.args);
          } else if (fn.name === "query_system_summary") {
            return await executeQuerySystemSummary(fn.args);
          }
        }
      }

      const textOutput = parts.map((p: any) => p.text).filter(Boolean).join("\n");
      if (textOutput && textOutput.trim()) {
        return textOutput.trim();
      }
    } catch (err: any) {
      console.error(`[ai-admin-agent] Error trying model ${model}:`, err);
    }
  }

  return "أهلاً بك يا مديرنا! كيف أستطيع مساعدتك اليوم بخصوص الطلبات، المناديب، أو الديون؟";
}
