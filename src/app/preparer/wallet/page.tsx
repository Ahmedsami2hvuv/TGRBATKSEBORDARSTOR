import { cookies } from "next/headers";
import { Decimal } from "@prisma/client/runtime/library";
import { verifyCompanyPreparerPortalQuery, type CompanyPreparerPortalVerifyReason } from "@/lib/company-preparer-portal-link";
import { preparerPath } from "@/lib/preparer-portal-nav";
import { prisma } from "@/lib/prisma";
import { formatDinarAsAlfWithUnit } from "@/lib/money-alf";
import { filterLedgerByRecentDays } from "@/lib/money-entry-ui";
import {
  LEDGER_KIND_TRANSFER_PENDING_IN,
  LEDGER_KIND_TRANSFER_PENDING_OUT,
  MISC_LEDGER_KIND_GIVE,
  MISC_LEDGER_KIND_TAKE,
  MONEY_KIND_DELIVERY,
  MONEY_KIND_PICKUP,
} from "@/lib/mandoub-money-events";
import { getPreparerMoneyTotals } from "@/lib/preparer-combined-wallet-totals";
import {
  resolvePartyDisplayName,
  sumPendingOutgoingForEmployee,
} from "@/lib/wallet-peer-transfer";
import type { MandoubWalletLedgerLine } from "@/app/mandoub/mandoub-wallet-client";
import { PreparerWalletClient } from "@/app/client/order/preparer-wallet-client";
import { PreparerWalletTransferSection } from "./preparer-wallet-transfer-section";
import { getUISettings } from "@/lib/ui-settings";

export const dynamic = "force-dynamic";

type Props = {
  searchParams: Promise<{ p?: string; exp?: string; s?: string }>;
};

function invalidMessage(reason: CompanyPreparerPortalVerifyReason): string {
  switch (reason) {
    case "expired": return "انتهت صلاحية الرابط أو تم تسجيل الدخول من جهاز آخر.";
    case "bad_signature":
    case "missing": return "الرابط غير صالح. يرجى فتح الرابط الأصلي المرسل إليك.";
    case "no_secret": return "إعداد الخادم غير مكتمل.";
    default: return "تعذّر التحقق.";
  }
}

export default async function PreparerWalletPage({ searchParams }: Props) {
  const sp = await searchParams;
  const cookieStore = await cookies();

  // جلب الهوية من الرابط أو من الكوكيز
  const p = sp.p || cookieStore.get("preparer_p")?.value;
  const s = sp.s || cookieStore.get("preparer_s")?.value;
  const exp = sp.exp || cookieStore.get("preparer_exp")?.value;

  const v = verifyCompanyPreparerPortalQuery(p, exp, s);

  if (!v.ok) {
    return (
      <div className="kse-app-bg min-h-screen px-4 py-16 text-slate-800">
        <div className="kse-app-inner mx-auto max-w-md">
          <div className="kse-glass-dark rounded-2xl border border-rose-300 p-8 text-center">
            <p className="text-lg font-bold text-rose-700">تعذّر فتح المحفظة</p>
            <p className="mt-2 text-sm text-slate-600">{invalidMessage(v.reason)}</p>
          </div>
        </div>
      </div>
    );
  }

  const preparer = await prisma.companyPreparer.findFirst({
    where: { id: v.preparerId, active: true },
    include: {
      walletEmployee: { include: { shop: true } },
      shopLinks: { select: { shopId: true } },
    },
  });

  if (!preparer || !preparer.walletEmployee) {
    return (
      <div className="kse-app-bg min-h-screen px-4 py-16 text-slate-800">
        <div className="kse-app-inner mx-auto max-w-md">
          <div className="kse-glass-dark rounded-2xl p-8 text-center">
            <p className="text-lg font-bold text-slate-800">المحفظة غير مفعّلة لهذا الحساب</p>
          </div>
        </div>
      </div>
    );
  }

  const baseAuth = { p: p!, exp: exp || "", s: s! };
  const employee = preparer.walletEmployee;
  const shopIds = preparer.shopLinks.map((l) => l.shopId);
  const walletPathWithQuery = preparerPath("/preparer/wallet", baseAuth);

  const [
    miscRows,
    pendingTransferRows,
    transferTargetCouriers,
    companyPreparers,
    pendingOutgoingSum,
    totals,
    orderMoneyEvents,
    uiSettings,
  ] = await Promise.all([
    prisma.employeeWalletMiscEntry.findMany({ where: { employeeId: employee.id }, orderBy: { createdAt: "desc" } }),
    prisma.walletPeerTransfer.findMany({
      where: { status: "pending", OR: [{ fromEmployeeId: employee.id }, { toEmployeeId: employee.id }] },
      orderBy: { createdAt: "desc" },
    }),
    prisma.courier.findMany({ where: { blocked: false }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.companyPreparer.findMany({
      where: { active: true, walletEmployeeId: { not: null }, id: { not: v.preparerId } },
      select: { id: true, name: true, phone: true, walletEmployeeId: true },
      orderBy: { name: "asc" },
    }),
    sumPendingOutgoingForEmployee(employee.id),
    getPreparerMoneyTotals(v.preparerId),
    prisma.orderCourierMoneyEvent.findMany({
      where: { order: { shopId: { in: shopIds } }, recordedByCompanyPreparerId: preparer.id },
      include: {
        courier: { select: { name: true } },
        order: {
          select: {
            orderNumber: true,
            orderSubtotal: true,
            totalAmount: true,
            shop: { select: { name: true } },
            customerRegion: { select: { name: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
    getUISettings("preparer", "wallet_block"), // جلب إعدادات محفظة المجهز
  ]);

  const invoiceLabelPattern = /^فاتورة تجهيز طلب #(\d+)\s*\(مساهمتك\)$/;
  const oldInvoiceOrderNumbers = new Set<number>();
  miscRows.forEach((r) => {
    const match = invoiceLabelPattern.exec(r.label.trim());
    if (match) {
      oldInvoiceOrderNumbers.add(Number(match[1]));
    }
  });

  const oldInvoiceOrders = oldInvoiceOrderNumbers.size > 0
    ? await prisma.order.findMany({
      where: { orderNumber: { in: Array.from(oldInvoiceOrderNumbers) } },
      include: { customerRegion: true, shop: { include: { region: true } } },
    })
    : [];

  const oldInvoiceRegionByOrderNumber = new Map<number, string>(
    oldInvoiceOrders.map((order) => [
      order.orderNumber,
      order.customerRegion?.name || order.shop?.region?.name || "المنطقة"
    ])
  );

  const walletRemain = totals?.remain ?? new Decimal(0);
  const availableForTransfer = walletRemain.minus(pendingOutgoingSum);

  const transferTargetEmployees = companyPreparers.map(p => ({
    id: p.walletEmployeeId!,
    name: p.name,
    shopName: "",
    phone: p.phone,
  }));

  const orderLines: MandoubWalletLedgerLine[] = orderMoneyEvents.map((e) => {
    const sub = e.order.orderSubtotal != null ? Number(e.order.orderSubtotal) : null;
    const tot = e.order.totalAmount != null ? Number(e.order.totalAmount) : null;
    const expectedDinar = e.kind === MONEY_KIND_DELIVERY ? tot : sub;
    return {
      source: "order" as const,
      id: e.id,
      kind: e.kind,
      amountDinar: Number(e.amountDinar),
      createdAt: e.createdAt.toISOString(),
      orderId: e.orderId,
      orderNumber: e.order.orderNumber,
      shopName: e.order.shop.name,
      regionName: e.order.customerRegion?.name,
      deletedAt: e.deletedAt ? e.deletedAt.toISOString() : null,
      deletedReason: e.deletedReason,
      miscLabel: "",
      deletedByDisplayName: e.deletedByDisplayName ?? null,
      ...(expectedDinar != null && !Number.isNaN(expectedDinar) ? { expectedDinar } : {}),
    };
  });

  const miscLines: MandoubWalletLedgerLine[] = miscRows.map((r) => {
    const trimmedLabel = r.label.trim();
    let miscLabel = trimmedLabel;
    const match = invoiceLabelPattern.exec(trimmedLabel);
    if (match) {
      const orderNumber = Number(match[1]);
      const regionName = oldInvoiceRegionByOrderNumber.get(orderNumber) || "المنطقة";
      miscLabel = `فاتورة تجهيز طلب #${orderNumber} (${regionName})`;
    }

    return {
      source: "misc",
      id: r.id,
      kind: r.direction === "take" ? MISC_LEDGER_KIND_TAKE : MISC_LEDGER_KIND_GIVE,
      amountDinar: Number(r.amountDinar),
      createdAt: r.createdAt.toISOString(),
      orderId: "",
      orderNumber: 0,
      shopName: "",
      miscLabel,
      deletedAt: r.deletedAt ? r.deletedAt.toISOString() : null,
      deletedReason: r.deletedReason,
      deletedByDisplayName: r.deletedByDisplayName ?? null,
    };
  });

  const pendingIn = await Promise.all(pendingTransferRows.filter(t => t.toEmployeeId === employee.id).map(async t => ({
    id: t.id, amountDinar: Number(t.amountDinar), fromLabel: await resolvePartyDisplayName(t.fromKind, t.fromCourierId, t.fromEmployeeId), handoverLocation: t.handoverLocation, createdAt: t.createdAt.toISOString()
  })));

  const transferOutLines: MandoubWalletLedgerLine[] = await Promise.all(pendingTransferRows.filter(t => t.fromEmployeeId === employee.id).map(async t => ({
    source: "transfer_pending", id: t.id, kind: LEDGER_KIND_TRANSFER_PENDING_OUT, amountDinar: Number(t.amountDinar), createdAt: t.createdAt.toISOString(), orderId: "", orderNumber: 0, shopName: "", miscLabel: `تحويل بانتظار الموافقة — ${t.handoverLocation}`, deletedAt: null, deletedReason: null, deletedByDisplayName: null,
  })));

  // دمج السجل وحساب الرصيد التنازلي
  const sortedFullLedger = [...orderLines, ...miscLines, ...transferOutLines].sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  // حساب الرصيد بعد كل حركة (بدءاً من الرصيد الحالي)
  let currentRunningBalance = walletRemain.toNumber();
  const ledgerWithBalance = sortedFullLedger.map((line) => {
    if (line.deletedAt) return line;
    const item = { ...line, balanceAfter: currentRunningBalance };

    // لكي نحسب الرصيد للحركة السابقة (الأقدم)، نعكس تأثير الحركة الحالية
    const isIn = line.kind === MONEY_KIND_DELIVERY || line.kind === MISC_LEDGER_KIND_TAKE || line.kind === LEDGER_KIND_TRANSFER_PENDING_IN;
    if (isIn) {
      currentRunningBalance -= line.amountDinar;
    } else {
      currentRunningBalance += line.amountDinar;
    }
    return item;
  });

  // دالة تطهير عميقة وقوية جداً لمنع أي تسريب لبيانات غير قابلة للتسلسل (BigInt, Decimal, Date)
  function deepSanitize(obj: any): any {
    if (obj === null || obj === undefined) return obj;
    if (typeof obj === "bigint") return obj.toString();
    if (typeof obj === "string" || typeof obj === "number" || typeof obj === "boolean") return obj;
    if (obj instanceof Date) return obj.toISOString();

    if (Array.isArray(obj)) return obj.map(deepSanitize);

    if (typeof obj === "object") {
      // معالجة Decimal الخاصة بـ Prisma (Decimal.js)
      if (obj.constructor && (obj.constructor.name === "Decimal" || obj.constructor.name === "n")) {
        return Number(obj.toString());
      }
      // حماية إضافية للـ Decimal إذا فقد الـ constructor
      if (obj.d && Array.isArray(obj.d) && typeof obj.s === 'number') {
        return Number(obj.toString());
      }

      const newObj: any = {};
      for (const key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
          try {
            newObj[key] = deepSanitize(obj[key]);
          } catch (e) {
            newObj[key] = null;
          }
        }
      }
      return newObj;
    }
    return obj;
  }

  const mergedLedger = deepSanitize(filterLedgerByRecentDays(ledgerWithBalance));
  const safeUISettings = deepSanitize(uiSettings);
  const safePendingIncoming = deepSanitize(pendingIn);
  const safeTransferTargetCouriers = deepSanitize(transferTargetCouriers);
  const safeTransferTargetEmployees = deepSanitize(transferTargetEmployees);

  return (
    <div className="kse-app-bg min-h-screen px-4 py-8 pb-24 text-slate-800">
      <div className="kse-app-inner mx-auto max-w-lg space-y-5">
        <header className="kse-glass-dark rounded-2xl border border-violet-200/90 p-5 shadow-sm">
          <h1 className="text-xl font-black text-slate-900">محفظة {preparer.name}</h1>
        </header>

        {/* ملخص المحفظة مرتب ديناميكياً */}
        {accountingLayout.includes("summary_grid") && (
          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            <div className="kse-glass-dark rounded-xl border border-slate-300 bg-white p-3 text-center shadow-sm">
              <p className="text-xs font-bold text-slate-500">الوارد</p>
              <p className="mt-1 text-base font-black text-slate-900">{formatDinarAsAlfWithUnit(totals?.ward ?? 0)}</p>
            </div>
            <div className="kse-glass-dark rounded-xl border border-slate-300 bg-white p-3 text-center shadow-sm">
              <p className="text-xs font-bold text-slate-500">الصادر</p>
              <p className="mt-1 text-base font-black text-slate-900">{formatDinarAsAlfWithUnit(totals?.sader ?? 0)}</p>
            </div>
            <div className="kse-glass-dark rounded-xl border border-slate-300 bg-white p-3 text-center shadow-sm">
              <p className="text-xs font-bold text-slate-500">المتبقي</p>
              <p className="mt-1 text-base font-black text-indigo-700">{formatDinarAsAlfWithUnit(totals?.remain ?? 0)}</p>
            </div>
          </div>
        )}

        <PreparerWalletTransferSection
          auth={baseAuth} walletPathWithQuery={walletPathWithQuery} selfEmployeeId={employee.id}
          transferTargetCouriers={safeTransferTargetCouriers} transferTargetEmployees={safeTransferTargetEmployees}
          pendingIncoming={safePendingIncoming} availableForTransferStr={formatDinarAsAlfWithUnit(availableForTransfer)}
          pendingOutgoingCount={transferOutLines.length}
        />

        <PreparerWalletClient hideWalletSummary ledger={mergedLedger} orderLinkAuth={baseAuth} preparerDeleteAuth={baseAuth} preparerDeleteNextUrl={walletPathWithQuery} uiSettings={safeUISettings} />
      </div>
    </div>
  );
}
