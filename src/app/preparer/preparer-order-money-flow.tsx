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
import { formatBaghdadMoneyRecordedAt } from "@/lib/baghdad-time";

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
  return formatBaghdadMoneyRecordedAt(d).fullStr;
}

export function PreparerOrderMoneyFlow({
  orderId,
  orderNumber,
  courierName,
  assignedCourierId,
  orderStatus,
  purchasePriceDinar,
  orderSubtotalDinar,
  totalAmountDinar,
  moneyEvents,
  auth,
  nextUrl,
  preparerId,
  icons,
  couriers,
  isPreparationOrder,
}: {
  orderId: string;
  orderNumber: number;
  courierName: string;
  /** بدون مندوب مسند لا يُقبل تسجيل الصادر/الوارد من السيرفر */
  assignedCourierId: string | null;
  orderStatus: string;
  purchasePriceDinar?: number | null;
  orderSubtotalDinar: number | null;
  totalAmountDinar: number | null;
  moneyEvents: MoneyEventUi[];
  auth: { p: string; exp: string; s: string };
  nextUrl: string;
  preparerId: string;
  icons?: GlobalIconsConfig | null;
  couriers?: { id: string; name: string }[];
  isPreparationOrder?: boolean;
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

  const effectivePickupDinar = purchasePriceDinar ?? orderSubtotalDinar;

  const pickupRemaining = useMemo(() => {
    if (effectivePickupDinar == null) return null;
    return effectivePickupDinar - pickupSum;
  }, [effectivePickupDinar, pickupSum]);
  const deliveryRemaining = useMemo(() => {
    if (totalAmountDinar == null) return null;
    return totalAmountDinar - deliverySum;
  }, [totalAmountDinar, deliverySum]);

  const hasOrderSubtotal = effectivePickupDinar != null;
  const hasTotalAmount = totalAmountDinar != null;
  const hasAssignedCourier = Boolean(assignedCourierId?.trim());

  const AMOUNT_EPS = 1e-3;
  const pickupComplete =
    effectivePickupDinar != null && Math.abs(pickupSum - effectivePickupDinar) < AMOUNT_EPS;
  const deliveryComplete =
    totalAmountDinar != null && Math.abs(deliverySum - totalAmountDinar) < AMOUNT_EPS;

  /** أزرار عائمة واضحة - تم إخفاؤها نهائياً بناءً على طلب المستخدم */
  const showPickupFab = false;
  const showDeliveryFab = false;

  // إلغاء زر «استلام الطلب» من واجهة المجهز.
  const canMarkPickedUp = false;
  const canMarkDelivered = false;

  const pickupPanelOpen = pickupOpen;
  const deliveryPanelOpen = deliveryOpen;

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
            expectedAlfHint={effectivePickupDinar != null ? dinarDecimalToAlfInputString(effectivePickupDinar) : ""}
            remainingAlfHint={pickupRemaining != null ? dinarDecimalToAlfInputString(pickupRemaining) : ""}
            advanceToDelivering={pickupAdvanceToDelivering}
            pickupRemainingDinar={pickupRemaining}
            pickupSumDinar={pickupSum}
            orderSubtotalDinar={effectivePickupDinar}
            formAction={pickupAction}
            pending={pickupPending}
            error={pickupState.error}
            onClose={closePanels}
            couriers={couriers}
            currentCourierId={assignedCourierId}
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

/* مكونات المربعات التفاعلية 120x120 من التصميم الفاخر */
function AmountSquareBtn({
  value,
  selected,
  onClick,
  color = "emerald",
}: {
  value: string;
  selected: boolean;
  onClick: () => void;
  color?: "emerald" | "orange";
}) {
  const isEmerald = color === "emerald";
  const activeBg = isEmerald ? "#0A3D2A" : "#8B2E1A";
  const inactiveBg = "#E8E0D0";
  const textColor = selected ? "#F5D77F" : isEmerald ? "#0A3D2A" : "#8B2E1A";

  return (
    <button
      type="button"
      onClick={onClick}
      className={`
        w-[125px] h-[125px] min-w-[125px] min-h-[125px]
        rounded-[20px] border-[2.5px] flex items-center justify-center
        transition-all duration-200 active:scale-[0.95]
        select-none cursor-pointer
        ${selected ? "shadow-[0_0_0_3px_#C9A86A66,0_8px_24px_rgba(0,0,0,0.2)] scale-[1.03]" : "shadow-[0_4px_14px_rgba(0,0,0,0.08)] hover:shadow-[0_6px_18px_rgba(0,0,0,0.12)]"}
      `}
      style={{
        backgroundColor: selected ? activeBg : inactiveBg,
        borderColor: "#C9A86A",
        color: textColor,
      }}
    >
      <span
        style={{
          fontSize: "56px",
          fontWeight: "900",
          lineHeight: "1",
          fontFamily: "monospace, system-ui, sans-serif",
          display: "block",
        }}
      >
        {value}
      </span>
    </button>
  );
}

function ZeroSquareBtn({
  label,
  activeLabel = "0",
  selected,
  onClick,
  color = "emerald",
}: {
  label: string;
  activeLabel?: string;
  selected: boolean;
  onClick: () => void;
  color?: "emerald" | "orange";
}) {
  const isEmerald = color === "emerald";
  const activeBg = isEmerald ? "#0A3D2A" : "#8B2E1A";
  const textColor = selected ? "#F5D77F" : isEmerald ? "#0A3D2A" : "#8B2E1A";

  return (
    <button
      type="button"
      onClick={onClick}
      className={`
        w-[125px] h-[125px] min-w-[125px] min-h-[125px]
        rounded-[20px] border-[2.5px] flex flex-col items-center justify-center
        transition-all duration-200 active:scale-[0.95]
        select-none cursor-pointer
        ${selected ? "shadow-[0_0_0_3px_#C9A86A66,0_8px_24px_rgba(0,0,0,0.2)] scale-[1.03]" : "shadow-[0_4px_14px_rgba(0,0,0,0.06)] hover:shadow-[0_6px_18px_rgba(0,0,0,0.10)]"}
      `}
      style={{
        backgroundColor: selected ? activeBg : "#E8E0D0",
        borderColor: "#C9A86A",
        color: textColor,
      }}
    >
      <span
        style={{
          fontSize: selected ? "56px" : "24px",
          fontWeight: "900",
          lineHeight: "1",
          fontFamily: selected ? "monospace, system-ui, sans-serif" : "inherit",
        }}
      >
        {selected ? activeLabel : label}
      </span>
      {selected && (
        <span className="text-[12px] font-bold mt-1 tracking-wide" style={{ color: "#F5D77F" }}>
          {label}
        </span>
      )}
    </button>
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
  couriers?: { id: string; name: string }[];
  currentCourierId?: string | null;
  orderStatus?: string;
  forDarkModalSurface?: boolean;
  hideContainer?: boolean;
}) {
  const amountRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const targetValue = props.remainingAlfHint || props.expectedAlfHint || "";
  const [amountAlf, setAmountAlf] = useState(targetValue);
  const [selectedBox, setSelectedBox] = useState<"num" | "zero" | null>(targetValue ? "num" : null);

  useEffect(() => {
    const val = props.remainingAlfHint || props.expectedAlfHint || "";
    setAmountAlf(val);
    setSelectedBox(val ? "num" : null);
  }, [props.remainingAlfHint, props.expectedAlfHint, props.orderId]);

  const isMismatch = amountAlf.trim() !== "" && amountAlf.trim() !== targetValue;
  const canAssign = !props.currentCourierId && props.couriers && props.couriers.length > 0;

  return (
    <form ref={formRef} action={props.formAction} className="space-y-4 select-none">
      <input type="hidden" name="p" value={props.auth.p} />
      <input type="hidden" name="exp" value={props.auth.exp} />
      <input type="hidden" name="s" value={props.auth.s} />
      <input type="hidden" name="orderId" value={props.orderId} />
      <input type="hidden" name="next" value={props.nextUrl} />
      <input type="hidden" name="advanceStatus" value="delivering" />

      {props.error && (
        <div className="rounded-xl border border-rose-400 bg-rose-50 p-3 text-xs font-bold text-rose-900">
          {props.error}
        </div>
      )}

      {/* إسناد المندوب إذا كان الطلب غير مسند */}
      {canAssign && (
        <div className="space-y-1.5 rounded-xl border border-[#C9A86A]/40 bg-[#F0EAD8]/40 p-3">
          <span className="text-xs font-bold text-[#0A3D2A] block">
            اختر مندوباً (اختياري) لإسناد الطلب:
          </span>
          <select
            name="assignToCourierId"
            className="w-full rounded-xl border border-[#C9A86A] bg-white px-3 py-2 text-xs font-bold text-[#0A3D2A] focus:outline-none focus:ring-2 focus:ring-[#C9A86A]/40"
          >
            <option value="">— دفع بدون إسناد مندوب —</option>
            {props.couriers?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="text-right">
        <span className="text-[14px] font-bold text-[#0A3D2A]">المبلغ (ألف دينار):</span>
      </div>

      {/* مربعات الاختيار السريع 120x120 مع النقر للتأكيد الفوري */}
      <div className="flex gap-4 justify-center" dir="ltr">
        <AmountSquareBtn
          value={targetValue || "0"}
          selected={selectedBox === "num" || (amountAlf === targetValue && targetValue !== "0")}
          onClick={() => {
            setAmountAlf(targetValue);
            setSelectedBox("num");
            // تأكيد فوري بنقرة واحدة
            setTimeout(() => {
              formRef.current?.requestSubmit();
            }, 30);
          }}
          color="emerald"
        />
        <ZeroSquareBtn
          label="لم يدفع"
          activeLabel="0"
          selected={selectedBox === "zero" || amountAlf === "0"}
          onClick={() => {
            setAmountAlf("0");
            setSelectedBox("zero");
          }}
          color="emerald"
        />
      </div>

      {/* حقل إدخال المبلغ المركزي */}
      <div>
        <input
          ref={amountRef}
          name="amountAlf"
          required
          inputMode="numeric"
          value={amountAlf}
          onChange={(e) => {
            const v = e.target.value;
            setAmountAlf(v);
            if (v === targetValue && targetValue !== "0") setSelectedBox("num");
            else if (v === "0") setSelectedBox("zero");
            else setSelectedBox(null);
          }}
          placeholder={targetValue || "0"}
          className="w-full h-[58px] rounded-[16px] border-[1.5px] border-[#C9A86A] bg-white text-center text-[28px] font-black text-[#0A3D2A] placeholder:text-[#0A3D2A]/30 focus:outline-none focus:ring-2 focus:ring-[#C9A86A]/40"
          style={{ fontSize: "28px", fontWeight: "900" }}
        />
      </div>

      {/* حقل سبب اختلاف المبلغ: يظهر فقط إذا كتب المستخدم سعراً مختلفاً عن المتوقع */}
      {isMismatch ? (
        <div className="space-y-1.5 animate-in fade-in duration-200">
          <label className="text-[13px] font-bold text-[#0A3D2A] block text-right">
            سبب اختلاف الصادر <span className="text-rose-600">*</span>
          </label>
          <textarea
            name="mismatchNote"
            required
            rows={2}
            className="w-full min-h-[78px] rounded-[16px] border-[1.5px] border-[#C9A86A]/70 bg-white px-4 py-3 text-[13px] text-right placeholder:text-[#0A3D2A]/40 focus:outline-none focus:ring-2 focus:ring-[#C9A86A]/30 resize-none font-medium"
            placeholder="اكتب سبب اختلاف المبلغ عن المطلوب..."
          />
        </div>
      ) : (
        <input type="hidden" name="mismatchNote" value="" />
      )}

      {/* الأزرار السفلية */}
      <div className="flex gap-3 pt-2 border-t border-[#C9A86A]/20">
        <button
          type="submit"
          disabled={props.pending}
          className="flex-1 h-[48px] rounded-[16px] font-black text-[15px] text-[#0A3D2A] border border-[#C9A86A] shadow-[0_4px_12px_rgba(0,0,0,0.12)] hover:brightness-[1.03] active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
          style={{ background: "linear-gradient(180deg, #E8D5A3 0%, #C9A86A 100%)" }}
        >
          <span>💾</span>
          <span>{props.pending ? "جاري الحفظ..." : "تأكيد الصادر"}</span>
        </button>
        <button
          type="button"
          onClick={props.onClose}
          className="w-[88px] h-[48px] rounded-[16px] bg-[#F0EAD8] border border-[#C9A86A]/30 font-bold text-[14px] text-[#0A3D2A] hover:bg-[#E8E0D0] transition active:scale-[0.98] cursor-pointer"
        >
          إلغاء
        </button>
      </div>
    </form>
  );
}

export function DeliveryMoneyForm(props: {
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
  forDarkModalSurface?: boolean;
  hideContainer?: boolean;
}) {
  const amountRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const statusSubmitRef = useRef<HTMLButtonElement>(null);
  const targetValue = props.remainingAlfHint || props.expectedAlfHint || "";
  const [amountAlf, setAmountAlf] = useState(targetValue);
  const [selectedBox, setSelectedBox] = useState<"num" | "zero" | null>(targetValue ? "num" : null);

  useEffect(() => {
    const val = props.remainingAlfHint || props.expectedAlfHint || "";
    setAmountAlf(val);
    setSelectedBox(val ? "num" : null);
  }, [props.remainingAlfHint, props.expectedAlfHint, props.orderId]);

  const isMismatch = amountAlf.trim() !== "" && amountAlf.trim() !== targetValue;

  return (
    <form ref={formRef} action={props.formAction} className="space-y-4 select-none">
      <input type="hidden" name="p" value={props.auth.p} />
      <input type="hidden" name="exp" value={props.auth.exp} />
      <input type="hidden" name="s" value={props.auth.s} />
      <input type="hidden" name="orderId" value={props.orderId} />
      <input type="hidden" name="next" value={props.nextUrl} />

      {props.error && (
        <div className="rounded-xl border border-rose-400 bg-rose-50 p-3 text-xs font-bold text-rose-900">
          {props.error}
        </div>
      )}

      <div className="text-right">
        <span className="text-[14px] font-bold text-[#0A3D2A]">المبلغ (ألف دينار):</span>
      </div>

      {/* مربعات الاختيار السريع 120x120 مع النقر للتأكيد الفوري */}
      <div className="flex gap-4 justify-center" dir="ltr">
        <AmountSquareBtn
          value={targetValue || "0"}
          selected={selectedBox === "num" || (amountAlf === targetValue && targetValue !== "0")}
          onClick={() => {
            setAmountAlf(targetValue);
            setSelectedBox("num");
            // تأكيد فوري بنقرة واحدة
            setTimeout(() => {
              formRef.current?.requestSubmit();
            }, 30);
          }}
          color="orange"
        />
        <ZeroSquareBtn
          label="لم استلم"
          activeLabel="0"
          selected={selectedBox === "zero" || amountAlf === "0"}
          onClick={() => {
            setAmountAlf("0");
            setSelectedBox("zero");
          }}
          color="orange"
        />
      </div>

      {/* حقل إدخال المبلغ المركزي */}
      <div>
        <input
          ref={amountRef}
          name="amountAlf"
          required
          inputMode="numeric"
          value={amountAlf}
          onChange={(e) => {
            const v = e.target.value;
            setAmountAlf(v);
            if (v === targetValue && targetValue !== "0") setSelectedBox("num");
            else if (v === "0") setSelectedBox("zero");
            else setSelectedBox(null);
          }}
          placeholder={targetValue || "0"}
          className="w-full h-[58px] rounded-[16px] border-[1.5px] border-[#C9A86A] bg-white text-center text-[28px] font-black text-[#8B2E1A] placeholder:text-[#8B2E1A]/30 focus:outline-none focus:ring-2 focus:ring-[#C9A86A]/40"
          style={{ fontSize: "28px", fontWeight: "900" }}
        />
      </div>

      {/* حقل سبب اختلاف المبلغ: يظهر فقط إذا كتب المستخدم سعراً مختلفاً عن المتوقع */}
      {isMismatch ? (
        <div className="space-y-1.5 animate-in fade-in duration-200">
          <label className="text-[13px] font-bold text-[#0A3D2A] block text-right">
            سبب اختلاف الوارد <span className="text-rose-600">*</span>
          </label>
          <textarea
            name="mismatchNote"
            required
            rows={2}
            className="w-full min-h-[78px] rounded-[16px] border-[1.5px] border-[#C9A86A]/70 bg-white px-4 py-3 text-[13px] text-right placeholder:text-[#0A3D2A]/40 focus:outline-none focus:ring-2 focus:ring-[#C9A86A]/30 resize-none font-medium"
            placeholder="اكتب سبب اختلاف المبلغ عن المطلوب..."
          />
        </div>
      ) : (
        <input type="hidden" name="mismatchNote" value="" />
      )}

      {/* الأزرار السفلية */}
      <div className="flex flex-wrap gap-2 pt-2 border-t border-[#C9A86A]/20">
        <button
          type="submit"
          disabled={props.pending}
          className="flex-1 h-[48px] rounded-[16px] font-black text-[15px] text-white border border-[#C9A86A] shadow-[0_4px_12px_rgba(0,0,0,0.12)] hover:brightness-[1.05] active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
          style={{ background: "linear-gradient(180deg, #F4A27A 0%, #D96A3A 100%)" }}
        >
          <span>💾</span>
          <span>{props.pending ? "جاري الحفظ..." : "تأكيد الوارد"}</span>
        </button>
        <button
          ref={statusSubmitRef}
          type="submit"
          name="advanceStatus"
          value="delivered"
          disabled={props.pending}
          className="flex-1 h-[48px] rounded-[16px] font-black text-[14px] text-white border border-[#C9A86A] bg-red-800 hover:bg-red-900 active:scale-[0.98] transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-60 shadow-md"
        >
          <span>✅</span>
          <span>{props.pending ? "..." : "تسجيل + تم التسليم"}</span>
        </button>
        <button
          type="button"
          onClick={props.onClose}
          className="w-[88px] h-[48px] rounded-[16px] bg-[#F0EAD8] border border-[#C9A86A]/30 font-bold text-[14px] text-[#0A3D2A] hover:bg-[#E8E0D0] transition active:scale-[0.98] cursor-pointer"
        >
          إلغاء
        </button>
      </div>
    </form>
  );
}

