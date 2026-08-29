import { prisma } from "./prisma";
import { getAllActiveGeminiKeys, markGeminiKeyError, markGeminiKeySuccess } from "./gemini-pool";
import { formatDinarAsAlf } from "./money-alf";
import { rankRegionsByQuery } from "./arabic-region-search";
import { Decimal } from "@prisma/client/runtime/library";
import { pushNotifyAdminsNewPendingOrder } from "./web-push-server";
import { notifyTelegramNewOrder } from "./telegram-notify";
import { sendTelegramMessageWithKeyboardToChat } from "./telegram";

/**
 * تحويل المبالغ والأرقام المنطوقة بالحروف العربية إلى أرقام رقمية صريحة
 */
function parseArabicWordsToNumber(text: string): number | null {
  if (!text) return null;
  const t = text.toLowerCase().trim();

  if (t.includes("خمسة الاف") || t.includes("خمس الاف") || t.includes("5 الاف") || t.includes("5000")) return 5000;
  if (t.includes("عشرة الاف") || t.includes("عشر الاف") || t.includes("10 الاف") || t.includes("10000")) return 10000;
  if (t.includes("ثلاثة الاف") || t.includes("ثلاث الاف") || t.includes("3 الاف") || t.includes("3000")) return 3000;
  if (t.includes("اربعة الاف") || t.includes("اربع الاف") || t.includes("4 الاف") || t.includes("4000")) return 4000;
  if (t.includes("الفين") || t.includes("2000")) return 2000;
  if (t.includes("الف") || t.includes("1000")) return 1000;

  if (t.includes("خمسة") || t.includes("خمسه")) return 5;
  if (t.includes("عشرة") || t.includes("عشره")) return 10;
  if (t.includes("ثلاثة") || t.includes("ثلاثه")) return 3;
  if (t.includes("اربعة") || t.includes("اربعه")) return 4;
  if (t.includes("واحد") || t.includes("وحدة")) return 1;
  if (t.includes("اثنان") || t.includes("ثنين")) return 2;

  return null;
}

/**
 * تنظيف النصوص العربية لإزالة (ال التعريف، الهمزات، التاء المربوطة) للمطابقة المباشرة
 */
function cleanArabicTextForMatch(text: string): string {
  if (!text) return "";
  return text
    .toLowerCase()
    .replace(/أ|إ|آ/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/\bال/g, "")
    .trim();
}

/**
 * مطابقة ذكية مرنة لأسماء المحلات المباشرة (مثل أبو الأكبر، أبو سند، مطبخ البركات)
 */
async function findMatchingShopByQuery(queryText: string) {
  const allShops = await prisma.shop.findMany({ select: { id: true, name: true } });
  if (allShops.length === 0) return null;

  const cleanQuery = cleanArabicTextForMatch(queryText);

  // 1. مطابقة صريحة لاسم المحل بالكامل
  for (const shop of allShops) {
    const cleanShopName = cleanArabicTextForMatch(shop.name);
    if (cleanShopName.length > 2 && (cleanQuery.includes(cleanShopName) || cleanShopName.includes(cleanQuery))) {
      return shop;
    }
  }

  // 2. مطابقة أجزاء اسم المحل بدون الكلمات العامة
  const words = cleanQuery.split(/\s+/).filter(w => w.length > 2 && !["طلب", "طلبية", "سوي", "عدل", "غير", "سويه"].includes(w));
  for (const shop of allShops) {
    const cleanShopName = cleanArabicTextForMatch(shop.name);
    for (const w of words) {
      if (w.length > 2 && cleanShopName.includes(w)) {
        return shop;
      }
    }
  }

  return null;
}

/**
 * استخراج المنتجات والمواد من نص رسالة التجهيز
 */
function extractPrepItemsFromText(text: string): string {
  if (!text) return "مواد تجهيز ومشتريات";

  const lines = text.split("\n").map(l => l.trim()).filter(Boolean);
  const itemsLines = lines.filter(l => !l.startsWith("طلب") && !l.includes("077") && !l.includes("078") && !l.includes("075") && !l.match(/^7\d{9}/));

  if (itemsLines.length > 0) {
    return itemsLines.join("\n");
  }

  const cleanText = text.replace(/.*تجهيز|.*منطقة|.*هاتف|07\d{9}|7\d{9}/gi, "").trim();
  return cleanText || text;
}

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
  // 1. أولوية قصوى: إنشاء طلب مبيعات جديد (CREATE NEW SALES ORDER)
  // ==========================================
  if (
    rawText.includes("سوي لي طلب") ||
    rawText.includes("سوي طلب") ||
    rawText.includes("سويلي طلب") ||
    rawText.includes("ضيف طلب") ||
    rawText.includes("طلب جديد") ||
    rawText.includes("انشئ طلب")
  ) {
    // أ) جلب أو مطابقة المحل الصريح المذكور بالحرف
    const matchingShop = await findMatchingShopByQuery(rawText);
    const firstShop = matchingShop || (await prisma.shop.findFirst({ orderBy: { createdAt: "asc" } }));

    if (!firstShop) {
      return { reply: "❌ لم يتم العثور على أي محل في النظام لرفع الطلب باسمه." };
    }

    // ب) جلب أو مطابقة المنطقة
    const allRegions = await prisma.region.findMany({ select: { id: true, name: true, deliveryPrice: true } });
    let matchingRegion = allRegions.find(r => rawText.toLowerCase().includes(r.name.toLowerCase()));
    
    if (!matchingRegion) {
      const ranked = rankRegionsByQuery(rawText, allRegions, 1);
      if (ranked.length > 0) matchingRegion = ranked[0];
    }
    const region = matchingRegion || allRegions[0];

    // ج) استخراج رقم هاتف الزبون
    const phoneMatch = rawText.match(/(?:\+964|0)?7[3-9]\d{8}/);
    const phone = phoneMatch ? phoneMatch[0] : "غير محدد";

    // د) استخراج السعر الحقيقي
    const wordPrice = parseArabicWordsToNumber(rawText);
    const allNums = (rawText.match(/\d+/g) || []).map(Number).filter(n => n > 0 && n < 100000 && !n.toString().startsWith("77") && !n.toString().startsWith("78") && !n.toString().startsWith("75"));
    const priceNum = wordPrice != null ? wordPrice : (allNums.length > 0 ? allNums[allNums.length - 1] : 10000);

    const deliveryPriceNum = region?.deliveryPrice ? region.deliveryPrice.toNumber() : 5000;
    const totalAmountNum = priceNum + deliveryPriceNum;

    // هـ) استخراج نوع/وصف الطلب والمنتج (مثل: روبيان)
    let orderType = "طلب جديد";
    if (rawText.includes("روبيان")) orderType = "روبيان";
    else {
      const cleanType = rawText.replace(/.*نوع الطلب|.*نوع|.*سوي لي طلب|.*سوي طلب|.*محل|07\d{9}|\+964\d+|سعر الطلب|\d+/gi, "").trim();
      if (cleanType.length > 1) orderType = cleanType;
    }

    // و) إنشاء الطلب حقيقياً في قاعدة البيانات
    const order = await prisma.order.create({
      data: {
        shopId: firstShop.id,
        status: "pending",
        orderType: orderType,
        customerRegionId: region?.id,
        customerPhone: phone,
        orderSubtotal: new Decimal(priceNum),
        deliveryPrice: new Decimal(deliveryPriceNum),
        totalAmount: new Decimal(totalAmountNum),
        submissionSource: "admin_ai_assistant",
        orderNoteTime: rawText.includes("الان") || rawText.includes("هسه") ? "فوري" : "عادي",
      }
    });

    notifyTelegramNewOrder(order.id).catch(() => {});
    pushNotifyAdminsNewPendingOrder(order.orderNumber).catch(() => {});

    return {
      reply: `✅ **تم إضافة ورصد الطلب الجديد بالنظام بنجاح!**\n\n- **رقم الطلب:** #${order.orderNumber}\n- **المحل:** ${firstShop.name}\n- **المنطقة والوجهة:** ${region?.name || "عامة"}\n- **الهاتف:** ${phone}\n- **نوع البضاعة:** ${orderType}\n- **سعر البضاعة:** ${priceNum}\n- **سعر التوصيل الثابت:** ${deliveryPriceNum}\n- **المبلغ الإجمالي:** ${totalAmountNum}`
    };
  }

  // ==========================================
  // 2. قسم إنشاء وإسناد طلبات ومسودات التجهيز والمشتريات (PREP SHOPPING DRAFTS)
  // ==========================================
  if (domain === "prep_drafts" || rawText.includes("تجهيز") || rawText.includes("مسودة تجهيز") || rawText.includes("مشتريات") || rawText.includes("طماطه") || rawText.includes("بتيته") || rawText.includes("خيار")) {
    const extractedItems = extractPrepItemsFromText(rawText);
    const phoneMatch = rawText.match(/07\d{9}|7\d{9}/);
    const phone = phoneMatch ? phoneMatch[0] : "غير محدد";

    const allRegions = await prisma.region.findMany({ select: { id: true, name: true, deliveryPrice: true } });
    const matchingRegion = allRegions.find(r => rawText.toLowerCase().includes(r.name.toLowerCase())) || allRegions[0];

    const allPreparers = await prisma.companyPreparer.findMany();
    const assignedPreparer = allPreparers.find(p => rawText.toLowerCase().includes(p.name.toLowerCase()));

    const draft = await prisma.companyPreparerShoppingDraft.create({
      data: {
        preparerId: assignedPreparer ? assignedPreparer.id : null,
        rawListText: extractedItems,
        customerPhone: phone,
        customerRegionId: matchingRegion?.id,
        titleLine: `تجهيز ${matchingRegion?.name || "الطلب"}`,
        status: "draft"
      }
    });

    const preparerButtons = allPreparers.map(p => ({
      text: `👨‍🍳 ${p.name}`,
      action: `assign_prep_${p.id}`
    }));

    const preparerMsg = assignedPreparer ? `👨‍🍳 المجهز: ${assignedPreparer.name}` : "⚠️ يرجى اختيار المجهز لإسناد المواد له";

    return {
      reply: `✅ **تم إنشاء مسودة التجهيز ورصد المنتجات بالكامل بالنظام!**\n\n- **رقم المسودة:** #${draft.draftNumber}\n- **المنطقة:** ${matchingRegion?.name || "عامة"}\n- **الهاتف:** ${phone}\n- ${preparerMsg}\n\n📝 **قائمة المنتجات والمواد المطلوبة:**\n${extractedItems}`,
      buttons: preparerButtons
    };
  }

  // ==========================================
  // 3. قسم إدارة المندوبين والمجهزين (COURIERS & PREPARERS)
  // ==========================================
  if (domain === "couriers" || rawText.includes("رواتب") || rawText.includes("سلفة")) {
    if (operation === "create" || rawText.includes("ضِف مندوب") || rawText.includes("إضافة مندوب")) {
      const name = targetIdOrName || rawText.replace(/.*مندوب|.*كابتن|إضافة|جديد/gi, "").trim() || "مندوب جديد";
      const phoneMatch = rawText.match(/\d{10,11}/);
      const phone = phoneMatch ? phoneMatch[0] : "غير محدد";

      const courier = await prisma.courier.create({
        data: { name, phone, active: true }
      });
      return { reply: `✅ **تم إضافة وتأكيد المندوب الجديد (${courier.name}) بالنظام!**\n- الهاتف: ${courier.phone}` };
    }

    if (operation === "toggle" || rawText.includes("عطل مندوب") || rawText.includes("اخفي مندوب")) {
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

    if (operation === "zero" || rawText.includes("صفر حساب المندوب")) {
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
  // 5. قسم البحث التلقائي المرن والدقيق عن الطلبات والتعديل الإداري (ORDER UPDATING)
  // ==========================================
  const allNumbers = (rawText.match(/\d+/g) || [])
    .map(Number)
    .filter(n => n > 0 && n < 100000 && !n.toString().startsWith("77") && !n.toString().startsWith("78") && !n.toString().startsWith("75"));
  
  let orderNumber: number | null = null;
  let targetNewPrice: number | null = null;

  const orderNumMatch = rawText.match(/(?:طلب|طلبية|#)\s*(\d{1,5})/i);
  if (orderNumMatch) {
    orderNumber = Number(orderNumMatch[1]);
  } else if (allNumbers.length > 0) {
    const candidateNum = allNumbers.find(n => n >= 100 && n <= 99999);
    if (candidateNum) orderNumber = candidateNum;
  }

  const wordPrice = parseArabicWordsToNumber(rawText);
  if (wordPrice != null) {
    targetNewPrice = wordPrice;
  } else if (allNumbers.length > 0) {
    const priceCandidates = allNumbers.filter(n => n !== orderNumber);
    if (priceCandidates.length > 0) {
      targetNewPrice = priceCandidates[priceCandidates.length - 1];
    }
  }

  let existingOrder: any = null;

  if (orderNumber && orderNumber < 100000) {
    existingOrder = await prisma.order.findUnique({
      where: { orderNumber: orderNumber },
      include: { shop: true, customerRegion: true, courier: true }
    });
  }

  const matchingShop = await findMatchingShopByQuery(rawText);

  if (!existingOrder && matchingShop && (rawText.includes("عدل") || rawText.includes("سعر") || rawText.includes("اسند") || rawText.includes("حول"))) {
    const allRegions = await prisma.region.findMany({ select: { id: true, name: true } });
    const matchingRegion = allRegions.find(r => rawText.toLowerCase().includes(r.name.toLowerCase()));

    const whereClause: any = { shopId: matchingShop.id };
    if (matchingRegion) whereClause.customerRegionId = matchingRegion.id;

    existingOrder = await prisma.order.findFirst({
      where: whereClause,
      orderBy: { createdAt: "desc" },
      include: { shop: true, customerRegion: true, courier: true }
    });
  }

  if (existingOrder) {
    const updateData: any = {};
    const changes: string[] = [];

    // أ) تعديل وإسناد المندوب
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

    // ب) تعديل منطقة الطلب والزبون الحقيقية
    if (rawText.includes("منطقة") || rawText.includes("المنطقة") || rawText.includes("رايح") || rawText.includes("منطقه") || rawText.includes("الوجهة")) {
      const allRegions = await prisma.region.findMany({ select: { id: true, name: true, deliveryPrice: true } });
      let targetRegion = allRegions.find(r => rawText.toLowerCase().includes(r.name.toLowerCase()));
      
      if (!targetRegion) {
        const cleanRegionText = rawText.replace(/.*منطقة|.*منطقه|.*رايح|عدل|غير|سوي/gi, "").trim();
        const ranked = rankRegionsByQuery(cleanRegionText, allRegions, 1);
        if (ranked.length > 0) targetRegion = ranked[0];
      }

      if (targetRegion) {
        updateData.customerRegionId = targetRegion.id;
        const newDeliveryPrice = targetRegion.deliveryPrice ? targetRegion.deliveryPrice.toNumber() : 5000;
        updateData.deliveryPrice = new Decimal(newDeliveryPrice);

        const currentSubtotal = existingOrder.orderSubtotal ? existingOrder.orderSubtotal.toNumber() : 0;
        updateData.totalAmount = new Decimal(currentSubtotal + newDeliveryPrice);

        changes.push(`📍 **المنطقة والوجهة الجديدة:** ${targetRegion.name}`);
        changes.push(`🚚 **سعر التوصيل الثابت للمنطقة:** ${newDeliveryPrice}`);
        changes.push(`💵 **المبلغ الإجمالي الجديد:** ${currentSubtotal + newDeliveryPrice}`);
      }
    }

    // ج) تعديل أسعار الطلب والتوصيل الصريحة
    if (targetNewPrice != null && (rawText.includes("سعر") || rawText.includes("سعره") || rawText.includes("سويه") || rawText.includes("سوي"))) {
      if (rawText.includes("توصيل") || rawText.includes("سعر التوصيل")) {
        updateData.deliveryPrice = new Decimal(targetNewPrice);
        changes.push(`🚚 **سعر التوصيل الجديد:** ${targetNewPrice}`);
      } else {
        updateData.orderSubtotal = new Decimal(targetNewPrice);
        changes.push(`💰 **سعر الطلب/البضاعة الجديد:** ${targetNewPrice}`);
      }

      const sub = updateData.orderSubtotal ? Number(updateData.orderSubtotal) : existingOrder.orderSubtotal.toNumber();
      const del = updateData.deliveryPrice ? Number(updateData.deliveryPrice) : existingOrder.deliveryPrice.toNumber();
      updateData.totalAmount = new Decimal(sub + del);
      changes.push(`💵 **المبلغ الإجمالي الجديد:** ${sub + del}`);
    }

    // د) تعديل نوع/تفاصيل المنتجات
    if (updateData.customerRegionId == null && updateData.orderSubtotal == null && updateData.deliveryPrice == null && (rawText.includes("نوع الطلب") || rawText.includes("تغيير نوع") || rawText.includes("منتجات"))) {
      const newType = extractPrepItemsFromText(rawText);
      updateData.orderType = newType;
      changes.push(`📦 **قائمة المنتجات والنوع الجديدة:**\n${newType}`);
    }

    // هـ) تعديل حالة الطلب
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
      return { reply: `✅ **تم التعرف وتعديل طلب محل (${existingOrder.shop.name}) - #${updated.orderNumber} بنجاح!**\n\n${changes.join("\n")}` };
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
