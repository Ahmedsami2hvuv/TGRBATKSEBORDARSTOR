import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { normalizeRegionNameForMatch } from '@/lib/region-name-normalize'

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const q = (searchParams.get('q') || "").trim()
    
    const allRegions = await prisma.region.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, deliveryPrice: true }
    })

    if (!q) {
      return NextResponse.json({
        areas: allRegions.slice(0, 15).map(r => r.name),
        regions: allRegions.slice(0, 15)
      })
    }

    const normQ = normalizeRegionNameForMatch(q)
    const tokens = normQ.split(/\s+/).filter(t => t.length > 0)

    // تطابق تام أولاً
    const exact = allRegions.filter(r => normalizeRegionNameForMatch(r.name) === normQ)
    if (exact.length > 0) {
      const matchNames = exact.map(r => r.name)
      // جلب المناطق الإضافية المشابهة
      const similar = allRegions.filter(r => {
        const normName = normalizeRegionNameForMatch(r.name)
        return normName !== normQ && normName.includes(normQ)
      })
      const combined = [...exact, ...similar]
      return NextResponse.json({
        areas: combined.map(r => r.name),
        regions: combined
      })
    }

    // مطابقة التوكنز
    const strict = allRegions.filter(r => {
      const normName = normalizeRegionNameForMatch(r.name)
      return tokens.every(t => normName.includes(t))
    })

    if (strict.length > 0) {
      return NextResponse.json({
        areas: strict.map(r => r.name),
        regions: strict
      })
    }

    // بحث مرن
    const flexible = allRegions
      .map(r => {
        const normName = normalizeRegionNameForMatch(r.name)
        let score = 0
        for (const t of tokens) {
          if (t.length >= 2 && normName.includes(t)) score++
        }
        return { r, score }
      })
      .filter(x => x.score > 0)
      .sort((a, b) => b.score - a.score || a.r.name.length - b.r.name.length)
      .map(x => x.r)

    return NextResponse.json({
      areas: flexible.length > 0 ? flexible.map(r => r.name) : allRegions.slice(0, 5).map(r => r.name),
      regions: flexible.length > 0 ? flexible : allRegions.slice(0, 5)
    })
  } catch (error: any) {
    console.error("Areas search error:", error)
    return NextResponse.json({ areas: [], regions: [] })
  }
}

