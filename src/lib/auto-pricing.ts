/**
 * منطق التسعير التلقائي بناءً على سعر الشراء والكمية
 */

// الثوابت المعتمدة للتسعير التلقائي للحوم (القانون الثابت)
const MEAT_CUTS_CONSTANTS = [
  "شرح", "مثروم", "عظم", "عضم", "باجه", "شحم", "عصفورة", "عصفوره", "فكاره", "فكارة", "ضلوع", "ريش", "عروق"
];

// الكلمات العامة للتعريف باللحم (لأغراض التصنيف العام والتقارير)
export const MEAT_KEYWORDS = ["لحم", ...MEAT_CUTS_CONSTANTS];

export const FISH_KEYWORDS = [
  "سمك", "ابياح", "بنت السلطان", "بني", "بياح", "جش", "حيسون", "حمار", "حمر", "حمرة", "حمره",
  "خشرة", "خشره", "دوكان", "روبيان", "ربيان", "سمتي", "سمكة", "سلمون", "سلمونة", "سلمونه",
  "سلمنتين", "شانگ", "شانك", "شعري", "شلك", "صافي", "ضلعة", "ضلعه", "ظلعة", "ظلعه", "عندك",
  "عندگ", "عروسة", "عروسه", "غريبة", "غريبه", "كطان", "مزلك", "مزلگ", "ملزك", "نگرور",
  "نكرور", "وحر", "هامور", "سمك حامض", "سمك مشوي", "فاسكر", "ضلع", "حمام"
];

export function isMeatProduct(line: string): boolean {
    const t = (line || "").toLowerCase();

    // 1. فحص القطعيات الثابتة (مثل: شرح، عضم، فكاره) -> تسعير تلقائي دائماً
    const hasConstantCut = MEAT_CUTS_CONSTANTS.some(k => t.includes(k));
    if (hasConstantCut) return true;

    // 2. إذا وردت كلمة "لحم" مع كلمة "معتمد" أو "معتمدة" -> تسعير تلقائي
    const isApprovedMeat = t.includes("لحم") && (t.includes("معتمد") || t.includes("معتمدة"));
    if (isApprovedMeat) return true;

    // أي حالة أخرى (مثل: بركر لحم، ناجت لحم، سمبوسه لحم) -> تسعير يدوي
    return false;
}

export function isFishProduct(line: string): boolean {
    const t = (line || "").toLowerCase();
    return FISH_KEYWORDS.some(k => t.includes(k));
}

/**
 * استخراج الكمية (كيلوات أو قطع) من نص المنتج
 */
export function parseQuantityFromLine(line: string): number {
  const text = (line || "").toLowerCase().trim();

  if (text.includes("كيلو ونص")) return 1.5;
  if (text.includes("نص كيلو") || text.includes("نصف كيلو")) return 0.5;
  if (text.includes("ربع كيلو")) return 0.25;
  if (text.includes("كيلوين")) return 2;

  // البحث عن رقم متبوع بوحدة
  const matchWithUnit = text.match(/(\d+(\.\d+)?)\s*(كيلو|كيلوغرام|كغم|ك|قطعة|قطعه|حبة|بطل|كارتون|علبة|علبه|شيش|كيس|طبقة|طبقه)/);
  if (matchWithUnit) return parseFloat(matchWithUnit[1]!);

  // البحث عن رقم في نهاية النص (مثل: خيار 2)
  const matchEndNumber = text.match(/(\d+(\.\d+)?)$/);
  if (matchEndNumber) return parseFloat(matchEndNumber[1]!);

  // البحث عن رقم منفصل في النص (مثل: حليب 3 موز)
  const matchMidNumber = text.match(/\s(\d+(\.\d+)?)\s/);
  if (matchMidNumber) return parseFloat(matchMidNumber[1]!);

  if (text.includes("كيلو")) return 1;
  return 1;
}

export function calculateAutoSellPrice(line: string | null | undefined, buyAlf: number): number {
  const text = (line || "").trim();
  if (!text || buyAlf <= 0) return buyAlf;

  const qty = parseQuantityFromLine(text);
  const unitBuyPrice = buyAlf / qty;

  let profitPerUnit = 0;

  // فحص اللحم أو السمك - يضاف 0.5 على كل كيلو/وحدة كحد أدنى للربح
  const isMeat = isMeatProduct(text);
  const isFish = isFishProduct(text);

  if (isMeat || isFish) {
    profitPerUnit = 0.5;
  } else {
    // قواعد التسعير العامة بناءً على سعر الوحدة
    if (unitBuyPrice <= 0.25) {
      profitPerUnit = 0;
    } else if (unitBuyPrice <= 2.25) {
      profitPerUnit = 0.25;
    } else if (unitBuyPrice <= 5.5) {
      profitPerUnit = 0.5;
    } else if (unitBuyPrice <= 15) {
      profitPerUnit = 1.0;
    } else if (unitBuyPrice <= 25) {
      profitPerUnit = 2.0;
    } else if (unitBuyPrice <= 35) {
      profitPerUnit = 2.5;
    } else if (unitBuyPrice <= 50) {
      profitPerUnit = 3.0;
    } else {
      profitPerUnit = unitBuyPrice * 0.05;
    }
  }

  const totalProfit = profitPerUnit * qty;
  const rawResult = buyAlf + totalProfit;

  // جبر الكسور لأقرب ربع (0.25)
  return Math.round(rawResult * 4) / 4;
}
