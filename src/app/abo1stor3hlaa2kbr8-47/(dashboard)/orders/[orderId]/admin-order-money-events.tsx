"use client";

import { useActionState, useEffect, useMemo, useState, useRef } from "react";
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
  moneySaderAmountInputClass,
  moneySaderRemainValueClass,
  moneySaderSummaryBoxClass,
  moneySaderTotalValueClass,
  moneyWardAmountInputClass,
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
    getGlobalIcons()
      .then(setIcons)
      .catch(() => null);
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
    <div className="relative overflow-hidden rounded-[24px] border-2 border-[#C9A86A] bg-[#FFFEFB] shadow-[0_15px_45px_rgba(0,0,0,0.35),0_0_0_1px_rgba(201,168,106,0.3),inset_0_1px_0_rgba(255,255,255,0.8)] text-slate-900 select-none" dir="rtl">
      
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

      {/* --- الزر الدائري العائم القابل للسحب والتحريك --- */}
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

      {/* رأس الكارت الملكي الزمردي المذهب */}
      <div className="relative bg-[#0A3D2E] border-b-[2px] border-[#C9A86A] px-3.5 sm:px-4 py-[14px] flex items-center justify-between overflow-hidden">
        <div className="absolute inset-0 opacity-[0.08] pointer-events-none emerald-pattern" />
        <div className="absolute inset-0 opacity-30 pointer-events-none" style={{ background: "radial-gradient(ellipse at 80% 50%, rgba(201,168,106,0.18) 0%, transparent 60%)" }} />

        <div className="relative flex items-center gap-2.5">
          <div className="w-[30px] h-[30px] sm:w-[34px] sm:h-[34px] rounded-[10px] gold-grad flex items-center justify-center shadow-[0_2px_8px_rgba(201,168,106,0.35),inset_0_1px_0_rgba(255,255,255,0.6)] border border-[#9C7D46]/30 shrink-0">
            <span className="text-base sm:text-lg">💳</span>
          </div>
          <div>
            <h3 className="text-[14px] sm:text-[16px] font-black leading-none tracking-wide text-[#E8C77E]">
              المعاملات المالية <span className="text-[11px] sm:text-xs font-bold text-[#E8C77E]/70">(الصادر والوارد)</span>
            </h3>
          </div>
        </div>

        <div className="relative flex items-center gap-1.5 px-3 py-[6px] rounded-full bg-[#122F26] border border-[#C9A86A]/40 shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_2px_8px_rgba(0,0,0,0.2)]">
          <span className="text-xs">📜</span>
          <span className="text-[11px] font-bold text-[#E8C77E] tracking-wide">
            {assignedCourierId ? courierName || "المندوب" : "حساب الإدارة"}
          </span>
          <div className="w-[5px] h-[5px] rounded-full bg-[#E8C77E] shadow-[0_0_6px_#E8C77E] animate-pulse" />
        </div>
      </div>

      {/* فاصل زخرفي إسلامي */}
      <div className="relative bg-[#FDF6E3]/50 px-3 py-[8px] flex items-center justify-center gap-2 border-b border-[#C9A86A]/15">
        <div className="h-[1px] flex-1 bg-gradient-to-l from-[#C9A86A]/50 to-transparent" />
        <div className="w-[18px] h-[18px] relative flex items-center justify-center">
          <div className="absolute w-[18px] h-[18px] rotate-45 border border-[#C9A86A]/60 bg-[#FFFEFB] shadow-[0_1px_4px_rgba(201,168,106,0.2)]" />
          <div className="w-[7px] h-[7px] rotate-45 bg-[#C9A86A]" />
        </div>
        <div className="h-[1px] flex-1 bg-gradient-to-r from-[#C9A86A]/50 to-transparent" />
      </div>

      <div className="relative p-3 sm:p-4 bg-gradient-to-b from-[#FFFEFB] to-[#FDF6E3]/40 space-y-3.5">

      {/* --- أزرار أعطيت وأخذت لتسجيل المبالغ والصادر والوارد --- */}
      {orderId && (
        <div className="relative z-10 space-y-3 my-2">
          {isDelivered && (
            <div className="w-full flex items-center justify-center gap-2 rounded-2xl border-2 border-[#C9A86A] bg-gradient-to-r from-[#0F4D3A] to-[#1B4D3E] p-3 text-[#F5D77F] font-black text-sm sm:text-base shadow-xl">
              <span className="text-xl">🎉</span>
              <span>تم تسليم هذا الطلب بنجاح ✅</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
            {/* زر أعطيت للعميل (تسجيل صادر) */}
            <div className="flex flex-col gap-1.5">
              <button
                type="button"
                onClick={() => {
                  setPickupAdvanceToDelivering(false);
                  setPickupOpen(true);
                  setDeliveryOpen(false);
                }}
                className="group relative h-[88px] rounded-[18px] bg-[#103D2A] border-[1.5px] border-[#C9A86A]/70 overflow-hidden shadow-[0_6px_18px_rgba(10,61,46,0.25),inset_0_1px_0_rgba(232,199,126,0.15)] active:scale-[0.98] transition-all text-right w-full cursor-pointer"
                title="تسجيل صادر: أعطيت للعميل"
              >
                <div className="absolute inset-0 opacity-[0.06] emerald-pattern pointer-events-none" />
                <div className="absolute inset-0 opacity-40 pointer-events-none" style={{ background: "radial-gradient(ellipse at 85% 20%, rgba(201,168,106,0.18) 0%, transparent 55%)" }} />
                <div className="absolute top-[6px] right-[6px] w-[28px] h-[1px] bg-gradient-to-l from-[#E8C77E]/50 to-transparent" />
                
                <div className="relative h-full flex items-center gap-2.5 px-3">
                  <div className="relative w-[44px] h-[44px] rounded-full p-[2px] gold-grad shadow-[0_3px_10px_rgba(201,168,106,0.4)] shrink-0">
                    <div className="w-full h-full rounded-full bg-[#0A3D2E] flex items-center justify-center border border-[#0A3D2E] relative overflow-hidden">
                      <span className="relative text-[13px] font-black text-[#E8C77E] leading-none">مـا</span>
                    </div>
                  </div>
                  <div className="flex-1 min-w-0 text-right">
                    <div className="text-[13px] sm:text-[14px] font-black text-[#E8C77E] leading-tight">أعطيت للعميل</div>
                    <div className="mt-[3px] inline-flex items-center gap-1 px-2 py-[2px] rounded-full bg-[#0A3D2E]/60 border border-[#C9A86A]/20">
                      <span className="text-[10px] font-bold text-[#E8C77E]/80">تسجيل صادر</span>
                      <span className="text-[11px]">💸</span>
                    </div>
                  </div>
                  <div className="w-[22px] h-[22px] rounded-full bg-[#E8C77E]/10 border border-[#E8C77E]/20 flex items-center justify-center shrink-0">
                    <span className="text-[#E8C77E] text-xs font-bold">‹</span>
                  </div>
                </div>
              </button>
              {pickupRemaining !== null && (
                <span className="text-[11px] font-bold bg-[#0A3D2E]/90 text-[#E8C77E] border border-[#C9A86A]/40 px-2.5 py-0.5 rounded-lg shadow-sm text-center">
                  المتبقي للصادر: {formatDinarAsAlfWithUnit(Math.max(0, pickupRemaining))}
                </span>
              )}
            </div>

            {/* زر أخذت من الزبون (تسجيل وارد) */}
            <div className="flex flex-col gap-1.5">
              <button
                type="button"
                onClick={() => {
                  setDeliveryAdvanceToDelivered(false);
                  setDeliveryOpen(true);
                  setPickupOpen(false);
                }}
                className="group relative h-[88px] rounded-[18px] bg-[#0F2F26] border-[1.5px] border-[#C9A86A]/60 overflow-hidden shadow-[0_6px_18px_rgba(10,61,46,0.22),inset_0_1px_0_rgba(232,199,126,0.12)] active:scale-[0.98] transition-all text-right w-full cursor-pointer"
                title="تسجيل وارد: أخذت من الزبون"
              >
                <div className="absolute inset-0 opacity-[0.05] emerald-pattern pointer-events-none" />
                <div className="absolute inset-0 opacity-30 pointer-events-none" style={{ background: "radial-gradient(ellipse at 15% 85%, rgba(17,87,64,0.4) 0%, transparent 60%)" }} />
                
                <div className="relative h-full flex items-center gap-2.5 px-3">
                  <div className="relative w-[44px] h-[44px] rounded-full p-[2px] bg-gradient-to-br from-[#D9BF7F] to-[#A8864A] shadow-[0_3px_10px_rgba(201,168,106,0.35)] shrink-0">
                    <div className="w-full h-full rounded-full bg-[#122E24] flex items-center justify-center relative overflow-hidden">
                      <span className="relative text-[11px] font-black text-[#E8C77E]">شـاء</span>
                    </div>
                  </div>
                  <div className="flex-1 min-w-0 text-right">
                    <div className="text-[13px] sm:text-[14px] font-black text-[#E8C77E] leading-tight">أخذت من الزبون</div>
                    <div className="mt-[3px] inline-flex items-center gap-1 px-2 py-[2px] rounded-full bg-[#0A3D2E]/50 border border-[#C9A86A]/20">
                      <span className="text-[10px] font-bold text-[#E8C77E]/80">تسجيل وارد</span>
                      <span className="text-[11px]">🫴</span>
                    </div>
                  </div>
                  <div className="w-[22px] h-[22px] rounded-full bg-[#E8C77E]/10 border border-[#E8C77E]/20 flex items-center justify-center shrink-0">
                    <span className="text-[#E8C77E] text-xs font-bold">‹</span>
                  </div>
                </div>
              </button>
              {deliveryRemaining !== null && !prepaidAll && (
                <span className="text-[11px] font-bold bg-[#122F26]/90 text-[#E8C77E] border border-[#C9A86A]/40 px-2.5 py-0.5 rounded-lg shadow-sm text-center">
                  المتبقي للوارد: {formatDinarAsAlfWithUnit(Math.max(0, deliveryRemaining))}
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* --- مودال تسجيل الصادر (أعطيت / استلام) --- */}
      {pickupOpen && orderId && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md overflow-y-auto animate-in fade-in duration-200">
          <div className="w-full max-w-lg rounded-3xl border-2 border-[#C9A86A] bg-gradient-to-br from-[#0A3D2E] via-[#06281D] to-[#0A3D2E] p-5 sm:p-6 shadow-2xl ring-1 ring-[#F5D77F]/30 animate-in zoom-in-95 duration-200 text-right relative overflow-hidden">
            <div className="absolute inset-0 bg-[radial-gradient(#C9A86A_1px,transparent_1px)] [background-size:16px_16px] opacity-10 pointer-events-none" />
            <div className="relative z-10 mb-4 flex items-center justify-between border-b border-[#C9A86A]/30 pb-3">
              <div>
                <h4 className="text-base sm:text-lg font-black text-[#F5D77F] flex items-center gap-2">
                  <span>💸</span>
                  <span>
                    {pickupAdvanceToDelivering ? "⚡ استلام الطلب وتغيير الحالة" : "تسجيل صادر (أعطيت للعميل)"}
                  </span>
                </h4>
                <p className="text-xs font-bold text-emerald-200">
                  الطلب #{orderNumber} — {assignedCourierId ? `بالنيابة عن: ${courierName || "المندوب"}` : "تسجيل للإدارة"}
                </p>
              </div>
              <button
                type="button"
                onClick={closePanels}
                className="h-9 w-9 rounded-xl border border-[#C9A86A] bg-[#0F4D3A] text-lg font-bold text-[#F5D77F] hover:bg-[#164E3D] transition-colors cursor-pointer flex items-center justify-center"
              >
                ✕
              </button>
            </div>

            <div className="relative z-10">
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
        </div>
      )}

      {/* --- مودال تسجيل الوارد (أخذت / تسليم) --- */}
      {deliveryOpen && orderId && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md overflow-y-auto animate-in fade-in duration-200">
          <div className="w-full max-w-lg rounded-3xl border-2 border-[#C9A86A] bg-gradient-to-br from-[#0A3D2E] via-[#06281D] to-[#0A3D2E] p-5 sm:p-6 shadow-2xl ring-1 ring-[#F5D77F]/30 animate-in zoom-in-95 duration-200 text-right relative overflow-hidden">
            <div className="absolute inset-0 bg-[radial-gradient(#C9A86A_1px,transparent_1px)] [background-size:16px_16px] opacity-10 pointer-events-none" />
            <div className="relative z-10 mb-4 flex items-center justify-between border-b border-[#C9A86A]/30 pb-3">
              <div>
                <h4 className="text-base sm:text-lg font-black text-[#F5D77F] flex items-center gap-2">
                  <span>🫴</span>
                  <span>
                    {deliveryAdvanceToDelivered ? "🎉 تسليم الطلب واحتساب الأرباح" : "تسجيل وارد (أخذت من الزبون)"}
                  </span>
                </h4>
                <p className="text-xs font-bold text-emerald-200">
                  الطلب #{orderNumber} — {assignedCourierId ? `بالنيابة عن: ${courierName || "المندوب"}` : "تسجيل للإدارة"}
                </p>
              </div>
              <button
                type="button"
                onClick={closePanels}
                className="h-9 w-9 rounded-xl border border-[#C9A86A] bg-[#0F4D3A] text-lg font-bold text-[#F5D77F] hover:bg-[#164E3D] transition-colors cursor-pointer flex items-center justify-center"
              >
                ✕
              </button>
            </div>

            <div className="relative z-10">
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
                className={`relative overflow-hidden rounded-[20px] border-[1.5px] p-3.5 text-sm transition-all shadow-[0_8px_24px_rgba(10,61,46,0.3),inset_0_1px_0_rgba(232,199,126,0.12)] ${
                  deleted
                    ? "border-slate-700 bg-[#06281D]/40 text-slate-400 line-through"
                    : ev.kind === MONEY_KIND_PICKUP
                      ? "border-[#C9A86A]/40 bg-[#0E3B2A] text-white"
                      : "border-[#C9A86A]/40 bg-[#122E24] text-white"
                }`}
              >
                <div className="absolute inset-0 opacity-[0.07] pointer-events-none emerald-pattern" />
                <div className="absolute top-0 right-0 w-[120px] h-[1px] bg-gradient-to-l from-[#E8C77E]/40 to-transparent pointer-events-none" />

                <div className="relative space-y-3 z-10">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1 space-y-2 leading-relaxed text-right">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-[36px] h-[36px] rounded-full p-[1.5px] gold-grad shadow-[0_2px_8px_rgba(201,168,106,0.35)] shrink-0">
                            <div className="w-full h-full rounded-full bg-[#081F18] flex items-center justify-center border border-[#0A3D2E] relative overflow-hidden">
                              <span className="relative text-[10px] font-black text-[#E8C77E] tracking-widest">
                                {ev.kind === MONEY_KIND_PICKUP ? "صادر" : "وارد"}
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-[11px] font-bold text-[#C9A86A]/90">
                              {ev.kind === MONEY_KIND_PICKUP ? "صادر بواسطة:" : "وارد بواسطة:"}
                            </span>
                            <span className="text-[13px] font-black text-white tracking-wide">
                              {isRecordedByAdmin ? "🏢 الإدارة" : ev.performedByDisplayName || "المندوب"}
                            </span>
                          </div>
                        </div>

                        <div className="shrink-0 px-2.5 py-[4px] rounded-full bg-[#1A2F26] border border-[#C9A86A]/30 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] flex items-center gap-1">
                          <div className="w-1.5 h-1.5 rounded-full bg-[#E8C77E] shadow-[0_0_4px_#E8C77E]" />
                          <span className="text-[10.5px] font-bold text-[#E8C77E]/90 tracking-[0.02em] dir-ltr">
                            {timeInfo.dateStr} {timeInfo.timeStr}
                          </span>
                        </div>
                      </div>

                      <div className="pr-[46px] flex flex-wrap items-baseline gap-3">
                        <span className="font-bold text-emerald-100 text-xs">
                          المسجّل:{" "}
                          <span className="font-mono font-black tabular-nums text-[#E8C77E] text-base">
                            {formatDinarAsAlfWithUnit(ev.amountDinar)}
                          </span>
                        </span>
                        {ev.expectedDinar != null && (
                          <span className="font-bold text-[#C9A86A]/80 text-xs">
                            المتوقع:{" "}
                            <span className="font-mono font-bold tabular-nums text-white">
                              {formatDinarAsAlfWithUnit(ev.expectedDinar)}
                            </span>
                          </span>
                        )}
                      </div>

                      {noteLine !== "—" && (
                        <p className="pr-[46px] text-xs font-bold text-[#E8C77E]/90">
                          <span className="text-[#E8C77E]/60">ملاحظة: </span>
                          <span className="whitespace-pre-wrap break-words">{noteLine}</span>
                        </p>
                      )}

                      {ev.recordedByCompanyPreparerId ? (
                        <p className="pr-[46px] text-xs font-black text-amber-300">
                          📦 سُجّلت من لوحة المجهز
                        </p>
                      ) : null}

                      {deleted ? (
                        <p className="pr-[46px] text-xs font-bold text-rose-300">
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
                          className="inline-flex min-h-[34px] items-center justify-center gap-1 rounded-xl border border-rose-400/40 bg-rose-950/80 hover:bg-rose-900 px-3 py-1 text-xs font-black text-rose-200 shadow-sm transition-colors cursor-pointer"
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
                  <div className="border-t border-[#C9A86A]/30 pt-2.5">
                    <form action={hardAction} className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end">
                      <input type="hidden" name="eventId" value={ev.id} />
                      <input type="hidden" name="nextPath" value={nextPath} />
                      <label className="flex min-w-0 flex-1 flex-col gap-1 text-xs font-bold text-emerald-200 text-right">
                        <span>حذف نهائي (اكتب: <code className="rounded bg-rose-950 px-1.5 text-rose-200 border border-rose-500 font-mono">{ADMIN_MONEY_HARD_DELETE_CONFIRM_PHRASE}</code>):</span>
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
                          className="rounded-xl border border-[#C9A86A]/50 bg-[#06281D] px-2.5 py-1.5 text-xs text-white focus:border-rose-500 focus:outline-hidden"
                          placeholder={ADMIN_MONEY_HARD_DELETE_CONFIRM_PHRASE}
                        />
                      </label>
                      <button
                        type="submit"
                        disabled={hardPending || !canSubmitHard}
                        className="inline-flex min-h-[36px] items-center justify-center rounded-xl bg-rose-800 border border-rose-500 px-3.5 py-1.5 text-xs font-black text-white shadow-md hover:bg-rose-900 transition-colors disabled:opacity-40 cursor-pointer"
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
  const advanceStatusRef = useRef<HTMLInputElement>(null);
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
        <input ref={advanceStatusRef} type="hidden" name="advanceStatus" value={advanceStatus} />

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
                  if (advanceStatusRef.current) advanceStatusRef.current.value = "delivering";
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
            onChange={(e) => {
              const val = e.target.checked ? "delivering" : "";
              setAdvanceStatus(val);
              if (advanceStatusRef.current) advanceStatusRef.current.value = val;
            }}
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
            name="mandoubMoneySubmitMode"
            value="statusOnlyNoAmount"
            formNoValidate
            disabled={pending}
            onClick={() => {
              if (amountRef.current) amountRef.current.value = "";
              setAmount("");
              if (submitModeRef.current) submitModeRef.current.value = "statusOnlyNoAmount";
              if (advanceStatusRef.current) advanceStatusRef.current.value = "delivering";
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
  const advanceStatusRef = useRef<HTMLInputElement>(null);
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
        <input ref={advanceStatusRef} type="hidden" name="advanceStatus" value={advanceStatus} />

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
                  if (advanceStatusRef.current) advanceStatusRef.current.value = "delivered";
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
            onChange={(e) => {
              const val = e.target.checked ? "delivered" : "";
              setAdvanceStatus(val);
              if (advanceStatusRef.current) advanceStatusRef.current.value = val;
            }}
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
            name="mandoubMoneySubmitMode"
            value="statusOnlyNoAmount"
            formNoValidate
            disabled={pending}
            onClick={() => {
              if (amountRef.current) amountRef.current.value = "";
              setAmount("");
              if (submitModeRef.current) submitModeRef.current.value = "statusOnlyNoAmount";
              if (advanceStatusRef.current) advanceStatusRef.current.value = "delivered";
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

/** مكون الزر العائم الدائري القابل للسحب والتحريك للإدارة */
function AdminFloatingStatusFab({
  mode,
  onClick,
}: {
  mode: "pickedUp" | "delivered";
  onClick: () => void;
}) {
  const [mounted, setMounted] = useState(false);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef<{ startX: number; startY: number; initialX: number; initialY: number }>({
    startX: 0,
    startY: 0,
    initialX: 0,
    initialY: 0,
  });
  const movedRef = useRef(false);
  const STORAGE_KEY = "adminOrderFloatingStatusFab_pos_v2";

  useEffect(() => {
    setMounted(true);
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const p = JSON.parse(saved);
        if (typeof p.x === "number" && typeof p.y === "number") {
          const maxLeft = Math.max(10, window.innerWidth - 75);
          const maxTop = Math.max(10, window.innerHeight - 75);
          setPos({
            x: Math.min(Math.max(10, p.x), maxLeft),
            y: Math.min(Math.max(10, p.y), maxTop),
          });
          return;
        }
      }
    } catch {}
    const defaultX = 16;
    const defaultY = Math.max(80, window.innerHeight - 150);
    setPos({ x: defaultX, y: defaultY });
  }, []);

  const handleTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    if (!touch || !pos) return;
    isDraggingRef.current = true;
    movedRef.current = false;
    dragStartRef.current = {
      startX: touch.clientX,
      startY: touch.clientY,
      initialX: pos.x,
      initialY: pos.y,
    };
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDraggingRef.current || !pos) return;
    const touch = e.touches[0];
    if (!touch) return;
    const deltaX = touch.clientX - dragStartRef.current.startX;
    const deltaY = touch.clientY - dragStartRef.current.startY;

    if (Math.abs(deltaX) > 6 || Math.abs(deltaY) > 6) {
      movedRef.current = true;
    }

    const maxLeft = Math.max(10, window.innerWidth - 75);
    const maxTop = Math.max(10, window.innerHeight - 75);
    const newX = Math.min(Math.max(10, dragStartRef.current.initialX + deltaX), maxLeft);
    const newY = Math.min(Math.max(10, dragStartRef.current.initialY + deltaY), maxTop);
    setPos({ x: newX, y: newY });
  };

  const handleTouchEnd = () => {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;
    if (movedRef.current && pos) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(pos));
      } catch {}
    } else {
      onClick();
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!pos) return;
    isDraggingRef.current = true;
    movedRef.current = false;
    dragStartRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      initialX: pos.x,
      initialY: pos.y,
    };
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDraggingRef.current || !pos) return;
      const deltaX = e.clientX - dragStartRef.current.startX;
      const deltaY = e.clientY - dragStartRef.current.startY;

      if (Math.abs(deltaX) > 6 || Math.abs(deltaY) > 6) {
        movedRef.current = true;
      }

      const maxLeft = Math.max(10, window.innerWidth - 75);
      const maxTop = Math.max(10, window.innerHeight - 75);
      const newX = Math.min(Math.max(10, dragStartRef.current.initialX + deltaX), maxLeft);
      const newY = Math.min(Math.max(10, dragStartRef.current.initialY + deltaY), maxTop);
      setPos({ x: newX, y: newY });
    };

    const handleMouseUp = () => {
      if (!isDraggingRef.current) return;
      isDraggingRef.current = false;
      if (movedRef.current && pos) {
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(pos));
        } catch {}
      } else {
        onClick();
      }
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [pos, onClick]);

  if (!mounted || !pos) return null;

  const isPickedUp = mode === "pickedUp";

  return (
    <div
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onMouseDown={handleMouseDown}
      style={{
        position: "fixed",
        left: `${pos.x}px`,
        top: `${pos.y}px`,
        zIndex: 1250,
        touchAction: "none",
      }}
      className="cursor-grab active:cursor-grabbing select-none"
    >
      <button
        type="button"
        className={`relative flex size-14 sm:size-16 items-center justify-center rounded-full shadow-2xl transition-transform active:scale-90 font-black border-2 border-[#C9A86A] overflow-hidden ${
          isPickedUp
            ? "bg-gradient-to-br from-[#F5D77F] to-[#C9A86A] text-[#06281D] shadow-[#F5D77F]/30 animate-pulse"
            : "bg-gradient-to-br from-[#991B1B] to-[#7F1D1D] text-[#F5D77F] shadow-[#991B1B]/40 animate-pulse"
        }`}
        title={isPickedUp ? "استلام الطلب ⚡" : "تسليم الطلب 🫴"}
      >
        <span className="leading-tight text-center whitespace-pre-line drop-shadow-md font-black text-xs sm:text-sm">
          {isPickedUp ? "استلام ⚡" : "تسليم 🫴"}
        </span>
      </button>
    </div>
  );
}

