/**
 * وحدة البحث الذكي المتقدم والشامل لدفتر الديون
 * توفر تطبيعاً فائق الدقة للنصوص العربية والأرقام والكلمات المفتاحية
 */

/** تطبيع نص عربي وأرقام للمقارنة الدقيقة والذكية */
export function normalizeSearchText(s: string | null | undefined): string {
  if (!s) return "";
  let t = s.normalize("NFKC");
  
  // تحويل الأرقام العربية الشرقية (الهندية) إلى إنجليزية
  t = t.replace(/[٠-٩]/g, (d) => "٠١٢٣٤٥٦٧٨٩".indexOf(d).toString());
  
  // إزالة التشكيل والتنوين والشدة والسكون
  t = t.replace(/[\u064B-\u065F\u0670\u06D6-\u06ED]/g, "");
  
  // توحيد الهمزات والألفات
  t = t.replace(/[أإآٱء]/g, "ا");
  t = t.replace(/ى/g, "ي");
  t = t.replace(/ة/g, "ه");
  t = t.replace(/ؤ/g, "و");
  t = t.replace(/ئ/g, "ي");
  t = t.replace(/ـ/g, ""); // كشيدة
  
  // استبدال الرموز الخاصة بمسافات لضمان عدم التصاق الكلمات
  t = t.replace(/[\-_#|/\\(),:;.+*&^%$@!~?><"{}[\]]/g, " ");
  
  // توحيد المسافات
  t = t.replace(/\s+/g, " ").trim().toLowerCase();
  
  return t;
}

/**
 * فحص تطابق ذكي وشامل بين نص هدف واستعلام بحث
 * يضمن فحص كل كلمة في الاستعلام داخل النص الهدف مع دعم "ال" التعريف والأرقام والكلمات المركبة
 */
export function smartMatches(targetText: string | null | undefined, query: string): boolean {
  if (!query || !query.trim()) return true;
  if (!targetText) return false;

  const normTarget = normalizeSearchText(targetText);
  const normQuery = normalizeSearchText(query);

  if (!normQuery) return true;

  // مطابقة تامة أو مباشرة للجملة كاملة
  if (normTarget.includes(normQuery)) return true;

  const tokens = normQuery.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return true;

  // يجب أن تتطابق كل كلمة من كلمات البحث في النص الهدف
  return tokens.every((token) => {
    // 1. مطابقة مباشرة للكلمة
    if (normTarget.includes(token)) return true;

    // 2. إذا كانت الكلمة تبدأ بـ "ال" والهدف بدون "ال" (مثال: بحث "السمتي" والهدف "سمتي")
    if (token.startsWith("ال") && token.length > 3) {
      const stripped = token.slice(2);
      if (normTarget.includes(stripped)) return true;
    }

    // 3. إذا كان النص الهدف يحتوي على "ال" والبحث بدون "ال" (مثال: بحث "سمتي" والهدف "السمتي")
    const withAl = "ال" + token;
    if (normTarget.includes(withAl)) return true;

    return false;
  });
}
