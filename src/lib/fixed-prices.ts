const ARABIC_DIGITS = [..."٠١٢٣٤٥٦٧٨٩"];

export function normalizeText(s: string) {
    if (!s) return "";
    let res = s;
    for (let i = 0; i < 10; i++) {
        res = res.replace(new RegExp(ARABIC_DIGITS[i]!, "g"), String(i));
    }
    return res.replace(/ـ/g, "").replace(/\s+/g, " ").trim();
}

export function parseQuantityKg(text: string): number | null {
    const t = normalizeText(text);
    if (!t) return null;

    let m = t.match(/(\d+(?:\.\d+)?)\s*(?:ك|كغم|كيلو)?\s*(?:و\s*)?(?:نص|نصف)(?:ك)?\b/);
    if (m) return parseFloat(m[1]!) + 0.5;

    m = t.match(/(\d+(?:\.\d+)?)\s*(?:ك|كغم|كيلو)?\s*(?:و\s*)?(?:ربع)(?:ك)?\b/);
    if (m) return parseFloat(m[1]!) + 0.25;

    m = t.match(/(\d+(?:\.\d+)?)\s*(?:ك|كغم|كيلو)?\s*(?:و\s*)?(?:ثلاث\s*ارباع|ثلث\s*ارباع|3\s*ارباع)(?:ك)?\b/);
    if (m) return parseFloat(m[1]!) + 0.75;

    if (/ربع\s*(?:ك|كيلو)?/.test(t)) return 0.25;
    if (/ثلاث\s*ارباع|3\s*ارباع|ثلث\s*ارباع/.test(t)) return 0.75;
    
    if (/(كيلو|ك)\s*و?\s*نص/.test(t)) return 1.5;
    if (/\b1\s*(كيلو|ك)\s*و?\s*نص\b/.test(t)) return 1.5;
    
    if (/\bكيلوين\b/.test(t)) return 2.0;
    if (/\bثلاث\s*كيلو\b/.test(t)) return 3.0;

    if (/نص\s*(?:ك|كيلو)?/.test(t)) return 0.5;

    m = t.match(/(\d+(?:\.\d+)?)\s*(?:ك|كغم|كيلو)\b/);
    if (m) return parseFloat(m[1]!);

    m = t.match(/\b(\d+(?:\.\d+)?)\b/);
    if (m) return parseFloat(m[1]!);

    return null;
}

export function suggestFixedPrices(_text: string) {
    // تم إلغاء نظام التسعير التلقائي الثابت للحوم بناءً على طلب صاحب المشروع
    return null;
}
