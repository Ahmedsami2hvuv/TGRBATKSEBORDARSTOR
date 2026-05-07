import { cookies } from "next/headers";
import { WalletPeerPartyKind } from "@prisma/client";
import type { DelegatePortalVerifyReason } from "@/lib/delegate-link";
import { verifyDelegatePortalQuery } from "@/lib/delegate-link";
import { isCourierPortalBlocked } from "@/lib/courier-delegate-access";
import { formatDinarAsAlf, formatDinarAsAlfWithUnit } from "@/lib/money-alf";
import { Decimal } from "@prisma/client/runtime/library";
import {
  fetchMandoubMoneySumsForCourier,
  fetchOrderOnlyMoneySumsForCourier,
} from "@/lib/mandoub-courier-event-totals";
import { computeMandoubTotalsForCourier } from "@/lib/mandoub-courier-totals";
import {
  computeMandoubAdminTotalAllTimeDinar,
} from "@/lib/mandoub-wallet-carry";
import { mandoubOrderDetailInclude } from "@/lib/mandoub-order-queries";
import { prisma } from "@/lib/prisma";
import {
  LEDGER_KIND_TRANSFER_PENDING_IN,
  LEDGER_KIND_TRANSFER_PENDING_OUT,
  MISC_LEDGER_KIND_GIVE,
  MISC_LEDGER_KIND_TAKE,
  MONEY_KIND_DELIVERY,
  MONEY_KIND_PICKUP,
} from "@/lib/mandoub-money-events";
import {
  fetchWalletInOutDisplayForCourier,
  resolvePartyDisplayName,
  sumPendingOutgoingForCourier,
} from "@/lib/wallet-peer-transfer";
import { filterLedgerByRecentDays } from "@/lib/money-entry-ui";
import {
  MandoubWalletClient,
  type MandoubWalletLedgerLine,
} from "../mandoub-wallet-client";
import { getUISettings } from "@/lib/ui-settings";
import { computeCourierDeliveryEarningDinar } from "@/lib/courier-earnings";
import { MandoubWalletBackButton } from "./mandoub-wallet-back-button";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "المحفظة — المندوب",
};

function invalidLinkMessage(reason: DelegatePortalVerifyReason): string {
  switch (reason) {
    case "bad_signature":
    case "missing":
      return "الرابط غير صالح أو تالف. تأكد من فتح الرابط الأصلي من الواتساب.";
    case "no_secret":
      return "إعداد الخادم غير مكتمل. تواصل مع الإدارة.";
  }
}

type LedgerFilter = "ward" | "sader" | "site" | "all";

type Props = {
  searchParams: Promise<{ c?: string; exp?: string; s?: string; ledger?: string }>;
};

export default async function MandoubWalletPage({ searchParams }: Props) {
  const sp = await searchParams;
  const cookieStore = await cookies();

  const c = sp.c || cookieStore.get("mandoub_c")?.value;
  const s = sp.s || cookieStore.get("mandoub_s")?.value;
  const exp = sp.exp || cookieStore.get("mandoub_exp")?.value;

  const v = verifyDelegatePortalQuery(c, exp, s);

  if (!v.ok) {
    return (
      <div dir="rtl" lang="ar" className="kse-app-bg px-4 py-16 text-slate-800">
        <div className="kse-app-inner mx-auto max-w-md">
          <div className="kse-glass-dark rounded-2xl border border-rose-300 p-8 text-center">
            <p className="text-lg font-bold text-rose-700">لا يمكن فتح المحفظة</p>
            <p className="mt-2 text-sm text-slate-600">{invalidLinkMessage(v.reason)}</p>
          </div>
        </div>
      </div>
    );
  }

  if (await isCourierPortalBlocked(v.courierId)) {
    return (
      <div dir="rtl" lang="ar" className="kse-app-bg px-4 py-16 text-slate-800">
        <div className="kse-app-inner mx-auto max-w-md">
          <div className="kse-glass-dark rounded-2xl border border-rose-300 p-8 text-center">
            <p className="text-lg font-bold text-rose-700">الحساب محظور</p>
          </div>
        </div>
      </div>
    );
  }

  const courier = await prisma.courier.findUnique({
    where: { id: v.courierId },
  });
  if (!courier) {
    return (
      <div dir="rtl" lang="ar" className="kse-app-bg px-4 py-16 text-slate-800">
        <div className="kse-app-inner mx-auto max-w-md">
          <div className="kse-glass-dark rounded-2xl p-8 text-center">
            <p className="text-lg font-bold text-slate-800">لم يُعثر على المندوب</p>
          </div>
        </div>
      </div>
    );
  }

  const baseAuth = { c: c!, exp: exp || "", s: s! };
  const authQuery = new URLSearchParams();
  if (baseAuth.c) authQuery.set("c", baseAuth.c);
  if (baseAuth.exp) authQuery.set("exp", baseAuth.exp);
  if (baseAuth.s) authQuery.set("s", baseAuth.s);

  const ledgerRaw = (sp.ledger ?? "").trim().toLowerCase();
  const ledgerFilter: LedgerFilter =
    ledgerRaw === "ward" || ledgerRaw === "sader" || ledgerRaw === "site"
      ? ledgerRaw
      : "all";

  const walletQuery = new URLSearchParams(authQuery);
  if (ledgerFilter !== "all") walletQuery.set("ledger", ledgerFilter);

  const walletPathWithQuery = `/mandoub/wallet?${walletQuery.toString()}`;
  const hrefMain = `/mandoub?${authQuery.toString()}`;

  function hrefWalletLedger(ledger: LedgerFilter): string {
    const p = new URLSearchParams(authQuery);
    if (ledger !== "all") p.set("ledger", ledger);
    return `/mandoub/wallet?${p.toString()}`;
  }

  const totalsBaseline = courier.mandoubTotalsResetAt;
  const [
    moneySums,
    orderOnlySums,
    walletInOutDisplay,
    adminTotalAllTime,
    orders,
    rawMisc,
    transferTargetCouriers,
    companyPreparers,
    pendingIncomingTransfers,
    pendingOutgoingCount,
    recentTransfers,
    courierTips,
  ] = await Promise.all([
    fetchMandoubMoneySumsForCourier(courier.id, totalsBaseline),
    fetchOrderOnlyMoneySumsForCourier(courier.id, totalsBaseline),
    fetchWalletInOutDisplayForCourier(courier.id, totalsBaseline),
    computeMandoubAdminTotalAllTimeDinar(courier.id),
    prisma.order.findMany({
      where: {
        status: { in: ["assigned", "delivering", "delivered", "archived"] },
        OR: [
          { assignedCourierId: courier.id },
          { courierEarningForCourierId: courier.id },
        ],
      },
      include: mandoubOrderDetailInclude,
      orderBy: { createdAt: "desc" },
    }),
    prisma.courierWalletMiscEntry.findMany({
      where: {
        courierId: courier.id,
      },
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
        OR: [
          { fromCourierId: courier.id },
          { toCourierId: courier.id }
        ]
      },
      orderBy: { createdAt: "desc" },
      take: 20
    }),
    prisma.courierTip.findMany({
      where: { courierId: courier.id },
      orderBy: { createdAt: "desc" }
    })
  ]);

  const ordersNorm = orders.map((o) => ({
    ...o,
    moneyEvents: o.moneyEvents.map((e) => ({
      ...e,
      courierId: e.courierId ?? undefined,
    })),
  }));

  // حساب الإكراميات والأرباح (اليومية والشهرية)
  const now = new Date();

  // بداية اليوم (الساعة 5 صباحاً) - مقيدة بالتصفير
  let todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 5, 0, 0, 0);
  if (now < todayStart) {
    todayStart = new Date(todayStart.getTime() - 24 * 60 * 60 * 1000);
  }
  const todayStartFinal = todayStart;

  // بداية الشهر (يوم 1 الساعة 5 صباحاً) - مقيدة بالتصفير
  let monthlyCycleStart = new Date(now.getFullYear(), now.getMonth(), 1, 5, 0, 0, 0);
  if (now < monthlyCycleStart) {
    monthlyCycleStart = new Date(now.getFullYear(), now.getMonth() - 1, 1, 5, 0, 0, 0);
  }
  const monthlyCycleStartFinal = monthlyCycleStart;

  let tipDailySum = new Decimal(0);
  let tipMonthlySum = new Decimal(0);

  // 1. حساب الإكراميات من جدول CourierTip
  for (const t of courierTips) {
    if (t.createdAt >= todayStartFinal) {
      tipDailySum = tipDailySum.plus(t.amountDinar);
    }
    if (t.createdAt >= monthlyCycleStartFinal) {
      tipMonthlySum = tipMonthlySum.plus(t.amountDinar);
    }
  }

  // 2. حساب الإكراميات من القيود اليدوية
  for (const m of rawMisc) {
    if (m.label.includes("[إكرامية]") && m.direction === "take" && m.deletedAt == null) {
      if (m.createdAt >= todayStartFinal) {
        tipDailySum = tipDailySum.plus(m.amountDinar);
      }
      if (m.createdAt >= monthlyCycleStartFinal) {
        tipMonthlySum = tipMonthlySum.plus(m.amountDinar);
      }
    }
  }

  const orderMetricsToday = computeMandoubTotalsForCourier(ordersNorm, courier.id, todayStartFinal, false);
  const orderMetricsMonthly = computeMandoubTotalsForCourier(ordersNorm, courier.id, monthlyCycleStartFinal, false);
  const orderMetricsBaseline = computeMandoubTotalsForCourier(ordersNorm, courier.id, totalsBaseline, false);

  const siteRemainingNet = orderOnlySums.remainingNet;

  // 💰 أرباحي: أجور التوصيل من الطلبات منذ التصفير
  const deliveryEarningsSinceBaseline = orderMetricsBaseline.sumEarnings;

  // 🏛 للإدارة: المبلغ التراكمي (لا يتصفر)
  const handToAdmin = adminTotalAllTime;

  // 💵 عندي: ناتجة من (أرباحي + للإدارة) حسب منطقك
  const cashInHand = deliveryEarningsSinceBaseline.plus(handToAdmin);

  // الراتب العلوي (بجانب كلمة محفظة): أرباح الشهر + إكراميات الشهر
  const monthlySalaryTotal = orderMetricsMonthly.sumEarnings.plus(tipMonthlySum);

  // 💰 متبقي: ناتجة من (وارد - صادر) للحركات اليدوية والتحويلات
  const walletRemain = walletInOutDisplay.walletIn.minus(walletInOutDisplay.walletOut);

  const pendingIncomingForUi = await Promise.all(
    pendingIncomingTransfers.map(async (p) => ({
      id: p.id,
      amountDinar: p.amountDinar.toNumber(),
      fromLabel: await resolvePartyDisplayName(p.fromKind, p.fromCourierId, p.fromEmployeeId),
      handoverLocation: p.handoverLocation,
      createdAt: p.createdAt.toISOString(),
    }))
  );

  const ledger: MandoubWalletLedgerLine[] = [
    ...ordersNorm.flatMap((o) =>
      o.moneyEvents
        .filter((e) => e.courierId === courier.id && e.deletedAt == null && !e.recordedByCompanyPreparerId)
        .map((e) => ({
          source: "order" as const,
          id: e.id,
          kind: e.kind,
          amountDinar: (e.amountDinar as any).toNumber ? (e.amountDinar as any).toNumber() : Number(e.amountDinar),
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
          expectedDinar: e.kind === MONEY_KIND_DELIVERY ? (o.totalAmount as any)?.toNumber?.() ?? Number(o.totalAmount) : (o.orderSubtotal as any)?.toNumber?.() ?? Number(o.orderSubtotal),
        }))
    ),

    ...rawMisc.map((m) => ({
      source: "misc" as const,
      id: m.id,
      kind: m.direction === "take" ? MISC_LEDGER_KIND_TAKE : MISC_LEDGER_KIND_GIVE,
      amountDinar: (m.amountDinar as any).toNumber ? (m.amountDinar as any).toNumber() : Number(m.amountDinar),
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
      .filter(t => t.status === "pending")
      .map(t => ({
        source: "transfer_pending" as const,
        id: t.id,
        kind: t.fromCourierId === courier.id ? LEDGER_KIND_TRANSFER_PENDING_OUT : LEDGER_KIND_TRANSFER_PENDING_IN,
        amountDinar: (t.amountDinar as any).toNumber ? (t.amountDinar as any).toNumber() : Number(t.amountDinar),
        createdAt: t.createdAt.toISOString(),
        orderId: "",
        orderNumber: 0,
        shopName: "",
        miscLabel: t.handoverLocation,
        deletedAt: null,
        deletedReason: null,
        deletedByDisplayName: null,
      }))

  ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const filteredLedger = filterLedgerByRecentDays(ledger);

  // جلب إعدادات المحفظة
  const uiSettings = await getUISettings("mandoub", "wallet_block");

  return (
    <div dir="rtl" lang="ar" className="kse-app-bg min-h-screen text-base leading-relaxed text-slate-800">
      <div className="kse-app-inner mx-auto max-w-3xl px-3 py-4 pb-24 sm:px-4">
        <header className="kse-glass-dark mb-4 border border-violet-200/90 px-4 py-4 shadow-sm sm:px-5 sm:py-5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-black text-slate-900 sm:text-2xl">المحفظة</h1>
              <div className="flex h-11 items-center justify-center rounded-xl bg-emerald-600 px-4 text-xl font-black text-white shadow-sm tabular-nums">
                {formatDinarAsAlf(monthlySalaryTotal)}
              </div>
            </div>
            <MandoubWalletBackButton hrefMain={hrefMain} />
          </div>
        </header>

        <MandoubWalletClient
          auth={baseAuth}
          walletPathWithQuery={walletPathWithQuery}
          walletLedgerHrefs={{
            site: hrefWalletLedger("site"),
            ward: hrefWalletLedger("ward"),
            sader: hrefWalletLedger("sader"),
            all: hrefWalletLedger("all"),
          }}
          ledgerFilter={ledgerFilter}
          siteRemainingNetStr={formatDinarAsAlf(siteRemainingNet)}
          walletInFromWalletStr={formatDinarAsAlf(walletInOutDisplay.walletIn)}
          walletOutFromWalletStr={formatDinarAsAlf(walletInOutDisplay.walletOut)}
          pendingIncomingTransferStr={formatDinarAsAlf(walletInOutDisplay.pendingIncoming)}
          pendingOutgoingTransferStr={formatDinarAsAlf(walletInOutDisplay.pendingOutgoing)}
          sumEarningsStr={formatDinarAsAlf(deliveryEarningsSinceBaseline)}
          walletRemainStr={formatDinarAsAlf(walletRemain)}
          handToAdminStr={formatDinarAsAlf(handToAdmin)}
          cashInHandStr={formatDinarAsAlf(cashInHand)}
          earningsDailyStr={formatDinarAsAlf(tipDailySum)}
          earningsMonthlyStr={formatDinarAsAlf(tipMonthlySum)}
          ledger={filteredLedger}
          pendingIncoming={pendingIncomingForUi}
          transferTargetCouriers={transferTargetCouriers.map((c) => ({
            id: c.id,
            name: c.name.trim() || "مندوب",
          }))}
          transferTargetEmployees={companyPreparers.map((prep) => ({
            id: prep.walletEmployeeId!,
            name: prep.name.trim() || "مجهز",
            shopName: "",
            phone: prep.phone.trim() || "",
          }))}
          availableForTransferStr={formatDinarAsAlf(cashInHand)}
          pendingOutgoingCount={pendingOutgoingCount}
          uiSettings={uiSettings}
        />
      </div>
    </div>
  );
}


