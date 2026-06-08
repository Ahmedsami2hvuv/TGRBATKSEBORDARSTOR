import { prisma } from "@/lib/prisma";
import { haversineMeters } from "@/lib/geo-distance";
import { extractLatLngFromLocationInputSmart } from "@/lib/order-location";

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
      secondCustomerLocationUrl: true,
      secondCustomerRegionId: true,
    },
  });

  if (!order) return "— الطلب غير موجود";

  const locationUrl = type === "primary" ? order.customerLocationUrl : order.secondCustomerLocationUrl;

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

  let nearest: { name: string; regionName: string; distanceM: number } | null = null;
  for (const point of allWaypoints) {
    const distanceM = haversineMeters(
      customerLoc.latitude,
      customerLoc.longitude,
      point.latitude,
      point.longitude
    );
    if (!nearest || distanceM < nearest.distanceM) {
      nearest = {
        name: point.name?.trim() || "مدخل",
        regionName: point.region?.name?.trim() || "منطقة غير معروفة",
        distanceM,
      };
    }
  }

  if (!nearest) return "—";
  if (nearest.distanceM > 300) return "—";

  if (nearest.regionName === "استدلالات عامة") {
    return `قريب من (${nearest.name})`;
  }

  return `قريب من (${nearest.name}) - ${nearest.regionName}`;
}
