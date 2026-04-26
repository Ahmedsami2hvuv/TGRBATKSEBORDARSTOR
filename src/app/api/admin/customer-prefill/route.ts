import { NextResponse } from "next/server";
import { normalizeIraqMobileLocal11 } from "@/lib/whatsapp";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const phoneRaw = searchParams.get("phone")?.trim() ?? "";
  const regionId = searchParams.get("regionId")?.trim() ?? "";
  const shopId = searchParams.get("shopId")?.trim() ?? "";

  const phone = normalizeIraqMobileLocal11(phoneRaw);
  if (!phone || !regionId) {
    return NextResponse.json({ profile: null });
  }

  let profile = null;

  if (shopId) {
    profile = await prisma.customer.findFirst({
      where: {
        phone,
        customerRegionId: regionId,
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
      },
    });
  }

  if (!profile) {
    const phoneProfile = await prisma.customerPhoneProfile.findUnique({
      where: { phone_regionId: { phone, regionId } },
      select: {
        id: true,
        phone: true,
        regionId: true,
        locationUrl: true,
        landmark: true,
        photoUrl: true,
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
      };
    }
  }

  if (!profile) {
    return NextResponse.json({ profile: null });
  }

  return NextResponse.json({ profile });
}
