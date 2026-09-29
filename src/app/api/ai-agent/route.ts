import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { Decimal } from '@prisma/client/runtime/library'

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}))
    const prompt = body.prompt || ""
    const stepData = body.stepData
    const text = (prompt || "").toLowerCase()

    // --- محرك اوامر مباشر يفهم عراقي بدون ما يعتمد على AI ---

    // تصفير حساب
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

    // اسناد طلب
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

    // تغيير حالة طلب
    if (text.includes("حول") || text.includes("غير حالة") || text.includes("سوي حالة")) {
      const orderIdMatch = prompt.match(/\d{1,6}/)
      const orderId = orderIdMatch ? orderIdMatch[0] : null
      let status = "pending"
      if (text.includes("تجهيز")) status = "preparing"
      if (text.includes("توصيل") || text.includes("طريق")) status = "assigned"
      if (text.includes("واصل") || text.includes("مسلم")) status = "delivered"
      if (text.includes("راجع") || text.includes("مرتجع")) status = "returned"
      if (text.includes("ملغي") || text.includes("الغاء")) status = "cancelled"

      const order = orderId
        ? await prisma.order.findFirst({
            where: {
              OR: [
                { id: { contains: orderId } },
                { orderNumber: parseInt(orderId) || 0 }
              ]
            }
          })
        : await prisma.order.findFirst({ orderBy: { createdAt: 'desc' } })

      if (!order) return NextResponse.json({ done: false, message: "الطلب ما انلگه" })

      await prisma.order.update({
        where: { id: order.id },
        data: { status }
      })
      return NextResponse.json({ done: true, message: `تم تحويل طلب #${order.orderNumber || order.id.slice(-4)} الى حالة ${status} ✅` })
    }

    // انشاء طلب - اذا جاي مع stepData يعني جاي من المحادثة المتعددة الخطوات
    if (stepData) {
      let defaultShop = await prisma.shop.findFirst({
        where: stepData.shopName ? { name: { contains: stepData.shopName, mode: 'insensitive' } } : undefined
      })
      if (!defaultShop) {
        defaultShop = await prisma.shop.findFirst()
      }
      if (!defaultShop) {
        defaultShop = await prisma.shop.create({
          data: {
            name: "المتجر العام",
            phone: "07700000000"
          }
        })
      }

      // البحث عن المنطقة للحصول على سعر التوصيل
      const regionName = stepData.area || stepData.receiverArea || "البصرة"
      let region = await prisma.region.findFirst({
        where: { name: { contains: regionName, mode: 'insensitive' } }
      })
      if (!region) {
        region = await prisma.region.findFirst()
      }

      const totalNum = parseInt(String(stepData.price || stepData.total || "15000").replace(/[^\d]/g, "")) || 15000
      const deliveryPriceNum = region?.deliveryPrice ? Number(region.deliveryPrice) : 3000

      // بناء ملخص المنتجات والمجهزين إن وجدت
      let summaryText = stepData.notes || `طلب ${stepData.orderType || "جديد"} - ${regionName}`
      if (stepData.items && Array.isArray(stepData.items) && stepData.items.length > 0) {
        summaryText = `منتجات:\n` + stepData.items.map((it: string, idx: number) => `${idx + 1}- ${it}`).join("\n")
        if (stepData.selectedPreparers && stepData.selectedPreparers.length > 0) {
          summaryText += `\nالمجهزون: ${stepData.selectedPreparers.join(", ")}`
        }
      }

      const newOrder = await prisma.order.create({
        data: {
          shopId: defaultShop.id,
          customerPhone: stepData.customerPhone || stepData.receiverPhone || stepData.phone || "07700000000",
          customerRegionId: region?.id || null,
          totalAmount: new Decimal(totalNum),
          orderSubtotal: new Decimal(Math.max(0, totalNum - deliveryPriceNum)),
          deliveryPrice: new Decimal(deliveryPriceNum),
          status: stepData.orderType === "تجهيز طلب" ? "preparing" : "pending",
          orderType: stepData.orderType || "من الإدارة",
          summary: summaryText,
          orderNoteTime: stepData.deliveryTime || stepData.time || "فوري",
          customerLandmark: stepData.landmark || "",
          customerLocationUrl: stepData.locationUrl || ""
        }
      })

      return NextResponse.json({
        done: true,
        message: `تم انشاء طلب جديد رقم #${newOrder.orderNumber} بنجاح ✅`,
        orderNumber: newOrder.orderNumber
      })
    }

    // تحليل إذا كانت رسالة كاملة متعددة الأسطر لطلب تجهيز
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
          message: "تم استخراج بيانات الطلب! يرجى تحديد المجهزين والموردين المطلوبين:"
        })
      }
    }

    // اذا بس كتب "سويلي طلب" يرجع يطلب نوع الطلب مع الخيار الرابع "تجهيز طلب"
    if (text.includes("سويلي طلب") || text.includes("سوي طلب") || text.includes("اضافة طلب")) {
      return NextResponse.json({
        done: false,
        needType: true,
        message: "شنو نوع الطلب؟ اختار:\n1- من الادارة\n2- وجهتين\n3- من محل\n4- تجهيز طلب"
      })
    }

    // الرد الذكي المساعد
    return NextResponse.json({
      done: false,
      message: "ما فهمت الامر يا أبو الأكبر، تكدر تكتب مثلاً: 'صفر حساب المندوب فارس' أو 'اسند طلب 102 لفارس' أو 'سويلي طلب' 🚀"
    })

  } catch (e: any) {
    console.error("[ai-agent route error]:", e)
    return NextResponse.json({ done: false, message: e.message || "حدث خطأ غير متوقع" }, { status: 500 })
  }
}

export async function GET() {
  try {
    const count = await prisma.order.count()
    return NextResponse.json({ status: "AI Agent الخارق شغال 🚀", orders: count })
  } catch (e: any) {
    return NextResponse.json({ status: "AI Agent جاهز", orders: 0 })
  }
}
