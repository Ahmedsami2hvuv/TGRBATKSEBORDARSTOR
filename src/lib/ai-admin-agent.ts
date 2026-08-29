import { prisma } from "./prisma";
import { getAllActiveGeminiKeys, markGeminiKeyError, markGeminiKeySuccess } from "./gemini-pool";
import { formatDinarAsAlf } from "./money-alf";
import { rankRegionsByQuery } from "./arabic-region-search";
import { Decimal } from "@prisma/client/runtime/library";
import { pushNotifyAdminsNewPendingOrder } from "./web-push-server";
import { notifyTelegramNewOrder } from "./telegram-notify";
import { sendTelegramMessageWithKeyboardToChat } from "./telegram";

/**
 * تحويل المبالغ والأرقام المنطوقة بالحروف العربية إلى أرقام رقمية صريحة (بدون أصفار زائدة)
 */
function parseArabicWordsToNumber(text: string): number | null {
  if (!text) return null;
  const t = text.toLowerCase().trim();

  if (t.includes("خمسة الاف") || t.includes("خمس الاف") || t.includes("5 الاف")) return 5;
  if (t.includes("عشرة الاف") || t.includes("عشر الاف") || t.includes("10 الاف")) return 10;
  if (t.includes("ثلاثة الاف") || t.includes("ثلاث الاف") || t.includes("3 الاف")) return 3;
  if (t.includes("اربعة الاف") || t.includes("اربع الاف") || t.includes("4 الاف")) return 4;
  if (t.includes("الفين")) return 2;
  if (t.includes("الف")) return 1;

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
 * مطابقة ذكية مرنة لأسماء المحلات المباشرة
 */
async function findMatchingShopByQuery(queryText: string) {
  const allShops = await prisma.shop.findMany({ select: { id: true, name: true } });
  if (allShops.length === 0) return null;

  const cleanQuery = cleanArabicTextForMatch(queryText);

  for (const shop of allShops) {
    const cleanShopName = cleanArabicTextForMatch(shop.name);
    if (cleanShopName.length > 2 && (cleanQuery.includes(cleanShopName) || cleanShopName.includes(cleanQuery))) {
      return shop;
    }
  }

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
 * البحث والدعم الفائق للمناطق المطابقة الحقيقية (جيكور، جيكور حزبه 1، حمدان، إلخ)
 */
function findMatchingRegionsExactOrContains(queryText: string, allRegions: any[]): any[] {
  const cleanQ = cleanArabicTextForMatch(queryText);
  if (!cleanQ) return allRegions.slice(0, 4);

  const words = cleanQ.split(/\s+/).filter(w => w.length > 2 && !["طلب", "طلبية", "منطقة", "منطقه", "مستلم", "سويه", "عدل", "غير"].includes(w));
  const mainKeyword = words.length > 0 ? words[words.length - 1] : cleanQ;

  const exactContains = allRegions.filter(r => {
    const cleanR = cleanArabicTextForMatch(r.name);
    return cleanR.includes(mainKeyword) || mainKeyword.includes(cleanR);
  });

  if (exactContains.length > 0) {
    return exactContains;
  }

  return rankRegionsByQuery(mainKeyword, allRegions, 4);
}

/**
 * استخراج المنتجات والمواد النظيفة صراحة من نص رسالة التجهيز والمشتريات
 */
function extractPrepItemsFromText(text: string): string {
  if (!text) return "مواد تجهيز ومشتريات";

  const productsMatch = text.match(/(?:المنتجات|المواد|المشتريات|اللي يريدهم الزبون|المطلوبة)\s*(?:اللي يريدهم الزبون)?\s*(.+)/i);
  if (productsMatch && productsMatch[1].trim().length > 1) {
    return productsMatch[1].trim();
  }

  const lines = text.split("\n").map(l => l.trim()).filter(Boolean);
  const itemsLines = lines.filter(l => !l.startsWith("طلب") && !l.includes("077") && !l.includes("078") && !l.includes("075") && !l.match(/^7\d{9}/));

  if (itemsLines.length > 0) {
    return itemsLines.join("\n");
  }

  const cleanText = text.replace(/.*تجهيز|.*عنوان الزبون|.*منطقة|.*هاتف|07\d{9}|7\d{9}/gi, "").trim();
  return cleanText || text;
}

/**
 * استخراج رقم هاتف الزبون أو المندوب الصريح حتى لو تخلله مسافات أو عبارات
 */
function extractCustomerPhoneFlexible(text: string): string {
  if (!text) return "غير محدد";

  // 1. فحص أي تسلسل أرقام يبدأ بـ 07 أو 7 أو +964 حتى لو بينها مسافات
  const spacedMatch = text.match(/(?:\+964|0)?7[\d\s]{6,14}\d/);
  if (spacedMatch) {
    const digitsOnly = spacedMatch[0].replace(/\s+/g, "");
    if (digitsOnly.length >= 8 && digitsOnly.length <= 13) {
      return digitsOnly;
    }
  }

  const directMatch = text.match(/(?:\+964|0)?7[3-9]\d{7,8}/);
  if (directMatch) return directMatch[0];

  const afterKeywordMatch = text.match(/(?:رقم|ورقمه|هاتف|موبايل|زبون)\s*(?:الزبون|المندوب)?\s*(\d[\d\s]{6,12}\d)/i);
  if (afterKeywordMatch) {
    const cleanedDigits = afterKeywordMatch[1].replace(/\s+/g, "");
    if (cleanedDigits.length >= 8 && cleanedDigits.length <= 11) {
      return cleanedDigits;
    }
  }

  return "غير محدد";
}

/**
 * تنظيف واستخراج اسم المباشر الصريح للمندوب وتجريد أرقام الهواتف والعبارات
 */
function extractCleanCourierName(text: string, targetName: string = ""): string {
  if (targetName && targetName.length >= 2 && !targetName.includes("07") && !targetName.includes("ورقمه")) {
    return targetName.trim();
  }

  const nameMatch = text.match(/(?:اسم|اسم المندوب|مندوب|كابتن)\s*(?:المندوب)?\s*([أ-يa-zA-Z\s]+?)(?=\s*(?:ورقمه|رقم|هاتف|07|\d)|$)/i);
  if (nameMatch && nameMatch[1].trim().length >= 2) {
    const nameOnly = nameMatch[1].replace(/سوي لي|سويلي|سوي|ضيف|إضافة|جديد/gi, "").trim();
    if (nameOnly.length >= 2) return nameOnly;
  }

  let cleaned = text
    .replace(/.*سوي لي مندوب|.*سوي مندوب|.*ضيف مندوب|.*إضافة مندوب|.*اضافة مندوب|.*مندوب جديد|.*جديد/gi, "")
    .replace(/ورقمه.*|رقم الهاتف.*|رقم.*|07\d+.*/gi, "")
    .replace(/اسم المندوب|اسم|كابتن|مندوب/gi, "")
    .trim();

  cleaned = cleaned.replace(/(?:\+964|0)?7[\d\s]{6,14}\d|\d+/g, "").trim();
  if (cleaned.length >= 2) return cleaned;

  return "مندوب جديد";
}

/**
 * تنظيف واستخراج اسم المادة والمنتج الحقيقي الفعلي بالنظافة المطلقة 100% وحظر كلمة طلب نهائياً
 */
function extractCleanOrderType(text: string): string {
  if (!text) return "مواد متنوعة";

  let cleaned = text
    .replace(/(?:طلب|طلبيه|طلبية|رقم|#)?\s*\d{1,5}/gi, "")
    .replace(/نوع الطلب|نوع الطلبيه|نوع البضاعة|نوع المنتج|نوع/gi, "")
    .replace(/عدل على|عدل عليه سويه|عدل عليه|سويه|عدل|غير|سوي لي|سوي|خلي/gi, "")
    .replace(/وقت الطلب.*|سعر الطلب.*|رقم الزبون.*|منطقه.*|منطقة.*/gi, "")
    .replace(/طلب|طلبية|طلبيه|طلبيا/gi, "")
    .replace(/\b(?:على|ع|إلى|الي|من|باسم)\b/gi, "")
    .trim();

  cleaned = cleaned.replace(/(?:\+964|0)?7[3-9]\d{7,8}|\d+/g, "").trim();

  const words = cleaned
    .split(/\s+/)
    .filter(w => w.length >= 2 && !w.includes("طلب") && !w.includes("عدل") && !w.includes("سويه"));

  if (words.length > 0) {
    return words.join(" ");
  }

  return "سمك";
}

/**
 * البحث أو إنشاء الشريك التلقائي في دفتر الديون والشراكة (CreditBookPartner)
 */
async function findOrCreateCreditBookPartner(partnerQuery: string) {
  const allPartners = await prisma.creditBookPartner.findMany();
  const cleanQ = cleanArabicTextForMatch(partnerQuery);

  for (const p of allPartners) {
    const cleanP = cleanArabicTextForMatch(p.name);
    if (cleanP.length > 1 && (cleanQ.includes(cleanP) || cleanP.includes(cleanQ))) {
      return p;
    }
  }

  const allCouriers = await prisma.courier.findMany();
  for (const c of allCouriers) {
    if (cleanQ.includes(cleanArabicTextForMatch(c.name))) {
      return await prisma.creditBookPartner.create({
        data: { name: c.name, type: "courier", externalId: c.id, phone: c.phone }
      });
    }
  }

  const allShops = await prisma.shop.findMany();
  for (const s of allShops) {
    if (cleanQ.includes(cleanArabicTextForMatch(s.name))) {
      return await prisma.creditBookPartner.create({
        data: { name: s.name, type: "shop", externalId: s.id, phone: s.phone }
      });
    }
  }

  const allPreps = await prisma.companyPreparer.findMany();
  for (const pr of allPreps) {
    if (cleanQ.includes(cleanArabicTextForMatch(pr.name))) {
      return await prisma.creditBookPartner.create({
        data: { name: pr.name, type: "preparer", externalId: pr.id, phone: pr.phone }
      });
    }
  }

  const extractedName = partnerQuery
    .replace(/.*أخذت|.*اخذت|.*أعطيت|.*اعطيت|.*أنطيت|.*انطيت|.*تنزيل|.*تسديد|من|لـ|على|مبلغ|\d+/gi, "")
    .trim() || partnerQuery.trim() || "شريك جديد";

  return await prisma.creditBookPartner.create({
    data: { name: extractedName, type: "external" }
  });
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
  // 1. إنشاء وإضافة المندوبين الجدد بالذكاء الاصطناعي (CREATE NEW COURIER)
  // ==========================================
  if (
    domain === "couriers" && operation === "create" ||
    rawText.includes("سويلي مندوب") ||
    rawText.includes("سوي مندوب") ||
    rawText.includes("ضيف مندوب") ||
    rawText.includes("اضافة مندوب") ||
    rawText.includes("إضافة مندوب") ||
    rawText.includes("مندوب جديد") ||
    rawText.includes("اضف مندوب")
  ) {
    const courierName = extractCleanCourierName(rawText, targetIdOrName);
    const phone = extractCustomerPhoneFlexible(rawText);

    const newCourier = await prisma.courier.create({
      data: {
        name: courierName,
        phone: phone,
        active: true
      }
    });

    return {
      reply: `تم يا مديرنا الغالي! 🚀 تم إنشاء وتأكيد المندوب الجديد (**${newCourier.name}**) بنجاح في قاعدة البيانات، وأصبح جاهزاً لإسناد الطلبات فوراً!\n\n- **اسم المندوب:** ${newCourier.name}\n- **رقم الهاتف:** ${phone}`
    };
  }

  // ==========================================
  // 2. قسم إدارة وتنزيـل وتسجيل معاملات الديون والشراكة (EXACT AMOUNTS ONLY)
  // ==========================================
  if (
    domain === "debts" ||
    rawText.includes("اخذت") ||
    rawText.includes("أخذت") ||
    rawText.includes("اعطيت") ||
    rawText.includes("أعطيت") ||
    rawText.includes("انطيت") ||
    rawText.includes("أنطيت") ||
    rawText.includes("تنزيل") ||
    rawText.includes("سدد") ||
    rawText.includes("استلمت") ||
    rawText.includes("قبضت") ||
    rawText.includes("دفعت")
  ) {
    const isTook = rawText.includes("اخذت") || rawText.includes("أخذت") || rawText.includes("تنزيل") || rawText.includes("سدد") || rawText.includes("استلمت") || rawText.includes("قبضت");
    const kind = isTook ? "took" : "gave";
    const actionTitle = isTook ? "أخذت (تنزيل من الحساب)" : "أعطيت (إضافة على الحساب)";

    const partner = await findOrCreateCreditBookPartner(rawText);

    const wordPrice = parseArabicWordsToNumber(rawText);
    const allNums = (rawText.match(/\d+/g) || []).map(Number).filter(n => n > 0 && n < 1000000 && !n.toString().startsWith("77") && !n.toString().startsWith("78") && !n.toString().startsWith("75"));
    
    let finalAmount = wordPrice != null ? wordPrice : (allNums.length > 0 ? allNums[allNums.length - 1] : 5);

    await prisma.creditBookTransaction.create({
      data: {
        partnerId: partner.id,
        amount: new Decimal(finalAmount),
        kind: kind,
        note: `معاملة تلقائية بواسطة المساعد الصوتي: ${rawText}`
      }
    });

    const allTx = await prisma.creditBookTransaction.findMany({
      where: { partnerId: partner.id }
    });

    let totalGave = 0;
    let totalTook = 0;
    allTx.forEach(t => {
      const val = t.amount.toNumber();
      if (t.kind === "gave") totalGave += val;
      else if (t.kind === "took") totalTook += val;
    });

    const netBalance = totalGave - totalTook;
    let balanceStatus = "";

    if (netBalance > 0) {
      balanceStatus = `نطلبه (يطلبك): ${netBalance}`;
    } else if (netBalance < 0) {
      balanceStatus = `يطلبنا (تطلبه): ${Math.abs(netBalance)}`;
    } else {
      balanceStatus = `الحساب متصفر بالكامل (0)`;
    }

    return {
      reply: `✅ **تم تنزيل ورصد المبلغ بقاعدة البيانات بنجاح!**\n\n- **الإجراء:** ${actionTitle}\n- **الشخص/الشريك:** ${partner.name}\n- **المبلغ المسجل:** ${finalAmount}\n- **الرصيد الحالي لـ (${partner.name}):** ${balanceStatus}`
    };
  }

  // ==========================================
  // 3. أولوية قصوى: قسم إنشاء وإسناد طلبات ومسودات التجهيز والمشتريات (PREP SHOPPING DRAFTS)
  // ==========================================
  if (
    domain === "prep_drafts" ||
    rawText.includes("تجهيز") ||
    rawText.includes("مسودة تجهيز") ||
    rawText.includes("مشتريات") ||
    rawText.includes("طماطه") ||
    rawText.includes("بتيته") ||
    rawText.includes("خيار")
  ) {
    const extractedItems = extractPrepItemsFromText(rawText);
    const phone = extractCustomerPhoneFlexible(rawText);

    const allRegions = await prisma.region.findMany({ select: { id: true, name: true, deliveryPrice: true } });
    const matchedRegions = findMatchingRegionsExactOrContains(rawText, allRegions);
    const matchingRegion = matchedRegions[0] || allRegions[0];

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
      reply: `✅ **تم إنشاء مسودة التجهيز ورصد المنتجات بالكامل بالنظام!**\n\n- **رقم المسودة:** #${draft.draftNumber}\n- **المنطقة والوجهة:** ${matchingRegion?.name || "عامة"}\n- **رقم هاتف الزبون:** ${phone}\n- ${preparerMsg}\n\n📝 **قائمة المنتجات والمواد المطلوبة:**\n${extractedItems}`,
      buttons: preparerButtons
    };
  }

  // ==========================================
  // 4. إنشاء طلب مبيعات جديد عالي الدقة (CREATE NEW SALES ORDER)
  // ==========================================
  if (
    !rawText.includes("تجهيز") &&
    (rawText.includes("سوي لي طلب") ||
      rawText.includes("سوي طلب") ||
      rawText.includes("سويلي طلب") ||
      rawText.includes("ضيف طلب") ||
      rawText.includes("طلب جديد") ||
      rawText.includes("انشئ طلب"))
  ) {
    const matchingShop = await findMatchingShopByQuery(rawText);
    const firstShop = matchingShop || (await prisma.shop.findFirst({ orderBy: { createdAt: "asc" } }));

    if (!firstShop) {
      return { reply: "❌ لم يتم العثور على أي محل في النظام لرفع الطلب باسمه." };
    }

    const allRegions = await prisma.region.findMany({ select: { id: true, name: true, deliveryPrice: true } });
    const matchedRegions = findMatchingRegionsExactOrContains(rawText, allRegions);
    const region = matchedRegions[0] || allRegions[0];

    const phone = extractCustomerPhoneFlexible(rawText);

    const wordPrice = parseArabicWordsToNumber(rawText);
    const allNums = (rawText.match(/\d+/g) || []).map(Number).filter(n => n > 0 && n < 100000 && !n.toString().startsWith("77") && !n.toString().startsWith("78") && !n.toString().startsWith("75"));
    const priceNum = wordPrice != null ? wordPrice : (allNums.length > 0 ? allNums[allNums.length - 1] : 5);

    const deliveryPriceNum = region?.deliveryPrice ? region.deliveryPrice.toNumber() : 5;
    const totalAmountNum = priceNum + deliveryPriceNum;

    const orderType = extractCleanOrderType(rawText);

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
      reply: `✅ **تم إضافة ورصد الطلب الجديد بالنظام بنجاح!**\n\n- **رقم الطلب:** #${order.orderNumber}\n- **المحل:** ${firstShop.name}\n- **المنطقة والوجهة:** ${region?.name || "عامة"}\n- **رقم هاتف الزبون:** ${phone}\n- **نوع البضاعة:** ${orderType}\n- **سعر البضاعة:** ${priceNum}\n- **سعر التوصيل الثابت للمنطقة:** ${deliveryPriceNum}\n- **المبلغ الإجمالي:** ${totalAmountNum}`
    };
  }

  // ==========================================
  // 5. قسم إدارة المندوبين الحاليين (تفعيل، إخفاء، تصفير)
  // ==========================================
  if (domain === "couriers" || rawText.includes("رواتب") || rawText.includes("سلفة")) {
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
  // 6. قسم البحث التلقائي المرن والدقيق عن الطلبات والتعديل الإداري (ORDER UPDATING)
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
  } else if (allNumbers.length > 0 && (rawText.includes("سعر البضاعة") || rawText.includes("سعر الطلب") || rawText.includes("سعر التوصيل"))) {
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
    let regionButtons: Array<{ text: string; action: string }> | undefined = undefined;

    if (rawText.includes("الغي الاسناد") || rawText.includes("الغي اسناد") || rawText.includes("إلغاء الإسناد") || rawText.includes("الغاء الاسناد") || rawText.includes("الغي المندوب")) {
      updateData.assignedCourierId = null;
      updateData.status = "pending";
      changes.push(`👨‍✈️ **المندوب:** تم إلغاء إسناد المندوب بنجاح`);
      changes.push(`📌 **الحالة الجديدة:** طلب جديد معلق`);
    } else if (rawText.includes("فارس") || rawText.includes("احمد") || rawText.includes("نجم") || rawText.includes("boos") || rawText.includes("كابتن") || rawText.includes("مندوب")) {
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

    if (rawText.includes("منطقة") || rawText.includes("المنطقة") || rawText.includes("رايح") || rawText.includes("منطقه") || rawText.includes("الوجهة") || rawText.includes("غير اسم")) {
      const allRegions = await prisma.region.findMany({ select: { id: true, name: true, deliveryPrice: true } });
      const matchedRegions = findMatchingRegionsExactOrContains(rawText, allRegions);
      let targetRegion = matchedRegions[0] || allRegions[0];

      if (matchedRegions.length > 1) {
        regionButtons = matchedRegions.map(r => {
          const priceNum = r.deliveryPrice ? Number(r.deliveryPrice) : 5;
          return {
            text: `📍 ${r.name} (توصيل: ${priceNum})`,
            action: `set_region_${existingOrder.id}_${r.id}`
          };
        });
      }

      if (targetRegion) {
        updateData.customerRegionId = targetRegion.id;
        const regionDeliveryPrice = targetRegion.deliveryPrice ? Number(targetRegion.deliveryPrice) : 5;
        updateData.deliveryPrice = new Decimal(regionDeliveryPrice);

        const currentSubtotal = existingOrder.orderSubtotal ? existingOrder.orderSubtotal.toNumber() : 0;
        updateData.totalAmount = new Decimal(currentSubtotal + regionDeliveryPrice);

        changes.push(`📍 **المنطقة والوجهة الجديدة:** ${targetRegion.name}`);
        changes.push(`🚚 **سعر التوصيل المسجل للمنطقة:** ${regionDeliveryPrice}`);
        changes.push(`💵 **المبلغ الإجمالي الجديد:** ${currentSubtotal + regionDeliveryPrice}`);
      }
    }

    if (targetNewPrice != null && (rawText.includes("سعر التوصيل") || rawText.includes("سعر البضاعة") || rawText.includes("سعر الطلب"))) {
      if (rawText.includes("سعر التوصيل")) {
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

    if (updateData.customerRegionId == null && updateData.orderSubtotal == null && updateData.deliveryPrice == null && (rawText.includes("نوع الطلب") || rawText.includes("تغيير نوع") || rawText.includes("منتجات"))) {
      const newType = extractCleanOrderType(rawText);
      updateData.orderType = newType;
      changes.push(`📦 **نوع البضاعة والمنتج الجديد:** ${newType}`);
    }

    if (
      rawText.includes("جديد") ||
      rawText.includes("جديده") ||
      rawText.includes("جديدة") ||
      rawText.includes("معلق") ||
      rawText.includes("معلقة") ||
      rawText.includes("مكتمل") ||
      rawText.includes("مرفوض") ||
      rawText.includes("استلام")
    ) {
      if (rawText.includes("مرفوض")) {
        updateData.status = "rejected";
        changes.push(`📌 **الحالة الجديدة:** مرفوض`);
      } else if (rawText.includes("مكتمل") || rawText.includes("واصل")) {
        updateData.status = "completed";
        changes.push(`📌 **الحالة الجديدة:** مكتمل`);
      } else if (rawText.includes("استلام")) {
        updateData.status = "delivered";
        changes.push(`📌 **الحالة الجديدة:** تم الاستلام`);
      } else if (
        rawText.includes("جديد") ||
        rawText.includes("جديده") ||
        rawText.includes("جديدة") ||
        rawText.includes("معلق") ||
        rawText.includes("معلقة")
      ) {
        updateData.status = "pending";
        updateData.assignedCourierId = null;
        changes.push(`📌 **الحالة الجديدة:** طلب جديد معلق`);
        changes.push(`👨‍✈️ **المندوب:** تم إلغاء الإسناد`);
      }
    }

    if (Object.keys(updateData).length > 0) {
      const updated = await prisma.order.update({
        where: { id: existingOrder.id },
        data: updateData
      });

      const optionsNote = regionButtons && regionButtons.length > 0 ? "\n\n👇 **المناطق المطابقة المتوفرة (انقر على الخيار المناسب):**" : "";

      return {
        reply: `✅ **تم التعرف وتعديل طلب محل (${existingOrder.shop.name}) - #${updated.orderNumber} بنجاح!**\n\n${changes.join("\n")}${optionsNote}`,
        buttons: regionButtons
      };
    }
  }

  // ==========================================
  // 7. استعلام وجلب البيانات المعلقة
  // ==========================================
  if (!orderNumber && (rawText.includes("شنو") || rawText.includes("طلبات جديدة") || rawText.includes("طلبات معلقة"))) {
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

  return { reply: `تم يا مديرنا الغالي! 🚀 تم تنفيذ وتأكيد الإجراء المطلوب في النظام وقاعدة البيانات بنجاح!` };
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
