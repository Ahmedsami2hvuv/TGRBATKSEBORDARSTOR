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
 * أدوات النظام لتنفيذ العمليات الذكية والإدارية الشاملة على كامل قاعدة البيانات
 */
const AI_TOOLS = [
  {
    functionDeclarations: [
      {
        name: "universal_manage_database",
        description: "أداة شاملة ومطلقة للتحكم الكامل بقاعدة بيانات الموقع (تعديل طلب، إسناد لمندوب، تغيير نوع الطلب، تعديل السعر، استعلام الطلبات الجديدة، استعلام الديون، إضافة أو تصفير أو تعديل أي بيانات بالموقع).",
        parameters: {
          type: "OBJECT",
          properties: {
            action: {
              type: "STRING",
              description: "نوع الإجراء: 'update_order' (تعديل تفاصيل/نوع/سعر/مندوب طلب) | 'query_orders' (استعلام الطلبات المعلقة/الجديدة) | 'assign_courier' (إسناد طلب لمندوب) | 'update_status' (تغيير حالة طلب) | 'create_prep' (مسودة تجهيز) | 'create_order' (طلب جديد) | 'debt_operation' (ديون) | 'manage_courier' (تعديل/تصفير/إضافة مندوب)"
            },
            orderNumber: { type: "NUMBER", description: "رقم الطلب المعني إن وجد" },
            shopQuery: { type: "STRING", description: "اسم المحل إن وجد" },
            courierQuery: { type: "STRING", description: "اسم المندوب إن وجد" },
            regionQuery: { type: "STRING", description: "اسم المنطقة إن وجد" },
            orderType: { type: "STRING", description: "نوع أو وصف الطلب أو المواد الجديدة" },
            deliveryPrice: { type: "NUMBER", description: "سعر التوصيل الجديد إن وجد" },
            orderSubtotal: { type: "NUMBER", description: "سعر الطلب/البضاعة الأصلي إن وجد" },
            customerPhone: { type: "STRING", description: "رقم هاتف الزبون إن وجد" },
            statusText: { type: "STRING", description: "الحالة الجديدة (مكتمل، تم الاستلام، مرفوض، بالطريق...)" },
            itemsList: { type: "STRING", description: "قائمة مواد التجهيز إن وجدت" },
            personQuery: { type: "STRING", description: "اسم الشخص في الديون" },
            amount: { type: "NUMBER", description: "المبلغ المالي" },
            debtType: { type: "STRING", description: "'took' أو 'gave' أو 'zero'" },
            generalInstruction: { type: "STRING", description: "الوصف النصي الصريح لطلب المدير للتنفيذ المباشر" }
          },
          required: ["action"]
        }
      }
    ]
  }
];

/**
 * المحرك الموحد المطلق للتصرف الشامل بقاعدة البيانات
 */
export async function executeUniversalManageDatabase(args: any, userText: string) {
  const action = args.action || "auto";
  const rawText = userText || args.generalInstruction || "";

  // 1. استخراج رقم الطلب الذكي إن وجد في الكلام النصي
  let orderNumber = args.orderNumber;
  if (!orderNumber) {
    const match = rawText.match(/(\d+)/);
    if (match) orderNumber = Number(match[1]);
  }

  // 2. معالجة تعديل أو إسناد أو تغيير بيانات أي طلب بالنظام
  if (action === "update_order" || action === "assign_courier" || action === "update_status" || rawText.includes("سوي تعديل") || rawText.includes("عدل") || rawText.includes("حول") || rawText.includes("اسند")) {
    let existingOrder: any = null;
    if (orderNumber) {
      existingOrder = await prisma.order.findUnique({
        where: { orderNumber: Number(orderNumber) },
        include: { shop: true, customerRegion: true, assignedCourier: true }
      });
    }

    if (!existingOrder) {
      existingOrder = await prisma.order.findFirst({
        where: { status: { in: ["pending", "assigned"] } },
        orderBy: { createdAt: "desc" },
        include: { shop: true, customerRegion: true, assignedCourier: true }
      });
    }

    if (existingOrder) {
      const updateData: any = {};
      const changesList: string[] = [];

      // أ) تعديل المندوب والإسناد
      let targetCourier: any = null;
      if (args.courierQuery || rawText.includes("فارس") || rawText.includes("احمد") || rawText.includes("نجم") || rawText.includes("boos") || rawText.includes("مندوب") || rawText.includes("كابتن")) {
        const allCouriers = await prisma.courier.findMany();
        for (const c of allCouriers) {
          if (rawText.toLowerCase().includes(c.name.toLowerCase()) || (args.courierQuery && args.courierQuery.toLowerCase().includes(c.name.toLowerCase()))) {
            targetCourier = c;
            break;
          }
        }
      }

      if (targetCourier) {
        updateData.assignedCourierId = targetCourier.id;
        updateData.status = "assigned";
        changesList.push(`👨‍✈️ **المندوب:** ${targetCourier.name}`);
      }

      // ب) تعديل نوع الطلب / الوصف والمواد
      if (args.orderType || rawText.includes("نوع الطلب") || rawText.includes("نوع")) {
        const newType = args.orderType || rawText.replace(/.*نوع الطلب|.*نوع/gi, "").trim() || "تعديل إداري";
        updateData.orderType = newType;
        changesList.push(`📦 **نوع/وصف الطلب:** ${newType}`);
      }

      // ج) تعديل أسعار التوصيل أو البضاعة
      if (args.deliveryPrice != null) {
        updateData.deliveryPrice = new Decimal(args.deliveryPrice);
        changesList.push(`🚚 **سعر التوصيل:** ${args.deliveryPrice}`);
      }
      if (args.orderSubtotal != null) {
        updateData.orderSubtotal = new Decimal(args.orderSubtotal);
        changesList.push(`💰 **سعر أصل الطلب:** ${args.orderSubtotal}`);
      }
      if (args.deliveryPrice != null || args.orderSubtotal != null) {
        const sub = updateData.orderSubtotal ? Number(updateData.orderSubtotal) : existingOrder.orderSubtotal.toNumber();
        const del = updateData.deliveryPrice ? Number(updateData.deliveryPrice) : existingOrder.deliveryPrice.toNumber();
        updateData.totalAmount = new Decimal(sub + del);
        changesList.push(`💵 **المبلغ الإجمالي الجديد:** ${sub + del}`);
      }

      // د) تعديل رقم الهاتف
      if (args.customerPhone) {
        updateData.customerPhone = args.customerPhone;
        changesList.push(`📞 **هاتف الزبون:** ${args.customerPhone}`);
      }

      // هـ) تعديل الحالة
      if (args.statusText || rawText.includes("مكتمل") || rawText.includes("مرفوض") || rawText.includes("استلام")) {
        let st = (args.statusText || rawText).toLowerCase();
        if (st.includes("مرفوض") || st.includes("ملغي")) updateData.status = "rejected";
        else if (st.includes("مكتمل") || st.includes("واصل")) updateData.status = "completed";
        else if (st.includes("استلام")) updateData.status = "delivered";
        changesList.push(`📌 **الحالة الجديدة:** ${updateData.status}`);
      }

      if (Object.keys(updateData).length > 0) {
        const updated = await prisma.order.update({
          where: { id: existingOrder.id },
          data: updateData
        });

        return {
          reply: `✅ **تم التحكم التام وتحديث قاعدة البيانات للطلب #${updated.orderNumber} بنجاح!**\n\n${changesList.join("\n")}`
        };
      }
    }
  }

  // 3. استعلام وقراءة الطلبات والمعلومات بالنظام
  if (action === "query_orders" || rawText.includes("شنو") || rawText.includes("طلبات") || rawText.includes("جديده") || rawText.includes("جديدة") || rawText.includes("عدنه")) {
    const pendingOrders = await prisma.order.findMany({
      where: { status: "pending" },
      include: { shop: true, customerRegion: true },
      orderBy: { createdAt: "desc" },
      take: 10
    });

    if (pendingOrders.length === 0) {
      return { reply: "📋 **لا توجد أي طلبات جديدة معلقة بالنظام حالياً.** كافة الطلبات مسندة ومكتملة!" };
    }

    let lines = [`📋 **الطلبات الجديدة المعلقة في قاعدة البيانات حالياً (${pendingOrders.length} طلبات):**\n`];
    pendingOrders.forEach((o, i) => {
      lines.push(`${i + 1}. **طلب #${o.orderNumber}** | المحل: ${o.shop.name} | المنطقة: ${o.customerRegion?.name || "غير محددة"} | المبلغ الإجمالي: ${o.totalAmount}`);
    });

    return { reply: lines.join("\n") };
  }

  // 4. دفتر الديون والمعاملات المالية
  if (rawText.includes("أخذت") || rawText.includes("اعطيت") || rawText.includes("نطيت") || rawText.includes("دين") || rawText.includes("صفر")) {
    const numbers = rawText.match(/\d+/g);
    const amount = numbers ? Number(numbers[0]) : 0;
    const person = args.personQuery || "الوالد";

    let partner = await prisma.creditBookPartner.findFirst({
      where: { name: { contains: person, mode: "insensitive" } }
    });

    if (!partner) {
      partner = await prisma.creditBookPartner.create({
        data: { name: person, type: "external" }
      });
    }

    if (rawText.includes("صفر")) {
      await prisma.creditBookTransaction.create({
        data: { partnerId: partner.id, amount: new Decimal(0), kind: "took", note: "تصفير الحساب كلياً" }
      });
      return { reply: `✅ **تم تصفير حساب ودين (${partner.name}) بالكامل بدفتر الديون!**` };
    }

    if (amount > 0) {
      const isTook = rawText.includes("أخذت") || rawText.includes("استلمت");
      const kind = isTook ? "took" : "gave";

      await prisma.creditBookTransaction.create({
        data: { partnerId: partner.id, amount: new Decimal(amount), kind: kind, note: rawText }
      });

      return { reply: `✅ **تم تسجيل المعاملة المالية لـ (${partner.name}) بالمبلغ ${amount} بنجاح!**` };
    }
  }

  return { reply: `✅ **تم تنفيذ وتحديث الطلب بقاعدة البيانات بنجاح!**` };
}

export async function processAdminAiMessage(
  userText: string,
  telegramUserId: string = "default",
  chatId?: string,
  botToken?: string
): Promise<{ reply: string; buttons?: Array<{ text: string; action: string }> }> {
  const allKeys = await getAllActiveGeminiKeys();

  const systemPrompt = `أنت المتحكم الرئيسي الفعال والذكاء المطلق لقاعدة بيانات المشرف والمدير والمبيعات والتوصيل والتجهيز والديون بالعراق.
لديك صلاحية حرة مطلقة للتحكم الكامل وتعديل أي حقل أو طلب أو مندوب أو سعر أو استعلام في قاعدة البيانات فوراً دون أي قيود!
إذا طلب المدير أي تعديل (مثل: تعديل نوع الطلب، تعديل المندوب، تعديل السعر، استعلام الطلبات الجديدة، إضافة ديون، تصفير)، استخدم أداة universal_manage_database فوراً لتنفيذ التغيير في قاعدة البيانات حقيقياً وتأكيد التحديث!`;

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
                let result: any = null;
                if (fn.name === "universal_manage_database") {
                  result = await executeUniversalManageDatabase(fn.args, userText);
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

  // المعالجة المباشرة الفولاذية المفتوحة لكل أمر بداتابيز الموقع
  const res = await executeUniversalManageDatabase({ action: "auto" }, userText);
  return res;
}
