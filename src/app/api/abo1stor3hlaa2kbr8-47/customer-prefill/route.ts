import { NextResponse } from "next/server";
import { normalizeIraqMobileLocal11 } from "@/lib/whatsapp";
import { prisma } from "@/lib/prisma";

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
  const phoneRaw = searchParams.get("phone")?.trim() ?? "";
  const regionId = searchParams.get("regionId")?.trim() ?? "";
  const shopId = searchParams.get("shopId")?.trim() ?? "";

  const phoneInfo = getPhoneVariants(phoneRaw);
  if (!phoneInfo) {
    return NextResponse.json({ profile: null, suggestedRegions: [] });
  }

  const { normalized: phone, variants, last9Digits } = phoneInfo;
  const suggestedRegionsMap = new Map<string, { id: string; name: string; deliveryPrice: string }>();

  // 1. البحث في جدول CustomerPhoneProfile
  const phoneProfiles = await prisma.customerPhoneProfile.findMany({
    where: {
      OR: [
        { phone: { in: variants } },
        { phone: { contains: last9Digits } },
      ],
    },
    select: {
      id: true,
      phone: true,
      regionId: true,
      locationUrl: true,
      landmark: true,
      photoUrl: true,
      alternatePhone: true,
      isBlocked: true,
      updatedAt: true,
      region: {
        select: {
          id: true,
          name: true,
          deliveryPrice: true,
        },
      },
    },
    orderBy: { updatedAt: "desc" },
    take: 15,
  });

  for (const pp of phoneProfiles) {
    if (pp.region && !suggestedRegionsMap.has(pp.region.id)) {
      suggestedRegionsMap.set(pp.region.id, {
        id: pp.region.id,
        name: pp.region.name,
        deliveryPrice: pp.region.deliveryPrice ? pp.region.deliveryPrice.toString() : "0",
      });
    }
  }

  // 2. البحث في جدول Customer
  const customers = await prisma.customer.findMany({
    where: {
      OR: [
        { phone: { in: variants } },
        { phone: { contains: last9Digits } },
      ],
    },
    select: {
      id: true,
      shopId: true,
      name: true,
      phone: true,
      customerRegionId: true,
      customerLocationUrl: true,
      customerLandmark: true,
      customerDoorPhotoUrl: true,
      alternatePhone: true,
      updatedAt: true,
      customerRegion: {
        select: {
          id: true,
          name: true,
          deliveryPrice: true,
        },
      },
    },
    orderBy: { updatedAt: "desc" },
    take: 15,
  });

  for (const c of customers) {
    if (c.customerRegion && !suggestedRegionsMap.has(c.customerRegion.id)) {
      suggestedRegionsMap.set(c.customerRegion.id, {
        id: c.customerRegion.id,
        name: c.customerRegion.name,
        deliveryPrice: c.customerRegion.deliveryPrice ? c.customerRegion.deliveryPrice.toString() : "0",
      });
    }
  }

  // 3. البحث في جدول Order (طرف أول أو طرف ثاني)
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
      customerRegion: {
        select: {
          id: true,
          name: true,
          deliveryPrice: true,
        },
      },
      secondCustomerRegion: {
        select: {
          id: true,
          name: true,
          deliveryPrice: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  for (const o of orders) {
    if (o.customerRegion && !suggestedRegionsMap.has(o.customerRegion.id)) {
      suggestedRegionsMap.set(o.customerRegion.id, {
        id: o.customerRegion.id,
        name: o.customerRegion.name,
        deliveryPrice: o.customerRegion.deliveryPrice ? o.customerRegion.deliveryPrice.toString() : "0",
      });
    }
    if (o.secondCustomerRegion && !suggestedRegionsMap.has(o.secondCustomerRegion.id)) {
      suggestedRegionsMap.set(o.secondCustomerRegion.id, {
        id: o.secondCustomerRegion.id,
        name: o.secondCustomerRegion.name,
        deliveryPrice: o.secondCustomerRegion.deliveryPrice ? o.secondCustomerRegion.deliveryPrice.toString() : "0",
      });
    }
  }

  const suggestedRegions = Array.from(suggestedRegionsMap.values());

  // 4. بناء الـ profile للبيانات المحفوظة
  let profile: any = null;
  const targetRegionId = regionId || (suggestedRegions[0]?.id ?? "");

  if (targetRegionId) {
    if (shopId) {
      profile = await prisma.customer.findFirst({
        where: {
          OR: [{ phone: { in: variants } }, { phone: { contains: last9Digits } }],
          customerRegionId: targetRegionId,
          shopId,
        },
        select: {
          id: true,
          shopId: true,
          name: true,
          phone: true,
          customerRegionId: true,
          customerLocationUrl: true,
          customerLandmark: true,
          customerDoorPhotoUrl: true,
          alternatePhone: true,
        },
      });
    }

    if (!profile) {
      const phoneProfile = await prisma.customerPhoneProfile.findFirst({
        where: {
          OR: [{ phone: { in: variants } }, { phone: { contains: last9Digits } }],
          regionId: targetRegionId,
        },
        select: {
          id: true,
          phone: true,
          regionId: true,
          locationUrl: true,
          landmark: true,
          photoUrl: true,
          alternatePhone: true,
          isBlocked: true,
        },
      });

      if (phoneProfile) {
        profile = {
          id: phoneProfile.id,
          source: "phoneProfile" as const,
          shopId: null,
          name: "",
          phone: phoneProfile.phone,
          customerRegionId: phoneProfile.regionId,
          customerLocationUrl: phoneProfile.locationUrl ?? "",
          customerLandmark: phoneProfile.landmark ?? "",
          customerDoorPhotoUrl: phoneProfile.photoUrl?.trim() ? phoneProfile.photoUrl : null,
          alternatePhone: phoneProfile.alternatePhone,
          isBlocked: phoneProfile.isBlocked,
        };
      }
    }
  }

  // 5. فحص الحظر العام وحظر المحل
  const [globalBlocked, shopBlocked] = await Promise.all([
    prisma.globalBlockedPhone.findFirst({
      where: {
        OR: [{ phone: { in: variants } }, { phone: { contains: last9Digits } }],
      },
    }),
    shopId
      ? prisma.shopBlockedPhone.findFirst({
          where: {
            shopId,
            OR: [{ phone: { in: variants } }, { phone: { contains: last9Digits } }],
          },
        })
      : null,
  ]);

  if (profile) {
    profile.isBlocked = !!globalBlocked || !!profile.isBlocked;
    profile.isShopBlocked = !!shopBlocked;
  } else if (globalBlocked || shopBlocked) {
    profile = {
      id: "",
      source: "phoneProfile" as const,
      shopId: shopId || null,
      name: "",
      phone: phone,
      customerRegionId: targetRegionId || null,
      customerLocationUrl: "",
      customerLandmark: "",
      customerDoorPhotoUrl: null,
      alternatePhone: null,
      isBlocked: !!globalBlocked,
      isShopBlocked: !!shopBlocked,
    };
  }

  return NextResponse.json({ profile, suggestedRegions });
}
