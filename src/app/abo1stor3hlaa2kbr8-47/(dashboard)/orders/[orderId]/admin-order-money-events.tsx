"use client";

import { useActionState, useEffect, useMemo, useState, useRef } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { ad } from "@/lib/admin-ui";
import {
  submitAdminPickupMoney,
  submitAdminDeliveryMoney,
  hardDeleteOrderCourierMoneyEventAdmin,
  softDeleteMandoubMoneyEventAdmin,
  type MandoubCashState,
} from "@/app/mandoub/cash-actions";
import { ADMIN_MONEY_HARD_DELETE_CONFIRM_PHRASE } from "@/lib/mandoub-cash-constants";
import {
  dinarDecimalToAlfInputString,
  formatDinarAsAlfWithUnit,
  parseAlfInputToDinarDecimalRequired,
} from "@/lib/money-alf";
import { MONEY_KIND_DELIVERY, MONEY_KIND_PICKUP } from "@/lib/mandoub-money-events";
import { DynamicIcon } from "@/components/dynamic-icon";
import { getGlobalIcons, GlobalIconsConfig } from "@/lib/icon-settings";
import {
  moneyLedgerAmountClass,
  moneySaderRemainValueClass,
  moneySaderSummaryBoxClass,
  moneySaderTotalValueClass,
  moneyWardRemainValueClass,
  moneyWardSummaryBoxClass,
  moneyWardTotalValueClass,
} from "@/lib/money-entry-ui";
import { formatBaghdadMoneyRecordedAt } from "@/lib/baghdad-time";

const initialCash: MandoubCashState = {};

export type AdminOrderMoneyEventRow = {
  id: string;
  kind: string;
  amountDinar: number;
  expectedDinar: number | null;
  matchesExpected: boolean;
  mismatchReason: string;
  mismatchNote: string;
  recordedAt: string;
  deletedAt: string | null;
  deletedReason: string | null;
  deletedByDisplayName: string | null;
  performedByDisplayName: string;
  recordedByCompanyPreparerId: string | null;
  courierId?: string | null;
};

export function AdminOrderMoneyEvents({
  orderId,
  orderNumber,
  orderStatus,
  assignedCourierId,
  courierName,
  orderSubtotalDinar,
  totalAmountDinar,
  nextPath,
  events,
  prepaidAll = false,
}: {
  orderId?: string;
  orderNumber: number;
  orderStatus?: string;
  assignedCourierId?: string | null;
  courierName?: string | null;
  orderSubtotalDinar?: number | null;
  totalAmountDinar?: number | null;
  nextPath: string;
  events: AdminOrderMoneyEventRow[];
  prepaidAll?: boolean;
}) {
  const router = useRouter();
  const [pickupOpen, setPickupOpen] = useState(false);
  const [deliveryOpen, setDeliveryOpen] = useState(false);
  const [pickupAdvanceToDelivering, setPickupAdvanceToDelivering] = useState(false);
  const [deliveryAdvanceToDelivered, setDeliveryAdvanceToDelivered] = useState(false);
  const [icons, setIcons] = useState<GlobalIconsConfig | null>(null);
  const [phraseById, setPhraseById] = useState<Record<string, string>>({});
  const [toastMsg, setToastMsg] = useState<{ text: string; type: "success" | "error" } | null>(null);

  const [pickupState, pickupAction, pickupPending] = useActionState(
    submitAdminPickupMoney,
    initialCash,
  );
  const [deliveryState, deliveryAction, deliveryPending] = useActionState(
    submitAdminDeliveryMoney,
    initialCash,
  );
  const [softState, softAction, softPending] = useActionState(
    softDeleteMandoubMoneyEventAdmin,
    initialCash,
  );
  const [hardState, hardAction, hardPending] = useActionState(
    hardDeleteOrderCourierMoneyEventAdmin,
    initialCash,
  );

  useEffect(() => {
    getGlobalIcons().then(setIcons);
  }, []);

  const closePanels = () => {
    setPickupOpen(false);
    setDeliveryOpen(false);
    setPickupAdvanceToDelivering(false);
    setDeliveryAdvanceToDelivered(false);
  };

  useEffect(() => {
    if (pickupState.error) {
      setToastMsg({ text: pickupState.error, type: "error" });
    } else if (pickupState.success) {
      const msg = assignedCourierId
        ? `تم استلام الطلب وتسجيل الصادر بالنيابة عن المندوب (${courierName || "المندوب"}) بنجاح! ⚡`
        : "تم استلام الطلب وتسجيل الصادر للإدارة بنجاح! ⚡";
      setToastMsg({ text: msg, type: "success" });
      closePanels();
      router.refresh();
      setTimeout(() => setToastMsg(null), 4000);
    }
  }, [pickupState, router, assignedCourierId, courierName]);

  useEffect(() => {
    if (deliveryState.error) {
      setToastMsg({ text: deliveryState.error, type: "error" });
    } else if (deliveryState.success) {
      const msg = assignedCourierId
        ? `تم تسليم الطلب واحتساب أرباح التوصيل للمندوب (${courierName || "المندوب"}) بنجاح! 🎉`
        : "تم تسليم الطلب وتسجيل الوارد والأرباح للإدارة بنجاح! 🎉";
      setToastMsg({ text: msg, type: "success" });
      closePanels();
      router.refresh();
      setTimeout(() => setToastMsg(null), 4000);
    }
  }, [deliveryState, router, assignedCourierId, courierName]);

  useEffect(() => {
    if (softState.ok) {
      setToastMsg({ text: "تم مسح الحركة بنجاح.", type: "success" });
      router.refresh();
      setTimeout(() => setToastMsg(null), 4000);
    } else if (softState.error) {
      setToastMsg({ text: softState.error, type: "error" });
    }
  }, [softState, router]);

  useEffect(() => {
    if (hardState.ok) {
      setToastMsg({ text: "تم الحذف النهائي للحركة بنجاح.", type: "success" });
      router.refresh();
      setTimeout(() => setToastMsg(null), 4000);
    } else if (hardState.error) {
      setToastMsg({ text: hardState.error, type: "error" });
    }
  }, [hardState, router]);

  const activeEvents = useMemo(
    () => events.filter((e) => e.deletedAt == null),
    [events],
  );

  const pickupSum = useMemo(
    () =>
      activeEvents
        .filter((e) => e.kind === MONEY_KIND_PICKUP)
        .reduce((acc, e) => acc + e.amountDinar, 0),
    [activeEvents],
  );

  const deliverySum = useMemo(
    () =>
      activeEvents
        .filter((e) => e.kind === MONEY_KIND_DELIVERY)
        .reduce((acc, e) => acc + e.amountDinar, 0),
    [activeEvents],
  );

  const pickupRemaining = useMemo(() => {
    if (orderSubtotalDinar == null) return null;
    return orderSubtotalDinar - pickupSum;
  }, [orderSubtotalDinar, pickupSum]);

  const deliveryRemaining = useMemo(() => {
    if (totalAmountDinar == null) return null;
    return totalAmountDinar - deliverySum;
  }, [totalAmountDinar, deliverySum]);

  const canMarkPickedUp = orderStatus === "assigned" || orderStatus === "pending";
  const canMarkDelivered = orderStatus === "delivering";
  const isDelivered = orderStatus === "delivered";

  return (
    <div className={`${ad.section} space-y-4 relative`} dir="rtl">
      {/* التوست المنبثق */}
      {toastMsg && (
        <div
          className={`fixed top-5 left-1/2 -translate-x-1/2 z-[150] flex items-center gap-3 rounded-2xl px-5 py-3.5 shadow-2xl border-2 text-white font-black text-sm sm:text-base animate-in slide-in-from-top duration-300 ${
            toastMsg.type === "success"
              ? "bg-emerald-900 border-emerald-400"
              : "bg-rose-900 border-rose-400"
          }`}
        >
          <span>{toastMsg.type === "success" ? "✅" : "⚠️"}</span>
          <span>{toastMsg.text}</span>
          <button
            onClick={() => setToastMsg(null)}
            className="mr-2 text-white/80 hover:text-white font-bold text-lg cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* --- الزر الدائري العائم القابل للسحب والتحريك (نفس المندوب مع منع الرفريش) --- */}
      {orderId && (canMarkPickedUp || canMarkDelivered) && (
        <AdminFloatingStatusFab
          mode={canMarkPickedUp ? "pickedUp" : "delivered"}
          onClick={() => {
            if (canMarkPickedUp) {
              setPickupAdvanceToDelivering(true);
              setPickupOpen(true);
              setDeliveryOpen(false);
            } else {
              setDeliveryAdvanceToDelivered(true);
              setDeliveryOpen(true);
              setPickupOpen(false);
            }
          }}
        />
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-sky-100 pb-3">
        <h2 className="text-lg sm:text-xl font-black text-slate-900 flex items-center gap-2">
          <span>📊</span>
          <span>المعاملات المالية للطلب وإجراءات الاستلام والتسليم</span>
        </h2>
        
        {assignedCourierId ? (
          <span className="text-[11px] sm:text-xs font-black text-sky-900 bg-sky-50 border border-sky-200 px-3 py-1 rounded-xl flex items-center gap-1">
            <span>🛵</span>
            <span>مسند للمندوب: <strong>{courierName || "المندوب"}</strong> (تُحسب له الأرباح والحركات بالنيابة)</span>
          </span>
        ) : (
          <span className="text-[11px] sm:text-xs font-black text-emerald-800 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-xl flex items-center gap-1">
            <span>🏢</span>
            <span>غير مسند لمندوب (تُسجل للإدارة مباشرة وتظهر في دفتر الديون باسم الإدارة)</span>
          </span>
        )}
      </div>

      {/* --- أزرار أعطيت وأخذت لتسجيل المبالغ والصادر والوارد --- */}
      {orderId && (
        <div className="space-y-3 my-2">
          {isDelivered && (
            <div className="w-full flex items-center justify-center gap-2 rounded-2xl border-2 border-emerald-400 bg-emerald-50 p-3 text-emerald-950 font-black text-sm sm:text-base">
              <span className="text-xl">🎉</span>
              <span>تم تسليم هذا الطلب بنجاح ✅</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            {/* زر أعطيت (صادر) */}
            <button
              type="button"
              onClick={() => {
                setPickupAdvanceToDelivering(false);
                setPickupOpen(true);
                setDeliveryOpen(false);
              }}
              className="flex min-h-[52px] items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-4 font-black text-white shadow-md hover:bg-emerald-700 active:scale-95 transition-all text-sm sm:text-base cursor-pointer"
            >
              <DynamicIcon iconKey="wallet_cash" config={icons} className="size-5" fallback="💸" />
              <span>أعطيت للعميل (صادر)</span>
              {pickupRemaining !== null && (
                <span className="text-xs font-bold bg-emerald-700/80 px-2 py-0.5 rounded-lg mr-1">
                  المتبقي: {formatDinarAsAlfWithUnit(Math.max(0, pickupRemaining))}
                </span>
              )}
            </button>

            {/* زر أخذت (وارد) */}
            <button
              type="button"
              onClick={() => {
                setDeliveryAdvanceToDelivered(false);
                setDeliveryOpen(true);
                setPickupOpen(false);
              }}
              className="flex min-h-[52px] items-center justify-center gap-2 rounded-2xl bg-rose-600 px-4 font-black text-white shadow-md hover:bg-rose-700 active:scale-95 transition-all text-sm sm:text-base cursor-pointer"
            >
              <DynamicIcon iconKey="ui_inbox" config={icons} className="size-5" fallback="🫴" />
              <span>أخذت من الزبون (وارد)</span>
              {deliveryRemaining !== null && !prepaidAll && (
                <span className="text-xs font-bold bg-rose-700/80 px-2 py-0.5 rounded-lg mr-1">
                  المتبقي: {formatDinarAsAlfWithUnit(Math.max(0, deliveryRemaining))}
                </span>
              )}
            </button>
          </div>
        </div>
      )}

      {/* --- مودال تسجيل الصادر (أعطيت / استلام) --- */}
      {pickupOpen && orderId && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto animate-in fade-in duration-200">
          <div className="w-full max-w-lg rounded-3xl bg-white p-5 sm:p-6 shadow-2xl ring-1 ring-slate-200 animate-in zoom-in-95 duration-200 text-right">
            <div className="mb-4 flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h4 className="text-lg font-black text-emerald-950 flex items-center gap-2">
                  <span>💸</span>
                  <span>
                    {pickupAdvanceToDelivering ? "⚡ استلام الطلب وتغيير الحالة" : "تسجيل صادر (أعطيت للعميل)"}
                  </span>
                </h4>
                <p className="text-xs font-bold text-slate-500">
                  الطلب #{orderNumber} — {assignedCourierId ? `بالنيابة عن: ${courierName || "المندوب"}` : "تسجيل للإدارة"}
                </p>
              </div>
              <button
                type="button"
                onClick={closePanels}
                className="h-9 w-9 rounded-full bg-slate-100 text-lg font-bold text-slate-500 hover:bg-slate-200 transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            <AdminPickupFormModal
              orderId={orderId}
              nextPath={nextPath}
              expectedAlfHint={
                orderSubtotalDinar != null ? dinarDecimalToAlfInputString(orderSubtotalDinar) : ""
              }
              remainingAlfHint={
                pickupRemaining != null ? dinarDecimalToAlfInputString(Math.max(0, pickupRemaining)) : ""
              }
              defaultAdvance={pickupAdvanceToDelivering}
              formAction={pickupAction}
              pending={pickupPending}
              error={pickupState.error}
              onClose={closePanels}
            />
          </div>
        </div>
      )}

      {/* --- مودال تسجيل الوارد (أخذت / تسليم) --- */}
      {deliveryOpen && orderId && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto animate-in fade-in duration-200">
          <div className="w-full max-w-lg rounded-3xl bg-white p-5 sm:p-6 shadow-2xl ring-1 ring-slate-200 animate-in zoom-in-95 duration-200 text-right">
            <div className="mb-4 flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h4 className="text-lg font-black text-rose-950 flex items-center gap-2">
                  <span>🫴</span>
                  <span>
                    {deliveryAdvanceToDelivered ? "🎉 تسليم الطلب واحتساب الأرباح" : "تسجيل وارد (أخذت من الزبون)"}
                  </span>
                </h4>
                <p className="text-xs font-bold text-slate-500">
                  الطلب #{orderNumber} — {assignedCourierId ? `بالنيابة عن: ${courierName || "المندوب"}` : "تسجيل للإدارة"}
                </p>
              </div>
              <button
                type="button"
                onClick={closePanels}
                className="h-9 w-9 rounded-full bg-slate-100 text-lg font-bold text-slate-500 hover:bg-slate-200 transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            <AdminDeliveryFormModal
              orderId={orderId}
              nextPath={nextPath}
              expectedAlfHint={
                totalAmountDinar != null ? dinarDecimalToAlfInputString(totalAmountDinar) : ""
              }
              remainingAlfHint={
                deliveryRemaining != null ? dinarDecimalToAlfInputString(Math.max(0, deliveryRemaining)) : ""
              }
              defaultAdvance={deliveryAdvanceToDelivered}
              formAction={deliveryAction}
              pending={deliveryPending}
              error={deliveryState.error}
              onClose={closePanels}
              prepaidAll={prepaidAll}
            />
          </div>
        </div>
      )}

      {/* --- قائمة المعاملات النقدية المسجلة --- */}
      {events.length === 0 ? (
        <p className="text-center text-slate-500 py-6 bg-slate-50 rounded-2xl border border-slate-200 text-sm font-bold">
          لا توجد معاملات نقد مسجّلة لهذا الطلب بعد.
        </p>
      ) : (
        <ul className="space-y-3">
          {events.map((ev) => {
            const deleted = ev.deletedAt != null;
            const dirLabel = ev.kind === MONEY_KIND_PICKUP ? "صادر" : "وارد";
            const noteParts: string[] = [];
            if (ev.mismatchReason?.trim()) noteParts.push(ev.mismatchReason.trim());
            if (ev.mismatchNote?.trim()) noteParts.push(ev.mismatchNote.trim());
            const noteLine = noteParts.length > 0 ? noteParts.join(" — ") : "—";
            const phrase = phraseById[ev.id] ?? "";
            const canSubmitHard = phrase.trim() === ADMIN_MONEY_HARD_DELETE_CONFIRM_PHRASE;
            const isRecordedByAdmin = !ev.courierId && !ev.recordedByCompanyPreparerId;
            const timeInfo = formatBaghdadMoneyRecordedAt(ev.recordedAt);

            return (
              <li
                key={ev.id}
                className={`rounded-2xl border-2 p-3.5 text-sm transition-all ${
                  deleted
                    ? "border-slate-200 bg-slate-100/80 text-slate-600 line-through decoration-slate-400"
                    : ev.kind === MONEY_KIND_PICKUP
                      ? "border-emerald-300 bg-emerald-50/90 text-emerald-950 shadow-xs"
                      : "border-rose-300 bg-rose-50/90 text-red-950 shadow-xs"
                }`}
              >
                <div className="space-y-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1 space-y-1.5 leading-relaxed text-right">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={`font-black text-xs px-2.5 py-0.5 rounded-lg text-white ${
                            ev.kind === MONEY_KIND_PICKUP ? "bg-emerald-600" : "bg-rose-600"
                          }`}
                        >
                          {dirLabel}
                        </span>
                        <span className="font-black text-slate-900 text-sm">
                          {isRecordedByAdmin ? "🏢 الإدارة" : ev.performedByDisplayName || "المندوب"}
                        </span>
                        <span
                          className="text-xs font-mono font-bold text-slate-600 inline-flex items-center gap-1.5 bg-white/80 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 px-2 py-0.5 rounded-lg shadow-2xs"
                          dir="ltr"
                        >
                          <span className="tabular-nums">{timeInfo.dateStr}</span>
                          <span className="text-slate-300 font-normal">|</span>
                          <span className="tabular-nums">{timeInfo.timeStr}</span>
                        </span>
                      </div>

                      <p className="text-sm flex flex-wrap items-baseline gap-3">
                        <span className="font-bold text-slate-800">
                          المسجّل:{" "}
                          <span className="font-mono font-black tabular-nums text-slate-900 text-base">
                            {formatDinarAsAlfWithUnit(ev.amountDinar)}
                          </span>
                        </span>
                        {ev.expectedDinar != null && (
                          <span className="font-bold text-slate-600">
                            المتوقع:{" "}
                            <span className="font-mono font-bold tabular-nums">
                              {formatDinarAsAlfWithUnit(ev.expectedDinar)}
                            </span>
                          </span>
                        )}
                      </p>

                      {noteLine !== "—" && (
                        <p className="text-xs font-bold text-slate-700">
                          <span className="text-slate-500">ملاحظة: </span>
                          <span className="whitespace-pre-wrap break-words">{noteLine}</span>
                        </p>
                      )}

                      {ev.recordedByCompanyPreparerId ? (
                        <p className="text-xs font-black text-violet-800">
                          📦 سُجّلت من لوحة المجهز
                        </p>
                      ) : null}

                      {deleted ? (
                        <p className="text-xs font-bold text-rose-700">
                          {ev.deletedReason === "status_revert" ? (
                            <>⚠️ أُلغيت تلقائياً عند تغيير حالة الطلب</>
                          ) : (
                            <>⚠️ محذوف يدوياً {ev.deletedByDisplayName ? `بواسطة: ${ev.deletedByDisplayName}` : ""}</>
                          )}
                        </p>
                      ) : null}
                    </div>

                    {!deleted ? (
                      <form action={softAction} className="shrink-0 flex flex-col gap-1">
                        <input type="hidden" name="eventId" value={ev.id} />
                        <input type="hidden" name="nextPath" value={nextPath} />
                        <button
                          type="submit"
                          disabled={softPending}
                          className="inline-flex min-h-[38px] items-center justify-center gap-1 rounded-xl border border-rose-300 bg-white hover:bg-rose-50 px-3 py-1.5 text-xs font-black text-rose-800 shadow-xs transition-colors cursor-pointer"
                          onClick={(e) => {
                            if (
                              !window.confirm(
                                `تأكيد مسح (إلغاء) حركة «${dirLabel}» للطلب #${orderNumber}؟ تبقى في السجل كمعاملة ملغاة.`,
                              )
                            ) {
                              e.preventDefault();
                            }
                          }}
                        >
                          <span>🗑️</span>
                          <span>مسح الحركة</span>
                        </button>
                      </form>
                    ) : null}
                  </div>

                  {/* الحذف النهائي من قاعدة البيانات */}
                  <div className="border-t border-slate-200/80 pt-2.5">
                    <form action={hardAction} className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end">
                      <input type="hidden" name="eventId" value={ev.id} />
                      <input type="hidden" name="nextPath" value={nextPath} />
                      <label className="flex min-w-0 flex-1 flex-col gap-1 text-xs font-bold text-slate-700 text-right">
                        <span>حذف نهائي (اكتب: <code className="rounded bg-rose-100 px-1 text-rose-900 font-mono">{ADMIN_MONEY_HARD_DELETE_CONFIRM_PHRASE}</code>):</span>
                        <input
                          type="text"
                          name="confirmPhrase"
                          value={phrase}
                          onChange={(e) =>
                            setPhraseById((prev) => ({
                              ...prev,
                              [ev.id]: e.target.value,
                            }))
                          }
                          autoComplete="off"
                          className="rounded-xl border border-slate-300 px-2.5 py-1.5 text-xs text-slate-900 focus:border-rose-600 focus:outline-hidden"
                          placeholder={ADMIN_MONEY_HARD_DELETE_CONFIRM_PHRASE}
                        />
                      </label>
                      <button
                        type="submit"
                        disabled={hardPending || !canSubmitHard}
                        className="inline-flex min-h-[36px] items-center justify-center rounded-xl bg-rose-900 px-3.5 py-1.5 text-xs font-black text-white shadow-xs hover:bg-rose-950 transition-colors disabled:opacity-40 cursor-pointer"
                        onClick={(e) => {
                          if (
                            !window.confirm("تأكيد أول: سيتم حذف هذه المعاملة نهائياً من كل السجلات والتقارير.") ||
                            !window.confirm("تأكيد نهائي: لا يمكن التراجع عن هذا الإجراء إطلاقاً. هل تريد المتابعة؟")
                          ) {
                            e.preventDefault();
                          }
                        }}
                      >
                        حذف نهائي ❌
                      </button>
                    </form>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function AdminPickupFormModal({
  orderId,
  nextPath,
  expectedAlfHint,
  remainingAlfHint,
  defaultAdvance = false,
  formAction,
  pending,
  error,
  onClose,
}: {
  orderId: string;
  nextPath: string;
  expectedAlfHint: string;
  remainingAlfHint: string;
  defaultAdvance?: boolean;
  formAction: (formData: FormData) => void;
  pending: boolean;
  error?: string;
  onClose: () => void;
}) {
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [advanceStatus, setAdvanceStatus] = useState(defaultAdvance ? "delivering" : "");
  const formRef = useRef<HTMLFormElement>(null);
  const amountRef = useRef<HTMLInputElement>(null);
  const noteRef = useRef<HTMLTextAreaElement>(null);
  const submitModeRef = useRef<HTMLInputElement>(null);
  const mainSubmitRef = useRef<HTMLButtonElement>(null);

  const displayTargetAlf = remainingAlfHint || expectedAlfHint || "";

  return (
    <div className="space-y-3 text-right">
      <p className="font-bold text-emerald-950 text-sm">اكتب المبلغ الذي سلّمته للعميل أو انقر على الزر السريع:</p>
      
      <div className={moneySaderSummaryBoxClass}>
        <span>سعر الطلب: <span className={moneySaderTotalValueClass}>{expectedAlfHint || "—"}</span></span>
        <span>المتبقي للصادر: <span className={moneySaderRemainValueClass}>{remainingAlfHint || "—"}</span></span>
      </div>

      <form
        ref={formRef}
        action={formAction}
        className="space-y-3"
      >
        <input ref={submitModeRef} type="hidden" name="mandoubMoneySubmitMode" value="" />
        <input type="hidden" name="orderId" value={orderId} />
        <input type="hidden" name="next" value={nextPath} />
        <input type="hidden" name="advanceStatus" value={advanceStatus} />

        {/* سطر الإدخال: باليمين خانة مصغرة جداً يدوياً ، وباليسار زر مربع كبيييير جداً للنقر السريع المباشر */}
        <div className="flex items-center justify-between gap-3 pt-1">
          {/* اليمين: خانة كتابة السعر يدوياً مصغرة ومضغوطة جداً */}
          <div className="w-28 sm:w-32 shrink-0 space-y-1">
            <label className="text-[10px] font-bold text-slate-500 block text-center truncate">سعر آخر يدوياً:</label>
            <input
              ref={amountRef}
              name="amountAlf"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className={`${moneySaderAmountInputClass} animate-placeholder w-full text-center text-xs h-10 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-bold`}
              placeholder="اكتب السعر"
              inputMode="decimal"
              enterKeyHint="done"
            />
          </div>

          {/* اليسار: زر مربع كبيييييير جداً وضخم ملفت للنقر السريع بلمسة واحدة */}
          {displayTargetAlf && (
            <div className="relative flex-1 flex justify-end min-w-0">
              <span className="pointer-events-none absolute -top-3 -right-1 text-sm star-particle-1 z-10 select-none">✨</span>
              <span className="pointer-events-none absolute -bottom-2 left-1 text-sm star-particle-2 z-10 select-none">💫</span>

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  if (amountRef.current) amountRef.current.value = displayTargetAlf;
                  if (submitModeRef.current) submitModeRef.current.value = "";
                  setAmount(displayTargetAlf);
                  setAdvanceStatus("delivering");
                  setTimeout(() => {
                    formRef.current?.requestSubmit(mainSubmitRef.current ?? undefined);
                  }, 40);
                }}
                className="magical-money-block-green w-full max-w-[210px] h-20 flex items-center justify-center rounded-2xl border-2 border-emerald-500 bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-600 p-2 font-black text-white shadow-xl active:scale-95 transition-all cursor-pointer select-none group"
                title="اضغط لتأكيد وإرسال المبلغ وتغيير الحالة مباشرة"
              >
                <div className="flex items-baseline justify-center gap-1">
                  <span className="text-4xl sm:text-5xl font-black drop-shadow-md tracking-tighter leading-none">
                    {displayTargetAlf}
                  </span>
                  <span className="text-xs sm:text-sm font-bold opacity-90 shrink-0 select-none">
                    ألف
                  </span>
                </div>
              </button>
            </div>
          )}
        </div>

        <div className="space-y-1.5 pt-1">
          <label className="text-xs font-black text-slate-800 block">سبب الاختلاف / ملاحظة (إن وجد):</label>
          <textarea
            ref={noteRef}
            name="mismatchNote"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            className="w-full rounded-xl border border-slate-300 p-2 text-xs font-bold text-slate-800 focus:border-emerald-600 focus:outline-hidden"
            placeholder="اكتب الملاحظة هنا إن كان المبلغ غير مطابق..."
          />
        </div>

        <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50/70 p-3">
          <input
            type="checkbox"
            id="advancePickupDeliveringModal"
            checked={advanceStatus === "delivering"}
            onChange={(e) => setAdvanceStatus(e.target.checked ? "delivering" : "")}
            className="size-4 rounded border-emerald-400 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
          />
          <label htmlFor="advancePickupDeliveringModal" className="text-xs font-black text-emerald-950 cursor-pointer select-none">
            تغيير حالة الطلب تلقائياً إلى «قيد التوصيل» 🛵
          </label>
        </div>

        {error && <p className="text-xs font-black text-rose-600">{error}</p>}

        <div className="flex flex-wrap items-center justify-end gap-2 pt-2 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl bg-slate-100 hover:bg-slate-200 px-4 py-2.5 text-xs font-bold text-slate-700 cursor-pointer"
          >
            إلغاء
          </button>
          
          <button
            type="submit"
            formNoValidate
            disabled={pending}
            onClick={() => {
              if (submitModeRef.current) submitModeRef.current.value = "statusOnlyNoAmount";
              setAdvanceStatus("delivering");
            }}
            className="rounded-xl border-2 border-amber-500 bg-amber-50 px-4 py-2 text-xs font-black text-amber-950 shadow-sm transition hover:bg-amber-100 disabled:opacity-60 cursor-pointer"
            title="تحويل الحالة إلى «قيد التوصيل» دون تسجيل مبلغ صادر"
          >
            لم أدفع (تغيير الحالة فقط)
          </button>

          <button
            ref={mainSubmitRef}
            type="submit"
            disabled={pending}
            className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 px-5 py-2.5 text-xs sm:text-sm font-black text-white shadow-md active:scale-95 transition-all disabled:opacity-60 cursor-pointer"
          >
            {pending ? "جاري الحفظ..." : "💾 تأكيد وتسجيل الصادر"}
          </button>
        </div>
      </form>
    </div>
  );
}

function AdminDeliveryFormModal({
  orderId,
  nextPath,
  expectedAlfHint,
  remainingAlfHint,
  defaultAdvance = false,
  formAction,
  pending,
  error,
  onClose,
  prepaidAll = false,
}: {
  orderId: string;
  nextPath: string;
  expectedAlfHint: string;
  remainingAlfHint: string;
  defaultAdvance?: boolean;
  formAction: (formData: FormData) => void;
  pending: boolean;
  error?: string;
  onClose: () => void;
  prepaidAll?: boolean;
}) {
  const [amount, setAmount] = useState(prepaidAll ? "0" : "");
  const [note, setNote] = useState(prepaidAll ? "كلشي واصل" : "");
  const [advanceStatus, setAdvanceStatus] = useState(defaultAdvance ? "delivered" : "");
  const formRef = useRef<HTMLFormElement>(null);
  const amountRef = useRef<HTMLInputElement>(null);
  const noteRef = useRef<HTMLTextAreaElement>(null);
  const submitModeRef = useRef<HTMLInputElement>(null);
  const mainSubmitRef = useRef<HTMLButtonElement>(null);

  const displayTargetAlf = prepaidAll ? "0" : (remainingAlfHint || expectedAlfHint || "");

  return (
    <div className="space-y-3 text-right">
      <p className="font-bold text-red-950 text-sm">
        {prepaidAll
          ? "الطلب واصل حسابه مسبقاً — انقر للتأكيد وتحويل الحالة إلى «تم التسليم»"
          : "اكتب المبلغ المستلم من الزبون أو انقر على الزر السريع:"}
      </p>

      <div className={moneyWardSummaryBoxClass}>
        <span>المبلغ الكلي: <span className={moneyWardTotalValueClass}>{prepaidAll ? "كل شي واصل" : expectedAlfHint || "—"}</span></span>
        <span>المتبقي للوارد: <span className={moneyWardRemainValueClass}>{prepaidAll ? "0" : remainingAlfHint || "—"}</span></span>
      </div>

      <form
        ref={formRef}
        action={formAction}
        className="space-y-3"
      >
        <input ref={submitModeRef} type="hidden" name="mandoubMoneySubmitMode" value="" />
        <input type="hidden" name="orderId" value={orderId} />
        <input type="hidden" name="next" value={nextPath} />
        <input type="hidden" name="advanceStatus" value={advanceStatus} />

        {/* سطر الإدخال: باليمين خانة مصغرة جداً يدوياً ، وباليسار زر مربع كبيييير جداً للنقر السريع المباشر */}
        <div className="flex items-center justify-between gap-3 pt-1">
          {/* اليمين: خانة كتابة السعر يدوياً مصغرة ومضغوطة جداً */}
          <div className="w-28 sm:w-32 shrink-0 space-y-1">
            <label className="text-[10px] font-bold text-slate-500 block text-center truncate">سعر آخر يدوياً:</label>
            <input
              ref={amountRef}
              name="amountAlf"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className={`${moneyWardAmountInputClass} animate-placeholder w-full text-center text-xs h-10 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-bold`}
              placeholder="اكتب السعر"
              inputMode="decimal"
              enterKeyHint="done"
            />
          </div>

          {/* اليسار: زر مربع كبيييييير جداً وضخم ملفت للنقر السريع بلمسة واحدة */}
          {displayTargetAlf !== "" && (
            <div className="relative flex-1 flex justify-end min-w-0">
              <span className="pointer-events-none absolute -top-3 -right-1 text-sm star-particle-1 z-10 select-none">✨</span>
              <span className="pointer-events-none absolute -bottom-2 left-1 text-sm star-particle-2 z-10 select-none">💫</span>

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  if (amountRef.current) amountRef.current.value = displayTargetAlf;
                  if (submitModeRef.current) submitModeRef.current.value = "";
                  setAmount(displayTargetAlf);
                  setAdvanceStatus("delivered");
                  setTimeout(() => {
                    formRef.current?.requestSubmit(mainSubmitRef.current ?? undefined);
                  }, 40);
                }}
                className="magical-money-block-red w-full max-w-[210px] h-20 flex items-center justify-center rounded-2xl border-2 border-red-500 bg-gradient-to-r from-rose-600 via-red-600 to-rose-700 p-2 font-black text-white shadow-xl active:scale-95 transition-all cursor-pointer select-none group"
                title="اضغط لتأكيد وإرسال المبلغ وتغيير الحالة مباشرة"
              >
                <div className="flex items-baseline justify-center gap-1">
                  <span className="text-4xl sm:text-5xl font-black drop-shadow-md tracking-tighter leading-none">
                    {displayTargetAlf}
                  </span>
                  <span className="text-xs sm:text-sm font-bold opacity-90 shrink-0 select-none">
                    {prepaidAll ? "واصل" : "ألف"}
                  </span>
                </div>
              </button>
            </div>
          )}
        </div>

        <div className="space-y-1.5 pt-1">
          <label className="text-xs font-black text-slate-800 block">سبب الاختلاف / ملاحظة (إن وجد):</label>
          <textarea
            ref={noteRef}
            name="mismatchNote"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            className="w-full rounded-xl border border-slate-300 p-2 text-xs font-bold text-slate-800 focus:border-rose-600 focus:outline-hidden"
            placeholder="اكتب الملاحظة هنا إن كان المبلغ غير مطابق..."
          />
        </div>

        <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50/70 p-3">
          <input
            type="checkbox"
            id="advanceDeliveryDeliveredModal"
            checked={advanceStatus === "delivered"}
            onChange={(e) => setAdvanceStatus(e.target.checked ? "delivered" : "")}
            className="size-4 rounded border-rose-400 text-rose-600 focus:ring-rose-500 cursor-pointer"
          />
          <label htmlFor="advanceDeliveryDeliveredModal" className="text-xs font-black text-rose-950 cursor-pointer select-none">
            تغيير حالة الطلب تلقائياً إلى «تم التسليم» 🎉
          </label>
        </div>

        {error && <p className="text-xs font-black text-rose-600">{error}</p>}

        <div className="flex flex-wrap items-center justify-end gap-2 pt-2 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl bg-slate-100 hover:bg-slate-200 px-4 py-2.5 text-xs font-bold text-slate-700 cursor-pointer"
          >
            إلغاء
          </button>

          <button
            type="submit"
            formNoValidate
            disabled={pending}
            onClick={() => {
              if (submitModeRef.current) submitModeRef.current.value = "statusOnlyNoAmount";
              setAdvanceStatus("delivered");
            }}
            className="rounded-xl border-2 border-rose-400 bg-rose-50 px-4 py-2 text-xs font-black text-rose-950 shadow-sm transition hover:bg-rose-100 disabled:opacity-60 cursor-pointer"
            title="تحويل الحالة إلى «تم التسليم» دون تسجيل مبلغ وارد"
          >
            تأكيد تسليم بدون مبلغ
          </button>

          <button
            ref={mainSubmitRef}
            type="submit"
            disabled={pending}
            className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 px-5 py-2.5 text-xs sm:text-sm font-black text-white shadow-md active:scale-95 transition-all disabled:opacity-60 cursor-pointer"
          >
            {pending ? "جاري الحفظ..." : "💾 تأكيد وتسجيل الوارد"}
          </button>
        </div>
      </form>
    </div>
  );
}

/** مكون الزر العائم الدائري القابل للسحب والتحريك للإدارة (مع منع الرفريش بالسحب) */
function AdminFloatingStatusFab({
  mode,
  onClick,
}: {
  mode: "pickedUp" | "delivered";
  onClick: () => void;
}) {
  const [mounted, setMounted] = useState(false);
  const [pos, setPos] = useState({ left: 16, top: 120 });
  const dragRef = useRef<{ startX: number; startY: number; origLeft: number; origTop: number; moved: boolean } | null>(null);
  const nodeRef = useRef<HTMLDivElement | null>(null);
  const STORAGE_KEY = "adminOrderFloatingStatusFab_pos_v1";

  useEffect(() => {
    setMounted(true);
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const p = JSON.parse(saved);
        if (typeof p.left === "number" && typeof p.top === "number") {
          const maxLeft = Math.max(10, window.innerWidth - 75);
          const maxTop = Math.max(10, window.innerHeight - 75);
          setPos({
            left: Math.min(Math.max(10, p.left), maxLeft),
            top: Math.min(Math.max(10, p.top), maxTop),
          });
        }
      } else {
        setPos({ left: 16, top: window.innerHeight - 150 });
      }
    } catch {}
  }, []);

  // منع الـ pull-to-refresh عند سحب الزر باللمس على الهواتف
  useEffect(() => {
    const el = nodeRef.current;
    if (!el) return;
    const preventTouch = (e: TouchEvent) => {
      if (e.cancelable) {
        try {
          e.preventDefault();
        } catch {}
      }
    };
    el.addEventListener("touchstart", preventTouch, { passive: false });
    el.addEventListener("touchmove", preventTouch, { passive: false });
    return () => {
      el.removeEventListener("touchstart", preventTouch);
      el.removeEventListener("touchmove", preventTouch);
    };
  }, [mounted]);

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {}
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      origLeft: pos.left,
      origTop: pos.top,
      moved: false,
    };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d) return;
    const dx = e.clientX - d.startX;
    const dy = e.clientY - d.startY;
    if (Math.hypot(dx, dy) > 10) {
      d.moved = true;
    }
    if (!d.moved) return;
    const maxLeft = Math.max(10, window.innerWidth - 70);
    const maxTop = Math.max(10, window.innerHeight - 70);
    const nextLeft = Math.min(Math.max(10, d.origLeft + dx), maxLeft);
    const nextTop = Math.min(Math.max(10, d.origTop + dy), maxTop);
    setPos({ left: nextLeft, top: nextTop });
  };

  const onPointerUp = (e: React.PointerEvent) => {
    const d = dragRef.current;
    dragRef.current = null;
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {}
    if (d?.moved) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(pos));
      } catch {}
    } else {
      onClick();
    }
  };

  if (!mounted || typeof document === "undefined") return null;

  const isPickedUp = mode === "pickedUp";

  return createPortal(
    <div
      ref={nodeRef}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      style={{
        position: "fixed",
        left: pos.left,
        top: pos.top,
        zIndex: 1250,
        touchAction: "none",
        userSelect: "none",
      }}
      className="cursor-grab active:cursor-grabbing select-none"
    >
      <button
        type="button"
        className={`flex size-14 sm:size-16 items-center justify-center rounded-full shadow-2xl transition-transform active:scale-90 font-black border-2 ${
          isPickedUp
            ? "bg-amber-400 hover:bg-amber-500 border-amber-700 text-amber-950 text-xs sm:text-sm animate-pulse"
            : "bg-red-600 hover:bg-red-700 border-red-900 text-white text-xs sm:text-sm animate-pulse"
        }`}
        title={isPickedUp ? "استلام الطلب ⚡" : "تسليم الطلب 🫴"}
      >
        <span className="leading-tight text-center whitespace-pre-line drop-shadow-sm font-black">
          {isPickedUp ? "استلام" : "تسليم"}
        </span>
      </button>
    </div>,
    document.body
  );
}

