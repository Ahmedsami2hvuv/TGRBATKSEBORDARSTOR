import { prisma } from "@/lib/prisma";
import { haversineMeters } from "@/lib/geo-distance";
import { extractLatLngFromLocationInputSmart } from "@/lib/order-location";
import SmartHintsClient from "./smart-hints-client";

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

export default async function SmartHintsPage() {
  // 1. جلب جميع النقاط الدالة في النظام مع منطقتها وحقول النطاق والمضلع
  const allWaypoints = await prisma.regionWaypoint.findMany({
    orderBy: {
      name: "asc",
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

  // 2. جلب آخر 200 طلب غير مؤرشف
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
      status: true,
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

  // 3. معالجة وحساب الاستدلال لكل طلب في الذاكرة (سريع جداً)
  const processedOrders = await Promise.all(
    activeOrders.map(async (order) => {
      const locationUrl = order.customerLocationUrl;
      const fallback = order.customerLandmark?.trim();

      if (!locationUrl?.trim()) {
        return {
          ...order,
          hasLocation: false,
          statusText: "لا يوجد لوكيشن",
          nearestWaypoint: null,
          distanceM: null,
          hintText: fallback ? `قريب من (${fallback}) [حسب العلامة الدالة]` : "—",
        };
      }

      const customerLoc = await extractLatLngFromLocationInputSmart(locationUrl);
      if (!customerLoc) {
        return {
          ...order,
          hasLocation: false,
          statusText: "تعذر قراءة الإحداثيات",
          nearestWaypoint: null,
          distanceM: null,
          hintText: fallback ? `قريب من (${fallback}) [حسب العلامة الدالة]` : "—",
        };
      }

      let nearestWp: any = null;
      let minDistance = Infinity;
      let matchedByPolygon = false;

      // أ. فحص المربعات السكنية (المضلعات)
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

      // ب. إذا لم يطابق مضلع، نبحث عن أقرب دائرة أو نقطة دالة عامة
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

      if (!nearestWp) {
        return {
          ...order,
          hasLocation: true,
          statusText: "لا توجد نقاط دالة",
          nearestWaypoint: null,
          distanceM: null,
          hintText: "—",
        };
      }

      // حساب حالة الاستدلال بناءً على نوع المطابقة والمسافة المحددة
      const limit = nearestWp.radiusMeters;
      const isOutOfRange = !matchedByPolygon && minDistance > limit;

      if (isOutOfRange) {
        return {
          ...order,
          hasLocation: true,
          statusText: `خارج النطاق (${Math.round(minDistance)} متر)`,
          nearestWaypoint: {
            name: nearestWp.name || "مدخل",
            regionName: nearestWp.region?.name || "منطقة غير معروفة",
            distanceM: minDistance,
          },
          distanceM: minDistance,
          hintText: fallback ? `قريب من (${fallback}) [حسب العلامة الدالة]` : "—",
        };
      }

      return {
        ...order,
        hasLocation: true,
        statusText: "مستدل بنجاح",
        nearestWaypoint: {
          name: nearestWp.name || "مدخل",
          regionName: nearestWp.region?.name || "منطقة غير معروفة",
          distanceM: minDistance,
        },
        distanceM: minDistance,
        hintText: matchedByPolygon ? `قريب من (${nearestWp.name}) [مربع سكني]` : `قريب من (${nearestWp.name})`,
      };
    })
  );

  // 4. حساب الإحصائيات
  const totalOrders = processedOrders.length;
  const successfullyInferred = processedOrders.filter((o) => o.statusText === "مستدل بنجاح").length;
  const outOfRange = processedOrders.filter((o) => o.statusText?.startsWith("خارج النطاق")).length;
  const noLocation = processedOrders.filter((o) => !o.hasLocation).length;

  const stats = {
    totalOrders,
    successfullyInferred,
    outOfRange,
    noLocation,
  };

  return (
    <SmartHintsClient
      allWaypoints={allWaypoints}
      processedOrders={processedOrders as any}
      stats={stats}
    />
  );
}
