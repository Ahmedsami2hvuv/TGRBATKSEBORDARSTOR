import { prisma } from "@/lib/prisma";
import { haversineMeters } from "@/lib/geo-distance";
import { extractLatLngFromLocationInputSmart } from "@/lib/order-location";
import { normalizeIraqMobileLocal11 } from "@/lib/whatsapp";

/**
 * خوارزمية Ray-casting للتحقق مما إذا كانت نقطة جغرافية تقع داخل مضلع جغرافي مغلق
 */
function isPointInPolygon(
  point: { latitude: number; longitude: number },
  polygon: Array<{ latitude: number; longitude: number }>
): boolean {
  const x = point.latitude;
  const y = point.longitude;
  let inside = false;

  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].latitude;
    const yi = polygon[i].longitude;
    const xj = polygon[j].latitude;
    const yj = polygon[j].longitude;

    const intersect = ((yi > y) !== (yj > y))
        && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }

  return inside;
}

/**
 * يحسب "الاستدلال الذكي" لطلب معين بناءً على إحداثيات اللوكيشن والمربعات السكنية أو أقرب نقطة دالة.
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

  // إذا كان اللوكيشن فارغاً في الطلب، نبحث عنه في بروفايل هاتف الزبون المرجعي
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
      radiusMeters: true,
      polygonCoords: true,
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
      // التحقق من بنية البيانات الجديدة للأشكال المتعددة
      if (wp.polygonCoords && typeof wp.polygonCoords === "object" && !Array.isArray(wp.polygonCoords)) {
        const data = wp.polygonCoords as any;
        if (data.version === 2 && Array.isArray(data.shapes)) {
          let bestMatch: { distanceM: number; radiusMeters: number; matched: boolean; isPolygon: boolean } | null = null;
          
          for (const shape of data.shapes) {
            if (shape.type === "polygon" && Array.isArray(shape.coords) && shape.coords.length >= 3) {
              const poly = shape.coords as Array<{ latitude: number; longitude: number }>;
              if (isPointInPolygon(customerLoc, poly)) {
                // إذا وقع داخل أي مضلع، نعتبر المسافة صفرم فوراً كأولوية قصوى
                bestMatch = { distanceM: 0, radiusMeters: 10, matched: true, isPolygon: true };
                break; // نكتفي بوجود تطابق للمضلع
              }
            } else if (shape.type === "circle") {
              const dist = haversineMeters(
                customerLoc.latitude,
                customerLoc.longitude,
                Number(shape.latitude),
                Number(shape.longitude)
              );
              const radius = Number(shape.radiusMeters);
              if (dist <= radius) {
                // نأخذ التطابق الأقرب مسافة
                if (!bestMatch || dist < bestMatch.distanceM) {
                  bestMatch = { distanceM: dist, radiusMeters: radius, matched: true, isPolygon: false };
                }
              }
            }
          }
          
          if (bestMatch && bestMatch.matched) {
            return {
              name: wp.name?.trim() || "مدخل",
              regionName: wp.region?.name?.trim() || "منطقة غير معروفة",
              distanceM: bestMatch.distanceM,
              radiusMeters: bestMatch.radiusMeters,
              isInPolygon: bestMatch.isPolygon,
              matched: true,
            };
          }
        }
      }

      // التحقق القديم للمضلع السكني الفردي
      if (wp.polygonCoords && Array.isArray(wp.polygonCoords) && wp.polygonCoords.length >= 3) {
        const poly = wp.polygonCoords as Array<{ latitude: number; longitude: number }>;
        const isInside = isPointInPolygon(customerLoc, poly);
        
        if (isInside) {
          return {
            name: wp.name?.trim() || "مدخل",
            regionName: wp.region?.name?.trim() || "منطقة غير معروفة",
            distanceM: 0,
            radiusMeters: 10,
            isInPolygon: true,
            matched: true,
          };
        }
      }

      // الحساب القديم للدائرة الفردية
      const distanceM = haversineMeters(
        customerLoc.latitude,
        customerLoc.longitude,
        wp.latitude,
        wp.longitude
      );
      
      const isInsideCircle = distanceM <= wp.radiusMeters;
      
      return {
        name: wp.name?.trim() || "مدخل",
        regionName: wp.region?.name?.trim() || "منطقة غير معروفة",
        distanceM,
        radiusMeters: wp.radiusMeters,
        isInPolygon: false,
        matched: isInsideCircle,
      };
    })
    // التصفية: إما أنه يقع داخل المضلع، أو يقع ضمن نصف القطر للمنطقة الدائرية
    .filter((wp) => wp.matched)
    // الفرز: إعطاء الأولوية للنقاط داخل المضلع (مسافة 0)، ثم للمسافات الدائرية الأقرب
    .sort((a, b) => a.distanceM - b.distanceM);

  if (validWaypoints.length === 0) return "—";

  const nearest = validWaypoints[0];
  return `في (${nearest.name})`;
}
