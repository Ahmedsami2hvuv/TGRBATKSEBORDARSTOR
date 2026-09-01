import { NextResponse } from "next/server";
import { normalizeIraqMobileLocal11 } from "@/lib/whatsapp";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const phoneRaw = searchParams.get("phone")?.trim() ?? "";
  const regionId = searchParams.get("regionId")?.trim() ?? "";
  const shopId = searchParams.get("shopId")?.trim() ?? "";

  const phone = normalizeIraqMobileLocal11(phoneRaw);
  if (!phone) {
    return NextResponse.json({ profile: null, suggestedRegions: [] });
  }

  // 1. البحث عن كافة المناطق المربوطة بهذا الهاتف سابقاً
  const suggestedRegionsMap = new Map<string, { id: string; name: string; deliveryPrice: string }>();

  // أ) من جدول CustomerPhoneProfile
  const phoneProfiles = await prisma.customerPhoneProfile.findMany({
    where: { phone },
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
    take: 10,
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

  // ب) من جدول Customer
  const customers = await prisma.customer.findMany({
    where: { phone },
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
    take: 10,
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

  // جـ) من جدول Order
  const orders = await prisma.order.findMany({
    where: {
      OR: [
        { customer: { phone } },
        { secondCustomerPhone: phone },
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
    take: 10,
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

  // 2. البحث عن الـ Profile المفضل حسب (shopId و regionId) إذا تم تمريره، أو أحدث profile متاح
  let profile: any = null;

  const targetRegionId = regionId || (suggestedRegions[0]?.id ?? "");

  if (targetRegionId) {
    if (shopId) {
      profile = await prisma.customer.findFirst({
        where: {
          phone,
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
      const phoneProfile = await prisma.customerPhoneProfile.findUnique({
        where: { phone_regionId: { phone, regionId: targetRegionId } },
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

  // إذا لم نجد profile محدد ولكن توجد بيانات في Customer بشكل عام لهذا الهاتف
  if (!profile && customers.length > 0) {
    const c = customers[0];
    profile = {
      id: c.id,
      source: "customer" as const,
      shopId: c.shopId,
      name: c.name ?? "",
      phone: c.phone,
      customerRegionId: c.customerRegionId,
      customerLocationUrl: c.customerLocationUrl ?? "",
      customerLandmark: c.customerLandmark ?? "",
      customerDoorPhotoUrl: c.customerDoorPhotoUrl?.trim() ? c.customerDoorPhotoUrl : null,
      alternatePhone: c.alternatePhone,
      isBlocked: false,
    };
  }

  return NextResponse.json({ profile, suggestedRegions });
}
