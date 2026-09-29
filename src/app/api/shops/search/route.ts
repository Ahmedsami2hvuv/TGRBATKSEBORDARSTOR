import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const q = (searchParams.get('q') || "").trim()

    if (!q) {
      const topShops = await prisma.shop.findMany({
        take: 10,
        orderBy: { updatedAt: 'desc' },
        include: { region: { select: { name: true } } }
      })
      return NextResponse.json({
        shops: topShops.map(s => ({
          id: s.id,
          name: s.name,
          regionName: s.region?.name || "عام",
          phone: s.phone
        }))
      })
    }

    const shops = await prisma.shop.findMany({
      where: {
        name: { contains: q, mode: 'insensitive' }
      },
      take: 12,
      include: { region: { select: { name: true } } },
      orderBy: { updatedAt: 'desc' }
    })

    return NextResponse.json({
      shops: shops.map(s => ({
        id: s.id,
        name: s.name,
        regionName: s.region?.name || "عام",
        phone: s.phone
      }))
    })
  } catch (error: any) {
    console.error("Shop search error:", error)
    return NextResponse.json({ shops: [] })
  }
}
