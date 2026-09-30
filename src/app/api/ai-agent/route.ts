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

// دالة مساعدة لجلب أو إنشاء منطقة
async function getOrCreateRegion(regionName?: string) {
  if (regionName && regionName.trim()) {
    const found = await prisma.region.findFirst({
      where: { name: { contains: regionName.trim(), mode: 'insensitive' } }
    })
    if (found) return found
  }
  const first = await prisma.region.findFirst()
  if (first) return first
  return await prisma.region.create({
    data: {
      name: regionName?.trim() || "جيكور",
      deliveryPrice: new Decimal(3000)
    }
  })
}

// دالة مساعدة لإنشاء أي نوع من الطلبات بدقة داخل Supabase
async function executeCreateOrder(payload: {
  orderCategory: "single" | "double" | "shop" | "prep"
  // وجهة واحدة
  customerPhone?: string
  regionName?: string
  orderType?: string
  totalAmount?: number
  orderTime?: string
  // وجهتين
  senderPhone?: string
  senderRegionName?: string
  receiverPhone?: string
  receiverRegionName?: string
  // طلب من محل
  shopName?: string
  // طلب تجهيز
  prepText?: string
  summary?: string
}) {
  const {
    orderCategory,
    customerPhone = "",
    regionName = "جيكور",
    orderType = "توصيل عادي",
    totalAmount = 0,
    orderTime = "فوري",
    senderPhone = "",
    senderRegionName = "جيكور",
    receiverPhone = "",
    receiverRegionName = "جيكور",
    shopName = "",
    prepText = "",
    summary = ""
  } = payload

  // 1. تحديد المتجر (متجر الإدارة أو متجر المحل)
  let targetShop = null
  if (orderCategory === "shop" && shopName && shopName.trim()) {
    targetShop = await prisma.shop.findFirst({
      where: { name: { contains: shopName.trim(), mode: 'insensitive' } },
      include: { region: true }
    })
    if (!targetShop) {
      const defaultReg = await getOrCreateRegion()
      targetShop = await prisma.shop.create({
        data: {
          name: shopName.trim(),
          phone: "07700000000",
          locationUrl: "",
          region: { connect: { id: defaultReg.id } }
        },
        include: { region: true }
      })
    }
  } else {
    targetShop = await prisma.shop.findFirst({
      where: { name: { in: ADMIN_SHOP_NAMES } },
      include: { region: true }
    })
    if (!targetShop) {
      const defaultReg = await getOrCreateRegion()
      targetShop = await prisma.shop.create({
        data: {
          name: ADMIN_OFFICE_LABEL,
          phone: "07733921468",
          locationUrl: "",
          region: { connect: { id: defaultReg.id } }
        },
        include: { region: true }
      })
    }
  }

  // 2. حساب رقم الطلب التالي
  const lastOrder = await prisma.order.findFirst({
    orderBy: { orderNumber: "desc" },
    select: { orderNumber: true }
  })
  const nextOrderNumber = (lastOrder?.orderNumber ?? 0) + 1
  const amountDecimal = new Decimal(Number(totalAmount) || 0)

  // 3. التنفيذ حسب نوع الطلب المحدد:

  // === أ. طلب تجهيز (Preparation Order) ===
  if (orderCategory === "prep") {
    const cleanCustomerPhone = normalizeIraqMobileLocal11(customerPhone) || customerPhone || "07700000000"
    const targetRegion = await getOrCreateRegion(regionName)

    // إنشاء مسودة تجهيز في جدول الشركة
    const draft = await prisma.companyPreparerShoppingDraft.create({
      data: {
        rawListText: prepText || summary || "طلب تجهيز جديد عبر الوكيل الذكي",
        titleLine: prepText.split('\n')[0]?.substring(0, 80) || "طلب تجهيز مواد",
        customerPhone: cleanCustomerPhone,
        customerLandmark: summary || targetRegion.name,
        customerRegionId: targetRegion.id,
        orderTime: orderTime || "عاجل اليوم",
        status: "draft"
      }
    })

    // أيضاً إنشاء الطلب في جدول Order ليكون مرئياً في النظام
    const createdOrder = await prisma.order.create({
      data: {
        orderNumber: nextOrderNumber,
        orderType: "تجهيز طلب",
        status: "pending",
        shopId: targetShop.id,
        customerPhone: cleanCustomerPhone,
        customerRegionId: targetRegion.id,
        customerLandmark: `تجهيز: ${draft.titleLine}`,
        orderSubtotal: amountDecimal,
        purchasePrice: amountDecimal,
        deliveryPrice: targetRegion.deliveryPrice ?? new Decimal(0),
        totalAmount: amountDecimal,
        orderNoteTime: orderTime || "فوري",
        summary: prepText,
        submissionSource: "admin_ai_agent_prep"
      }
    })

    return {
      orderNumber: createdOrder.orderNumber,
      orderId: createdOrder.id,
      totalAmount: createdOrder.totalAmount,
      typeLabel: "طلب تجهيز",
      message: `تم تثبيت طلب التجهيز برقم #${createdOrder.orderNumber} في قاعدة البيانات ومسودة التجهيز بنجاح! 🛍️`
    }
  }

  // === ب. طلب وجهتين (Two-way / Double Order) ===
  if (orderCategory === "double") {
    const cleanSenderPhone = normalizeIraqMobileLocal11(senderPhone) || senderPhone || "07700000000"
    const cleanReceiverPhone = normalizeIraqMobileLocal11(receiverPhone) || receiverPhone || "07700000000"
    const senderRegion = await getOrCreateRegion(senderRegionName)
    const receiverRegion = await getOrCreateRegion(receiverRegionName)

    const createdOrder = await prisma.order.create({
      data: {
        orderNumber: nextOrderNumber,
        orderType: orderType || "طلب وجهتين",
        routeMode: "double",
        status: "pending",
        shopId: targetShop.id,
        customerPhone: cleanReceiverPhone, // رقم المستلم
        customerRegionId: receiverRegion.id, // منطقة المستلم
        secondCustomerPhone: cleanSenderPhone, // رقم المرسل
        secondCustomerRegionId: senderRegion.id, // منطقة المرسل
        customerLandmark: `مستلم: ${receiverRegion.name}`,
        secondCustomerLandmark: `مرسل: ${senderRegion.name}`,
        orderSubtotal: amountDecimal,
        purchasePrice: amountDecimal,
        deliveryPrice: receiverRegion.deliveryPrice ?? new Decimal(0),
        totalAmount: amountDecimal,
        orderNoteTime: orderTime || "فوري",
        summary: summary || `طلب وجهتين من ${senderRegion.name} إلى ${receiverRegion.name}`,
        submissionSource: "admin_ai_agent_double"
      }
    })

    return {
      orderNumber: createdOrder.orderNumber,
      orderId: createdOrder.id,
      totalAmount: createdOrder.totalAmount,
      typeLabel: "طلب وجهتين",
      message: `تم تثبيت طلب الوجهتين برقم #${createdOrder.orderNumber} (من ${senderRegion.name} إلى ${receiverRegion.name}) بنجاح! 🔄`
    }
  }

  // === ج. طلب من محل (From Shop) ===
  if (orderCategory === "shop") {
    const cleanPhone = normalizeIraqMobileLocal11(customerPhone) || customerPhone || "07700000000"
    const targetRegion = await getOrCreateRegion(regionName)

    const createdOrder = await prisma.order.create({
      data: {
        orderNumber: nextOrderNumber,
        orderType: orderType || "طلب من محل",
        routeMode: "single",
        status: "pending",
        shopId: targetShop.id,
        customerPhone: cleanPhone,
        customerRegionId: targetRegion.id,
        customerLandmark: targetRegion.name,
        orderSubtotal: amountDecimal,
        purchasePrice: amountDecimal,
        deliveryPrice: targetRegion.deliveryPrice ?? new Decimal(0),
        totalAmount: amountDecimal,
        orderNoteTime: orderTime || "فوري",
        summary: summary || `طلب لمحل: ${targetShop.name}`,
        submissionSource: "admin_ai_agent_shop"
      }
    })

    return {
      orderNumber: createdOrder.orderNumber,
      orderId: createdOrder.id,
      totalAmount: createdOrder.totalAmount,
      typeLabel: `طلب من محل (${targetShop.name})`,
      message: `تم تثبيت طلب المحل (${targetShop.name}) برقم #${createdOrder.orderNumber} بمبلغ ${Number(createdOrder.totalAmount).toLocaleString()} د.ع بنجاح! 🏬`
    }
  }

  // === د. طلب وجهة واحدة (Single / طلب من الإدارة) ===
  const cleanPhone = normalizeIraqMobileLocal11(customerPhone) || customerPhone || "07700000000"
  const targetRegion = await getOrCreateRegion(regionName)

  const createdOrder = await prisma.order.create({
    data: {
      orderNumber: nextOrderNumber,
      orderType: orderType || "طلب وجهة واحدة",
      routeMode: "single",
      status: "pending",
      shopId: targetShop.id,
      customerPhone: cleanPhone,
      customerRegionId: targetRegion.id,
      customerLandmark: targetRegion.name,
      orderSubtotal: amountDecimal,
      purchasePrice: amountDecimal,
      deliveryPrice: targetRegion.deliveryPrice ?? new Decimal(0),
      totalAmount: amountDecimal,
      orderNoteTime: orderTime || "فوري",
      summary: summary || null,
      submissionSource: "admin_ai_agent_single"
    }
  })

  return {
    orderNumber: createdOrder.orderNumber,
    orderId: createdOrder.id,
    totalAmount: createdOrder.totalAmount,
    typeLabel: "طلب وجهة واحدة",
    message: `تم تثبيت طلب الوجهة الواحدة برقم #${createdOrder.orderNumber} بمبلغ ${Number(createdOrder.totalAmount).toLocaleString()} د.ع بنجاح! 📦`
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}))

    // أ- استقبال التثبيت من استمارة الطلب التفاعلية المخصصة
    if (body.createOrder === true) {
      const result = await executeCreateOrder({
        orderCategory: body.orderCategory || "single",
        customerPhone: body.customerPhone,
        regionName: body.regionName,
        orderType: body.orderType,
        totalAmount: body.totalAmount,
        orderTime: body.orderTime,
        senderPhone: body.senderPhone,
        senderRegionName: body.senderRegionName,
        receiverPhone: body.receiverPhone,
        receiverRegionName: body.receiverRegionName,
        shopName: body.shopName,
        prepText: body.prepText,
        summary: body.summary
      })

      return NextResponse.json({
        done: true,
        action: "create_order",
        orderNumber: result.orderNumber,
        orderId: result.orderId,
        totalAmount: result.totalAmount,
        message: result.message
      })
    }

    const { prompt } = body
    if (!prompt || typeof prompt !== 'string') {
      return NextResponse.json({ done: false, message: "يرجى كتابة أمر أو رسالة." })
    }

    // إذا طلب المستخدم صراحة فتح واجهة طلب أو نوع معين
    const lower = prompt.toLowerCase()
    if (
      lower.includes("طلب") ||
      lower.includes("سويلي") ||
      lower.includes("انشاء") ||
      lower.includes("وجهتين") ||
      lower.includes("وجهة") ||
      lower.includes("محل") ||
      lower.includes("تجهيز")
    ) {
      let cat: "single" | "double" | "shop" | "prep" = "single"
      if (prompt.includes("وجهتين") || prompt.includes("مرسل") || prompt.includes("مستلم")) cat = "double"
      else if (prompt.includes("محل") || prompt.includes("بيج")) cat = "shop"
      else if (prompt.includes("تجهيز") || prompt.includes("مواد") || prompt.includes("منتجات")) cat = "prep"

      return NextResponse.json({
        done: false,
        needType: true,
        selectedCategory: cat,
        message: "تدلل يا أبو الأكبر! اخترتلك استمارة الطلب بالمعلومات المطلوبة بالضبط، عبيها واضغط تثبيت فوراً 🚀"
      })
    }

    // 1. جلب البيانات الحية الحقيقية من Supabase عبر Prisma للاستكشاف الحر
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
تفهم كلام المستخدم العراقي بذكاء وتستكشف وتنفذ مباشرة في الجداول.

البيانات الحية المتاحة حالياً في Supabase:
- المناديب (Courier): ${JSON.stringify(couriers)}
- آخر الطلبات (Order): ${JSON.stringify(recentOrders)}
- المناطق: ${JSON.stringify(sampleRegions)}

المستخدم كتب بالعراقي: "${prompt}"

افهم المعنى:
- إخفاء مندوب: blocked=true و hiddenFromReports=true
- إظهار مندوب: blocked=false و hiddenFromReports=false
- تصفير حساب: resetBalance=true
- استعلام عن وضع طلب: QUERY برقم الطلب
- أرشفة الطلبات المسلمة: UPDATE للطلبات من delivered إلى archived
- إنشاء طلب: needs_ui=true

أرجع JSON فقط:
{
  "thinking": "تفكيرك بالعربي",
  "action_type": "QUERY | UPDATE | UI | CHAT",
  "target_table": "Courier | Order | null",
  "query_filter": { "orderNumber": null, "courierName": null, "status": null },
  "update_payload": { "blocked": null, "hiddenFromReports": null, "resetBalance": null, "targetStatus": null },
  "needs_ui": false,
  "response": "ردك بالعراقي"
}
`

    const dbKeys = await prisma.geminiApiKey.findMany({
      where: { active: true },
      orderBy: { updatedAt: 'desc' }
    }).catch(() => [])

    const activeKeys = [
      ...dbKeys.map(k => k.key),
      ...GEMINI_KEYS
    ].filter(Boolean)

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
        } catch (e) {}
      }
      if (brain) break
    }

    if (!brain) {
      return NextResponse.json({
        done: false,
        message: "أهلاً بك يا أبو الأكبر، تفضل كيف أساعدك اليوم في إدارة الطلبات والمناديب؟"
      })
    }

    // تنفيذ قرارات جمناي
    if (brain.needs_ui || brain.action_type === "UI") {
      return NextResponse.json({
        done: false,
        needType: true,
        selectedCategory: "single",
        message: brain.response || "تدلل يا أبو الأكبر! اختر نوع الطلب وعبي المعلومات لتثبيته فوراً 🚀",
        thinking: brain.thinking
      })
    }

    if (brain.action_type === "UPDATE") {
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
      }
    }

    if (brain.action_type === "QUERY") {
      if (brain.query_filter?.orderNumber) {
        const foundOrder = await prisma.order.findFirst({
          where: { orderNumber: Number(brain.query_filter.orderNumber) },
          include: { courier: { select: { name: true } } }
        })

        if (foundOrder) {
          const courierName = foundOrder.courier?.name || "غير مسند"
          return NextResponse.json({
            done: true,
            message: brain.response || `الطلب #${foundOrder.orderNumber} وضعه: "${foundOrder.status}" | المبلغ: ${Number(foundOrder.totalAmount).toLocaleString()} د.ع | المندوب: ${courierName} 📦`,
            data: foundOrder,
            thinking: brain.thinking
          })
        }
      }
    }

    return NextResponse.json({
      done: true,
      message: brain.response || "تم استلام طلبك بنجاح ✅",
      thinking: brain.thinking
    })

  } catch (err: any) {
    console.error("[ai-agent error]:", err)
    return NextResponse.json({
      done: false,
      message: `حدث خطأ في النظام: ${err.message}`
    }, { status: 500 })
  }
}

export async function GET() {
  const regions = await prisma.region.findMany({
    take: 30,
    select: { id: true, name: true, deliveryPrice: true }
  }).catch(() => [])

  return NextResponse.json({
    status: "متصل بـ Supabase 🚀",
    regions
  })
}
