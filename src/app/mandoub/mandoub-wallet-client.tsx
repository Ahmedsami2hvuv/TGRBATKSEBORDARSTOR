"use client";

import { useActionState, useMemo, useRef, useState } from "react";
import {
  createWalletPeerTransferFromCourier,
  respondWalletPeerTransferByCourier,
  type WalletPeerTransferState,
} from "@/app/wallet-peer-transfer-actions";
import {
  softDeleteMandoubMiscWalletEntry,
  softDeleteMandoubMoneyEvent,
  submitMandoubMiscWalletEntry,
  type MandoubCashState,
} from "./cash-actions";
import { formatDinarAsAlf, formatDinarAsAlfWithUnit } from "@/lib/money-alf";
import {
  moneyLedgerAmountClass,
  LEDGER_KIND_TRANSFER_PENDING_IN,
  LEDGER_KIND_TRANSFER_PENDING_OUT,
  MISC_LEDGER_KIND_GIVE,
  MISC_LEDGER_KIND_TAKE,
  MONEY_KIND_DELIVERY,
  MONEY_KIND_PICKUP,
} from "@/lib/mandoub-money-events";
import { ThemeSwitcher } from "@/components/theme-switcher";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { UISectionConfig } from "@/lib/ui-settings";
import { useEffect, useState as useStateReact } from "react";
import { getGlobalIcons, GlobalIconsConfig } from "@/lib/icon-settings";
import { DynamicIcon } from "@/components/dynamic-icon";

export type MandoubWalletDeletionReason =
  | "manual_admin"
  | "manual_courier"
  | "manual_preparer"
  | "status_revert"
  | null;

export type MandoubWalletLedgerLine = {
  source: "order" | "misc" | "transfer_pending" | "transfer_rejected";
  id: string;
  kind: string;
  amountDinar: number;
  createdAt: string;
  orderId: string;
  orderNumber: number;
  shopName: string;
  regionName?: string;
  orderNotes?: string | null;
  miscLabel: string | null;
  deletedAt: string | null;
  deletedReason: MandoubWalletDeletionReason;
  deletedByDisplayName: string | null;
  expectedDinar?: number | null;
  matchesExpected?: boolean;
  balanceAfter?: number;
  earningDinar?: number;
  balanceEarnings?: number;
  balanceAdmin?: number;
  isTransferToAdmin?: boolean;
};

const initialCash: MandoubCashState = {};
const initialTransfer: WalletPeerTransferState = {};

export type PendingIncomingTransferUi = {
  id: string;
  amountDinar: number;
  fromLabel: string;
  handoverLocation: string;
  createdAt: string;
};

export type TransferTargetCourierUi = { id: string; name: string };
export type TransferTargetEmployeeUi = { id: string; name: string; shopName: string; phone: string };

function buildOrderHref(auth: { c: string; exp: string; s: string }, orderId: string) {
  const p = new URLSearchParams();
  if (auth.c) p.set("c", auth.c);
  if (auth.exp) p.set("exp", auth.exp);
  if (auth.s) p.set("s", auth.s);
  p.set("tab", "all");
  return `/mandoub/order/${orderId}?${p.toString()}`;
}

function ledgerDirLabel(line: MandoubWalletLedgerLine): string {
  if (line.kind === LEDGER_KIND_TRANSFER_PENDING_OUT) return "صادر معلّق";
  if (line.kind === LEDGER_KIND_TRANSFER_PENDING_IN) return "وارد معلّق";
  if (line.kind === "transfer_rejected_out") return "صادر مرفوض";
  if (line.kind === "transfer_rejected_in") return "وارد مرفوض";
  if (line.kind === MONEY_KIND_PICKUP) return "صادر";
  if (line.kind === MONEY_KIND_DELIVERY) return "وارد";
  if (line.kind === MISC_LEDGER_KIND_TAKE) return "أخذت";
  if (line.kind === MISC_LEDGER_KIND_GIVE) return "أعطيت";
  return line.kind;
}

function buildWalletSearchText(line: MandoubWalletLedgerLine) {
  const dateStr = new Date(line.createdAt).toLocaleString("ar-IQ-u-nu-latn", {
    day: "numeric",
    month: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  return [
    line.orderNumber?.toString(),
    line.amountDinar?.toString(),
    line.expectedDinar?.toString(),
    line.balanceAfter?.toString(),
    line.balanceEarnings?.toString(),
    line.balanceAdmin?.toString(),
    line.shopName,
    line.regionName,
    line.orderNotes,
    line.miscLabel,
    ledgerDirLabel(line),
    dateStr,
    line.createdAt,
    line.deletedReason,
    line.deletedByDisplayName,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function matchesWalletQuery(line: MandoubWalletLedgerLine, query: string) {
  const tokens = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (!tokens.length) return true;
  const searchable = buildWalletSearchText(line);
  return tokens.every((token) => searchable.includes(token));
}

export type MandoubLedgerFilter = "ward" | "sader" | "site" | "all";

export function MandoubWalletClient({
  auth,
  walletPathWithQuery,
  walletLedgerHrefs,
  ledgerFilter,
  siteRemainingNetStr,
  walletInFromWalletStr,
  walletOutFromWalletStr,
  pendingIncomingTransferStr,
  pendingOutgoingTransferStr,
  sumEarningsStr,
  walletRemainStr,
  handToAdminStr,
  cashInHandStr,
  ledger,
  pendingIncoming,
  transferTargetCouriers,
  transferTargetEmployees,
  availableForTransferStr,
  pendingOutgoingCount,
  earningsDailyStr,
  earningsMonthlyStr,
  uiSettings,
}: {
  auth: { c: string; exp: string; s: string };
  walletPathWithQuery: string;
  walletLedgerHrefs: { site: string; ward: string; sader: string; all: string };
  ledgerFilter: MandoubLedgerFilter;
  siteRemainingNetStr: string;
  walletInFromWalletStr: string;
  walletOutFromWalletStr: string;
  pendingIncomingTransferStr: string;
  pendingOutgoingTransferStr: string;
  sumEarningsStr: string;
  walletRemainStr: string;
  handToAdminStr: string;
  cashInHandStr: string;
  ledger: MandoubWalletLedgerLine[];
  pendingIncoming: PendingIncomingTransferUi[];
  transferTargetCouriers: TransferTargetCourierUi[];
  transferTargetEmployees: TransferTargetEmployeeUi[];
  availableForTransferStr: string;
  pendingOutgoingCount: number;
  earningsDailyStr?: string;
  earningsMonthlyStr?: string;
  uiSettings?: UISectionConfig | null;
}) {
  const router = useRouter();
  const [miscPanel, setMiscPanel] = useState<null | "take" | "give">(null);
  const [transferOpen, setTransferOpen] = useState(false);
  const [toKind, setToKind] = useState<"" | "courier" | "employee" | "admin">("");

  const [deleteState, deleteAction, deletePending] = useActionState(softDeleteMandoubMoneyEvent, initialCash);
  const [miscDelState, miscDelAction, miscDelPending] = useActionState(softDeleteMandoubMiscWalletEntry, initialCash);
  const [miscSubmitState, miscSubmitAction, miscSubmitPending] = useActionState(submitMandoubMiscWalletEntry, initialCash);
  const [createState, createAction, createPending] = useActionState(createWalletPeerTransferFromCourier, initialTransfer);
  const [respondState, respondAction, respondPending] = useActionState(respondWalletPeerTransferByCourier, initialTransfer);
  const [query, setQuery] = useState("");
  const [icons, setIcons] = useStateReact<GlobalIconsConfig | null>(null);
  const [orderModalHref, setOrderModalHref] = useState<string | null>(null);
  const prevCreatePendingRef = useRef(false);
  const prevRespondPendingRef = useRef(false);
  const prevMiscSubmitPendingRef = useRef(false);
  const prevDeletePendingRef = useRef(false);
  const prevMiscDelPendingRef = useRef(false);

  useEffect(() => {
    getGlobalIcons().then(setIcons);
  }, []);

  useEffect(() => {
    if (prevCreatePendingRef.current && !createPending && !createState.error) {
      router.refresh();
    }
    prevCreatePendingRef.current = createPending;
  }, [createPending, createState.error, router]);

  useEffect(() => {
    if (prevRespondPendingRef.current && !respondPending && !respondState.error) {
      router.refresh();
    }
    prevRespondPendingRef.current = respondPending;
  }, [respondPending, respondState.error, router]);

  useEffect(() => {
    if (
      prevMiscSubmitPendingRef.current &&
      !miscSubmitPending &&
      !miscSubmitState.error
    ) {
      router.refresh();
    }
    prevMiscSubmitPendingRef.current = miscSubmitPending;
  }, [miscSubmitPending, miscSubmitState.error, router]);

  useEffect(() => {
    if (prevDeletePendingRef.current && !deletePending && !deleteState.error) {
      router.refresh();
    }
    prevDeletePendingRef.current = deletePending;
  }, [deletePending, deleteState.error, router]);

  useEffect(() => {
    if (prevMiscDelPendingRef.current && !miscDelPending && !miscDelState.error) {
      router.refresh();
    }
    prevMiscDelPendingRef.current = miscDelPending;
  }, [miscDelPending, miscDelState.error, router]);

  const filteredLedger = useMemo(() => {
    const normalizedQuery = query.trim();
    if (!normalizedQuery) return ledger;
    return ledger.filter((line) => matchesWalletQuery(line, normalizedQuery));
  }, [ledger, query]);

  // ستايل المحفظة الديناميكي
  const containerStyle = uiSettings ? {
    backgroundColor: uiSettings.backgroundColor,
    backgroundImage: uiSettings.backgroundImage ? `url(${uiSettings.backgroundImage})` : undefined,
    color: uiSettings.textColor,
    opacity: uiSettings.backgroundOpacity,
    borderRadius: uiSettings.borderRadius,
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    padding: uiSettings.padding || '1.25rem'
  } : {};

  const renderAccountingBlock = (id: string) => {
    switch (id) {
      case "wallet_in_out":
        return (
          <div key="in_out" className="grid grid-cols-2 gap-2 sm:gap-3">
            <Link href={walletLedgerHrefs.sader} className={`kse-glass-dark flex items-center justify-between rounded-xl border px-3 py-2 shadow-sm transition ${ledgerFilter === "sader" ? "border-slate-500 bg-slate-100 dark:bg-slate-800" : "border-slate-300 bg-white dark:bg-slate-900/50 dark:border-slate-800"}`}>
              <p className="flex items-center gap-1 text-xs font-bold text-slate-800 dark:text-slate-400 sm:text-sm">
                <DynamicIcon icon={icons?.wallet_out} fallback="📤" width={16} height={16} /> صادر
              </p>
              <p className="text-lg font-black tabular-nums text-slate-900 sm:text-xl dark:text-slate-100">{walletOutFromWalletStr}</p>
            </Link>
            <Link href={walletLedgerHrefs.ward} className={`kse-glass-dark flex items-center justify-between rounded-xl border px-3 py-2 shadow-sm transition ${ledgerFilter === "ward" ? "border-slate-500 bg-slate-100 dark:bg-slate-800" : "border-slate-300 bg-white dark:bg-slate-900/50 dark:border-slate-800"}`}>
              <p className="flex items-center gap-1 text-xs font-bold text-slate-800 dark:text-slate-400 sm:text-sm">
                <DynamicIcon icon={icons?.wallet_in} fallback="📥" width={16} height={16} /> وارد
              </p>
              <p className="text-lg font-black tabular-nums text-slate-900 sm:text-xl dark:text-slate-100">{walletInFromWalletStr}</p>
            </Link>
          </div>
        );
      case "pending_transfers":
        return (
          <div key="pending_transfers" className="grid grid-cols-2 gap-2 sm:gap-3">
            <div className="kse-glass-dark flex items-center justify-between rounded-xl border px-3 py-2 shadow-sm border-slate-300 bg-white dark:bg-slate-900/50 dark:border-slate-800">
              <p className="flex items-center gap-1 text-[10px] font-bold text-slate-800 dark:text-slate-400 sm:text-xs">
                <DynamicIcon icon={icons?.wallet_pending} fallback="🔄" width={14} height={14} /> وارد معلق
              </p>
              <p className="text-base font-black tabular-nums text-slate-900 sm:text-lg dark:text-slate-100">{pendingIncomingTransferStr}</p>
            </div>
            <div className="kse-glass-dark flex items-center justify-between rounded-xl border px-3 py-2 shadow-sm border-slate-300 bg-white dark:bg-slate-900/50 dark:border-slate-800">
              <p className="flex items-center gap-1 text-[10px] font-bold text-slate-800 dark:text-slate-400 sm:text-xs">
                <DynamicIcon icon={icons?.wallet_pending} fallback="🔄" width={14} height={14} /> صادر معلق
              </p>
              <p className="text-base font-black tabular-nums text-slate-900 sm:text-lg dark:text-slate-100">{pendingOutgoingTransferStr}</p>
            </div>
          </div>
        );
      case "site_and_remain":
        return (
          <div key="site_remain" className="grid grid-cols-2 gap-2 sm:gap-3">
            <Link href={walletLedgerHrefs.site} className={`kse-glass-dark flex items-center justify-between rounded-xl border px-3 py-2 shadow-sm transition ${ledgerFilter === "site" ? "border-slate-500 bg-slate-100 dark:bg-slate-800" : "border-slate-300 bg-white dark:bg-slate-900/50 dark:border-slate-800"}`}>
              <p className="flex items-center gap-1 text-xs font-bold text-slate-800 dark:text-slate-400 sm:text-sm">
                <DynamicIcon icon={icons?.ui_package} fallback="📦" width={16} height={16} /> الطلبات
              </p>
              <p className="text-lg font-black tabular-nums text-slate-900 sm:text-xl dark:text-slate-100">{siteRemainingNetStr}</p>
            </Link>
            <div className="kse-glass-dark flex items-center justify-between rounded-xl border border-slate-300 bg-white px-3 py-2 shadow-sm dark:bg-slate-900/50 dark:border-slate-800">
              <p className="flex items-center gap-1 text-xs font-bold text-slate-800 dark:text-slate-400 sm:text-sm">
                <DynamicIcon icon={icons?.wallet_remain} fallback="💰" width={16} height={16} /> متبقي
              </p>
              <p className="text-lg font-black tabular-nums text-slate-900 sm:text-xl dark:text-slate-100">{walletRemainStr}</p>
            </div>
          </div>
        );
      case "cash_in_hand":
        return (
          <div key="cash" className="kse-glass-dark flex items-center justify-between rounded-2xl border-2 border-emerald-500 bg-emerald-100 px-5 py-3 shadow-lg dark:bg-emerald-900/30 dark:border-emerald-800">
            <p className="flex items-center gap-2 text-lg font-black text-emerald-900 dark:text-emerald-400">
              <DynamicIcon icon={icons?.wallet_cash} fallback="💵" width={24} height={24} /> عندي
            </p>
            <p className="text-3xl font-black tabular-nums text-emerald-950 sm:text-4xl dark:text-emerald-100">{cashInHandStr}</p>
          </div>
        );
      case "available_for_transfer":
        return (
          <div key="available_for_transfer" className="kse-glass-dark flex items-center justify-between rounded-xl border border-violet-300 bg-violet-50 px-3 py-2 shadow-sm dark:bg-violet-900/20 dark:border-violet-800">
            <p className="flex items-center gap-1 text-xs font-bold text-violet-900 dark:text-violet-400 sm:text-sm">
              <DynamicIcon icon={icons?.wallet_transfer} fallback="💸" width={16} height={16} /> متاح للتحويل
            </p>
            <p className="text-lg font-black tabular-nums text-violet-950 sm:text-2xl dark:text-violet-100">{availableForTransferStr}</p>
          </div>
        );
      case "earnings_and_admin":
        return (
          <div key="earnings" className="grid grid-cols-2 gap-2 sm:gap-3">
            <div className="kse-glass-dark flex items-center justify-between rounded-xl border border-slate-300 bg-white px-3 py-2 shadow-sm dark:bg-slate-900/50 dark:border-slate-800">
              <p className="flex items-center gap-1 text-xs font-bold text-slate-800 dark:text-slate-400 sm:text-sm">
                <DynamicIcon icon={icons?.wallet_earnings} fallback="💰" width={16} height={16} /> أرباحي
              </p>
              <p className="text-lg font-black tabular-nums text-slate-900 sm:text-2xl dark:text-slate-100">{sumEarningsStr}</p>
            </div>
            <div className="kse-glass-dark flex items-center justify-between rounded-xl border border-slate-300 bg-white px-3 py-2 shadow-sm dark:bg-slate-900/50 dark:border-slate-800">
              <p className="flex items-center gap-1 text-xs font-bold text-slate-800 dark:text-slate-400 sm:text-sm">
                <DynamicIcon icon={icons?.wallet_admin} fallback="🏛️" width={16} height={16} /> للإدارة
              </p>
              <p className="text-lg font-black tabular-nums text-slate-900 sm:text-2xl dark:text-slate-100">{handToAdminStr}</p>
            </div>
          </div>
        );
      case "tips_blocks":
        return (
          <div key="tips" className="grid grid-cols-2 gap-2 sm:gap-3">
            <div className="kse-glass-dark flex items-center justify-between rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 shadow-sm dark:bg-amber-900/20 dark:border-amber-800">
              <p className="flex items-center gap-1 text-[10px] font-bold text-amber-900 dark:text-amber-400 sm:text-xs">
                <DynamicIcon icon={icons?.wallet_tips_daily} fallback="🎁" width={14} height={14} /> إكرامية اليوم
              </p>
              <p className="text-lg font-black tabular-nums text-amber-950 sm:text-2xl dark:text-amber-100">{earningsDailyStr || "0"}</p>
            </div>
            <div className="kse-glass-dark flex items-center justify-between rounded-xl border border-sky-300 bg-sky-50 px-3 py-2 shadow-sm dark:bg-sky-900/20 dark:border-sky-800">
              <p className="flex items-center gap-1 text-[10px] font-bold text-sky-900 dark:text-sky-400 sm:text-xs">
                <DynamicIcon icon={icons?.wallet_tips_monthly} fallback="🗓️" width={14} height={14} /> إكرامية الشهر
              </p>
              <p className="text-lg font-black tabular-nums text-sky-950 sm:text-2xl dark:text-sky-100">{earningsMonthlyStr || "0"}</p>
            </div>
          </div>
        );
      default: return null;
    }
  };

  const layout = uiSettings?.layoutOrder && uiSettings.layoutOrder.length > 0
    ? uiSettings.layoutOrder
    : ["wallet_in_out", "site_and_remain", "cash_in_hand", "available_for_transfer", "earnings_and_admin", "tips_blocks"];

  return (
    <div className="space-y-5" dir="rtl">

      {pendingIncoming.length > 0 && (
        <div className="rounded-2xl border-2 border-amber-400 bg-amber-50 px-4 py-4 dark:bg-amber-900/20 dark:border-amber-800 shadow-sm animate-in fade-in">
          <p className="text-base font-black text-slate-900 dark:text-amber-400">لديك {pendingIncoming.length} تحويل بانتظار موافقتك</p>
          <ul className="mt-3 space-y-3">
            {pendingIncoming.map((p) => (
              <li key={p.id} className="rounded-xl border border-slate-200 bg-white px-3 py-3 dark:bg-slate-900 dark:border-slate-800">
                <p className="text-base font-bold text-slate-900 dark:text-slate-100">{formatDinarAsAlf(p.amountDinar)} — من {p.fromLabel}</p>
                <div className="mt-3 flex gap-2">
                  <form action={respondAction}>
                    <input type="hidden" name="c" value={auth.c} /><input type="hidden" name="exp" value={auth.exp} /><input type="hidden" name="s" value={auth.s} /><input type="hidden" name="next" value={walletPathWithQuery} /><input type="hidden" name="transferId" value={p.id} /><input type="hidden" name="accept" value="1" />
                    <button
                      type="submit"
                      disabled={respondPending}
                      className={`rounded-xl px-6 py-2 text-sm font-black text-white shadow-sm transition ${
                        respondPending
                          ? "cursor-wait bg-emerald-400"
                          : "bg-emerald-600 hover:bg-emerald-700"
                      }`}
                    >
                      {respondPending ? "جاري المعالجة..." : "قبول"}
                    </button>
                  </form>
                  <form action={respondAction}>
                    <input type="hidden" name="c" value={auth.c} /><input type="hidden" name="exp" value={auth.exp} /><input type="hidden" name="s" value={auth.s} /><input type="hidden" name="next" value={walletPathWithQuery} /><input type="hidden" name="transferId" value={p.id} /><input type="hidden" name="accept" value="0" />
                    <button
                      type="submit"
                      disabled={respondPending}
                      className={`rounded-xl border px-6 py-2 text-sm font-black transition ${
                        respondPending
                          ? "cursor-wait border-rose-300 bg-rose-100 text-rose-400 dark:border-rose-900 dark:bg-slate-800"
                          : "border-rose-500 text-rose-600 dark:bg-slate-800 hover:bg-rose-50"
                      }`}
                    >
                      {respondPending ? "جاري المعالجة..." : "رفض"}
                    </button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* المربعات الحسابية مرتبة ديناميكياً */}
      <div className="space-y-3" style={containerStyle}>
        {layout.map(id => renderAccountingBlock(id))}
      </div>

      <div className="rounded-2xl border border-slate-200/90 bg-gradient-to-b from-slate-50 to-indigo-50/30 px-4 py-4 dark:from-slate-900 dark:to-slate-800 shadow-inner">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-base font-black text-slate-900 dark:text-slate-100">أخذت · تحويل · أعطيت</h2>
          <div className="flex flex-1 items-center gap-2 sm:max-w-md">
            <label htmlFor="wallet-search" className="sr-only">بحث في المحفظة</label>
            <input
              id="wallet-search"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="ابحث في الحركات..."
              enterKeyHint="search"
              className="w-full rounded-2xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-900 shadow-sm outline-none transition focus:border-violet-500 focus:ring-2 focus:ring-violet-200 dark:bg-slate-900 dark:border-slate-700 dark:text-slate-100 dark:focus:border-violet-400 dark:focus:ring-violet-500/20"
            />
            {query ? (
              <button type="button" onClick={() => setQuery("")} className="rounded-2xl bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300">
                مسح
              </button>
            ) : null}
          </div>
        </div>
        <div className="mt-4 flex w-full gap-2 sm:gap-3">
          <button type="button" onClick={() => { setTransferOpen(false); setMiscPanel(p => p === "take" ? null : "take"); }} className={`min-h-[48px] flex-1 rounded-xl border-2 px-2 py-2.5 text-base font-black shadow-sm transition ${miscPanel === "take" ? "border-red-600 bg-red-600 text-white" : "border-red-500 bg-white text-red-900 dark:bg-slate-800 dark:text-red-400"}`}>أخذت</button>
          <button type="button" onClick={() => { setMiscPanel(null); setTransferOpen(o => !o); }} className={`min-h-[48px] flex-1 rounded-xl border-2 px-2 py-2.5 text-base font-black shadow-sm transition ${transferOpen ? "border-violet-600 bg-violet-600 text-white" : "border-violet-500 bg-violet-100 text-violet-950 dark:bg-slate-800 dark:text-violet-400"}`}>تحويل</button>
          <button type="button" onClick={() => { setTransferOpen(false); setMiscPanel(p => p === "give" ? null : "give"); }} className={`min-h-[48px] flex-1 rounded-xl border-2 px-2 py-2.5 text-base font-black shadow-sm transition ${miscPanel === "give" ? "border-emerald-600 bg-emerald-600 text-white" : "border-emerald-600 bg-white text-emerald-900 dark:bg-slate-800 dark:text-emerald-400"}`}>أعطيت</button>
        </div>

        {(miscPanel || transferOpen) && (
          <form action={transferOpen ? createAction : miscSubmitAction} className={`mt-4 space-y-3 rounded-xl border-2 p-4 shadow-xl ${transferOpen ? "border-violet-200 bg-white dark:bg-slate-900 dark:border-slate-700" : miscPanel === "take" ? "border-red-500 bg-red-50 dark:bg-red-950/20" : "border-emerald-600 bg-lime-50 dark:bg-emerald-950/20"}`}>
            <input type="hidden" name="c" value={auth.c} /><input type="hidden" name="exp" value={auth.exp} /><input type="hidden" name="s" value={auth.s} /><input type="hidden" name="next" value={walletPathWithQuery} />
            {!transferOpen && <input type="hidden" name="direction" value={miscPanel!} />}
            {transferOpen && (
              <div className="flex gap-2">
                {([["courier", "مندوب"], ["employee", "مجهز"], ["admin", "الإدارة"]] as const).map(([v, l]) => (
                  <label key={v} className={`flex-1 text-center py-2.5 rounded-xl border-2 text-xs font-black cursor-pointer transition-all ${toKind === v ? "border-violet-600 bg-violet-600 text-white shadow-md" : "border-slate-200 bg-white text-slate-700 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-400"}`}>
                    <input type="radio" name="toKind" value={v} className="sr-only" checked={toKind === v} onChange={e => setToKind(e.target.value as any)} /> {l}
                  </label>
                ))}
              </div>
            )}
            {transferOpen && toKind === "courier" && (
              <select name="toCourierId" required className="w-full bg-slate-50 dark:bg-slate-800 border-2 border-slate-200 p-3 rounded-xl font-bold text-sm">
                <option value="">— اختر المندوب —</option>
                {transferTargetCouriers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            )}
            {transferOpen && toKind === "employee" && (
              <select name="toEmployeeId" required className="w-full bg-slate-50 dark:bg-slate-800 border-2 border-slate-200 p-3 rounded-xl font-bold text-sm">
                <option value="">— اختر المجهز —</option>
                {transferTargetEmployees.map(em => <option key={em.id} value={em.id}>{em.name} ({em.shopName})</option>)}
              </select>
            )}
            <input name="amountAlf" required inputMode="decimal" placeholder="المبلغ..." className="w-full bg-slate-50 dark:bg-slate-800 border-2 border-slate-200 p-3 rounded-xl font-black text-xl text-center shadow-inner" />
            <input name={transferOpen ? "handoverLocation" : "label"} required placeholder={transferOpen ? "مكان التسليم..." : "اسم المعاملة..."} className="w-full bg-slate-50 dark:bg-slate-800 border-2 border-slate-200 p-3 rounded-xl font-bold text-sm shadow-inner" />
            <button
              type="submit"
              disabled={createPending || miscSubmitPending}
              className={`w-full rounded-xl py-4 text-base font-black text-white shadow-lg transition ${
                createPending || miscSubmitPending
                  ? "cursor-wait bg-indigo-400"
                  : "bg-indigo-600 hover:bg-indigo-700"
              }`}
            >
              {createPending || miscSubmitPending ? "جاري تنفيذ العملية..." : "إتمام العملية"}
            </button>
          </form>
        )}
      </div>

      <ul className="space-y-3 pb-8">
        {filteredLedger.map((line) => {
          const deleted = line.deletedAt != null;
          const isRejected = line.source === "transfer_rejected";
          const isOutPick = line.kind === MONEY_KIND_PICKUP || line.kind === MISC_LEDGER_KIND_GIVE || line.kind === LEDGER_KIND_TRANSFER_PENDING_OUT || line.kind === "transfer_rejected_out";
          const isInPick = line.kind === MONEY_KIND_DELIVERY || line.kind === MISC_LEDGER_KIND_TAKE || line.kind === LEDGER_KIND_TRANSFER_PENDING_IN || line.kind === "transfer_rejected_in";
          const dirLabel = ledgerDirLabel(line);
          const dateStr = new Date(line.createdAt).toLocaleString("ar-IQ-u-nu-latn", { day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });
          const diff = (line.expectedDinar != null) ? line.amountDinar - line.expectedDinar : 0;
          const hasMismatch = line.expectedDinar != null && Math.abs(diff) > 0.01;
          const orderHref = line.source === "order" ? buildOrderHref(auth, line.orderId) : null;
          const cashBalance = (line.balanceEarnings ?? 0) + (line.balanceAdmin ?? 0);
          const orderAreaLabel = line.regionName ? `${line.shopName}_${line.regionName}` : line.shopName;
          const amountSuffix = !deleted && line.source === "order" && line.expectedDinar != null && !hasMismatch ? (
            <span className="inline-flex items-center">
              <DynamicIcon icon={icons?.ui_success} fallback=" ✅" width={14} height={14} />
            </span>
          ) : "";

          const content = (
            <div className={`relative flex flex-col gap-1 rounded-2xl border-2 px-4 py-3 transition-all shadow-sm backdrop-blur-[2px] ${
              deleted || isRejected ? "border-slate-300 bg-slate-100/90 text-slate-600 dark:bg-slate-800" :
              isInPick ? "border-rose-500/60 bg-rose-500/20 dark:bg-rose-500/25 dark:border-rose-500/50" :
              isOutPick ? "border-emerald-500/60 bg-emerald-500/20 dark:bg-emerald-500/25 dark:border-emerald-500/50" :
              "border-slate-200 bg-white dark:bg-slate-900 dark:border-slate-800"
            }`}>
              <div className="flex flex-col min-w-0 pl-10 sm:pl-12">
                <div className="flex items-center flex-wrap gap-x-2 gap-y-1">
                  <p className={`flex items-center gap-1.5 text-base font-black sm:text-lg truncate ${!deleted ? "text-slate-950 dark:text-white" : "text-slate-500"}`}>
                    {dirLabel} · {formatDinarAsAlf(line.amountDinar)}{amountSuffix}
                  </p>

                  {!deleted && line.source === "order" && line.expectedDinar != null && hasMismatch && (
                    <div className={`inline-flex items-center gap-1 rounded-lg border-2 px-2 py-0.5 text-[11px] font-black whitespace-nowrap ${
                      diff > 0 ? "border-amber-600 bg-amber-500 text-white dark:text-amber-700 shadow-sm" :
                      "border-rose-600 bg-rose-500 text-white dark:text-rose-50 shadow-sm"
                    }`}>
                      <DynamicIcon icon={diff > 0 ? icons?.ui_warning : icons?.ui_alert} fallback={diff > 0 ? "⚠️" : "🚨"} width={12} height={12} />
                      <span>{diff > 0 ? "زيادة" : "نقص"}</span>
                      <span className="tabular-nums">({formatDinarAsAlf(Math.abs(diff))})</span>
                    </div>
                  )}

                  <span className={`flex items-center gap-1 text-[10px] font-bold ${!deleted ? "text-slate-600 dark:text-slate-400" : "text-slate-400"}`}>
                    <DynamicIcon icon={icons?.ui_time} fallback="(" width={10} height={10} className="sm:hidden" />
                    {dateStr}
                    <span className="sm:hidden">)</span>
                  </span>
                </div>

                <p className={`flex items-center gap-1 mt-0.5 text-sm font-bold truncate ${!deleted ? "text-slate-800 dark:text-slate-300" : "text-slate-500"}`}>
                  {line.source === "order" ? (
                    <>
                      <DynamicIcon icon={icons?.ui_number} fallback="🔢" width={14} height={14} /> {line.orderNumber} — {orderAreaLabel}
                    </>
                  ) : (line.miscLabel ?? "—")}
                </p>
                {line.balanceAfter !== undefined && !deleted && (
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    <span className="text-[10px] font-black bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded text-emerald-800 dark:text-emerald-300">
                      عندي كاش: {formatDinarAsAlf(cashBalance)}
                    </span>
                    <span className="text-[10px] font-black bg-sky-500/10 border border-sky-500/20 px-1.5 py-0.5 rounded text-sky-800 dark:text-sky-300">
                      أرباحي: {formatDinarAsAlf(line.balanceEarnings ?? 0)}
                    </span>
                    <span className="text-[10px] font-black bg-slate-900/10 dark:bg-white/10 border border-slate-300/20 px-1.5 py-0.5 rounded text-slate-700 dark:text-slate-300">
                      للإدارة: {formatDinarAsAlf(line.balanceAdmin ?? 0)}
                    </span>
                  </div>
                )}
              </div>

              {!deleted && !isRejected && line.source !== "transfer_pending" && (
                <form action={line.source === "order" ? deleteAction : miscDelAction} className="absolute left-2 top-1/2 -translate-y-1/2 z-10" onClick={(e) => e.stopPropagation()}>
                  <input type="hidden" name="c" value={auth.c} /><input type="hidden" name="exp" value={auth.exp} /><input type="hidden" name="s" value={auth.s} />
                  <input type="hidden" name={line.source === "order" ? "eventId" : "miscEntryId"} value={line.id} />
                  <input type="hidden" name="next" value={walletPathWithQuery} />
                  <button type="submit" className="flex h-10 w-10 items-center justify-center rounded-xl bg-white dark:bg-slate-800 border-2 border-rose-500 text-sm shadow-md hover:scale-105 transition-transform" title="حذف">
                    <DynamicIcon icon={icons?.ui_delete} fallback="🗑️" width={18} height={18} />
                  </button>
                </form>
              )}
            </div>
          );

          return (
            <li key={`${line.source}-${line.id}`}>
              {orderHref ? (
                <Link
                  href={orderHref}
                  className="block w-full text-right active:opacity-80 transition-opacity"
                >
                  {content}
                </Link>
              ) : content}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
