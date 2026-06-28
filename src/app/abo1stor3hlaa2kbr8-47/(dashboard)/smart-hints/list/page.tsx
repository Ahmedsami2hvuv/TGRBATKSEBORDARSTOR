import { prisma } from "@/lib/prisma";
import { haversineMeters } from "@/lib/geo-distance";
import { extractLatLngFromLocationInputSmart } from "@/lib/order-location";
import SmartHintsListClient from "./smart-hints-list-client";

export const dynamic = "force-dynamic";

// خوارزمية Ray Casting للتحقق من وقوع الإحداثية داخل المربع السكني (المضلع)
function isPointInPolygon(
  point: { latitude: number; longitude: number },
  polygon: Array<{ latitude: number; longitude: number }>
): boolean {
  const x = point.latitude;
  const y = point.longitude;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].latitude, yi = polygon[i].longitude;
    const xj = polygon[j].latitude, yj = polygon[j].longitude;
    const intersect = ((yi > y) !== (yj > y))
        && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

export default async function SmartHintsListPage() {
  // 1. جلب جميع النقاط الدالة مرتبة بالأحدث في البداية
  const allWaypoints = await prisma.regionWaypoint.findMany({
    orderBy: {
      createdAt: "desc",
    },
    select: {
      id: true,
      name: true,
      latitude: true,
      longitude: true,
      radiusMeters: true,
      polygonCoords: true,
      region: {
        select: {
          name: true,
        },
      },
    },
  });

  // 2. جلب آخر 200 طلب نشط لحساب الزبائن المتواجدين داخل كل استدلال
  const activeOrders = await prisma.order.findMany({
    where: {
      archivedAt: null,
    },
    orderBy: {
      createdAt: "desc",
    },
    take: 200,
    select: {
      id: true,
      orderNumber: true,
      customerLocationUrl: true,
      customerLandmark: true,
      customerRegionId: true,
      customerRegion: {
        select: {
          name: true,
        },
      },
      shop: {
        select: {
          name: true,
        },
      },
      createdAt: true,
    },
  });

  // 3. معالجة وتحديد الاستدلال الأقرب جغرافياً لكل طلب
  const processedOrders = await Promise.all(
    activeOrders.map(async (order) => {
      const locationUrl = order.customerLocationUrl;
      if (!locationUrl?.trim()) return null;

      const customerLoc = await extractLatLngFromLocationInputSmart(locationUrl);
      if (!customerLoc) return null;

      let nearestWp: any = null;
      let minDistance = Infinity;
      let matchedByPolygon = false;

      // أ. التحقق أولاً من المربعات السكنية (المضلعات)
      for (const wp of allWaypoints) {
        const isPoly = wp.polygonCoords && Array.isArray(wp.polygonCoords) && wp.polygonCoords.length >= 3;
        if (isPoly) {
          const inside = isPointInPolygon(customerLoc, wp.polygonCoords as any);
          if (inside) {
            nearestWp = wp;
            minDistance = 0;
            matchedByPolygon = true;
            break;
          }
        }
      }

      // ب. إذا لم يقع داخل أي مضلع، نبحث عن أقرب دائرة أو نقطة دالة عامة
      if (!matchedByPolygon) {
        for (const wp of allWaypoints) {
          const isPoly = wp.polygonCoords && Array.isArray(wp.polygonCoords) && wp.polygonCoords.length >= 3;
          if (!isPoly) {
            const dist = haversineMeters(
              customerLoc.latitude,
              customerLoc.longitude,
              wp.latitude,
              wp.longitude
            );
            if (dist < minDistance) {
              minDistance = dist;
              nearestWp = wp;
            }
          }
        }
      }

      if (!nearestWp) return null;

      return {
        id: order.id,
        orderNumber: order.orderNumber,
        customerLocationUrl: order.customerLocationUrl,
        customerLandmark: order.customerLandmark,
        customerRegionName: order.customerRegion?.name || "—",
        shopName: order.shop?.name || "—",
        createdAt: order.createdAt,
        nearestWaypointId: nearestWp.id,
        distanceM: minDistance,
        matchedByPolygon,
      };
    })
  );

  // تصفية القيم الفارغة وتمرير البيانات المصفاة
  const cleanOrders = processedOrders.filter((o) => o !== null) as any[];

  return (
    <SmartHintsListClient
      allWaypoints={allWaypoints}
      processedOrders={cleanOrders}
    />
  );
}
