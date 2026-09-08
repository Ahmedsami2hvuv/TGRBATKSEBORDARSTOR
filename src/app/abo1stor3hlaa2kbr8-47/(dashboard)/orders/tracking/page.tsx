import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { courierAssignableWhere } from "@/lib/courier-assignable";
import { prisma } from "@/lib/prisma";
import { ad } from "@/lib/admin-ui";
import {
  isWardMismatch,
  isSaderMismatch,
  sumDeliveryInFromOrderMoneyEvents,
  sumPickupOutFromOrderMoneyEvents,
  sumCourierPickupOut,
  sumPreparerPickupOut,
  sumAdminPickupOut,
} from "@/lib/mandoub-money";
import { hasCustomerLocationUrl } from "@/lib/order-location";
import { normalizeIraqMobileLocal11 } from "@/lib/whatsapp";
import { routeModeOrFromQuery } from "@/lib/admin-super-search";
import { parseBaghdadDateRange } from "@/lib/order-date-search";
import { formatDinarAsAlf, formatDinarAsAlfWithUnit } from "@/lib/money-alf";
import { normalizeAdminShopName, ADMIN_SHOP_NAMES } from "@/lib/admin-order-from-admin-constants";
import { resolvePublicAssetSrc } from "@/lib/image-url";
import { serializePrisma } from "@/lib/serialize-prisma";
import { OrderTrackingSearch } from "./order-tracking-search";
import { type TrackingTableRow } from "./order-tracking-table-body";
import { OrderTrackingBulkTable } from "./order-tracking-bulk-table";
import { Decimal } from "@prisma/client/runtime/library";
import { MONEY_KIND_DELIVERY } from "@/lib/mandoub-money-events";


const SECRET_ADMIN_PATH = "/abo1stor3hlaa2kbr8-47";

// Smart cache window: minor field edits won't thrash tracking.
// Urgent status transitions are pushed via targeted revalidatePath calls.
export const revalidate = 60;

export const metadata = {
  title: "تتبع الطلبات — أبو الأكبر للتوصيل",
};

function formatShopWithCustomer(
  shopName: string,
  customerName: string | null | undefined,
  routeMode?: string | null,
  isPreparerOrder?: boolean,
): string {
  if (routeMode === "double") return "وجهتين";
  if (isPreparerOrder) return "الإدارة";
  return normalizeAdminShopName(shopName) || "—";
}

const STATUS_STANDARD = [
  "all",
  "pending",
  "assigned",
  "delivering",
  "delivered",
  "cancelled",
  "checkSader",
  "checkWard",
] as const;

type Props = {
  searchParams: Promise<{ status?: string; q?: string; wardFilter?: string; saderFilter?: string }>;
};

export default async function OrderTrackingPage({ searchParams }: Props) {
  try {
    const sp = await searchParams;
    const rawStatus = ((sp.status ?? "all") as string).trim();
    if (rawStatus === "archived") {
      redirect(`${SECRET_ADMIN_PATH}/orders/archived`);
    }
    let statusFilter = rawStatus;
    if (!STATUS_STANDARD.includes(statusFilter as (typeof STATUS_STANDARD)[number])) {
      statusFilter = "all";
    }
    const q = (sp.q ?? "").trim();
    const wardFilter: "lower" | "higher" =
      sp.wardFilter === "higher" ? "higher" : "lower";
    const saderFilter: "lower" | "higher" =
      sp.saderFilter === "lower" ? "lower" : "higher";

    const where: Prisma.OrderWhereInput = {
      orderType: { not: "دين" },
    };

    if (statusFilter === "checkSader" || statusFilter === "checkWard") {
      where.status = "delivered";
    } else if (
      ["pending", "assigned", "delivering", "delivered", "cancelled"].includes(statusFilter)
    ) {
      where.status = statusFilter;
    } else if (statusFilter === "all") {
      where.status = { notIn: ["cancelled", "archived"] };
    }

    if (q) {
      const asNum = parseInt(q, 10);
      const numExact = !Number.isNaN(asNum) && String(asNum) === q;
      const dateRange = parseBaghdadDateRange(q);
      const or: Prisma.OrderWhereInput[] = [
        ...routeModeOrFromQuery(q),
        { customerPhone: { contains: q } },
        { orderType: { contains: q, mode: "insensitive" } },
        { shop: { name: { contains: q, mode: "insensitive" } } },
        { courier: { name: { contains: q, mode: "insensitive" } } },
        { customerRegion: { name: { contains: q, mode: "insensitive" } } },
        { secondCustomerRegion: { name: { contains: q, mode: "insensitive" } } },
        { shop: { region: { name: { contains: q, mode: "insensitive" } } } },
        { customer: { name: { contains: q, mode: "insensitive" } } },
        { orderNoteTime: { contains: q, mode: "insensitive" } },
        { customerLandmark: { contains: q, mode: "insensitive" } },
        { secondCustomerLandmark: { contains: q, mode: "insensitive" } },
        { summary: { contains: q, mode: "insensitive" } },
      ];
      if (numExact) {
        or.unshift({ orderNumber: asNum });
      }
      if (dateRange) {
        or.push({ createdAt: { gte: dateRange.gte, lt: dateRange.lt } });
      }
      where.OR = or;
    }

    const pendingTabWhere: Prisma.OrderWhereInput = {
      status: "pending",
      orderType: { not: "دين" },
    };
    if (q) {
      const asNum = parseInt(q, 10);
      const numExact = !Number.isNaN(asNum) && String(asNum) === q;
      const dateRange = parseBaghdadDateRange(q);
      const or: Prisma.OrderWhereInput[] = [
        ...routeModeOrFromQuery(q),
        { customerPhone: { contains: q } },
        { orderType: { contains: q, mode: "insensitive" } },
        { shop: { name: { contains: q, mode: "insensitive" } } },
        { courier: { name: { contains: q, mode: "insensitive" } } },
        { customerRegion: { name: { contains: q, mode: "insensitive" } } },
        { secondCustomerRegion: { name: { contains: q, mode: "insensitive" } } },
        { shop: { region: { name: { contains: q, mode: "insensitive" } } } },
        { customer: { name: { contains: q, mode: "insensitive" } } },
        { orderNoteTime: { contains: q, mode: "insensitive" } },
        { customerLandmark: { contains: q, mode: "insensitive" } },
        { secondCustomerLandmark: { contains: q, mode: "insensitive" } },
        { summary: { contains: q, mode: "insensitive" } },
      ];
      if (numExact) {
        or.unshift({ orderNumber: asNum });
      }
      if (dateRange) {
        or.push({ createdAt: { gte: dateRange.gte, lt: dateRange.lt } });
      }
      pendingTabWhere.OR = or;
    }

    // تقليل عدد الطلبات المسترجعة في الصفحة الواحدة لتخفيف العبء على الاتصال
    let [orders, couriers, pendingTabCount] = await Promise.all([
      prisma.order.findMany({
        where,
        orderBy: { createdAt: "desc" },
        include: {
          shop: {
            select: { id: true, name: true, photoUrl: true, region: true, phone: true, locationUrl: true }
          },
          customerRegion: true,
          secondCustomerRegion: true,
          courier: true,
          customer: true,
          moneyEvents: {
            where: { deletedAt: null },
            select: { kind: true, amountDinar: true, courierId: true, recordedByCompanyPreparerId: true },
          },
        },
      }),
      prisma.courier.findMany({
        where: courierAssignableWhere,
        orderBy: { name: "asc" },
        select: { id: true, name: true },
      }),
      prisma.order.count({ where: pendingTabWhere }),
    ]);

    const customerPhoneProfileKeys = new Map<string, { phone: string; regionId: string }>();
    for (const order of orders) {
      const normalizedPhone = normalizeIraqMobileLocal11(order.customerPhone);
      if (!normalizedPhone || !order.customerRegionId) continue;
      customerPhoneProfileKeys.set(`${normalizedPhone}_${order.customerRegionId}`, {
        phone: normalizedPhone,
        regionId: order.customerRegionId,
      });
    }

    const customerPhoneProfiles =
      customerPhoneProfileKeys.size > 0
        ? await prisma.customerPhoneProfile.findMany({
            where: {
              OR: Array.from(customerPhoneProfileKeys.values()).map((profile) => ({
                phone: profile.phone,
                regionId: profile.regionId,
              })),
            },
            select: {
              phone: true,
              regionId: true,
              locationUrl: true,
              photoUrl: true,
            },
          })
        : [];

    const customerPhoneProfileByKey = new Map(
      customerPhoneProfiles.map((profile) => [
        `${profile.phone}_${profile.regionId}`,
        profile,
      ]),
    );

    if (statusFilter === "checkSader") {
      orders = orders.filter((o) => {
        const type = isSaderMismatch(o.status, o.orderSubtotal, sumPickupOutFromOrderMoneyEvents(o.moneyEvents)).type;
        return saderFilter === "higher" ? type === "excess" : type === "deficit";
      });
    } else if (statusFilter === "checkWard") {
      orders = orders.filter((o) => {
        const type = isWardMismatch(o.status, o.totalAmount, sumDeliveryInFromOrderMoneyEvents(o.moneyEvents)).type;
        return wardFilter === "higher" ? type === "excess" : type === "deficit";
      });
    }

    function statusPriority(s: string): number {
      if (s === "pending") return 0;
      if (s === "assigned") return 1;
      if (s === "delivering") return 2;
      if (s === "delivered") return 3;
      if (s === "cancelled") return 4;
      return 99;
    }

    if (statusFilter === "all") {
      orders = orders.sort(
        (a, b) =>
          statusPriority(a.status) - statusPriority(b.status) ||
          b.orderNumber - a.orderNumber,
      );
    } else {
      orders = orders.sort((a, b) => b.orderNumber - a.orderNumber);
    }

    function hrefTracking(opts: {
      status: string;
      wardFilter?: "lower" | "higher";
      saderFilter?: "lower" | "higher";
    }): string {
      const p = new URLSearchParams();
      if (opts.status !== "all") p.set("status", opts.status);
      if (opts.status === "checkWard" && opts.wardFilter) p.set("wardFilter", opts.wardFilter);
      if (opts.status === "checkSader" && opts.saderFilter) p.set("saderFilter", opts.saderFilter);
      if (q) p.set("q", q);
      return p.toString() ? `${SECRET_ADMIN_PATH}/orders/tracking?${p}` : `${SECRET_ADMIN_PATH}/orders/tracking`;
    }

    const tableRows: TrackingTableRow[] = orders.map((o) => {
      const phoneProfile = customerPhoneProfileByKey.get(
        `${normalizeIraqMobileLocal11(o.customerPhone) ?? ""}_${o.customerRegionId ?? ""}`,
      );

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

      const orderSubtotalNum = o.orderSubtotal ? Number(o.orderSubtotal) : 0;
      const deliveryPriceNum = o.deliveryPrice ? Number(o.deliveryPrice) : 0;
      const totalAmountNum = o.totalAmount ? Number(o.totalAmount) : 0;
      const calculatedDebt = totalAmountNum - (orderSubtotalNum + deliveryPriceNum);
      const hasDebt = calculatedDebt > 0;
      const priceWithDebt = orderSubtotalNum + (hasDebt ? calculatedDebt : 0);

      return {
        id: o.id,
        orderNumber: o.orderNumber,
        orderStatus: o.status,
        assignedCourierId: o.assignedCourierId ?? null,
        shopCustomerLabel: formatShopWithCustomer(
          o.shop?.name ?? "غير معروف",
          o.customer?.name,
          o.routeMode,
          Boolean(o.submittedByCompanyPreparerId || o.submissionSource === "company_preparer" || (o.submittedByCompanyPreparer?.name && o.shop?.name && o.shop.name.trim() === o.submittedByCompanyPreparer.name.trim()))
        ),
        regionName: o.customerRegion?.name ?? o.shop?.region?.name ?? "—",
        orderType: o.orderType || "—",
        routeModeLabel: o.routeMode === "double" ? "وجهتين" : "",
        prepaidAll: o.prepaidAll,
        totalLabel: o.prepaidAll ? "كل شي واصل" : (o.orderSubtotal != null ? formatDinarAsAlf(o.orderSubtotal) : "—"),
        deliveryLabel: o.deliveryPrice != null ? formatDinarAsAlf(o.deliveryPrice) : "—",
        calculatedDebt: hasDebt ? calculatedDebt : null,
        hasDebt: hasDebt,
        priceWithDebtLabel: priceWithDebt > 0 ? formatDinarAsAlf(new Decimal(priceWithDebt)) : "—",
        customerPhone: o.customerPhone || "—",
        customerAlternatePhone: (o.routeMode === "double" || !!o.secondCustomerPhone) ? (o.alternatePhone || "—") : (o.alternatePhone || o.secondCustomerPhone || "—"),
        courierName: o.courier?.name ?? "—",
        orderNoteTime: o.orderNoteTime,
        missingCustomerLocation: !hasCustomerLocationUrl(
          o.customerLocationUrl,
          o.customer?.customerLocationUrl,
          phoneProfile?.locationUrl,
        ),
        hasCourierUploadedLocation: Boolean(o.customerLocationSetByCourierAt),
        summary: o.summary,
        preparerShoppingJson: o.preparerShoppingJson,
        wardMismatchType: isWardMismatch(o.status, o.totalAmount, sumDeliveryInFromOrderMoneyEvents(o.moneyEvents)).type,
        saderMismatchType: isSaderMismatch(o.status, o.orderSubtotal, sumPickupOutFromOrderMoneyEvents(o.moneyEvents)).type,
        noWardRecorded: sumDeliveryInFromOrderMoneyEvents(o.moneyEvents) == null,
        noSaderRecorded: sumPickupOutFromOrderMoneyEvents(o.moneyEvents) == null,
        pickupSumDinar: courierPickup > 0 ? courierPickup : null,
        preparerPickupSumDinar: preparerPickup > 0 ? preparerPickup : null,
        adminPickupSumDinar: adminPickup > 0 ? adminPickup : null,
        deliverySumDinar: courierDelivery > 0 ? courierDelivery : null,
        preparerDeliverySumDinar: preparerDelivery > 0 ? preparerDelivery : null,
        createdAt: o.createdAt,
        customerName: o.customer?.name || null,
        // بيانات الوصول السريع
        audioUrl: resolvePublicAssetSrc(o.voiceNoteUrl?.startsWith("data:") ? `/api/image/order/${o.id}/voice` : (o.voiceNoteUrl || null)),
        adminAudioUrl: resolvePublicAssetSrc(o.adminVoiceNoteUrl?.startsWith("data:") ? `/api/image/order/${o.id}/admin-voice` : (o.adminVoiceNoteUrl || null)),
        shopPhone: o.shop?.phone || "",
        shopLocationUrl: o.shop?.locationUrl || "",
        customerLocationUrl: o.customerLocationUrl || o.customer?.customerLocationUrl || phoneProfile?.locationUrl,
        secondCustomerLocationUrl: o.secondCustomerLocationUrl,
        shopDoorPhotoUrl: resolvePublicAssetSrc(
          o.shopDoorPhotoUrl?.startsWith("data:") ? `/api/image/order/${o.id}/shopDoor` : (o.shopDoorPhotoUrl || o.shop?.photoUrl || null)
        ),
        customerDoorPhotoUrl: resolvePublicAssetSrc(
          o.customerDoorPhotoUrl?.startsWith("data:") ? `/api/image/order/${o.id}/customerDoor` : (o.customerDoorPhotoUrl || o.customer?.customerDoorPhotoUrl || phoneProfile?.photoUrl || null)
        ),
        secondCustomerDoorPhotoUrl: resolvePublicAssetSrc(
          o.secondCustomerDoorPhotoUrl?.startsWith("data:") ? `/api/image/order/${o.id}/secondCustomerDoor` : (o.secondCustomerDoorPhotoUrl || null)
        ),
        secondCustomerRegionName: o.secondCustomerRegion?.name ?? null,
        orderSubtotalDinar: o.orderSubtotal != null ? Number(o.orderSubtotal) : null,
        totalAmountDinar: o.totalAmount != null ? Number(o.totalAmount) : null,
        purchasePriceDinar: o.purchasePrice != null ? Number(o.purchasePrice) : null,
        deliveryPriceDinar: o.deliveryPrice != null ? Number(o.deliveryPrice) : null,
      };
    });

    const statusTabs = [
      { key: "all", label: "الكل" },
      { key: "pending", label: "جديد" },
      { key: "assigned", label: "مسند" },
      { key: "delivering", label: "بالتوصيل" },
      { key: "delivered", label: "مسلّم" },
    ];

    // تحويل البيانات إلى JSON لضمان التوافق مع Next.js 15 (Serialization safety)
    const safeTableRows = serializePrisma(tableRows);
    const safeCouriers = serializePrisma(couriers);

    // --- حساب أرباح اليوم الصافية (توصيل + تجهيز) ---
    const ALF_PER_DINAR = 1;
    function numOrZero(v: unknown): number {
      const n = Number(v);
      return Number.isFinite(n) ? n : 0;
    }

    const todayDate = new Date();
    let shiftStartToday = new Date(todayDate.getFullYear(), todayDate.getMonth(), todayDate.getDate(), 6, 0, 0, 0);
    if (todayDate < shiftStartToday) {
      shiftStartToday.setDate(shiftStartToday.getDate() - 1);
    }
    const todayFrom = shiftStartToday;
    const todayTo = new Date(todayFrom);
    todayTo.setDate(todayTo.getDate() + 1);
    todayTo.setMilliseconds(todayTo.getMilliseconds() - 1);

    const [todayDeliveredOrders, todayPrepOrders] = await Promise.all([
      prisma.order.findMany({
        where: {
          status: "delivered",
          createdAt: { gte: todayFrom, lte: todayTo }
        },
        select: {
          deliveryPrice: true,
          courierEarningDinar: true,
          courier: { select: { zeroEarning: true, vehicleType: true } }
        }
      }),
      prisma.order.findMany({
        where: {
          createdAt: { gte: todayFrom, lte: todayTo },
          preparerShoppingJson: { not: null as any },
          status: { notIn: ["cancelled", "rejected"] },
          shop: { name: { in: ADMIN_SHOP_NAMES } }
        },
        select: {
          preparerShoppingJson: true
        }
      })
    ]);

    let todayDeliveryProfit = new Decimal(0);
    for (const o of todayDeliveredOrders) {
      if (o.deliveryPrice) {
        let p = new Decimal(0);
        if (o.courier) {
          if (o.courier.zeroEarning) {
            p = o.deliveryPrice;
          } else {
            if (o.courierEarningDinar != null) {
              p = o.deliveryPrice.minus(o.courierEarningDinar);
            } else {
              const vehicle = o.courier.vehicleType || "car";
              const earning = vehicle === "bike"
                ? o.deliveryPrice.div(2)
                : o.deliveryPrice.mul(2).div(3);
              p = o.deliveryPrice.minus(earning);
            }
          }
        } else {
          if (o.courierEarningDinar != null) {
            p = o.deliveryPrice.minus(o.courierEarningDinar);
          } else {
            p = o.deliveryPrice;
          }
        }
        todayDeliveryProfit = todayDeliveryProfit.plus(p);
      }
    }

    let todayPrepProfit = new Decimal(0);
    for (const o of todayPrepOrders) {
      if (o.preparerShoppingJson) {
        const j = o.preparerShoppingJson as any;
        const products = Array.isArray(j?.products) ? j.products : [];
        const totalProfitAlf = products.reduce((sum: number, p: any) => sum + (Number(p.sellAlf) - Number(p.buyAlf) || 0), 0);
        todayPrepProfit = todayPrepProfit.plus(new Decimal(totalProfitAlf * ALF_PER_DINAR));
      }
    }

    const todayTotalProfit = todayDeliveryProfit.plus(todayPrepProfit).toNumber();

    return (
      <div className="space-y-4" dir="rtl">
        <p className={ad.muted}>
          <Link href={SECRET_ADMIN_PATH} className={ad.link}>
            ← الرئيسية
          </Link>
        </p>
        <div className="flex flex-col gap-4 border-b border-slate-100 pb-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className={ad.h1}>
              {statusFilter === "cancelled" ? "المرفوضة" : "تتبع الطلبات"}
            </h1>
          </div>

          <div className="grid grid-cols-1 gap-2.5 sm:flex sm:flex-wrap sm:items-center sm:gap-3">
            <Link 
              href={`${SECRET_ADMIN_PATH}/reports/couriers`}
              className="flex items-center justify-between gap-3 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 px-4 py-2.5 text-white shadow-sm shadow-amber-200 transition hover:-translate-y-0.5 hover:shadow-md active:scale-[0.98]"
            >
              <div className="flex items-center gap-2.5">
                <span className="text-xl">💰</span>
                <div>
                  <p className="text-[10px] font-bold text-amber-100 uppercase">أرباح اليوم الصافية</p>
                  <p className="text-sm font-black">{formatDinarAsAlfWithUnit(todayTotalProfit)}</p>
                </div>
              </div>
              <span className="text-[11px] font-bold text-amber-100 bg-amber-700/30 px-2 py-1 rounded-lg">← تفاصيل</span>
            </Link>

            <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center sm:gap-3">
              <Link href={`${SECRET_ADMIN_PATH}/orders/new`} className="flex items-center justify-center rounded-2xl bg-sky-900 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-sky-950 active:scale-[0.98] text-center whitespace-nowrap">
                + إضافة طلب من الإدارة
              </Link>
              <Link href={`${SECRET_ADMIN_PATH}/orders/pending`} className="flex items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm shadow-blue-200 transition hover:-translate-y-0.5 hover:shadow-md active:scale-[0.98] text-center whitespace-nowrap">
                الطلبات الجديدة
              </Link>
            </div>
          </div>
        </div>

        {/* شريط التبويبات الحديث المريح على الجوال والشاشات المختلفة */}
        <div className="relative">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 pt-1 no-scrollbar sm:flex-wrap">
            {statusTabs.map((t) => {
              const active =
                t.key === "all" ? statusFilter === "all" : statusFilter === t.key;
              return (
                <Link
                  key={t.key}
                  href={hrefTracking({ status: t.key })}
                  className={`flex shrink-0 items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold transition-all ${
                    active
                      ? "bg-sky-600 text-white shadow-sm shadow-sky-200 ring-1 ring-sky-600"
                      : "bg-slate-100/80 text-slate-700 hover:bg-slate-200/80 active:bg-slate-300/80"
                  }`}
                >
                  <span>{t.label}</span>
                  {t.key === "pending" && pendingTabCount > 0 ? (
                    <span className="inline-flex min-w-[1.2rem] items-center justify-center rounded-full bg-rose-600 px-1.5 py-0.5 text-[10px] font-black leading-none text-white">
                      {pendingTabCount > 99 ? "99+" : pendingTabCount}
                    </span>
                  ) : null}
                </Link>
              );
            })}

            <div className="h-4 w-px bg-slate-300 mx-0.5 shrink-0 hidden sm:block" />

            <Link
              href={hrefTracking({ status: "checkSader", saderFilter })}
              className={`flex shrink-0 items-center gap-1 rounded-xl px-3.5 py-2 text-xs font-bold transition-all ${
                statusFilter === "checkSader"
                  ? "bg-emerald-600 text-white shadow-sm shadow-emerald-200 ring-1 ring-emerald-600"
                  : "bg-emerald-50 text-emerald-800 hover:bg-emerald-100 active:bg-emerald-200"
              }`}
            >
              فحص الصادر
            </Link>
            <Link
              href={hrefTracking({
                status: "checkWard",
                wardFilter,
              })}
              className={`flex shrink-0 items-center gap-1 rounded-xl px-3.5 py-2 text-xs font-bold transition-all ${
                statusFilter === "checkWard"
                  ? "bg-red-600 text-white shadow-sm shadow-red-200 ring-1 ring-red-600"
                  : "bg-red-50 text-red-800 hover:bg-red-100 active:bg-red-200"
              }`}
            >
              فحص الوارد
            </Link>
            <Link
              href={hrefTracking({ status: "cancelled" })}
              className={`flex shrink-0 items-center gap-1 rounded-xl px-3.5 py-2 text-xs font-bold transition-all ${
                statusFilter === "cancelled"
                  ? "bg-rose-700 text-white shadow-sm shadow-rose-200 ring-1 ring-rose-700"
                  : "bg-rose-50 text-rose-800 hover:bg-rose-100 active:bg-rose-200"
              }`}
            >
              المرفوضة
            </Link>
          </div>
        </div>

        {statusFilter === "checkSader" ? (
          <div className="space-y-2">
            <p className="rounded-xl border border-emerald-200 bg-emerald-50/90 px-3 py-2 text-sm text-emerald-950">
              <strong>فحص الصادر:</strong> طلبات حيث المبلغ المدفوع للمحل يختلف عن سعر البضاعة.
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold text-slate-600">فلتر:</span>
              <Link
                href={hrefTracking({ status: "checkSader", saderFilter: "lower" })}
                className={`rounded-full px-3 py-1.5 text-xs font-bold transition ${
                  saderFilter === "lower"
                    ? "bg-emerald-600 text-white ring-2 ring-emerald-400"
                    : "border border-emerald-200 bg-white text-emerald-900 hover:bg-emerald-50"
                }`}
              >
                المبلغ أقل من سعر البضاعة
              </Link>
              <Link
                href={hrefTracking({ status: "checkSader", saderFilter: "higher" })}
                className={`rounded-full px-3 py-1.5 text-xs font-bold transition ${
                  saderFilter === "higher"
                    ? "bg-emerald-600 text-white ring-2 ring-emerald-400"
                    : "border border-emerald-200 bg-white text-emerald-900 hover:bg-emerald-50"
                }`}
              >
                المبلغ أعلى من سعر البضاعة
              </Link>
            </div>
          </div>
        ) : null}
        {statusFilter === "checkWard" ? (
          <div className="space-y-2">
            <p className="rounded-xl border border-red-200 bg-red-50/90 px-3 py-2 text-sm text-red-950">
              <strong>فحص الوارد:</strong> طلبات مسلّمة حيث المبلغ المستلم من الزبون يختلف عن المجموع الكلي.
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold text-slate-600">فلتر:</span>
              <Link
                href={hrefTracking({ status: "checkWard", wardFilter: "lower" })}
                className={`rounded-full px-3 py-1.5 text-xs font-bold transition ${
                  wardFilter === "lower"
                    ? "bg-red-600 text-white ring-2 ring-red-400"
                    : "border border-red-200 bg-white text-red-900 hover:bg-red-50"
                }`}
              >
                المبلغ أقل من المتوقع
              </Link>
              <Link
                href={hrefTracking({ status: "checkWard", wardFilter: "higher" })}
                className={`rounded-full px-3 py-1.5 text-xs font-bold transition ${
                  wardFilter === "higher"
                    ? "bg-red-600 text-white ring-2 ring-red-400"
                    : "border border-red-200 bg-white text-red-900 hover:bg-red-50"
                }`}
              >
                المبلغ أعلى من المتوقع
              </Link>
            </div>
          </div>
        ) : null}

        <div className="space-y-3">
          <div>
            <Suspense
              fallback={
                <div className="h-10 animate-pulse rounded-xl bg-sky-100" aria-hidden />
              }
            >
              <OrderTrackingSearch
                key={`${statusFilter}-${wardFilter}-${saderFilter}`}
                initialQ={q}
                statusFilter={statusFilter}
                wardFilter={wardFilter}
              />
            </Suspense>
          </div>

          <OrderTrackingBulkTable rows={safeTableRows} couriers={safeCouriers} />
          <p className={ad.orderListCountFooter}>
            عدد الطلبات في هذه الصفحة:{" "}
            <span className="font-bold text-sky-900">{safeTableRows.length}</span>
          </p>
        </div>
      </div>
    );
  } catch (err: any) {
    return (
      <div className="p-8 space-y-4 bg-red-50 text-red-900 min-h-screen" dir="ltr">
        <h1 className="text-2xl font-bold">Runtime Error in OrderTrackingPage</h1>
        <p>Please screenshot this page and show it to the developer.</p>
        <pre className="bg-slate-900 text-red-400 p-4 rounded overflow-auto whitespace-pre-wrap text-sm">
          {err.stack || err.message || String(err)}
        </pre>
      </div>
    );
  }
}
