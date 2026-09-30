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
    if (!prompt || typeof prompt !== 'string') {
      return NextResponse.json({ done: false, message: "يرجى كتابة أمر أو رسالة." })
    }

    // 1. جلب البيانات الحية الحقيقية من Supabase عبر Prisma
    const [couriers, recentOrders] = await Promise.all([
      prisma.courier.findMany({
        take: 15,
        select: {
          id: true,
          name: true,
          phone: true,
          blocked: true,
          hiddenFromReports: true,
          mandoubTotalsResetAt: true
        }
      }).catch(() => []),
      prisma.order.findMany({
        take: 10,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          orderNumber: true,
          customerPhone: true,
          status: true,
          totalAmount: true,
          summary: true,
          assignedCourierId: true,
          createdAt: true
        }
      }).catch(() => [])
    ])

    const systemPrompt = `
أنت عقل نظام أبو الأكبر للتوصيل، عايش داخل قاعدة بيانات Supabase مباشرة.
لا تملك أي أوامر مبرمجة مسبقاً. عندك حرية كاملة تستكشف، تفهم كلام المستخدم بالعراقي، وتقرر الإجراء المناسب.

البيانات الحية المتاحة حالياً في Supabase:
- المناديب المسجلين (جدول Courier):
${JSON.stringify(couriers, null, 2)}

- آخر 10 طلبات في النظام (جدول Order):
${JSON.stringify(recentOrders, null, 2)}

الأعمدة الحقيقية:
- Courier: id, name, phone, blocked (إخفاء/حظر), hiddenFromReports (إخفاء من التقارير), mandoubTotalsResetAt (وقت تصفير الحساب)
- Order: id, orderNumber (رقم الطلب), customerPhone, status ('pending', 'assigned', 'delivered', 'archived', 'cancelled'), totalAmount, assignedCourierId

المستخدم كتب بالعراقي: "${prompt}"

مهمتك:
- افهم النية الحقيقية من كلام المستخدم بدون قيود أو كلمات مفتاحية.
- إذا أراد إخفاء مندوب (مثل boos أو فارس): افهم أنه تعديل في جدول Courier ليصبح blocked=true و hiddenFromReports=true.
- إذا أراد إظهار أو فك حظر مندوب: افهم أنه تعديل في Courier ليصبح blocked=false و hiddenFromReports=false.
- إذا أراد تصفير حساب مندوب: افهم أنه تحديث mandoubTotalsResetAt في Courier.
- إذا سأل عن وضع طلب معين (مثل 2810): افهم أنه استعلام عن الطلب برقم orderNumber لجلب تفاصيله.
- إذا قال انقل الطلبات المسلمة للأرشيف: افهم أنه تحديث الطلبات من delivered إلى archived.
- إذا سأل هل توجد طلبات جديدة: افهم أنه استعلام عن الطلبات التي حالتها pending.
- إذا قال سوي طلب أو طلب من الإدارة/وجهتين/محل: افهم أنه يحتاج واجهة (needs_ui=true).

أرجع كائن JSON فقط بدون أي علامات ماركداون:
{
  "thinking": "تفكيرك بالعربي وشرح ما فهمته من كلام المستخدم",
  "action_type": "QUERY | UPDATE | UI | CHAT",
  "target_table": "Courier | Order | null",
  "query_filter": {
    "orderNumber": number | null,
    "courierName": string | null,
    "status": string | null
  },
  "update_payload": {
    "blocked": boolean | null,
    "hiddenFromReports": boolean | null,
    "resetBalance": boolean | null,
    "targetStatus": string | null
  },
  "needs_ui": boolean,
  "response": "رسالة واضحة وودية للعرض للمستخدم بالعراقي تشرح ما قمت به أو تجيب عليه"
}
`

    // 2. استدعاء نموذج جمناي ليفهم ويقرر
    let brain: any = null
    const models = ["gemini-3.8-flash", "gemini-2.5-flash", "gemini-2.0-flash", "gemini-1.5-flash", "gemini-flash-latest"]

    for (const key of GEMINI_KEYS) {
      if (!key) continue
      for (const model of models) {
        try {
          const gemRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: [{ text: systemPrompt }] }] })
          })

          if (!gemRes.ok) continue
          const gemJson = await gemRes.json()
          let raw = gemJson.candidates?.[0]?.content?.parts?.[0]?.text || ""
          const firstBrace = raw.indexOf('{')
          const lastBrace = raw.lastIndexOf('}')
          if (firstBrace !== -1 && lastBrace !== -1) {
            brain = JSON.parse(raw.substring(firstBrace, lastBrace + 1))
            break
          }
        } catch (e) {
          // تجربة التالي
        }
      }
      if (brain) break
    }

    if (!brain) {
      return NextResponse.json({
        done: false,
        message: "تعذر معالجة الطلب عبر جمناي حالياً، يرجى التأكد من مفاتيح Gemini API."
      })
    }

    // 3. تنفيذ ما قرره جمناي نفسه بدون أي تدخل أو أوامر جاهزة
    // أ- في حال طلب واجهة
    if (brain.needs_ui || brain.action_type === "UI") {
      return NextResponse.json({
        done: false,
        needType: true,
        message: brain.response || "تأمرني يا أبو الأكبر! شنو نوع الطلب اللي تريده؟",
        thinking: brain.thinking
      })
    }

    // ب- في حال التعديل (UPDATE)
    if (brain.action_type === "UPDATE") {
      // 1. تعديل على جدول المناديب (Courier)
      if (brain.target_table === "Courier" && brain.query_filter?.courierName) {
        const cName = brain.query_filter.courierName.trim()
        const targetCourier = await prisma.courier.findFirst({
          where: { name: { contains: cName, mode: 'insensitive' } }
        })

        if (targetCourier) {
          const updateData: any = {}
          if (brain.update_payload?.blocked !== null && brain.update_payload?.blocked !== undefined) {
            updateData.blocked = Boolean(brain.update_payload.blocked)
          }
          if (brain.update_payload?.hiddenFromReports !== null && brain.update_payload?.hiddenFromReports !== undefined) {
            updateData.hiddenFromReports = Boolean(brain.update_payload.hiddenFromReports)
          }
          if (brain.update_payload?.resetBalance) {
            updateData.mandoubTotalsResetAt = new Date()
            updateData.mandoubWalletCarryOverDinar = 0
          }

          await prisma.courier.update({
            where: { id: targetCourier.id },
            data: updateData
          })

          return NextResponse.json({
            done: true,
            message: brain.response || `تم تحديث المندوب ${targetCourier.name} بنجاح ✅`,
            thinking: brain.thinking
          })
        } else {
          return NextResponse.json({
            done: false,
            message: `لم أجد مندوباً باسم "${cName}" في قاعدة البيانات.`
          })
        }
      }

      // 2. تعديل على جدول الطلبات (Order)
      if (brain.target_table === "Order") {
        if (brain.update_payload?.targetStatus === "archived" || brain.query_filter?.status === "delivered") {
          const res = await prisma.order.updateMany({
            where: { status: "delivered" },
            data: { status: "archived", archivedAt: new Date() }
          })
          return NextResponse.json({
            done: true,
            message: brain.response || `تم نقل ${res.count} من الطلبات المسلمة إلى الأرشيف بنجاح ✅`,
            thinking: brain.thinking
          })
        }

        if (brain.query_filter?.orderNumber && brain.update_payload?.targetStatus) {
          await prisma.order.updateMany({
            where: { orderNumber: Number(brain.query_filter.orderNumber) },
            data: { status: brain.update_payload.targetStatus }
          })
          return NextResponse.json({
            done: true,
            message: brain.response || `تم تحديث حالة الطلب #${brain.query_filter.orderNumber} بنجاح ✅`,
            thinking: brain.thinking
          })
        }
      }
    }

    // ج- في حال الاستعلام (QUERY)
    if (brain.action_type === "QUERY") {
      // 1. استعلام عن طلب معين
      if (brain.query_filter?.orderNumber) {
        const foundOrder = await prisma.order.findFirst({
          where: { orderNumber: Number(brain.query_filter.orderNumber) },
          include: { courier: { select: { name: true } } }
        })

        if (foundOrder) {
          const courierName = foundOrder.courier?.name || "غير مسند لمندوب"
          const reply = brain.response || `الطلب #${foundOrder.orderNumber} وضعه الحالي: "${foundOrder.status}" | المبلغ: ${Number(foundOrder.totalAmount).toLocaleString()} د.ع | المندوب: ${courierName} 📦`
          return NextResponse.json({
            done: true,
            message: reply,
            data: foundOrder,
            thinking: brain.thinking
          })
        } else {
          return NextResponse.json({
            done: false,
            message: `عذراً، لم أجد طلباً بالرقم #${brain.query_filter.orderNumber} في النظام.`
          })
        }
      }

      // 2. استعلام عن طلبات جديدة أو معلقة
      if (brain.query_filter?.status === "pending" || brain.target_table === "Order") {
        const pendingList = await prisma.order.findMany({
          where: { status: "pending" },
          take: 5,
          orderBy: { createdAt: 'desc' },
          select: { orderNumber: true, totalAmount: true, customerPhone: true }
        })

        const count = pendingList.length
        const details = count > 0 
          ? `\n` + pendingList.map(o => `• طلب #${o.orderNumber} بمبلغ ${Number(o.totalAmount).toLocaleString()} د.ع`).join('\n')
          : " (لا توجد طلبات معلقة)"

        return NextResponse.json({
          done: true,
          message: (brain.response || `يوجد ${count} طلبات معلقة حالياً`) + details,
          data: pendingList,
          thinking: brain.thinking
        })
      }
    }

    // د- رد عام أو محادثة
    return NextResponse.json({
      done: true,
      message: brain.response || "تم استلام طلبك بنجاح ✅",
      thinking: brain.thinking
    })

  } catch (err: any) {
    console.error("[ai-agent route error]:", err)
    return NextResponse.json({
      done: false,
      message: `حدث خطأ أثناء تنفيذ قرار الذكاء: ${err.message}`
    }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({
    status: "دماغ جمناي الحقيقي متصل مباشرة بـ Supabase 🚀"
  })
}
