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
import { OrderTrackingFilterDropdown } from "./order-tracking-filter-dropdown";
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
        take: 150,
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
        submittedByCompanyPreparerId: o.submittedByCompanyPreparerId,
        submissionSource: o.submissionSource,
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
      <div className="space-y-2.5 sm:space-y-3" dir="rtl">
        {/* الترويسة العلوية الفائقة الصغر والمضغوطة */}
        <div className="flex items-center justify-between gap-2 border-b border-[#C9A86A]/20 pb-2">
          {/* يمين: زر العودة + عنوان الصفحة + عدد الطلبات */}
          <div className="flex items-center gap-2">
            <Link
              href={SECRET_ADMIN_PATH}
              className="flex size-7 sm:size-8 items-center justify-center rounded-full bg-white text-[#0A3D2E] border border-[#C9A86A]/60 shadow-2xs hover:bg-[#FFF8F0] transition active:scale-95 text-xs font-black"
              title="العودة للرئيسية"
            >
              ←
            </Link>
            <div className="flex items-center gap-1.5">
              <h1 className="text-sm sm:text-base font-black text-[#0A3D2E]">
                {statusFilter === "cancelled" ? "المرفوضة" : "تتبع الطلبات"}
              </h1>
              <span className="inline-flex items-center justify-center rounded-full bg-[#0A3D2E]/10 px-2 py-0.5 text-[11px] font-black text-[#0A3D2E]">
                {safeTableRows.length}
              </span>
            </div>
          </div>

          {/* يسار: أرباح اليوم + أزرار الإجراءات الإدارية المدمجة */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            {/* كبسولة أرباح اليوم الصافية المدمجة */}
            <Link
              href={`${SECRET_ADMIN_PATH}/reports/couriers`}
              className="flex items-center gap-1 sm:gap-1.5 rounded-full bg-gradient-to-r from-amber-500 via-amber-400 to-amber-600 px-2.5 sm:px-3 py-1 text-white shadow-xs border border-amber-300/60 transition hover:brightness-105 active:scale-95"
              title="أرباح اليوم الصافية (انقر لعرض تفاصيل التقارير)"
            >
              <span className="text-xs">💰</span>
              <span className="text-[11px] sm:text-xs font-black whitespace-nowrap">
                {formatDinarAsAlfWithUnit(todayTotalProfit)}
              </span>
            </Link>

            {/* زر إضافة طلب من الإدارة */}
            <Link
              href={`${SECRET_ADMIN_PATH}/orders/new`}
              className="flex items-center gap-1 rounded-full px-2.5 sm:px-3 py-1 text-[11px] sm:text-xs font-black text-[#0A3D2E] shadow-xs border border-[#D8BC7D] transition hover:brightness-105 active:scale-95 text-center whitespace-nowrap"
              style={{
                background: "linear-gradient(180deg, #F9E7B9 0%, #E8CA82 45%, #C9A86A 100%)",
              }}
              title="إضافة طلب من الإدارة"
            >
              <span>➕</span>
              <span className="hidden xs:inline">إضافة طلب</span>
            </Link>

            {/* زر الطلبات الجديدة */}
            <Link
              href={`${SECRET_ADMIN_PATH}/orders/pending`}
              className="flex items-center gap-1 rounded-full px-2.5 sm:px-3 py-1 text-[11px] sm:text-xs font-black text-white shadow-xs border border-[#C9A86A] transition hover:brightness-110 active:scale-95 text-center whitespace-nowrap"
              style={{
                background: "linear-gradient(180deg, #0F4D3A 0%, #0A3D2E 100%)",
              }}
              title="الطلبات الجديدة المعلقة"
            >
              <span className="text-[#F5D77F]">✨</span>
              <span className="hidden xs:inline">جديدة</span>
              {pendingTabCount > 0 ? (
                <span className="inline-flex size-4 items-center justify-center rounded-full bg-[#F5D77F] text-[#0A3D2E] text-[9px] font-black leading-none">
                  {pendingTabCount > 99 ? "99+" : pendingTabCount}
                </span>
              ) : null}
            </Link>
          </div>
        </div>

        {/* شريط البحث والفلترة الموحد المدمج (Unified Compact Filter & Search Toolbar) */}
        <div className="flex items-center gap-2">
          {/* زر فلتر الحالات الموحد الفاخر المنسدل */}
          <OrderTrackingFilterDropdown
            currentStatus={statusFilter}
            pendingCount={pendingTabCount}
            wardFilter={wardFilter}
            saderFilter={saderFilter}
            searchQuery={q}
          />

          {/* حقل البحث الفوري */}
          <Suspense
            fallback={
              <div className="h-10 flex-1 animate-pulse rounded-2xl bg-amber-50" aria-hidden />
            }
          >
            <OrderTrackingSearch
              key={`${statusFilter}-${wardFilter}-${saderFilter}`}
              initialQ={q}
              statusFilter={statusFilter}
              wardFilter={wardFilter}
              saderFilter={saderFilter}
            />
          </Suspense>
        </div>

        {/* تنبيه مصغر جداً لفحص الصادر إذا كان نشطاً */}
        {statusFilter === "checkSader" ? (
          <div className="flex flex-wrap items-center justify-between gap-1.5 rounded-xl border border-emerald-300 bg-emerald-50/90 px-3 py-1.5 text-xs text-emerald-950">
            <span className="font-black">⚖️ فحص الصادر: فروقات دفع المحل</span>
            <div className="flex items-center gap-1.5">
              <Link
                href={hrefTracking({ status: "checkSader", saderFilter: "lower" })}
                className={`rounded-lg px-2 py-0.5 text-[11px] font-black transition ${
                  saderFilter === "lower"
                    ? "bg-emerald-700 text-white"
                    : "bg-white text-emerald-900 border border-emerald-200"
                }`}
              >
                أقل من البضاعة
              </Link>
              <Link
                href={hrefTracking({ status: "checkSader", saderFilter: "higher" })}
                className={`rounded-lg px-2 py-0.5 text-[11px] font-black transition ${
                  saderFilter === "higher"
                    ? "bg-emerald-700 text-white"
                    : "bg-white text-emerald-900 border border-emerald-200"
                }`}
              >
                أعلى من البضاعة
              </Link>
            </div>
          </div>
        ) : null}

        {/* تنبيه مصغر جداً لفحص الوارد إذا كان نشطاً */}
        {statusFilter === "checkWard" ? (
          <div className="flex flex-wrap items-center justify-between gap-1.5 rounded-xl border border-rose-300 bg-rose-50/90 px-3 py-1.5 text-xs text-rose-950">
            <span className="font-black">📥 فحص الوارد: فروقات استلام الزبون</span>
            <div className="flex items-center gap-1.5">
              <Link
                href={hrefTracking({ status: "checkWard", wardFilter: "lower" })}
                className={`rounded-lg px-2 py-0.5 text-[11px] font-black transition ${
                  wardFilter === "lower"
                    ? "bg-rose-700 text-white"
                    : "bg-white text-rose-900 border border-rose-200"
                }`}
              >
                أقل من المتوقع
              </Link>
              <Link
                href={hrefTracking({ status: "checkWard", wardFilter: "higher" })}
                className={`rounded-lg px-2 py-0.5 text-[11px] font-black transition ${
                  wardFilter === "higher"
                    ? "bg-rose-700 text-white"
                    : "bg-white text-rose-900 border border-rose-200"
                }`}
              >
                أعلى من المتوقع
              </Link>
            </div>
          </div>
        ) : null}

        <OrderTrackingBulkTable rows={safeTableRows} couriers={safeCouriers} />
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
