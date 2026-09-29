import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const [preparers, suppliers] = await Promise.all([
      prisma.companyPreparer.findMany({
        where: { active: true },
        select: { id: true, name: true, phone: true }
      }),
      prisma.creditBookPartner.findMany({
        where: { isHidden: false },
        select: { id: true, name: true, phone: true, role: true }
      })
    ])

    return NextResponse.json({
      ok: true,
      preparers: preparers || [],
      suppliers: suppliers || []
    })
  } catch (error: any) {
    return NextResponse.json({ ok: false, preparers: [], suppliers: [] })
  }
}
