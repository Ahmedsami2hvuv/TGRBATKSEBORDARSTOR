import { prisma } from "@/lib/prisma";
import { PreparationOrdersHubClient } from "./preparation-hub-client";
import { ad } from "@/lib/admin-ui";
import type { ReportTableRow } from "@/lib/report-types";

export const dynamic = "force-dynamic";

export default async function PreparationOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{
    tab?: string;
    from?: string;
    to?: string;
    preparerId?: string;
  }>;
}) {
  const { tab = "draft", from, to, preparerId } = await searchParams;

  // جلب المجهزين والمندوبين للخيارات
  const [preparers, couriers] = await Promise.all([
    prisma.companyPreparer.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, active: true, availableForAssignment: true },
    }),
    prisma.courier.findMany({
      where: { blocked: false },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  const preparersList = preparers.map((p) => ({
    id: p.id,
    name: p.name,
    available: p.active && p.availableForAssignment,
  }));

  // جلب الطلبات (بالتجهيز أو المكتملة) بناءً على الفلتر
  const dateFilter =
    from && to
      ? {
          createdAt: {
            gte: new Date(from),
            lte: new Date(to),
          },
        }
      : {};

  const orders = await prisma.order.findMany({
    where: {
      ...dateFilter,
      status: { in: ["assigned", "delivered"] },
      ...(preparerId ? { submittedByCompanyPreparerId: preparerId } : {}),
      archivedAt: null,
    },
    include: {
      shop: true,
      customerRegion: true,
      courier: true,
      submittedByCompanyPreparer: true,
    },
    orderBy: { createdAt: "desc" },
  });

  const rows: ReportTableRow[] = orders.map((o) => ({
    id: o.id,
    orderNumber: o.orderNumber,
    createdAt: o.createdAt.toISOString(),
    status: o.status,
    shopName: o.shop.name,
    regionName: o.customerRegion?.name ?? "غير محدد",
    totalAmount: o.totalAmount?.toNumber() ?? 0,
    deliveryPrice: o.deliveryPrice?.toNumber() ?? 0,
    courierName: o.courier?.name ?? "غير مسند",
    preparerName: o.submittedByCompanyPreparer?.name ?? "—",
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className={ad.h1}>سجل عمليات التجهيز</h1>
          <p className={ad.lead}>إدارة المسودات، متابعة المجهزين، وإحصائيات الطلبات الجاهزة.</p>
        </div>
      </div>

      <PreparationOrdersHubClient
        initialTab={tab}
        rows={rows}
        fromInput={from ?? ""}
        toInput={to ?? ""}
        preparers={preparersList}
        couriers={couriers}
        preparerId={preparerId ?? ""}
      />
    </div>
  );
}
