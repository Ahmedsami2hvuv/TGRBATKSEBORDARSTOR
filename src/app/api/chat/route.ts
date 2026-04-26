import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  try {
    const { prompt, history, context } = await req.json();

    const activeConfigs = await prisma.aIConfig.findMany({
      where: { isActive: true },
      orderBy: { usedToday: 'asc' }
    });

    if (activeConfigs.length === 0) return NextResponse.json({ text: "لا توجد مفاتيح." });

    // 1. استخراج الكلمات المفتاحية للبحث عن المنتجات
    const lines = prompt.split("\n");
    const searchKeywords = lines.flatMap((l: string) => l.split(" ")).filter((w: string) => w.length > 2);

    const allMatchedProducts = await prisma.storeProduct.findMany({
      where: {
        OR: searchKeywords.map((k: string) => ({
          OR: [
            { name: { contains: k, mode: 'insensitive' } },
            { description: { contains: k, mode: 'insensitive' } },
            { branch: { name: { contains: k, mode: 'insensitive' } } }
          ]
        })),
        active: true
      },
      include: { branch: true }
    });

    const agentSystemPrompt = `أنت "مساعد مبيعات أبو الأكبر". مهمتك تحويل القائمة المكتوبة إلى سلة تسوق.

    المنتجات المتوفرة حالياً في المتجر والتي تشبه طلب المستخدم:
    ${allMatchedProducts.map(p => `- [${p.name}] في فرع [${p.branch.name}] بسعر ${p.salePrice} (ID: ${p.id})`).join("\n")}

    طريقة العمل:
    1. حلل القائمة: استخرج الاسم، الرقم، وكل مادة.
    2. المواد الواضحة (مثل موز، خيار): إذا وجدتها مطابقة تماماً لمنتج واحد، أرسل أمر ADD_TO_CART.
    3. المواد المتعددة (مثل لبن، كيك): إذا وجدتها تحتمل أكثر من منتج، اعرض الخيارات للمستخدم واطلب منه الاختيار.
    4. المعلومات الشخصية: احفظ الاسم والرقم في ذاكرتك.

    الأوامر التنفيذية (يمكنك إرسال مصفوفة JSON أو كائن واحد):
    - إضافة للسلة: {"type": "ADD_TO_CART", "payload": {"id": "ID", "name": "Name", "price": 0}}
    - اقتراح خيارات: {"type": "SHOW_OPTIONS", "payload": {"items": [{"id": "", "name": ""}]}}
    - اكمال الطلب: {"type": "ASK_ADDRESS", "payload": {}}

    تكلم بلهجة عراقية محببة (مثلاً: "تدلل عيوني، نزلت الخيار والموز بالسلة، بس اللبن بي أنواع، يا نوع تحب؟")`;

    for (const config of activeConfigs) {
      try {
        const isGemini = config.provider === "gemini";
        const url = isGemini
          ? `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${config.apiKey}`
          : "https://api.groq.com/openai/v1/chat/completions";

        const body = isGemini ? {
          contents: [{ parts: [{ text: agentSystemPrompt + "\n\nسياق: " + JSON.stringify(context) + "\nالمستخدم أرسل قائمة:\n" + prompt }] }]
        } : {
          model: "llama-3.3-70b-versatile",
          messages: [{ role: "system", content: agentSystemPrompt }, { role: "user", content: prompt }]
        };

        const response = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...(isGemini ? {} : { "Authorization": `Bearer ${config.apiKey}` }) },
          body: JSON.stringify(body)
        });

        const data = await response.json();
        const fullText = isGemini ? data.candidates?.[0]?.content?.parts?.[0]?.text : data.choices?.[0]?.message?.content;

        if (fullText) {
          // استخراج كافة الأوامر من النص (قد يرسل الذكاء أكثر من أمر)
          const actions = [];
          const matches = fullText.matchAll(/\{"type":.*?\}/g);
          for (const match of matches) {
            try { actions.push(JSON.parse(match[0])); } catch(e){}
          }

          await prisma.aIConfig.update({ where: { id: config.id }, data: { usedToday: { increment: 1 } } });
          return NextResponse.json({
            text: fullText.replace(/\{"type":.*?\}/g, "").trim(),
            actions: actions.length > 0 ? actions : null
          });
        }
      } catch (err) { continue; }
    }
    return NextResponse.json({ text: "المحرك مشغول حالياً." });
  } catch (error) {
    return NextResponse.json({ text: "خطأ فني." }, { status: 500 });
  }
}
