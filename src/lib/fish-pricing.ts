/**
 * منطق تسعير السمك وتحليل الأوزان والكسور للطلبات
 */

export interface FishPriceItem {
  name: string;      // اسم السمكة الأصلي (مثل: سلمون، حمام3)
  cleanName: string; // الاسم منظف وبدون مسافات لتسهيل المطابقة الجزئية
  buyPrice: number;  // سعر الشراء اليومي
  sellPrice: number; // سعر البيع اليومي
}

/**
 * تحويل الأرقام الهندية/العربية (١٢٣) إلى أرقام إنجليزية (123)
 */
export function convertArabicNumbers(str: string): string {
  const arabicNums = [/٠/g, /١/g, /٢/g, /٣/g, /٤/g, /٥/g, /٦/g, /٧/g, /٨/g, /٩/g];
  const englishNums = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];
  let result = str;
  for (let i = 0; i < 10; i++) {
    result = result.replace(arabicNums[i], englishNums[i]);
  }
  return result;
}

/**
 * توحيد النصوص العربية لتسهيل المطابقة الدقيقة والجزئية
 */
export function normalizeArabicText(str: string): string {
  if (!str) return "";
  let text = str.toLowerCase().trim();
  text = convertArabicNumbers(text);
  
  // توحيد الحروف المتشابهة
  text = text.replace(/[أإآ]/g, "ا");
  text = text.replace(/ة/g, "ه");
  text = text.replace(/ى/g, "ي");
  text = text.replace(/نصف/g, "نص");
  text = text.replace(/إلا/g, "الا");
  text = text.replace(/الاربّع/g, "الربع");
  
  // إزالة الحركات والتنوين
  text = text.replace(/[\u064B-\u065F]/g, "");
  
  // إزالة الرموز الخاصة والمسافات الزائدة
  text = text.replace(/[^a-zA-Z0-9\u0621-\u064A\s]/g, " ");
  text = text.replace(/\s+/g, ""); // نزيل المسافات تماماً لضمان قوة المطابقة
  
  return text;
}

/**
 * دالة ذكية لتحليل وتفسير أوزان السمك والكسور من نص الطلب
 */
export function parseFishWeight(line: string): number {
  if (!line) return 1;
  
  let text = line.toLowerCase().trim();
  text = convertArabicNumbers(text);
  
  // تنظيف وتوحيد العبارات
  text = text.replace(/[أإآ]/g, "ا");
  text = text.replace(/ة/g, "ه");
  text = text.replace(/ى/g, "ي");
  text = text.replace(/نصف/g, "نص");
  text = text.replace(/إلا/g, "الا");
  text = text.replace(/الاربّع/g, "الربع");
  text = text.replace(/الاربع/g, "الا ربع");
  text = text.replace(/\s+/g, " ");
  
  // إضافة مسافات لفصل الرقم عن حرف الكاف أو كلمة كيلو إذا كانا متصلين (مثل 2ك أو 2كيلو)
  text = text.replace(/(\d+)\s*(ك|كيلو|كيلوغرام|كغم)/g, "$1 $2");
  
  // 1. فحص الحالات الخاصة الخالية من الأرقام الصريحة
  if (text.includes("ربع كيلو") || text.includes("ربع ك ")) return 0.25;
  if (text.includes("نص كيلو") || text.includes("نص ك ")) return 0.5;
  
  const hasKilo2 = text.includes("كيلوين") || text.includes("كيلو ين");
  const hasKilo1 = text.includes("كيلو") || /\sك\s/.test(" " + text + " ") || text.endsWith(" ك") || text.startsWith("ك ");
  
  // 2. البحث عن رقم الوزن الأساسي
  const numberMatch = text.match(/(\d+(?:\.\d+)?)\s*(?:ك|كيلو|كيلوغرام|كغم)?/);
  
  let baseWeight = 0;
  if (numberMatch) {
    baseWeight = parseFloat(numberMatch[1]);
  } else if (hasKilo2) {
    baseWeight = 2;
  } else if (hasKilo1) {
    baseWeight = 1;
  }
  
  // إذا لم نجد أي إشارة للوزن، نفترض كيلو واحد
  if (baseWeight === 0) {
    baseWeight = 1;
  }
  
  // 3. تطبيق الكسور (ونص، وربع، إلا ربع)
  if (text.includes("الا ربع") || text.includes("الاربع")) {
    if (baseWeight > 0.25) {
      return baseWeight - 0.25;
    }
  }
  
  if (text.includes("و نص") || text.includes("ونص")) {
    return baseWeight + 0.5;
  }
  
  if (text.includes("و ربع") || text.includes("وربع")) {
    return baseWeight + 0.25;
  }
  
  return baseWeight;
}

/**
 * تحليل قائمة الأسعار المدخلة من قبل المستخدم
 * صيغة الإدخال المتوقعة لكل سطر: [اسم السمكة] [سعر الشراء] [سعر البيع]
 */
export function parseFishPricesList(rawText: string): FishPriceItem[] {
  if (!rawText) return [];
  const lines = rawText.split("\n");
  const items: FishPriceItem[] = [];
  
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    
    // نقسم السطر بالمسافات
    const parts = trimmed.split(/\s+/);
    if (parts.length < 3) continue; // يجب أن يحتوي على اسم وسعرين على الأقل
    
    // آخر كلمتين/رقمين هما أسعار البيع والشراء
    const sellPriceStr = parts[parts.length - 1];
    const buyPriceStr = parts[parts.length - 2];
    
    const sellPrice = parseFloat(convertArabicNumbers(sellPriceStr));
    const buyPrice = parseFloat(convertArabicNumbers(buyPriceStr));
    
    if (isNaN(sellPrice) || isNaN(buyPrice)) continue;
    
    // اسم السمكة هو كل الكلمات السابقة للرقمين الأخيرين
    const nameParts = parts.slice(0, parts.length - 2);
    const name = nameParts.join(" ");
    
    items.push({
      name,
      cleanName: normalizeArabicText(name),
      buyPrice,
      sellPrice
    });
  }
  
  return items;
}

/**
 * مطابقة سطر الطلب مع قائمة أسعار اليوم وحساب أسعار الشراء والبيع تلقائياً
 */
export function matchFishAndCalculatePrice(
  line: string, 
  fishPrices: FishPriceItem[]
): { buyAlf: number; sellAlf: number; matchedName: string } | null {
  if (!line || !fishPrices || fishPrices.length === 0) return null;
  
  const cleanLine = normalizeArabicText(line);
  
  // ترتيب الأسعار تنازلياً حسب طول الاسم المنظف لضمان مطابقة الاسم الأطول والأكثر دقة أولاً
  const sortedPrices = [...fishPrices].sort((a, b) => b.cleanName.length - a.cleanName.length);
  
  for (const item of sortedPrices) {
    if (!item.cleanName) continue;
    
    // فحص ما إذا كان سطر الطلب يحتوي على اسم السمكة المنظف
    if (cleanLine.includes(item.cleanName)) {
      // فحص ما إذا كان اسم السمكة المعرف يحتوي على رقم (مثل حمام3)
      const hasNumberInName = /\d/.test(item.name);
      
      if (hasNumberInName) {
        // إذا كان الاسم يحتوي على رقم، نعتبر السعر المحدد هو سعر البيعة الإجمالية مباشرة
        return {
          buyAlf: item.buyPrice,
          sellAlf: item.sellPrice,
          matchedName: item.name
        };
      } else {
        // إذا لم يكن يحتوي على رقم، نعتبر السعر المحدد للكيلو ونقوم باحتساب الوزن
        const weight = parseFishWeight(line);
        const buyAlf = parseFloat((item.buyPrice * weight).toFixed(2));
        const sellAlf = parseFloat((item.sellPrice * weight).toFixed(2));
        
        return {
          buyAlf,
          sellAlf,
          matchedName: item.name
        };
      }
    }
  }
  
  return null;
}
