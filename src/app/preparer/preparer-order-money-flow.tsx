"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import {
  submitPreparerDeliveryMoney,
  submitPreparerPickupMoney,
  softDeletePreparerMoneyEvent,
  type PreparerCashState,
} from "./preparer-cash-actions";
import { MandoubOrderMoneyFloatDock } from "@/app/mandoub/mandoub-order-money-float-dock";
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
import { PREPARER_ORDER_EDIT_PANEL_EVT } from "@/lib/preparer-edit-panel-events";
import { DynamicIcon } from "@/components/dynamic-icon";
import { getGlobalIcons, GlobalIconsConfig } from "@/lib/icon-settings";

const initialCash: PreparerCashState = {};

function dinarTotalsMatchClient(totalDinar: number, expectedDinar: number | null): boolean {
  if (expectedDinar == null) return false;
  const r = (n: number) => Math.round(n * 100) / 100;
  return r(totalDinar) === r(expectedDinar);
}

export type MoneyEventUi = {
  id: string;
  kind: string;
  amountDinar: number;
  expectedDinar: number | null;
  matchesExpected: boolean;
  mismatchReason: string;
  mismatchNote: string;
  /** وقت تسجيل الحركة في النظام */
  recordedAt: Date | string;
  deletedAt: Date | null;
  deletedReason: string | null;
  deletedByDisplayName: string | null;
  /** اسم من نفّذ التسجيل فعلياً (مجهز أو مندوب) */
  performedByDisplayName: string;
  /** إن وُجد: سُجّلت من لوحة المجهز — يحذفها المجهز فقط */
  recordedByCompanyPreparerId: string | null;
};

function isManualDeletionReasonClient(r: MoneyEventUi["deletedReason"]): boolean {
  return r === "manual_admin" || r === "manual_courier" || r === "manual_preparer";
}

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

export function PreparerOrderMoneyFlow({
  orderId,
  orderNumber,
  courierName,
  assignedCourierId,
  orderStatus,
  orderSubtotalDinar,
  totalAmountDinar,
  moneyEvents,
  auth,
  nextUrl,
  preparerId,
  icons,
}: {
  orderId: string;
  orderNumber: number;
  courierName: string;
  /** بدون مندوب مسند لا يُقبل تسجيل الصادر/الوارد من السيرفر */
  assignedCourierId: string | null;
  orderStatus: string;
  orderSubtotalDinar: number | null;
  totalAmountDinar: number | null;
  moneyEvents: MoneyEventUi[];
  auth: { p: string; exp: string; s: string };
  nextUrl: string;
  preparerId: string;
  icons?: GlobalIconsConfig | null;
}) {
  const [pickupOpen, setPickupOpen] = useState(false);
  const [deliveryOpen, setDeliveryOpen] = useState(false);
  const [deliverySession, setDeliverySession] = useState(0);
  const [pickupAdvanceToDelivering, setPickupAdvanceToDelivering] = useState(false);
  const [deliveryAdvanceToDelivered, setDeliveryAdvanceToDelivered] = useState(false);

  const [pickupState, pickupAction, pickupPending] = useActionState(
    submitPreparerPickupMoney,
    initialCash,
  );
  const [deliveryState, deliveryAction, deliveryPending] = useActionState(
    submitPreparerDeliveryMoney,
    initialCash,
  );
  const [deleteState, deleteAction, deletePending] = useActionState(
    softDeletePreparerMoneyEvent,
    initialCash,
  );

  const [dockHidden, setDockHidden] = useState(false);
  useEffect(() => {
    const onEdit = (e: Event) => {
      const d = (e as CustomEvent<{ open?: boolean }>).detail;
      setDockHidden(Boolean(d?.open));
    };
    window.addEventListener(PREPARER_ORDER_EDIT_PANEL_EVT, onEdit);
    return () => window.removeEventListener(PREPARER_ORDER_EDIT_PANEL_EVT, onEdit);
  }, []);

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
  const hasAssignedCourier = Boolean(assignedCourierId?.trim());

  const AMOUNT_EPS = 1e-3;
  const pickupComplete =
    orderSubtotalDinar != null && Math.abs(pickupSum - orderSubtotalDinar) < AMOUNT_EPS;
  const deliveryComplete =
    totalAmountDinar != null && Math.abs(deliverySum - totalAmountDinar) < AMOUNT_EPS;

  /** أزرار عائمة واضحة (دفع للعميل / استلام من الزبون). */
  // في صفحة المجهز نُظهر الأزرار حتى لو كانت الطلبية «جديدة»، وحتى لو لم يُسند مندوب بعد
  // (تكون معطّلة عند عدم وجود مندوب مسند).
  const showPickupFab = hasOrderSubtotal && !pickupComplete;
  const showDeliveryFab = hasTotalAmount && !deliveryComplete;

  const canMarkPickedUp = orderStatus === "assigned" && hasOrderSubtotal;
  const canMarkDelivered = orderStatus === "delivering" && hasTotalAmount;

  const pickupPanelOpen = pickupOpen && (showPickupFab || pickupAdvanceToDelivering);
  const deliveryPanelOpen = deliveryOpen && (showDeliveryFab || deliveryAdvanceToDelivered);

  const closePanels = () => {
    setPickupOpen(false);
    setDeliveryOpen(false);
    setPickupAdvanceToDelivering(false);
    setDeliveryAdvanceToDelivered(false);
  };

  const deleteErr = deleteState.error;
  const latestDeletableEvent = useMemo(() => {
    for (const ev of moneyEvents) {
      if (ev.deletedAt != null) continue;
      const recordedByAnyPreparer = ev.recordedByCompanyPreparerId != null;
      const recordedByThisPreparer =
        recordedByAnyPreparer && ev.recordedByCompanyPreparerId === preparerId;
      if (recordedByThisPreparer) return ev;
    }
    return null;
  }, [moneyEvents, preparerId]);

  return (
    <div id="preparer-order-money" className="mt-6 scroll-mt-24 space-y-4 border-t border-sky-200 pt-5">
      <h3 className="text-lg font-bold text-slate-900">الصادر والوارد</h3>

      <MandoubOrderMoneyFloatDock
        dockHidden={dockHidden}
        showStatusFab={canMarkPickedUp || canMarkDelivered}
        statusFabMode={canMarkPickedUp ? "pickedUp" : "delivered"}
        onStatusFabClick={() => {
          if (orderStatus === "assigned") {
            setPickupAdvanceToDelivering(true);
            setDeliveryAdvanceToDelivered(false);
            setPickupOpen(true);
            setDeliveryOpen(false);
            return;
          }
          setDeliveryAdvanceToDelivered(true);
          setPickupAdvanceToDelivering(false);
          setDeliverySession((n) => n + 1);
          setDeliveryOpen(true);
          setPickupOpen(false);
        }}
        showPickupBtn={showPickupFab}
        showDeliveryBtn={showDeliveryFab}
        pickupOpen={pickupPanelOpen}
        deliveryOpen={deliveryPanelOpen}
        onOpenPickup={() => {
          setPickupAdvanceToDelivering(false);
          setPickupOpen(true);
          setDeliveryOpen(false);
        }}
        onOpenDelivery={() => {
          setDeliveryAdvanceToDelivered(false);
          setDeliverySession((n) => n + 1);
          setDeliveryOpen(true);
          setPickupOpen(false);
        }}
        onClosePanels={closePanels}
        pickupForm={
          <PickupMoneyForm
            orderId={orderId}
            auth={auth}
            nextUrl={nextUrl}
            expectedAlfHint={orderSubtotalDinar != null ? dinarDecimalToAlfInputString(orderSubtotalDinar) : ""}
            remainingAlfHint={pickupRemaining != null ? dinarDecimalToAlfInputString(pickupRemaining) : ""}
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
            expectedAlfHint={totalAmountDinar != null ? dinarDecimalToAlfInputString(totalAmountDinar) : ""}
            remainingAlfHint={deliveryRemaining != null ? dinarDecimalToAlfInputString(deliveryRemaining) : ""}
            advanceToDelivered={deliveryAdvanceToDelivered}
            deliveryRemainingDinar={deliveryRemaining}
            deliverySumDinar={deliverySum}
            totalAmountDinar={totalAmountDinar}
            formAction={deliveryAction}
            pending={deliveryPending}
            error={deliveryState.error}
            onClose={closePanels}
          />
        }
      />

      {deleteErr ? (
        <p className="rounded-xl border border-rose-300 bg-rose-50 px-3 py-2 text-sm font-bold text-rose-900">
          {deleteErr}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-bold text-slate-800">المعاملات</p>
        {latestDeletableEvent ? (
          <form action={deleteAction}>
            <input type="hidden" name="p" value={auth.p} />
            <input type="hidden" name="exp" value={auth.exp} />
            <input type="hidden" name="s" value={auth.s} />
            <input type="hidden" name="eventId" value={latestDeletableEvent.id} />
            <input type="hidden" name="next" value={nextUrl} />
            <button
              type="submit"
              disabled={deletePending}
              onClick={(e) => {
                if (!window.confirm("تأكيد مسح آخر حركة مسجّلة؟")) e.preventDefault();
              }}
              className="flex items-center gap-1.5 rounded-xl border border-rose-400 bg-rose-50 px-3 py-2 text-xs font-black text-rose-800 hover:bg-rose-100 disabled:opacity-60"
              title="مسح آخر حركة مسجّلة من هذا المجهز"
            >
              <DynamicIcon
                iconKey="ui_delete"
                config={icons}
                className="h-3.5 w-3.5"
                fallback={<span>🗑️</span>}
              />
              مسح آخر حركة
            </button>
          </form>
        ) : (
          <span className="text-xs font-semibold text-slate-500">لا توجد حركة قابلة للمسح</span>
        )}
      </div>

      <ul className="space-y-3">
        {moneyEvents.map((ev) => {
          const deleted = ev.deletedAt != null;
          const manualDel = isManualDeletionReasonClient(ev.deletedReason);
          const dirLabel = ev.kind === MONEY_KIND_PICKUP ? "صادر" : "وارد";
          const noteParts: string[] = [];
          if (ev.mismatchReason?.trim()) noteParts.push(ev.mismatchReason.trim());
          if (ev.mismatchNote?.trim()) noteParts.push(ev.mismatchNote.trim());
          const noteLine = noteParts.length > 0 ? noteParts.join(" — ") : "—";
          const recordedByAnyPreparer = ev.recordedByCompanyPreparerId != null;
          const recordedByThisPreparer =
            recordedByAnyPreparer && ev.recordedByCompanyPreparerId === preparerId;
          const canDeleteFromPreparerUi = recordedByThisPreparer;

          return (
            <li key={ev.id}>
              <div
                className={`rounded-2xl border-2 px-4 py-3 ${
                  deleted
                    ? "border-slate-300 bg-slate-100/80 text-slate-600"
                    : ev.kind === MONEY_KIND_PICKUP
                      ? "border-emerald-600 bg-lime-200/95 text-emerald-950 shadow-sm"
                      : "border-red-600 bg-red-300/95 text-red-950 shadow-sm"
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className={`${deleted ? "line-through decoration-slate-400" : ""}`}>
                    <p className="text-base font-bold text-slate-950 sm:text-lg">
                      {dirLabel} ·{" "}
                      <span className={moneyLedgerAmountClass}>
                        {formatDinarAsAlfWithUnit(ev.amountDinar)}
                      </span>
                      <span className="ms-2 text-slate-800">
                        {(ev.performedByDisplayName.trim() || "—").trim()}
                      </span>{" "}
                      <span className="text-xs font-semibold text-slate-600">
                        {formatRecordedAtClient(ev.recordedAt)}
                      </span>
                    </p>
                    <p className="mt-1 text-xs text-slate-600">سبب/ملاحظة: {noteLine}</p>
                  </div>
                  {!deleted && canDeleteFromPreparerUi ? (
                    <form action={deleteAction}>
                      <input type="hidden" name="p" value={auth.p} />
                      <input type="hidden" name="exp" value={auth.exp} />
                      <input type="hidden" name="s" value={auth.s} />
                      <input type="hidden" name="eventId" value={ev.id} />
                      <input type="hidden" name="next" value={nextUrl} />
                      <button
                        type="submit"
                        disabled={deletePending}
                        className="flex h-8 w-8 items-center justify-center rounded-xl border border-rose-400 bg-rose-50 text-xs font-bold text-rose-800 hover:bg-rose-100 disabled:opacity-60"
                        title="حذف الحركة (Soft delete)"
                      >
                        <DynamicIcon
                          iconKey="ui_delete"
                          config={icons}
                          className="h-3.5 w-3.5"
                          fallback={<span>🗑️</span>}
                        />
                      </button>
                    </form>
                  ) : !deleted ? (
                    <span className="max-w-[11rem] text-[11px] font-semibold leading-snug text-slate-500">
                      {recordedByAnyPreparer && !recordedByThisPreparer
                        ? "سجّلها مجهز آخر — لا يمكنك حذفها هنا"
                        : "حذف من لوحة المندوب فقط"}
                    </span>
                  ) : (
                    <div className="text-[11px] font-semibold text-slate-500">
                      {manualDel ? `حذف: ${ev.deletedByDisplayName ?? "—"}` : "محذوف تلقائياً"}
                    </div>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function PickupMoneyForm(props: {
  orderId: string;
  auth: { p: string; exp: string; s: string };
  nextUrl: string;
  expectedAlfHint: string;
  remainingAlfHint: string;
  advanceToDelivering: boolean;
  pickupRemainingDinar: number | null;
  pickupSumDinar: number;
  orderSubtotalDinar: number | null;
  formAction: (formData: FormData) => void | Promise<void>;
  pending: boolean;
  error?: string;
  onClose: () => void;
  // إضافات جديدة للخيارات المتطورة
  couriers?: { id: string; name: string }[];
  currentCourierId?: string | null;
  orderStatus?: string;
  /** نافذة دفع من قائمة المجهز ليلاً: نص أبيض وحقول واضحة */
  forDarkModalSurface?: boolean;
}) {
  const amountRef = useRef<HTMLInputElement>(null);
  const mismatchRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const statusSubmitRef = useRef<HTMLButtonElement>(null);
  const [amountAlf, setAmountAlf] = useState("");
  const mountTimeRef = useRef(Date.now());

  // حالات جديدة للخيارات
  const [shouldAssign, setShouldAssign] = useState(true);
  const [shouldMarkDelivered, setShouldMarkDelivered] = useState(true);

  useEffect(() => {
    mountTimeRef.current = Date.now();
    if (!props.advanceToDelivering) {
      window.setTimeout(() => amountRef.current?.focus(), 120);
    }
  }, [props.advanceToDelivering]);

  useEffect(() => {
    setAmountAlf("");
  }, [props.advanceToDelivering, props.orderId]);

  const showMismatch =
    props.orderSubtotalDinar != null &&
    !dinarTotalsMatchClient(props.pickupSumDinar, props.orderSubtotalDinar);

  const parsedAmount = parseAlfInputToDinarDecimalRequired(amountAlf.trim());
  const amountStepOk = parsedAmount.ok && parsedAmount.value > 0;
  const nextPickupSum =
    amountStepOk && props.orderSubtotalDinar != null
      ? props.pickupSumDinar + parsedAmount.value
      : props.pickupSumDinar;
  const showMismatchAfterAmount =
    !props.advanceToDelivering &&
    props.orderSubtotalDinar != null &&
    amountStepOk &&
    !dinarTotalsMatchClient(nextPickupSum, props.orderSubtotalDinar);

  const canAssign = !props.currentCourierId && props.couriers && props.couriers.length > 0;
  const dark = Boolean(props.forDarkModalSurface);
  const saderInputClass = dark
    ? "w-full rounded-xl border-2 border-white/50 bg-neutral-900 px-3 py-2.5 text-lg font-black tabular-nums text-white shadow-inner placeholder:text-white/45"
    : moneySaderAmountInputClass;

  return (
    <form ref={formRef} action={props.formAction} className="space-y-3">
      <input type="hidden" name="p" value={props.auth.p} />
      <input type="hidden" name="exp" value={props.auth.exp} />
      <input type="hidden" name="s" value={props.auth.s} />
      <input type="hidden" name="orderId" value={props.orderId} />
      <input type="hidden" name="next" value={props.nextUrl} />

      {props.error ? (
        <div
          className={
            dark
              ? "rounded-lg border border-rose-400/80 bg-rose-950/50 px-3 py-2 text-sm font-bold text-rose-100"
              : "rounded-lg border border-rose-300 bg-rose-50 px-3 py-2 text-sm font-bold text-rose-900"
          }
        >
          {props.error}
        </div>
      ) : null}

      {props.advanceToDelivering ? (
        <>
          <input type="hidden" name="advanceStatus" value="delivering" />
          <input type="hidden" name="statusAdvanceOnly" value="1" />
          <p className={`text-sm font-bold ${dark ? "text-white" : "text-slate-900"}`}>تم الاستلام (تحويل حالة فقط)</p>
          {showMismatch ? (
            <div
              className={
                dark
                  ? "space-y-2 rounded-xl border border-amber-500/60 bg-amber-950/40 px-3 py-2.5"
                  : "space-y-2 rounded-xl border border-amber-300 bg-amber-50/95 px-3 py-2.5"
              }
            >
              <p className={`text-sm font-black ${dark ? "text-amber-100" : "text-amber-950"}`}>المبلغ مختلف</p>
              <label className={`block text-sm font-bold ${dark ? "text-white" : "text-slate-800"}`}>
                سبب اختلاف الصادر *
                <input
                  ref={mismatchRef}
                  name="mismatchNote"
                  required
                  className={
                    dark
                      ? "mt-1 w-full rounded-xl border border-neutral-500 bg-neutral-900 px-3 py-2 text-sm text-white placeholder:text-neutral-400"
                      : "mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  }
                  placeholder="اكتب السبب…"
                />
              </label>
            </div>
          ) : (
            <input type="hidden" name="mismatchNote" value="" />
          )}
          <button
            type="submit"
            disabled={props.pending}
            className="w-full rounded-xl bg-emerald-700 px-4 py-3 text-base font-black text-white hover:bg-emerald-800 disabled:opacity-60"
          >
            {props.pending ? "..." : "تم الاستلام"}
          </button>
        </>
      ) : (
        <>


          {/* إسناد المندوب مباشرة */}
          <div
            className={
              dark
                ? "space-y-2 rounded-xl border border-neutral-600 bg-neutral-900/60 p-3"
                : "space-y-2 rounded-xl border border-slate-100 bg-slate-50/50 p-3"
            }
          >
            {canAssign && (
              <div className="space-y-1">
                <span className={`text-xs font-bold ${dark ? "text-white" : "text-slate-500"}`}>
                  اختر المندوب للإسناد المباشر:
                </span>
                <select
                  name="assignToCourierId"
                  className={
                    dark
                      ? "w-full rounded-lg border border-neutral-500 bg-neutral-900 px-3 py-2 text-sm font-semibold text-white"
                      : "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-900"
                  }
                >
                  <option value="">— تخطي الإسناد حالياً —</option>
                  {props.couriers?.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
                <input type="hidden" name="advanceStatus" value="delivering" />
              </div>
            )}
          </div>



          <div className="space-y-1">
            <div className="flex gap-2">
              <input
                ref={amountRef}
                name="amountAlf"
                required
                inputMode="decimal"
                value={amountAlf}
                onChange={(e) => setAmountAlf(e.target.value)}
                className={`mt-1 ${saderInputClass}`}
                placeholder="0"
              />
              {props.remainingAlfHint && (
                <button
                  type="submit"
                  onClick={() => {
                    if (Date.now() - mountTimeRef.current < 300) return;
                    setAmountAlf(props.remainingAlfHint);
                  }}
                  className={
                    dark
                      ? "mt-1 flex shrink-0 items-center justify-center rounded-xl border-2 border-emerald-400 bg-emerald-800/90 px-4 font-black text-white shadow-sm"
                      : "mt-1 flex shrink-0 items-center justify-center rounded-xl border-2 border-emerald-800 bg-emerald-100 px-4 font-black text-emerald-950 shadow-sm"
                  }
                  title="تعبئة وحفظ"
                >
                  {props.remainingAlfHint}
                </button>
              )}
            </div>
          </div>

          {showMismatchAfterAmount ? (
            <div
              className={
                dark
                  ? "space-y-2 rounded-xl border border-amber-500/60 bg-amber-950/40 px-3 py-2.5"
                  : "space-y-2 rounded-xl border border-amber-300 bg-amber-50/95 px-3 py-2.5"
              }
            >
              <p className={`text-sm font-black ${dark ? "text-amber-100" : "text-amber-950"}`}>المبلغ مختلف</p>
              <label className={`block text-sm font-bold ${dark ? "text-white" : "text-slate-800"}`}>
                سبب اختلاف الصادر *
                <input
                  name="mismatchNote"
                  required
                  className={
                    dark
                      ? "mt-1 w-full rounded-xl border border-neutral-500 bg-neutral-900 px-3 py-2 text-sm text-white placeholder:text-neutral-400"
                      : "mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  }
                  placeholder="اكتب السبب…"
                />
              </label>
            </div>
          ) : (
            <input type="hidden" name="mismatchNote" value="" />
          )}

          <div className="flex flex-wrap gap-2">
            <button
              type="submit"
              disabled={props.pending}
              className="flex-1 rounded-xl bg-emerald-700 px-4 py-3 text-base font-black text-white hover:bg-emerald-800 disabled:opacity-60"
            >
              {props.pending ? "..." : "تسجيل وحفظ"}
            </button>
          </div>
        </>
      )}
    </form>
  );
}

function DeliveryMoneyForm(props: {
  orderId: string;
  auth: { p: string; exp: string; s: string };
  nextUrl: string;
  expectedAlfHint: string;
  remainingAlfHint: string;
  advanceToDelivered: boolean;
  deliveryRemainingDinar: number | null;
  deliverySumDinar: number;
  totalAmountDinar: number | null;
  formAction: (formData: FormData) => void | Promise<void>;
  pending: boolean;
  error?: string;
  onClose: () => void;
}) {
  const amountRef = useRef<HTMLInputElement>(null);
  const mismatchRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const statusSubmitRef = useRef<HTMLButtonElement>(null);
  const [amountAlf, setAmountAlf] = useState("");
  const mountTimeRef = useRef(Date.now());

  useEffect(() => {
    mountTimeRef.current = Date.now();
    if (!props.advanceToDelivered) {
      window.setTimeout(() => amountRef.current?.focus(), 120);
    }
  }, [props.advanceToDelivered]);

  useEffect(() => {
    setAmountAlf("");
  }, [props.advanceToDelivered, props.orderId]);

  const showMismatch =
    props.totalAmountDinar != null &&
    !dinarTotalsMatchClient(props.deliverySumDinar, props.totalAmountDinar);

  const parsedAmount = parseAlfInputToDinarDecimalRequired(amountAlf.trim());
  const amountStepOk = parsedAmount.ok && parsedAmount.value > 0;
  const nextDeliverySum =
    amountStepOk && props.totalAmountDinar != null
      ? props.deliverySumDinar + parsedAmount.value
      : props.deliverySumDinar;
  const showMismatchAfterAmount =
    !props.advanceToDelivered &&
    props.totalAmountDinar != null &&
    amountStepOk &&
    !dinarTotalsMatchClient(nextDeliverySum, props.totalAmountDinar);

  return (
    <form ref={formRef} action={props.formAction} className="space-y-3">
      <input type="hidden" name="p" value={props.auth.p} />
      <input type="hidden" name="exp" value={props.auth.exp} />
      <input type="hidden" name="s" value={props.auth.s} />
      <input type="hidden" name="orderId" value={props.orderId} />
      <input type="hidden" name="next" value={props.nextUrl} />

      {props.error ? (
        <div className="rounded-lg border border-rose-300 bg-rose-50 px-3 py-2 text-sm font-bold text-rose-900">
          {props.error}
        </div>
      ) : null}

      {props.advanceToDelivered ? (
        <>
          <input type="hidden" name="advanceStatus" value="delivered" />
          <input type="hidden" name="statusAdvanceOnly" value="1" />
          <p className="text-sm font-bold text-slate-900">تم التسليم (تحويل حالة فقط)</p>
          {showMismatch ? (
            <div className="space-y-2 rounded-xl border border-amber-300 bg-amber-50/95 px-3 py-2.5">
              <p className="text-sm font-black text-amber-950">المبلغ مختلف</p>
              <label className="block text-sm font-bold text-slate-800">
                سبب اختلاف الوارد *
                <input
                  ref={mismatchRef}
                  name="mismatchNote"
                  required
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  placeholder="اكتب السبب…"
                />
              </label>
            </div>
          ) : (
            <input type="hidden" name="mismatchNote" value="" />
          )}
          <button
            type="submit"
            disabled={props.pending}
            className="w-full rounded-xl bg-red-700 px-4 py-3 text-base font-black text-white hover:bg-red-800 disabled:opacity-60"
          >
            {props.pending ? "..." : "تم التسليم"}
          </button>
        </>
      ) : (
        <>
          <div className="space-y-1">
            <div className="flex gap-2">
              <input
                ref={amountRef}
                name="amountAlf"
                required
                inputMode="decimal"
                value={amountAlf}
                onChange={(e) => setAmountAlf(e.target.value)}
                className={`mt-1 ${moneyWardAmountInputClass}`}
                placeholder="0"
              />
              {props.remainingAlfHint && (
                <button
                  type="button"
                  onClick={() => {
                    // منع النقرة التلقائية إذا حدثت خلال أقل من 300ms من ظهور النافذة
                    if (Date.now() - mountTimeRef.current < 300) return;
                    setAmountAlf(props.remainingAlfHint);
                    setTimeout(() => {
                      formRef.current?.requestSubmit(statusSubmitRef.current ?? undefined);
                    }, 10);
                  }}
                  className="mt-1 flex shrink-0 items-center justify-center rounded-xl border-2 border-red-800 bg-red-100 px-4 font-black text-red-950 shadow-sm"
                  title="تعبئة المتبقي"
                >
                  {props.remainingAlfHint}
                </button>
              )}
            </div>
          </div>

          {showMismatchAfterAmount ? (
            <div className="space-y-2 rounded-xl border border-amber-300 bg-amber-50/95 px-3 py-2.5">
              <p className="text-sm font-black text-amber-950">المبلغ مختلف</p>
              <label className="block text-sm font-bold text-slate-800">
                سبب اختلاف الوارد *
                <input
                  name="mismatchNote"
                  required
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  placeholder="اكتب السبب…"
                />
              </label>
            </div>
          ) : (
            <input type="hidden" name="mismatchNote" value="" />
          )}

          <div className="flex flex-wrap gap-2">
            <button
              type="submit"
              disabled={props.pending}
              className="flex-1 rounded-xl bg-red-700 px-4 py-3 text-base font-black text-white hover:bg-red-800 disabled:opacity-60"
            >
              {props.pending ? "..." : "تسجيل الوارد"}
            </button>
            <button
              ref={statusSubmitRef}
              type="submit"
              name="advanceStatus"
              value="delivered"
              disabled={props.pending}
              className="flex-1 rounded-xl bg-red-800 px-4 py-3 text-base font-black text-white hover:bg-red-900 disabled:opacity-60"
            >
              {props.pending ? "..." : "تسجيل + تم التسليم"}
            </button>
          </div>
        </>
      )}
    </form>
  );
}

