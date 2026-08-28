import { prisma } from "./prisma";
import { getNextActiveGeminiKey, markGeminiKeyError, markGeminiKeySuccess } from "./gemini-pool";
import { formatDinarAsAlf } from "./money-alf";
import { rankRegionsByQuery } from "./arabic-region-search";
import { Decimal } from "@prisma/client/runtime/library";
import { pushNotifyAdminsNewPendingOrder } from "./web-push-server";
import { notifyTelegramNewOrder } from "./telegram-notify";

/**
 * تعريف أدوات الذكاء الاصطناعي بالـ CamelCase الصحيح لـ Gemini REST API
 */
const AI_TOOLS = [
  {
    functionDeclarations: [
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
            deliveryPrice: { type: "NUMBER", description: "سعر التوصيل بالدينار العراقي (إن ذكر)" },
            orderNoteTime: { type: "STRING", description: "وقت التسليم المحدد من قبل الزبون (مثلاً فوري، باجر)" }
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
            orderNumber: { type: "NUMBER", description: "رقم الطلب المحدد" },
            shopQuery: { type: "STRING", description: "اسم المحل" },
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
            type: { type: "STRING", description: "نوع المعاملة: 'borrowed' أو 'paid'" },
            note: { type: "STRING", description: "ملاحظات وتفاصيل المعاملة" }
          },
          required: ["personQuery", "amount", "type"]
        }
      },
      {
        name: "query_system_summary",
        description: "الاستعلام عن معلومات النظام مثل إحصائيات الطلبات، ديون، أو حالة مناديب.",
        parameters: {
          type: "OBJECT",
          properties: {
            target: { type: "STRING", description: "هدف الاستعلام: 'orders', 'couriers', 'debts'" },
            searchQuery: { type: "STRING", description: "بحث مخصص" }
          },
          required: ["target"]
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

  return `✅ **تم إضافة الطلب بنجاح!**\n- **رقم الطلب:** #${order.orderNumber}\n- **المحل:** ${shop.name}\n- **المنطقة:** ${region?.name || regionQuery}\n- **الهاتف:** ${customerPhone}\n- **المبلغ الإجمالي:** ${formatDinarAsAlf(totalAmount)}`;
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

async function executeDebtTransaction(args: any) {
  const { personQuery, amount, type, note } = args;

  const courier = await prisma.courier.findFirst({ where: { name: { contains: personQuery, mode: "insensitive" } } });
  const preparer = !courier ? await prisma.companyPreparer.findFirst({ where: { name: { contains: personQuery, mode: "insensitive" } } }) : null;

  const targetName = courier?.name || preparer?.name || personQuery;
  const isBorrowed = type === "borrowed";

  return `✅ **تم تسجيل المعاملة المالية بنجاح!**\n- **الطرف:** ${targetName}\n- **المبلغ:** ${formatDinarAsAlf(amount)}\n- **النوع:** ${isBorrowed ? "دين على الحساب" : "دفع / تسديد"}\n- **التفاصيل:** ${note || "لا يوجد"}`;
}

async function executeQuerySystemSummary(args: any) {
  const { target } = args;

  if (target === "orders") {
    const count = await prisma.order.count({ where: { status: "pending" } });
    return `📊 **حالة الطلبات:**\nعدد الطلبات المعلقة حالياً هو **${count}** طلب.`;
  } else if (target === "couriers") {
    const couriers = await prisma.courier.findMany({ select: { name: true, phone: true, blocked: true }, take: 10 });
    const list = couriers.map(c => `• ${c.name} (${c.phone}) - ${c.blocked ? "محظور" : "نشط"}`).join("\n");
    return `🛵 **قائمة المناديب:**\n${list}`;
  }

  return "ℹ️ استعلام عام من الذكاء الاصطناعي.";
}

/**
 * المحرك المباشر للذكاء الاصطناعي Gemini AI
 */
export async function processAdminAiMessage(userText: string): Promise<string> {
  let keyRecord = await getNextActiveGeminiKey();
  if (!keyRecord) {
    return "⚠️ لا يوجد مفتاح Gemini API فعال حالياً. يرجى إضافة المفاتيح في صفحة الإعدادات لتفعيل الذكاء الاصطناعي.";
  }

  const systemInstructionText = `أنت الذكاء الاصطناعي حقيقي والمساعد الذكي الخص بنظام الإدارة والتوصيل لدى مدير المشروع في العراق.
تتحدث باللغة العربية البسيطة مع المدير، وتجيب عن أسئلته وتتجاوب معه بتفاعل طبيعي وذكي جداً وبدون استخدام جمل ثنائية جامدة إطلاقاً.
إذا طلب منك المدير إنشاء طلب جديد بدون تزويدك بالبيانات، اسأله عن التفاصيل فوراً (اسم المحل، رقم الهاتف، المنطقة، والسعر).
إذا زودك بالتفاصيل، استخدم الأداة create_order لتنفيذ الطلب.
تجاوب بشكل حي ومباشر مع أي سؤال أو استفسار أو دردشة من المدير.`;

  // 1. المحاولة الأولى: استخدام الأدوية مع Gemini
  const bodyWithTools = {
    systemInstruction: { parts: [{ text: systemInstructionText }] },
    contents: [{ role: "user", parts: [{ text: userText }] }],
    tools: AI_TOOLS,
  };

  // 2. محاولة السحب بدون أدوية (المحادثة الحرة) لتجنب أية أخطاء في المخطط
  const bodyPureText = {
    systemInstruction: { parts: [{ text: systemInstructionText }] },
    contents: [{ role: "user", parts: [{ text: userText }] }],
  };

  const models = ["gemini-1.5-flash", "gemini-2.0-flash", "gemini-1.5-pro", "gemini-pro"];

  for (const model of models) {
    try {
      let response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${keyRecord.key}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(bodyWithTools),
        }
      );

      // في حال وجود خطأ في المخطط أو الأدوات 400 Bad Request، نجرب إرسال الطلب كمحادثة ذكاء اصطناعي مباشرة بدون أدوات
      if (!response.ok && response.status === 400) {
        console.warn(`[gemini-ai] Tools schema error on model ${model}, retrying without tools...`);
        response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${keyRecord.key}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(bodyPureText),
          }
        );
      }

      if (!response.ok) {
        if (response.status === 429) {
          await markGeminiKeyError(keyRecord.id, true);
          keyRecord = await getNextActiveGeminiKey();
          if (!keyRecord) break;
        }
        const errJson = await response.text().catch(() => "");
        console.warn(`[gemini-ai] Model ${model} returned status ${response.status}:`, errJson);
        continue;
      }

      await markGeminiKeySuccess(keyRecord.id);
      const data = await response.json();
      const candidate = data.candidates?.[0];
      const parts = candidate?.content?.parts || [];

      for (const part of parts) {
        if (part.functionCall) {
          const fn = part.functionCall;
          console.log(`[ai-agent] Executing Function: ${fn.name}`, fn.args);

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
      console.error(`[ai-admin-agent] Exception on model ${model}:`, err);
    }
  }

  // التراجع الأخير المضمون: استدعاء حاد للنص الحر فقط من Gemini
  try {
    if (keyRecord) {
      const resp = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${keyRecord.key}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(bodyPureText),
        }
      );
      if (resp.ok) {
        const d = await resp.json();
        const output = d.candidates?.[0]?.content?.parts?.[0]?.text;
        if (output) return output;
      }
    }
  } catch (e) {}

  return "تدلل يا مديرنا! اعطيني تفاصيل الطلب: اسم المحل، رقم الهاتف، المنطقة، والسعر وسأقوم بإضافته فوراً بالنظام!";
}
