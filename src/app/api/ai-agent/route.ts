import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { Decimal } from '@prisma/client/runtime/library'
import { ADMIN_OFFICE_LABEL, ADMIN_SHOP_NAMES } from '@/lib/admin-order-from-admin-constants'
import { normalizeIraqMobileLocal11 } from '@/lib/whatsapp'

const GEMINI_KEYS = [
  process.env.GEMINI_API_KEY,
  process.env.GEMINI_API_KEY_2,
  process.env.GEMINI_API_KEY_3,
  process.env.NEXT_PUBLIC_GEMINI_KEY
].filter(Boolean) as string[]

// دالة مساعدة لإنشاء طلب حقيقي داخل قاعدة بيانات Supabase
async function executeCreateOrder({
  orderType = "طلب من الإدارة",
  customerPhone = "",
  customerName = "زبون الوكيل الذكي",
  regionName = "جيكور",
  totalAmount = 0,
  summary = ""
}: {
  orderType?: string
  customerPhone?: string
  customerName?: string
  regionName?: string
  totalAmount?: number
  summary?: string
}) {
  // 1. العثور على أو إنشاء متجر الإدارة
  let shop = await prisma.shop.findFirst({
    where: { name: { in: ADMIN_SHOP_NAMES } },
    include: { region: true }
  })

  if (!shop) {
    let firstRegion = await prisma.region.findFirst()
    if (!firstRegion) {
      firstRegion = await prisma.region.create({
        data: {
          name: "جيكور",
          deliveryPrice: new Decimal(3000)
        }
      })
    }
    shop = await prisma.shop.create({
      data: {
        name: ADMIN_OFFICE_LABEL,
        phone: "07733921468",
        locationUrl: "",
        region: { connect: { id: firstRegion.id } }
      },
      include: { region: true }
    })
  }

  // 2. العثور على المنطقة أو استخدام الأولى
  let targetRegion = null
  if (regionName && regionName.trim()) {
    targetRegion = await prisma.region.findFirst({
      where: { name: { contains: regionName.trim(), mode: 'insensitive' } }
    })
  }
  if (!targetRegion) {
    targetRegion = await prisma.region.findFirst()
    if (!targetRegion) {
      targetRegion = await prisma.region.create({
        data: {
          name: regionName?.trim() || "جيكور",
          deliveryPrice: new Decimal(3000)
        }
      })
    }
  }

  // 3. معالجة وتطبيع رقم هاتف الزبون
  const cleanPhone = normalizeIraqMobileLocal11(customerPhone?.trim() || "07700000000") || (customerPhone?.trim() || "07700000000")

  // 4. إنشاء أو جلب العميل
  let customer = await prisma.customer.findFirst({
    where: { shopId: shop.id, phone: cleanPhone }
  })

  if (!customer) {
    customer = await prisma.customer.create({
      data: {
        shopId: shop.id,
        name: customerName?.trim() || "زبون الوكيل الذكي",
        phone: cleanPhone,
        customerRegionId: targetRegion.id,
        customerLocationUrl: "",
        customerLandmark: summary?.trim() || targetRegion.name
      }
    })
  }

  // 5. حساب رقم الطلب التالي
  const lastOrder = await prisma.order.findFirst({
    orderBy: { orderNumber: "desc" },
    select: { orderNumber: true }
  })
  const nextOrderNumber = (lastOrder?.orderNumber ?? 0) + 1

  // 6. الحسابات المالية
  const amountNum = Number(totalAmount) || 0
  const orderSubtotal = new Decimal(amountNum)
  const deliveryPrice = targetRegion.deliveryPrice ?? new Decimal(0)
  const finalTotalAmount = orderSubtotal

  // 7. إنشاء الطلب داخل جدول Order في Supabase
  const createdOrder = await prisma.order.create({
    data: {
      orderNumber: nextOrderNumber,
      orderType: orderType || "طلب من الإدارة",
      status: "pending",
      shopId: shop.id,
      customerId: customer.id,
      customerPhone: cleanPhone,
      customerRegionId: targetRegion.id,
      customerLandmark: summary?.trim() || targetRegion.name,
      customerLocationUrl: "",
      orderSubtotal: orderSubtotal,
      purchasePrice: orderSubtotal,
      deliveryPrice: deliveryPrice,
      totalAmount: finalTotalAmount,
      summary: summary?.trim() || null,
      submissionSource: "admin_ai_agent",
      createdAt: new Date(),
      updatedAt: new Date()
    }
  })

  return createdOrder
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}))
    const {
      prompt,
      createOrder,
      orderType,
      customerPhone,
      customerName,
      regionName,
      totalAmount,
      summary
    } = body

    // أ- إذا كان الطلب إنشاء طلب مباشر من استمارة الدردشة التفاعلية
    if (createOrder === true) {
      const order = await executeCreateOrder({
        orderType: orderType || "طلب من الإدارة",
        customerPhone: customerPhone || "",
        customerName: customerName || "زبون الإدارة",
        regionName: regionName || "جيكور",
        totalAmount: Number(totalAmount) || 0,
        summary: summary || ""
      })

      return NextResponse.json({
        done: true,
        action: "create_order",
        orderNumber: order.orderNumber,
        orderId: order.id,
        totalAmount: order.totalAmount,
        customerPhone: order.customerPhone,
        status: order.status,
        message: `تم تثبيت ${order.orderType} بنجاح في قاعدة البيانات برقم #${order.orderNumber} بمبلغ ${Number(order.totalAmount).toLocaleString()} د.ع 🚀`
      })
    }

    if (!prompt || typeof prompt !== 'string') {
      return NextResponse.json({ done: false, message: "يرجى كتابة أمر أو رسالة." })
    }

    // 1. جلب البيانات الحية الحقيقية من Supabase عبر Prisma
    const [couriers, recentOrders, sampleRegions] = await Promise.all([
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
      }).catch(() => []),
      prisma.region.findMany({
        take: 10,
        select: { name: true, deliveryPrice: true }
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

- عينة مناطق التوصيل:
${JSON.stringify(sampleRegions, null, 2)}

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
- إذا قال سوي طلب أو طلب من الإدارة/وجهتين/محل بدون تفاصيل كاملة (رقم هاتف ومبلغ): افهم أنه يحتاج إظهار استمارة إدخال الطلب السريعة (needs_ui=true).
- إذا ذكر في كلامه تفاصيل طلب كاملة (مثل رقم تلفون ومبلغ ومنطقة): افهم أنه CREATE وضع البيانات في create_payload.

أرجع كائن JSON فقط بدون أي علامات ماركداون:
{
  "thinking": "تفكيرك بالعربي وشرح ما فهمته من كلام المستخدم",
  "action_type": "QUERY | UPDATE | CREATE | UI | CHAT",
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
  "create_payload": {
    "orderType": string | null,
    "customerPhone": string | null,
    "regionName": string | null,
    "totalAmount": number | null,
    "summary": string | null
  },
  "needs_ui": boolean,
  "response": "رسالة واضحة وودية للعرض للمستخدم بالعراقي تشرح ما قمت به أو تجيب عليه"
}
`

    // 2. جلب المفاتيح من جدول GeminiApiKey ومن متغيرات البيئة
    const dbKeys = await prisma.geminiApiKey.findMany({
      where: { active: true },
      orderBy: { updatedAt: 'desc' }
    }).catch(() => [])

    const activeKeys = [
      ...dbKeys.map(k => k.key),
      ...GEMINI_KEYS
    ].filter(Boolean)

    // استدعاء نموذج جمناي ليفهم ويقرر
    let brain: any = null
    const models = ["gemini-2.5-flash", "gemini-3.8-flash", "gemini-2.0-flash", "gemini-1.5-flash", "gemini-flash-latest"]

    for (const key of activeKeys) {
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
        needType: true,
        message: "تدلل يا أبو الأكبر! للبدء بإنشاء طلب جديد، اختر النوع وعبي التفاصيل أدناه أو تأكد من إعداد مفاتيح Gemini API."
      })
    }

    // 3. تنفيذ ما قرره جمناي نفسه بدون أي تدخل مسبق
    // أ- في حال إنشاء طلب مباشر مع تفاصيل (CREATE)
    if (brain.action_type === "CREATE" && brain.create_payload) {
      const p = brain.create_payload
      const order = await executeCreateOrder({
        orderType: p.orderType || "طلب من الإدارة",
        customerPhone: p.customerPhone || "",
        regionName: p.regionName || "جيكور",
        totalAmount: Number(p.totalAmount) || 0,
        summary: p.summary || ""
      })

      return NextResponse.json({
        done: true,
        action: "create_order",
        orderNumber: order.orderNumber,
        orderId: order.id,
        totalAmount: order.totalAmount,
        customerPhone: order.customerPhone,
        status: order.status,
        message: brain.response || `تم تثبيت الطلب بنجاح برقم #${order.orderNumber} ومبلغ ${Number(order.totalAmount).toLocaleString()} د.ع 🚀`,
        thinking: brain.thinking
      })
    }

    // ب- في حال طلب واجهة (UI / needs_ui)
    if (brain.needs_ui || brain.action_type === "UI") {
      let defaultType = "طلب من الإدارة"
      if (prompt.includes("وجهتين") || prompt.includes("وجهتين")) defaultType = "طلب وجهتين"
      else if (prompt.includes("محل")) defaultType = "طلب من محل"
      else if (prompt.includes("تجهيز")) defaultType = "تجهيز طلب"

      return NextResponse.json({
        done: false,
        needType: true,
        selectedType: defaultType,
        message: brain.response || "تدلل يا أبو الأكبر! جهزتلك استمارة الطلب السريعة تحت، عبيها وثبت الطلب فوراً 🚀",
        thinking: brain.thinking
      })
    }

    // ج- في حال التعديل (UPDATE)
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

    // د- في حال الاستعلام (QUERY)
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

    // هـ- رد عام أو محادثة
    return NextResponse.json({
      done: true,
      message: brain.response || "تم استلام طلبك بنجاح ✅",
      thinking: brain.thinking
    })

  } catch (err: any) {
    console.error("[ai-agent route error]:", err)
    return NextResponse.json({
      done: false,
      message: `حدث خطأ أثناء تنفيذ طلب الذكاء: ${err.message}`
    }, { status: 500 })
  }
}

export async function GET() {
  const regions = await prisma.region.findMany({
    take: 20,
    select: { id: true, name: true, deliveryPrice: true }
  }).catch(() => [])

  return NextResponse.json({
    status: "دماغ جمناي الحقيقي متصل مباشرة بـ Supabase 🚀",
    regions
  })
}
