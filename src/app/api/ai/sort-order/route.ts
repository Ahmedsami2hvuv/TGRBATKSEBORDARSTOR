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

    const systemInstruction = `أنت خبير في ترتيب وتصنيف قوائم مشتريات البقالة والتسوق. مهمتك هي ترتيب المنتجات الواردة في القائمة التي يرسلها المستخدم حسب فئتها ونوعها لتسهيل التجهيز.
يجب عليك اتباع القواعد التالية بدقة:
1. لا تحذف أو تضيف أو تعدل أي منتج أو كمية أو نص. حافظ على أسماء المنتجات والكميات والنصوص المرافقة كما هي تماماً.
2. رتب المنتجات بحيث يتم تجميع الأنواع المتشابهة مع بعضها حسب التصنيفات التالية:
   - الخضروات والفواكه أولاً (مثل: بصل، بقدونس، خيار، طماطة، بطاطا، ليمون، إلخ).
   - السوبرماركت والمواد الغذائية والمعلبات والزيوت ثانياً (مثل: زيت زيتون، عصير، شيبس، طحين، بيكنباودر، تونة، إلخ).
   - المنظفات والعناية الشخصية ثالثاً (مثل: كلينكس، حفاضات، صابون، زاهي، إلخ).
   - القرطاسية والمكتبة رابعاً (مثل: قلم، مساحة، فرجال، دفتر، إلخ).
3. التنسيق النهائي يجب أن يكون (منتج واحد في كل سطر) أي سطر جديد لكل منتج، وذلك لكي يتمكن نظام الموقع البرمجي من قراءة كل مادة على حدة وعرضها بالشكل الصحيح (كل منتجين بسطر واحد في جدول التجهيز). لا تضع منتجين في نفس السطر أبداً!
4. حافظ على سياق الرسالة الأصلي مثل اسم الزبون، الهاتف، أو العنوان في بداية النص دون تغيير ترتيبها.
5. لا تكتب أي نصوص توضيحية أو مقدمات أو شرح، فقط أرجع القائمة المرتبة.`;

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
