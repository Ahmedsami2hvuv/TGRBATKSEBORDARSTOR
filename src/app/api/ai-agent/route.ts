import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

const GEMINI_KEYS = [
  process.env.GEMINI_API_KEY,
  process.env.GEMINI_API_KEY_2,
  process.env.GEMINI_API_KEY_3,
  process.env.NEXT_PUBLIC_GEMINI_KEY
].filter(Boolean) as string[]

const GEMINI_KEY = GEMINI_KEYS[0] || process.env.GEMINI_API_KEY

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}))
    const prompt = (body.prompt || body.message || body.text || "").trim()

    if (!prompt) {
      return NextResponse.json({ done: false, message: "يرجى كتابة طلبك أو الأمر المراد تنفيذه." })
    }

    // 1. جيب سكيما قاعدة البيانات الحقيقية
    let tables: any = []
    let columns: any = []
    let ridersSample: any = []
    let ordersSample: any = []

    try {
      tables = await prisma.$queryRaw`SELECT table_name FROM information_schema.tables WHERE table_schema='public'`
    } catch (e) {
      tables = []
    }

    try {
      columns = await prisma.$queryRaw`SELECT table_name, column_name, data_type FROM information_schema.columns WHERE table_schema='public'`
    } catch (e) {
      columns = []
    }

    try {
      ridersSample = await prisma.courier.findMany({ take: 3 })
    } catch (e) {
      try {
        ridersSample = await (prisma as any).user?.findMany({ take: 3 })
      } catch {}
    }

    try {
      ordersSample = await prisma.order.findMany({ take: 2 })
    } catch (e) {
      ordersSample = []
    }

    const schemaContext = `
  انت وكيل ذكي عايش داخل Supabase لنظام ابو الاكبر للتوصيل.
  لا يوجد لديك اوامر جاهزة. مهمتك تستكشف وتفهم وتنفذ.

  السكيما الحقيقية:
  الجداول: ${JSON.stringify(tables)}
  اعمدة الجداول: ${JSON.stringify(columns)}
  عينة مندوبين: ${JSON.stringify(ridersSample)}
  عينة طلبات: ${JSON.stringify(ordersSample)}

  الكود المتاح في النظام: عندك صفحات انشاء طلب، اخفاء مندوب يعني تغيير isActive او isHidden او status.

  المستخدم كتب: "${prompt}"

  فكر خطوة بخطوة بالعربي:
    1. منو او شنو يقصد المستخدم؟ دور عنه في الجداول
    2. شنو معنى الفعل اللي يريده (اخفي، سوي، صفر) في سياق النظام؟
    3. شنو الحقول اللي لازم تغيرها؟
    4. شنو الـ SQL اللي راح تنفذه؟

  ارجع JSON فقط بدون اي علامات markdown او نصوص خارج الـ JSON:
  {
    "reasoning": "تفكيرك: لقيت فارس في جدول المناديب، اخفاء معناها تعديل حالته",
    "searchQueries": ["SELECT * FROM \\"Courier\\" WHERE name LIKE '%فارس%'"],
    "action": "UPDATE",
    "sql": "UPDATE \\"Courier\\" SET \\"isActive\\"=false WHERE name LIKE '%فارس%'",
    "needMoreInfo": false,
    "askUser": "اذا تحتاج تسأل المستخدم",
    "finalMessage": "رسالة نهائية للعرض"
  }

  اذا الامر "سوي طلب": لا تنشئ SQL، ارجع needMoreInfo=true و askUser="شنو نوع الطلب؟ من الادارة/وجهتين/من محل/تجهيز؟" لان انشاء الطلب يحتاج واجهة
  `

    let data: any = null
    const models = ["gemini-1.5-flash", "gemini-2.0-flash", "gemini-flash-latest"]
    
    for (let k = 0; k < (GEMINI_KEYS.length || 1); k++) {
      const activeKey = GEMINI_KEYS[k] || GEMINI_KEY
      for (const model of models) {
        try {
          const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${activeKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: [{ text: schemaContext }] }] })
          })
          if (res.ok) {
            data = await res.json()
            if (data?.candidates?.[0]?.content?.parts?.[0]?.text) break
          }
        } catch (e) {}
      }
      if (data?.candidates?.[0]?.content?.parts?.[0]?.text) break
    }

    if (!data || !data.candidates?.[0]?.content?.parts?.[0]?.text) {
      return NextResponse.json({ done: false, message: "تعذر الاتصال بمحرك الذكاء الاصطناعي حالياً، يرجى المحاولة بعد لحظات." })
    }

    let txt = data.candidates[0].content.parts[0].text.replace(/```json|```/g, "").trim()
    
    // استخراج كائن الـ JSON إذا وجد نصوص إضافية
    const firstBrace = txt.indexOf('{')
    const lastBrace = txt.lastIndexOf('}')
    if (firstBrace !== -1 && lastBrace !== -1) {
      txt = txt.substring(firstBrace, lastBrace + 1)
    }

    let decision: any = {}
    try {
      decision = JSON.parse(txt)
    } catch (e) {
      return NextResponse.json({ done: false, message: `استجابة الذكاء الاصطناعي: ${txt}` })
    }

    // 2. نفذ استكشاف البحث اولا
    if (decision.searchQueries && Array.isArray(decision.searchQueries)) {
      for (const q of decision.searchQueries) {
        try {
          await prisma.$queryRawUnsafe(q)
        } catch (e) {}
      }
    }

    // 3. نفذ الفعل اذا موجود
    if (decision.sql && decision.action !== "NONE") {
      try {
        await prisma.$queryRawUnsafe(decision.sql)
        return NextResponse.json({
          done: true,
          message: `تم ✅ ${decision.reasoning || ""} - ${decision.finalMessage || ""}`,
          sql: decision.sql,
          reasoning: decision.reasoning
        })
      } catch (e: any) {
        return NextResponse.json({
          done: false,
          message: `فهمت قصدك: ${decision.reasoning || ""} بس فشل التنفيذ: ${e.message}. السكيما: ${JSON.stringify(columns).slice(0, 500)}`,
          sql: decision.sql
        })
      }
    }

    return NextResponse.json({
      done: false,
      needType: decision.needMoreInfo,
      message: decision.askUser || decision.finalMessage || decision.reasoning || "تم استلام الطلب",
      reasoning: decision.reasoning
    })
  } catch (error: any) {
    return NextResponse.json({ done: false, message: `حدث خطأ في معالجة الطلب: ${error.message}` }, { status: 500 })
  }
}
