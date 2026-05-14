"use client";

import { useActionState, useMemo, useState } from "react";
import { softDeletePreparerMoneyEvent, type PreparerCashState } from "@/app/preparer/preparer-cash-actions";
import * as PreparerWalletActions from "@/app/preparer/wallet/actions";
import { formatDinarAsAlfWithUnit } from "@/lib/money-alf";
import {
  LEDGER_KIND_TRANSFER_PENDING_IN,
  LEDGER_KIND_TRANSFER_PENDING_OUT,
  MISC_LEDGER_KIND_GIVE,
  MISC_LEDGER_KIND_TAKE,
  MONEY_KIND_DELIVERY,
  MONEY_KIND_PICKUP,
} from "@/lib/mandoub-money-events";
import type { MandoubWalletLedgerLine } from "@/app/mandoub/mandoub-wallet-client";
import { ThemeSwitcher as ThemeToggle } from "@/components/theme-switcher";
import Link from "next/link";
import { UISectionConfig } from "@/lib/ui-settings";

const initialDelete: PreparerCashState = {};
const initialMiscDelete: PreparerWalletActions.EmployeeWalletMiscState = {};

function ledgerDirLabel(line: MandoubWalletLedgerLine): string {
  if (line.kind === LEDGER_KIND_TRANSFER_PENDING_IN) return "وارد معلّق";
  if (line.kind === LEDGER_KIND_TRANSFER_PENDING_OUT) return "صادر معلّق";
  if (line.kind === "transfer_rejected_in") return "وارد مرفوض";
  if (line.kind === "transfer_rejected_out") return "صادر مرفوض";
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

const EPS = 0.01;

/** علامة تحت زر المسح: مطابق / أقل / أعلى من المطلوب */
function PaymentAmountMark({ line }: { line: MandoubWalletLedgerLine }) {
  if (line.source !== "order" || line.expectedDinar == null) return null;
  const d = line.amountDinar - line.expectedDinar;
  if (Math.abs(d) < EPS) {
    return (
      <span className="text-base leading-none" title="المبلغ مطابق للمطلوب">
        ✅
      </span>
    );
  }
  if (d < -EPS) {
    return (
      <span className="text-lg font-black leading-none text-sky-800 dark:text-sky-200" title="أقل من المطلوب">
        {"<"}
      </span>
    );
  }
  return (
    <span className="text-lg font-black leading-none text-amber-800 dark:text-amber-200" title="أعلى من المطلوب">
      {">"}
    </span>
  );
}

export function PreparerWalletClient({
  ledger,
  orderLinkAuth,
  preparerDeleteAuth,
  preparerDeleteNextUrl,
  uiSettings,
  hideWalletSummary = false,
}: {
  ledger: MandoubWalletLedgerLine[];
  orderLinkAuth?: { p: string; exp: string; s: string };
  preparerDeleteAuth?: { p: string; exp: string; s: string };
  preparerDeleteNextUrl?: string;
  uiSettings?: UISectionConfig | null;
  hideWalletSummary?: boolean;
}) {
  const [deleteState, deleteAction, deletePending] = useActionState(softDeletePreparerMoneyEvent, initialDelete);
  const [deleteMiscState, deleteMiscAction, deleteMiscPending] = useActionState(PreparerWalletActions.softDeleteEmployeeWalletMiscEntryFromCompanyPreparer, initialMiscDelete);
  const [query, setQuery] = useState("");

  const filteredLedger = useMemo(() => {
    const normalizedQuery = query.trim();
    if (!normalizedQuery) return ledger;
    return ledger.filter((line) => matchesWalletQuery(line, normalizedQuery));
  }, [ledger, query]);

  const containerStyle = uiSettings ? {
    backgroundColor: uiSettings.backgroundColor,
    backgroundImage: uiSettings.backgroundImage ? `url(${uiSettings.backgroundImage})` : undefined,
    color: uiSettings.textColor,
    opacity: uiSettings.backgroundOpacity,
    borderRadius: uiSettings.borderRadius,
    backgroundSize: 'cover', backgroundPosition: 'center',
    padding: uiSettings.padding || '1.25rem'
  } : {};

  return (
    <div className="space-y-5" dir="rtl">
      <div className="flex justify-end px-1">
        <ThemeToggle />
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <label htmlFor="preparer-wallet-search" className="sr-only">بحث في المحفظة</label>
          <input
            id="preparer-wallet-search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="ابحث في الحركات..."
            enterKeyHint="search"
            className="w-full rounded-2xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-900 shadow-sm outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-200 dark:bg-slate-900 dark:border-slate-700 dark:text-slate-100 dark:focus:border-sky-400 dark:focus:ring-sky-500/20"
          />
          {query ? (
            <button type="button" onClick={() => setQuery("")} className="rounded-2xl bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300">
              مسح
            </button>
          ) : null}
        </div>
        <div className="text-xs font-semibold text-slate-500">عرض {filteredLedger.length} من {ledger.length}</div>
      </div>

      <ul className="space-y-3 pb-8" style={containerStyle}>
        {filteredLedger.map((line) => {
          const deleted = line.deletedAt != null;
          const isRejected = line.source === "transfer_rejected";
          const isInPick = line.kind === MONEY_KIND_DELIVERY || line.kind === MISC_LEDGER_KIND_TAKE || line.kind === LEDGER_KIND_TRANSFER_PENDING_IN || line.kind === "transfer_rejected_in";
          const isOutPick = line.kind === MONEY_KIND_PICKUP || line.kind === MISC_LEDGER_KIND_GIVE || line.kind === LEDGER_KIND_TRANSFER_PENDING_OUT || line.kind === "transfer_rejected_out";

          const dirLabel = ledgerDirLabel(line);
          const dateStr = new Date(line.createdAt).toLocaleString("ar-IQ-u-nu-latn", { day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });
          const orderHref = (orderLinkAuth && line.orderId) ? `/preparer/order/${line.orderId}?${new URLSearchParams({ p: orderLinkAuth.p, exp: orderLinkAuth.exp, s: orderLinkAuth.s }).toString()}` : null;
          const showDelete =
            !deleted &&
            !isRejected &&
            line.source !== "transfer_pending" &&
            !(line.source === "misc" && line.miscLabel?.startsWith("تحويل من ") && !line.miscLabel?.includes("مجهز") && !line.miscLabel?.includes("الإدارة"));

          return (
            <li key={`${line.source}-${line.id}`}>
              <div className={`relative flex flex-col gap-1.5 rounded-2xl border-2 px-4 py-3 transition-all shadow-sm ${
                deleted || isRejected ? "border-slate-300 bg-slate-100/90 text-slate-600 dark:bg-slate-800" :
                isInPick ? "border-red-600 bg-red-100/95 dark:bg-red-900/40 dark:border-red-800" :
                isOutPick ? "border-emerald-600 bg-emerald-100/95 dark:bg-emerald-900/40 dark:border-emerald-800" :
                "border-slate-200 bg-white dark:bg-slate-900 dark:border-slate-800"
              }`}>
                <div className={`flex min-w-0 flex-col ${showDelete ? "pl-12 sm:pl-14" : ""}`}>
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <p className={`text-base font-black sm:text-lg ${!deleted ? "text-slate-950 dark:text-white" : "text-slate-500"}`}>{dirLabel} · {formatDinarAsAlfWithUnit(line.amountDinar)}</p>
                    <span className={`text-[10px] font-bold ${!deleted ? "text-slate-600 dark:text-slate-400" : "text-slate-400"}`}>({dateStr})</span>
                  </div>
                  <p className={`mt-0.5 truncate text-sm font-bold ${!deleted ? "text-slate-800 dark:text-slate-300" : "text-slate-500"}`}>{line.source === "order" ? `طلب ${line.orderNumber} — ${line.shopName}` : (line.miscLabel ?? "—")}</p>
                  {line.balanceAfter !== undefined && !deleted && (
                    <div className="mt-1 flex items-center gap-1.5">
                      <span className="rounded bg-slate-950/10 px-1.5 py-0.5 text-[10px] font-bold text-slate-800 dark:bg-white/10 dark:text-slate-200">المتبقي: {formatDinarAsAlfWithUnit(line.balanceAfter)}</span>
                    </div>
                  )}
                </div>
                {showDelete ? (
                  <div
                    className="absolute left-2 top-1/2 z-10 flex -translate-y-1/2 flex-col items-center gap-0.5"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <form
                      action={line.source === "order" ? deleteAction : deleteMiscAction}
                      className="m-0"
                      onSubmit={(e) => {
                        if (!window.confirm(`تأكيد مسح هذه الحركة؟`)) e.preventDefault();
                      }}
                    >
                      <input type="hidden" name="p" value={preparerDeleteAuth!.p} /><input type="hidden" name="exp" value={preparerDeleteAuth!.exp} /><input type="hidden" name="s" value={preparerDeleteAuth!.s} /><input type="hidden" name={line.source === "order" ? "eventId" : "miscEntryId"} value={line.id} /><input type="hidden" name="next" value={preparerDeleteNextUrl} />
                      <button type="submit" className="flex h-10 w-10 items-center justify-center rounded-xl border-2 border-rose-500 bg-white text-sm shadow-md transition-transform hover:scale-105 dark:bg-slate-800">🗑️</button>
                    </form>
                    <PaymentAmountMark line={line} />
                  </div>
                ) : null}
                {orderHref && <Link href={orderHref} className="absolute inset-0 z-0" />}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
