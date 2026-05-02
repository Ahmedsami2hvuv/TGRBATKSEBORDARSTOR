import Link from "next/link";
import { cookies } from "next/headers";
import { formatDinarAsAlf } from "@/lib/money-alf";
import { prisma } from "@/lib/prisma";
import { Decimal } from "@prisma/client/runtime/library";
import type { DelegatePortalVerifyReason } from "@/lib/delegate-link";
import { verifyDelegatePortalQuery } from "@/lib/delegate-link";
import {
  isSaderMismatch,
  isWardMismatch,
  sumDeliveryInFromOrderMoneyEvents,
  sumPickupOutFromOrderMoneyEvents,
} from "@/lib/mandoub-money";
import { isManualDeletionReason } from "@/lib/mandoub-money-events";
import {
  fetchMandoubMoneySumsForCourier,
  fetchOrderOnlyMoneySumsForCourier,
} from "@/lib/mandoub-courier-event-totals";
import { computeMandoubTotalsForCourier } from "@/lib/mandoub-courier-totals";
import { mandoubOrderDetailInclude } from "@/lib/mandoub-order-queries";
import { hasCustomerLocationUrl } from "@/lib/order-location";
import { isReversePickupOrderType } from "@/lib/order-type-flags";
import {
  mandoubShopNameVividClass,
  orderStatusBadgeClassPrepaid,
} from "@/lib/order-status-style";
import { haversineMeters } from "@/lib/geo-distance";
import type { MandoubOrderSearchFields } from "@/lib/mandoub-order-smart-filter";
import { MandoubMoneySummarySection } from "./mandoub-money-summary-section";
import { MandoubOrdersSection } from "./mandoub-orders-client";
import { MandoubPresenceToggle } from "./mandoub-presence-toggle";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { MandoubAssignmentPoller } from "./mandoub-assignment-poller";
import { MandoubWebPushBanner } from "./mandoub-web-push-banner";
import type { MandoubRow } from "./mandoub-order-table";
import { DynamicIcon } from "@/components/dynamic-icon";
import { getGlobalIcons } from "@/lib/icon-settings";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "لوحة المندوب — أبو الأكبر للتوصيل",
};

/** حالات تظهر للمندوب في القائمة النشطة */
const STATUS_AR: Record<string, string> = {
  assigned: "لم يتم الاستلام",
  delivering: "تم الاستلام",
  delivered: "تم التسليم",
};

function normalizeDbStatus(status: string | null | undefined): string {
  return String(status ?? "")
    .trim()
    .toLowerCase();
}

function isMandoubActiveListStatus(status: string | null | undefined): boolean {
  const s = normalizeDbStatus(status);
  return s === "assigned" || s === "delivering" || s === "delivered";
}

function orderRegionCandidates(order: {
  customerRegionId: string | null;
  secondCustomerRegionId: string | null;
}): string[] {
  const out: string[] = [];
  if (order.customerRegionId) out.push(order.customerRegionId);
  if (order.secondCustomerRegionId && order.secondCustomerRegionId !== order.customerRegionId) {
    out.push(order.secondCustomerRegionId);
  }
  return out;
}

function invalidLinkMessage(reason: DelegatePortalVerifyReason): string {
  switch (reason) {
    case "bad_signature":
    case "missing":
      return "الرابط غير صالح أو انتهت صلاحيته. تأكد من فتح الرابط الأصلي من الواتساب.";
    case "no_secret":
      return "إعداد الخادم غير مكتمل. تواصل مع الإدارة.";
  }
}

type TabKey =
  | "assigned"
  | "delivering"
  | "delivered"
  | "checkSader"
  | "checkWard"
  | "check"
  | "all";

type Props = {
  searchParams: Promise<{
    c?: string;
    exp?: string;
    s?: string;
    tab?: string;
    wardFilter?: string;
    saderFilter?: string;
  }>;
};

export default async function MandoubPage({ searchParams }: Props) {
  const sp = await searchParams;
  const cookieStore = await cookies();

  const [icons, iconsResult] = await Promise.all([
    getGlobalIcons(),
    null // Placeholder for potential future parallel fetches
  ]);

  const c = sp.c || cookieStore.get("mandoub_c")?.value;
  const s = sp.s || cookieStore.get("mandoub_s")?.value;
  const exp = sp.exp || cookieStore.get("mandoub_exp")?.value;

  const v = verifyDelegatePortalQuery(c, exp, s);

  if (!v.ok) {
    return (
      <div dir="rtl" lang="ar" className="kse-app-bg px-4 py-16 text-slate-800">
        <div className="kse-app-inner mx-auto max-w-md">
          <div className="kse-glass-dark rounded-2xl border border-rose-300 p-8 text-center">
            <div className="mb-4 flex justify-center">
              <DynamicIcon config={icons.ui_error} fallback="❌" className="w-12 h-12 text-rose-600" />
            </div>
            <p className="text-lg font-bold text-rose-700">لا يمكن فتح لوحة المندوب</p>
            <p className="mt-2 text-sm text-slate-600">{invalidLinkMessage(v.reason)}</p>
          </div>
        </div>
      </div>
    );
  }

  const baseAuth = { c: c!, exp: exp || "", s: s! };
  const baseQuery = new URLSearchParams();
  if (baseAuth.c) baseQuery.set("c", baseAuth.c);
  if (baseAuth.exp) baseQuery.set("exp", baseAuth.exp);
  if (baseAuth.s) baseQuery.set("s", baseAuth.s);

  const wardFilter: "lower" | "higher" =
    sp.wardFilter === "higher" ? "higher" : "lower";
  const saderFilter: "lower" | "higher" =
    sp.saderFilter === "higher" ? "higher" : "lower";

  const tabRaw = sp.tab ?? "all";
  const tab: TabKey =
    tabRaw === "assigned" ||
    tabRaw === "delivering" ||
    tabRaw === "delivered" ||
    tabRaw === "checkSader" ||
    tabRaw === "checkWard" ||
    tabRaw === "check" ||
    tabRaw === "all"
      ? tabRaw
      : "all";

  const courier = await prisma.courier.findUnique({
    where: { id: v.courierId },
  });

  if (!courier || courier.blocked) {
    return (
      <div dir="rtl" lang="ar" className="kse-app-bg px-4 py-16 text-slate-800">
        <div className="kse-app-inner mx-auto max-w-md">
          <div className="kse-glass-dark rounded-2xl border border-rose-300 p-8 text-center">
            <div className="mb-4 flex justify-center">
              <DynamicIcon config={icons.ui_error} fallback="🚫" className="w-12 h-12 text-rose-800" />
            </div>
            <p className="text-lg font-bold text-rose-800">الحساب معطل أو غير موجود</p>
          </div>
        </div>
      </div>
    );
  }

  const activeOrdersRaw = await prisma.order.findMany({
    where: {
      status: { in: ["assigned", "delivering", "delivered"] },
      OR: [
        { assignedCourierId: courier.id },
        { courierEarningForCourierId: courier.id },
      ],
    },
    include: mandoubOrderDetailInclude,
    orderBy: { createdAt: "desc" },
  });

  const regionIds = Array.from(
    new Set(
      activeOrdersRaw.flatMap((o) => orderRegionCandidates(o)),
    ),
  );
  const regionWaypoints = regionIds.length
    ? await prisma.regionWaypoint.findMany({
        where: { regionId: { in: regionIds } },
        orderBy: [{ regionId: "asc" }, { sortOrder: "asc" }],
        select: { regionId: true, latitude: true, longitude: true },
      })
    : [];
  const waypointsByRegion = new Map<
    string,
    Array<{ latitude: number; longitude: number }>
  >();
  for (const point of regionWaypoints) {
    const arr = waypointsByRegion.get(point.regionId) ?? [];
    arr.push({ latitude: point.latitude, longitude: point.longitude });
    waypointsByRegion.set(point.regionId, arr);
  }

  const courierLat = courier.lastCourierLat;
  const courierLng = courier.lastCourierLng;
  const canSortByDistance = Number.isFinite(courierLat) && Number.isFinite(courierLng);
  const deliveringDistanceByOrderId = new Map<string, number>();
  if (canSortByDistance) {
    for (const order of activeOrdersRaw) {
      if (order.status !== "delivering") continue;
      const regionCandidates = orderRegionCandidates(order);
      let minDistance = Number.POSITIVE_INFINITY;
      for (const regionId of regionCandidates) {
        const points = waypointsByRegion.get(regionId) ?? [];
        for (const p of points) {
          const d = haversineMeters(
            Number(courierLat),
            Number(courierLng),
            p.latitude,
            p.longitude,
          );
          if (d < minDistance) minDistance = d;
        }
      }
      deliveringDistanceByOrderId.set(order.id, minDistance);
    }
  }

  const MANDOUB_STATUS_RANK: Record<string, number> = {
    assigned: 1,
    delivering: 2,
    delivered: 3,
  };

  const activeOrders = activeOrdersRaw
    .filter((o) => isMandoubActiveListStatus(o.status))
    .sort((a, b) => {
      const rA = MANDOUB_STATUS_RANK[a.status] ?? 99;
      const rB = MANDOUB_STATUS_RANK[b.status] ?? 99;
      if (rA !== rB) return rA - rB;
      if (a.status === "delivering" && b.status === "delivering") {
        const dA = deliveringDistanceByOrderId.get(a.id) ?? Number.POSITIVE_INFINITY;
        const dB = deliveringDistanceByOrderId.get(b.id) ?? Number.POSITIVE_INFINITY;
        if (dA !== dB) return dA - dB;
      }
      return b.orderNumber - a.orderNumber;
    });

  const totalsBaseline = courier.mandoubTotalsResetAt;

  // جلب مبالغ الطلبات فقط لضمان عدم تأثر "المتبقي" الرئيسي بالتحويلات
  const orderOnlySums = await fetchOrderOnlyMoneySumsForCourier(courier.id, totalsBaseline);

  const activeOrdersNorm = activeOrders.map((o) => ({
    ...o,
    moneyEvents: o.moneyEvents.map((e) => ({
      ...e,
      courierId: e.courierId ?? undefined,
    })),
  }));

  // جلب ملفات تعريف الزبائن للأرقام الموجودة في القائمة لضمان توفر اللوكيشنات المرجعية والسابقة
  const customerPhones = Array.from(new Set(activeOrders.map(o => o.customerPhone).filter(Boolean)));
  const phoneProfiles = await prisma.customerPhoneProfile.findMany({
    where: { phone: { in: customerPhones as string[] } },
    select: { phone: true, regionId: true, locationUrl: true, photoUrl: true }
  });

  const orderMetrics = computeMandoubTotalsForCourier(activeOrdersNorm, courier.id, totalsBaseline);

  // هنا نستخدم مبالغ الطلبات فقط في الواجهة الرئيسية
  const { sumDeliveryIn, sumPickupOut, remainingNet } = orderOnlySums;

  const filteredByTab = activeOrders.filter((o) => {
    if (!isMandoubActiveListStatus(o.status)) return false;
    if (tab === "all") return true;

    if (tab === "check" || tab === "checkSader") {
      const mismatch = isSaderMismatch(o.status, o.orderSubtotal, sumPickupOutFromOrderMoneyEvents(o.moneyEvents));
      if (tab === "check") return mismatch.hasMismatch || isWardMismatch(o.status, o.totalAmount, sumDeliveryInFromOrderMoneyEvents(o.moneyEvents)).hasMismatch;
      if (!mismatch.hasMismatch) return false;
      return saderFilter === "higher" ? mismatch.type === "excess" : mismatch.type === "deficit";
    }

    if (tab === "checkWard") {
      const mismatch = isWardMismatch(o.status, o.totalAmount, sumDeliveryInFromOrderMoneyEvents(o.moneyEvents));
      if (!mismatch.hasMismatch) return false;
      return wardFilter === "higher" ? mismatch.type === "excess" : mismatch.type === "deficit";
    }

    return o.status === tab;
  });

  const tableRows: MandoubRow[] = filteredByTab.map((o) => {
    const profile = phoneProfiles.find(p => p.phone === o.customerPhone && p.regionId === o.customerRegionId) ||
                    phoneProfiles.find(p => p.phone === o.customerPhone); // fallback to first matching phone if region doesn't match

    return {
      id: o.id,
      shortId: String(o.orderNumber),
      orderStatus: o.status,
      shopName: o.shop.name,
      shopNameHighlightClass: mandoubShopNameVividClass(o.status, o.prepaidAll),
      regionLine: o.customerRegion?.name?.trim() || "—",
      orderType: o.orderType || "—",
      priceStr: o.totalAmount != null ? formatDinarAsAlf(o.totalAmount) : "—",
      delStr: o.deliveryPrice != null ? formatDinarAsAlf(o.deliveryPrice) : "—",
      customerPhone: o.customerPhone || "—",
      timeLine: o.orderNoteTime?.trim() || o.createdAt.toLocaleString("ar-IQ-u-nu-latn", { dateStyle: "short", timeStyle: "short" }),
      statusAr: STATUS_AR[o.status] ?? o.status,
      statusClass: orderStatusBadgeClassPrepaid(o.status, o.prepaidAll),
      prepaidAll: o.prepaidAll,
      reversePickup: isReversePickupOrderType(o.orderType),
      hasCustomerLocation: hasCustomerLocationUrl(o.customerLocationUrl || profile?.locationUrl, o.customer?.customerLocationUrl),
      hasCourierUploadedLocation: Boolean(o.customerLocationSetByCourierAt),
      hasMoneyDeletedBadge: o.moneyEvents.some((e) => e.deletedAt && isManualDeletionReason(e.deletedReason)),
      wardMismatchType: isWardMismatch(o.status, o.totalAmount, sumDeliveryInFromOrderMoneyEvents(o.moneyEvents)).type,
      saderMismatchType: isSaderMismatch(o.status, o.orderSubtotal, sumPickupOutFromOrderMoneyEvents(o.moneyEvents)).type,
      pickupSumDinar: sumPickupOutFromOrderMoneyEvents(o.moneyEvents) != null
        ? Number(sumPickupOutFromOrderMoneyEvents(o.moneyEvents))
        : 0,
      deliverySumDinar: sumDeliveryInFromOrderMoneyEvents(o.moneyEvents) != null
        ? Number(sumDeliveryInFromOrderMoneyEvents(o.moneyEvents))
        : 0,
      orderSubtotalDinar: o.orderSubtotal != null ? Number(o.orderSubtotal) : null,
      totalAmountDinar: o.totalAmount != null ? Number(o.totalAmount) : null,
      noWardRecorded: sumDeliveryInFromOrderMoneyEvents(o.moneyEvents) == null,
      noSaderRecorded: sumPickupOutFromOrderMoneyEvents(o.moneyEvents) == null,
      createdAt: o.createdAt.toISOString(),
      // بيانات الوصول السريع
      audioUrl: o.voiceNoteUrl,
      summary: o.summary,
      shopPhone: o.shop.phone || o.submittedBy?.phone || o.submittedByCompanyPreparer?.phone,
      alternatePhone: o.alternatePhone,
      secondCustomerPhone: o.secondCustomerPhone,
      shopLocationUrl: o.shop.locationUrl,
      customerLocationUrl: o.customerLocationUrl || o.customer?.customerLocationUrl || profile?.locationUrl,
      secondCustomerLocationUrl: o.secondCustomerLocationUrl,
      shopDoorPhotoUrl: o.shopDoorPhotoUrl || o.shop.photoUrl,
      customerDoorPhotoUrl: o.customerDoorPhotoUrl || o.customer?.customerDoorPhotoUrl || profile?.photoUrl,
      secondCustomerDoorPhotoUrl: o.secondCustomerDoorPhotoUrl,
      routeMode: o.routeMode as any,
      preparerAudioUrl: (o.preparerShoppingJson as any)?.preparerAudioUrl || null,
      adminAudioUrl: o.adminVoiceNoteUrl,
    };
  });

  const searchFields: MandoubOrderSearchFields[] = filteredByTab.map((o) => ({
    id: o.id,
    orderNumber: o.orderNumber,
    orderType: o.orderType,
    customerPhone: o.customerPhone,
    alternatePhone: o.alternatePhone,
    secondCustomerPhone: o.secondCustomerPhone,
    summary: o.summary,
    customerLandmark: o.customerLandmark,
    secondCustomerLandmark: o.secondCustomerLandmark,
    orderNoteTime: o.orderNoteTime?.trim() ?? "",
    shopName: o.shop.name,
    regionName: o.customerRegion?.name ?? "",
    secondRegionName: o.secondCustomerRegion?.name ?? "",
    routeMode: o.routeMode,
    courierName: courier.name,
    adminOrderCode: o.adminOrderCode ?? "",
    submissionSource: o.submissionSource ?? "",
    customerLocationUrl: o.customerLocationUrl ?? "",
    customerLocationUploadedByName: o.customerLocationUploadedByName ?? "",
    secondCustomerLocationUrl: o.secondCustomerLocationUrl ?? "",
    secondCustomerDoorPhotoUploadedByName: o.secondCustomerDoorPhotoUploadedByName ?? "",
    customerDoorPhotoUploadedByName: o.customerDoorPhotoUploadedByName ?? "",
    orderImageUploadedByName: o.orderImageUploadedByName ?? "",
    shopDoorPhotoUploadedByName: o.shopDoorPhotoUploadedByName ?? "",
    preparerShoppingText: o.preparerShoppingJson != null ? JSON.stringify(o.preparerShoppingJson) : "",
    submittedByEmployeeName: o.submittedBy?.name ?? "",
    submittedByPreparerName: o.submittedByCompanyPreparer?.name ?? "",
  }));

  const tabBtnClass = (active: boolean) =>
    `shrink-0 whitespace-nowrap rounded-full px-4 py-2 text-sm font-bold transition ${
      active ? "bg-sky-600 text-white shadow-md ring-2 ring-sky-300" : "bg-white text-slate-700 border border-slate-200 hover:bg-slate-50"
    }`;

  const isChecking = tab === "check" || tab === "checkSader" || tab === "checkWard";

  return (
    <div dir="rtl" lang="ar" className="kse-app-bg min-h-screen text-base leading-relaxed text-slate-800">
      <div className="kse-app-inner mx-auto max-w-6xl px-2 py-2 pb-24 sm:px-4 sm:py-4 sm:text-lg">
        <header className="kse-glass-dark mb-3 flex items-center gap-2 border border-sky-200/90 px-3 py-2.5 shadow-sm">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <DynamicIcon config={icons.ui_user} fallback="" className="w-5 h-5 text-sky-600" />
              <p className="truncate text-base font-black text-slate-900 sm:text-lg dark:text-[#00f3ff]">أهلاً {courier.name}</p>
            </div>
            <p className="text-[10px] font-bold text-slate-500 sm:text-xs ms-7">{courier.phone}</p>
          </div>
          <ThemeSwitcher />
          <MandoubPresenceToggle auth={baseAuth} availableForAssignment={courier.availableForAssignment} />
          <Link href={`/mandoub/wallet?${baseQuery.toString()}`} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border-2 border-violet-500 bg-violet-600 px-3 py-2 text-center text-sm font-black text-white shadow-sm hover:bg-violet-700 sm:px-4 sm:text-base">
            <DynamicIcon config={icons.ui_wallet} fallback="" className="w-5 h-5" />
            المحفظة
          </Link>
        </header>

        <MandoubWebPushBanner auth={baseAuth} />
        <MandoubAssignmentPoller auth={baseAuth} />

        <MandoubMoneySummarySection
          totalsBaseline={totalsBaseline}
          sumDeliveryInDinar={Number(sumDeliveryIn)}
          sumPickupOutDinar={Number(sumPickupOut)}
          remainingNetDinar={Number(remainingNet)}
          sumEarningsDinar={Number(orderMetrics.sumEarnings)}
          courierVehicleType={courier.vehicleType}
          hrefWalletLedger={(l) => `/mandoub/wallet?${baseQuery.toString()}${l !== 'all' ? '&ledger=' + l : ''}`}
          hideTitle hideResetText
          showAdminBox={false}
        />

        <div className="mb-4 flex flex-col gap-3">
          <nav className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
            <Link href={`/mandoub?tab=all&${baseQuery.toString()}`} className={tabBtnClass(tab === "all")}>الكل</Link>
            <Link href={`/mandoub?tab=assigned&${baseQuery.toString()}`} className={tabBtnClass(tab === "assigned")}>لم يتم الاستلام</Link>
            <Link href={`/mandoub?tab=delivering&${baseQuery.toString()}`} className={tabBtnClass(tab === "delivering")}>تم الاستلام</Link>
            <Link href={`/mandoub?tab=delivered&${baseQuery.toString()}`} className={tabBtnClass(tab === "delivered")}>تم التسليم</Link>
            <Link href={`/mandoub?tab=check&${baseQuery.toString()}`} className={`${tabBtnClass(isChecking)} flex items-center gap-2`}>
              الفحص
              <DynamicIcon config={icons.ui_search} fallback="🔍" className="w-4 h-4" />
            </Link>
          </nav>

          {isChecking && (
            <div className="flex flex-wrap items-center gap-2 rounded-2xl bg-white/60 p-2 border border-sky-100 shadow-sm animate-in fade-in slide-in-from-top-1">
              <Link href={`/mandoub?tab=checkSader&${baseQuery.toString()}`} className={`rounded-full px-3 py-1.5 text-xs font-bold transition ${tab === "checkSader" ? "bg-emerald-600 text-white ring-2 ring-emerald-300" : "bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100"}`}>فحص الصادر</Link>
              <Link href={`/mandoub?tab=checkWard&${baseQuery.toString()}`} className={`rounded-full px-3 py-1.5 text-xs font-bold transition ${tab === "checkWard" ? "bg-rose-600 text-white ring-2 ring-rose-300" : "bg-rose-50 text-rose-800 border border-rose-200 hover:bg-rose-100"}`}>فحص الوارد</Link>
            </div>
          )}
        </div>

        {tab === "checkSader" && (
          <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl bg-white/50 p-2 border border-emerald-100 animate-in fade-in slide-in-from-right-2">
            <span className="text-xs font-bold text-slate-500 ms-1">فلترة الصادر:</span>
            <Link href={`/mandoub?tab=checkSader&saderFilter=lower&${baseQuery.toString()}`} className={`rounded-lg px-2.5 py-1 text-xs font-bold ${saderFilter === 'lower' ? 'bg-emerald-600 text-white' : 'bg-white text-emerald-700 border border-emerald-200'}`}>أقل من المتوقع</Link>
            <Link href={`/mandoub?tab=checkSader&saderFilter=higher&${baseQuery.toString()}`} className={`rounded-lg px-2.5 py-1 text-xs font-bold ${saderFilter === 'higher' ? 'bg-emerald-600 text-white' : 'bg-white text-emerald-700 border border-emerald-200'}`}>أكبر من المتوقع</Link>
          </div>
        )}

        {tab === "checkWard" && (
          <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl bg-white/50 p-2 border border-rose-100 animate-in fade-in slide-in-from-right-2">
            <span className="text-xs font-bold text-slate-500 ms-1">فلترة الوارد:</span>
            <Link href={`/mandoub?tab=checkWard&wardFilter=lower&${baseQuery.toString()}`} className={`rounded-lg px-2.5 py-1 text-xs font-bold ${wardFilter === 'lower' ? 'bg-rose-600 text-white' : 'bg-white text-rose-700 border border-rose-200'}`}>أقل من المتوقع</Link>
            <Link href={`/mandoub?tab=checkWard&wardFilter=higher&${baseQuery.toString()}`} className={`rounded-lg px-2.5 py-1 text-xs font-bold ${wardFilter === 'higher' ? 'bg-rose-600 text-white' : 'bg-white text-rose-700 border border-rose-200'}`}>أكبر من المتوقع</Link>
          </div>
        )}

        <section className="kse-glass-dark overflow-hidden border border-sky-200 shadow-sm">
          <MandoubOrdersSection allRows={tableRows} searchFields={searchFields} auth={baseAuth} tab={tab} />
        </section>
      </div>
    </div>
  );
}
