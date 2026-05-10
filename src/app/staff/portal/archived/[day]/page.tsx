import Link from "next/link";
import { notFound } from "next/navigation";
import { verifyStaffEmployeePortalQuery } from "@/lib/staff-employee-portal-link";
import { prisma } from "@/lib/prisma";
import { formatDinarAsAlfWithUnit } from "@/lib/money-alf";
import { baghdadDayRangeUtc, formatBaghdadDateLabel } from "@/lib/baghdad-archived-day";
import { StaffArchivedClient } from "./staff-archived-client";

export const dynamic = "force-dynamic";

export default async function StaffArchivedDayPage({ 
  params, 
  searchParams 
}: { 
  params: Promise<{ day: string }>;
  searchParams: Promise<any>;
}) {
  const { day: rawDay } = await params;
  const sp = await searchParams;
  const v = verifyStaffEmployeePortalQuery(sp.se, sp.exp, sp.s);
  
  if (!v.ok) return <div className="p-8 text-center font-bold">الرابط غير صالح.</div>;

  const day = decodeURIComponent(rawDay);
  const range = baghdadDayRangeUtc(day);
  if (!range) notFound();

  const authQ = new URLSearchParams({ se: sp.se ?? "", exp: sp.exp ?? "", s: sp.s ?? "" }).toString();

  // Nuclear Sanitization for Next.js 15 Serialization Safety
  function deepSanitize(obj: any): any {
    if (obj === null || obj === undefined) return obj;
    if (typeof obj === "bigint") return obj.toString();
    if (typeof obj === "string" || typeof obj === "number" || typeof obj === "boolean") return obj;
    if (obj instanceof Date) return obj.toISOString();
    if (Array.isArray(obj)) return obj.map(deepSanitize);
    if (typeof obj === "object") {
      // Handle Decimal.js / Prisma Decimal
      if (obj.d && obj.s && obj.e !== undefined) return Number(obj.toString());
      const newObj: any = {};
      for (const key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = deepSanitize(obj[key]);
      }
      return newObj;
    }
    return obj;
  }

  // جلب الأزرار الفعالة من قاعدة البيانات (الأزرار التي صنعتها أنت من الإدارة)
  const waButtons = await prisma.mandoubWaButtonSetting.findMany({
    where: { isActive: true }
  });

  // جلب طلبات هذا اليوم المؤرشفة
  const archivedOrders = await prisma.order.findMany({
    where: { 
      status: "archived",
      archivedAt: { gte: range.gte, lt: range.lt }
    },
    orderBy: { orderNumber: "desc" },
    include: {
      shop: true,
      customerRegion: true,
      courier: true,
      customer: {
        select: {
          customerLocationUrl: true,
          customerDoorPhotoUrl: true,
          name: true
        }
      }
    }
  });

  const rows = archivedOrders.map(o => {
    const dt = new Date(o.createdAt);
    const dateStr = dt.toLocaleDateString("ar-IQ");
    const timeStr = dt.toLocaleTimeString("ar-IQ", { hour: 'numeric', minute: '2-digit', hour12: true });

    return {
      id: o.id,
      shortId: String(o.orderNumber),
      orderStatus: o.status,
      assignedCourierName: o.courier?.name ?? "—",
      shopName: o.shop.name,
      shopNameHighlightClass: "bg-violet-100 text-violet-900 px-2 py-1 rounded-md text-sm font-bold",
      regionLine: o.customerRegion?.name ?? "—",
      orderType: o.orderType || "—",
      priceStr: o.totalAmount != null ? formatDinarAsAlfWithUnit(o.totalAmount) : "—",
      delStr: o.deliveryPrice != null ? formatDinarAsAlfWithUnit(o.deliveryPrice) : "—",
      customerPhone: o.customerPhone || "—",
      customerAlternatePhone: o.secondCustomerPhone?.trim() || o.alternatePhone?.trim() || null,
      customerName: o.customer?.name || "—",
      summary: o.summary || "لا توجد ملاحظات",
      orderNoteTime: o.orderNoteTime || "غير محدد",
      timeLine: `${dateStr} - ${timeStr}`,
      dateOnly: dateStr,
      timeOnly: timeStr,
      statusAr: "مؤرشف",
      statusClass: "bg-violet-600 text-white",
      hasCustomerLocation: !!(o.customerLocationUrl || o.customer?.customerLocationUrl),
      hasCourierUploadedLocation: Boolean(o.customerLocationSetByCourierAt),
      prepaidAll: o.prepaidAll,
      createdAt: o.createdAt,

      // Unified fast-access fields
      audioUrl: o.audioUrl,
      preparerAudioUrl: o.preparerAudioUrl,
      adminAudioUrl: o.adminAudioUrl,
      shopLocationUrl: o.shopLocationUrl,
      customerLocationUrl: o.customerLocationUrl || o.customer?.customerLocationUrl,
      secondCustomerLocationUrl: o.secondCustomerLocationUrl,
      shopDoorPhotoUrl: o.shopDoorPhotoUrl,
      customerDoorPhotoUrl: o.customer?.customerDoorPhotoUrl || o.customerDoorPhotoUrl,
      secondCustomerDoorPhotoUrl: o.secondCustomerDoorPhotoUrl,
      routeMode: o.routeMode as "single" | "double",
    };
  });

  return (
    <div className="kse-app-bg min-h-screen px-2 py-6 sm:px-4" dir="rtl">
      <div className="mx-auto max-w-6xl">
        <Link href={`/staff/portal/archived?${authQ}`} className="inline-block mb-4 text-sm font-black text-sky-700 underline">← رجوع لأيام الأرشيف</Link>
        
        <header className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight text-slate-800 sm:text-3xl">{formatBaghdadDateLabel(day)}</h1>
          <p className="text-sm font-bold text-slate-500 mt-2 leading-relaxed">
            اضغط على أي طلب لعرض تفاصيله بالكامل. تظهر في النافذة أزرار الواتساب المخصصة للموظفين.
          </p>
        </header>

        {/* تمرير الأزرار الديناميكية للمكون */}
        <StaffArchivedClient
          rows={deepSanitize(rows)}
          dynamicWaButtons={deepSanitize(waButtons)}
        />
      </div>
    </div>
  );
}
