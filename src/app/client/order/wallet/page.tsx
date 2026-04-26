import Link from "next/link";
import type { EmployeeOrderPortalVerifyReason } from "@/lib/employee-order-portal-link";
import { verifyEmployeeOrderPortalQuery } from "@/lib/employee-order-portal-link";
import {
  clientOrderAccountPath,
  clientOrderFormPath,
  clientOrderHistoryPath,
} from "@/lib/client-order-portal-nav";
import { formatDinarAsAlfWithUnit } from "@/lib/money-alf";
import {
  LEDGER_KIND_TRANSFER_PENDING_OUT,
  MISC_LEDGER_KIND_GIVE,
  MISC_LEDGER_KIND_TAKE,
} from "@/lib/mandoub-money-events";
import { prisma } from "@/lib/prisma";
import {
  employeeWalletRemainFromMisc,
  resolvePartyDisplayName,
  sumPendingOutgoingForEmployee,
} from "@/lib/wallet-peer-transfer";
import type { MandoubWalletLedgerLine } from "@/app/mandoub/mandoub-wallet-client";
import { PreparerWalletClient } from "../preparer-wallet-client";
import { PreparerWalletTransferSection } from "../preparer-wallet-transfer-section";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "المحفظة — أبو الأكبر للتوصيل",
};

function invalidMessage(reason: EmployeeOrderPortalVerifyReason): string {
  switch (reason) {
    case "expired":
      return "انتهت صلاحية الرابط. اطلب رابطاً جديداً من موظف المحل.";
    case "bad_signature":
    case "missing":
      return "الرابط غير صالح. تأكد من نسخه كاملاً.";
    case "no_secret":
      return "إعداد الخادم غير مكتمل.";
  }
}

type Props = {
  searchParams: Promise<{ e?: string; exp?: string; s?: string }>;
};

export default async function PreparerWalletPage({ searchParams }: Props) {
  const sp = await searchParams;
  const v = verifyEmployeeOrderPortalQuery(sp.e, sp.exp, sp.s);

  if (!v.ok) {
    return (
      <div className="kse-app-bg flex min-h-screen flex-col px-4 py-16 text-slate-800">
        <div className="kse-app-inner mx-auto max-w-md">
          <div className="kse-glass-dark rounded-2xl border border-rose-300 p-8 text-center">
            <p className="text-lg font-bold text-rose-700">تعذّر فتح المحفظة</p>
            <p className="mt-2 text-sm text-slate-600">{invalidMessage(v.reason)}</p>
          </div>
        </div>
      </div>
    );
  }

  const employee = await prisma.employee.findUnique({
    where: { id: v.employeeId },
    include: { shop: true },
  });

  if (!employee) {
    return (
      <div className="kse-app-bg flex min-h-screen flex-col px-4 py-16 text-slate-800">
        <div className="kse-app-inner mx-auto max-w-md">
          <div className="kse-glass-dark rounded-2xl p-8 text-center">
            <p className="text-lg font-bold text-slate-800">الموظف غير موجود</p>
          </div>
        </div>
      </div>
    );
  }

  if (employee.orderPortalToken !== v.token) {
    return (
      <div className="kse-app-bg flex min-h-screen flex-col px-4 py-16 text-slate-800">
        <div className="kse-app-inner mx-auto max-w-md">
          <div className="kse-glass-dark rounded-2xl border border-rose-300 p-8 text-center">
            <p className="text-lg font-bold text-rose-700">تعذّر فتح المحفظة</p>
            <p className="mt-2 text-sm text-slate-600">الرابط غير صالح. اطلب رابطاً جديداً من الإدارة.</p>
          </div>
        </div>
      </div>
    );
  }

  const e = sp.e ?? "";
  const exp = sp.exp ?? "";
  const sig = sp.s ?? "";
  const authQuery = new URLSearchParams({ e, exp, s: sig });
  const walletPathWithQuery = `/client/order/wallet?${authQuery.toString()}`;
  const formHref = clientOrderFormPath(e, exp, sig);
  const historyHref = clientOrderHistoryPath(e, exp, sig);
  const accountHref = clientOrderAccountPath(e, exp, sig);

  const auth = { e, exp, s: sig };

  const [miscRows, pendingTransferRows, transferTargetCouriers, transferTargetEmployees, pendingOutgoingSum] =
    await Promise.all([
      prisma.employeeWalletMiscEntry.findMany({
        where: { employeeId: employee.id },
        orderBy: { createdAt: "desc" },
      }),
      prisma.walletPeerTransfer.findMany({
        where: {
          status: "pending",
          OR: [{ fromEmployeeId: employee.id }, { toEmployeeId: employee.id }],
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.courier.findMany({
        where: { blocked: false },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      }),
      prisma.employee.findMany({
        select: {
          id: true,
          name: true,
          phone: true,
          shop: { select: { name: true } },
        },
        orderBy: { name: "asc" },
      }),
      sumPendingOutgoingForEmployee(employee.id),
    ]);

  const balance = await employeeWalletRemainFromMisc(employee.id);
  const availableForTransfer = balance.minus(pendingOutgoingSum);

  const miscLines: MandoubWalletLedgerLine[] = miscRows.map((r) => ({
    source: "misc",
    id: r.id,
    kind: r.direction === "take" ? MISC_LEDGER_KIND_TAKE : MISC_LEDGER_KIND_GIVE,
    amountDinar: Number(r.amountDinar),
    createdAt: r.createdAt.toISOString(),
    orderId: "",
    orderNumber: 0,
    shopName: "",
    miscLabel: r.label.trim() || "—",
    deletedAt: r.deletedAt ? r.deletedAt.toISOString() : null,
    deletedReason: (r.deletedReason ?? null) as MandoubWalletLedgerLine["deletedReason"],
    deletedByDisplayName: r.deletedByDisplayName,
  }));

  const pendingIncomingForUi = await Promise.all(
    pendingTransferRows
      .filter((t) => t.toEmployeeId === employee.id)
      .map(async (t) => ({
        id: t.id,
        amountDinar: Number(t.amountDinar),
        fromLabel: await resolvePartyDisplayName(
          t.fromKind,
          t.fromCourierId,
          t.fromEmployeeId,
        ),
        handoverLocation: t.handoverLocation.trim() || "—",
        createdAt: t.createdAt.toISOString(),
      })),
  );

  const transferOutLines: MandoubWalletLedgerLine[] = await Promise.all(
    pendingTransferRows
      .filter((t) => t.fromEmployeeId === employee.id)
      .map(async (t) => {
        const toLabel = await resolvePartyDisplayName(
          t.toKind,
          t.toCourierId,
          t.toEmployeeId,
        );
        const loc = t.handoverLocation.trim() || "—";
        return {
          source: "transfer_pending" as const,
          id: t.id,
          kind: LEDGER_KIND_TRANSFER_PENDING_OUT,
          amountDinar: Number(t.amountDinar),
          createdAt: t.createdAt.toISOString(),
          orderId: "",
          orderNumber: 0,
          shopName: "",
          miscLabel: `تحويل بانتظار موافقة ${toLabel} — مكان التسليم: ${loc}`,
          deletedAt: null,
          deletedReason: null,
          deletedByDisplayName: null,
        };
      }),
  );

  const sortedFullLedger = [...miscLines, ...transferOutLines].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );

  // حساب الرصيد التنازلي
  let runningBal = balance.toNumber();
  const mergedLedger = sortedFullLedger.map((line) => {
    if (line.deletedAt) return line;
    const item = { ...line, balanceAfter: runningBal };
    const isIn = line.kind === MISC_LEDGER_KIND_TAKE;
    if (isIn) {
      runningBal -= line.amountDinar;
    } else {
      runningBal += line.amountDinar;
    }
    return item;
  });

  const pendingOutgoingCount = transferOutLines.length;

  return (
    <div className="kse-app-bg min-h-screen px-4 py-8 pb-24 text-slate-800">
      <div className="kse-app-inner mx-auto max-w-lg space-y-5">
        <header className="kse-glass-dark rounded-2xl border border-emerald-200/90 p-5 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-wide text-emerald-800">
            أبو الأكبر للتوصيل
          </p>
          <h1 className="mt-2 text-xl font-black text-slate-900">المحفظة</h1>
          <p className="mt-1 text-sm font-semibold text-emerald-900">{employee.shop.name}</p>
          <nav className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-center sm:gap-3">
            <Link
              href={formHref}
              className="inline-flex flex-1 items-center justify-center rounded-xl border-2 border-sky-500 bg-sky-600 px-4 py-3 text-center text-sm font-black text-white shadow-sm transition hover:bg-sky-700"
            >
              رفع طلب جديد
            </Link>
            <Link
              href={accountHref}
              className="inline-flex flex-1 items-center justify-center rounded-xl border-2 border-emerald-300 bg-white px-4 py-3 text-center text-sm font-bold text-emerald-900 shadow-sm transition hover:bg-emerald-50"
            >
              إحصائيات طلباتك
            </Link>
            <Link
              href={historyHref}
              className="inline-flex flex-1 items-center justify-center rounded-xl border-2 border-slate-200 bg-white px-4 py-3 text-center text-sm font-bold text-slate-800 shadow-sm transition hover:bg-slate-50"
            >
              سجل الطلبات
            </Link>
          </nav>
        </header>

        <PreparerWalletTransferSection
          auth={auth}
          walletPathWithQuery={walletPathWithQuery}
          selfEmployeeId={employee.id}
          transferTargetCouriers={transferTargetCouriers.map((c) => ({
            id: c.id,
            name: c.name.trim() || "مندوب",
          }))}
          transferTargetEmployees={transferTargetEmployees.map((em) => ({
            id: em.id,
            name: em.name.trim() || "مجهز",
            shopName: em.shop.name.trim() || "—",
            phone: em.phone.trim() || "",
          }))}
          pendingIncoming={pendingIncomingForUi}
          availableForTransferStr={formatDinarAsAlfWithUnit(availableForTransfer)}
          pendingOutgoingCount={pendingOutgoingCount}
        />

        <PreparerWalletClient
          walletRemainStr={formatDinarAsAlfWithUnit(balance)}
          ledger={mergedLedger}
        />
      </div>
    </div>
  );
}
