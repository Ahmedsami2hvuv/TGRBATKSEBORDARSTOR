import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// نقطة ربط استقبال أوامر جمناي الصوتية من الهاتف/الـ Webhook
export async function POST(req: Request) {
  try {
    const body = await req.json()
    const textCommand = body.text || body.prompt || body.command || ""

    if (!textCommand) {
      return NextResponse.json({
        success: false,
        message: "لم يتم استلام أي نص أو أمر صوتي."
      }, { status: 400 })
    }

    // جلب مفاتيح Gemini المتاحة من قواعد البيانات (سوبابيس) أو متغيرات البيئة (فيرسل)
    const dbKeys = await prisma.geminiApiKey.findMany({
      where: { active: true },
      select: { key: true }
    })

    const activeKey = dbKeys[0]?.key || process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_KEY

    if (!activeKey) {
      return NextResponse.json({
        success: false,
        message: "يرجى إضافة مفتاح Gemini API في لوحة التحكم أو متغيرات فيرسل أولاً."
      }, { status: 400 })
    }

    // إرسال النص إلى Gemini لمعالجة الأمر
    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${activeKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [
                {
                  text: `أنت مساعد ذكي لإدارة الطلبات والمندوبين. حلل الأمر التالي بأسلوب عراقي وبسيط واستخرج الإجراء المطلوبة منه ثم أجب باختصار لجهاز الموبايل: "${textCommand}"`
                }
              ]
            }
          ]
        })
      }
    )

    const geminiData = await geminiRes.json()
    const replyText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || "تم استلام أمرك بنجاح وجاري معالجته."

    return NextResponse.json({
      success: true,
      commandReceived: textCommand,
      reply: replyText
    })
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message || "حدث خطأ أثناء معالجة أمر Gemini الصوتي"
    }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({
    status: "online",
    message: "نقطة ربط Gemini للأوامر الصوتية تعمل بنجاح!"
  })
}
