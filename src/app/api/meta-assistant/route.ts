import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// مفتاح سري حتى محد يلعب بموقعنا غير Meta AI
const SECRET = process.env.META_ASSISTANT_SECRET || "abokbr-2024-secure"

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const q = searchParams.get('q') || ""

  try {
    // اذا سأل عن مندوب معين
    if (q.includes("مندوب") || q.includes("فارس") || q.includes("رايدر")) {
      const couriers = await prisma.courier.findMany({
        select: {
          id: true,
          name: true,
          phone: true,
          mandoubWalletCarryOverDinar: true,
          blocked: true,
          availableForAssignment: true
        }
      })

      const riders = couriers.map((c) => ({
        id: c.id,
        name: c.name,
        phone: c.phone,
        balance: Number(c.mandoubWalletCarryOverDinar || 0),
        isActive: !c.blocked && c.availableForAssignment
      }))

      return NextResponse.json({ type: "riders", riders })
    }

    // اذا سأل عن طلب رقم
    const orderMatch = q.match(/\d+/)
    if (orderMatch && q.includes("طلب")) {
      const orderIdStr = orderMatch[0]
      const num = parseInt(orderIdStr, 10)

      const order = await prisma.order.findFirst({
        where: {
          OR: [
            ...(isNaN(num) ? [] : [{ orderNumber: num }]),
            { id: { contains: orderIdStr } },
            { adminOrderCode: { contains: orderIdStr } }
          ]
        },
        include: {
          courier: true,
          customer: true
        }
      })

      if (order) {
        const mappedOrder = {
          ...order,
          rider: order.courier
            ? {
                id: order.courier.id,
                name: order.courier.name,
                phone: order.courier.phone
              }
            : null,
          customerName: order.customer?.name || order.customerPhone || "عميل",
          total: Number(order.totalAmount || 0)
        }
        return NextResponse.json({ type: "order", order: mappedOrder })
      }

      return NextResponse.json({ type: "order", order: null, message: "الطلب غير موجود" })
    }

    // الملخص العام
    const ordersCount = await prisma.order.count()
    const ridersCount = await prisma.courier.count()
    const pendingCount = await prisma.order.count({
      where: {
        status: { in: ["pending", "PENDING", "معلق"] }
      }
    })

    const rawOrders = await prisma.order.findMany({
      orderBy: { createdAt: "desc" },
      take: 5,
      select: {
        id: true,
        orderNumber: true,
        status: true,
        totalAmount: true,
        createdAt: true,
        customerPhone: true,
        summary: true,
        customer: {
          select: { name: true }
        }
      }
    })

    const lastOrders = rawOrders.map((o) => ({
      id: o.orderNumber ? String(o.orderNumber) : o.id,
      realId: o.id,
      status: o.status,
      total: Number(o.totalAmount || 0),
      createdAt: o.createdAt,
      customerName: o.customer?.name || o.summary || o.customerPhone || "عميل"
    }))

    return NextResponse.json({
      status: "live",
      brain: "super",
      ordersCount,
      ridersCount,
      pendingCount,
      lastOrders,
      message: "العقل الفائق شغال"
    })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || String(e) })
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    if (body.secret !== SECRET) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 })
    }

    const { action } = body

    if (action === "zero_balance") {
      // صفر حساب المندوب - body: { riderName: "فارس" }
      const rider = await prisma.courier.findFirst({
        where: { name: { contains: body.riderName } }
      })
      if (!rider) return NextResponse.json({ error: "المندوب ما انلگه" })
      await prisma.courier.update({
        where: { id: rider.id },
        data: { mandoubWalletCarryOverDinar: 0 }
      })
      return NextResponse.json({ success: true, message: `تم تصفير حساب ${rider.name}` })
    }

    if (action === "hide_rider") {
      const rider = await prisma.courier.findFirst({
        where: { name: { contains: body.riderName } }
      })
      if (!rider) return NextResponse.json({ error: "المندوب ما انلگه" })
      await prisma.courier.update({
        where: { id: rider.id },
        data: { availableForAssignment: false, blocked: true }
      })
      return NextResponse.json({ success: true, message: `تم اخفاء المندوب ${body.riderName}` })
    }

    if (action === "show_rider") {
      const rider = await prisma.courier.findFirst({
        where: { name: { contains: body.riderName } }
      })
      if (!rider) return NextResponse.json({ error: "المندوب ما انلگه" })
      await prisma.courier.update({
        where: { id: rider.id },
        data: { availableForAssignment: true, blocked: false }
      })
      return NextResponse.json({ success: true, message: `تم اظهار المندوب ${body.riderName}` })
    }

    if (action === "assign_order") {
      // اسناد طلب لفارس: { orderId: "2815", riderName: "فارس" }
      const rider = await prisma.courier.findFirst({
        where: { name: { contains: body.riderName } }
      })
      const orderIdStr = String(body.orderId || "")
      const num = parseInt(orderIdStr, 10)

      const order = await prisma.order.findFirst({
        where: {
          OR: [
            ...(isNaN(num) ? [] : [{ orderNumber: num }]),
            { id: { contains: orderIdStr } },
            { adminOrderCode: { contains: orderIdStr } }
          ]
        }
      })
      if (!order || !rider) return NextResponse.json({ error: "الطلب او المندوب ما انلگه" })
      await prisma.order.update({
        where: { id: order.id },
        data: { assignedCourierId: rider.id, status: "assigned" }
      })
      return NextResponse.json({
        success: true,
        message: `تم اسناد طلب ${body.orderId} الى ${rider.name}`
      })
    }

    if (action === "set_status") {
      // تغيير حالة طلب: { orderId, status: "PREPARING" }
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
      const newStatus = statusMap[body.status] || body.status
      const orderIdStr = String(body.orderId || "")
      const num = parseInt(orderIdStr, 10)

      const order = await prisma.order.findFirst({
        where: {
          OR: [
            ...(isNaN(num) ? [] : [{ orderNumber: num }]),
            { id: { contains: orderIdStr } },
            { adminOrderCode: { contains: orderIdStr } }
          ]
        }
      })
      if (!order) return NextResponse.json({ error: "الطلب ما انلگه" })
      await prisma.order.update({
        where: { id: order.id },
        data: { status: newStatus }
      })
      return NextResponse.json({
        success: true,
        message: `تم تحويل طلب ${body.orderId} الى ${body.status}`
      })
    }

    return NextResponse.json({ error: "امر غير معروف" })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || String(e) }, { status: 500 })
  }
}
