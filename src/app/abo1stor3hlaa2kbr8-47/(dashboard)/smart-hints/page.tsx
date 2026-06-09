import { prisma } from "@/lib/prisma";
import { haversineMeters } from "@/lib/geo-distance";
import { extractLatLngFromLocationInputSmart } from "@/lib/order-location";
import SmartHintsClient from "./smart-hints-client";

export const dynamic = "force-dynamic";

export default async function SmartHintsPage() {
  // 1. جلب جميع النقاط الدالة في النظام مع منطقتها
  const allWaypoints = await prisma.regionWaypoint.findMany({
    orderBy: {
      name: "asc",
    },
    select: {
      id: true,
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

      let nearest: { name: string; regionName: string; distanceM: number } | null = null;
      for (const wp of allWaypoints) {
        const dist = haversineMeters(
          customerLoc.latitude,
          customerLoc.longitude,
          wp.latitude,
          wp.longitude
        );
        if (!nearest || dist < nearest.distanceM) {
          nearest = {
            name: wp.name || "مدخل",
            regionName: wp.region?.name || "منطقة غير معروفة",
            distanceM: dist,
          };
        }
      }

      if (!nearest) {
        return {
          ...order,
          hasLocation: true,
          statusText: "لا توجد نقاط دالة",
          nearestWaypoint: null,
          distanceM: null,
          hintText: "—",
        };
      }

      if (nearest.distanceM > 300) {
        return {
          ...order,
          hasLocation: true,
          statusText: `خارج النطاق (${Math.round(nearest.distanceM)} متر)`,
          nearestWaypoint: nearest,
          distanceM: nearest.distanceM,
          hintText: fallback ? `قريب من (${fallback}) [حسب العلامة الدالة]` : "—",
        };
      }

      return {
        ...order,
        hasLocation: true,
        statusText: "مستدل بنجاح",
        nearestWaypoint: nearest,
        distanceM: nearest.distanceM,
        hintText: `قريب من (${nearest.name})`,
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
      processedOrders={processedOrders}
      stats={stats}
    />
  );
}
