import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}))
    const prompt = (body.prompt || body.message || "").trim()

    if (!prompt) {
      return NextResponse.json({ done: false, message: "يرجى كتابة رسالة أو إعطاء أمر صوتي." })
    }

    // 1. محاولة استدعاء Supabase Edge Function إن وجدت ومفعلة
    const supabaseUrl = process.env.SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY

    if (supabaseUrl && serviceKey) {
      try {
        const edgeRes = await fetch(`${supabaseUrl}/functions/v1/ai-agent`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${serviceKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ prompt }),
          signal: AbortSignal.timeout(4000)
        })

        if (edgeRes.ok) {
          const edgeData = await edgeRes.json()
          return NextResponse.json(edgeData)
        }
      } catch (e) {
        // الانتقال للمعالج المباشر المدمج مع Supabase
      }
    }

    // 2. المعالج الذكي المباشر مع Supabase عبر Prisma
    // جلب السكيما الحية وعينات حقيقية من الجداول
    const [ridersSample, ordersSample, shopsSample] = await Promise.all([
      prisma.courier.findMany({
        take: 5,
        select: { id: true, name: true, phone: true, blocked: true, hiddenFromReports: true, mandoubTotalsResetAt: true }
      }).catch(() => []),
      prisma.order.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        select: { id: true, orderNumber: true, status: true, totalAmount: true, customerPhone: true, createdAt: true }
      }).catch(() => []),
      prisma.shop.findMany({
        take: 3,
        select: { id: true, name: true, phone: true }
      }).catch(() => [])
    ])

    const schemaInfo = `
    أنت جمناي الحقيقي، عايش داخل قاعدة بيانات Supabase لنظام توصيل طلبات أبو الأكبر في البصرة.
    لا توجد لديك أوامر برمجية جاهزة. مهمتك تستكشف وتفهم كلام المستخدم بالعراقي وتنفذ في قاعدة البيانات.

    الجداول الحقيقية وعيناتها:
    - جدول "Courier" (المناديب): ${JSON.stringify(ridersSample)}
    - جدول "Order" (الطلبات): ${JSON.stringify(ordersSample)}
    - جدول "Shop" (المحلات): ${JSON.stringify(shopsSample)}

    المستخدم كتب بالعراقي: "${prompt}"

    فكر وافهم نية المستخدم وسياقه بدون أي قيود:
    - إذا قال "اكو طلبات جديده" أو سأل عن الطلبات: افهم أنه استعلام SELECT "orderNumber", "status", "totalAmount", "customerPhone" FROM "Order" WHERE "status"='pending'.
    - إذا قال "الطلبات المسلمه انقلها للمؤرشفه": افهم أن هذا UPDATE "Order" SET "status"='archived' WHERE "status"='delivered'.
    - إذا قال "اخفيلي فلان": دور عليه في "Courier" وافهم أن الإخفاء يعني blocked=true و hiddenFromReports=true.
    - إذا قال "صفلي حساب فلان" أو "صفر حساب فلان": دور على الاسم وافهم أن التصفير يعني mandoubTotalsResetAt=NOW() و mandoubWalletCarryOverDinar=0.
    - إذا قال "سوي طلب": افهم أنه يريد واجهة إنشاء الطلب (needs_ui=true).
    - إذا قال "طلب من الإدارة": اسأله عن تفاصيل الطلب (رقم الزبون، المنطقة، السعر).

    أرجع JSON فقط بدون أي علامات ماركداون:
    {
      "understanding": "شرح بالعربي شنو فهمت من كلام المستخدم",
      "sql_to_execute": "استعلام SQL صالح في PostgreSQL او null",
      "needs_ui": false,
      "response_message": "رسالة واضحة ومباشرة للعرض للمستخدم بالعراقي تشرح ما تم تنفيذه"
    }
    `

    // استدعاء Gemini مع المفاتيح المتاحة
    const geminiKeys = [
      process.env.GEMINI_API_KEY,
      process.env.GEMINI_API_KEY_2,
      process.env.GEMINI_API_KEY_3,
      process.env.NEXT_PUBLIC_GEMINI_KEY
    ].filter(Boolean) as string[]

    let decision: any = null
    const models = ["gemini-1.5-flash", "gemini-3.8-flash", "gemini-2.0-flash", "gemini-flash-latest"]

    for (const key of geminiKeys) {
      for (const model of models) {
        try {
          const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: [{ text: schemaInfo }] }] })
          })

          if (!res.ok) continue
          const data = await res.json()
          let txt = data.candidates?.[0]?.content?.parts?.[0]?.text || ""
          const firstBrace = txt.indexOf('{')
          const lastBrace = txt.lastIndexOf('}')
          if (firstBrace !== -1 && lastBrace !== -1) {
            decision = JSON.parse(txt.substring(firstBrace, lastBrace + 1))
            break
          }
        } catch (e) {
          // تجربة التالي
        }
      }
      if (decision) break
    }

    // استكشاف مباشر وتلقائي في Supabase إذا لم يتوفر اتصال خارجي
    if (!decision) {
      const p = prompt.toLowerCase()

      // استعلام الطلبات الجديدة
      if (p.includes("طلبات") && (p.includes("جديده") || p.includes("جديدة") || p.includes("اكو") || p.includes("معلقه") || p.includes("معلقة"))) {
        const pendingOrders = await prisma.order.findMany({
          where: { status: "pending" },
          take: 5,
          orderBy: { createdAt: 'desc' }
        })
        const count = pendingOrders.length
        let reply = count > 0 
          ? `نعم يا أبو الأكبر، عندك ${count} طلبات جديدة قيد الانتظار حالياً 📦:\n` + pendingOrders.map(o => `• طلب #${o.orderNumber} بمبلغ ${Number(o.totalAmount).toLocaleString()} د.ع`).join('\n')
          : "لا توجد أي طلبات جديدة معلقة حالياً، كل الطلبات منجزة أو مسندة ✅"

        return NextResponse.json({
          done: true,
          message: reply,
          understanding: "استعلام عن الطلبات المعلقة الجديدة في النظام",
          data: pendingOrders
        })
      }

      // نقل الطلبات المسلمة إلى المؤرشفة
      if (p.includes("مؤرشف") || (p.includes("مسلم") && p.includes("انقل"))) {
        const updated = await prisma.order.updateMany({
          where: { status: "delivered" },
          data: { status: "archived", archivedAt: new Date() }
        })
        return NextResponse.json({
          done: true,
          message: `تم نقل ${updated.count} من الطلبات المسلمة إلى الأرشيف بنجاح يا أبو الأكبر 🗄️✅`,
          understanding: "أرشفة كافة الطلبات التي تم تسليمها بنجاح"
        })
      }

      // تصفير الحساب لأي اسم يكتبه المستخدم (مثل boos أو فارس أو غيره)
      if (p.includes("صفلي") || p.includes("صفر") || p.includes("تصفير")) {
        const namePart = prompt.replace(/.*(صفلي|صفر|تصفير)\s*(حساب)?\s*/i, "").trim()
        const courier = await prisma.courier.findFirst({
          where: { name: { contains: namePart, mode: 'insensitive' } }
        })
        if (courier) {
          await prisma.courier.update({
            where: { id: courier.id },
            data: { mandoubTotalsResetAt: new Date(), mandoubWalletCarryOverDinar: 0 }
          })
          return NextResponse.json({
            done: true,
            message: `تم تصفير حساب المندوب ${courier.name} وسداد ذمته المالية بنجاح 💰✅`,
            understanding: `تصفير حساب المندوب ${courier.name}`
          })
        }
      }

      // إخفاء أي مندوب
      if (p.includes("اخفي") || p.includes("حظر") || p.includes("عطل")) {
        const namePart = prompt.replace(/.*(اخفي|إخفاء|حظر|عطل)\s*(لي)?\s*/i, "").trim()
        const courier = await prisma.courier.findFirst({
          where: { name: { contains: namePart, mode: 'insensitive' } }
        })
        if (courier) {
          await prisma.courier.update({
            where: { id: courier.id },
            data: { blocked: true, hiddenFromReports: true }
          })
          return NextResponse.json({
            done: true,
            message: `تم إخفاء وحظر المندوب ${courier.name} من النظام والتقارير بنجاح 👁️✅`,
            understanding: `إخفاء المندوب ${courier.name}`
          })
        }
      }

      // إنشاء طلب أو اختيار نوع الطلب
      if (p.includes("طلب") || p.includes("سوي")) {
        return NextResponse.json({
          done: false,
          needType: true,
          message: "تأمرني يا أبو الأكبر! شنو نوع الطلب اللي تريده؟\n1️⃣ من الإدارة\n2️⃣ وجهتين\n3️⃣ من محل\n4️⃣ تجهيز طلب",
          understanding: "فتح خيارات نوع الطلب للمستخدم"
        })
      }

      decision = {
        understanding: "استكشاف عام",
        response_message: "يا هلا ومية هلا بيك يا أبو الأكبر! 🌹 أنا وكيلك الذكي المتصل مباشرة بقاعدة البيانات. اكتب أي أمر تريده بدون قيود وسأفهمه وأنفذه فوراً."
      }
    }

    // تنفيذ الـ SQL إن وجد في قرار الذكاء الاصطناعي
    if (decision.sql_to_execute) {
      try {
        const queryData = await prisma.$queryRawUnsafe(decision.sql_to_execute)
        return NextResponse.json({
          done: true,
          message: decision.response_message || "تم تنفيذ الأمر بنجاح في قاعدة البيانات ✅",
          understanding: decision.understanding,
          sql: decision.sql_to_execute,
          data: queryData
        })
      } catch (e: any) {
        return NextResponse.json({
          done: false,
          message: `فهمت قصدك: ${decision.understanding} ولكن حدث تنبيه: ${e.message}`,
          sql: decision.sql_to_execute
        })
      }
    }

    return NextResponse.json({
      done: true,
      message: decision.response_message || "تم استلام الطلب وتنفيذه بنجاح ✅",
      understanding: decision.understanding,
      needs_ui: decision.needs_ui
    })

  } catch (error: any) {
    console.error("[ai-agent error]:", error)
    return NextResponse.json({ done: false, message: `حدث خطأ: ${error.message}` }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({ status: "الوكيل المستكشف الحقيقي داخل Supabase متصل وشغال 🚀" })
}
