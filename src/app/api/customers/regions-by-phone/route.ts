import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { normalizeIraqMobileLocal11 } from "@/lib/whatsapp";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const phoneParam = searchParams.get("phone");
  if (!phoneParam) return NextResponse.json({ regions: [] });

  const phone = normalizeIraqMobileLocal11(phoneParam);
  if (!phone) return NextResponse.json({ regions: [] });

  try {
    const profiles = await prisma.customerPhoneProfile.findMany({
      where: { phone },
      include: {
        region: { select: { id: true, name: true, deliveryPrice: true } }
      }
    });

    const orders = await prisma.order.findMany({
      where: { customerPhone: phone, customerRegionId: { not: null } },
      select: {
        customerRegion: { select: { id: true, name: true, deliveryPrice: true } }
      },
      distinct: ['customerRegionId'],
      take: 10
    });

    const regionMap = new Map();
    
    for (const p of profiles) {
      if (p.region) {
        regionMap.set(p.region.id, {
          id: p.region.id,
          name: p.region.name,
          deliveryPrice: p.region.deliveryPrice.toString(),
        });
      }
    }

    for (const o of orders) {
      if (o.customerRegion && !regionMap.has(o.customerRegion.id)) {
        regionMap.set(o.customerRegion.id, {
          id: o.customerRegion.id,
          name: o.customerRegion.name,
          deliveryPrice: o.customerRegion.deliveryPrice.toString(),
        });
      }
    }

    const regions = Array.from(regionMap.values());
    
    return NextResponse.json({ regions });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ regions: [] }, { status: 500 });
  }
}
