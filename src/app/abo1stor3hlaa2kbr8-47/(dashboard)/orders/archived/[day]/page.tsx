import Link from "next/link";
import { notFound } from "next/navigation";
import type { Prisma } from "@prisma/client";
import { courierAssignableWhere } from "@/lib/courier-assignable";
import { prisma } from "@/lib/prisma";
import { ad } from "@/lib/admin-ui";
import { hasCustomerLocationUrl } from "@/lib/order-location";
import { formatDinarAsAlf } from "@/lib/money-alf";
import { baghdadDayRangeUtc, formatBaghdadDateLabel } from "@/lib/baghdad-archived-day";
import { normalizeArabicSearchText } from "@/lib/region-name-normalize";
import { type TrackingTableRow } from "../../tracking/order-tracking-table-body";
import { OrderTrackingBulkTable } from "../../tracking/order-tracking-bulk-table";
import {
  isWardMismatch,
  isSaderMismatch,
  sumDeliveryInFromOrderMoneyEvents,
  sumPickupOutFromOrderMoneyEvents,
  sumCourierPickupOut,
  sumPreparerPickupOut,
  sumAdminPickupOut,
} from "@/lib/mandoub-money";
import { MONEY_KIND_DELIVERY } from "@/lib/mandoub-money-events";

const SECRET_ADMIN_PATH = "/abo1stor3hlaa2kbr8-47";

export const dynamic = "force-dynamic";

function formatShopWithCustomer(
  shopName: string,
  customerName: string | null | undefined,
  routeMode?: string | null,
): string {
  if (routeMode === "double") return "وجهتين";
  return shopName?.trim() || "—";
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
    createdAt: { gte: range.gte, lt: range.lt },
  };

  const allOrdersOfDay = await prisma.order.findMany({
    where,
    orderBy: { orderNumber: "desc" },
    include: {
      shop: { include: { region: true } },
      customerRegion: true,
      secondCustomerRegion: true,
      courier: true,
      customer: true,
      moneyEvents: {
        where: { deletedAt: null },
        select: { kind: true, amountDinar: true, deletedAt: true, courierId: true, recordedByCompanyPreparerId: true },
      },
    },
  });

  let orders = allOrdersOfDay;
  if (q) {
    const qNorm = normalizeArabicSearchText(q);
    const qAsNum = parseInt(q, 10);
    const isNumSearch = !Number.isNaN(qAsNum) && String(qAsNum) === q;

    orders = allOrdersOfDay.filter((o) => {
      if (isNumSearch && o.orderNumber === qAsNum) return true;

      const searchableParts = [
        o.customerRegion?.name || "",
        o.secondCustomerRegion?.name || "",
        o.shop?.region?.name || "",
        o.shop?.name || "",
        o.courier?.name || "",
        o.customer?.name || "",
        o.customerPhone || "",
        o.alternatePhone || "",
        o.secondCustomerPhone || "",
        o.customerLandmark || "",
        o.secondCustomerLandmark || "",
        o.summary || "",
        o.orderType || "",
        o.orderNoteTime || "",
        String(o.orderNumber),
      ];

      const combinedText = searchableParts.join(" ");
      return normalizeArabicSearchText(combinedText).includes(qNorm);
    });
  }

  const couriers = await prisma.courier.findMany({
    where: courierAssignableWhere,
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  const tableRows: TrackingTableRow[] = orders.map((o) => {
    const courierPickup = sumCourierPickupOut(o.moneyEvents);
    const preparerPickup = sumPreparerPickupOut(o.moneyEvents);
    const adminPickup = sumAdminPickupOut(o.moneyEvents);
    
    const courierDeliveryEvents = o.moneyEvents.filter(
      (e) => e.kind === MONEY_KIND_DELIVERY && e.deletedAt == null && e.recordedByCompanyPreparerId == null
    );
    const courierDelivery = courierDeliveryEvents.reduce((acc, e) => acc + Number(e.amountDinar), 0);

    const preparerDeliveryEvents = o.moneyEvents.filter(
      (e) => e.kind === MONEY_KIND_DELIVERY && e.deletedAt == null && e.recordedByCompanyPreparerId != null
    );
    const preparerDelivery = preparerDeliveryEvents.reduce((acc, e) => acc + Number(e.amountDinar), 0);
    
    return {
      id: o.id,
      orderNumber: o.orderNumber,
      orderStatus: o.status,
      assignedCourierId: o.assignedCourierId ?? null,
      shopCustomerLabel: formatShopWithCustomer(o.shop.name, o.customer?.name, o.routeMode),
      regionName: o.customerRegion?.name ?? o.shop.region.name,
      orderType: o.orderType || "—",
      routeModeLabel: o.routeMode === "double" ? "وجهتين" : "",
      totalLabel: o.orderSubtotal != null ? formatDinarAsAlf(o.orderSubtotal) : "—",
      deliveryLabel: o.deliveryPrice != null ? formatDinarAsAlf(o.deliveryPrice) : "—",
      customerPhone: o.customerPhone || "—",
      courierName: o.courier?.name ?? "—",
      orderNoteTime: o.orderNoteTime,
      hasCourierUploadedLocation: Boolean(o.customerLocationSetByCourierAt),
      missingCustomerLocation: !hasCustomerLocationUrl(
        o.customerLocationUrl,
        o.customer?.customerLocationUrl,
      ),
      summary: o.summary,
      preparerShoppingJson: o.preparerShoppingJson,
      pickupSumDinar: courierPickup > 0 ? courierPickup : null,
      preparerPickupSumDinar: preparerPickup > 0 ? preparerPickup : null,
      adminPickupSumDinar: adminPickup > 0 ? adminPickup : null,
      deliverySumDinar: courierDelivery > 0 ? courierDelivery : null,
      preparerDeliverySumDinar: preparerDelivery > 0 ? preparerDelivery : null,
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
      createdAt: o.createdAt,
    };
  });

  return (
    <div className="space-y-4" dir="rtl">
      <p className={ad.muted}>
        <Link href={`${SECRET_ADMIN_PATH}/orders/archived`} className={ad.link}>
          ← أيام المؤرشفة
        </Link>
        <span className="text-slate-400"> | </span>
        <Link href={SECRET_ADMIN_PATH} className={ad.link}>
          الرئيسية
        </Link>
      </p>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className={ad.h1}>{formatBaghdadDateLabel(day)}</h1>
          <p className={`mt-1 ${ad.muted}`}>
            طلبات رُفِعت في هذا اليوم وأُرشِفت مرتبة تسلسلياً (يظهر المندوب الذي قام بالتوصيل).
          </p>
        </div>
        <form className="flex-1 max-w-sm">
          <input
            name="q"
            defaultValue={q}
            placeholder="بحث (منطقة، محل، رقم طلب، مندوب)..."
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
