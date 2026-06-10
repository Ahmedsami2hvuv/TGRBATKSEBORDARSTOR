import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  try {
    const { text } = await req.json();
    if (!text || typeof text !== "string" || !text.trim()) {
      return NextResponse.json({ error: "النص فارغ" }, { status: 400 });
    }

    // جلب مفتاح جمناي المفعّل
    const config = await prisma.aIConfig.findFirst({
      where: {
        isActive: true,
        provider: "gemini"
      },
      orderBy: { usedToday: "asc" }
    });

    if (!config) {
      return NextResponse.json({ error: "لا يوجد مفتاح جمناي مفعّل حالياً في الموقع." }, { status: 404 });
    }

    const systemInstruction = `أنت خبير في ترتيب وتصنيف قوائم مشتريات البقالة والتسوق. مهمتك هي ترتيب المنتجات الواردة في القائمة التي يرسلها المستخدم حسب فئتها ونوعها (مثال: الخضروات والفواكه أولاً، ثم المعلبات، ثم المواد الغذائية الأخرى، ثم الأدوات المكتبية، وهكذا) لتسهيل التجهيز.
يجب عليك اتباع القواعد التالية بدقة:
1. لا تحذف أو تضيف أو تعدل أي منتج أو كمية. حافظ على أسماء المنتجات والكميات كما هي تماماً.
2. رتب المنتجات بحيث يتم تجميع الأنواع المتشابهة مع بعضها.
3. التنسيق النهائي يجب أن يحتوي على كل منتجين في سطر واحد مفصولين بـ " - " (مثال: طماطة 2 كيلو - خيار 1 كيلو). إذا كان عدد المنتجات الإجمالي فردياً، يمكن أن يحتوي السطر الأخير على منتج واحد فقط.
4. لا تكتب أي نصوص توضيحية أو مقدمات أو شرح، فقط أرجع القائمة المرتبة.`;

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${config.apiKey}`;

    const body = {
      system_instruction: { parts: [{ text: systemInstruction }] },
      contents: [{ role: "user", parts: [{ text: text }] }]
    };

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });

    const data = await response.json();
    const sortedText = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!sortedText) {
      return NextResponse.json({ error: "فشل استجابة الذكاء الاصطناعي" }, { status: 500 });
    }

    // تحديث عدد مرات الاستخدام اليومي
    await prisma.aIConfig.update({
      where: { id: config.id },
      data: { usedToday: { increment: 1 } }
    });

    return NextResponse.json({ sortedText: sortedText.trim() });
  } catch (error) {
    console.error("Sort order error:", error);
    return NextResponse.json({ error: "خطأ فني أثناء الترتيب" }, { status: 500 });
  }
}
