import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type PortalKey = "admin" | "mandoub" | "preparer" | "store";
type TrainingItem = {
  id: string;
  title: string;
  instruction: string;
  isActive: boolean;
};

function detectPortal(context: any): PortalKey {
  const role = String(context?.role || "").toLowerCase();
  const path = String(context?.path || "").toLowerCase();
  if (role === "admin" || path.includes("/admin")) return "admin";
  if (role === "preparer" || path.includes("/preparer")) return "preparer";
  if (role === "courier" || role === "mandoub" || path.includes("/mandoub")) return "mandoub";
  return "store";
}

function sanitizeTrainingList(raw: any): TrainingItem[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((it) => ({
      id: String(it?.id || "").trim(),
      title: String(it?.title || "").trim(),
      instruction: String(it?.instruction || "").trim(),
      isActive: it?.isActive !== false,
    }))
    .filter((it) => it.id && it.instruction && it.isActive);
}

function basePromptByPortal(portal: PortalKey, productsText: string): string {
  if (portal === "admin") {
    return `أنت مساعد خاص ببوابة الإدارة.
مهمتك مساعدة المدير داخل النظام: ترتيب المهام، توضيح الخطوات، واقتراح التنقل المناسب داخل صفحات الإدارة.
إذا كان طلب المستخدم يحتاج فتح صفحة معينة، أرجع أمر NAVIGATE فقط مع رابط داخلي آمن يبدأ بـ /admin.
تكلم بلهجة عراقية واضحة ومهنية.`;
  }

  if (portal === "preparer") {
    return `أنت مساعد خاص ببوابة المجهز.
مهمتك مساعدة المجهز في تجهيز الطلبات: فهم الطلب، ترتيب الخطوات، والتنبيه على النقاط المهمة.
إذا كان مناسب فتح طلب/تجهيز، تقدر تستخدم OPEN_ORDER مع رقم/معرف الطلب.
تكلم بلهجة عراقية عملية ومختصرة.`;
  }

  if (portal === "mandoub") {
    return `أنت مساعد خاص ببوابة المندوب.
مهمتك مساعدة المندوب بالتوصيل: ترتيب المشوار، متابعة الحالة، وتذكير بنقاط التسليم والتحصيل.
إذا كان مناسب فتح طلب، تقدر تستخدم OPEN_ORDER.
تكلم بلهجة عراقية ميدانية بسيطة.`;
  }

  return `أنت "مساعد مبيعات أبو الأكبر". مهمتك تحويل القائمة المكتوبة إلى سلة تسوق.

المنتجات المتوفرة حالياً في المتجر والتي تشبه طلب المستخدم:
${productsText}

طريقة العمل:
1. حلل القائمة: استخرج الاسم، الرقم، وكل مادة.
2. المواد الواضحة (مثل موز، خيار): إذا وجدتها مطابقة تماماً لمنتج واحد، أرسل أمر ADD_TO_CART.
3. المواد المتعددة (مثل لبن، كيك): إذا وجدتها تحتمل أكثر من منتج، اعرض الخيارات للمستخدم واطلب منه الاختيار.
4. المعلومات الشخصية: احفظ الاسم والرقم في ذاكرتك.

الأوامر التنفيذية (يمكنك إرسال مصفوفة JSON أو كائن واحد):
- إضافة للسلة: {"type": "ADD_TO_CART", "payload": {"id": "ID", "name": "Name", "price": 0}}
- اقتراح خيارات: {"type": "SHOW_OPTIONS", "payload": {"items": [{"id": "", "name": ""}]}}
- اكمال الطلب: {"type": "ASK_ADDRESS", "payload": {}}`;
}

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

    const portal = detectPortal(context);
    const trainingRow = await prisma.uISystemSetting.findUnique({
      where: { target_section: { target: "global", section: "ai_portal_training" } },
    });
    const byPortal = (trainingRow?.config as any)?.byPortal || {};
    const activePortalTraining = sanitizeTrainingList(byPortal[portal]);
    const portalTrainingPrompt =
      activePortalTraining.length > 0
        ? `\nتعليمات التدريب الخاصة بالبوابة الحالية (${portal}):\n${activePortalTraining
            .map((t, idx) => `${idx + 1}. ${t.title ? `[${t.title}] ` : ""}${t.instruction}`)
            .join("\n")}\n`
        : "";

    const productsText = allMatchedProducts
      .map((p) => `- [${p.name}] في فرع [${p.branch.name}] بسعر ${p.salePrice} (ID: ${p.id})`)
      .join("\n");
    const basePrompt = basePromptByPortal(portal, productsText);
    const agentSystemPrompt = `${basePrompt}
${portalTrainingPrompt}
تكلم بلهجة عراقية مناسبة للبوابة الحالية وبشكل مختصر وواضح.`;

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
