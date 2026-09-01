import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { normalizeIraqMobileLocal11 } from "@/lib/whatsapp";

function getPhoneVariants(raw: string): { normalized: string; variants: string[]; last9Digits: string } | null {
  const digits = raw.replace(/\D/g, "");
  if (digits.length < 8) return null;

  const last9 = digits.slice(-9);
  const local11 = `0${digits.slice(-10)}`;
  const rawClean = raw.trim();

  const variantsSet = new Set<string>([
    rawClean,
    local11,
    digits,
    `+964${last9}`,
    `964${last9}`,
    `0${last9}`,
    last9,
  ]);

  const norm = normalizeIraqMobileLocal11(rawClean) || local11;

  return {
    normalized: norm,
    variants: Array.from(variantsSet),
    last9Digits: last9,
  };
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const phoneParam = searchParams.get("phone");
  if (!phoneParam) return NextResponse.json({ regions: [] });

  const phoneInfo = getPhoneVariants(phoneParam);
  if (!phoneInfo) return NextResponse.json({ regions: [] });

  const { variants, last9Digits } = phoneInfo;

  try {
    const regionCountMap = new Map<string, { id: string; name: string; deliveryPrice: string; count: number }>();

    // 1. جلب الطلبات السابقة لهذا الرقم من جدول Order وحساب تكرارات المناطق
    const orders = await prisma.order.findMany({
      where: {
        OR: [
          { customerPhone: { in: variants } },
          { customerPhone: { contains: last9Digits } },
          { secondCustomerPhone: { in: variants } },
          { secondCustomerPhone: { contains: last9Digits } },
        ],
      },
      select: {
        customerRegion: { select: { id: true, name: true, deliveryPrice: true } },
        secondCustomerRegion: { select: { id: true, name: true, deliveryPrice: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    for (const o of orders) {
      if (o.customerRegion) {
        const id = o.customerRegion.id;
        const current = regionCountMap.get(id) || {
          id,
          name: o.customerRegion.name,
          deliveryPrice: o.customerRegion.deliveryPrice ? o.customerRegion.deliveryPrice.toString() : "0",
          count: 0,
        };
        current.count += 1;
        regionCountMap.set(id, current);
      }
      if (o.secondCustomerRegion) {
        const id = o.secondCustomerRegion.id;
        const current = regionCountMap.get(id) || {
          id,
          name: o.secondCustomerRegion.name,
          deliveryPrice: o.secondCustomerRegion.deliveryPrice ? o.secondCustomerRegion.deliveryPrice.toString() : "0",
          count: 0,
        };
        current.count += 1;
        regionCountMap.set(id, current);
      }
    }

    // 2. جلب المناطق المحفوظة من CustomerPhoneProfile
    const profiles = await prisma.customerPhoneProfile.findMany({
      where: {
        OR: [
          { phone: { in: variants } },
          { phone: { contains: last9Digits } },
        ],
      },
      include: {
        region: { select: { id: true, name: true, deliveryPrice: true } },
      },
      take: 15,
    });

    for (const p of profiles) {
      if (p.region) {
        const id = p.region.id;
        if (!regionCountMap.has(id)) {
          regionCountMap.set(id, {
            id: p.region.id,
            name: p.region.name,
            deliveryPrice: p.region.deliveryPrice ? p.region.deliveryPrice.toString() : "0",
            count: 1,
          });
        }
      }
    }

    // 3. جلب المناطق من Customer
    const customers = await prisma.customer.findMany({
      where: {
        OR: [
          { phone: { in: variants } },
          { phone: { contains: last9Digits } },
        ],
      },
      include: {
        customerRegion: { select: { id: true, name: true, deliveryPrice: true } },
      },
      take: 15,
    });

    for (const c of customers) {
      if (c.customerRegion) {
        const id = c.customerRegion.id;
        if (!regionCountMap.has(id)) {
          regionCountMap.set(id, {
            id: c.customerRegion.id,
            name: c.customerRegion.name,
            deliveryPrice: c.customerRegion.deliveryPrice ? c.customerRegion.deliveryPrice.toString() : "0",
            count: 1,
          });
        }
      }
    }

    const regions = Array.from(regionCountMap.values()).sort((a, b) => b.count - a.count);

    return NextResponse.json({ regions });
  } catch (error) {
    console.error("Error in regions-by-phone:", error);
    return NextResponse.json({ regions: [] }, { status: 500 });
  }
}
