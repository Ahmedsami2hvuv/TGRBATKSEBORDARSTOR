import Link from "next/link";
import { cookies } from "next/headers";
import { formatDinarAsAlf } from "@/lib/money-alf";
import { prisma } from "@/lib/prisma";
import { Decimal } from "@prisma/client/runtime/library";
import type { DelegatePortalVerifyReason } from "@/lib/delegate-link";
import { getPublicAppUrl } from "@/lib/app-url";
import { buildDelegatePortalUrl, verifyDelegatePortalQuery } from "@/lib/delegate-link";
import { getBotTokenByPurpose } from "@/lib/telegram-bots";
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
import { computeMandoubAdminTotalAllTimeDinar } from "@/lib/mandoub-wallet-carry";
import { mandoubOrderDetailInclude, mandoubOrderListInclude } from "@/lib/mandoub-order-queries";
import { extractLatLngFromLocationInput, hasCustomerLocationUrl } from "@/lib/order-location";
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
import { FullscreenWalletLauncher } from "@/components/fullscreen-wallet-launcher";
import { mandoubOrdersStampSig } from "@/lib/mandoub-order-stamps";
import { randomBytes } from "crypto";
import { fetchWalletInOutDisplayForCourier, resolvePartyDisplayName } from "@/lib/wallet-peer-transfer";
import { filterLedgerByRecentDays } from "@/lib/money-entry-ui";
import { LEDGER_KIND_TRANSFER_PENDING_IN, LEDGER_KIND_TRANSFER_PENDING_OUT, MISC_LEDGER_KIND_GIVE, MISC_LEDGER_KIND_TAKE, MONEY_KIND_DELIVERY, MONEY_KIND_PICKUP } from "@/lib/mandoub-money-events";
import { getUISettings } from "@/lib/ui-settings";
import type { MandoubWalletLedgerLine } from "./mandoub-wallet-client";

// هذه الصفحة تعتمد على searchParams + cookies، لذلك يجب أن تكون ديناميكية دائماً.
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
  try {
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

  const botToken = await getBotTokenByPurpose("courier");
  const botInfo = botToken ? await fetch(`https://api.telegram.org/bot${botToken}/getMe`).then(r => r.json()).catch(() => null) : null;
  const botUsername = botInfo?.result?.username;
  const portalUrl = buildDelegatePortalUrl(courier.id, getPublicAppUrl());

  let telegramLink = null;
  if (botUsername) {
    const botStartParam = `pl_${randomBytes(8).toString("hex")}`;
    try {
      await prisma.schemaPlaceholder.create({
        data: {
          id: botStartParam,
          note: portalUrl,
        },
      });
    } catch (err) {
      console.error("[MandoubPage] Failed to create telegram placeholder", err);
    }
    telegramLink = `https://t.me/${botUsername}?start=${botStartParam}`;
  }

  // تنظيف دوري للروابط القديمة (5% من الطلبات)
  if (Math.random() < 0.05) {
    const twoDaysAgo = new Date(Date.now() - 48 * 60 * 60 * 1000);
    prisma.schemaPlaceholder.deleteMany({
      where: { id: { startsWith: "pl_" }, createdAt: { lt: twoDaysAgo } }
    }).catch(() => {});
  }

  const totalsBaseline = courier.mandoubTotalsResetAt;

  const [
    activeOrdersRaw,
    orderOnlySums,
    handToAdmin,
    walletInOutDisplay,
    rawMisc,
    transferTargetCouriers,
    companyPreparers,
    pendingIncomingTransfers,
    pendingOutgoingCount,
    recentTransfers,
    courierTips,
    walletUiSettings,
  ] = await Promise.all([
    prisma.order.findMany({
      where: {
        status: { in: ["assigned", "delivering", "delivered"] },
        OR: [
          { assignedCourierId: courier.id },
          { courierEarningForCourierId: courier.id },
        ],
      },
      include: mandoubOrderListInclude,
      orderBy: { createdAt: "desc" },
      take: 150,
    }),
    fetchOrderOnlyMoneySumsForCourier(courier.id, totalsBaseline),
    computeMandoubAdminTotalAllTimeDinar(courier.id),
    fetchWalletInOutDisplayForCourier(courier.id, totalsBaseline),
    prisma.courierWalletMiscEntry.findMany({
      where: { courierId: courier.id },
      orderBy: { createdAt: "desc" },
    }),
    prisma.courier.findMany({
      where: { blocked: false, id: { not: courier.id } },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.companyPreparer.findMany({
      where: { active: true, walletEmployeeId: { not: null } },
      select: { id: true, name: true, walletEmployeeId: true, phone: true },
      orderBy: { name: "asc" },
    }),
    prisma.walletPeerTransfer.findMany({
      where: { toCourierId: courier.id, status: "pending" },
      orderBy: { createdAt: "desc" },
    }),
    prisma.walletPeerTransfer.count({
      where: { fromCourierId: courier.id, status: "pending" },
    }),
    prisma.walletPeerTransfer.findMany({
      where: {
        OR: [{ fromCourierId: courier.id }, { toCourierId: courier.id }],
      },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    prisma.courierTip.findMany({
      where: { courierId: courier.id },
      orderBy: { createdAt: "desc" },
    }),
    getUISettings("mandoub", "wallet_block"),
  ]);

  const ordersForWallet = activeOrdersRaw.map((o) => ({
    ...o,
    moneyEvents: o.moneyEvents.map((e) => ({
      ...e,
      courierId: e.courierId ?? undefined,
    })),
  }));

  // حساب الإكراميات والأرباح (اليومية والشهرية)
  const now = new Date();
  let todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 5, 0, 0, 0);
  if (now < todayStart) {
    todayStart = new Date(todayStart.getTime() - 24 * 60 * 60 * 1000);
  }
  const todayStartFinal = todayStart;

  let monthlyCycleStart = new Date(now.getFullYear(), now.getMonth(), 1, 5, 0, 0, 0);
  if (now < monthlyCycleStart) {
    monthlyCycleStart = new Date(now.getFullYear(), now.getMonth() - 1, 1, 5, 0, 0, 0);
  }
  const monthlyCycleStartFinal = monthlyCycleStart;

  let tipDailySum = new Decimal(0);
  let tipMonthlySum = new Decimal(0);

  for (const t of courierTips) {
    if (t.createdAt >= todayStartFinal) tipDailySum = tipDailySum.plus(t.amountDinar);
    if (t.createdAt >= monthlyCycleStartFinal) tipMonthlySum = tipMonthlySum.plus(t.amountDinar);
  }

  for (const m of rawMisc) {
    if (m.label.includes("[إكرامية]") && m.direction === "take" && m.deletedAt == null) {
      if (m.createdAt >= todayStartFinal) tipDailySum = tipDailySum.plus(m.amountDinar);
      if (m.createdAt >= monthlyCycleStartFinal) tipMonthlySum = tipMonthlySum.plus(m.amountDinar);
    }
  }

  const orderMetricsMonthly = computeMandoubTotalsForCourier(ordersForWallet, courier.id, monthlyCycleStartFinal, false);
  const orderMetricsBaseline = computeMandoubTotalsForCourier(ordersForWallet, courier.id, totalsBaseline, false);

  const deliveryEarningsSinceBaseline = new Decimal(orderMetricsBaseline.sumEarnings);
  const cashInHand = deliveryEarningsSinceBaseline.plus(handToAdmin);
  const cashInHandStr = formatDinarAsAlf(cashInHand);

  const walletRemain = walletInOutDisplay.walletIn.minus(walletInOutDisplay.walletOut);
  const availableForTransfer = cashInHand.plus(walletRemain).minus(walletInOutDisplay.pendingOutgoing);

  const pendingIncomingForUi = await Promise.all(
    pendingIncomingTransfers.map(async (p) => ({
      id: p.id,
      amountDinar: p.amountDinar.toNumber(),
      fromLabel: await resolvePartyDisplayName(p.fromKind, p.fromCourierId, p.fromEmployeeId),
      handoverLocation: p.handoverLocation,
      createdAt: p.createdAt.toISOString(),
    })),
  );

  const walletLedger: MandoubWalletLedgerLine[] = [
    ...ordersForWallet.flatMap((o) =>
      o.moneyEvents
        .filter((e) => e.courierId === courier.id && e.deletedAt == null && !e.recordedByCompanyPreparerId)
        .map((e) => ({
          source: "order" as const,
          id: e.id,
          kind: e.kind,
          amountDinar: Number(e.amountDinar),
          createdAt: e.createdAt.toISOString(),
          orderId: o.id,
          orderNumber: o.orderNumber,
          shopName: o.shop?.name || "محل",
          regionName: o.customerRegion?.name || o.shop?.region?.name,
          orderNotes: o.summary,
          miscLabel: null,
          deletedAt: e.deletedAt?.toISOString() ?? null,
          deletedReason: e.deletedReason as any,
          deletedByDisplayName: null,
          expectedDinar:
            e.kind === MONEY_KIND_DELIVERY
              ? Number(o.totalAmount)
              : Number(o.orderSubtotal),
        })),
    ),
    ...rawMisc.map((m) => ({
      source: "misc" as const,
      id: m.id,
      kind: m.direction === "take" ? MISC_LEDGER_KIND_TAKE : MISC_LEDGER_KIND_GIVE,
      amountDinar: Number(m.amountDinar),
      createdAt: m.createdAt.toISOString(),
      orderId: "",
      orderNumber: 0,
      shopName: "",
      miscLabel: m.label,
      deletedAt: m.deletedAt?.toISOString() ?? null,
      deletedReason: m.deletedReason as any,
      deletedByDisplayName: null,
    })),
    ...recentTransfers
      .filter((t) => t.status === "pending" || t.status === "rejected")
      .map((t) => ({
        source: t.status === "rejected" ? ("transfer_rejected" as const) : ("transfer_pending" as const),
        id: t.id,
        kind:
          t.fromCourierId === courier.id
            ? t.status === "rejected"
              ? "transfer_rejected_out"
              : LEDGER_KIND_TRANSFER_PENDING_OUT
            : t.status === "rejected"
            ? "transfer_rejected_in"
            : LEDGER_KIND_TRANSFER_PENDING_IN,
        amountDinar: Number(t.amountDinar),
        createdAt: t.createdAt.toISOString(),
        orderId: "",
        orderNumber: 0,
        shopName: "",
        miscLabel: t.handoverLocation,
        deletedAt: null,
        deletedReason: null,
        deletedByDisplayName: null,
      })),
  ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const safeWalletLedger = JSON.parse(JSON.stringify(filterLedgerByRecentDays(walletLedger)));
  const safePendingIncoming = JSON.parse(JSON.stringify(pendingIncomingForUi));
  const safeTransferTargetCouriers = JSON.parse(JSON.stringify(transferTargetCouriers));
  const safeCompanyPreparers = JSON.parse(JSON.stringify(companyPreparers));
  const safeWalletUiSettings = JSON.parse(JSON.stringify(walletUiSettings));

  const walletData = {
    walletPathWithQuery: `/mandoub/wallet?${baseQuery.toString()}`,
    walletLedgerHrefs: {
      site: `/mandoub/wallet?${baseQuery.toString()}&ledger=site`,
      ward: `/mandoub/wallet?${baseQuery.toString()}&ledger=ward`,
      sader: `/mandoub/wallet?${baseQuery.toString()}&ledger=sader`,
      all: `/mandoub/wallet?${baseQuery.toString()}&ledger=all`,
    },
    siteRemainingNetStr: formatDinarAsAlf(orderOnlySums.remainingNet),
    walletInFromWalletStr: formatDinarAsAlf(walletInOutDisplay.walletIn),
    walletOutFromWalletStr: formatDinarAsAlf(walletInOutDisplay.walletOut),
    pendingIncomingTransferStr: formatDinarAsAlf(walletInOutDisplay.pendingIncoming),
    pendingOutgoingTransferStr: formatDinarAsAlf(walletInOutDisplay.pendingOutgoing),
    sumEarningsStr: formatDinarAsAlf(deliveryEarningsSinceBaseline),
    walletRemainStr: formatDinarAsAlf(walletRemain),
    handToAdminStr: formatDinarAsAlf(handToAdmin),
    cashInHandStr: cashInHandStr,
    earningsDailyStr: formatDinarAsAlf(tipDailySum),
    earningsMonthlyStr: formatDinarAsAlf(tipMonthlySum),
    ledger: safeWalletLedger,
    pendingIncoming: safePendingIncoming,
    transferTargetCouriers: safeTransferTargetCouriers,
    transferTargetEmployees: safeCompanyPreparers.map((p: any) => ({
      id: p.walletEmployeeId,
      name: p.name,
      shopName: "",
      phone: p.phone,
    })),
    availableForTransferStr: formatDinarAsAlf(availableForTransfer),
    pendingOutgoingCount: pendingOutgoingCount,
    uiSettings: safeWalletUiSettings,
  };

  const regionIds = Array.from(
    new Set(
      activeOrdersRaw.flatMap((o) => orderRegionCandidates(o)),
    ),
  );
  const regionWaypoints = regionIds.length
    ? await prisma.regionWaypoint.findMany({
        where: { regionId: { in: regionIds } },
        orderBy: [{ regionId: "asc" }, { sortOrder: "asc" }],
        select: { regionId: true, name: true, latitude: true, longitude: true },
      })
    : [];
  const waypointsByRegion = new Map<
    string,
    Array<{ name: string; latitude: number; longitude: number }>
  >();
  for (const point of regionWaypoints) {
    const arr = waypointsByRegion.get(point.regionId) ?? [];
    arr.push({ name: point.name, latitude: point.latitude, longitude: point.longitude });
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

  const listOrdersStampSig = mandoubOrdersStampSig(
    activeOrdersRaw.map((o) => ({ id: o.id, updatedAt: o.updatedAt })),
  );

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

  const activeOrderMetrics = computeMandoubTotalsForCourier(activeOrdersNorm, courier.id, totalsBaseline);
  const activeCashInHand = new Decimal(activeOrderMetrics.sumEarnings).plus(handToAdmin);
  const activeCashInHandStr = formatDinarAsAlf(activeCashInHand);

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

  function computeSmartHint(params: {
    locationUrl: string;
    fallbackLandmark?: string | null;
    regionId?: string | null;
  }): string {
    const fallback = String(params.fallbackLandmark ?? "").trim();
    const regionId = params.regionId ?? null;
    if (!regionId) return "— لا توجد منطقة مرتبطة بالطلب";
    const points = waypointsByRegion.get(regionId) ?? [];
    if (points.length === 0) return "— لا توجد مداخل محفوظة لهذه المنطقة";
    if (!String(params.locationUrl || "").trim()) {
      return fallback ? `قريب من (${fallback})` : "— لا يوجد لوكيشن للزبون";
    }
    const customerLoc = extractLatLngFromLocationInput(params.locationUrl);
    if (!customerLoc) return fallback ? `قريب من (${fallback})` : "— تعذر قراءة إحداثيات الرابط";

    let nearest: { name: string; distanceM: number } | null = null;
    for (const p of points) {
      const distanceM = haversineMeters(
        customerLoc.latitude,
        customerLoc.longitude,
        p.latitude,
        p.longitude,
      );
      if (!nearest || distanceM < nearest.distanceM) {
        nearest = { name: p.name?.trim() || "مدخل", distanceM };
      }
    }
    if (!nearest) return fallback ? `قريب من (${fallback})` : "— تعذر احتساب أقرب مدخل";
    if (nearest.distanceM > 2500) return "— اللوكيشن بعيد عن مداخل المنطقة";
    return `قريب من (${nearest.name})`;
  }

  const phoneProfilesByKey = new Map<string, (typeof phoneProfiles)[number]>();
  const phoneProfilesByPhone = new Map<string, (typeof phoneProfiles)[number]>();
  for (const profile of phoneProfiles) {
    const key = `${profile.phone}::${profile.regionId ?? ""}`;
    if (!phoneProfilesByKey.has(key)) phoneProfilesByKey.set(key, profile);
    if (!phoneProfilesByPhone.has(profile.phone)) phoneProfilesByPhone.set(profile.phone, profile);
  }

  const smartHintByOrderId = new Map<string, string | null>();
  for (const o of filteredByTab) {
    const profile = phoneProfilesByKey.get(`${o.customerPhone}::${o.customerRegionId ?? ""}`) ?? phoneProfilesByPhone.get(o.customerPhone);
    const mergedCustomerLocation =
      o.customerLocationUrl || o.customer?.customerLocationUrl || profile?.locationUrl || "";
    const hint = computeSmartHint({
      locationUrl: mergedCustomerLocation,
      fallbackLandmark: o.customerLandmark || o.customer?.customerLandmark,
      regionId: o.customerRegionId,
    });
    smartHintByOrderId.set(o.id, hint);
  }

  const tableRows: MandoubRow[] = filteredByTab.map((o) => {
    const profile =
      phoneProfilesByKey.get(`${o.customerPhone}::${o.customerRegionId ?? ""}`) ??
      phoneProfilesByPhone.get(o.customerPhone); // fallback to first matching phone if region doesn't match

    const mergedCustomerLocation =
      o.customerLocationUrl || o.customer?.customerLocationUrl || profile?.locationUrl || "";
    const smartHintLine = smartHintByOrderId.get(o.id) ?? "—";

    return {
      id: o.id,
      shortId: String(o.orderNumber),
      orderStatus: o.status,
      shopName: o.shop.name,
      shopNameHighlightClass: mandoubShopNameVividClass(o.status, o.prepaidAll),
      regionLine: o.customerRegion?.name?.trim() || "—",
      landmarkLine: (o.customerLandmark || o.customer?.customerLandmark || "").trim() || null,
      smartHintLine,
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
      customerLocationUrl: mergedCustomerLocation,
      secondCustomerLocationUrl: o.secondCustomerLocationUrl,
      shopDoorPhotoUrl: o.shopDoorPhotoUrl || o.shop.photoUrl,
      customerDoorPhotoUrl: o.customer?.customerDoorPhotoUrl || profile?.photoUrl || o.customerDoorPhotoUrl,
      secondCustomerDoorPhotoUrl: o.secondCustomerDoorPhotoUrl,
      routeMode: o.routeMode as any,
      preparerAudioUrl: (o.preparerShoppingJson as any)?.preparerAudioUrl || null,
      adminAudioUrl: o.adminVoiceNoteUrl,
      showDoorBtn: courier.showDoorBtn,
      showLocationBtn: courier.showLocationBtn,
      showCallBtn: courier.showCallBtn,
      showWhatsAppBtn: courier.showWhatsAppBtn,
      showNotesBtn: courier.showNotesBtn,
      showVoiceNotesBtn: courier.showVoiceNotesBtn,
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
    // مهم لدعم البحث بالتاريخ والوقت داخل لوحة المندوب
    createdAtIso: o.createdAt.toISOString(),
  }));

  // تحويل البيانات إلى JSON لضمان التوافق مع Next.js 15 (Serialization safety)
  const safeTableRows = JSON.parse(JSON.stringify(tableRows)) as typeof tableRows;
  const safeSearchFields = JSON.parse(JSON.stringify(searchFields)) as typeof searchFields;

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
                <p className="truncate text-base font-black text-slate-900 sm:text-lg dark:text-[#00f3ff]">{courier.name}</p>
              </div>
              <p className="text-[10px] font-bold text-slate-500 sm:text-xs ms-7">{courier.phone}</p>
            </div>
            <ThemeSwitcher />
            {telegramLink && (
              <a
                href={telegramLink}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#229ED9] text-white shadow-sm ring-1 ring-[#1b8bc2] transition hover:bg-[#1b8bc2] sm:h-9 sm:w-9"
                title="فتح بوت التليجرام"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69.01-.03.01-.14-.07-.2-.08-.06-.19-.04-.27-.02-.11.02-1.93 1.23-5.46 3.62-.51.35-.98.52-1.4.51-.46-.01-1.35-.26-2.01-.48-.81-.27-1.45-.42-1.39-.88.03-.24.36-.48.99-.73 3.88-1.69 6.47-2.8 7.77-3.33 3.7-1.51 4.47-1.77 4.97-1.78.11 0 .36.03.52.16.14.12.18.28.19.45.01.06.01.12 0 .19z" />
                </svg>
              </a>
            )}
            <MandoubPresenceToggle auth={baseAuth} availableForAssignment={courier.availableForAssignment} />
            <FullscreenWalletLauncher
              href={`/mandoub/wallet?${baseQuery.toString()}`}
              className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border-2 border-violet-500 bg-violet-600 px-3 py-2 text-center text-sm font-black text-white shadow-sm hover:bg-violet-700 sm:px-4 sm:text-base"
              title="محفظة المندوب"
            >
              <span>المحفظة</span>
              <span className="rounded-lg bg-violet-500 px-2 py-0.5 text-xs font-black text-white">
                {cashInHandStr}
              </span>
            </FullscreenWalletLauncher>
          </header>

          <MandoubWebPushBanner auth={baseAuth} />
          <MandoubAssignmentPoller auth={baseAuth} />
          <MandoubMoneySummarySection
            totalsBaseline={totalsBaseline}
            sumDeliveryInDinar={Number(sumDeliveryIn)}
            sumPickupOutDinar={Number(sumPickupOut)}
            remainingNetDinar={Number(remainingNet)}
            sumEarningsDinar={Number(activeOrderMetrics.sumEarnings)}
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
            <MandoubOrdersSection
              allRows={safeTableRows}
              searchFields={safeSearchFields}
              auth={baseAuth}
              tab={tab}
              listOrdersStampSig={listOrdersStampSig}
              walletData={walletData}
            />
          </section>
        </div>
      </div>
    );
  } catch (error) {
    console.error("[MandoubPage] Unexpected render error", error);
    return (
      <div dir="rtl" lang="ar" className="kse-app-bg px-4 py-16 text-slate-800">
        <div className="kse-app-inner mx-auto max-w-md">
          <div className="kse-glass-dark rounded-2xl border border-rose-300 p-8 text-center">
            <p className="text-lg font-bold text-rose-700">تعذر فتح لوحة المندوب حالياً</p>
            <p className="mt-2 text-sm text-slate-600">
              صارت مشكلة داخلية مؤقتة. أعد تحميل الصفحة، وإذا استمرت تواصل مع الإدارة.
            </p>
          </div>
        </div>
      </div>
    );
  }
}
