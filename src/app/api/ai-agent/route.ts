import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { Decimal } from '@prisma/client/runtime/library'

const GEMINI_KEYS = [
  process.env.GEMINI_API_KEY,
  process.env.GEMINI_API_KEY_2,
  process.env.GEMINI_API_KEY_3,
  process.env.NEXT_PUBLIC_GEMINI_KEY
].filter(Boolean) as string[]

async function askGemini(text: string) {
  if (GEMINI_KEYS.length === 0) return null

  const models = ["gemini-1.5-flash", "gemini-2.0-flash", "gemini-flash-latest"]

  for (let i = 0; i < GEMINI_KEYS.length; i++) {
    const key = GEMINI_KEYS[i]
    const model = models[i % models.length]
    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: `أنت مدير تنفيذي عراقي ذكي لنظام توصيل طلبات "أبو الأكبر".
رسالة المدير: "${text}".
حلل النية واستخرج الكيانات، وارجع فقط بصيغة JSON بدون أي نصوص إضافية:
{
  "intent": "create_order" | "zero_balance" | "assign_order" | "change_status" | "general_query" | "unknown",
  "riderName": string | null,
  "orderId": string | null,
  "status": string | null,
  "orderType": "من الإدارة" | "وجهتين" | "من محل" | "تجهيز طلب" | null,
  "reply": string | null
}`
            }]
          }]
        })
      })
      const data = await res.json()
      const t = data.candidates?.[0]?.content?.parts?.[0]?.text
      if (t) return t
    } catch (e) {
      // تجربة المفتاح التالي
    }
  }
  return null
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}))
    const prompt = (body.prompt || "").trim()
    const stepData = body.stepData
    const text = prompt.toLowerCase()

    // 1. إذا جاء الطلب مع بيانات متعددة الخطوات (stepData)
    if (stepData) {
      let targetShop = null
      const isManagementOrder = !stepData.shopName || stepData.orderType === "من الإدارة" || stepData.orderType === "تجهيز طلب"

      if (isManagementOrder) {
        targetShop = await prisma.shop.findFirst({
          where: { name: "الإدارة" }
        })
        if (!targetShop) {
          targetShop = await prisma.shop.create({
            data: {
              name: "الإدارة",
              phone: "07700000000"
            }
          })
        }
      } else {
        targetShop = await prisma.shop.findFirst({
          where: { name: { contains: stepData.shopName, mode: 'insensitive' } }
        })
        if (!targetShop) {
          targetShop = await prisma.shop.findFirst()
        }
        if (!targetShop) {
          targetShop = await prisma.shop.create({
            data: {
              name: "الإدارة",
              phone: "07700000000"
            }
          })
        }
      }

      const regionName = (stepData.area || stepData.receiverArea || "البصرة").trim()
      let region = await prisma.region.findFirst({
        where: { name: { equals: regionName, mode: 'insensitive' } }
      })
      if (!region) {
        region = await prisma.region.findFirst({
          where: { name: { contains: regionName, mode: 'insensitive' } }
        })
      }
      if (!region) {
        region = await prisma.region.findFirst()
      }

      // السعر كما يدخله المستخدم بالضبط (إذا أدخل 10 يعني 10، وإذا أدخل 10000 يعني 10000)
      const orderSubtotalNum = parseInt(String(stepData.price || stepData.orderSubtotal || stepData.total || "0").replace(/[^\d]/g, "")) || 0
      const deliveryPriceNum = region?.deliveryPrice ? Number(region.deliveryPrice) : 3000
      const totalAmountNum = orderSubtotalNum + deliveryPriceNum

      let summaryText = stepData.notes || `طلب ${stepData.orderType || "من الإدارة"} - ${regionName}`
      if (stepData.items && Array.isArray(stepData.items) && stepData.items.length > 0) {
        summaryText = `منتجات:\n` + stepData.items.map((it: string, idx: number) => `${idx + 1}- ${it}`).join("\n")
        if (stepData.selectedPreparers && stepData.selectedPreparers.length > 0) {
          summaryText += `\nالمجهزون: ${stepData.selectedPreparers.join(", ")}`
        }
      }

      const newOrder = await prisma.order.create({
        data: {
          shopId: targetShop.id,
          customerPhone: stepData.customerPhone || stepData.receiverPhone || stepData.phone || "07700000000",
          customerRegionId: region?.id || null,
          orderSubtotal: new Decimal(orderSubtotalNum),
          deliveryPrice: new Decimal(deliveryPriceNum),
          totalAmount: new Decimal(totalAmountNum),
          status: stepData.orderType === "تجهيز طلب" ? "preparing" : "pending",
          orderType: stepData.orderType || "من الإدارة",
          submissionSource: "admin",
          summary: summaryText,
          orderNoteTime: stepData.deliveryTime || stepData.time || "فوري",
          customerLandmark: stepData.landmark || "",
          customerLocationUrl: stepData.locationUrl || ""
        }
      })

      return NextResponse.json({
        done: true,
        message: `تم إنشاء وتثبيت الطلب رقم #${newOrder.orderNumber} بنجاح ✅ (سعر الطلب: ${orderSubtotalNum.toLocaleString()} د.ع + توصيل: ${deliveryPriceNum.toLocaleString()} د.ع = الإجمالي: ${totalAmountNum.toLocaleString()} د.ع)`,
        orderNumber: newOrder.orderNumber,
        subtotal: orderSubtotalNum,
        deliveryPrice: deliveryPriceNum,
        total: totalAmountNum
      })
    }

    // 2. فحص الرسائل متعددة الأسطر لطلب التجهيز
    const lines = prompt.split("\n").map((l: string) => l.trim()).filter(Boolean)
    if (lines.length >= 2) {
      let extractedPhone = ""
      let extractedArea = ""
      const remainingItems: string[] = []

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]
        const phoneMatch = line.match(/(07\d{9}|9647\d{9}|\+9647\d{9})/)
        if (phoneMatch && !extractedPhone && i < 2) {
          extractedPhone = phoneMatch[0]
        } else if (!extractedArea && i < 2 && !phoneMatch) {
          extractedArea = line.replace(/^(المنطقة|منطقة|عنوان|العنوان|الى|إلى)\s*[:：-]?\s*/, "")
        } else {
          remainingItems.push(line.replace(/^[-*•\d+.)]\s*/, ""))
        }
      }

      if (extractedPhone || extractedArea) {
        return NextResponse.json({
          done: false,
          isFullMessageOrder: true,
          extractedData: {
            customerPhone: extractedPhone || "07700000000",
            area: extractedArea || "البصرة",
            items: remainingItems.length > 0 ? remainingItems : ["طلب عام"],
            orderType: "تجهيز طلب"
          },
          message: "تم استخراج بيانات الطلب بنجاح! يرجى تحديد المجهزين والموردين المطلوبين:"
        })
      }
    }

    // 3. الفحص السريع الداخلي باللغة العراقية
    // أ- تصفير حساب
    if (text.includes("صفر") && (text.includes("حساب") || text.includes("رصيد") || text.includes("مستحقات"))) {
      const words = prompt.split(/\s+/)
      let riderName = ""
      const idx = words.findIndex((w: string) => w.includes("حساب") || w.includes("رصيد") || w.includes("مندوب"))
      if (idx !== -1 && words[idx + 1]) {
        riderName = words[idx + 1].replace(/[^\u0600-\u06FFa-zA-Z0-9]/g, "")
      }
      if (!riderName) {
        const match = prompt.match(/فارس|حسين|علي|محمد|نجم|احمد|أحمد|كرار|عباس|سجاد/)
        if (match) riderName = match[0]
      }

      const rider = await prisma.courier.findFirst({
        where: riderName ? { name: { contains: riderName, mode: 'insensitive' } } : undefined
      })

      if (!rider) return NextResponse.json({ done: false, message: "المندوب ما انلگه" })

      await prisma.courier.update({
        where: { id: rider.id },
        data: { mandoubTotalsResetAt: new Date() }
      })
      return NextResponse.json({ done: true, message: `تم تصفير حساب ${rider.name} بنجاح ✅` })
    }

    // ب- إسناد طلب
    if (text.includes("اسند") || text.includes("اسناد") || text.includes("حول طلب")) {
      const orderIdMatch = prompt.match(/\d{1,6}/)
      const orderId = orderIdMatch ? orderIdMatch[0] : null

      let riderName = ""
      const words = prompt.split(/\s+/)
      const toIdx = words.findIndex((w: string) => w === "الى" || w === "لـ" || w.startsWith("ل"))
      if (toIdx !== -1 && words[toIdx + 1]) {
        riderName = words[toIdx + 1].replace(/[^\u0600-\u06FFa-zA-Z0-9]/g, "")
      }
      if (!riderName) {
        const match = prompt.match(/فارس|حسين|علي|محمد|نجم|احمد|أحمد|كرار|عباس|سجاد/)
        if (match) riderName = match[0]
      }

      const rider = await prisma.courier.findFirst({
        where: riderName ? { name: { contains: riderName, mode: 'insensitive' } } : undefined
      })

      const order = orderId
        ? await prisma.order.findFirst({
            where: {
              OR: [
                { id: { contains: orderId } },
                { orderNumber: parseInt(orderId) || 0 }
              ]
            },
            orderBy: { createdAt: 'desc' }
          })
        : await prisma.order.findFirst({ orderBy: { createdAt: 'desc' } })

      if (!order || !rider) return NextResponse.json({ done: false, message: "الطلب او المندوب ما انلگه" })

      await prisma.order.update({
        where: { id: order.id },
        data: { assignedCourierId: rider.id, status: "assigned" }
      })
      return NextResponse.json({ done: true, message: `تم اسناد طلب #${order.orderNumber || order.id.slice(-4)} الى ${rider.name} ✅` })
    }

    // ج- إنشاء طلب سريع داخلي
    if (
      (text.includes("سوي") || text.includes("سويلي") || text.includes("اريد") || text.includes("اضافة") || text.includes("انشاء") || text.includes("طلب")) &&
      (text.includes("طلب") || text.includes("طلبية") || text.includes("اطلب") || text.includes("اوردر"))
    ) {
      return NextResponse.json({
        done: false,
        needType: true,
        message: "تأمرني أمر يا أبو الأكبر! شنو نوع الطلب؟ اختار:\n1- من الإدارة\n2- وجهتين\n3- من محل\n4- تجهيز طلب"
      })
    }

    // 4. الذكاء الهجين: إذا لم يكن الأمر بسيطاً، استشارة جمناي
    const geminiResult = await askGemini(prompt)
    if (geminiResult) {
      try {
        const cleanJson = geminiResult.replace(/```json|```/g, "").trim()
        const parsed = JSON.parse(cleanJson)

        if (parsed.intent === "create_order") {
          return NextResponse.json({
            done: false,
            needType: true,
            message: "فهمت عليك يا أبو الأكبر! شنو نوع الطلب اللي تريده؟ اختار:\n1- من الإدارة\n2- وجهتين\n3- من محل\n4- تجهيز طلب"
          })
        }

        if (parsed.intent === "zero_balance" && parsed.riderName) {
          const rider = await prisma.courier.findFirst({
            where: { name: { contains: parsed.riderName, mode: 'insensitive' } }
          })
          if (rider) {
            await prisma.courier.update({
              where: { id: rider.id },
              data: { mandoubTotalsResetAt: new Date() }
            })
            return NextResponse.json({ done: true, message: `تم تصفير حساب ${rider.name} بنجاح عبر الذكاء ✅` })
          }
        }

        if (parsed.intent === "assign_order" && parsed.riderName) {
          const rider = await prisma.courier.findFirst({
            where: { name: { contains: parsed.riderName, mode: 'insensitive' } }
          })
          const order = parsed.orderId
            ? await prisma.order.findFirst({
                where: {
                  OR: [
                    { id: { contains: parsed.orderId } },
                    { orderNumber: parseInt(parsed.orderId) || 0 }
                  ]
                }
              })
            : await prisma.order.findFirst({ orderBy: { createdAt: 'desc' } })

          if (rider && order) {
            await prisma.order.update({
              where: { id: order.id },
              data: { assignedCourierId: rider.id, status: "assigned" }
            })
            return NextResponse.json({ done: true, message: `تم إسناد الطلب #${order.orderNumber} للمندوب ${rider.name} بنجاح ✅` })
          }
        }

        if (parsed.reply) {
          return NextResponse.json({ done: true, message: parsed.reply })
        }
      } catch (err) {
        // فشل تحليل JSON
      }
    }

    return NextResponse.json({
      done: false,
      message: "ما فهمت قصدك يا أبو الأكبر، جرب تكتب مثلاً: 'سويلي طلب' أو 'صفر حساب فارس' أو 'اسند طلب 102 لفارس' 🚀"
    })

  } catch (e: any) {
    console.error("[ai-agent route error]:", e)
    return NextResponse.json({ done: false, message: e.message || "حدث خطأ غير متوقع" }, { status: 500 })
  }
}

export async function GET() {
  try {
    const count = await prisma.order.count()
    return NextResponse.json({ status: "AI Agent الهجين الخارق شغال 🚀", orders: count })
  } catch (e: any) {
    return NextResponse.json({ status: "AI Agent جاهز", orders: 0 })
  }
}
