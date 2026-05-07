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
} from "@/lib/mandoub-money";
import { hasCustomerLocationUrl } from "@/lib/order-location";
import { normalizeIraqMobileLocal11 } from "@/lib/whatsapp";
import { routeModeOrFromQuery } from "@/lib/admin-super-search";
import { formatDinarAsAlf } from "@/lib/money-alf";
import { normalizeAdminShopName } from "@/lib/admin-order-from-admin-constants";
import { resolvePublicAssetSrc } from "@/lib/image-url";
import { OrderTrackingSearch } from "./order-tracking-search";
import { type TrackingTableRow } from "./order-tracking-table-body";
import { OrderTrackingBulkTable } from "./order-tracking-bulk-table";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "تتبع الطلبات — أبو الأكبر للتوصيل",
};

function formatShopWithCustomer(
  shopName: string,
  customerName: string | null | undefined,
  routeMode?: string | null,
): string {
  if (routeMode === "double") return "وجهتين";
  const shop = normalizeAdminShopName(shopName) || "—";
  const cust = customerName?.trim();
  if (!cust) return shop;
  return `${shop}(${cust})`;
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
  const sp = await searchParams;
  const rawStatus = ((sp.status ?? "all") as string).trim();
  if (rawStatus === "archived") {
    redirect("/admin/orders/archived");
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

  const where: Prisma.OrderWhereInput = {};

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
    const or: Prisma.OrderWhereInput[] = [
      ...routeModeOrFromQuery(q),
      { customerPhone: { contains: q } },
      { orderType: { contains: q, mode: "insensitive" } },
      { shop: { name: { contains: q, mode: "insensitive" } } },
      { courier: { name: { contains: q, mode: "insensitive" } } },
      { customerRegion: { name: { contains: q, mode: "insensitive" } } },
      { shop: { region: { name: { contains: q, mode: "insensitive" } } } },
      { customer: { name: { contains: q, mode: "insensitive" } } },
    ];
    if (numExact) {
      or.unshift({ orderNumber: asNum });
    }
    where.OR = or;
  }

  const pendingTabWhere: Prisma.OrderWhereInput = {
    status: "pending",
  };
  if (q) {
    const asNum = parseInt(q, 10);
    const numExact = !Number.isNaN(asNum) && String(asNum) === q;
    const or: Prisma.OrderWhereInput[] = [
      ...routeModeOrFromQuery(q),
      { customerPhone: { contains: q } },
      { orderType: { contains: q, mode: "insensitive" } },
      { shop: { name: { contains: q, mode: "insensitive" } } },
      { courier: { name: { contains: q, mode: "insensitive" } } },
      { customerRegion: { name: { contains: q, mode: "insensitive" } } },
      { shop: { region: { name: { contains: q, mode: "insensitive" } } } },
      { customer: { name: { contains: q, mode: "insensitive" } } },
    ];
    if (numExact) {
      or.unshift({ orderNumber: asNum });
    }
    pendingTabWhere.OR = or;
  }

  let [orders, couriers, pendingTabCount] = await Promise.all([
    prisma.order.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        shop: {
          select: {
            id: true,
            name: true,
            photoUrl: true,
            region: true
          }
        },
        customerRegion: true,
        courier: true,
        customer: true,
        moneyEvents: {
          where: { deletedAt: null },
          select: { kind: true, amountDinar: true, deletedAt: true },
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
    return p.toString() ? `/admin/orders/tracking?${p}` : "/admin/orders/tracking";
  }

  const tableRows: TrackingTableRow[] = orders.map((o) => {
    const phoneProfile = customerPhoneProfileByKey.get(
      `${normalizeIraqMobileLocal11(o.customerPhone) ?? ""}_${o.customerRegionId ?? ""}`,
    );

    const pickupSum = sumPickupOutFromOrderMoneyEvents(o.moneyEvents);
    const deliverySum = sumDeliveryInFromOrderMoneyEvents(o.moneyEvents);

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
      customerAlternatePhone: o.alternatePhone || o.secondCustomerPhone || "—",
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
      pickupSumDinar: pickupSum != null ? Number(pickupSum) : null,
      deliverySumDinar: deliverySum != null ? Number(deliverySum) : null,
      createdAt: o.createdAt,
      // بيانات الوصول السريع
      audioUrl: resolvePublicAssetSrc(o.voiceNoteUrl) || null,
      adminAudioUrl: resolvePublicAssetSrc(o.adminVoiceNoteUrl) || null,
      shopPhone: o.shop.phone,
      shopLocationUrl: o.shop.locationUrl,
      customerLocationUrl: o.customerLocationUrl || o.customer?.customerLocationUrl || phoneProfile?.locationUrl,
      secondCustomerLocationUrl: o.secondCustomerLocationUrl,
      shopDoorPhotoUrl: resolvePublicAssetSrc(o.shopDoorPhotoUrl || o.shop.photoUrl) || null,
      customerDoorPhotoUrl: resolvePublicAssetSrc(
        phoneProfile?.photoUrl ||
        o.customer?.customerDoorPhotoUrl ||
        o.customerDoorPhotoUrl,
      ) || null,
      secondCustomerDoorPhotoUrl: resolvePublicAssetSrc(o.secondCustomerDoorPhotoUrl) || null,
    };
  });

  const statusTabs = [
    { key: "all", label: "الكل" },
    { key: "pending", label: "جديد" },
    { key: "assigned", label: "مسند" },
    { key: "delivering", label: "بالتوصيل" },
    { key: "delivered", label: "مسلّم" },
  ];

  return (
    <div className="space-y-4" dir="rtl">
      <p className={ad.muted}>
        <Link href="/admin" className={ad.link}>
          ← الرئيسية
        </Link>
      </p>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className={ad.h1}>
          {statusFilter === "cancelled" ? "المرفوضة" : "تتبع الطلبات"}
        </h1>
        <Link href="/admin/orders/new" className={ad.btnPrimary}>
          + إضافة طلب من الإدارة
        </Link>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {statusTabs.map((t) => {
          const active =
            t.key === "all" ? statusFilter === "all" : statusFilter === t.key;
          return (
            <Link
              key={t.key}
              href={hrefTracking({ status: t.key })}
              className={`rounded-full px-3 py-1.5 text-sm font-bold transition ${
                active
                  ? "bg-sky-600 text-white ring-2 ring-sky-400 shadow-sm"
                  : "border border-sky-200 bg-white text-sky-800 hover:bg-sky-50"
              }`}
            >
              <span className="inline-flex items-center gap-1">
                {t.label}
                {t.key === "pending" && pendingTabCount > 0 ? (
                  <span className="inline-flex min-w-[1.15rem] items-center justify-center rounded-full bg-rose-600 px-1.5 py-0.5 text-[10px] font-black leading-none text-white">
                    {pendingTabCount > 99 ? "99+" : pendingTabCount}
                  </span>
                ) : null}
              </span>
            </Link>
          );
        })}
        <Link
          href={hrefTracking({ status: "checkSader", saderFilter })}
          className={`rounded-full px-3 py-1.5 text-sm font-bold transition ${
            statusFilter === "checkSader"
              ? "bg-emerald-600 text-white ring-2 ring-emerald-400 shadow-sm"
              : "border border-emerald-200 bg-emerald-50 text-emerald-900 hover:bg-emerald-100"
          }`}
        >
          فحص الصادر
        </Link>
        <Link
          href={hrefTracking({
            status: "checkWard",
            wardFilter,
          })}
          className={`rounded-full px-3 py-1.5 text-sm font-bold transition ${
            statusFilter === "checkWard"
              ? "bg-red-600 text-white ring-2 ring-red-400 shadow-sm"
              : "border border-red-200 bg-red-50 text-red-950 hover:bg-red-100"
          }`}
        >
          فحص الوارد
        </Link>
        <Link
          href={hrefTracking({ status: "cancelled" })}
          className={`rounded-full px-3 py-1.5 text-sm font-bold transition ${
            statusFilter === "cancelled"
              ? "bg-red-600 text-white ring-2 ring-red-400 shadow-sm"
              : "border-2 border-red-600 bg-red-50 text-red-800 hover:bg-red-100"
          }`}
        >
          المرفوضة
        </Link>
        <Link
          href="/admin/orders/archived"
          className="rounded-full border border-violet-300 bg-violet-50 px-3 py-1.5 text-sm font-bold text-violet-950 transition hover:bg-violet-100"
        >
          المؤرشفة
        </Link>
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

        <OrderTrackingBulkTable rows={tableRows} couriers={couriers} />
        <p className={ad.orderListCountFooter}>
          عدد الطلبات في هذه الصفحة:{" "}
          <span className="font-bold text-sky-900">{tableRows.length}</span>
        </p>
      </div>
    </div>
  );
}
