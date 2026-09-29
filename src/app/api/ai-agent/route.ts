import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { callGemini } from '@/lib/gemini-pool'

function parseFallbackIntent(prompt: string): any {
  const p = prompt.trim()

  // تصفير حساب
  if (p.includes("صفر") || p.includes("تصفير")) {
    const riderName = p.replace(/.*(?:صفر|تصفير|حساب|رصيد|مندوب|كابتن)\s*/, "").trim() || "فارس"
    return { action: "zero_balance", riderName: riderName.replace(/حساب|رصيد/g, "").trim() }
  }

  // إخفاء مندوب
  if (p.includes("اخفي") || p.includes("إخفاء") || p.includes("وقف") || p.includes("عطل")) {
    const riderName = p.replace(/.*(?:اخفي|إخفاء|وقف|عطل|مندوب|كابتن)\s*/, "").trim()
    return { action: "hide_rider", riderName }
  }

  // إظهار مندوب
  if (p.includes("اظهر") || p.includes("إظهار") || p.includes("فعل") || p.includes("شغل")) {
    const riderName = p.replace(/.*(?:اظهر|إظهار|فعل|شغل|مندوب|كابتن)\s*/, "").trim()
    return { action: "show_rider", riderName }
  }

  // إسناد طلب
  const numMatch = p.match(/\d+/)
  if ((p.includes("اسند") || p.includes("انطي") || p.includes("حول") || p.includes("سلم")) && numMatch) {
    const riderName = p.replace(/.*(?:الى|لـ|ل|كابتن|مندوب)\s*/, "").trim()
    return { action: "assign_order", orderId: numMatch[0], riderName }
  }

  // تغيير حالة
  if ((p.includes("حالة") || p.includes("طلب")) && numMatch) {
    let status = "DELIVERED"
    if (p.includes("تجهيز")) status = "PREPARING"
    else if (p.includes("توصيل")) status = "ON_DELIVERY"
    else if (p.includes("واصل") || p.includes("تم")) status = "DELIVERED"
    else if (p.includes("معلق")) status = "PENDING"
    return { action: "set_status", orderId: numMatch[0], status }
  }

  return null
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const type = searchParams.get("type")

    if (type === "metadata") {
      const [shops, customers] = await Promise.all([
        prisma.shop.findMany({ select: { id: true, name: true }, take: 40 }).catch(() => []),
        prisma.customer.findMany({ select: { id: true, name: true, phone: true }, take: 40 }).catch(() => [])
      ])
      return NextResponse.json({ shops, customers })
    }

    return NextResponse.json({ status: "ready", service: "ai-agent" })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || String(e) }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { prompt, action } = body

    // في حال تم إرسال أمر مباشر (مثل إنشاء طلب مجمع من الواجهة التفاعلية)
    let cmd: any = null

    if (action === "create_order" || body.orderType) {
      cmd = { action: "create_order", ...body }
    } else if (prompt) {
      // 1. محاولة استخدام جمناي لتحويل الكلام العراقي لأمر JSON
      try {
        const systemPrompt = `
        انت مدير تنفيذي لمنصة aboakbr.com
        حول كلام المستخدم الى JSON امر واحد فقط بدون اي شرح او كود ماركداون:
        {"action":"zero_balance","riderName":"فارس"} او
        {"action":"hide_rider","riderName":"فارس"} او
        {"action":"show_rider","riderName":"فارس"} او
        {"action":"assign_order","orderId":"2815","riderName":"فارس"} او
        {"action":"set_status","orderId":"2815","status":"DELIVERED"} او
        {"action":"create_order","customerName":"...","customerPhone":"..."}
        
        كلام المستخدم: ${prompt}
        ارجع JSON فقط
        `
        const aiResponse = await callGemini(systemPrompt)
        const jsonMatch = aiResponse.match(/\{[\s\S]*\}/)
        if (jsonMatch) {
          cmd = JSON.parse(jsonMatch[0])
        }
      } catch (geminiError) {
        cmd = parseFallbackIntent(prompt)
      }

      if (!cmd || !cmd.action) {
        cmd = parseFallbackIntent(prompt)
      }
    }

    if (!cmd || !cmd.action) {
      return NextResponse.json({ done: false, error: "ما فهمت الامر يا غالي، وضحلي اكثر" })
    }

    // 2. تنفيذ الأوامر المباشرة

    // إنشاء طلب جديد في قاعدة البيانات
    if (cmd.action === "create_order") {
      // إيجاد المحل المناسب أو استخدام المحل الافتراضي للإدارة
      let targetShop: { id: string; name: string } | null = null

      if (cmd.shopId) {
        targetShop = await prisma.shop.findUnique({ where: { id: cmd.shopId }, select: { id: true, name: true } }).catch(() => null)
      } else if (cmd.shopName) {
        targetShop = await prisma.shop.findFirst({
          where: { name: { contains: cmd.shopName } },
          select: { id: true, name: true }
        }).catch(() => null)
      }

      if (!targetShop) {
        targetShop = await prisma.shop.findFirst({ select: { id: true, name: true } }).catch(() => null)
      }

      // إذا لم يكن هناك أي متجر في قاعدة البيانات، ننشئ متجر الإدارة الافتراضي
      if (!targetShop) {
        targetShop = await prisma.shop.create({
          data: {
            name: "إدارة أبو الأكبر",
            phone: "07800000000"
          },
          select: { id: true, name: true }
        })
      }

      // البحث عن المنطقة لربطها
      let regionId: string | null = null
      const regionSearch = cmd.customerRegionName || cmd.destinationRegion || cmd.region
      if (regionSearch) {
        const foundRegion = await prisma.region.findFirst({
          where: { name: { contains: regionSearch } }
        }).catch(() => null)
        if (foundRegion) regionId = foundRegion.id
      }

      // البحث عن العميل أو ربطه
      let customerId: string | null = null
      const phoneToUse = cmd.customerPhone || cmd.recipientPhone || cmd.phone || ""
      if (phoneToUse) {
        let foundCustomer = await prisma.customer.findFirst({
          where: { phone: phoneToUse }
        }).catch(() => null)

        if (!foundCustomer && cmd.customerName) {
          foundCustomer = await prisma.customer.create({
            data: {
              name: cmd.customerName,
              phone: phoneToUse
            }
          }).catch(() => null)
        }
        if (foundCustomer) customerId = foundCustomer.id
      }

      // تجهيز الوصف والملخص
      const summaryParts = [
        cmd.orderType || "طلب إدارة",
        cmd.orderSubtype ? `النوع: ${cmd.orderSubtype}` : "",
        cmd.customerRegionName ? `المنطقة: ${cmd.customerRegionName}` : "",
        cmd.senderRegionName ? `من: ${cmd.senderRegionName}` : "",
        cmd.senderPhone ? `هاتف المرسل: ${cmd.senderPhone}` : "",
        cmd.customerName ? `العميل: ${cmd.customerName}` : "",
        cmd.notes
      ].filter(Boolean).join(" | ")

      const parsedPrice = parseFloat(String(cmd.price || cmd.totalAmount || "0").replace(/[^\d.]/g, "")) || 0

      // إنشاء الطلب في بريزما
      const newOrder = await prisma.order.create({
        data: {
          shopId: targetShop.id,
          orderType: cmd.orderType || "طلب من الإدارة",
          customerPhone: phoneToUse,
          alternatePhone: cmd.senderPhone || null,
          customerRegionId: regionId,
          customerId: customerId,
          totalAmount: parsedPrice,
          orderNoteTime: cmd.orderTime || "",
          summary: summaryParts,
          status: "pending"
        }
      })

      const displayNum = newOrder.orderNumber || newOrder.id

      return NextResponse.json({
        done: true,
        action: "create_order",
        orderId: displayNum,
        order: newOrder,
        message: `تم إنشاء الطلب بنجاح برقم #${displayNum} 📦\nنوع الطلب: ${cmd.orderType || "طلب جديد"}\nالمبلغ: ${parsedPrice} دينار`
      })
    }

    // تصفير حساب المندوب
    if (cmd.action === "zero_balance") {
      const riderName = cmd.riderName || ""
      const rider = await prisma.courier.findFirst({
        where: { name: { contains: riderName } }
      })
      if (!rider) {
        return NextResponse.json({ done: false, error: `المندوب (${riderName}) ما انلگه بقاعدة البيانات` })
      }
      await prisma.courier.update({
        where: { id: rider.id },
        data: {
          mandoubWalletCarryOverDinar: 0,
          mandoubTotalsResetAt: new Date()
        }
      })
      return NextResponse.json({
        done: true,
        action: "zero_balance",
        message: `تم تصفير حساب الكابتن (${rider.name}) بنجاح - 0 دينار 🚀`
      })
    }

    // إخفاء المندوب
    if (cmd.action === "hide_rider") {
      const riderName = cmd.riderName || ""
      const rider = await prisma.courier.findFirst({
        where: { name: { contains: riderName } }
      })
      if (!rider) {
        return NextResponse.json({ done: false, error: `المندوب (${riderName}) ما انلگه` })
      }
      await prisma.courier.update({
        where: { id: rider.id },
        data: { availableForAssignment: false, blocked: true }
      })
      return NextResponse.json({
        done: true,
        action: "hide_rider",
        message: `تم إخفاء وتجميد المندوب (${rider.name}) عن استلام الطلبات 🛑`
      })
    }

    // إظهار وتفعيل المندوب
    if (cmd.action === "show_rider") {
      const riderName = cmd.riderName || ""
      const rider = await prisma.courier.findFirst({
        where: { name: { contains: riderName } }
      })
      if (!rider) {
        return NextResponse.json({ done: false, error: `المندوب (${riderName}) ما انلگه` })
      }
      await prisma.courier.update({
        where: { id: rider.id },
        data: { availableForAssignment: true, blocked: false }
      })
      return NextResponse.json({
        done: true,
        action: "show_rider",
        message: `تم إظهار وتفعيل المندوب (${rider.name}) وجعله متاحاً 🚀`
      })
    }

    // إسناد طلب لمندوب
    if (cmd.action === "assign_order") {
      const riderName = cmd.riderName || ""
      const orderIdStr = String(cmd.orderId || "")
      const num = parseInt(orderIdStr, 10)

      const rider = await prisma.courier.findFirst({
        where: { name: { contains: riderName } }
      })
      const order = await prisma.order.findFirst({
        where: {
          OR: [
            ...(isNaN(num) ? [] : [{ orderNumber: num }]),
            { id: { contains: orderIdStr } },
            { adminOrderCode: { contains: orderIdStr } }
          ]
        }
      })

      if (!order) {
        return NextResponse.json({ done: false, error: `الطلب رقم (${orderIdStr}) ما انلگه` })
      }
      if (!rider) {
        return NextResponse.json({ done: false, error: `المندوب (${riderName}) ما انلگه` })
      }

      await prisma.order.update({
        where: { id: order.id },
        data: { assignedCourierId: rider.id, status: "assigned" }
      })
      return NextResponse.json({
        done: true,
        action: "assign_order",
        message: `تم إسناد الطلب #${order.orderNumber || orderIdStr} إلى الكابتن (${rider.name}) بنجاح 🛵`
      })
    }

    // تحديث حالة الطلب
    if (cmd.action === "set_status") {
      const orderIdStr = String(cmd.orderId || "")
      const num = parseInt(orderIdStr, 10)

      const statusMap: Record<string, string> = {
        "تجهيز": "preparing",
        "توصيل": "on_delivery",
        "واصل": "delivered",
        "معلق": "pending",
        "ملغي": "cancelled",
        "PREPARING": "preparing",
        "ON_DELIVERY": "on_delivery",
        "DELIVERED": "delivered",
        "PENDING": "pending",
        "ASSIGNED": "assigned"
      }
      const finalStatus = statusMap[cmd.status] || cmd.status?.toLowerCase() || "delivered"

      const order = await prisma.order.findFirst({
        where: {
          OR: [
            ...(isNaN(num) ? [] : [{ orderNumber: num }]),
            { id: { contains: orderIdStr } },
            { adminOrderCode: { contains: orderIdStr } }
          ]
        }
      })

      if (!order) {
        return NextResponse.json({ done: false, error: `الطلب رقم (${orderIdStr}) ما انلگه` })
      }

      await prisma.order.update({
        where: { id: order.id },
        data: { status: finalStatus }
      })

      return NextResponse.json({
        done: true,
        action: "set_status",
        message: `تم تحديث حالة الطلب #${order.orderNumber || orderIdStr} إلى (${cmd.status}) بنجاح ✅`
      })
    }

    return NextResponse.json({ done: false, error: "أمر غير معروف", cmd })
  } catch (e: any) {
    return NextResponse.json({ done: false, error: e?.message || String(e) }, { status: 500 })
  }
}
