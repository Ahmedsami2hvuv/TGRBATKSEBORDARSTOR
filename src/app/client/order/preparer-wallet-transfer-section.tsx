"use client";

import { useActionState, useState } from "react";
import {
  createWalletPeerTransferFromEmployee,
  respondWalletPeerTransferByEmployee,
  type WalletPeerTransferState,
} from "@/app/wallet-peer-transfer-actions";
import { formatDinarAsAlfWithUnit } from "@/lib/money-alf";

export type TransferTargetCourier = { id: string; name: string };
export type TransferTargetEmployee = { id: string; name: string; shopName: string; phone: string };

export type PendingIncomingTransfer = {
  id: string;
  amountDinar: number;
  fromLabel: string;
  handoverLocation: string;
  createdAt: string;
};

const initialTransfer: WalletPeerTransferState = {};

export function PreparerWalletTransferSection({
  auth,
  walletPathWithQuery,
  transferTargetCouriers,
  transferTargetEmployees,
  selfEmployeeId,
  pendingIncoming,
  availableForTransferStr,
  pendingOutgoingCount,
}: {
  auth: { e: string; exp: string; s: string };
  walletPathWithQuery: string;
  transferTargetCouriers: TransferTargetCourier[];
  transferTargetEmployees: TransferTargetEmployee[];
  selfEmployeeId: string;
  pendingIncoming: PendingIncomingTransfer[];
  availableForTransferStr: string;
  pendingOutgoingCount: number;
}) {
  const [open, setOpen] = useState(false);
  const [toKind, setToKind] = useState<"" | "courier" | "employee" | "admin">("");
  const [createState, createAction, createPending] = useActionState(
    createWalletPeerTransferFromEmployee,
    initialTransfer,
  );
  const [respondState, respondAction, respondPending] = useActionState(
    respondWalletPeerTransferByEmployee,
    initialTransfer,
  );

  const err = createState.error || respondState.error;

  const employeesExcludingSelf = transferTargetEmployees.filter((x) => x.id !== selfEmployeeId);

  return (
    <div className="space-y-4">
      {pendingIncoming.length > 0 ? (
        <div className="rounded-xl border-2 border-amber-400 bg-amber-50/95 px-3 py-3 sm:px-4 dark:bg-amber-900/20 dark:border-amber-800">
          <p className="text-base font-black text-amber-950 sm:text-lg dark:text-amber-400">
            لديك {pendingIncoming.length} تحويل{pendingIncoming.length > 1 ? "ات" : ""} بانتظار موافقتك
          </p>
          <ul className="mt-3 space-y-3">
            {pendingIncoming.map((p) => (
              <li
                key={p.id}
                className="rounded-xl border border-amber-300 bg-white/90 px-3 py-3 sm:px-4 dark:bg-slate-900 dark:border-amber-900"
              >
                <p className="text-lg font-black text-slate-900 dark:text-slate-100">
                  {formatDinarAsAlfWithUnit(p.amountDinar)} — من {p.fromLabel}
                </p>
                <p className="mt-1 text-sm font-semibold text-slate-700 dark:text-slate-400">
                  مكان التسليم: {p.handoverLocation}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  {new Date(p.createdAt).toLocaleString("ar-IQ-u-nu-latn", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <form action={respondAction}>
                    <input type="hidden" name="e" value={auth.e} />
                    <input type="hidden" name="exp" value={auth.exp} />
                    <input type="hidden" name="s" value={auth.s} />
                    <input type="hidden" name="next" value={walletPathWithQuery} />
                    <input type="hidden" name="transferId" value={p.id} />
                    <input type="hidden" name="accept" value="1" />
                    <button
                      type="submit"
                      disabled={respondPending}
                      className="min-h-[44px] rounded-xl border-2 border-emerald-600 bg-emerald-600 px-4 py-2 text-sm font-black text-white shadow-sm hover:bg-emerald-700 disabled:opacity-60"
                    >
                      قبول
                    </button>
                  </form>
                  <form action={respondAction}>
                    <input type="hidden" name="e" value={auth.e} />
                    <input type="hidden" name="exp" value={auth.exp} />
                    <input type="hidden" name="s" value={auth.s} />
                    <input type="hidden" name="next" value={walletPathWithQuery} />
                    <input type="hidden" name="transferId" value={p.id} />
                    <input type="hidden" name="accept" value="0" />
                    <button
                      type="submit"
                      disabled={respondPending}
                      className="min-h-[44px] rounded-xl border-2 border-rose-500 bg-white px-4 py-2 text-sm font-black text-rose-800 shadow-sm hover:bg-rose-50 disabled:opacity-60 dark:bg-slate-800 dark:text-rose-400 dark:border-rose-900"
                    >
                      رفض
                    </button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="rounded-xl border border-teal-200/90 bg-teal-50/50 px-3 py-3 sm:px-4 dark:bg-teal-950/20 dark:border-teal-900">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-bold text-teal-950 sm:text-lg dark:text-teal-400">تحويل أموال</h2>
            <p className="mt-1 text-xs text-teal-900/85 sm:text-sm dark:text-teal-500/80">
              تسليم نقد لمندوب أو <strong>مجهز</strong> آخر أو للإدارة. يبقى معلّقاً حتى يقبل المستلم (ما عدا
              التحويل للإدارة).
            </p>
          </div>
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            className="min-h-[44px] shrink-0 rounded-xl border-2 border-teal-600 bg-teal-600 px-4 py-2 text-sm font-black text-white shadow-sm hover:bg-teal-700"
          >
            {open ? "إغلاق" : "تحويل أموال"}
          </button>
        </div>

        {err ? (
          <div className="mt-3 rounded-lg border border-rose-300 bg-rose-50 px-3 py-2 text-sm font-bold text-rose-900 dark:bg-rose-900/20 dark:border-rose-800 dark:text-rose-400">
            {err}
          </div>
        ) : null}

        {open ? (
          <form action={createAction} className="mt-4 space-y-3 rounded-xl border border-white/80 bg-white/90 p-3 shadow-sm dark:bg-slate-900 dark:border-slate-800">
            <input type="hidden" name="e" value={auth.e} />
            <input type="hidden" name="exp" value={auth.exp} />
            <input type="hidden" name="s" value={auth.s} />
            <input type="hidden" name="next" value={walletPathWithQuery} />

            <fieldset>
              <legend className="text-sm font-bold text-slate-800 dark:text-slate-300">المستلم</legend>
              <div className="mt-2 flex flex-wrap gap-2">
                {(
                  [
                    ["courier", "مندوب"],
                    ["employee", "مجهز"],
                    ["admin", "الإدارة"],
                  ] as const
                ).map(([value, label]) => (
                  <label
                    key={value}
                    className={`inline-flex cursor-pointer items-center gap-2 rounded-xl border-2 px-3 py-2 text-sm font-bold transition-all ${
                      toKind === value
                        ? "border-teal-600 bg-teal-600 text-white"
                        : "border-slate-200 bg-white text-slate-800 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300"
                    }`}
                  >
                    <input
                      type="radio"
                      name="toKind"
                      value={value}
                      className="sr-only"
                      checked={toKind === value}
                      onChange={() => setToKind(value)}
                    />
                    {label}
                  </label>
                ))}
              </div>
            </fieldset>

            {toKind === "courier" && (
              <label className="block text-sm font-bold text-slate-800 dark:text-slate-300">
                اختر المندوب <span className="text-rose-600">*</span>
                <select
                  name="toCourierId"
                  required
                  className="mt-1 w-full rounded-xl border-2 border-slate-200 px-3 py-2 text-base font-medium text-slate-900 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-100"
                  defaultValue=""
                >
                  <option value="" disabled>
                    — اختر —
                  </option>
                  {transferTargetCouriers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
            )}

            {toKind === "employee" && (
              <div className="space-y-2">
                <label className="block text-sm font-bold text-slate-800 dark:text-slate-300">
                  اختر المجهز الآخر <span className="text-rose-600">*</span>
                  <select
                    name="toEmployeeId"
                    required
                    className="mt-1 w-full rounded-xl border-2 border-slate-200 px-3 py-2 text-base font-medium text-slate-900 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-100"
                    defaultValue=""
                  >
                    <option value="" disabled>
                      — اختر مجهزاً مسجّلاً —
                    </option>
                    {employeesExcludingSelf.map((em) => (
                      <option key={em.id} value={em.id}>
                        مجهز · {em.name} · هاتف {em.phone || "—"} · {em.shopName}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            )}

            <label className="block text-sm font-bold text-slate-800 dark:text-slate-300">
              مكان التسليم <span className="text-rose-600">*</span>
              <input
                name="handoverLocation"
                required
                maxLength={500}
                autoComplete="off"
                placeholder="مثال: أمام المحل…"
                className="mt-1 w-full rounded-xl border-2 border-slate-200 px-3 py-2 text-base font-medium text-slate-900 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-100 placeholder:text-slate-500"
              />
            </label>

            <label className="block text-sm font-bold text-slate-800 dark:text-slate-300">
              المبلغ (دينار) <span className="text-rose-600">*</span>
              <input
                name="amountAlf"
                required
                inputMode="decimal"
                autoComplete="off"
                placeholder="0"
                className="mt-1 w-full rounded-xl border-2 border-slate-200 px-3 py-2 font-mono text-base font-bold tabular-nums text-slate-900 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-100 placeholder:text-slate-500"
              />
            </label>

            <button
              type="submit"
              disabled={createPending || !toKind}
              className="w-full rounded-xl border-2 border-teal-700 bg-teal-700 py-3 text-base font-black text-white shadow-sm hover:bg-teal-800 disabled:opacity-60"
            >
              {createPending ? "جارٍ الإرسال…" : "إرسال التحويل"}
            </button>
          </form>
        ) : null}
      </div>
    </div>
  );
}
