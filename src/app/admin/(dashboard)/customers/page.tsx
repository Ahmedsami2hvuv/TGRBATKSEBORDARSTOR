import Link from "next/link";
import { formatDinarAsAlf } from "@/lib/money-alf";
import { prisma } from "@/lib/prisma";
import { ad } from "@/lib/admin-ui";
import type { CustomerPhoneRowUi } from "./customer-phone-rows";
import { CustomersPageClient } from "./customers-page-client";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "بيانات الزبائن — أبو الأكبر للتوصيل",
};

type Props = {
  searchParams: Promise<{ page?: string; q?: string }>;
};

export default async function AdminCustomersPage({ searchParams }: Props) {
  const sp = await searchParams;
  const page = Math.max(1, parseInt(sp.page ?? "1", 10));
  const query = (sp.q ?? "").trim();
  const pageSize = 50; // تقليل حجم الصفحة لتحسين السرعة
  const skip = (page - 1) * pageSize;

  // بناء شرط البحث
  const where = query ? {
    OR: [
      { phone: { contains: query } },
      { landmark: { contains: query, mode: 'insensitive' as const } },
      { notes: { contains: query, mode: 'insensitive' as const } },
      { region: { name: { contains: query, mode: 'insensitive' as const } } }
    ]
  } : {};

  // 1. جلب العدد الإجمالي للزبائن المفلترين
  const totalItems = await prisma.customerPhoneProfile.count({ where });
  const totalPages = Math.ceil(totalItems / pageSize);

  // 2. جلب قائمة الزبائن لهذه الصفحة فقط
  const profiles = await prisma.customerPhoneProfile.findMany({
    where,
    orderBy: { updatedAt: "desc" },
    include: { region: { select: { id: true, name: true } } },
    take: pageSize,
    skip: skip,
  });

  const phoneNumbers = Array.from(new Set(profiles.map(p => p.phone)));

  // 3. جلب إحصائيات الطلبات لهؤلاء الزبائن فقط
  const orderStats = await prisma.order.groupBy({
    by: ["customerPhone"],
    where: { customerPhone: { in: phoneNumbers } },
    _count: { id: true },
    _sum: { totalAmount: true },
  });

  const statsMap = new Map(orderStats.map(s => [
    s.customerPhone,
    { count: s._count.id, total: Number(s._sum.totalAmount || 0) }
  ]));

  const regions = await prisma.region.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  const regionOptions = regions.map((r) => ({ id: r.id, name: r.name }));

  // تحويل البيانات لشكل القائمة
  const customerRows: CustomerPhoneRowUi[] = profiles.map((p) => {
    const stats = statsMap.get(p.phone);
    return {
      phone: p.phone,
      totalOrders: stats?.count || 0,
      totalAmountLabel: formatDinarAsAlf(stats?.total || 0),
      ordersHref: `/admin/customers/orders?phone=${encodeURIComponent(p.phone)}`,
      regions: [{
        key: p.id,
        name: p.region.name,
        locationUrl: p.locationUrl,
        landmark: p.landmark,
        orderCount: stats?.count || 0,
        totalLabel: formatDinarAsAlf(stats?.total || 0),
        infoHref: `/admin/customers/info?phone=${encodeURIComponent(p.phone)}&regionId=${p.regionId}`
      }],
    };
  });

  const profileRowsForTable = profiles.map((p) => ({
    id: p.id,
    phone: p.phone,
    regionName: p.region.name,
    locationUrl: p.locationUrl,
    landmark: p.landmark,
    alternatePhone: p.alternatePhone,
    notes: p.notes,
    photoUrl: p.photoUrl,
  }));

  return (
    <div className="space-y-4">
      <p className={ad.muted}>
        <Link href="/admin" className={ad.link}>
          ← الرئيسية
        </Link>
      </p>
      <div>
        <h1 className={ad.h1}>بيانات الزبائن</h1>
        <p className={`mt-1 ${ad.lead}`}>
          يتم عرض الزبائن الذين لديهم مواقع مسجلة. (إجمالي {totalItems.toLocaleString()} سجل مطابق).
        </p>
      </div>

      <CustomersPageClient
        rows={customerRows}
        regionOptions={regionOptions}
        profiles={profileRowsForTable}
        currentPage={page}
        totalPages={totalPages}
        initialQuery={query}
      />
    </div>
  );
}
