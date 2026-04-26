"use client";

import { useActionState, useState } from "react";
import type { EmployeeWalletMiscState, WalletPeerTransferState } from "./actions";
import {
  createWalletPeerTransferFromCompanyPreparer,
  respondWalletPeerTransferByCompanyPreparer,
  submitEmployeeWalletMiscEntryFromCompanyPreparer,
} from "./actions";
import { formatDinarAsAlfWithUnit } from "@/lib/money-alf";
import {
  moneyLedgerAmountClass,
  moneyMiscSaderAmountInputClass,
  moneyMiscWardAmountInputClass,
  moneyTransferAmountInputClass,
} from "@/lib/money-entry-ui";

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
const initialMisc: EmployeeWalletMiscState = {};

export function PreparerWalletTransferSection({
  auth,
  walletPathWithQuery,
  transferTargetCouriers,
  transferTargetEmployees,
  selfEmployeeId,
  pendingIncoming,
  availableForTransferStr,
  pendingOutgoingCount,
  walletInStr,
  walletOutStr,
  walletRemainStr,
}: {
  auth: { p: string; exp: string; s: string };
  walletPathWithQuery: string;
  transferTargetCouriers: TransferTargetCourier[];
  transferTargetEmployees: TransferTargetEmployee[];
  selfEmployeeId: string;
  pendingIncoming: PendingIncomingTransfer[];
  availableForTransferStr: string;
  pendingOutgoingCount: number;
  /** عند تمريرها معاً: الأرقام والأزرار داخل المربعات (محفظة المجهز) */
  walletInStr?: string;
  walletOutStr?: string;
  walletRemainStr?: string;
}) {
  const [miscPanel, setMiscPanel] = useState<null | "take" | "give">(null);
  const [transferOpen, setTransferOpen] = useState(false);
  const [toKind, setToKind] = useState<"" | "courier" | "employee" | "admin">("");

  const [createState, createAction, createPending] = useActionState(
    createWalletPeerTransferFromCompanyPreparer,
    initialTransfer,
  );
  const [respondState, respondAction, respondPending] = useActionState(
    respondWalletPeerTransferByCompanyPreparer,
    initialTransfer,
  );
  const [miscSubmitState, miscSubmitAction, miscSubmitPending] = useActionState(
    submitEmployeeWalletMiscEntryFromCompanyPreparer,
    initialMisc,
  );

  const err =
    createState.error || respondState.error || miscSubmitState.error || null;

  const employeesExcludingSelf = transferTargetEmployees.filter((x) => x.id !== selfEmployeeId);

  const statsInBoxes =
    walletInStr != null && walletInStr !== "" &&
    walletOutStr != null && walletOutStr !== "" &&
    walletRemainStr != null && walletRemainStr !== "";

  return (
    <div className="space-y-4">
      {pendingIncoming.length > 0 ? (
        <div className="rounded-xl border-2 border-amber-400 bg-amber-50/95 px-3 py-3 sm:px-4">
          <p className="text-base font-black text-amber-950 sm:text-lg">
            لديك {pendingIncoming.length} تحويل{pendingIncoming.length > 1 ? "ات" : ""} بانتظار موافقتك
          </p>
          <ul className="mt-3 space-y-3">
            {pendingIncoming.map((p) => (
              <li
                key={p.id}
                className="rounded-xl border border-amber-300 bg-white/90 px-3 py-3 sm:px-4"
              >
                <p className="text-base font-bold text-slate-900">
                  <span className={moneyLedgerAmountClass}>
                    {formatDinarAsAlfWithUnit(p.amountDinar)}
                  </span>{" "}
                  — من {p.fromLabel}
                </p>
                <p className="mt-1 text-sm font-semibold text-slate-700">
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
                    <input type="hidden" name="p" value={auth.p} />
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
                    <input type="hidden" name="p" value={auth.p} />
                    <input type="hidden" name="exp" value={auth.exp} />
                    <input type="hidden" name="s" value={auth.s} />
                    <input type="hidden" name="next" value={walletPathWithQuery} />
                    <input type="hidden" name="transferId" value={p.id} />
                    <input type="hidden" name="accept" value="0" />
                    <button
                      type="submit"
                      disabled={respondPending}
                      className="min-h-[44px] rounded-xl border-2 border-rose-500 bg-white px-4 py-2 text-sm font-black text-rose-800 shadow-sm hover:bg-rose-50 disabled:opacity-60"
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

      {err ? (
        <div className="rounded-xl border border-rose-300 bg-rose-50 px-3 py-2 text-sm font-bold text-rose-900">
          {err}
        </div>
      ) : null}

      <div className="rounded-xl border border-slate-200/90 bg-gradient-to-b from-slate-50/90 to-indigo-50/30 px-3 py-3 sm:px-4">
        <h2 className="text-base font-bold text-slate-900 sm:text-lg">أخذت · تحويل · أعطيت</h2>
        {statsInBoxes ? (
          <>
            <div className="mt-3 grid grid-cols-3 gap-2 sm:gap-3">
              <div className="flex min-h-[100px] flex-col justify-center rounded-xl border-2 border-red-700 bg-red-400 p-2 shadow-sm sm:min-h-[112px] sm:p-3">
                <p className="text-center text-[10px] font-bold leading-tight text-red-950 sm:text-xs">وارد</p>
                <p className="mt-1 text-center text-lg font-black tabular-nums leading-tight text-white drop-shadow-sm sm:text-2xl">
                  {walletInStr}
                </p>
              </div>
              <div className="flex min-h-[100px] flex-col justify-center rounded-xl border-2 border-violet-500 bg-violet-100/90 p-2 shadow-sm sm:min-h-[112px] sm:p-3">
                <p className="text-center text-[10px] font-bold leading-tight text-violet-900 sm:text-xs">متبقي</p>
                <p className="mt-1 text-center text-base font-black tabular-nums leading-tight text-violet-950 sm:text-xl">
                  {walletRemainStr}
                </p>
              </div>
              <div className="flex min-h-[100px] flex-col justify-center rounded-xl border-2 border-emerald-800 bg-lime-300 p-2 shadow-sm sm:min-h-[112px] sm:p-3">
                <p className="text-center text-[10px] font-bold leading-tight text-emerald-950 sm:text-xs">صادر</p>
                <p className="mt-1 text-center text-lg font-black tabular-nums leading-tight text-emerald-950 sm:text-2xl">
                  {walletOutStr}
                </p>
              </div>
            </div>
            <div className="mt-2 grid grid-cols-3 gap-2 sm:gap-3">
              <button
                type="button"
                onClick={() => {
                  setTransferOpen(false);
                  setMiscPanel((prev) => (prev === "take" ? null : "take"));
                }}
                className={`min-h-[44px] w-full rounded-lg border-2 px-1 py-2 text-xs font-black shadow-sm sm:min-h-[48px] sm:text-sm ${
                  miscPanel === "take"
                    ? "border-red-700 bg-red-600 text-white ring-2 ring-red-300"
                    : "border-red-600 bg-white text-red-900 hover:bg-red-100"
                }`}
              >
                أخذت
              </button>
              <button
                type="button"
                onClick={() => {
                  setMiscPanel(null);
                  setTransferOpen((o) => !o);
                }}
                className={`min-h-[44px] w-full rounded-lg border-2 px-1 py-2 text-xs font-black shadow-sm sm:min-h-[48px] sm:text-sm ${
                  transferOpen
                    ? "border-violet-700 bg-violet-600 text-white ring-2 ring-violet-300"
                    : "border-violet-600 bg-white text-violet-950 hover:bg-violet-200/90"
                }`}
              >
                تحويل
              </button>
              <button
                type="button"
                onClick={() => {
                  setTransferOpen(false);
                  setMiscPanel((prev) => (prev === "give" ? null : "give"));
                }}
                className={`min-h-[44px] w-full rounded-lg border-2 px-1 py-2 text-xs font-black shadow-sm sm:min-h-[48px] sm:text-sm ${
                  miscPanel === "give"
                    ? "border-emerald-700 bg-emerald-600 text-white ring-2 ring-emerald-300"
                    : "border-emerald-600 bg-white text-emerald-900 hover:bg-emerald-50"
                }`}
              >
                أعطيت
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="mt-3 flex w-full gap-2 sm:gap-3">
              <button
                type="button"
                onClick={() => {
                  setTransferOpen(false);
                  setMiscPanel((prev) => (prev === "take" ? null : "take"));
                }}
                className={`min-h-[48px] flex-1 rounded-xl border-2 px-2 py-2.5 text-base font-black shadow-sm transition sm:min-h-[44px] sm:px-4 ${
                  miscPanel === "take"
                    ? "border-red-600 bg-red-600 text-white ring-2 ring-red-300"
                    : "border-red-500 bg-white text-red-900 hover:bg-red-50"
                }`}
              >
                أخذت
              </button>
              <button
                type="button"
                onClick={() => {
                  setMiscPanel(null);
                  setTransferOpen((o) => !o);
                }}
                className={`min-h-[48px] flex-1 rounded-xl border-2 px-2 py-2.5 text-base font-black shadow-sm transition sm:min-h-[44px] sm:px-4 ${
                  transferOpen
                    ? "border-violet-600 bg-violet-600 text-white ring-2 ring-violet-300"
                    : "border-violet-500 bg-violet-100 text-violet-950 hover:bg-violet-200/90"
                }`}
              >
                تحويل
              </button>
              <button
                type="button"
                onClick={() => {
                  setTransferOpen(false);
                  setMiscPanel((prev) => (prev === "give" ? null : "give"));
                }}
                className={`min-h-[48px] flex-1 rounded-xl border-2 px-2 py-2.5 text-base font-black shadow-sm transition sm:min-h-[44px] sm:px-4 ${
                  miscPanel === "give"
                    ? "border-emerald-600 bg-emerald-600 text-white ring-2 ring-emerald-300"
                    : "border-emerald-600 bg-white text-emerald-900 hover:bg-emerald-50"
                }`}
              >
                أعطيت
              </button>
            </div>
          </>
        )}
        {miscPanel === "take" || miscPanel === "give" ? (
          <form
            action={miscSubmitAction}
            className={`mt-4 space-y-3 rounded-xl border-2 p-3 shadow-sm ${
              miscPanel === "take"
                ? "border-red-500 bg-red-100/90"
                : "border-emerald-600 bg-lime-100/90"
            }`}
          >
            <input type="hidden" name="p" value={auth.p} />
            <input type="hidden" name="exp" value={auth.exp} />
            <input type="hidden" name="s" value={auth.s} />
            <input type="hidden" name="next" value={walletPathWithQuery} />
            <input type="hidden" name="direction" value={miscPanel} />
            <label className="block text-sm font-bold text-slate-800">
              اسم المعاملة <span className="text-rose-600">*</span>
              <input
                name="label"
                required
                maxLength={200}
                autoComplete="off"
                placeholder="مثال: تحويل من الإدارة، تسديد لزبون…"
                className="mt-1 w-full rounded-xl border-2 border-slate-200 px-3 py-2 text-base font-medium text-slate-900"
              />
            </label>
            <label className="block text-sm font-bold text-slate-800">
              المبلغ (دينار) <span className="text-rose-600">*</span>
              <input
                name="amountAlf"
                required
                inputMode="decimal"
                autoComplete="off"
                placeholder="0"
                className={`mt-1 ${
                  miscPanel === "take" ? moneyMiscWardAmountInputClass : moneyMiscSaderAmountInputClass
                }`}
              />
            </label>
            <button
              type="submit"
              disabled={miscSubmitPending}
              className="w-full rounded-xl border-2 border-indigo-600 bg-indigo-600 py-3 text-base font-black text-white shadow-sm hover:bg-indigo-700 disabled:opacity-60"
            >
              {miscSubmitPending
                ? "جارٍ الحفظ…"
                : miscPanel === "take"
                  ? "تسجيل «أخذت»"
                  : "تسجيل «أعطيت»"}
            </button>
          </form>
        ) : null}
        {transferOpen ? (
          <form
            action={createAction}
            className="mt-4 space-y-3 rounded-xl border border-violet-200/90 bg-violet-50/95 p-3 shadow-sm"
          >
            <input type="hidden" name="p" value={auth.p} />
            <input type="hidden" name="exp" value={auth.exp} />
            <input type="hidden" name="s" value={auth.s} />
            <input type="hidden" name="next" value={walletPathWithQuery} />

            <fieldset>
              <legend className="text-sm font-bold text-slate-800">المستلم</legend>
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
                    className={`inline-flex cursor-pointer items-center gap-2 rounded-xl border-2 px-3 py-2 text-sm font-bold ${
                      toKind === value
                        ? "border-violet-600 bg-violet-600 text-white"
                        : "border-violet-200/90 bg-violet-100/80 text-violet-950"
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
              <label className="block text-sm font-bold text-slate-800">
                اختر المندوب <span className="text-rose-600">*</span>
                <select
                  name="toCourierId"
                  required
                  className="mt-1 w-full rounded-xl border-2 border-slate-200 px-3 py-2 text-base font-medium text-slate-900"
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
                <label className="block text-sm font-bold text-slate-800">
                  اختر المجهز الآخر <span className="text-rose-600">*</span>
                  <select
                    name="toEmployeeId"
                    required
                    className="mt-1 w-full rounded-xl border-2 border-slate-200 px-3 py-2 text-base font-medium text-slate-900"
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

            <label className="block text-sm font-bold text-slate-800">
              مكان التسليم <span className="text-rose-600">*</span>
              <input
                name="handoverLocation"
                required
                maxLength={500}
                autoComplete="off"
                placeholder="مثال: أمام المحل، مستودع المنطقة…"
                className="mt-1 w-full rounded-xl border-2 border-slate-200 px-3 py-2 text-base font-medium text-slate-900"
              />
            </label>

            <label className="block text-sm font-bold text-slate-800">
              المبلغ (دينار) <span className="text-rose-600">*</span>
              <input
                name="amountAlf"
                required
                inputMode="decimal"
                autoComplete="off"
                placeholder="0"
                className={moneyTransferAmountInputClass}
              />
            </label>

            <button
              type="submit"
              disabled={createPending || !toKind}
              className="w-full rounded-xl border-2 border-violet-700 bg-violet-700 py-3 text-base font-black text-white shadow-sm hover:bg-violet-800 disabled:opacity-60"
            >
              {createPending ? "جارٍ الإرسال…" : "إرسال التحويل"}
            </button>
          </form>
        ) : null}
      </div>
    </div>
  );
}
