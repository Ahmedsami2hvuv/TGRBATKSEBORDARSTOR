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

export function suggestFixedPrices(text: string) {
    const t = normalizeText(text).toLowerCase();
    if (!t) return null;
    
    let base = "";
    if (t.includes("مثروم") || t.includes("مفروم")) base = "مثروم";
    else if (t.includes("شرح") || t.includes("شرائح")) base = "شرح";
    else if (t.includes("عظم")) base = "عظم";
    else if (t.includes("عصفور")) base = "عصفورة";
    else if (t.includes("فكار")) base = "فكارة";
    else if (t.includes("باجه") || t.includes("باجة")) base = "باجة";
    else if (t.includes("شحم")) base = "شحم";
    else if (t.includes("لحم")) base = "شرح"; // الافتراضي للحم هو شرح إذا لم يحدد
    else return null;

    // الأسعار الجديدة حسب طلبك
    const DEFAULT_MEAT_PRICES_PER_KG = {
        "شرح": { buy: 14.0, sell: 18.0 },
        "مثروم": { buy: 14.0, sell: 18.0 },
        "عظم": { buy: 13.0, sell: 16.0 },
        "فكارة": { buy: 13.0, sell: 16.0 },
        "عصفورة": { buy: 13.0, sell: 16.0 },
        "شحم": { buy: 0, sell: 0 }, // سيتم تحديثها لاحقاً
        "باجة": { buy: 0, sell: 0 }, // سيتم تحديثها لاحقاً
    };

    const table = DEFAULT_MEAT_PRICES_PER_KG[base as keyof typeof DEFAULT_MEAT_PRICES_PER_KG];
    if (!table) return null;

    const qty = parseQuantityKg(text) ?? 1.0;
    
    return {
        base,
        qty_kg: qty,
        buyAlf: table.buy * qty,
        sellAlf: table.sell * qty,
    };
}
