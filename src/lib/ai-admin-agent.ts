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

  if (t.includes("خمسة") || t.includes("خمسه") || t.includes("خمس")) return 5;
  if (t.includes("عشرة") || t.includes("عشره") || t.includes("عشر")) return 10;
  if (t.includes("ثلاثة") || t.includes("ثلاثه") || t.includes("ثلاث")) return 3;
  if (t.includes("اربعة") || t.includes("اربعه") || t.includes("اربع")) return 4;
  if (t.includes("واحد") || t.includes("وحدة") || t.includes("وحده")) return 1;
  if (t.includes("اثنان") || t.includes("ثنين")) return 2;

  return null;
}

/**
 * تنظيف وتوحيد النصوص العربية لإزالة وتوحيد (ال التعريف، الهمزات، التاء المربوطة، الياء والواو كـ ابي/ابو/ابن) للمطابقة المباشرة
 */
function cleanArabicTextForMatch(text: string): string {
  if (!text) return "";
  return text
    .toLowerCase()
    .replace(/أ|إ|آ/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/\bابي\b/g, "ابو")
    .replace(/\bابا\b/g, "ابو")
    .replace(/\bابن\b/g, "ابو")
    .replace(/\bاب\b/g, "ابو")
    .replace(/\bال/g, "")
    .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()؟]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * استخراج اسم المحل المنطوق الصريح من كافة الصيغ المنطوقة
 */
function extractTargetShopName(text: string): string {
  if (!text) return "";

  const matchFrom = text.match(/(?:سوي لي طلب جديد من|سوي طلب جديد من|طلب جديد من|سوي لي طلب من|سوي طلب من|من محل|من)\s*([أ-يa-zA-Z0-9\s]+?)(?=\s*(?:نوع|وقت|سعر|رقم|منطقة|منطقه|عنوان)|$)/i);
  if (matchFrom && matchFrom[1].trim().length >= 2) {
    const candidate = matchFrom[1].replace(/طلب|جديد|سوي لي|سوي/gi, "").trim();
    if (candidate.length >= 2) return candidate;
  }

  const matchShop = text.match(/(?:محل)\s*([أ-يa-zA-Z0-9\s]+?)(?=\s*(?:نوع|وقت|سعر|رقم|منطقة|منطقه|عنوان)|$)/i);
  if (matchShop && matchShop[1].trim().length >= 2) {
    return matchShop[1].trim();
  }

  let cleaned = text
    .replace(/.*سوي لي طلب جديد من|.*سوي طلب جديد من|.*طلب جديد من|.*سوي لي طلب من|.*سوي طلب من|.*من محل|.*من|.*محل/gi, "")
    .replace(/نوع الطلب.*|سعر الطلب.*|رقم الزبون.*|منطقة الزبون.*|منطقه الزبون.*/gi, "")
    .trim();

  return cleaned || text.trim();
}

/**
 * مطابقة ذكية مرنة لأسماء المحلات المباشرة (تراعي توحيد ابن / ابو / اب الخصيب واكسسوارات)
 */
async function findMatchingShopByQuery(queryText: string) {
  const allShops = await prisma.shop.findMany({ select: { id: true, name: true } });
  if (allShops.length === 0) return null;

  const targetName = extractTargetShopName(queryText);
  const cleanTarget = cleanArabicTextForMatch(targetName);
  const cleanQuery = cleanArabicTextForMatch(queryText);

  for (const shop of allShops) {
    const cleanShopName = cleanArabicTextForMatch(shop.name);
    if (cleanShopName.length > 2 && (cleanShopName === cleanTarget || cleanShopName === cleanQuery)) {
      return shop;
    }
  }

  for (const shop of allShops) {
    const cleanShopName = cleanArabicTextForMatch(shop.name);
    if (cleanShopName.length > 2) {
      if (cleanQuery.includes(cleanShopName) || cleanShopName.includes(cleanTarget) || cleanTarget.includes(cleanShopName)) {
        return shop;
      }
    }
  }

  const targetWords = cleanTarget.split(/\s+/).filter(w => w.length > 2 && !["طلب", "جديد", "محل"].includes(w));
  if (targetWords.length >= 2) {
    for (const shop of allShops) {
      const cleanShopName = cleanArabicTextForMatch(shop.name);
      const matchedAllWords = targetWords.every(w => cleanShopName.includes(w));
      if (matchedAllWords) {
        return shop;
      }
    }
  }

  return null;
}

/**
 * البحث واقتراح المحلات المتقاربة جداً حصرياً من اسم المحل المنطوق ومنع المحلات العشوائية 100%
 */
async function findFuzzyMatchingShops(queryText: string) {
  const targetName = extractTargetShopName(queryText);
  const cleanTarget = cleanArabicTextForMatch(targetName);
  if (!cleanTarget || cleanTarget.length < 2) return [];

  const allShops = await prisma.shop.findMany({ select: { id: true, name: true } });
  const candidates: Array<{ id: string; name: string }> = [];

  const targetWords = cleanTarget.split(/\s+/).filter(w => w.length > 2 && !["طلب", "جديد", "محل"].includes(w));

  for (const shop of allShops) {
    const cleanShopName = cleanArabicTextForMatch(shop.name);
    const wordMatchedCount = targetWords.filter(w => cleanShopName.includes(w)).length;

    if (wordMatchedCount > 0 || cleanShopName.includes(cleanTarget) || cleanTarget.includes(cleanShopName)) {
      candidates.push(shop);
    }
  }

  return candidates.slice(0, 5);
}

/**
 * البحث والدعم الفائق للمناطق المطابقة الحقيقية مع إعطاء الأولوية للاسم المنطوق صراحة بعد كلمة (منطقة/منطقه)
 */
function findMatchingRegionsExactOrContains(queryText: string, allRegions: any[]): any[] {
  const cleanQ = cleanArabicTextForMatch(queryText.replace(/📍|\(توصيل:.*?\)/g, "").trim());
  if (!cleanQ) return [];

  const regionMatch = queryText.match(/(?:منطقة|منطقه|عنوان)\s*([أ-يa-zA-Z0-9\s]+?)(?=\s*(?:رقم|نوع|وقت|07|\d)|$)/i);
  let targetRegionWord = regionMatch ? cleanArabicTextForMatch(regionMatch[1].trim()) : cleanQ;

  if (targetRegionWord) {
    const directExact = allRegions.filter(r => {
      const cleanR = cleanArabicTextForMatch(r.name);
      return cleanR === targetRegionWord;
    });
    if (directExact.length > 0) return directExact;

    const containsExact = allRegions.filter(r => {
      const cleanR = cleanArabicTextForMatch(r.name);
      return cleanR.includes(targetRegionWord) || targetRegionWord.includes(cleanR);
    });
    if (containsExact.length > 0) return containsExact;
  }

  const exactNameMatches = allRegions.filter(r => cleanArabicTextForMatch(r.name) === cleanQ);
  if (exactNameMatches.length > 0) {
    return exactNameMatches;
  }

  const words = cleanQ.split(/\s+/).filter(w => w.length > 2 && !["طلب", "طلبية", "منطقة", "منطقه", "مستلم", "سويه", "عدل", "غير", "محل"].includes(w));
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
 * استخراج وقت الاستلام والتوصيل الصريح (orderNoteTime)
 */
function extractCleanOrderNoteTime(text: string): string {
  if (!text) return "عادي";

  const timeMatch = text.match(/(?:وقت الطلب|وقت الاستلام|وقت التوصيل|في وقت|وقت)\s*([أ-يa-zA-Z0-9\s]+?)(?=\s*(?:رقم|نوع|سعر|منطقة|منطقه)|$)/i);
  if (timeMatch && timeMatch[1].trim().length >= 2) {
    const timeVal = timeMatch[1].trim();
    return timeVal;
  }

  if (text.includes("الان") || text.includes("هسه") || text.includes("فوري")) return "فوري";
  if (text.includes("غدا صباحا") || text.includes("باكر صباحا") || text.includes("باجر")) return "غداً صباحاً";
  if (text.includes("عصر")) return "عصراً";
  if (text.includes("مغرب")) return "مغرباً";

  return "عادي";
}

/**
 * تنظيف واستخراج اسم المادة والمنتج الحقيقي الفعلي بالنظافة المطلقة 100% وحذف عبارات وقت الطلب منها
 */
function extractCleanOrderType(text: string, shopName?: string): string {
  if (!text) return "مواد متنوعة";

  let textWithoutTime = text.replace(/وقت الطلب.*/gi, "").trim();

  const directMatch = textWithoutTime.match(/(?:نوع الطلب|نوع الطلبيه|نوع البضاعة|نوع المنتج|نوع|سويه|سويها|خليها|خليه)\s*(?:سويه|سويها|هو|هي)?\s*([أ-يa-zA-Z0-9\s]+)$/i);
  if (directMatch && directMatch[1].trim().length >= 2) {
    const candidate = directMatch[1].replace(/جديد|جديده|جديدة|معلق|معلقة|طلب/gi, "").trim();
    if (candidate.length >= 2) return candidate;
  }

  let cleaned = textWithoutTime
    .replace(/(?:طلب|طلبيه|طلبية|رقم|#)?\s*\d{1,5}/gi, "")
    .replace(/نوع الطلب|نوع الطلبيه|نوع البضاعة|نوع المنتج|نوع/gi, "")
    .replace(/عدل على|عدل عليه سويه|عدل عليه|سويه|سويها|عدل|غير|سوي لي|سوي|خلي|خليها|جديد من محل|محل/gi, "")
    .replace(/اللي بحاله جديده|اللي بحالة جديدة|اللي معلق|اللي مسند|اللي بانتظار المندوب|بحاله جديده|بحالة جديدة|جديد|جديده|جديدة|معلق|معلقة/gi, "")
    .replace(/وقت الطلب.*|سعر الطلب.*|رقم الزبون.*|منطقه.*|منطقة.*/gi, "")
    .replace(/طلب|طلبية|طلبيه|طلبيا/gi, "")
    .replace(/\b(?:على|ع|إلى|الي|من|باسم)\b/gi, "")
    .trim();

  if (shopName) {
    cleaned = cleaned.replace(new RegExp(shopName, "gi"), "").trim();
  }

  cleaned = cleaned.replace(/(?:\+964|0)?7[3-9]\d{7,8}|\d+/g, "").trim();

  const words = cleaned
    .split(/\s+/)
    .filter(w => w.length >= 2 && !w.includes("طلب") && !w.includes("عدل") && !w.includes("سويه") && !w.includes("محل") && !w.includes("جديد") && !w.includes("حاله"));

  if (words.length > 0) {
    return words.join(" ");
  }

  return "روبيان";
}

/**
 * استخراج الاسم الصريح المطلق للشريك وتجريد كافة الكلمات الأرقام والأفعال كلياً 100%
 */
function extractTargetPartnerName(text: string): string {
  if (!text) return "";

  let cleaned = text
    .replace(/(?:خمسة|خمسه|خمس|عشرة|عشره|عشر|ثلاثة|ثلاثه|ثلاث|اربعة|اربعه|اربع|واحد|وحدة|وحده|اثنان|ثنين|الفين|الف|آلاف|الاف|\d+)/gi, "")
    .replace(/أخذت|اخذت|أعطيت|اعطيت|أنطيت|انطيت|نطيت|عطيت|تنزيل|تسديد|رصد|إضافة|اضافة|حساب/gi, "")
    .replace(/محل|مندوب|مجهز|مورد|كابتن|زبون|شريك|شخص|حساب|مستحقات/gi, "")
    .replace(/\b(?:من|لـ|على|إلى|الي|مبلغ|بمقدار)\b/gi, "")
    .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()؟]/g, "")
    .trim();

  cleaned = cleaned.replace(/\s+/g, " ").trim();

  return cleaned || "شريك";
}

/**
 * البحث المحكم الفائق بجدول CreditBookPartner الفعلي الحقيقي الموجود حالياً بدفتر الديون بدون إنشاء تلقائي تلقائياً!
 */
async function findExistingCreditBookPartnerStrict(partnerQuery: string) {
  const targetName = extractTargetPartnerName(partnerQuery);
  const cleanQ = cleanArabicTextForMatch(partnerQuery);
  const cleanTarget = cleanArabicTextForMatch(targetName);

  const allPartners = await prisma.creditBookPartner.findMany();
  for (const p of allPartners) {
    const cleanP = cleanArabicTextForMatch(p.name);
    if (cleanP === cleanTarget || cleanP === cleanQ) {
      return p;
    }
  }

  return null;
}

/**
 * البحث واقتراح الشركاء والمحلات المتقاربة جداً بالنظام وإظهار صفاتهم الصريحة ومنع التكرار 100%
 */
async function findFuzzyMatchingCreditBookPartners(partnerQuery: string) {
  const targetName = extractTargetPartnerName(partnerQuery);
  const cleanTarget = cleanArabicTextForMatch(targetName);
  if (!cleanTarget || cleanTarget.length < 2) return [];

  const candidatesMap = new Map<string, { id: string; name: string; typeTitle: string }>();

  const allPreps = await prisma.companyPreparer.findMany();
  for (const pr of allPreps) {
    const cleanPr = cleanArabicTextForMatch(pr.name);
    if (cleanPr.includes(cleanTarget) || cleanTarget.includes(cleanPr)) {
      candidatesMap.set(`prep_${pr.id}`, { id: pr.id, name: pr.name, typeTitle: "مورد/مجهز" });
    }
  }

  const allCouriers = await prisma.courier.findMany();
  for (const c of allCouriers) {
    const cleanC = cleanArabicTextForMatch(c.name);
    if (cleanC.includes(cleanTarget) || cleanTarget.includes(cleanC)) {
      candidatesMap.set(`courier_${c.id}`, { id: c.id, name: c.name, typeTitle: "مندوب" });
    }
  }

  const allShops = await prisma.shop.findMany();
  for (const s of allShops) {
    const cleanS = cleanArabicTextForMatch(s.name);
    if (cleanS.includes(cleanTarget) || cleanTarget.includes(cleanS)) {
      candidatesMap.set(`shop_${s.id}`, { id: s.id, name: s.name, typeTitle: "محل" });
    }
  }

  const allPartners = await prisma.creditBookPartner.findMany();
  for (const p of allPartners) {
    const cleanP = cleanArabicTextForMatch(p.name);
    if (cleanP.includes(cleanTarget) || cleanTarget.includes(cleanP)) {
      const title = p.type === "preparer" ? "مورد/مجهز" : (p.type === "courier" ? "مندوب" : (p.type === "shop" ? "محل" : "شريك"));
      if (!candidatesMap.has(`partner_${p.id}`) && !candidatesMap.has(`prep_${p.externalId}`) && !candidatesMap.has(`courier_${p.externalId}`) && !candidatesMap.has(`shop_${p.externalId}`)) {
        candidatesMap.set(`partner_${p.id}`, { id: p.id, name: p.name, typeTitle: title });
      }
    }
  }

  return Array.from(candidatesMap.values()).slice(0, 3);
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
  // 0. معالجة اختيار شريك موجود من قائمة المقترحات
  // ==========================================
  if (rawText.startsWith("apply_debt_existing_")) {
    const parts = rawText.split("_");
    const partnerId = parts[3];
    const kind = parts[4];
    const amountVal = Number(parts[5]) || 5;

    let partner = await prisma.creditBookPartner.findUnique({ where: { id: partnerId } });

    if (!partner) {
      const prep = await prisma.companyPreparer.findUnique({ where: { id: partnerId } });
      if (prep) {
        partner = await prisma.creditBookPartner.create({
          data: { name: prep.name, type: "preparer", externalId: prep.id, phone: prep.phone }
        });
      }
    }

    if (!partner) {
      const courier = await prisma.courier.findUnique({ where: { id: partnerId } });
      if (courier) {
        partner = await prisma.creditBookPartner.create({
          data: { name: courier.name, type: "courier", externalId: courier.id, phone: courier.phone }
        });
      }
    }

    if (!partner) {
      const shop = await prisma.shop.findUnique({ where: { id: partnerId } });
      if (shop) {
        partner = await prisma.creditBookPartner.create({
          data: { name: shop.name, type: "shop", externalId: shop.id, phone: shop.phone }
        });
      }
    }

    if (partner) {
      await prisma.creditBookTransaction.create({
        data: {
          partnerId: partner.id,
          amount: new Decimal(amountVal),
          kind: kind as any,
          note: `رصد تلقائي بناءً على موافقة أبو الأكبر بالنقر على المقترح`
        }
      });

      const allTx = await prisma.creditBookTransaction.findMany({ where: { partnerId: partner.id } });
      let totalGave = 0;
      let totalTook = 0;
      allTx.forEach(t => {
        const val = t.amount.toNumber();
        if (t.kind === "gave") totalGave += val;
        else if (t.kind === "took") totalTook += val;
      });

      const netBalance = totalGave - totalTook;
      const balanceStatus = netBalance > 0 ? `نطلبه: ${netBalance}` : (netBalance < 0 ? `يطلبنا: ${Math.abs(netBalance)}` : "متصفر (0)");
      const actionTitle = kind === "took" ? "أخذت (تنزيل من الحساب)" : "أعطيت (إضافة على الحساب)";
      const roleTitle = partner.type === "preparer" ? "مورد/مجهز" : (partner.type === "courier" ? "مندوب" : (partner.type === "shop" ? "محل" : "شريك"));

      return {
        reply: `✅ **تم تنزيل ورصد المبلغ بقاعدة البيانات بنجاح يا أبو الأكبر!**\n\n- **الإجراء:** ${actionTitle}\n- **الشخص/الشريك:** ${partner.name} (${roleTitle})\n- **المبلغ المسجل:** ${amountVal}\n- **الرصيد الحالي لـ (${partner.name}):** ${balanceStatus}`
      };
    }
  }

  // ==========================================
  // 0.1 معالجة أزرار التأكيد المباشرة المخصصة لـ إنشاء الحسابات الجديدة في دفتر الديون بطلب صريح
  // ==========================================
  if (rawText.startsWith("confirm_create_partner_")) {
    const parts = rawText.split("_");
    const kind = parts[3];
    const partnerName = parts[4];
    const amountVal = Number(parts[5]) || 5;

    const newPartner = await prisma.creditBookPartner.create({
      data: { name: partnerName, type: "external" }
    });

    await prisma.creditBookTransaction.create({
      data: {
        partnerId: newPartner.id,
        amount: new Decimal(amountVal),
        kind: kind as any,
        note: `تم الإنشاء بطلب مؤكد ومباشر من أبو الأكبر`
      }
    });

    const actionTitle = kind === "took" ? "أخذت (تنزيل من الحساب)" : "أعطيت (إضافة على الحساب)";
    return {
      reply: `✅ **تم إنشاء الحساب الجديد ورصد المبلغ بنجاح يا أبو الأكبر بناءً على موافقتك الصريحة!**\n\n- **الشخص/الشريك الجديد:** ${newPartner.name}\n- **الإجراء:** ${actionTitle}\n- **المبلغ المسجل:** ${amountVal}`
    };
  }

  if (rawText === "cancel_debt_action") {
    return {
      reply: `❌ **تم إلغاء الإجراء.** لم يتم إنشاء أي حساب جديد ولم يُرصد أي مبلغ بقواعد البيانات بناءً على طلبك يا أبو الأكبر!`
    };
  }

  // ==========================================
  // 0.2 معالجة نقرة زر اختيار المنطقة التفاعلي المباشر (DIRECT REGION BUTTON CLICK RECOGNITION)
  // ==========================================
  if (rawText.startsWith("📍") || rawText.includes("توصيل:")) {
    const allRegions = await prisma.region.findMany({ select: { id: true, name: true, deliveryPrice: true } });
    const matchedRegions = findMatchingRegionsExactOrContains(rawText, allRegions);
    const selectedRegion = matchedRegions[0];

    if (selectedRegion) {
      const latestOrder = await prisma.order.findFirst({
        orderBy: { createdAt: "desc" },
        include: { shop: true }
      });

      if (latestOrder) {
        const regionPrice = selectedRegion.deliveryPrice ? Number(selectedRegion.deliveryPrice) : 5;
        const subtotal = latestOrder.orderSubtotal ? Number(latestOrder.orderSubtotal) : 0;
        const newTotal = subtotal + regionPrice;

        const updated = await prisma.order.update({
          where: { id: latestOrder.id },
          data: {
            customerRegionId: selectedRegion.id,
            deliveryPrice: new Decimal(regionPrice),
            totalAmount: new Decimal(newTotal)
          }
        });

        return {
          reply: `✅ **تم تعيين وتثبيت المنطقة وسعر التوصيل بنجاح يا أبو الأكبر!**\n\n- **رقم الطلب:** #${updated.orderNumber}\n- **المحل:** ${latestOrder.shop.name}\n- **المنطقة المحددة:** 📍 ${selectedRegion.name}\n- **سعر التوصيل:** ${regionPrice}\n- **المبلغ الإجمالي النهائي:** ${newTotal}`
        };
      }
    }
  }

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
      reply: `تم يا أبو الأكبر! 🚀 تم إنشاء وتأكيد المندوب الجديد (**${newCourier.name}**) بنجاح في قاعدة البيانات، وأصبح جاهزاً لإسناد الطلبات فوراً!\n\n- **اسم المندوب:** ${newCourier.name}\n- **رقم الهاتف:** ${phone}`
    };
  }

  // ==========================================
  // 2. قسم إدارة وتنزيـل وتسجيل معاملات الديون والشراكة (EXACT DB TRANSACTION SUMMATION ONLY)
  // ==========================================
  if (
    domain === "debts" ||
    rawText.includes("نطيت") ||
    rawText.includes("انطيت") ||
    rawText.includes("أنطيت") ||
    rawText.includes("إنطيت") ||
    rawText.includes("عطيت") ||
    rawText.includes("أعطيت") ||
    rawText.includes("اعطيت") ||
    rawText.includes("اخذت") ||
    rawText.includes("أخذت") ||
    rawText.includes("تنزيل") ||
    rawText.includes("سدد") ||
    rawText.includes("استلمت") ||
    rawText.includes("قبضت") ||
    rawText.includes("دفعت") ||
    rawText.includes("حولت")
  ) {
    const isTook = rawText.includes("اخذت") || rawText.includes("أخذت") || rawText.includes("تنزيل") || rawText.includes("سدد") || rawText.includes("استلمت") || rawText.includes("قبضت");
    const kind = isTook ? "took" : "gave";
    const actionTitle = isTook ? "أخذت (تنزيل من الحساب)" : "أعطيت (إضافة على الحساب)";

    const wordPrice = parseArabicWordsToNumber(rawText);
    const allNums = (rawText.match(/\d+/g) || []).map(Number).filter(n => n > 0 && n < 1000000 && !n.toString().startsWith("77") && !n.toString().startsWith("78") && !n.toString().startsWith("75"));
    const finalAmount = wordPrice != null ? wordPrice : (allNums.length > 0 ? allNums[allNums.length - 1] : 5);

    const partner = await findExistingCreditBookPartnerStrict(rawText);

    if (!partner) {
      const targetName = extractTargetPartnerName(rawText);
      const fuzzyMatches = await findFuzzyMatchingCreditBookPartners(rawText);

      const dynamicButtons: Array<{ text: string; action: string }> = [];

      if (fuzzyMatches.length > 0) {
        fuzzyMatches.forEach(m => {
          dynamicButtons.push({
            text: `✅ هل تقصد: (${m.name} - ${m.typeTitle})؟`,
            action: `apply_debt_existing_${m.id}_${kind}_${finalAmount}`
          });
        });
      }

      dynamicButtons.push({
        text: `➕ أنشئ حساب جديد لـ (${targetName}) وارصد ${finalAmount}`,
        action: `confirm_create_partner_${kind}_${targetName}_${finalAmount}`
      });

      dynamicButtons.push({
        text: `❌ إلغاء الإجراء`,
        action: `cancel_debt_action`
      });

      const suggestionMsg = fuzzyMatches.length > 0
        ? `\n\n💡 **هل تقصد أحداً من الشركاء المسجلين لدينا أدناه؟ انقر على الاسم المطلوب للتأكيد:**`
        : "";

      return {
        reply: `⚠️ **يا أبو الأكبر:** لم أجد شخصاً أو مندوباً أو محلاً أو مورداً/مجهزاً مسجلاً بالضبط باسم (**${targetName}**) بقواعد البيانات بدفتر الديون!${suggestionMsg}`,
        buttons: dynamicButtons
      };
    }

    await prisma.creditBookTransaction.create({
      data: {
        partnerId: partner.id,
        amount: new Decimal(finalAmount),
        kind: kind,
        note: `معاملة صريحة بواسطة المساعد الصوتي`
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

    const roleTitle = partner.type === "courier" ? "مندوب" : (partner.type === "shop" ? "محل" : (partner.type === "preparer" ? "مورد/مجهز" : "شريك"));

    return {
      reply: `✅ **تم تنزيل ورصد المبلغ بقاعدة البيانات بنجاح يا أبو الأكبر!**\n\n- **الإجراء:** ${actionTitle}\n- **الشخص/الشريك:** ${partner.name} (${roleTitle})\n- **المبلغ المسجل المعاملة:** ${finalAmount}\n- **الرصيد الحقيقي الفعلي لـ (${partner.name}):** ${balanceStatus}`
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
    const matchingRegion = matchedRegions[0] || null;

    const allPreparers = await prisma.companyPreparer.findMany();
    const assignedPreparer = allPreparers.find(p => rawText.toLowerCase().includes(p.name.toLowerCase()));

    const draft = await prisma.companyPreparerShoppingDraft.create({
      data: {
        preparerId: assignedPreparer ? assignedPreparer.id : null,
        rawListText: extractedItems,
        customerPhone: phone,
        customerRegionId: matchingRegion?.id || null,
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
      reply: `✅ **تم إنشاء مسودة التجهيز ورصد المنتجات بالكامل بالنظام يا أبو الأكبر!**\n\n- **رقم المسودة:** #${draft.draftNumber}\n- **المنطقة والوجهة:** ${matchingRegion?.name || "غير محددة"}\n- **رقم هاتف الزبون:** ${phone}\n- ${preparerMsg}\n\n📝 **قائمة المنتجات والمواد المطلوبة:**\n${extractedItems}`,
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

    if (!matchingShop) {
      const extractedName = extractTargetShopName(rawText);
      const fuzzyShops = await findFuzzyMatchingShops(rawText);

      const shopButtons = fuzzyShops.map(s => ({
        text: `🏪 ${s.name}`,
        action: `select_shop_${s.id}`
      }));

      const suggestionNote = fuzzyShops.length > 0
        ? "\n\n👇 **يرجى النقر على اسم المحل المطلوب من المقترحات المطابقة أدناه:**"
        : "";

      return {
        reply: `⚠️ **يا أبو الأكبر:** لم أتمكن من الجزم باسم المحل المطابق بالضبط لـ (**${extractedName}**) بقواعد البيانات!${suggestionNote}`,
        buttons: shopButtons
      };
    }

    const allRegions = await prisma.region.findMany({ select: { id: true, name: true, deliveryPrice: true } });
    const hasRegionMention = rawText.includes("منطقة") || rawText.includes("منطقه") || rawText.includes("عنوان") || rawText.includes("جيكور") || rawText.includes("حمدان") || rawText.includes("ابي الخصيب");
    
    let selectedRegion: any = null;
    let regionButtons: Array<{ text: string; action: string }> | undefined = undefined;

    if (hasRegionMention) {
      const matchedRegions = findMatchingRegionsExactOrContains(rawText, allRegions);
      selectedRegion = matchedRegions[0] || null;
      if (matchedRegions.length > 1) {
        regionButtons = matchedRegions.map(r => ({
          text: `📍 ${r.name} (توصيل: ${r.deliveryPrice ? Number(r.deliveryPrice) : 5})`,
          action: `select_region_${r.id}`
        }));
      }
    } else {
      regionButtons = allRegions.slice(0, 5).map(r => ({
        text: `📍 ${r.name} (توصيل: ${r.deliveryPrice ? Number(r.deliveryPrice) : 5})`,
        action: `select_region_${r.id}`
      }));
    }

    const phone = extractCustomerPhoneFlexible(rawText);

    const wordPrice = parseArabicWordsToNumber(rawText);
    const allNums = (rawText.match(/\d+/g) || []).map(Number).filter(n => n > 0 && n < 100000 && !n.toString().startsWith("77") && !n.toString().startsWith("78") && !n.toString().startsWith("75"));
    const priceNum = wordPrice != null ? wordPrice : (allNums.length > 0 ? allNums[allNums.length - 1] : 5);

    const deliveryPriceNum = selectedRegion?.deliveryPrice ? selectedRegion.deliveryPrice.toNumber() : (hasRegionMention ? 5 : 0);
    const totalAmountNum = priceNum + deliveryPriceNum;

    const orderType = extractCleanOrderType(rawText, matchingShop.name);
    const orderNoteTime = extractCleanOrderNoteTime(rawText);

    const order = await prisma.order.create({
      data: {
        shopId: matchingShop.id,
        status: "pending",
        orderType: orderType,
        orderNoteTime: orderNoteTime,
        customerRegionId: selectedRegion?.id || null,
        customerPhone: phone,
        orderSubtotal: new Decimal(priceNum),
        deliveryPrice: new Decimal(deliveryPriceNum),
        totalAmount: new Decimal(totalAmountNum),
        submissionSource: "admin_ai_assistant",
      }
    });

    notifyTelegramNewOrder(order.id).catch(() => {});
    pushNotifyAdminsNewPendingOrder(order.orderNumber).catch(() => {});

    const regionNote = selectedRegion ? selectedRegion.name : "⚠️ غير محددة (يرجى اختيار المنطقة أدناه)";
    const optionsNote = regionButtons && regionButtons.length > 0 ? "\n\n👇 **انقر على المنطقة المناسبة لتأكيد سعر التوصيل:**" : "";

    return {
      reply: `✅ **تم إضافة ورصد الطلب الجديد بالنظام بنجاح يا أبو الأكبر!**\n\n- **رقم الطلب:** #${order.orderNumber}\n- **المحل:** ${matchingShop.name}\n- **المنطقة والوجهة:** ${regionNote}\n- **رقم هاتف الزبون:** ${phone}\n- **نوع البضاعة والمنتج:** ${orderType}\n- **وقت الاستلام والتوصيل:** ${orderNoteTime}\n- **سعر البضاعة:** ${priceNum}\n- **سعر التوصيل للمنطقة:** ${deliveryPriceNum}\n- **المبلغ الإجمالي:** ${totalAmountNum}${optionsNote}`,
      buttons: regionButtons
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
        return { reply: `✅ **تم ${statusMsg} المندوب (${courier.name}) بنجاح يا أبو الأكبر!**` };
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
        return { reply: `✅ **تم تصفير حساب ومستحقات المندوب (${courier.name}) بالكامل يا أبو الأكبر!**` };
      }
    }
  }

  // ==========================================
  // 6. الشمول المباشر المطلق لتعديل كاااافة حقول ومكونات الطلب (UNIVERSAL FULL ORDER FIELD MODIFICATION)
  // ==========================================
  let orderNumber: number | null = null;

  const explicitNumMatch = rawText.match(/(?:طلب|طلبية|#|رقمه|رقم)?\s*(\d{3,5})/i);
  if (explicitNumMatch) {
    orderNumber = Number(explicitNumMatch[1]);
  }

  const wordPrice = parseArabicWordsToNumber(rawText);

  let existingOrder: any = null;

  if (orderNumber && orderNumber < 100000) {
    existingOrder = await prisma.order.findUnique({
      where: { orderNumber: orderNumber },
      include: { shop: true, customerRegion: true, courier: true }
    });
  }

  const matchingShop = await findMatchingShopByQuery(rawText);

  if (!existingOrder && matchingShop) {
    const isResetStatusToPending = rawText.includes("رجعه") || rawText.includes("رجعها") || rawText.includes("رجعلها") || rawText.includes("سويها جديدة") || rawText.includes("الغي اسنادها");

    if (isResetStatusToPending) {
      existingOrder = await prisma.order.findFirst({
        where: { shopId: matchingShop.id },
        orderBy: { createdAt: "desc" },
        include: { shop: true, customerRegion: true, courier: true }
      });
    } else {
      let targetStatusFilter: string | undefined = undefined;
      if (rawText.includes("مرفوض") || rawText.includes("مرفوضة")) {
        targetStatusFilter = "rejected";
      } else if (rawText.includes("مسند") || rawText.includes("مسندة") || rawText.includes("بانتظار")) {
        targetStatusFilter = "assigned";
      } else if (rawText.includes("جديد") || rawText.includes("جديده") || rawText.includes("جديدة") || rawText.includes("معلق") || rawText.includes("معلقة")) {
        targetStatusFilter = "pending";
      }

      const whereClause: any = { shopId: matchingShop.id };
      if (targetStatusFilter) {
        whereClause.status = targetStatusFilter;
      }

      existingOrder = await prisma.order.findFirst({
        where: whereClause,
        orderBy: { createdAt: "desc" },
        include: { shop: true, customerRegion: true, courier: true }
      });
    }
  }

  if (existingOrder) {
    const updateData: any = {};
    const changes: string[] = [];
    let regionButtons: Array<{ text: string; action: string }> | undefined = undefined;

    const isExplicitUnassign = rawText.includes("الغي الاسناد") || rawText.includes("الغي اسناد") || rawText.includes("إلغاء الإسناد") || rawText.includes("الغاء الاسناد") || rawText.includes("الغي المندوب");
    const isAssignAction = rawText.includes("فارس") || rawText.includes("احمد") || rawText.includes("نجم") || rawText.includes("boos") || rawText.includes("كابتن") || rawText.includes("اسناد") || rawText.includes("إسناد") || rawText.includes("حول") || rawText.includes("حوله");
    const isResetStatusToPending = rawText.includes("رجعه") || rawText.includes("رجعها") || rawText.includes("رجعلها") || rawText.includes("سويها جديدة");

    if (rawText.includes("رقم الزبون") || rawText.includes("رقم الهاتف") || rawText.includes("هاتف") || rawText.includes("موبايل") || rawText.includes("غير الرقم") || rawText.includes("خلي الرقم")) {
      const newPhone = extractCustomerPhoneFlexible(rawText);
      if (newPhone && newPhone !== "غير محدد") {
        updateData.customerPhone = newPhone;
        changes.push(`📱 **رقم هاتف الزبون الجديد:** ${newPhone}`);
      }
    }

    if (rawText.includes("الرقم الثاني") || rawText.includes("الرقم البديل") || rawText.includes("رقم بديل") || rawText.includes("هاتف ثاني")) {
      const altPhone = extractCustomerPhoneFlexible(rawText);
      if (altPhone && altPhone !== "غير محدد") {
        updateData.alternatePhone = altPhone;
        updateData.secondCustomerPhone = altPhone;
        changes.push(`📞 **رقم الهاتف البديل/الثاني الجديد:** ${altPhone}`);
      }
    }

    if (rawText.includes("نقطة دالة") || rawText.includes("نقطه داله") || rawText.includes("علامة بارزة") || rawText.includes("قريب على") || rawText.includes("مقابل")) {
      const landmarkMatch = rawText.match(/(?:نقطة دالة|نقطه داله|علامة بارزة|قريب على|مقابل)\s*(.+)$/i);
      const landmarkText = landmarkMatch ? landmarkMatch[1].trim() : rawText.trim();
      if (landmarkText) {
        updateData.customerLandmark = landmarkText;
        changes.push(`📌 **أقرب نقطة دالة:** ${landmarkText}`);
      }
    }

    if (rawText.includes("دين قديم") || rawText.includes("دين الزبون القديم") || rawText.includes("طلب قديم")) {
      const debtAmount = wordPrice != null ? wordPrice : 0;
      updateData.customerOldDebt = new Decimal(debtAmount);
      changes.push(`💳 **دين الزبون القديم المسجل:** ${debtAmount}`);
    }

    if (rawText.includes("سعر الشراء") || rawText.includes("التكلفة") || rawText.includes("تكلفة البضاعة")) {
      const pPrice = wordPrice != null ? wordPrice : 0;
      updateData.purchasePrice = new Decimal(pPrice);
      changes.push(`🏷️ **سعر الشراء/التكلفة الجديد:** ${pPrice}`);
    }

    if (rawText.includes("موقع الزبون") || rawText.includes("لوكيشن") || rawText.includes("خريطة")) {
      const urlMatch = rawText.match(/(https?:\/\/\S+|maps\S+)/i);
      if (urlMatch) {
        updateData.customerLocationUrl = urlMatch[0];
        changes.push(`📍 **رابط موقع الزبون الجديد:** ${urlMatch[0]}`);
      }
    }

    if (isExplicitUnassign) {
      updateData.assignedCourierId = null;
      updateData.status = "pending";
      changes.push(`👨‍✈️ **المندوب:** تم إلغاء إسناد المندوب بنجاح`);
      changes.push(`📌 **الحالة الجديدة:** طلب جديد معلق`);
    } else if (isAssignAction) {
      const allCouriers = await prisma.courier.findMany();
      for (const c of allCouriers) {
        if (rawText.toLowerCase().includes(c.name.toLowerCase())) {
          updateData.assignedCourierId = c.id;
          updateData.status = "assigned";
          changes.push(`👨‍✈️ **المندوب المسند:** ${c.name}`);
          break;
        }
      }
    }

    if (rawText.includes("منطقة") || rawText.includes("المنطقة") || rawText.includes("رايح") || rawText.includes("منطقه") || rawText.includes("الوجهة") || rawText.includes("غير اسم") || rawText.includes("جيكور") || rawText.includes("حمدان")) {
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

    if (!rawText.includes("سعر الشراء") && (wordPrice != null || rawText.includes("سعر") || rawText.includes("السعر"))) {
      const finalPriceToSet = wordPrice != null ? wordPrice : 5;

      if (rawText.includes("سعر التوصيل")) {
        updateData.deliveryPrice = new Decimal(finalPriceToSet);
        changes.push(`🚚 **سعر التوصيل الجديد:** ${finalPriceToSet}`);
      } else {
        updateData.orderSubtotal = new Decimal(finalPriceToSet);
        changes.push(`💰 **سعر الطلب/البضاعة الجديد:** ${finalPriceToSet}`);
      }

      const sub = updateData.orderSubtotal ? Number(updateData.orderSubtotal) : existingOrder.orderSubtotal.toNumber();
      const del = updateData.deliveryPrice ? Number(updateData.deliveryPrice) : existingOrder.deliveryPrice.toNumber();
      updateData.totalAmount = new Decimal(sub + del);
      changes.push(`💵 **المبلغ الإجمالي الجديد النهائي:** ${sub + del}`);
    }

    if (rawText.includes("نوع الطلب") || rawText.includes("نوع البضاعة") || rawText.includes("نوع المنتج") || rawText.includes("تغيير نوع") || rawText.includes("نوع") || rawText.includes("صمان") || rawText.includes("صمون")) {
      const cleanType = extractCleanOrderType(rawText, existingOrder.shop?.name);
      if (cleanType && cleanType.length >= 2) {
        updateData.orderType = cleanType;
        changes.push(`📦 **نوع البضاعة والمنتج الجديد:** ${cleanType}`);
      }
    }

    if (rawText.includes("وقت الطلب") || rawText.includes("وقت الاستلام") || rawText.includes("غدا") || rawText.includes("صباحا")) {
      const timeVal = extractCleanOrderNoteTime(rawText);
      updateData.orderNoteTime = timeVal;
      changes.push(`⏰ **وقت الاستلام والتوصيل الجديد:** ${timeVal}`);
    }

    if (!isAssignAction && !isExplicitUnassign) {
      if (isResetStatusToPending) {
        updateData.status = "pending";
        updateData.assignedCourierId = null;
        changes.push(`📌 **الحالة الجديدة:** طلب جديد معلق`);
        changes.push(`👨‍✈️ **المندوب:** تم إلغاء الإسناد وإعادة الطلب جديداً`);
      } else if (rawText.includes("مرفوض") || rawText.includes("مرفوضة")) {
        updateData.status = "rejected";
        changes.push(`📌 **الحالة الجديدة:** مرفوض`);
      } else if (rawText.includes("مكتمل") || rawText.includes("واصل")) {
        updateData.status = "completed";
        changes.push(`📌 **الحالة الجديدة:** مكتمل`);
      } else if (rawText.includes("استلام")) {
        updateData.status = "delivered";
        changes.push(`📌 **الحالة الجديدة:** تم الاستلام`);
      }
    }

    if (Object.keys(updateData).length > 0) {
      const updated = await prisma.order.update({
        where: { id: existingOrder.id },
        data: updateData
      });

      const optionsNote = regionButtons && regionButtons.length > 0 ? "\n\n👇 **المناطق المطابقة المتوفرة (انقر على الخيار المناسب):**" : "";

      return {
        reply: `✅ **تم التعرف وتعديل طلب محل (${existingOrder.shop.name}) - #${updated.orderNumber} بنجاح يا أبو الأكبر!**\n\n${changes.join("\n")}${optionsNote}`,
        buttons: regionButtons
      };
    }
  }

  if (!orderNumber && (rawText.includes("شنو") || rawText.includes("طلبات جديدة") || rawText.includes("طلبات معلقة"))) {
    const pendingOrders = await prisma.order.findMany({
      where: { status: "pending" },
      include: { shop: true, customerRegion: true },
      orderBy: { createdAt: "desc" },
      take: 10
    });

    if (pendingOrders.length === 0) {
      return { reply: "📋 **لا توجد أي طلبات جديدة معلقة بالنظام حالياً يا أبو الأكبر.** كافة الطلبات مسندة ومكتملة!" };
    }

    let lines = [`📋 **الطلبات الجديدة المعلقة بالنظام حالياً (${pendingOrders.length} طلبات) يا أبو الأكبر:**\n`];
    pendingOrders.forEach((o, i) => {
      lines.push(`${i + 1}. **طلب #${o.orderNumber}** | المحل: ${o.shop.name} | المنطقة: ${o.customerRegion?.name || "غير محددة"} | المبلغ الإجمالي: ${o.totalAmount}`);
    });
    return { reply: lines.join("\n") };
  }

  return { reply: `⚠️ **يا أبو الأكبر:** لم يطرأ أي تعديل أو إلغاء في قاعدة البيانات، بسبب عدم العثور على طلب مطابق للمواصفات المذكورة بالرسالة بالنظام حالياً! يرجى ذكر رقم الطلب الصريح (مثل: #2042).` };
}

export async function processAdminAiMessage(
  userText: string,
  telegramUserId: string = "default",
  chatId?: string,
  botToken?: string,
  historyArray?: any[]
): Promise<{ reply: string; buttons?: Array<{ text: string; action: string }> }> {

  // 1. أولوية قصوى فورية (0 ميلي ثانية): تنفيذ الأكشنات التفاعلية المباشرة للأزرار دون المرور بـ AI API
  const isDirectActionButton =
    userText.startsWith("apply_debt_existing_") ||
    userText.startsWith("confirm_create_partner_") ||
    userText === "cancel_debt_action" ||
    userText.startsWith("select_shop_") ||
    userText.startsWith("select_region_") ||
    userText.startsWith("set_region_") ||
    userText.startsWith("assign_prep_") ||
    userText.startsWith("📍");

  if (isDirectActionButton) {
    return await executeSuperSystemAgent({ domain: "auto", operation: "auto" }, userText);
  }

  const allKeys = await getAllActiveGeminiKeys();

  let contextCombinedText = userText;
  const contentsPayload: any[] = [];

  const isDebtAction = userText.includes("اخذت") || userText.includes("أخذت") || userText.includes("انطيت") || userText.includes("أعطيت") || userText.includes("اعطيت") || userText.includes("تنزيل");

  if (!isDebtAction && historyArray && Array.isArray(historyArray) && historyArray.length > 0) {
    historyArray.forEach((item: any) => {
      const roleName = item.role === "assistant" || item.role === "model" ? "model" : "user";
      const textVal = item.content || item.text || item.prompt || "";
      if (textVal) {
        contentsPayload.push({
          role: roleName,
          parts: [{ text: textVal }]
        });
      }
    });

    const previousPrompts = historyArray
      .filter((item: any) => item.role === "user")
      .map((item: any) => item.content || item.text || item.prompt)
      .filter(Boolean)
      .join(" ");

    if (previousPrompts && (userText.includes("قصدي") || userText.includes("لا") || userText.includes("عدل") || userText.includes("غير") || userText.includes("سويه"))) {
      contextCombinedText = `${previousPrompts} ${userText}`;
    }
  }

  contentsPayload.push({
    role: "user",
    parts: [{ text: userText }]
  });

  const systemPrompt = `أنت الوكيل الذكي الفائق ومساعد النظام المطلق (Super AI Agent) لإدارة كامل مفاصل التطبيق بالنظام والموقع (الطلبات، المندوبين، المحلات، المناطق ورسوم التوصيل، الديون، والإعدادات).
لديك الصلاحية والحرية المطلقة لتعديل أو إضافة أو تعطيل أو استعلام أي عنصر أو خيار في النظام تلقائياً!
تأكد من استخراج اسم الشريك النظيف الصريح كـ (الوالد) أو (ميثاق) وتجريد كافة الأرقام اللفظية والحرفية (خمسة/عشرة) كلياً من اسم الشريك، واكتب للمدير دائماً بكل احترام (يا أبو الأكبر)!`;

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
                  result = await executeSuperSystemAgent(fn.args, contextCombinedText);
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

  const res = await executeSuperSystemAgent({ domain: "auto", operation: "auto" }, contextCombinedText);
  return res;
}
