import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const [preparers, storeSuppliers, partners] = await Promise.all([
      prisma.companyPreparer.findMany({
        where: { active: true },
        select: { id: true, name: true, phone: true }
      }).catch(() => []),
      prisma.storeSupplier.findMany({
        where: { active: true },
        select: { id: true, name: true, phone: true }
      }).catch(() => []),
      prisma.creditBookPartner.findMany({
        select: { id: true, name: true, phone: true, type: true }
      }).catch(() => [])
    ])

    const formattedSuppliers = [
      ...storeSuppliers.map(s => ({ id: s.id, name: s.name, phone: s.phone || "", type: 'supplier' })),
      ...partners.filter(p => p.type === 'supplier' || p.type === 'preparer' || p.type === 'external').map(p => ({
        id: p.id,
        name: p.name,
        phone: p.phone || "",
        type: p.type
      }))
    ]

    // إزالة التكرار حسب الاسم
    const uniqueSuppliers = Array.from(new Map(formattedSuppliers.map(s => [s.name, s])).values())

    return NextResponse.json({
      ok: true,
      preparers: preparers || [],
      suppliers: uniqueSuppliers || []
    })
  } catch (error: any) {
    console.error("Preparers-and-suppliers API error:", error)
    return NextResponse.json({ ok: false, preparers: [], suppliers: [] })
  }
}


