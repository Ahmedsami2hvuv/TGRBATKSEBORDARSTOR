import Link from "next/link";
import { notFound } from "next/navigation";
import type { Prisma } from "@prisma/client";
import { courierAssignableWhere } from "@/lib/courier-assignable";
import { prisma } from "@/lib/prisma";
import { ad } from "@/lib/admin-ui";
import { hasCustomerLocationUrl } from "@/lib/order-location";
import { formatDinarAsAlf } from "@/lib/money-alf";
import { baghdadDayRangeUtc, formatBaghdadDateLabel } from "@/lib/baghdad-archived-day";
import { type TrackingTableRow } from "../../tracking/order-tracking-table-body";
import { OrderTrackingBulkTable } from "../../tracking/order-tracking-bulk-table";
import {
  isWardMismatch,
  isSaderMismatch,
  sumDeliveryInFromOrderMoneyEvents,
  sumPickupOutFromOrderMoneyEvents,
} from "@/lib/mandoub-money";

export const dynamic = "force-dynamic";

function formatShopWithCustomer(
  shopName: string,
  customerName: string | null | undefined,
): string {
  const shop = shopName?.trim() || "—";
  const cust = customerName?.trim();
  if (!cust) return shop;
  return `${shop}(${cust})`;
}

type Props = {
  params: Promise<{ day: string }>;
  searchParams: Promise<{ q?: string }>;
};

export async function generateMetadata({ params }: Props) {
  const { day } = await params;
  const label = /^\d{4}-\d{2}-\d{2}$/.test(day) ? formatBaghdadDateLabel(day) : day;
  return {
    title: `مؤرشف — ${label} — أبو الأكبر للتوصيل`,
  };
}

export default async function ArchivedOrdersDayPage({ params, searchParams }: Props) {
  const { day: rawDay } = await params;
  const sp = await searchParams;
  const q = (sp.q ?? "").trim();
  const day = decodeURIComponent(rawDay);
  const range = baghdadDayRangeUtc(day);
  if (!range) notFound();

  const where: Prisma.OrderWhereInput = {
    status: "archived",
    archivedAt: { gte: range.gte, lt: range.lt },
  };

  if (q) {
    where.OR = [
      { customerPhone: { contains: q } },
      { orderType: { contains: q, mode: "insensitive" } },
      { shop: { name: { contains: q, mode: "insensitive" } } },
      { courier: { name: { contains: q, mode: "insensitive" } } },
    ];
    const asNum = parseInt(q, 10);
    if (!Number.isNaN(asNum) && String(asNum) === q) {
      where.OR.push({ orderNumber: asNum });
    }
  }

  const orders = await prisma.order.findMany({
    where,
    orderBy: { orderNumber: "desc" },
    include: {
      shop: { include: { region: true } },
      customerRegion: true,
      courier: true,
      customer: true,
      moneyEvents: {
        where: { deletedAt: null },
        select: { kind: true, amountDinar: true, deletedAt: true },
      },
    },
  });

  const couriers = await prisma.courier.findMany({
    where: courierAssignableWhere,
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  const tableRows: TrackingTableRow[] = orders.map((o) => ({
    id: o.id,
    orderNumber: o.orderNumber,
    orderStatus: o.status,
    assignedCourierId: o.assignedCourierId ?? null,
    shopCustomerLabel: formatShopWithCustomer(o.shop.name, o.customer?.name),
    regionName: o.customerRegion?.name ?? o.shop.region.name,
    orderType: o.orderType || "—",
    routeModeLabel: o.routeMode === "double" ? "وجهتين" : "",
    totalLabel: o.orderSubtotal != null ? formatDinarAsAlf(o.orderSubtotal) : "—",
    deliveryLabel: o.deliveryPrice != null ? formatDinarAsAlf(o.deliveryPrice) : "—",
    customerPhone: o.customerPhone || "—",
    courierName: o.courier?.name ?? "—",
    hasCourierUploadedLocation: Boolean(o.customerLocationSetByCourierAt),
    missingCustomerLocation: !hasCustomerLocationUrl(
      o.customerLocationUrl,
      o.customer?.customerLocationUrl,
    ),
    summary: o.summary,
    preparerShoppingJson: o.preparerShoppingJson,
    wardMismatchType: isWardMismatch(
      o.status,
      o.totalAmount,
      sumDeliveryInFromOrderMoneyEvents(o.moneyEvents),
    ).type,
    saderMismatchType: isSaderMismatch(
      o.status,
      o.orderSubtotal,
      sumPickupOutFromOrderMoneyEvents(o.moneyEvents),
    ).type,
  }));

  return (
    <div className="space-y-4" dir="rtl">
      <p className={ad.muted}>
        <Link href="/admin/orders/archived" className={ad.link}>
          ← أيام المؤرشفة
        </Link>
        <span className="text-slate-400"> | </span>
        <Link href="/admin" className={ad.link}>
          الرئيسية
        </Link>
      </p>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className={ad.h1}>{formatBaghdadDateLabel(day)}</h1>
          <p className={`mt-1 ${ad.muted}`}>
            طلبات أُرشِفت في هذا اليوم مرتبة تسلسلياً (يظهر المندوب الذي قام بالتوصيل).
          </p>
        </div>
        <form className="flex-1 max-w-sm">
          <input
            name="q"
            defaultValue={q}
            placeholder="بحث (محل، رقم طلب، مندوب)..."
            className={ad.input}
          />
        </form>
      </div>

      <div className="space-y-3">
        <OrderTrackingBulkTable rows={tableRows} couriers={couriers} />
        <p className={ad.orderListCountFooter}>
          عدد الطلبات: <span className="font-bold text-sky-900">{tableRows.length}</span>
        </p>
      </div>
    </div>
  );
}
