import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { haversineMeters } from "@/lib/geo-distance";
import { extractLatLngFromLocationInputSmart } from "@/lib/order-location";

export const dynamic = "force-dynamic";

export default async function SmartHintsPage() {
  // 1. جلب جميع النقاط الدالة في النظام
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
          hintText: "— (أقرب نقطة دالة أبعد من 300 متر)",
        };
      }

      return {
        ...order,
        hasLocation: true,
        statusText: "مستدل بنجاح",
        nearestWaypoint: nearest,
        distanceM: nearest.distanceM,
        hintText: `قريب من (${nearest.name}) - ${nearest.regionName}`,
      };
    })
  );

  // 4. حساب الإحصائيات
  const totalOrders = processedOrders.length;
  const successfullyInferred = processedOrders.filter((o) => o.statusText === "مستدل بنجاح").length;
  const outOfRange = processedOrders.filter((o) => o.statusText?.startsWith("خارج النطاق")).length;
  const noLocation = processedOrders.filter((o) => !o.hasLocation).length;

  return (
    <div dir="rtl" className="space-y-6 pb-12">
      {/* رأس الصفحة */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-800 dark:text-slate-100 flex items-center gap-2">
            💡 لوحة الاستدلال الذكي للطلبات
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            مراقبة وتحليل الاستدلال الذكي التلقائي للطلبات في محيط 300 متر مستقل عن المنطقة
          </p>
        </div>
      </div>

      {/* الكروت الإحصائية */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white/80 dark:bg-[#131418]/80 backdrop-blur-md border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm">
          <div className="text-sm font-bold text-slate-500">إجمالي الطلبات النشطة</div>
          <div className="text-2xl font-black text-slate-800 dark:text-slate-100 mt-1">
            {totalOrders}
          </div>
        </div>

        <div className="bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/40 rounded-2xl p-4 shadow-sm">
          <div className="text-sm font-bold text-emerald-700 dark:text-emerald-400">مستدل بنجاح (≤ 300م)</div>
          <div className="text-2xl font-black text-emerald-800 dark:text-emerald-300 mt-1">
            {successfullyInferred}
          </div>
        </div>

        <div className="bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 rounded-2xl p-4 shadow-sm">
          <div className="text-sm font-bold text-amber-700 dark:text-amber-400">خارج النطاق (&gt; 300م)</div>
          <div className="text-2xl font-black text-amber-800 dark:text-amber-300 mt-1">
            {outOfRange}
          </div>
        </div>

        <div className="bg-rose-50/50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/40 rounded-2xl p-4 shadow-sm">
          <div className="text-sm font-bold text-rose-700 dark:text-rose-400">بدون إحداثيات / لوكيشن</div>
          <div className="text-2xl font-black text-rose-800 dark:text-rose-300 mt-1">
            {noLocation}
          </div>
        </div>
      </div>

      {/* جدول التفاصيل */}
      <div className="bg-white dark:bg-[#09090b] rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-900/30">
          <span className="text-sm font-black text-slate-700 dark:text-slate-300">
            تفاصيل الاستدلال لآخر 200 طلب
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-start border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400 font-bold bg-slate-50/50 dark:bg-slate-900/10">
                <th className="p-3 text-start">رقم الطلب</th>
                <th className="p-3 text-start">المحل</th>
                <th className="p-3 text-start">المنطقة المحددة</th>
                <th className="p-3 text-start">اللوكيشن الأصلي</th>
                <th className="p-3 text-start">أقرب نقطة دالة في النظام</th>
                <th className="p-3 text-start">الاستدلال الذكي الناتج</th>
                <th className="p-3 text-start">الحالة الحسابية</th>
              </tr>
            </thead>
            <tbody>
              {processedOrders.map((o) => (
                <tr
                  key={o.id}
                  className="border-b border-slate-100 dark:border-slate-800/60 hover:bg-slate-50 dark:hover:bg-slate-900/20 transition-colors"
                >
                  <td className="p-3">
                    <Link
                      href={`/abo1stor3hlaa2kbr8-47/orders/${o.id}`}
                      className="text-sky-600 dark:text-[#00f3ff] hover:underline font-bold"
                    >
                      #{o.orderNumber}
                    </Link>
                  </td>
                  <td className="p-3 font-semibold">{o.shop?.name || "—"}</td>
                  <td className="p-3 text-slate-500">{o.customerRegion?.name || "—"}</td>
                  <td className="p-3">
                    {o.customerLocationUrl ? (
                      <a
                        href={o.customerLocationUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-sky-600 dark:text-sky-400 bg-sky-50 dark:bg-sky-950/40 px-2 py-1 rounded-lg border border-sky-200 dark:border-sky-900/40"
                      >
                        📍 فتح الرابط
                      </a>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  <td className="p-3">
                    {o.nearestWaypoint ? (
                      <div className="flex flex-col">
                        <span className="font-bold text-slate-700 dark:text-slate-300">
                          {o.nearestWaypoint.name}
                        </span>
                        <span className="text-xs text-slate-400">
                          بمنطقة: {o.nearestWaypoint.regionName} ({Math.round(o.nearestWaypoint.distanceM)}م)
                        </span>
                      </div>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  <td className="p-3 font-bold text-slate-800 dark:text-slate-200">{o.hintText}</td>
                  <td className="p-3">
                    <span
                      className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-bold ${
                        o.statusText === "مستدل بنجاح"
                          ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
                          : o.statusText?.startsWith("خارج النطاق")
                          ? "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300"
                          : "bg-slate-100 text-slate-600 dark:bg-slate-900 dark:text-slate-400"
                      }`}
                    >
                      {o.statusText}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
