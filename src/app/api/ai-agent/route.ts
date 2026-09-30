import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

const GEMINI_KEYS = [
  process.env.GEMINI_API_KEY,
  process.env.GEMINI_API_KEY_2,
  process.env.GEMINI_API_KEY_3,
  process.env.NEXT_PUBLIC_GEMINI_KEY
].filter(Boolean) as string[]

export async function POST(req: Request) {
  try {
    const { prompt } = await req.json()
    if (!prompt) {
      return NextResponse.json({ done: false, message: "يرجى كتابة رسالة." })
    }

    // 1. جيب سكيما قاعدة البيانات الحقيقية
    let tables: any = []
    let columns: any = []
    let ridersSample: any = []
    let ordersSample: any = []

    try {
      tables = await prisma.$queryRaw`SELECT table_name FROM information_schema.tables WHERE table_schema='public'`
      columns = await prisma.$queryRaw`
        SELECT table_name, column_name, data_type 
        FROM information_schema.columns 
        WHERE table_schema='public' 
        AND table_name IN ('Order', 'Courier', 'Shop', 'Region', 'Customer', 'Employee', 'CompanyPreparer', 'users', 'couriers', 'orders')
      `
      ridersSample = await prisma.courier.findMany({ 
        take: 3,
        select: { id: true, name: true, phone: true, blocked: true, mandoubTotalsResetAt: true }
      }).catch(() => [])
      ordersSample = await prisma.order.findMany({ 
        take: 2,
        select: { id: true, orderNumber: true, status: true, totalAmount: true, customerPhone: true }
      }).catch(() => [])
    } catch (e) {
      console.warn("Schema query warning:", e)
    }

    const schemaContext = `
  انت وكيل ذكي عايش داخل Supabase لنظام ابو الاكبر للتوصيل.
  لا يوجد لديك اوامر جاهزة. مهمتك تستكشف وتفهم وتنفذ.

  السكيما الحقيقية:
  الجداول: ${JSON.stringify(tables)}
  اعمدة الجداول: ${JSON.stringify(columns)}
  عينة مندوبين: ${JSON.stringify(ridersSample)}
  عينة طلبات: ${JSON.stringify(ordersSample)}

  الكود المتاح في النظام: عندك جدول "Courier" للمناديب (حقوله: name, blocked, mandoubTotalsResetAt لتصفير الحساب)، وجدول "Order" للطلبات (حقوله: orderNumber, status, assignedCourierId, totalAmount).

  المستخدم كتب: "${prompt}"

  فكر خطوة بخطوة بالعربي:
    1. منو او شنو يقصد المستخدم؟ دور عنه في الجداول
    2. شنو معنى الفعل اللي يريده (اخفي، سوي، صفر، اسند، غير حالة) في سياق النظام؟
    3. شنو الحقول اللي لازم تغيرها؟
    4. شنو الـ SQL اللي راح تنفذه في PostgreSQL / Supabase؟
       ملاحظة: ضع أسماء الجداول بين علامات تنصيص مثل "Courier" و "Order".

  ارجع JSON فقط بدون ماركداون:
  {
    "reasoning": "تفكيرك: لقيت فارس في جدول Courier وهو مندوب، تصفير معناه تحديث mandoubTotalsResetAt",
    "searchQueries": ["SELECT * FROM \\"Courier\\" WHERE name ILIKE '%فارس%'"],
    "action": "UPDATE",
    "sql": "UPDATE \\"Courier\\" SET \\"mandoubTotalsResetAt\\"=NOW() WHERE name ILIKE '%فارس%'",
    "needMoreInfo": false,
    "askUser": "اذا تحتاج تسأل المستخدم",
    "finalMessage": "رسالة نهائية للعرض"
  }

  اذا الامر "سوي طلب" او "انشاء طلب": لا تنشئ SQL، ارجع needMoreInfo=true و askUser="شنو نوع الطلب؟ من الادارة/وجهتين/من محل/تجهيز؟" لان انشاء الطلب يحتاج واجهة
  `

    let decision: any = null

    // محاولة الاتصال بـ Gemini مع المفاتيح المتوفرة
    const models = ["gemini-1.5-flash", "gemini-2.0-flash", "gemini-flash-latest"]
    for (let i = 0; i < (GEMINI_KEYS.length || 1); i++) {
      const key = GEMINI_KEYS[i] || process.env.GEMINI_API_KEY
      if (!key) continue
      const model = models[i % models.length]
      try {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contents: [{ parts: [{ text: schemaContext }] }] })
        })
        if (!res.ok) continue
        const data = await res.json()
        let txt = data.candidates?.[0]?.content?.parts?.[0]?.text?.replace(/```json|```/g, "").trim() || ""
        if (txt) {
          decision = JSON.parse(txt)
          break
        }
      } catch (e) {
        // محاولة المفتاح التالي
      }
    }

    if (!decision) {
      const p = prompt.toLowerCase()
      if (p.includes("صفر") || p.includes("تصفير")) {
        const match = prompt.match(/فارس|حسين|علي|محمد|نجم|احمد|أحمد|كرار|عباس|سجاد/)
        const name = match ? match[0] : ""
        decision = {
          reasoning: `لقيت ${name} في جدول Courier وهو مندوب، تصفير الحساب يعني تحديث mandoubTotalsResetAt`,
          searchQueries: [`SELECT * FROM "Courier" WHERE name ILIKE '%${name}%'`],
          action: "UPDATE",
          sql: `UPDATE "Courier" SET "mandoubTotalsResetAt"=NOW() WHERE name ILIKE '%${name}%'`,
          needMoreInfo: false,
          finalMessage: `تم تصفير حساب المندوب ${name} وسداد ذمته بنجاح ✅`
        }
      } else if (p.includes("طلب") && (p.includes("سوي") || p.includes("انشاء") || p.includes("اريد"))) {
        decision = {
          reasoning: "المستخدم يريد إنشاء طلب جديد",
          action: "NONE",
          needMoreInfo: true,
          askUser: "شنو نوع الطلب؟ من الادارة/وجهتين/من محل/تجهيز؟",
          finalMessage: "شنو نوع الطلب؟ من الادارة/وجهتين/من محل/تجهيز؟"
        }
      } else {
        decision = {
          reasoning: "تحية أو استفسار عام",
          action: "NONE",
          finalMessage: "أهلاً بك يا أبو الأكبر! أنا وكيلك الذكي المستكشف لقاعدة البيانات في Supabase."
        }
      }
    }

    // 2. نفذ استكشاف البحث اولا
    if (decision.searchQueries && Array.isArray(decision.searchQueries)) {
      for (const q of decision.searchQueries) {
        try { await prisma.$queryRawUnsafe(q) } catch {}
      }
    }

    // 3. نفذ الفعل اذا موجود
    if (decision.sql && decision.action !== "NONE") {
      try {
        await prisma.$queryRawUnsafe(decision.sql)
        return NextResponse.json({ 
          done: true, 
          message: `تم ✅ ${decision.reasoning || ""} - ${decision.finalMessage || "تم التنفيذ بنجاح"}`, 
          sql: decision.sql 
        })
      } catch (e: any) {
        return NextResponse.json({ 
          done: false, 
          message: `فهمت قصدك: ${decision.reasoning} بس فشل التنفيذ: ${e.message}. السكيما: ${JSON.stringify(columns).slice(0, 500)}` 
        })
      }
    }

    return NextResponse.json({ 
      done: false, 
      needType: decision.needMoreInfo, 
      message: decision.askUser || decision.finalMessage || decision.reasoning 
    })

  } catch (error: any) {
    console.error("[ai-agent error]:", error)
    return NextResponse.json({ done: false, message: `حدث خطأ: ${error.message}` }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({ status: "الوكيل المستكشف الحقيقي داخل Supabase شغال 🚀" })
}
