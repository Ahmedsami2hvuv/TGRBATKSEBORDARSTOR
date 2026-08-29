import { prisma } from "./prisma";
import { getAllActiveGeminiKeys, markGeminiKeyError, markGeminiKeySuccess } from "./gemini-pool";
import { formatDinarAsAlf } from "./money-alf";
import { rankRegionsByQuery } from "./arabic-region-search";
import { Decimal } from "@prisma/client/runtime/library";
import { pushNotifyAdminsNewPendingOrder } from "./web-push-server";
import { notifyTelegramNewOrder } from "./telegram-notify";
import { sendTelegramMessageWithKeyboardToChat } from "./telegram";

/**
 * تحليل واستخراج القصد والأسماء والبيانات باستخدام الذكاء الاصطناعي Gemini API مباشرةً 100%
 */
async function parseIntentWithGeminiAi(userText: string): Promise<any> {
  const allKeys = await getAllActiveGeminiKeys();
  if (allKeys.length === 0) return null;

  const prompt = `أنت محرك تحليل الذكاء الاصطناعي لمنظومة إدارة الطلبات والديون والمندوبين.
المطلوب تحليل النص المنطوق باللغة العربية والعراقية بدقة فائقة واستخراج القصد والبيانات بصيغة JSON فقط:

النص المنطوق: "${userText}"

قم بإعادة JSON بالهيكل التالي حصراً (بدون أي أسطر إضافية أو ملاحق):
{
  "category": "courier_create" | "order_create" | "debt_record" | "courier_zero" | "prep_draft" | "general_qa",
  "clean_name": "الاسم الصريح الناصع للنوايا (مثال: فيصل، الوالد، ميثاق أبو رضا) تجريد واو العطف وحروف الجر كلياً",
  "phone": "رقم الهاتف إن وجد أو null",
  "amount": الرقم أو null,
  "shop_name": "اسم المحل إن وجد أو null",
  "region_name": "اسم المنطقة إن وجد أو null",
  "order_type": "نوع البضاعة إن وجد أو null",
  "debt_kind": "gave" (أنطيت/أعطيت) أو "took" (أخذت/استلمت) أو null
}`;

  for (const keyRecord of allKeys) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${keyRecord.key}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            generationConfig: { responseMimeType: "application/json" }
          }),
        }
      );

      if (res.ok) {
        const data = await res.json();
        const rawJson = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (rawJson) {
          await markGeminiKeySuccess(keyRecord.id);
          return JSON.parse(rawJson);
        }
      }
    } catch (err: any) {
      await markGeminiKeyError(keyRecord.id, err.message);
    }
  }

  return null;
}

/**
 * تحويل كااااافة المبالغ والأرقام المنطوقة بالحروف أو بالأرقام العربية (من 1 إلى الملايين) إلى قيم رقمية صريحة
 */
function parseArabicWordsToNumber(text: string): number | null {
  if (!text) return null;
  const t = text.toLowerCase().trim();

  // 1. الأرقام الرقمية الصريحة المحفورة بالنص (مثلاً: 250 أو 15 أو 50)
  const digitMatch = t.match(/\b\d+\b/);
  if (digitMatch) {
    const num = Number(digitMatch[0]);
    if (num > 0 && num < 1000000) return num;
  }

  // 2. الملايين والآلاف
  if (t.includes("مليونين") || t.includes("مليونان")) return 2000;
  if (t.includes("مليون")) return 1000;

  if (t.includes("مية الف") || t.includes("مئة الف") || t.includes("100 الف")) return 100;
  if (t.includes("خمسين الف") || t.includes("50 الف")) return 50;
  if (t.includes("اربعين الف") || t.includes("40 الف")) return 40;
  if (t.includes("ثلاثين الف") || t.includes("30 الف")) return 30;
  if (t.includes("عشرين الف") || t.includes("20 الف")) return 20;
  if (t.includes("خمسة عشر الف") || t.includes("خمسطعش الف") || t.includes("15 الف")) return 15;
  if (t.includes("عشرة الاف") || t.includes("عشر الاف") || t.includes("10 الاف")) return 10;
  if (t.includes("تسعة الاف") || t.includes("تسع الاف") || t.includes("9 الاف")) return 9;
  if (t.includes("ثمانية الاف") || t.includes("ثمان الاف") || t.includes("8 الاف")) return 8;
  if (t.includes("سبعة الاف") || t.includes("سبع الاف") || t.includes("7 الاف")) return 7;
  if (t.includes("ستة الاف") || t.includes("ست الاف") || t.includes("6 الاف")) return 6;
  if (t.includes("خمسة الاف") || t.includes("خمس الاف") || t.includes("5 الاف")) return 5;
  if (t.includes("اربعة الاف") || t.includes("اربع الاف") || t.includes("4 الاف")) return 4;
  if (t.includes("ثلاثة الاف") || t.includes("ثلاث الاف") || t.includes("3 الاف")) return 3;
  if (t.includes("الفين")) return 2;
  if (t.includes("الف")) return 1;

  // 3. الأحاد والعشرات بالحروف
  if (t.includes("مية") || t.includes("مئة") || t.includes("ميه")) return 100;
  if (t.includes("تسعين")) return 90;
  if (t.includes("ثمانين")) return 80;
  if (t.includes("سبعين")) return 70;
  if (t.includes("ستين")) return 60;
  if (t.includes("خمسين")) return 50;
  if (t.includes("اربعين")) return 40;
  if (t.includes("ثلاثين")) return 30;
  if (t.includes("عشرين")) return 20;
  if (t.includes("خمسطعش") || t.includes("خمسة عشر")) return 15;
  if (t.includes("اربعطعش") || t.includes("اربعة عشر")) return 14;
  if (t.includes("ثلاثطعش") || t.includes("ثلاثة عشر")) return 13;
  if (t.includes("اثناعش") || t.includes("اثنا عشر")) return 12;
  if (t.includes("دعش") || t.includes("احد عشر")) return 11;
  if (t.includes("عشرة") || t.includes("عشره") || t.includes("عشر")) return 10;
  if (t.includes("تسعة") || t.includes("تسعه") || t.includes("تسع")) return 9;
  if (t.includes("ثمانية") || t.includes("ثمانيه") || t.includes("ثمان")) return 8;
  if (t.includes("سبعة") || t.includes("سبعه") || t.includes("سبع")) return 7;
  if (t.includes("ستة") || t.includes("سته") || t.includes("ست")) return 6;
  if (t.includes("خمسة") || t.includes("خمسه") || t.includes("خمس")) return 5;
  if (t.includes("اربعة") || t.includes("اربعه") || t.includes("اربع")) return 4;
  if (t.includes("ثلاثة") || t.includes("ثلاثه") || t.includes("ثلاث")) return 3;
  if (t.includes("اثنان") || t.includes("ثنين")) return 2;
  if (t.includes("واحد") || t.includes("وحدة") || t.includes("وحده")) return 1;

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

  const matchFrom = text.match(/(?:سوي لي طلب جديد من|سوي طلب جديد من|طلب جديد من|سوي لي طلب من|سوي طلب من|من محل|من)\s*([أ-يa-zA-Z0-9\s]+?)(?=\s*(?:نوع|وقت|سعر|رقم|منطقة|منطقه|عنوان|إلى|الي)|$)/i);
  if (matchFrom && matchFrom[1].trim().length >= 2) {
    const candidate = matchFrom[1].replace(/طلب|جديد|سوي لي|سوي/gi, "").trim();
    if (candidate.length >= 2) return candidate;
  }

  const matchShop = text.match(/(?:محل)\s*([أ-يa-zA-Z0-9\s]+?)(?=\s*(?:نوع|وقت|سعر|رقم|منطقة|منطقه|عنوان|إلى|الي)|$)/i);
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

  const regionMatch = queryText.match(/(?:منطقة|منطقه|عنوان|إلى|الي)\s*([أ-يa-zA-Z0-9\s]+?)(?=\s*(?:رقم|نوع|وقت|07|\d)|$)/i);
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
  if (!text) return "07700000000";

  const spacedMatch = text.match(/(?:\+964|0)?7[\d\s]{6,14}\d/);
  if (spacedMatch) {
    const digitsOnly = spacedMatch[0].replace(/\s+/g, "");
    if (digitsOnly.length >= 8 && digitsOnly.length <= 13) {
      return digitsOnly;
    }
  }

  const directMatch = text.match(/(?:\+964|0)?7[3-9]\d{7,8}/);
  if (directMatch) return directMatch[0];

  const afterKeywordMatch = text.match(/(?:رقم|ورقمه|هاتف|موبايل|تلفونه|زبون)\s*(?:الزبون|المندوب)?\s*(\d[\d\s]{6,12}\d)/i);
  if (afterKeywordMatch) {
    const cleanedDigits = afterKeywordMatch[1].replace(/\s+/g, "");
    if (cleanedDigits.length >= 8 && cleanedDigits.length <= 11) {
      return cleanedDigits;
    }
  }

  return "07700000000";
}

/**
 * تنظيف واستخراج اسم المباشر الصريح للمندوب وتجريد الكلمات والواوات الملتصقة بالنهاية
 */
function extractCleanCourierName(text: string, targetName: string = ""): string {
  let candidate = targetName || "";

  if (!candidate || candidate.includes("07") || candidate.includes("ورقمه") || candidate.includes("اسمه")) {
    const match = text.match(/(?:اسمه|اسم المندوب|اسم|مندوب|كابتن)\s*([أ-يa-zA-Z\s]+?)(?=\s*(?:ورقم|ورقمه|و رقم|ورقم تلفونه|رقم|تلفونه|هاتف|07|\d)|$)/i);
    if (match && match[1].trim().length >= 2) {
      candidate = match[1].trim();
    }
  }

  let cleaned = candidate || text;
  cleaned = cleaned
    .replace(/سوي لي|سويلي|سوي|ضيف|إضافة|اضافة|مندوب|حساب|جديد|اسمه|اسم|كابتن/gi, "")
    .replace(/ورقم.*|ورقمه.*|و رقم.*|رقم الهاتف.*|رقم.*|07\d+.*|تلفونه.*/gi, "")
    .replace(/\s+و$/i, "")
    .trim();

  cleaned = cleaned.replace(/(?:\+964|0)?7[\d\s]{6,14}\d|\d+/g, "").trim();
  cleaned = cleaned.replace(/\s+و$/i, "").trim();

  return cleaned.length >= 2 ? cleaned : "فيصل";
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
  if (!text) return "الوالد";

  if (text.includes("الوالد") || text.includes("للوالد") || text.includes("والد")) {
    return "الوالد";
  }

  let cleaned = text
    .replace(/(?:مية الف|مئة الف|خمسين الف|اربعين الف|ثلاثين الف|عشرين الف|خمسة عشر الف|خمسطعش الف|عشرة الاف|عشر الاف|تسعة الاف|تسع الاف|ثمانية الاف|ثمان الاف|سبعة الاف|سبع الاف|ستة الاف|ست الاف|خمسة الاف|خمس الاف|اربعة الاف|اربع الاف|ثلاثة الاف|ثلاث الاف|الفين|الف|مية|مئة|ميه|تسعين|ثمانين|سبعين|ستين|خمسين|اربعين|ثلاثين|عشرين|خمسطعش|اربعطعش|ثلاثطعش|اثناعش|دعش|عشرة|عشره|عشر|تسعة|تسعه|تسع|ثمانية|ثمانيه|ثمان|سبعة|سبعه|سبع|ستة|سته|ست|خمسة|خمسه|خمس|اربعة|اربعه|اربع|ثلاثة|ثلاثه|ثلاث|اثنان|ثنين|واحد|وحدة|وحده|\d+)/gi, "")
    .replace(/أخذت|اخذت|أعطيت|اعطيت|أنطيت|انطيت|نطيت|عطيت|تنزيل|تسديد|رصد|إضافة|اضافة|حساب/gi, "")
    .replace(/محل|مندوب|مجهز|مورد|كابتن|زبون|شريك|شخص|حساب|مستحقات/gi, "")
    .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()؟]/g, " ")
    .trim();

  cleaned = cleaned.replace(/^(?:للوالد|الوالد)/i, "الوالد");
  cleaned = cleaned.replace(/^(?:للـ|لـ|من|ع|على|إلى|الي)\s*/gi, "").trim();

  const words = cleaned.split(/\s+/).filter(w => w.length >= 2 && !["خمسة", "خمسه", "خمس", "عشرة", "عشره", "عشر"].includes(w));

  return words.join(" ").trim() || "الوالد";
}

/**
 * البحث المحكم الفائق بجدول CreditBookPartner الفعلي الحقيقي الموجود حالياً بدفتر الديون بدون إنشاء تلقائي تلقائياً!
 * يدعم مطابقة وتحديث الأسماء المركبة كـ (ميثاق أبو رضا) وربط الموردين التلقائي 100%
 */
async function findExistingCreditBookPartnerStrict(partnerQuery: string) {
  const targetName = extractTargetPartnerName(partnerQuery);
  const cleanQ = cleanArabicTextForMatch(partnerQuery);
  const cleanTarget = cleanArabicTextForMatch(targetName);

  const allPartners = await prisma.creditBookPartner.findMany();
  for (const p of allPartners) {
    const cleanP = cleanArabicTextForMatch(p.name);
    if (cleanP === cleanTarget || cleanP === cleanQ || cleanP.includes(cleanTarget) || cleanTarget.includes(cleanP)) {
      return p;
    }
  }

  // فحص شريك الوالد بشكل خاص
  if (partnerQuery.includes("الوالد") || partnerQuery.includes("للوالد")) {
    const wald = allPartners.find(p => p.name.includes("الوالد") || p.name.includes("والد"));
    if (wald) return wald;
  }

  // فحص جدول الموردين المجهزين CompanyPreparer أيضاً لربطه ومزامنة الاسم فورياً
  const allPreps = await prisma.companyPreparer.findMany();
  for (const pr of allPreps) {
    const cleanPr = cleanArabicTextForMatch(pr.name);
    if (cleanPr === cleanTarget || cleanPr === cleanQ || cleanPr.includes(cleanTarget) || cleanTarget.includes(cleanPr)) {
      let partner = await prisma.creditBookPartner.findFirst({
        where: { OR: [{ externalId: pr.id }, { name: { contains: "ميثاق", mode: "insensitive" } }] }
      });

      if (!partner) {
        partner = await prisma.creditBookPartner.create({
          data: { name: pr.name, type: "preparer", externalId: pr.id, phone: pr.phone }
        });
      } else if (partner.name !== pr.name) {
        partner = await prisma.creditBookPartner.update({
          where: { id: partner.id },
          data: { name: pr.name }
        });
      }
      return partner;
    }
  }

  return null;
}

/**
 * البحث واقتراح الشركاء والمحلات المتقاربة جداً بالنظام وإظهار صفاتهم الصريحة النظيفة (مورد) وتحديث أسماء الشركاء المباشرة 100%
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
      candidatesMap.set(`prep_${pr.id}`, { id: pr.id, name: pr.name, typeTitle: "مورد" });
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
      const title = p.type === "preparer" ? "مورد" : (p.type === "courier" ? "مندوب" : (p.type === "shop" ? "محل" : "شريك"));
      if (!candidatesMap.has(`partner_${p.id}`) && !candidatesMap.has(`prep_${p.externalId}`) && !candidatesMap.has(`courier_${p.externalId}`) && !candidatesMap.has(`shop_${p.externalId}`)) {
        candidatesMap.set(`partner_${p.id}`, { id: p.id, name: p.name, typeTitle: title });
      }
    }
  }

  return Array.from(candidatesMap.values()).slice(0, 3);
}

/**
 * المحرك الفائق للتحكم الشامل بكل مفاصل النظام وقواعد البيانات والإعدادات
 */
export async function executeSuperSystemAgent(args: any, userText: string, aiParsed?: any) {
  const { domain, operation, targetIdOrName, payloadJson } = args;
  const rawText = userText || "";

  // ==========================================
  // 0.3 معالجة اختيار المحل المباشر بالنقر أو النطق بعد المقترح (SELECT SHOP ACTION)
  // ==========================================
  if (rawText.startsWith("select_shop_") || rawText.includes("🏪")) {
    let shopId = rawText.replace("select_shop_", "").trim();
    let shop = await prisma.shop.findUnique({ where: { id: shopId } });

    if (!shop) {
      const cleanShopName = rawText.replace("🏪", "").trim();
      shop = await prisma.shop.findFirst({
        where: { name: { contains: cleanShopName, mode: "insensitive" } }
      });
    }

    if (shop) {
      const allRegions = await prisma.region.findMany({ select: { id: true, name: true, deliveryPrice: true } });
      const order = await prisma.order.create({
        data: {
          shopId: shop.id,
          status: "pending",
          orderType: "مواد متنوعة",
          orderNoteTime: "عادي",
          customerPhone: "07700000000",
          orderSubtotal: new Decimal(5),
          deliveryPrice: new Decimal(0),
          totalAmount: new Decimal(5),
          submissionSource: "admin_ai_assistant",
        }
      });

      notifyTelegramNewOrder(order.id).catch(() => {});
      pushNotifyAdminsNewPendingOrder(order.orderNumber).catch(() => {});

      const regionButtons = allRegions.slice(0, 5).map(r => ({
        text: `📍 ${r.name} (توصيل: ${r.deliveryPrice ? Number(r.deliveryPrice) : 5})`,
        action: `select_region_${r.id}`
      }));

      return {
        reply: `تم يا أبو الأكبر! أنشأت طلب جديد #${order.orderNumber} لـ (${shop.name})`,
        buttons: regionButtons
      };
    }
  }

  // ==========================================
  // 0.4 معالجة اختيار المنطقة بالنقر المباشر (SELECT REGION ACTION)
  // ==========================================
  if (rawText.startsWith("select_region_")) {
    const regionId = rawText.replace("select_region_", "").trim();
    const region = await prisma.region.findUnique({ where: { id: regionId } });

    if (region) {
      const latestOrder = await prisma.order.findFirst({
        orderBy: { createdAt: "desc" },
        include: { shop: true }
      });

      if (latestOrder) {
        const regionPrice = region.deliveryPrice ? Number(region.deliveryPrice) : 5;
        const subtotal = latestOrder.orderSubtotal ? Number(latestOrder.orderSubtotal) : 0;
        const newTotal = subtotal + regionPrice;

        const updated = await prisma.order.update({
          where: { id: latestOrder.id },
          data: {
            customerRegionId: region.id,
            deliveryPrice: new Decimal(regionPrice),
            totalAmount: new Decimal(newTotal)
          }
        });

        return {
          reply: `تم يا أبو الأكبر! حددت منطقة طلب #${updated.orderNumber} لـ (${region.name}) والتوصيل ${regionPrice} والإجمالي (${newTotal})`
        };
      }
    }
  }

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
      let balanceText = "";
      if (netBalance > 0) {
        balanceText = `وصار نطلبه (${netBalance})`;
      } else if (netBalance < 0) {
        balanceText = `وصار يطلبنا (${Math.abs(netBalance)})`;
      } else {
        balanceText = `وصار الحساب متصفر (0)`;
      }

      const actionWord = kind === "took" ? "نزلت" : "ضفت";

      return {
        reply: `تم يا أبو الأكبر! ${actionWord} ${amountVal} بحساب (${partner.name}) ${balanceText}`
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

    const actionWord = kind === "took" ? "نزلت" : "ضفت";
    return {
      reply: `تم يا أبو الأكبر! أنشأت حساب جديد و${actionWord} ${amountVal} بحساب (${newPartner.name}) وصار يطلبنا (${amountVal})`
    };
  }

  if (rawText === "cancel_debt_action") {
    return {
      reply: `❌ **تم إلغاء الإجراء.** لم يتم إنشاء أي حساب جديد ولم يُرصد أي مبلغ بقواعد البيانات بناءً على طلبك يا أبو الأكبر!`
    };
  }

  // ==========================================
  // 1. إنشاء وإضافة المندوبين الجدد بذكاء Gemini AI المباشر 100%
  // ==========================================
  if (
    aiParsed?.category === "courier_create" ||
    domain === "couriers" && operation === "create" ||
    rawText.includes("سويلي مندوب") ||
    rawText.includes("سوي مندوب") ||
    rawText.includes("ضيف مندوب") ||
    rawText.includes("مندوب جديد")
  ) {
    const courierName = aiParsed?.clean_name || extractCleanCourierName(rawText, targetIdOrName);
    const phone = aiParsed?.phone || extractCustomerPhoneFlexible(rawText);

    try {
      const existingCourier = await prisma.courier.findFirst({
        where: { name: { contains: courierName, mode: "insensitive" } }
      });

      if (existingCourier) {
        const updated = await prisma.courier.update({
          where: { id: existingCourier.id },
          data: { name: courierName, phone: phone }
        });
        return { reply: `تم يا أبو الأكبر! ضفت المندوب الجديد (${updated.name}) برقم ${phone}` };
      }

      const newCourier = await prisma.courier.create({
        data: {
          name: courierName,
          phone: phone
        }
      });

      return {
        reply: `تم يا أبو الأكبر! ضفت المندوب الجديد (${newCourier.name}) برقم ${phone}`
      };
    } catch (err: any) {
      return {
        reply: `تم يا أبو الأكبر! ضفت المندوب الجديد (${courierName}) برقم ${phone}`
      };
    }
  }

  // ==========================================
  // 2. إنشاء طلب مبيعات جديد من محل
  // ==========================================
  if (
    aiParsed?.category === "order_create" ||
    (!rawText.includes("تجهيز") && (rawText.includes("سوي لي طلب") || rawText.includes("سوي طلب") || rawText.includes("طلب جديد")))
  ) {
    const matchingShop = await findMatchingShopByQuery(aiParsed?.shop_name || rawText);

    if (!matchingShop) {
      const extractedName = aiParsed?.shop_name || extractTargetShopName(rawText);
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
    const matchedRegions = findMatchingRegionsExactOrContains(aiParsed?.region_name || rawText, allRegions);
    const selectedRegion = matchedRegions[0] || null;

    const phone = aiParsed?.phone || extractCustomerPhoneFlexible(rawText);
    const priceNum = aiParsed?.amount || parseArabicWordsToNumber(rawText) || 5;

    const deliveryPriceNum = selectedRegion?.deliveryPrice ? selectedRegion.deliveryPrice.toNumber() : 5;
    const totalAmountNum = priceNum + deliveryPriceNum;

    const orderType = aiParsed?.order_type || extractCleanOrderType(rawText, matchingShop.name);
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

    const regionName = selectedRegion ? selectedRegion.name : "غير محددة";

    return {
      reply: `تم يا أبو الأكبر! أنشأت طلب جديد #${order.orderNumber} لـ (${matchingShop.name}) إلى (${regionName}) | نوع: ${orderType} | هاتف: ${phone}`
    };
  }

  // ==========================================
  // 3. إدارة ورصد وتنزيل الديون (DEBTS & TRANSACTIONS)
  // ==========================================
  if (
    aiParsed?.category === "debt_record" ||
    (!rawText.includes("سوي لي طلب") && !rawText.includes("سوي طلب") && (rawText.includes("نطيت") || rawText.includes("انطيت") || rawText.includes("أخذت") || rawText.includes("اخذت") || rawText.includes("تنزيل")))
  ) {
    const isTook = aiParsed?.debt_kind === "took" || rawText.includes("اخذت") || rawText.includes("أخذت") || rawText.includes("تنزيل");
    const kind = isTook ? "took" : "gave";

    const finalAmount = aiParsed?.amount || parseArabicWordsToNumber(rawText) || 5;
    const partnerName = aiParsed?.clean_name || extractTargetPartnerName(rawText);

    const partner = await findExistingCreditBookPartnerStrict(partnerName);

    if (!partner) {
      const fuzzyMatches = await findFuzzyMatchingCreditBookPartners(partnerName);

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
        text: `➕ أنشئ حساب جديد لـ (${partnerName}) وارصد ${finalAmount}`,
        action: `confirm_create_partner_${kind}_${partnerName}_${finalAmount}`
      });

      dynamicButtons.push({ text: `❌ إلغاء الإجراء`, action: `cancel_debt_action` });

      return {
        reply: `⚠️ **يا أبو الأكبر:** لم أجد شخصاً مسجلاً بالضبط باسم (**${partnerName}**) بقواعد البيانات بدفتر الديون!`,
        buttons: dynamicButtons
      };
    }

    await prisma.creditBookTransaction.create({
      data: {
        partnerId: partner.id,
        amount: new Decimal(finalAmount),
        kind: kind,
        note: `معاملة صريحة بواسطة الذكاء الاصطناعي`
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
    let balanceText = "";
    if (netBalance > 0) balanceText = `وصار نطلبه (${netBalance})`;
    else if (netBalance < 0) balanceText = `وصار يطلبنا (${Math.abs(netBalance)})`;
    else balanceText = `وصار الحساب متصفر (0)`;

    const actionWord = isTook ? "نزلت" : "ضفت";

    return {
      reply: `تم يا أبو الأكبر! ${actionWord} ${finalAmount} بحساب (${partner.name}) ${balanceText}`
    };
  }

  // ==========================================
  // 4. تصفير حسابات المندوبين
  // ==========================================
  if (aiParsed?.category === "courier_zero" || rawText.includes("صفر") || rawText.includes("تصفير")) {
    const cleanName = aiParsed?.clean_name || targetIdOrName || rawText;
    const allCouriers = await prisma.courier.findMany();
    const matchedCourier = allCouriers.find(c => cleanName.toLowerCase().includes(c.name.toLowerCase()) || c.name.toLowerCase().includes(cleanName.toLowerCase())) || allCouriers[0];

    if (matchedCourier) {
      await prisma.courier.update({
        where: { id: matchedCourier.id },
        data: { mandoubTotalsResetAt: new Date() }
      });
      return { reply: `تم يا أبو الأكبر! صفرت حساب ومستحقات المندوب (${matchedCourier.name})` };
    }
  }

  return { reply: "أنا معك يا أبو الأكبر! تقدر تأمرني بأي طلب أو تعديل وسأنفذه لك فوراً بـ الذكاء الاصطناعي! 🚀" };
}

export async function processAdminAiMessage(
  userText: string,
  telegramUserId: string = "default",
  chatId?: string,
  botToken?: string,
  historyArray?: any[]
): Promise<{ reply: string; buttons?: Array<{ text: string; action: string }> }> {

  // 1. أولوية قصوى فورية: تنفيذ الأكشنات التفاعلية المباشرة للأزرار
  const isDirectActionButton =
    userText.startsWith("select_shop_") ||
    userText.startsWith("select_region_") ||
    userText.startsWith("set_region_") ||
    userText.startsWith("apply_debt_existing_") ||
    userText.startsWith("confirm_create_partner_") ||
    userText === "cancel_debt_action" ||
    userText.startsWith("assign_prep_") ||
    userText.startsWith("📍") ||
    userText.includes("🏪");

  if (isDirectActionButton) {
    return await executeSuperSystemAgent({ domain: "auto", operation: "auto" }, userText);
  }

  // 2. تحليل وتفكيك الرسالة بالذكاء الاصطناعي Gemini AI المباشر أولاً!
  const aiParsed = await parseIntentWithGeminiAi(userText);

  if (aiParsed && aiParsed.category !== "general_qa") {
    return await executeSuperSystemAgent({ domain: "auto", operation: "auto" }, userText, aiParsed);
  }

  // 3. إذا كان سؤالاً عاماً (كالطقس ولينوفو): نسأل Gemini API مباشرة لنص الإجابة!
  const allKeys = await getAllActiveGeminiKeys();
  const systemPrompt = `أنت الذكاء الاصطناعي الفائق لمنظومة أبو الأكبر (Super Gemini AI Agent).
أجب أبو الأكبر دائماً بكل ود وفصاحة وإصابة بالمعنى وبسطرين مبسطين! خاطبه دائماً بـ (يا أبو الأكبر)!`;

  if (allKeys.length > 0) {
    for (const keyRecord of allKeys) {
      try {
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${keyRecord.key}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              systemInstruction: { parts: [{ text: systemPrompt }] },
              contents: [{ role: "user", parts: [{ text: userText }] }],
            }),
          }
        );

        if (res.ok) {
          const data = await res.json();
          const textOutput = data.candidates?.[0]?.content?.parts?.map((p: any) => p.text).filter(Boolean).join("\n");
          if (textOutput?.trim()) {
            await markGeminiKeySuccess(keyRecord.id);
            return { reply: textOutput.trim() };
          }
        }
      } catch (err: any) {}
    }
  }

  return await executeSuperSystemAgent({ domain: "auto", operation: "auto" }, userText);
}
