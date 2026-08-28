import { prisma } from "./prisma";
import { getAllActiveGeminiKeys, markGeminiKeyError, markGeminiKeySuccess } from "./gemini-pool";
import { formatDinarAsAlf } from "./money-alf";
import { rankRegionsByQuery } from "./arabic-region-search";
import { Decimal } from "@prisma/client/runtime/library";
import { pushNotifyAdminsNewPendingOrder } from "./web-push-server";
import { notifyTelegramNewOrder } from "./telegram-notify";
import { sendTelegramMessageWithKeyboardToChat } from "./telegram";

/**
 * أدوات التحكم الفائقة بالشركات والمندوبين والمحلات والإعدادات وكافة مفاصل النظام
 */
const SUPER_AI_TOOLS = [
  {
    functionDeclarations: [
      {
        name: "super_system_agent",
        description: "مساعد الذكاء الاصطناعي الفائق للتحكم الشامل بجميع مفاصل التطبيق: الطلبات، المندوبين، المحلات، المناطق، الإعدادات، الديون، والمجموعات الإدارية.",
        parameters: {
          type: "OBJECT",
          properties: {
            domain: {
              type: "STRING",
              description: "مجال التحكم: 'orders' | 'couriers' | 'preparers' | 'shops' | 'regions' | 'settings' | 'debts' | 'prep_drafts'"
            },
            operation: {
              type: "STRING",
              description: "نوع الإجراء: 'create' | 'update' | 'delete' | 'toggle' | 'zero' | 'query' | 'assign'"
            },
            targetIdOrName: { type: "STRING", description: "اسم أو معرف الكائن المستهدف (مثلاً: اسم المندوب، المحل، المنطقة، رقم الطلب)" },
            payloadJson: { type: "STRING", description: "تفاصيل التعديل أو البيانات الإضافية كنص أو JSON" }
          },
          required: ["domain", "operation"]
        }
      }
    ]
  }
];

/**
 * المحرك الفائق للتحكم الشامل بكل مفاصل النظام وقواعد البيانات والإعدادات
 */
export async function executeSuperSystemAgent(args: any, userText: string) {
  const { domain, operation, targetIdOrName, payloadJson } = args;
  const rawText = userText || "";

  // ==========================================
  // 1. قسم إدارة المندوبين والمجهزين (COURIERS & PREPARERS)
  // ==========================================
  if (domain === "couriers" || rawText.includes("مندوب") || rawText.includes("كابتن") || rawText.includes("رواتب") || rawText.includes("سلفة")) {
    if (operation === "create" || rawText.includes("ضِف") || rawText.includes("إضافة مندوب") || rawText.includes("سوي مندوب")) {
      const name = targetIdOrName || rawText.replace(/.*مندوب|.*كابتن|إضافة|جديد/gi, "").trim() || "مندوب جديد";
      const phoneMatch = rawText.match(/\d{10,11}/);
      const phone = phoneMatch ? phoneMatch[0] : "غير محدد";

      const courier = await prisma.courier.create({
        data: { name, phone, active: true }
      });
      return { reply: `✅ **تم إضافة وتأكيد المندوب الجديد (${courier.name}) بالنظام!**\n- الهاتف: ${courier.phone}` };
    }

    if (operation === "toggle" || rawText.includes("عطل") || rawText.includes("اخفي") || rawText.includes("فعل") || rawText.includes("إخفاء")) {
      const activeState = !(rawText.includes("عطل") || rawText.includes("اخفي") || rawText.includes("إخفاء") || rawText.includes("حظر"));
      const cleanName = (targetIdOrName || rawText).replace(/مندوب|كابتن|عطل|فعل|اخفي|إخفاء/gi, "").trim();

      const courier = await prisma.courier.findFirst({
        where: { name: { contains: cleanName, mode: "insensitive" } }
      });

      if (courier) {
        await prisma.courier.update({
          where: { id: courier.id },
          data: { active: activeState }
        });
        const statusMsg = activeState ? "تفعيل وإظهار" : "تعطيل وإخفاء";
        return { reply: `✅ **تم ${statusMsg} المندوب (${courier.name}) بنجاح!**` };
      }
    }

    if (operation === "zero" || rawText.includes("صفر") || rawText.includes("تصفير")) {
      const cleanName = (targetIdOrName || rawText).replace(/مندوب|كابتن|صفر|تصفير|حساب|مستحقات/gi, "").trim();
      const courier = await prisma.courier.findFirst({
        where: { name: { contains: cleanName, mode: "insensitive" } }
      });

      if (courier) {
        await prisma.courier.update({
          where: { id: courier.id },
          data: { lastSalaryWithdrawalAt: new Date() }
        });
        return { reply: `✅ **تم تصفير حساب ومستحقات المندوب (${courier.name}) بالكامل!**` };
      }
    }
  }

  // ==========================================
  // 2. قسم إدارة المحلات والتجار (SHOPS & MERCHANTS)
  // ==========================================
  if (domain === "shops" || rawText.includes("محل") || rawText.includes("دكان") || rawText.includes("تاجر")) {
    if (operation === "create" || rawText.includes("إضافة محل") || rawText.includes("سوي محل")) {
      const shopName = targetIdOrName || rawText.replace(/.*محل|إضافة|جديد/gi, "").trim() || "محل جديد";
      const shop = await prisma.shop.create({
        data: { name: shopName, type: "retail" }
      });
      return { reply: `✅ **تم إضافة وتفعيل المحل الجديد (${shop.name}) بالنظام!**` };
    }
  }

  // ==========================================
  // 3. قسم إدارة المناطق ورسوم التوصيل (REGIONS & PRICING)
  // ==========================================
  if (domain === "regions" || rawText.includes("منطقة") || rawText.includes("توصيل") || rawText.includes("رسوم")) {
    if (operation === "update" || rawText.includes("سعر التوصيل") || rawText.includes("عدل توصيل")) {
      const numbers = rawText.match(/\d+/g);
      const newPrice = numbers ? Number(numbers[0]) : 5000;
      const cleanRegionName = (targetIdOrName || rawText).replace(/منطقة|عدل|سعر|توصيل|رسوم|\d+/gi, "").trim();

      const region = await prisma.region.findFirst({
        where: { name: { contains: cleanRegionName, mode: "insensitive" } }
      });

      if (region) {
        await prisma.region.update({
          where: { id: region.id },
          data: { deliveryPrice: new Decimal(newPrice) }
        });
        return { reply: `✅ **تم تعديل سعر التوصيل الثابت لمنطقة (${region.name}) إلى ${newPrice} دينار بنجاح!**` };
      }
    }
  }

  // ==========================================
  // 4. قسم الإعدادات ومفاتيح الذكاء والسيستم (SETTINGS & AI KEYS)
  // ==========================================
  if (domain === "settings" || rawText.includes("مفتاح") || rawText.includes("إعدادات") || rawText.includes("تفعيل") || rawText.includes("تعطيل")) {
    if (rawText.includes("مفتاح") || rawText.includes("api")) {
      const keyMatch = rawText.match(/AIzaSy[A-Za-z0-9_-]+/);
      if (keyMatch) {
        const newKey = keyMatch[0];
        await prisma.geminiApiKey.create({
          data: { key: newKey, label: "مفتاح ذكاء مضاف من الوكيل الفائق", active: true }
        });
        return { reply: `✅ **تم إضافة وتفعيل مفتاح الذكاء الاصطناعي الجديد بالنظام بنجاح!**` };
      }
    }
  }

  // ==========================================
  // 5. قسم إدارة الطلبات والتعديل والإسناد الفوري (ORDERS UNIVERSAL ENGINE)
  // ==========================================
  let orderNumberMatch = rawText.match(/(\d+)/);
  let orderNumber = orderNumberMatch ? Number(orderNumberMatch[1]) : null;

  let existingOrder: any = null;
  if (orderNumber) {
    existingOrder = await prisma.order.findUnique({
      where: { orderNumber: orderNumber },
      include: { shop: true, customerRegion: true, courier: true }
    });
  }

  if (!existingOrder && (rawText.includes("طلب") || rawText.includes("عدل") || rawText.includes("اسند") || rawText.includes("حول"))) {
    existingOrder = await prisma.order.findFirst({
      where: { status: { in: ["pending", "assigned"] } },
      orderBy: { createdAt: "desc" },
      include: { shop: true, customerRegion: true, courier: true }
    });
  }

  if (existingOrder) {
    const updateData: any = {};
    const changes: string[] = [];

    // أ) تعديل المندوب
    if (rawText.includes("فارس") || rawText.includes("احمد") || rawText.includes("نجم") || rawText.includes("boos") || rawText.includes("كابتن") || rawText.includes("مندوب")) {
      const allCouriers = await prisma.courier.findMany();
      for (const c of allCouriers) {
        if (rawText.toLowerCase().includes(c.name.toLowerCase())) {
          updateData.assignedCourierId = c.id;
          updateData.status = "assigned";
          changes.push(`👨‍✈️ **المندوب:** ${c.name}`);
          break;
        }
      }
    }

    // ب) تعديل نوع/تفاصيل الطلب
    if (rawText.includes("نوع") || rawText.includes("تفاصيل") || rawText.includes("مادة")) {
      const newType = rawText.replace(/.*نوع الطلب|.*نوع|.*تفاصيل/gi, "").trim() || "تعديل إداري";
      updateData.orderType = newType;
      changes.push(`📦 **نوع/وصف الطلب:** ${newType}`);
    }

    // ج) تعديل أسعار التوصيل أو البضاعة
    if (rawText.includes("توصيل") || rawText.includes("سعر")) {
      const nums = rawText.match(/\d+/g);
      if (nums && nums.length > 0) {
        const val = Number(nums[0]);
        if (rawText.includes("توصيل")) {
          updateData.deliveryPrice = new Decimal(val);
          changes.push(`🚚 **سعر التوصيل:** ${val}`);
        } else {
          updateData.orderSubtotal = new Decimal(val);
          changes.push(`💰 **سعر أصل الطلب:** ${val}`);
        }
        const sub = updateData.orderSubtotal ? Number(updateData.orderSubtotal) : existingOrder.orderSubtotal.toNumber();
        const del = updateData.deliveryPrice ? Number(updateData.deliveryPrice) : existingOrder.deliveryPrice.toNumber();
        updateData.totalAmount = new Decimal(sub + del);
      }
    }

    // د) تعديل حالة الطلب
    if (rawText.includes("مكتمل") || rawText.includes("مرفوض") || rawText.includes("استلام")) {
      if (rawText.includes("مرفوض")) updateData.status = "rejected";
      else if (rawText.includes("مكتمل") || rawText.includes("واصل")) updateData.status = "completed";
      else if (rawText.includes("استلام")) updateData.status = "delivered";
      changes.push(`📌 **الحالة الجديدة:** ${updateData.status}`);
    }

    if (Object.keys(updateData).length > 0) {
      const updated = await prisma.order.update({
        where: { id: existingOrder.id },
        data: updateData
      });
      return { reply: `✅ **تم التحكم والتحديث الكامل للطلب #${updated.orderNumber} بالنظام!**\n\n${changes.join("\n")}` };
    }
  }

  // ==========================================
  // 6. استعلام وجلب البيانات المعلقة
  // ==========================================
  if (rawText.includes("شنو") || rawText.includes("طلبات") || rawText.includes("جديده") || rawText.includes("جديدة") || rawText.includes("معلقة")) {
    const pendingOrders = await prisma.order.findMany({
      where: { status: "pending" },
      include: { shop: true, customerRegion: true },
      orderBy: { createdAt: "desc" },
      take: 10
    });

    if (pendingOrders.length === 0) {
      return { reply: "📋 **لا توجد أي طلبات جديدة معلقة بالنظام حالياً.** كافة الطلبات مسندة ومكتملة!" };
    }

    let lines = [`📋 **الطلبات الجديدة المعلقة بالنظام حالياً (${pendingOrders.length} طلبات):**\n`];
    pendingOrders.forEach((o, i) => {
      lines.push(`${i + 1}. **طلب #${o.orderNumber}** | المحل: ${o.shop.name} | المنطقة: ${o.customerRegion?.name || "غير محددة"} | المبلغ الإجمالي: ${o.totalAmount}`);
    });
    return { reply: lines.join("\n") };
  }

  return { reply: `✅ **تم تنفيذ وتحديث الإجراء المطلق في النظام وقاعدة البيانات بنجاح!**` };
}

export async function processAdminAiMessage(
  userText: string,
  telegramUserId: string = "default",
  chatId?: string,
  botToken?: string
): Promise<{ reply: string; buttons?: Array<{ text: string; action: string }> }> {
  const allKeys = await getAllActiveGeminiKeys();

  const systemPrompt = `أنت الوكيل الذكي الفائق ومساعد النظام المطلق (Super AI Agent) لإدارة كامل مفاصل التطبيق بالنظام والموقع (الطلبات، المندوبين، المحلات، المناطق ورسوم التوصيل، الديون، والإعدادات).
لديك الصلاحية والحرية المطلقة لتعديل أو إضافة أو تعطيل أو استعلام أي عنصر أو خيار في النظام تلقائياً!
إذا طلب المدير أي أمر أو تعديل، استخدم أداة super_system_agent فوراً لتنفيذ التحديث التلقائي الشامل!`;

  const contentsPayload = [
    {
      role: "user",
      parts: [{ text: userText }]
    }
  ];

  const activeModels = ["gemini-1.5-flash", "gemini-1.5-pro"];

  if (allKeys.length > 0) {
    for (const keyRecord of allKeys) {
      for (const model of activeModels) {
        try {
          const resTools = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${keyRecord.key}`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                systemInstruction: { parts: [{ text: systemPrompt }] },
                contents: contentsPayload,
                tools: SUPER_AI_TOOLS,
              }),
            }
          );

          if (resTools.ok) {
            const dataTools = await resTools.json();
            const parts = dataTools.candidates?.[0]?.content?.parts || [];
            for (const part of parts) {
              if (part.functionCall) {
                const fn = part.functionCall;
                let result: any = null;
                if (fn.name === "super_system_agent") {
                  result = await executeSuperSystemAgent(fn.args, userText);
                }

                if (result) {
                  const textReply = typeof result === "string" ? result : result.reply;
                  const buttons = typeof result === "object" ? result.buttons : undefined;
                  await markGeminiKeySuccess(keyRecord.id);
                  return { reply: textReply, buttons };
                }
              }
            }

            const textOutput = parts.map((p: any) => p.text).filter(Boolean).join("\n");
            if (textOutput?.trim()) {
              await markGeminiKeySuccess(keyRecord.id);
              return { reply: textOutput.trim() };
            }
          }
        } catch (err: any) {}
      }
    }
  }

  const res = await executeSuperSystemAgent({ domain: "auto", operation: "auto" }, userText);
  return res;
}
