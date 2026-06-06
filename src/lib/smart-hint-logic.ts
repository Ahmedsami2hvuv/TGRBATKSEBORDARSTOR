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
  const regionId = type === "primary" ? order.customerRegionId : order.secondCustomerRegionId;

  if (!regionId) return "— لا توجد منطقة مرتبطة";
  if (!locationUrl?.trim()) return "— لا يوجد لوكيشن";

  const regionWaypoints = await prisma.regionWaypoint.findMany({
    where: { regionId },
    orderBy: { sortOrder: "asc" },
    select: { name: true, latitude: true, longitude: true },
  });

  if (regionWaypoints.length === 0) return "— لا توجد مداخل محفوظة";

  const customerLoc = await extractLatLngFromLocationInputSmart(locationUrl);
  if (!customerLoc) return "— تعذر قراءة الإحداثيات";

  let nearest: { name: string; distanceM: number } | null = null;
  for (const point of regionWaypoints) {
    const distanceM = haversineMeters(
      customerLoc.latitude,
      customerLoc.longitude,
      point.latitude,
      point.longitude
    );
    if (!nearest || distanceM < nearest.distanceM) {
      nearest = { name: point.name?.trim() || "مدخل", distanceM };
    }
  }

  if (!nearest) return "— تعذر احتساب المسافة";
  if (nearest.distanceM > 2500) return "— اللوكيشن بعيد عن مداخل المنطقة";

  return `قريب من (${nearest.name})`;
}
