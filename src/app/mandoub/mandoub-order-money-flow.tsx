"use client";

import { createPortal } from "react-dom";
import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import {
  submitMandoubDeliveryMoney,
  submitMandoubPickupMoney,
  softDeleteMandoubMoneyEvent,
  type MandoubCashState,
} from "./cash-actions";
import { MandoubOrderMoneyFloatDock } from "./mandoub-order-money-float-dock";
import {
  dinarDecimalToAlfInputString,
  formatDinarAsAlfWithUnit,
  parseAlfInputToDinarDecimalRequired,
} from "@/lib/money-alf";
import { MONEY_KIND_DELIVERY, MONEY_KIND_PICKUP } from "@/lib/mandoub-money-events";
import {
  moneyLedgerAmountClass,
  moneySaderAmountInputClass,
  moneySaderRemainValueClass,
  moneySaderSummaryBoxClass,
  moneySaderTotalValueClass,
  moneyWardAmountInputClass,
  moneyWardRemainValueClass,
  moneyWardSummaryBoxClass,
  moneyWardTotalValueClass,
} from "@/lib/money-entry-ui";

const initialCash: MandoubCashState = {};

function dinarTotalsMatchClient(totalDinar: number, expectedDinar: number | null): boolean {
  if (expectedDinar == null) return false;
  const r = (n: number) => Math.round(n * 100) / 100;
  return r(totalDinar) === r(expectedDinar);
}

export type MandoubMoneyEventUi = {
  id: string;
  kind: string;
  amountDinar: number;
  expectedDinar: number | null;
  matchesExpected: boolean;
  mismatchReason: string;
  mismatchNote: string;
  recordedAt: Date;
  deletedAt: Date | null;
  deletedReason: "manual_admin" | "manual_courier" | "manual_preparer" | "status_revert" | null;
  deletedByDisplayName: string | null;
  performedByDisplayName: string;
  recordedByCompanyPreparerId: string | null;
};

function formatRecordedAtClient(d: Date | string): string {
  const dateObj = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(dateObj.getTime())) return "—";
  const date = new Intl.DateTimeFormat("ar-IQ-u-nu-latn", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(dateObj);
  const time = new Intl.DateTimeFormat("ar-IQ-u-nu-latn", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(dateObj);
  return `${date} ${time}`;
}

function isManualDeletionReasonClient(
  r: MandoubMoneyEventUi["deletedReason"],
): boolean {
  return r === "manual_admin" || r === "manual_courier" || r === "manual_preparer";
}

export function MandoubOrderMoneyFlow({
  orderId,
  orderNumber,
  courierName,
  orderStatus,
  orderSubtotalDinar,
  totalAmountDinar,
  moneyEvents,
  auth,
  nextUrl,
  missingCustomerLocation,
  canRecordMoney = true,
}: {
  orderId: string;
  orderNumber: number;
  courierName: string;
  orderStatus: string;
  orderSubtotalDinar: number | null;
  totalAmountDinar: number | null;
  moneyEvents: MandoubMoneyEventUi[];
  auth: { c: string; exp: string; s: string };
  nextUrl: string;
  missingCustomerLocation: boolean;
  canRecordMoney?: boolean;
}) {
  const [pickupOpen, setPickupOpen] = useState(false);
  const [deliveryOpen, setDeliveryOpen] = useState(false);
  const [deliverySession, setDeliverySession] = useState(0);
  const [pickupAdvanceToDelivering, setPickupAdvanceToDelivering] = useState(false);
  const [deliveryAdvanceToDelivered, setDeliveryAdvanceToDelivered] = useState(false);

  const [pickupState, pickupAction, pickupPending] = useActionState(
    submitMandoubPickupMoney,
    initialCash,
  );
  const [deliveryState, deliveryAction, deliveryPending] = useActionState(
    submitMandoubDeliveryMoney,
    initialCash,
  );
  const [deleteState, deleteAction, deletePending] = useActionState(
    softDeleteMandoubMoneyEvent,
    initialCash,
  );

  const pickupSum = useMemo(
    () =>
      moneyEvents
        .filter((e) => e.kind === MONEY_KIND_PICKUP && e.deletedAt == null)
        .reduce((acc, e) => acc + e.amountDinar, 0),
    [moneyEvents],
  );
  const deliverySum = useMemo(
    () =>
      moneyEvents
        .filter((e) => e.kind === MONEY_KIND_DELIVERY && e.deletedAt == null)
        .reduce((acc, e) => acc + e.amountDinar, 0),
    [moneyEvents],
  );

  const pickupRemaining = useMemo(() => {
    if (orderSubtotalDinar == null) return null;
    return orderSubtotalDinar - pickupSum;
  }, [orderSubtotalDinar, pickupSum]);
  const deliveryRemaining = useMemo(() => {
    if (totalAmountDinar == null) return null;
    return totalAmountDinar - deliverySum;
  }, [totalAmountDinar, deliverySum]);

  const hasOrderSubtotal = orderSubtotalDinar != null;
  const hasTotalAmount = totalAmountDinar != null;

  const AMOUNT_EPS = 1e-3;
  const pickupComplete =
    orderSubtotalDinar != null &&
    Math.abs(pickupSum - orderSubtotalDinar) < AMOUNT_EPS;
  const deliveryComplete =
    totalAmountDinar != null &&
    Math.abs(deliverySum - totalAmountDinar) < AMOUNT_EPS;

  const showPickupBtn =
    canRecordMoney &&
    hasOrderSubtotal &&
    !pickupComplete &&
    (orderStatus === "assigned" ||
      orderStatus === "delivering" ||
      orderStatus === "delivered");

  const showDeliveryBtn = canRecordMoney && hasTotalAmount && !deliveryComplete;

  const canMarkPickedUp = canRecordMoney && orderStatus === "assigned" && hasOrderSubtotal;
  const canMarkDelivered = canRecordMoney && orderStatus === "delivering" && hasTotalAmount;

  const closePanels = () => {
    setPickupOpen(false);
    setDeliveryOpen(false);
    setPickupAdvanceToDelivering(false);
    setDeliveryAdvanceToDelivered(false);
  };

  return (
    <div className="mt-6 space-y-4 border-t border-sky-200 pt-5">
      <h3 className="text-lg font-bold text-slate-900">الصادر والوارد</h3>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {showPickupBtn ? (
          <button
            type="button"
            onClick={() => {
              setPickupAdvanceToDelivering(false);
              setPickupOpen(true);
              setDeliveryOpen(false);
            }}
            className="flex min-h-[56px] items-center justify-center gap-2 rounded-xl bg-emerald-700 font-black text-white shadow-sm transition hover:bg-emerald-800"
          >
            💸 دفع للعميل (صادر)
          </button>
        ) : null}

        {showDeliveryBtn ? (
          <button
            type="button"
            onClick={() => {
              setDeliveryAdvanceToDelivered(false);
              setDeliverySession((n) => n + 1);
              setDeliveryOpen(true);
              setPickupOpen(false);
            }}
            className="flex min-h-[56px] items-center justify-center gap-2 rounded-xl bg-red-700 font-black text-white shadow-sm transition hover:bg-red-800"
          >
            🫴 اخذت من الزبون (وارد)
          </button>
        ) : null}
      </div>

      <MandoubOrderMoneyFloatDock
        showStatusFab={canMarkPickedUp || canMarkDelivered}
        statusFabMode={canMarkPickedUp ? "pickedUp" : "delivered"}
        onStatusFabClick={() => {
          if (orderStatus === "assigned") {
            setPickupAdvanceToDelivering(true);
            setDeliveryOpen(false);
            setPickupOpen(true);
            return;
          }
          setDeliveryAdvanceToDelivered(true);
          setDeliverySession((n) => n + 1);
          setPickupOpen(false);
          setDeliveryOpen(true);
        }}
        showPickupBtn={false}
        showDeliveryBtn={false}
        pickupOpen={pickupOpen && pickupAdvanceToDelivering}
        deliveryOpen={deliveryOpen && deliveryAdvanceToDelivered}
        onOpenPickup={() => {}}
        onOpenDelivery={() => {}}
        onClosePanels={closePanels}
        pickupForm={
          <PickupMoneyForm
            orderId={orderId}
            auth={auth}
            nextUrl={nextUrl}
            expectedAlfHint={
              orderSubtotalDinar != null ? dinarDecimalToAlfInputString(orderSubtotalDinar) : ""
            }
            remainingAlfHint={
              pickupRemaining != null ? dinarDecimalToAlfInputString(pickupRemaining) : ""
            }
            advanceToDelivering={pickupAdvanceToDelivering}
            pickupRemainingDinar={pickupRemaining}
            pickupSumDinar={pickupSum}
            orderSubtotalDinar={orderSubtotalDinar}
            formAction={pickupAction}
            pending={pickupPending}
            error={pickupState.error}
            onClose={closePanels}
          />
        }
        deliveryForm={
          <DeliveryMoneyForm
            key={deliverySession}
            orderId={orderId}
            auth={auth}
            nextUrl={nextUrl}
            expectedAlfHint={
              totalAmountDinar != null ? dinarDecimalToAlfInputString(totalAmountDinar) : ""
            }
            remainingAlfHint={
              deliveryRemaining != null ? dinarDecimalToAlfInputString(deliveryRemaining) : ""
            }
            advanceToDelivered={deliveryAdvanceToDelivered}
            deliveryRemainingDinar={deliveryRemaining}
            deliverySumDinar={deliverySum}
            totalAmountDinar={totalAmountDinar}
            formAction={deliveryAction}
            pending={deliveryPending}
            error={deliveryState.error}
            onClose={closePanels}
            missingCustomerLocation={missingCustomerLocation}
          />
        }
      />

      {(pickupOpen && !pickupAdvanceToDelivering) || (deliveryOpen && !deliveryAdvanceToDelivered) ? (
        <div className="rounded-2xl border-2 border-slate-300 bg-slate-50 p-4 shadow-inner">
          <div className="mb-3 flex items-center justify-between border-b border-slate-200 pb-2">
            <span className="text-sm font-bold text-slate-600">تسجيل الحركة المالية</span>
            <button onClick={closePanels} className="text-xs font-black text-rose-700 underline">إغلاق اللوحة ✕</button>
          </div>
          {pickupOpen ? (
            <PickupMoneyForm
              orderId={orderId}
              auth={auth}
              nextUrl={nextUrl}
              expectedAlfHint={orderSubtotalDinar != null ? dinarDecimalToAlfInputString(orderSubtotalDinar) : ""}
              remainingAlfHint={pickupRemaining != null ? dinarDecimalToAlfInputString(pickupRemaining) : ""}
              advanceToDelivering={false}
              pickupRemainingDinar={pickupRemaining}
              pickupSumDinar={pickupSum}
              orderSubtotalDinar={orderSubtotalDinar}
              formAction={pickupAction}
              pending={pickupPending}
              error={pickupState.error}
              onClose={closePanels}
            />
          ) : (
            <DeliveryMoneyForm
              key={deliverySession}
              orderId={orderId}
              auth={auth}
              nextUrl={nextUrl}
              expectedAlfHint={totalAmountDinar != null ? dinarDecimalToAlfInputString(totalAmountDinar) : ""}
              remainingAlfHint={deliveryRemaining != null ? dinarDecimalToAlfInputString(deliveryRemaining) : ""}
              advanceToDelivered={false}
              deliveryRemainingDinar={deliveryRemaining}
              deliverySumDinar={deliverySum}
              totalAmountDinar={totalAmountDinar}
              formAction={deliveryAction}
              pending={deliveryPending}
              error={deliveryState.error}
              onClose={closePanels}
              missingCustomerLocation={missingCustomerLocation}
            />
          )}
        </div>
      ) : null}

      <ul className="space-y-3">
        {moneyEvents.map((ev) => {
          const deleted = ev.deletedAt != null;
          const manualDel = isManualDeletionReasonClient(ev.deletedReason);
          const dirLabel = ev.kind === MONEY_KIND_PICKUP ? "صادر" : "وارد";
          const noteParts: string[] = [];
          if (ev.mismatchReason?.trim()) noteParts.push(ev.mismatchReason.trim());
          if (ev.mismatchNote?.trim()) noteParts.push(ev.mismatchNote.trim());
          const noteLine = noteParts.length > 0 ? noteParts.join(" — ") : "—";
          const recordedByPreparer = ev.recordedByCompanyPreparerId != null;
          const canDeleteFromMandoubUi = !recordedByPreparer;

          // حساب الاختلاف للعرض تحت زر الحذف
          const diff = ev.expectedDinar != null ? ev.amountDinar - ev.expectedDinar : 0;
          const hasMismatch = ev.expectedDinar != null && Math.abs(diff) > 0.01;

          return (
            <li
              key={ev.id}
              className={`rounded-xl border-2 px-3 py-3 text-sm sm:px-4 sm:py-3.5 ${
                deleted
                  ? "border-slate-200 bg-slate-100/80 text-slate-500 line-through decoration-slate-400"
                  : ev.kind === MONEY_KIND_PICKUP
                    ? "border-emerald-600 bg-lime-200/95 text-emerald-950 shadow-sm"
                    : "border-red-600 bg-red-300/95 text-red-950 shadow-sm"
              }`}
            >
              <div className="flex items-start gap-3">
                <div className="min-w-0 flex-1 space-y-2 text-right leading-relaxed">
                  <p className="text-base font-bold sm:text-lg">
                    <span className="font-black">{dirLabel}</span> —
                    {ev.performedByDisplayName?.trim() || courierName.trim() || "—"}{" "}
                    <span className="text-xs font-semibold text-slate-500 sm:text-sm">
                      {formatRecordedAtClient(ev.recordedAt)}
                    </span>
                  </p>
                  <p className="text-sm font-bold text-slate-700 sm:text-base">
                    طلب{" "}
                    <span className="tabular-nums text-slate-900">{orderNumber}</span>
                    <span className="text-slate-500"> — </span>
                    <span className="font-bold">ملاحظة:</span>{" "}
                    <span
                      className={`whitespace-pre-wrap break-words ${
                        noteLine === "—" ? "text-slate-500" : "text-slate-800"
                      }`}
                    >
                      {noteLine}
                    </span>
                  </p>
                  <p className="flex flex-wrap items-baseline text-sm sm:text-base">
                    <span className="font-bold">
                      متوقع:
                      <span
                        className={`font-mono font-black tabular-nums text-slate-900 ${moneyLedgerAmountClass}`}
                      >
                        {ev.expectedDinar != null
                          ? formatDinarAsAlfWithUnit(ev.expectedDinar)
                          : "—"}
                      </span>{" "}
                      مسجّل:
                      <span
                        className={`font-mono font-black tabular-nums text-slate-900 ${moneyLedgerAmountClass}`}
                      >
                        {formatDinarAsAlfWithUnit(ev.amountDinar)}
                      </span>
                    </span>
                  </p>
                  {deleted ? (
                    <p className="text-xs font-semibold text-slate-600">
                      {manualDel ? (
                        <>
                          محذوف يدوياً
                          {ev.deletedByDisplayName?.trim() ? (
                            <>
                              {" "}
                              — بواسطة:{" "}
                              <span className="font-bold text-slate-800">
                                {ev.deletedByDisplayName.trim()}
                              </span>
                            </>
                          ) : null}
                        </>
                      ) : ev.deletedReason === "status_revert" ? (
                        <>أُلغيت تلقائياً عند تغيير حالة الطلب</>
                      ) : (
                        <>محذوف</>
                      )}
                    </p>
                  ) : null}
                </div>
                <div className="flex shrink-0 flex-col items-center gap-2 self-start">
                  {!deleted && canDeleteFromMandoubUi ? (
                    <form
                      action={deleteAction}
                      onSubmit={(e) => {
                        if (
                          !window.confirm(
                            `تأكيد حذف حركة «${dirLabel}» لهذا الطلب #${orderNumber}؟`,
                          )
                        ) {
                          e.preventDefault();
                        }
                      }}
                    >
                      <input type="hidden" name="c" value={auth.c} />
                      <input type="hidden" name="exp" value={auth.exp} />
                      <input type="hidden" name="s" value={auth.s} />
                      <input type="hidden" name="eventId" value={ev.id} />
                      <input type="hidden" name="next" value={nextUrl} />
                      <button
                        type="submit"
                        disabled={deletePending}
                        className="min-h-[52px] min-w-[3.8rem] rounded-xl border-2 border-rose-400 bg-white py-3 text-base font-black text-rose-900 shadow-sm transition hover:bg-rose-50 disabled:opacity-60"
                      >
                        🗑️
                      </button>
                    </form>
                  ) : !deleted ? (
                    <p className="max-w-[9rem] text-center text-[11px] font-bold leading-snug text-slate-500">
                      حذف من لوحة المجهز فقط
                    </p>
                  ) : null}

                  {/* علامة الحالة (مطابق / زيادة / نقص) */}
                  {!deleted && ev.expectedDinar != null && (
                    <div className={`flex w-full flex-col items-center justify-center rounded-lg border px-1.5 py-1 text-[10px] font-black shadow-inner ${
                      !hasMismatch
                        ? "border-emerald-400 bg-emerald-50 text-emerald-700"
                        : diff > 0
                          ? "border-amber-400 bg-amber-50 text-amber-700"
                          : "border-rose-400 bg-rose-50 text-rose-700"
                    }`}>
                      <span>{!hasMismatch ? "✅ مطابق" : diff > 0 ? "⚠️ زيادة" : "🚨 نقص"}</span>
                      {hasMismatch && (
                        <span className="mt-0.5 tabular-nums">
                          ({diff > 0 ? "+" : ""}{formatDinarAsAlfWithUnit(Math.abs(diff))})
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      {deleteState.error ? (
        <p className="text-sm font-bold text-rose-700">{deleteState.error}</p>
      ) : null}
    </div>
  );
}

export function PickupMoneyForm({
  orderId,
  auth,
  nextUrl,
  expectedAlfHint,
  remainingAlfHint,
  advanceToDelivering,
  pickupRemainingDinar,
  pickupSumDinar,
  orderSubtotalDinar,
  formAction,
  pending,
  error,
  onClose,
}: {
  orderId: string;
  auth: { c: string; exp: string; s: string };
  nextUrl: string;
  expectedAlfHint: string;
  remainingAlfHint: string;
  advanceToDelivering: boolean;
  pickupRemainingDinar: number | null;
  pickupSumDinar: number;
  orderSubtotalDinar: number | null;
  formAction: (formData: FormData) => void;
  pending: boolean;
  error?: string;
  onClose: () => void;
}) {
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const amountRef = useRef<HTMLInputElement>(null);
  const noteRef = useRef<HTMLTextAreaElement>(null);
  const pickupSubmitModeRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const mainSubmitRef = useRef<HTMLButtonElement>(null);
  const mountTimeRef = useRef(Date.now());

  const parsedDinar = parseAlfInputToDinarDecimalRequired(amount);
  const projectedTotal = pickupSumDinar + (parsedDinar.ok ? parsedDinar.value : 0);
  const isMismatch =
    orderSubtotalDinar != null &&
    !dinarTotalsMatchClient(projectedTotal, orderSubtotalDinar) &&
    (amount.trim() !== "" || (advanceToDelivering && pickupSumDinar > 0));

  function requestPickupMainSubmit() {
    if (pickupSubmitModeRef.current) pickupSubmitModeRef.current.value = "";
    formRef.current?.requestSubmit(mainSubmitRef.current ?? undefined);
  }

  function onPickupAmountKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== "Enter" || e.nativeEvent.isComposing) return;
    e.preventDefault();
    const parsed = parseAlfInputToDinarDecimalRequired(amount);
    if (!parsed.ok || parsed.value <= 0) {
      noteRef.current?.focus();
      return;
    }
    const nextPaid = pickupSumDinar + parsed.value;
    const needNote =
      orderSubtotalDinar != null &&
      !dinarTotalsMatchClient(nextPaid, orderSubtotalDinar) &&
      !note.trim();
    if (needNote) {
      noteRef.current?.focus();
      return;
    }
    requestPickupMainSubmit();
  }

  function onPickupNoteKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key !== "Enter" || e.shiftKey || e.nativeEvent.isComposing) return;
    e.preventDefault();
    requestPickupMainSubmit();
  }

  useEffect(() => {
    mountTimeRef.current = Date.now();
    amountRef.current?.focus();
  }, [advanceToDelivering, orderId]);

  useEffect(() => {
    const err = (error ?? "").trim();
    if (!err) return;
    if (err.includes("ملاحظة") || err.includes("المبلغ مختلف")) {
      noteRef.current?.focus();
    }
  }, [error]);

  return (
    <div className="space-y-3">
      <p className="font-bold text-emerald-950">اكتب المبلغ الذي سلّمته للعميل (بالألف)</p>
      {!advanceToDelivering ? (
        <p className="text-[11px] font-medium text-emerald-800/90">
          تسجيل صادر فقط — دون تغيير حالة الطلب.
        </p>
      ) : null}
      <div className={moneySaderSummaryBoxClass}>
        <span className="min-w-0 flex-1 sm:flex-none">
          سعر الطلب:{" "}
          <span className={moneySaderTotalValueClass}>{expectedAlfHint || "—"}</span>
        </span>
        <span className="min-w-0 flex-1 text-end sm:flex-none sm:text-start">
          المتبقي للصادر:{" "}
          <span className={moneySaderRemainValueClass}>{remainingAlfHint || "—"}</span>
        </span>
      </div>
      <form
        ref={formRef}
        action={formAction}
        className="space-y-3"
      >
        <input
          ref={pickupSubmitModeRef}
          type="hidden"
          name="mandoubMoneySubmitMode"
          value=""
        />
        <input type="hidden" name="c" value={auth.c} />
        <input type="hidden" name="exp" value={auth.exp} />
        <input type="hidden" name="s" value={auth.s} />
        <input type="hidden" name="orderId" value={orderId} />
        <input type="hidden" name="next" value={nextUrl} />
        <input
          type="hidden"
          name="advanceStatus"
          value={advanceToDelivering ? "delivering" : ""}
        />
        <div className="flex gap-2">
          <input
            ref={amountRef}
            name="amountAlf"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            onKeyDown={onPickupAmountKeyDown}
            className={`${moneySaderAmountInputClass} animate-placeholder`}
            placeholder="اكتب السعر هنا"
            inputMode="decimal"
            enterKeyHint="done"
            required
          />
          {remainingAlfHint && (
            <button
              type="button"
              onClick={() => {
                // منع النقرة التلقائية (Ghost Click) خلال أول 300ms من ظهور النافذة
                if (Date.now() - mountTimeRef.current < 300) return;
                setAmount(remainingAlfHint);
                setTimeout(requestPickupMainSubmit, 10);
              }}
              className="flex shrink-0 items-center justify-center rounded-xl border-2 border-emerald-800 bg-emerald-100 px-4 font-black text-emerald-950 shadow-sm"
              title="تعبئة المتبقي"
            >
              {remainingAlfHint}
            </button>
          )}
        </div>
        <input type="hidden" name="mismatchReason" value="" />
        {isMismatch && (
          <textarea
            ref={noteRef}
            name="mismatchNote"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            onKeyDown={onPickupNoteKeyDown}
            rows={2}
            required
            className="w-full rounded-xl border-2 border-amber-400 bg-amber-50 px-3 py-2 text-sm shadow-sm transition-all"
            placeholder="المبلغ مختلف — اكتب السبب"
          />
        )}
        {error ? <p className="text-sm font-bold text-rose-700">{error}</p> : null}
        <div className="flex flex-wrap gap-2">
          <button
            ref={mainSubmitRef}
            type="submit"
            disabled={pending}
            onClick={() => {
              if (pickupSubmitModeRef.current) pickupSubmitModeRef.current.value = "";
            }}
            className="rounded-xl bg-emerald-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
          >
            {pending ? "جارٍ الحفظ…" : advanceToDelivering ? "تسجيل وتحويل الحالة" : "تأكيد"}
          </button>
          {advanceToDelivering ? (
            <button
              type="submit"
              formNoValidate
              disabled={pending}
              onClick={() => {
                if (pickupSubmitModeRef.current) {
                  pickupSubmitModeRef.current.value = "statusOnlyNoAmount";
                }
              }}
              className="rounded-xl border-2 border-amber-500 bg-amber-50 px-4 py-2 text-sm font-black text-amber-950 shadow-sm transition hover:bg-amber-100 disabled:opacity-60"
              title="تحويل الحالة إلى «عند المندوب» دون تسجيل مبلغ صادر في هذه الخطوة"
            >
              بدون
            </button>
          ) : null}
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-800"
            disabled={pending}
          >
            إلغاء
          </button>
        </div>
      </form>
    </div>
  );
}

export function DeliveryMoneyForm({
  orderId,
  auth,
  nextUrl,
  expectedAlfHint,
  remainingAlfHint,
  advanceToDelivered,
  deliveryRemainingDinar,
  deliverySumDinar,
  totalAmountDinar,
  formAction,
  pending,
  error,
  onClose,
  missingCustomerLocation,
}: {
  orderId: string;
  auth: { c: string; exp: string; s: string };
  nextUrl: string;
  expectedAlfHint: string;
  remainingAlfHint: string;
  advanceToDelivered: boolean;
  deliveryRemainingDinar: number | null;
  deliverySumDinar: number;
  totalAmountDinar: number | null;
  formAction: (formData: FormData) => void;
  pending: boolean;
  error?: string;
  onClose: () => void;
  missingCustomerLocation: boolean;
}) {
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const amountRef = useRef<HTMLInputElement>(null);
  const noteRef = useRef<HTMLTextAreaElement>(null);
  const [locationModalOpen, setLocationModalOpen] = useState(false);
  const [geoError, setGeoError] = useState("");
  const formRef = useRef<HTMLFormElement>(null);
  const latRef = useRef<HTMLInputElement>(null);
  const lngRef = useRef<HTMLInputElement>(null);
  const locationPromptDoneRef = useRef(false);
  const [portalReady, setPortalReady] = useState(false);
  const deliverySubmitModeRef = useRef<HTMLInputElement>(null);
  const pendingAfterLocationRef = useRef<"main" | "skip">("main");
  const mainSubmitRef = useRef<HTMLButtonElement>(null);
  const mountTimeRef = useRef(Date.now());

  const parsedDinar = parseAlfInputToDinarDecimalRequired(amount);
  const projectedTotal = deliverySumDinar + (parsedDinar.ok ? parsedDinar.value : 0);
  const isMismatch =
    totalAmountDinar != null &&
    !dinarTotalsMatchClient(projectedTotal, totalAmountDinar) &&
    (amount.trim() !== "" || (advanceToDelivered && deliverySumDinar > 0));

  function requestDeliveryMainSubmit() {
    if (deliverySubmitModeRef.current) deliverySubmitModeRef.current.value = "";
    formRef.current?.requestSubmit(mainSubmitRef.current ?? undefined);
  }

  function onDeliveryAmountKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== "Enter" || e.nativeEvent.isComposing) return;
    e.preventDefault();
    const parsed = parseAlfInputToDinarDecimalRequired(amount);
    if (!parsed.ok || parsed.value <= 0) {
      noteRef.current?.focus();
      return;
    }
    const nextReceived = deliverySumDinar + parsed.value;
    const needNote =
      totalAmountDinar != null &&
      !dinarTotalsMatchClient(nextReceived, totalAmountDinar) &&
      !note.trim();
    if (needNote) {
      noteRef.current?.focus();
      return;
    }
    requestDeliveryMainSubmit();
  }

  function onDeliveryNoteKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key !== "Enter" || e.shiftKey || e.nativeEvent.isComposing) return;
    e.preventDefault();
    requestDeliveryMainSubmit();
  }

  useEffect(() => {
    mountTimeRef.current = Date.now();
    setPortalReady(true);
    amountRef.current?.focus();
  }, [advanceToDelivered, orderId]);

  useEffect(() => {
    const err = (error ?? "").trim();
    if (!err) return;
    if (err.includes("ملاحظة") || err.includes("المبلغ مختلف")) {
      noteRef.current?.focus();
    }
  }, [error]);

  function clearGpsHidden() {
    if (latRef.current) latRef.current.value = "";
    if (lngRef.current) lngRef.current.value = "";
  }

  function submitDeliveryAfterLocationChoice() {
    const isSkip = pendingAfterLocationRef.current === "skip";
    if (deliverySubmitModeRef.current) {
      deliverySubmitModeRef.current.value = isSkip ? "statusOnlyNoAmount" : "";
    }
    if (isSkip && amountRef.current) {
      amountRef.current.removeAttribute("required");
    }
    formRef.current?.requestSubmit();
    if (isSkip && amountRef.current) {
      amountRef.current.setAttribute("required", "");
    }
  }

  function onConfirmGps() {
    setGeoError("");
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setGeoError("المتصفح لا يدعم تحديد الموقع.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (latRef.current && lngRef.current) {
          latRef.current.value = String(pos.coords.latitude);
          lngRef.current.value = String(pos.coords.longitude);
        }
        locationPromptDoneRef.current = true;
        setLocationModalOpen(false);
        submitDeliveryAfterLocationChoice();
      },
      () => {
        setGeoError(
          "تعذّر قراءة موقعك. تأكد من تفعيل GPS والسماح للمتصفح بالموقع ثم أعد المحاولة.",
        );
      },
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 },
    );
  }

  function onSkipLocation() {
    // إصلاح الخطأ: تفريغ الإحداثيات تماماً عند رفض رفع الموقع
    if (latRef.current) latRef.current.value = "";
    if (lngRef.current) lngRef.current.value = "";
    locationPromptDoneRef.current = true;
    setLocationModalOpen(false);
    submitDeliveryAfterLocationChoice();
  }

  return (
    <div className="space-y-3">
      <p className="font-bold text-red-950">اكتب المبلغ الذي استلمته من الزبون (بالألف)</p>
      {!advanceToDelivered ? (
        <p className="text-[11px] font-medium text-red-800/90">
          تسجيل وارد فقط — دون تغيير حالة الطلب.
        </p>
      ) : null}
      <div className={moneyWardSummaryBoxClass}>
        <span className="min-w-0 flex-1 sm:flex-none">
          المبلغ الكلي:{" "}
          <span className={moneyWardTotalValueClass}>{expectedAlfHint || "—"}</span>
        </span>
        <span className="min-w-0 flex-1 text-end sm:flex-none sm:text-start">
          المتبقي للوارد:{" "}
          <span className={moneyWardRemainValueClass}>{remainingAlfHint || "—"}</span>
        </span>
      </div>
      <form
        ref={formRef}
        action={formAction}
        className="space-y-3"
        onSubmit={(e) => {
          const sub = (e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
          pendingAfterLocationRef.current =
            sub?.dataset?.mandoubAction === "skip-no-amount" ? "skip" : "main";
          if (missingCustomerLocation && !locationPromptDoneRef.current) {
            e.preventDefault();
            setGeoError("");
            setLocationModalOpen(true);
          }
        }}
      >
        <input
          ref={deliverySubmitModeRef}
          type="hidden"
          name="mandoubMoneySubmitMode"
          value=""
        />
        <input type="hidden" name="c" value={auth.c} />
        <input type="hidden" name="exp" value={auth.exp} />
        <input type="hidden" name="s" value={auth.s} />
        <input type="hidden" name="orderId" value={orderId} />
        <input type="hidden" name="next" value={nextUrl} />
        <input
          type="hidden"
          name="advanceStatus"
          value={advanceToDelivered ? "delivered" : ""}
        />
        <input ref={latRef} type="hidden" name="lat" value="" />
        <input ref={lngRef} type="hidden" name="lng" value="" />
        <div className="flex gap-2">
          <input
            ref={amountRef}
            name="amountAlf"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            onKeyDown={onDeliveryAmountKeyDown}
            className={`${moneyWardAmountInputClass} animate-placeholder`}
            placeholder="اكتب السعر هنا"
            inputMode="decimal"
            enterKeyHint="done"
            required
          />
          {remainingAlfHint && (
            <button
              type="button"
              onClick={() => {
                // منع النقرة التلقائية (Ghost Click) خلال أول 300ms من ظهور النافذة
                if (Date.now() - mountTimeRef.current < 300) return;
                setAmount(remainingAlfHint);
                setTimeout(requestDeliveryMainSubmit, 10);
              }}
              className="flex shrink-0 items-center justify-center rounded-xl border-2 border-red-800 bg-red-100 px-4 font-black text-red-950 shadow-sm"
              title="تعبئة المتبقي"
            >
              {remainingAlfHint}
            </button>
          )}
        </div>
        <input type="hidden" name="mismatchReason" value="" />
        {isMismatch && (
          <textarea
            ref={noteRef}
            name="mismatchNote"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            onKeyDown={onDeliveryNoteKeyDown}
            rows={2}
            required
            className="w-full rounded-xl border-2 border-amber-400 bg-amber-50 px-3 py-2 text-sm shadow-sm transition-all"
            placeholder="المبلغ مختلف — اكتب السبب"
          />
        )}
        {error ? <p className="text-sm font-bold text-rose-700">{error}</p> : null}
        <div className="flex flex-wrap gap-2">
          <button
            ref={mainSubmitRef}
            type="submit"
            disabled={pending}
            data-mandoub-action="with-amount"
            onClick={() => {
              if (deliverySubmitModeRef.current) deliverySubmitModeRef.current.value = "";
            }}
            className="rounded-xl bg-red-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
          >
            {pending ? "جارٍ الحفظ…" : advanceToDelivered ? "تسجيل وتحويل الحالة" : "تأكيد"}
          </button>
          {advanceToDelivered ? (
            <button
              type="submit"
              formNoValidate
              disabled={pending}
              data-mandoub-action="skip-no-amount"
              onClick={() => {
                if (deliverySubmitModeRef.current) {
                  deliverySubmitModeRef.current.value = "statusOnlyNoAmount";
                }
              }}
              className="rounded-xl border-2 border-red-400 bg-red-50 px-4 py-2 text-sm font-black text-red-950 shadow-sm transition hover:bg-red-100 disabled:opacity-60"
              title="تحويل الحالة إلى «تم التسليم» دون تسجيل مبلغ وارد في هذه خطوة"
            >
              بدون
            </button>
          ) : null}
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-800"
            disabled={pending}
          >
            إلغاء
          </button>
        </div>
      </form>

      {portalReady && locationModalOpen
        ? createPortal(
            <div
              className="fixed inset-0 z-[1300] flex items-center justify-center bg-black/55 p-4"
              dir="rtl"
              role="dialog"
              aria-modal="true"
              aria-labelledby="mandoub-delivery-loc-title"
            >
              <div className="max-w-md rounded-2xl border border-red-200 bg-white p-5 shadow-xl">
                <p
                  id="mandoub-delivery-loc-title"
                  className="text-base font-black leading-relaxed text-slate-900"
                >
                  هذا الطلب لا يحتوي على موقع للزبون
                </p>
                <p className="mt-3 text-sm leading-relaxed text-slate-600">
                  أتممت تسليم الطلب الآن؟ هل تريد رفع{" "}
                  <strong className="text-slate-800">موقعك الحالي</strong> (حيث أنت الآن) على أنه
                  موقع الزبون؟ قد يكون قد غيرت مكانك بعد مغادرة الزبون — اختر بعناية.
                </p>
                {geoError ? (
                  <p className="mt-3 text-sm font-bold text-rose-700">{geoError}</p>
                ) : null}
                <div className="mt-5 flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={onConfirmGps}
                    disabled={pending}
                    className="rounded-xl bg-red-700 px-4 py-3 text-sm font-black text-white disabled:opacity-60"
                  >
                    نعم، ارفع موقعي الحالي
                  </button>
                  <button
                    type="button"
                    onClick={onSkipLocation}
                    disabled={pending}
                    className="rounded-xl border-2 border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-60"
                  >
                    لا، لا ترفع موقعي
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setLocationModalOpen(false);
                      setGeoError("");
                    }}
                    className="mt-2 text-center text-sm font-bold text-slate-500 hover:underline"
                    disabled={pending}
                  >
                    إلغاء والرجوع لتعديل المبلغ
                  </button>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
