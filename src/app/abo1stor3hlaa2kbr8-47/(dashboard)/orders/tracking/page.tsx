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
import { parseBaghdadDateRange } from "@/lib/order-date-search";
import { formatDinarAsAlf } from "@/lib/money-alf";
import { normalizeAdminShopName } from "@/lib/admin-order-from-admin-constants";
import { resolvePublicAssetSrc } from "@/lib/image-url";
import { serializePrisma } from "@/lib/serialize-prisma";
import { OrderTrackingSearch } from "./order-tracking-search";
import { type TrackingTableRow } from "./order-tracking-table-body";
import { OrderTrackingBulkTable } from "./order-tracking-bulk-table";

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
      const dateRange = parseBaghdadDateRange(q);
      const or: Prisma.OrderWhereInput[] = [
        ...routeModeOrFromQuery(q),
        { customerPhone: { contains: q } },
        { orderType: { contains: q, mode: "insensitive" } },
        { shop: { name: { contains: q, mode: "insensitive" } } },
        { courier: { name: { contains: q, mode: "insensitive" } } },
        { customerRegion: { name: { contains: q, mode: "insensitive" } } },
        { shop: { region: { name: { contains: q, mode: "insensitive" } } } },
        { customer: { name: { contains: q, mode: "insensitive" } } },
        { orderNoteTime: { contains: q, mode: "insensitive" } },
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
        { shop: { region: { name: { contains: q, mode: "insensitive" } } } },
        { customer: { name: { contains: q, mode: "insensitive" } } },
        { orderNoteTime: { contains: q, mode: "insensitive" } },
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
        take: 50,
        include: {
          shop: {
            select: { id: true, name: true, photoUrl: true, region: true, phone: true, locationUrl: true }
          },
          customerRegion: true,
          courier: true,
          customer: true,
          moneyEvents: {
            where: { deletedAt: null },
            select: { kind: true, amountDinar: true },
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

      const pickupSum = sumPickupOutFromOrderMoneyEvents(o.moneyEvents);
      const deliverySum = sumDeliveryInFromOrderMoneyEvents(o.moneyEvents);

      return {
        id: o.id,
        orderNumber: o.orderNumber,
        orderStatus: o.status,
        assignedCourierId: o.assignedCourierId ?? null,
        shopCustomerLabel: formatShopWithCustomer(o.shop?.name ?? "غير معروف", o.customer?.name, o.routeMode),
        regionName: o.customerRegion?.name ?? o.shop?.region?.name ?? "—",
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
      };
    });

    const statusTabs = [
      { key: "all", label: "الكل", icon: "clipboard_list" },
      { key: "pending", label: "جديد", icon: "order_new" },
      { key: "assigned", label: "مسند", icon: "preparer_delegate" },
      { key: "delivering", label: "بالتوصيل", icon: "delivery_scooter" },
      { key: "delivered", label: "مسلّم", icon: "order_delivered" },
    ];

    // تحويل البيانات إلى JSON لضمان التوافق مع Next.js 15 (Serialization safety)
    const safeTableRows = serializePrisma(tableRows);
    const safeCouriers = serializePrisma(couriers);

    return (
      <div className="space-y-4" dir="rtl">
        <p className={ad.muted}>
          <Link href={SECRET_ADMIN_PATH} className={ad.link}>
            ← الرئيسية
          </Link>
        </p>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h1 className={ad.h1}>
            {statusFilter === "cancelled" ? "الطلبات المرفوضة" : "تتبع الطلبات"}
          </h1>
          <Link href={`${SECRET_ADMIN_PATH}/orders/new`} className={ad.btnPrimary}>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4" />
            </svg>
            إضافة طلب جديد
          </Link>
        </div>

        <div className="flex flex-wrap items-center gap-2 p-1 bg-slate-100/50 rounded-2xl w-fit">
          {statusTabs.map((t) => {
            const active =
              t.key === "all" ? statusFilter === "all" : statusFilter === t.key;
            return (
              <Link
                key={t.key}
                href={hrefTracking({ status: t.key })}
                className={`relative flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold transition-all ${
                  active
                    ? "bg-white text-indigo-600 shadow-sm ring-1 ring-slate-200"
                    : "text-slate-500 hover:text-slate-700 hover:bg-white/50"
                }`}
              >
                <span>{t.label}</span>
                {t.key === "pending" && pendingTabCount > 0 ? (
                  <span className="flex h-5 min-w-[1.25rem] items-center justify-center rounded-lg bg-rose-500 px-1 text-[10px] font-black tabular-nums text-white ring-2 ring-white">
                    {pendingTabCount > 99 ? "99+" : pendingTabCount}
                  </span>
                ) : null}
                {active && (
                  <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-indigo-600" />
                )}
              </Link>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Link
            href={hrefTracking({ status: "checkSader", saderFilter })}
            className={`group flex items-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-black transition-all ${
              statusFilter === "checkSader"
                ? "bg-emerald-600 text-white shadow-lg shadow-emerald-200"
                : "bg-emerald-50 text-emerald-700 border border-emerald-100 hover:bg-emerald-100"
            }`}
          >
            <div className={`w-2 h-2 rounded-full ${statusFilter === 'checkSader' ? 'bg-white' : 'bg-emerald-500'}`} />
            فحص الصادر
          </Link>
          <Link
            href={hrefTracking({
              status: "checkWard",
              wardFilter,
            })}
            className={`group flex items-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-black transition-all ${
              statusFilter === "checkWard"
                ? "bg-rose-600 text-white shadow-lg shadow-rose-200"
                : "bg-rose-50 text-rose-700 border border-rose-100 hover:bg-rose-100"
            }`}
          >
            <div className={`w-2 h-2 rounded-full ${statusFilter === 'checkWard' ? 'bg-white' : 'bg-rose-500'}`} />
            فحص الوارد
          </Link>
          <Link
            href={hrefTracking({ status: "cancelled" })}
            className={`group flex items-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-black transition-all ${
              statusFilter === "cancelled"
                ? "bg-slate-800 text-white shadow-lg shadow-slate-200"
                : "bg-white text-slate-600 border-2 border-slate-200 hover:border-slate-300"
            }`}
          >
            {statusFilter !== 'cancelled' && <div className="w-2 h-2 rounded-full bg-slate-400" />}
            المرفوضة
          </Link>
        </div>

        {statusFilter === "checkSader" ? (
          <div className="space-y-3 animate-in fade-in slide-in-from-right-2 duration-300">
            <div className="flex items-center gap-3 rounded-2xl border border-emerald-100 bg-emerald-50/50 px-4 py-3">
              <div className="shrink-0 w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <p className="text-sm font-bold text-emerald-900 leading-relaxed">
                <strong>فحص الصادر:</strong> يتم هنا عرض الطلبات التي سُددت للمحل بمبلغ يختلف عن صافي قيمة البضاعة المسجل في الطلب.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 pr-2">
              <span className="text-[11px] font-black uppercase tracking-wider text-slate-400">تصنيف الخلل:</span>
              <Link
                href={hrefTracking({ status: "checkSader", saderFilter: "lower" })}
                className={`rounded-xl px-4 py-2 text-xs font-black transition-all ${
                  saderFilter === "lower"
                    ? "bg-emerald-600 text-white"
                    : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
                }`}
              >
                المبلغ أقل من السعر
              </Link>
              <Link
                href={hrefTracking({ status: "checkSader", saderFilter: "higher" })}
                className={`rounded-xl px-4 py-2 text-xs font-black transition-all ${
                  saderFilter === "higher"
                    ? "bg-emerald-600 text-white"
                    : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
                }`}
              >
                المبلغ أعلى من السعر
              </Link>
            </div>
          </div>
        ) : null}
        {statusFilter === "checkWard" ? (
          <div className="space-y-3 animate-in fade-in slide-in-from-right-2 duration-300">
            <div className="flex items-center gap-3 rounded-2xl border border-rose-100 bg-rose-50/50 px-4 py-3">
              <div className="shrink-0 w-10 h-10 rounded-xl bg-rose-100 flex items-center justify-center text-rose-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <p className="text-sm font-bold text-rose-900 leading-relaxed">
                <strong>فحص الوارد:</strong> يتم هنا عرض الطلبات المسلّمة التي استُلم منها مبلغ كلي يختلف عن (سعر البضاعة + التوصيل) المتوقع.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 pr-2">
              <span className="text-[11px] font-black uppercase tracking-wider text-slate-400">تصنيف الخلل:</span>
              <Link
                href={hrefTracking({ status: "checkWard", wardFilter: "lower" })}
                className={`rounded-xl px-4 py-2 text-xs font-black transition-all ${
                  wardFilter === "lower"
                    ? "bg-rose-600 text-white"
                    : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
                }`}
              >
                المبلغ أقل من المتوقع
              </Link>
              <Link
                href={hrefTracking({ status: "checkWard", wardFilter: "higher" })}
                className={`rounded-xl px-4 py-2 text-xs font-black transition-all ${
                  wardFilter === "higher"
                    ? "bg-rose-600 text-white"
                    : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
                }`}
              >
                المبلغ أعلى من المتوقع
              </Link>
            </div>
          </div>
        ) : null}

        <div className="space-y-4">
          <div className="relative group">
            <div className="absolute inset-y-0 right-4 flex items-center pointer-events-none text-slate-400 group-focus-within:text-indigo-500 transition-colors">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <Suspense
              fallback={
                <div className="h-12 animate-pulse rounded-2xl bg-slate-100" aria-hidden />
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
            عدد الطلبات المعروضة:{" "}
            <span className="font-black text-indigo-900 tabular-nums">{safeTableRows.length}</span>
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
