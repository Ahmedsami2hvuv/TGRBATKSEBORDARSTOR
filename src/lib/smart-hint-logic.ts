import { prisma } from "@/lib/prisma";
import { haversineMeters } from "@/lib/geo-distance";
import { extractLatLngFromLocationInputSmart } from "@/lib/order-location";
import { normalizeIraqMobileLocal11 } from "@/lib/whatsapp";

/**
 * يحسب "الاستدلال الذكي" لطلب معين بناءً على إحداثيات اللوكيشن وأقرب نقطة دالة في المنطقة.
 */
export async function computeSmartHint(
  orderId: string,
  type: "primary" | "secondary" = "primary"
): Promise<string> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      customerLocationUrl: true,
      customerRegionId: true,
      customerPhone: true,
      secondCustomerLocationUrl: true,
      secondCustomerRegionId: true,
      secondCustomerPhone: true,
    },
  });

  if (!order) return "— الطلب غير موجود";

  let locationUrl = type === "primary" ? order.customerLocationUrl : order.secondCustomerLocationUrl;

  // إذا كان اللوكيشن فارغاً في الطلب (حالة طلب جديد مثلاً)، نبحث عنه في بروفايل هاتف الزبون المرجعي
  if (!locationUrl?.trim()) {
    const phone = type === "primary" ? order.customerPhone : order.secondCustomerPhone;
    const regionId = type === "primary" ? order.customerRegionId : order.secondCustomerRegionId;
    const normPhone = phone ? normalizeIraqMobileLocal11(phone) : null;

    if (normPhone && regionId) {
      const profile = await prisma.customerPhoneProfile.findUnique({
        where: {
          phone_regionId: {
            phone: normPhone,
            regionId,
          },
        },
        select: { locationUrl: true },
      });
      locationUrl = profile?.locationUrl || "";
    }
  }

  if (!locationUrl?.trim()) return "—";

  const allWaypoints = await prisma.regionWaypoint.findMany({
    select: {
      name: true,
      latitude: true,
      longitude: true,
      region: {
        select: {
          name: true,
        },
      },
    },
  });

  if (allWaypoints.length === 0) return "—";

  const customerLoc = await extractLatLngFromLocationInputSmart(locationUrl);
  if (!customerLoc) return "—";

  const validWaypoints = allWaypoints
    .map((wp) => {
      const distanceM = haversineMeters(
        customerLoc.latitude,
        customerLoc.longitude,
        wp.latitude,
        wp.longitude
      );
      return {
        name: wp.name?.trim() || "مدخل",
        regionName: wp.region?.name?.trim() || "منطقة غير معروفة",
        distanceM,
      };
    })
    .filter((wp) => wp.distanceM <= 300)
    .sort((a, b) => a.distanceM - b.distanceM);

  if (validWaypoints.length === 0) return "—";

  const nearest = validWaypoints[0];
  return `قريب من (${nearest.name})`;
}
