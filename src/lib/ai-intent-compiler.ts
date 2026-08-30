import { prisma } from "./prisma";
import { getAllActiveGeminiKeys, markGeminiKeySuccess } from "./gemini-pool";

export interface LearnedIntentResult {
  category: string;
  order_number?: number | null;
  shop_name?: string | null;
  region_name?: string | null;
  courier_name?: string | null;
  phone?: string | null;
  price?: number | null;
  field?: string | null;
  status?: string | null;
  raw_text: string;
  isLearned?: boolean;
}

function normalizeArabic(text: string): string {
  return text
    .replace(/أ|إ|آ/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()؟?]/g, "")
    .trim()
    .toLowerCase();
}

export async function findMatchingLearnedRule(userText: string): Promise<LearnedIntentResult | null> {
  try {
    const cleanText = normalizeArabic(userText);
    if (!cleanText) return null;

    const validOrderNums = (userText.match(/\b\d{3,5}\b/g) || [])
      .map(Number)
      .filter(n => !n.toString().startsWith("07") && !n.toString().startsWith("77"));
    const currentOrderNum = validOrderNums.length > 0 ? validOrderNums[0] : null;

    const phoneMatch = userText.match(/(?:07\d{9}|07\d{2}\s*\d{7,8}|\d{10,11})/);
    const currentPhone = phoneMatch ? phoneMatch[0].replace(/\s+/g, "") : null;

    const allRules = await (prisma as any).aiLearnedRule.findMany({
      where: { isActive: true },
      orderBy: { hitCount: "desc" },
      take: 100,
    });

    for (const rule of allRules) {
      const pattern = normalizeArabic(rule.triggerPattern);
      let isMatch = false;

      if (cleanText.includes(pattern) || pattern.includes(cleanText)) {
        isMatch = true;
      }

      if (!isMatch && rule.examples && Array.isArray(rule.examples)) {
        for (const ex of rule.examples) {
          const cleanEx = normalizeArabic(String(ex));
          if (cleanText.includes(cleanEx) || cleanEx.includes(cleanText)) {
            isMatch = true;
            break;
          }
        }
      }

      if (isMatch) {
        await (prisma as any).aiLearnedRule.update({
          where: { id: rule.id },
          data: {
            hitCount: { increment: 1 },
            updatedAt: new Date(),
          },
        }).catch(() => {});

        const actionData = (rule.extractedAction as any) || {};

        return {
          category: rule.intentCategory,
          order_number: currentOrderNum || actionData.order_number || null,
          phone: currentPhone || actionData.phone || null,
          shop_name: actionData.shop_name || null,
          region_name: actionData.region_name || null,
          courier_name: actionData.courier_name || null,
          price: actionData.price || null,
          status: actionData.status || null,
          raw_text: userText,
          isLearned: true,
        };
      }
    }
  } catch (e) {
    console.error("Error finding learned rule:", e);
  }
  return null;
}

export async function compileAndSaveNewIntent(
  userText: string,
  extraContext?: { shops?: string[]; couriers?: string[]; regions?: string[] }
): Promise<LearnedIntentResult | null> {
  try {
    const keys = await getAllActiveGeminiKeys();
    if (keys.length === 0) return null;

    const selectedKey = keys[0];
    const systemPrompt = `أنت العقل المدبر ومصمم الأوامر لمنظومة التوصيل وإدارة الطلبات (تطبيق أبو الأكبر).
مهمتك: قراءة كلام وأمر أبو الأكبر المنطوق أو المكتوب، وفهم نيته بدقة، واستخراج المتغيرات، وتصنيف النية إلى إحدى الفئات التالية حصراً:

الفئات المتاحة:
1. "orders_bulk_archive": أرشفة طلبات جماعية لمندوب أو محل أو حالة معينة (مثال: كل طلبات في المندوب احمد المسلمه سوي لهن ارشفه، ارشف طلبات فارس، سوي ارشفة للطلبات المسلمة).
2. "pending_orders_list": طلب عرض الطلبات الجديدة أو المعلقة (مثال: الطلبات الجديدة، اريد اعرف الطلبات الجديدة، شكو طلبات معلقة).
3. "last_order_details": طلب تفاصيل آخر أو أحدث طلب في النظام (مثال: اخر طلب، شنو اخر طلب، انطيني اخر طلب دخل).
4. "order_create": إنشاء أو إضافة طلب جديد (مثال: سوي لي طلب جديد، ضيف طلب، طلب من محل كذا الى كذا).
5. "order_unassign": إلغاء إسناد طلب أو إرجاعه لحالة جديد (مثال: الغي الاسناد، رجعه لحالة جديد، سوي جديد لطلب كذا).
6. "order_details": استعلام عن تفاصيل طلب محدد برقم (مثال: تفاصيل طلب 2067، معلومات طلب رقم 2042).
7. "dynamic_assign_order": إسناد طلب إلى كابتن أو مندوب (مثال: اسند طلب 2054 الى فارس، حوله للمندوب boos).
8. "daily_summary_report": طلب ملخص اليوم أو الأرباح أو تقرير اليوم (مثال: ملخص اليوم، شكد ارباحنا اليوم).
9. "order_cancel_or_reject": رفض أو إلغاء طلب (مثال: ارفض طلب 2054، طير الطلب، سوي مرفوض، ارفض الطلب).
10. "focused_order_edit": تعديل سعر أو رقم هاتف أو منطقة أو نوع لطلب معين (مثال: غير السعر الى 15، عدل نوع الطلب سويه مسواق).
11. "get_learned_rules_list": استعلام القواعد المبرمجة والمخزنة في سوبابيس (مثال: شنو القواعد المخزنة بسوبابيس، شلون اتاكد انه الذكاء ديبرمج اوامر).

سياق النظام:
- المحلات المتاحة: ${(extraContext?.shops || []).join(", ") || "عام"}
- المندوبين المتاحين: ${(extraContext?.couriers || []).join(", ") || "عام"}
- المناطق المتاحة: ${(extraContext?.regions || []).join(", ") || "عام"}

أجب بصيغة JSON فقط بهذا الشكل:
{
  "category": "اسم الفئة من القائمة أعلاه",
  "order_number": رقم الطلب كرقم صحيح إذا ذكر وإلا null,
  "shop_name": "اسم المحل إذا ذكر وإلا null",
  "region_name": "اسم المنطقة إذا ذكرت وإلا null",
  "courier_name": "اسم المندوب إذا ذكر وإلا null",
  "price": السعر كرقم إذا ذكر وإلا null,
  "phone": "رقم الهاتف إذا ذكر وإلا null",
  "status": "الحالة إذا ذكرت مثل completed أو pending وإلا null",
  "pattern_key": "عبارة مفتاحية مختصرة تمثل هذا النمط بالعامية ليتم حفظها والتعلم منها مستقبلاً"
}`;

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${selectedKey.key}`;
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [
              { text: systemPrompt },
              { text: `نص وأمر أبو الأكبر هو: "${userText}"` },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.1,
          responseMimeType: "application/json",
        },
      }),
    });

    if (!response.ok) {
      console.warn("Gemini Intent Compiler failed with status:", response.status);
      return null;
    }

    const data = await response.json();
    const candidateText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!candidateText) return null;

    await markGeminiKeySuccess(selectedKey.id);

    const parsedJson = JSON.parse(candidateText);
    if (!parsedJson.category) return null;

    const patternKey = normalizeArabic(parsedJson.pattern_key || userText.slice(0, 40));

    try {
      const existing = await (prisma as any).aiLearnedRule.findUnique({
        where: { triggerPattern: patternKey },
      });

      if (existing) {
        const existingExamples = Array.isArray(existing.examples) ? (existing.examples as string[]) : [];
        if (!existingExamples.includes(userText)) {
          existingExamples.push(userText);
        }
        await (prisma as any).aiLearnedRule.update({
          where: { id: existing.id },
          data: {
            intentCategory: parsedJson.category,
            examples: existingExamples,
            hitCount: { increment: 1 },
            updatedAt: new Date(),
          },
        });
      } else {
        await (prisma as any).aiLearnedRule.create({
          data: {
            triggerPattern: patternKey,
            intentCategory: parsedJson.category,
            extractedAction: {
              shop_name: parsedJson.shop_name,
              region_name: parsedJson.region_name,
              courier_name: parsedJson.courier_name,
              price: parsedJson.price,
              status: parsedJson.status,
            },
            examples: [userText],
            hitCount: 1,
            isActive: true,
          },
        });
      }
      console.log(`✅ تم حفظ وبرمجة قاعدة ذكاء جديدة في سوبابيس للنمط: "${patternKey}" -> ${parsedJson.category}`);
    } catch (dbErr) {
      console.warn("Failed to store learned rule in database:", dbErr);
    }

    return {
      category: parsedJson.category,
      order_number: parsedJson.order_number ? Number(parsedJson.order_number) : null,
      shop_name: parsedJson.shop_name || null,
      region_name: parsedJson.region_name || null,
      courier_name: parsedJson.courier_name || null,
      phone: parsedJson.phone || null,
      price: parsedJson.price ? Number(parsedJson.price) : null,
      status: parsedJson.status || null,
      raw_text: userText,
      isLearned: true,
    };
  } catch (e) {
    console.error("compileAndSaveNewIntent Error:", e);
    return null;
  }
}
