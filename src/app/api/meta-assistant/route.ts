import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const ordersCount = await prisma.order.count()
    const lastOrder = await prisma.order.findFirst({ orderBy: { createdAt: 'desc' } })
    const ridersCount =
      (await (prisma as any).user?.count({ where: { role: 'RIDER' } }).catch(() => 0)) ??
      (await prisma.courier.count().catch(() => 0))

    return Response.json({
      status: "live",
      site: "aboakbr.com",
      ordersCount,
      ridersCount,
      lastOrder,
      message: "البيانات حية من Prisma - الربط ناجح 100%"
    })
  } catch (e: any) {
    return Response.json({ status: "error", error: e?.message || String(e) })
  }
}
