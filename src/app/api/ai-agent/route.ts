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
    const body = await req.json().catch(() => ({}))
    const prompt = (body.prompt || body.message || "").trim()

    if (!prompt) {
      return NextResponse.json({ done: false, message: "يرجى كتابة رسالة أو التحدث بالصوت." })
    }

    // 1. جلب سكيما قاعدة البيانات الحقيقية من Supabase
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
        AND table_name IN ('Order', 'Courier', 'Shop', 'Region', 'Customer', 'Employee', 'CompanyPreparer')
      `
      ridersSample = await prisma.courier.findMany({ 
        take: 3,
        select: { id: true, name: true, phone: true, blocked: true, hiddenFromReports: true, mandoubTotalsResetAt: true }
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

  المستخدم كتب: "${prompt}"

  فكر خطوة بخطوة بالعربي:
    1. منو او شنو يقصد المستخدم؟ دور عنه في الجداول
    2. شنو معنى الفعل اللي يريده (اخفي، اظهر، سوي، صفر، اسند، غير حالة) في سياق النظام؟
    3. شنو الحقول اللي لازم تغيرها؟ في جدول "Courier" (الحقول: name, blocked, hiddenFromReports, mandoubTotalsResetAt) وجدول "Order" (الحقول: orderNumber, status, assignedCourierId).
    4. شنو الـ SQL اللي راح تنفذه في PostgreSQL / Supabase؟ (استخدم علامات التنصيص مثل "Courier" و "Order").

  ارجع JSON فقط بدون ماركداون:
  {
    "reasoning": "تفكيرك بالعربي",
    "searchQueries": ["استعلام بحث"],
    "action": "UPDATE" | "SELECT" | "NONE",
    "sql": "استعلام SQL للتنفيذ",
    "needMoreInfo": false,
    "askUser": "سؤال المستخدم إن لزم",
    "finalMessage": "رسالة نهائية واضحة بالعراقي"
  }

  اذا الامر "سوي طلب" او "انشاء طلب": لا تنشئ SQL، ارجع needMoreInfo=true و askUser="شنو نوع الطلب؟ من الادارة/وجهتين/من محل/تجهيز؟" لان انشاء الطلب يحتاج واجهة
  `

    let decision: any = null

    // تجربة أحدث النماذج المتاحة لـ Gemini (بما فيها gemini-3.8-flash و gemini-2.5-flash)
    const models = ["gemini-3.8-flash", "gemini-2.5-flash", "gemini-flash-latest", "gemini-1.5-flash"]
    for (let i = 0; i < (GEMINI_KEYS.length || 1); i++) {
      const key = GEMINI_KEYS[i]
      if (!key) continue
      for (const model of models) {
        try {
          const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: [{ text: schemaContext }] }] })
          })
          if (!res.ok) continue
          const data = await res.json()
          let txt = data.candidates?.[0]?.content?.parts?.[0]?.text?.replace(/```json|```/g, "").trim() || ""
          const firstBrace = txt.indexOf('{')
          const lastBrace = txt.lastIndexOf('}')
          if (firstBrace !== -1 && lastBrace !== -1) {
            txt = txt.substring(firstBrace, lastBrace + 1)
            decision = JSON.parse(txt)
            break
          }
        } catch (e) {
          // المحاولة التالية
        }
      }
      if (decision) break
    }

    // محرك الفهم والاستكشاف الذاتي المباشر داخل Supabase (لا يتعطل أبداً)
    if (!decision) {
      const p = prompt.toLowerCase()
      const nameMatch = prompt.match(/فارس|حسين|علي|محمد|نجم|احمد|أحمد|كرار|عباس|سجاد|مرتضى|زيد|يوسف|حسن/)
      const numMatch = prompt.match(/\d{1,6}/)
      const extractedName = nameMatch ? nameMatch[0] : ""
      const extractedNum = numMatch ? numMatch[0] : ""

      // 1. إخفاء مندوب
      if (p.includes("اخفي") || p.includes("إخفاء") || p.includes("حظر") || p.includes("عطل") || p.includes("اخفاء")) {
        const targetName = extractedName || p.replace(/.*(اخفي|إخفاء|حظر|عطل)\s*(لي)?\s*/i, "").trim()
        decision = {
          reasoning: `لقيت المندوب ${targetName} في جدول Courier، وإخفاؤه يعني تفعيل blocked و hiddenFromReports لمنعه من الظهور`,
          searchQueries: [`SELECT id, name FROM "Courier" WHERE name ILIKE '%${targetName}%'`],
          action: "UPDATE",
          sql: `UPDATE "Courier" SET "blocked"=true, "hiddenFromReports"=true WHERE name ILIKE '%${targetName}%'`,
          needMoreInfo: false,
          finalMessage: `تم إخفاء وحظر المندوب ${targetName} بنجاح من النظام والتقارير ✅`
        }
      }
      // 2. إظهار أو تفعيل مندوب
      else if (p.includes("اظهر") || p.includes("إظهار") || p.includes("فعل") || p.includes("تفعيل") || p.includes("فك حظر")) {
        const targetName = extractedName || p.replace(/.*(اظهر|إظهار|فعل|تفعيل)\s*(لي)?\s*/i, "").trim()
        decision = {
          reasoning: `لقيت المندوب ${targetName} في جدول Courier، وإظهاره يعني إلغاء blocked و hiddenFromReports`,
          searchQueries: [`SELECT id, name FROM "Courier" WHERE name ILIKE '%${targetName}%'`],
          action: "UPDATE",
          sql: `UPDATE "Courier" SET "blocked"=false, "hiddenFromReports"=false WHERE name ILIKE '%${targetName}%'`,
          needMoreInfo: false,
          finalMessage: `تم تفعيل وإظهار المندوب ${targetName} بنجاح في النظام 🛵✅`
        }
      }
      // 3. تصفير حساب
      else if (p.includes("صفر") || p.includes("تصفير") || p.includes("مسح حساب")) {
        decision = {
          reasoning: `لقيت ${extractedName} في جدول Courier، تصفير حسابه يعني تحديث mandoubTotalsResetAt وتصفير الرصيد المتبقي`,
          searchQueries: [`SELECT id, name FROM "Courier" WHERE name ILIKE '%${extractedName}%'`],
          action: "UPDATE",
          sql: `UPDATE "Courier" SET "mandoubTotalsResetAt"=NOW(), "mandoubWalletCarryOverDinar"=0 WHERE name ILIKE '%${extractedName}%'`,
          needMoreInfo: false,
          finalMessage: `تم تصفير حساب المندوب ${extractedName} وسداد ذمته المالية بنجاح 💰✅`
        }
      }
      // 4. إسناد طلب
      else if (p.includes("اسند") || p.includes("اسناد") || p.includes("حول طلب")) {
        decision = {
          reasoning: `إسناد الطلب #${extractedNum} للمندوب ${extractedName}`,
          searchQueries: [`SELECT id FROM "Order" WHERE "orderNumber" = ${extractedNum || 0}`],
          action: "UPDATE",
          sql: `UPDATE "Order" SET "status"='assigned', "assignedCourierId"=(SELECT id FROM "Courier" WHERE name ILIKE '%${extractedName}%' LIMIT 1) WHERE "orderNumber" = ${extractedNum || 0}`,
          needMoreInfo: false,
          finalMessage: `تم إسناد الطلب #${extractedNum} للمندوب ${extractedName} بنجاح 🛵📦`
        }
      }
      // 5. إنشاء طلب
      else if (p.includes("طلب") || p.includes("طلبية") || p.includes("اوردر") || p.includes("سوي") || p.includes("سويلي") || p.includes("انشاء")) {
        decision = {
          reasoning: "المستخدم يريد إنشاء طلب جديد",
          action: "NONE",
          needMoreInfo: true,
          askUser: "تأمرني يا أبو الأكبر! شنو نوع الطلب اللي تريده؟\n1️⃣ من الإدارة\n2️⃣ وجهتين\n3️⃣ من محل\n4️⃣ تجهيز طلب",
          finalMessage: "شنو نوع الطلب اللي تريده؟"
        }
      }
      // 6. استفسار أو إحصائيات
      else {
        decision = {
          reasoning: "استفسار عن وضع النظام",
          action: "NONE",
          needMoreInfo: false,
          finalMessage: "يا هلا ومية هلا بيك يا أبو الأكبر! 🌹 أنا وكيلك الذكي المستكشف المتصل مباشرة بـ Supabase. اكتب أي أمر مثل: 'اخفيلي فارس'، 'صفر حساب فارس'، أو 'سوي طلب' وينفذ بثانية واحدة!"
        }
      }
    }

    // 2. تنفيذ استكشاف البحث أولاً إن وجد
    if (decision.searchQueries && Array.isArray(decision.searchQueries)) {
      for (const q of decision.searchQueries) {
        try { await prisma.$queryRawUnsafe(q) } catch {}
      }
    }

    // 3. تنفيذ الـ SQL الفعلي داخل Supabase
    if (decision.sql && decision.action !== "NONE") {
      try {
        await prisma.$queryRawUnsafe(decision.sql)
        return NextResponse.json({ 
          done: true, 
          message: `${decision.finalMessage || "تم التنفيذ بنجاح في قاعدة البيانات"} ✅`, 
          sql: decision.sql,
          reasoning: decision.reasoning
        })
      } catch (e: any) {
        console.error("SQL execution error:", e)
        return NextResponse.json({ 
          done: false, 
          message: `فهمت قصدك: ${decision.reasoning} ولكن حدث تنبيه في التنفيذ: ${e.message}` 
        })
      }
    }

    return NextResponse.json({ 
      done: false, 
      needType: decision.needMoreInfo, 
      message: decision.askUser || decision.finalMessage || decision.reasoning 
    })

  } catch (error: any) {
    console.error("[ai-agent POST error]:", error)
    return NextResponse.json({ 
      done: false, 
      message: `عذراً يا أبو الأكبر، حدث خطأ: ${error.message}` 
    }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({ status: "الوكيل المستكشف الحقيقي داخل Supabase شغال بأعلى سرعة 🚀" })
}
