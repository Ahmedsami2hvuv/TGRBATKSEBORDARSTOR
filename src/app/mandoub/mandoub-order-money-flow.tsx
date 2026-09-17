"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  submitMandoubDeliveryMoney,
  submitMandoubPickupMoney,
  softDeleteMandoubMoneyEvent,
} from "./cash-actions";
import { MandoubCashState } from "./types";
import {
  dinarDecimalToAlfInputString,
  formatDinarAsAlfWithUnit,
  parseAlfInputToDinarDecimalRequired,
} from "@/lib/money-alf";
import { MONEY_KIND_DELIVERY, MONEY_KIND_PICKUP } from "@/lib/mandoub-money-events";
import { formatBaghdadMoneyRecordedAt } from "@/lib/baghdad-time";

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
  recordedAt: Date | string;
  deletedAt: Date | string | null;
  deletedReason: "manual_admin" | "manual_courier" | "manual_preparer" | "status_revert" | null;
  deletedByDisplayName: string | null;
  performedByDisplayName: string;
  recordedByCompanyPreparerId: string | null;
};

function formatRecordedAtClient(d: Date | string): string {
  return formatBaghdadMoneyRecordedAt(d).fullStr;
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
  totalsBaseline,
  prepaidAll = false,
  designerConfig,
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
  totalsBaseline?: string | null;
  prepaidAll?: boolean;
  designerConfig?: any;
}) {
  const [pickupOpen, setPickupOpen] = useState(false);
  const [deliveryOpen, setDeliveryOpen] = useState(false);
  const [deliverySession, setDeliverySession] = useState(0);
  const [pickupAdvanceToDelivering, setPickupAdvanceToDelivering] = useState(false);
  const [deliveryAdvanceToDelivered, setDeliveryAdvanceToDelivered] = useState(false);

  const router = useRouter();

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

  const [toastMsg, setToastMsg] = useState<{ text: string; type: "success" | "error" } | null>(null);

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
      setToastMsg({ text: "تم استلام الطلب وتسجيل الصادر بنجاح! ⚡", type: "success" });
      closePanels();
      router.refresh();
      setTimeout(() => setToastMsg(null), 4000);
    }
  }, [pickupState, router]);

  useEffect(() => {
    if (deliveryState.error) {
      setToastMsg({ text: deliveryState.error, type: "error" });
    } else if (deliveryState.success) {
      setToastMsg({ text: "تم تسليم الطلب واحتساب أرباح التوصيل بنجاح! 🎉", type: "success" });
      closePanels();
      router.refresh();
      setTimeout(() => setToastMsg(null), 4000);
    }
  }, [deliveryState, router]);

  useEffect(() => {
    if (deleteState.ok) {
      setToastMsg({ text: "تم مسح الحركة بنجاح.", type: "success" });
      router.refresh();
      setTimeout(() => setToastMsg(null), 4000);
    } else if (deleteState.error) {
      setToastMsg({ text: deleteState.error, type: "error" });
    }
  }, [deleteState, router]);

  // الاستماع لحدث النقر من الزر العائم للاستلام والتسليم
  useEffect(() => {
    const handlePickupEvent = (e: any) => {
      if (!orderId || (e.detail?.orderId && e.detail.orderId !== orderId)) return;
      setPickupAdvanceToDelivering(true);
      setPickupOpen(true);
      setDeliveryOpen(false);
    };
    const handleDeliveryEvent = (e: any) => {
      if (!orderId || (e.detail?.orderId && e.detail.orderId !== orderId)) return;
      setDeliveryAdvanceToDelivered(true);
      setDeliveryOpen(true);
      setPickupOpen(false);
    };

    window.addEventListener("OPEN_MANDOUB_PICKUP_MODAL", handlePickupEvent);
    window.addEventListener("OPEN_MANDOUB_DELIVERY_MODAL", handleDeliveryEvent);
    return () => {
      window.removeEventListener("OPEN_MANDOUB_PICKUP_MODAL", handlePickupEvent);
      window.removeEventListener("OPEN_MANDOUB_DELIVERY_MODAL", handleDeliveryEvent);
    };
  }, [orderId]);

  const activeEvents = useMemo(
    () => moneyEvents.filter((e) => e.deletedAt == null),
    [moneyEvents],
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

  return (
    <div className="w-full max-w-4xl mx-auto my-0 select-none" dir="rtl">
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

      {/* كارت المعاملات المالية المتطابق 100% مع واجهة الإدارة والتصميم الملكي الفاخر */}
      <div className="relative rounded-[22px] border-[1.5px] border-[#C9A86A] bg-[#FFFEFB] shadow-[0_6px_20px_rgba(201,168,106,0.12)] overflow-hidden">
        {/* هيدر الكارت المذهب */}
        <div className="relative px-3.5 py-3 bg-gradient-to-b from-[#FDF6E3] to-[#FFFEFB] border-b border-[#C9A86A]/20 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-[30px] h-[30px] rounded-[10px] gold-grad flex items-center justify-center shadow-[0_2px_8px_rgba(201,168,106,0.35)] border border-[#9C7D46]/30">
              <svg className="w-[16px] h-[16px] text-[#0A3D2E]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <circle cx="9" cy="12" r="6" />
                <circle cx="15" cy="12" r="6" />
              </svg>
            </div>
            <h3 className="text-[13.5px] font-black text-[#0A3D2E] leading-none tracking-wide">المعاملات المالية</h3>
          </div>

          <div className="w-[8px] h-[8px] rounded-full bg-[#C9A86A] shadow-[0_0_6px_#C9A86A] animate-pulse" />
        </div>

        <div className="relative p-3.5 bg-[#FFFEF8] space-y-3.5">
          {/* زري استلام وتسليم (أعطيت وأخذت) الفاخرين بالصور الملكية */}
          {orderId && (
            <div className="flex items-center justify-center gap-4 py-1">
              {/* زر استلام (صادر / أعطيت) */}
              <button
                type="button"
                onClick={() => {
                  setPickupAdvanceToDelivering(true);
                  setPickupOpen(true);
                  setDeliveryOpen(false);
                }}
                className="group relative flex-1 max-w-[200px] h-[58px] sm:h-[64px] rounded-[16px] flex items-center justify-center active:scale-95 transition-all cursor-pointer overflow-hidden shadow-[0_4px_15px_rgba(10,61,46,0.2)] hover:shadow-[0_6px_20px_rgba(10,61,46,0.35)]"
                title="استلام الطلب وتسجيل الصادر (أعطيت للمحل)"
              >
                <img
                  src="/images/order-luxury/btn-istilam.webp"
                  alt="استلام (أعطيت)"
                  className="w-full h-full object-contain pointer-events-none drop-shadow-md group-hover:scale-105 transition duration-300"
                />
              </button>

              {/* زر تسليم (وارد / أخذت) */}
              <button
                type="button"
                onClick={() => {
                  setDeliveryAdvanceToDelivered(true);
                  setDeliveryOpen(true);
                  setPickupOpen(false);
                }}
                className="group relative flex-1 max-w-[200px] h-[58px] sm:h-[64px] rounded-[16px] flex items-center justify-center active:scale-95 transition-all cursor-pointer overflow-hidden shadow-[0_4px_15px_rgba(197,48,48,0.2)] hover:shadow-[0_6px_20px_rgba(197,48,48,0.35)]"
                title="تسليم الطلب وتسجيل الوارد (أخذت من الزبون)"
              >
                <img
                  src="/images/order-luxury/btn-tasleem.webp"
                  alt="تسليم (أخذت)"
                  className="w-full h-full object-contain pointer-events-none drop-shadow-md group-hover:scale-105 transition duration-300"
                />
              </button>
            </div>
          )}

          {/* فاصل ذهبي ناعم */}
          <div className="flex items-center gap-2 py-0.5">
            <div className="h-[1px] flex-1 bg-gradient-to-l from-[#C9A86A]/40 to-transparent" />
            <div className="w-[6px] h-[6px] rotate-45 bg-[#C9A86A]/60" />
            <div className="h-[1px] flex-1 bg-gradient-to-r from-[#C9A86A]/40 to-transparent" />
          </div>

          {/* قائمة المعاملات */}
          {moneyEvents.length === 0 ? (
            <p className="text-center text-[#8B6A2A]/70 py-4 bg-[#FDF6E3]/60 rounded-xl border border-[#C9A86A]/25 text-xs font-bold">
              لا توجد معاملات نقد مسجّلة لهذا الطلب بعد.
            </p>
          ) : (
            <div className="space-y-2.5">
              {moneyEvents.map((ev) => {
                const isSader = ev.kind === MONEY_KIND_PICKUP;
                const timeInfo = formatBaghdadMoneyRecordedAt(ev.recordedAt);
                const noteText = [ev.mismatchReason, ev.mismatchNote].filter(Boolean).join(" - ");
                const deleted = ev.deletedAt != null;
                const recordedByPreparer = ev.recordedByCompanyPreparerId != null;
                const canDeleteFromMandoubUi = !recordedByPreparer && !deleted;

                return (
                  <div
                    key={ev.id}
                    className={`relative rounded-[14px] bg-[#FFFEF8] border-[1.5px] border-[#C9A86A]/40 shadow-[0_2px_8px_rgba(201,168,106,0.08),inset_0_1px_0_white] p-2.5 overflow-hidden ${
                      deleted ? "opacity-50 grayscale" : ""
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        {/* أيقونة الاتجاه */}
                        <div
                          className={`w-[28px] h-[28px] rounded-full flex items-center justify-center border shrink-0 ${
                            isSader ? "bg-[#E6F4EF] border-[#0A3D2E]/20" : "bg-[#FFF0F0] border-[#FFB4B4]/60"
                          }`}
                        >
                          {isSader ? (
                            <svg className="w-3.5 h-3.5 text-[#0A3D2E]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                              <line x1="7" y1="17" x2="17" y2="7" />
                              <polyline points="7 7 17 7 17 17" />
                            </svg>
                          ) : (
                            <svg className="w-3.5 h-3.5 text-[#C53030]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                              <line x1="7" y1="7" x2="17" y2="17" />
                              <polyline points="17 7 17 17 7 17" />
                            </svg>
                          )}
                        </div>

                        {/* تفاصيل الحركة */}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span
                              className={`px-2 py-[2px] rounded-full text-[10px] font-black border ${
                                isSader
                                  ? "bg-[#E6F4EF] border-[#0A3D2E]/20 text-[#0A3D2E]"
                                  : "bg-[#FFF0F0] border-[#FFB4B4] text-[#C53030]"
                              }`}
                            >
                              {isSader ? "صادر" : "وارد"}
                            </span>

                            <span className="text-[11px] font-bold text-[#0A3D2E]">
                              {ev.performedByDisplayName?.trim() || courierName?.trim() || "المندوب"}
                            </span>

                            <span className="text-[9px] font-bold text-[#8B6A2A]/60 px-2 py-[2px] rounded-full bg-[#F7F5EF] border border-[#E8D5A3]/50">
                              {timeInfo.dateStr} {timeInfo.timeStr}
                            </span>

                            <span className="text-[11px] font-black text-[#0A3D2E] font-mono mr-auto">
                              {formatDinarAsAlfWithUnit(ev.amountDinar)}
                            </span>
                          </div>

                          {noteText && (
                            <div className="mt-1 text-[11px] font-bold text-[#3A2E1A] leading-[1.4] line-clamp-2">
                              {noteText}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* زر الحذف الوردي الصغير كما في الإدارة */}
                      {!deleted && canDeleteFromMandoubUi && (
                        <form action={deleteAction}>
                          <input type="hidden" name="c" value={auth.c} />
                          <input type="hidden" name="exp" value={auth.exp} />
                          <input type="hidden" name="s" value={auth.s} />
                          <input type="hidden" name="eventId" value={ev.id} />
                          <input type="hidden" name="next" value={nextUrl} />
                          <button
                            type="submit"
                            disabled={deletePending}
                            className="w-[26px] h-[26px] rounded-full bg-[#FFF0F0] border border-[#FF8A8A]/40 flex items-center justify-center shadow-[0_1px_4px_rgba(197,48,48,0.12)] active:scale-90 shrink-0 cursor-pointer hover:bg-rose-100 transition"
                            title="مسح المعاملة"
                            onClick={(e) => {
                              if (!confirm("هل أنت متأكد من مسح هذه المعاملة المالية؟")) {
                                e.preventDefault();
                              }
                            }}
                          >
                            <svg className="w-3 h-3 text-[#C53030]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                              <polyline points="3 6 5 6 21 6" />
                              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                            </svg>
                          </button>
                        </form>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* --- مودال تسجيل الصادر (أعطيت للمحل/العميل) الفاخر --- */}
      {pickupOpen && orderId && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-3 sm:p-4 bg-black/70 backdrop-blur-sm overflow-y-auto">
          <div className="w-full max-w-md rounded-[20px] border-[2px] border-[#C9A86A] bg-[#FFFEF8] p-5 shadow-2xl text-right relative overflow-hidden">
            <div className="flex items-center justify-between border-b border-[#C9A86A]/20 pb-3 mb-3">
              <h4 className="text-base font-black text-[#0A3D2E] flex items-center gap-1.5">
                <span>💸</span>
                <span>تسجيل صادر (أعطيت للمحل/العميل)</span>
              </h4>
              <button
                type="button"
                onClick={closePanels}
                className="w-7 h-7 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold flex items-center justify-center cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form action={pickupAction} className="space-y-3">
              <input type="hidden" name="c" value={auth.c} />
              <input type="hidden" name="exp" value={auth.exp} />
              <input type="hidden" name="s" value={auth.s} />
              <input type="hidden" name="orderId" value={orderId} />
              <input type="hidden" name="next" value={nextUrl} />
              <input type="hidden" name="advanceStatus" value={pickupAdvanceToDelivering || orderStatus === "assigned" || orderStatus === "pending" ? "delivering" : ""} />

              <div>
                <label className="text-xs font-bold text-[#0A3D2E] block mb-1">المبلغ (ألف دينار):</label>
                <input
                  type="text"
                  name="amountAlf"
                  defaultValue={orderSubtotalDinar ? dinarDecimalToAlfInputString(orderSubtotalDinar) : ""}
                  className="w-full h-11 rounded-xl border border-[#C9A86A] bg-white px-3 font-mono font-bold text-center text-lg text-[#0A3D2E] focus:outline-none focus:ring-2 focus:ring-[#0A3D2E]/20"
                  placeholder="مثال: 22"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-bold text-[#0A3D2E] block mb-1">ملاحظة (اختياري):</label>
                <textarea
                  name="mismatchNote"
                  rows={2}
                  className="w-full rounded-xl border border-[#C9A86A]/60 bg-white p-2 text-xs font-medium text-[#0A3D2E] focus:outline-none"
                  placeholder="أي ملاحظات إضافية على الصادر..."
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={closePanels}
                  className="px-4 py-2 rounded-xl bg-slate-100 text-xs font-bold text-slate-700 hover:bg-slate-200 cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={pickupPending}
                  className="px-5 py-2 rounded-xl gold-grad border border-[#9C7D46]/40 text-xs font-black text-[#0A3D2E] shadow-sm hover:scale-105 active:scale-95 transition cursor-pointer"
                >
                  {pickupPending ? "جاري الحفظ..." : "💾 تأكيد الصادر"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- مودال تسجيل الوارد (أخذت من الزبون) الفاخر --- */}
      {deliveryOpen && orderId && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-3 sm:p-4 bg-black/70 backdrop-blur-sm overflow-y-auto">
          <div className="w-full max-w-md rounded-[20px] border-[2px] border-[#C9A86A] bg-[#FFFEF8] p-5 shadow-2xl text-right relative overflow-hidden">
            <div className="flex items-center justify-between border-b border-[#C9A86A]/20 pb-3 mb-3">
              <h4 className="text-base font-black text-[#BF360C] flex items-center gap-1.5">
                <span>🫴</span>
                <span>تسجيل وارد (أخذت من الزبون)</span>
              </h4>
              <button
                type="button"
                onClick={closePanels}
                className="w-7 h-7 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold flex items-center justify-center cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form action={deliveryAction} className="space-y-3">
              <input type="hidden" name="c" value={auth.c} />
              <input type="hidden" name="exp" value={auth.exp} />
              <input type="hidden" name="s" value={auth.s} />
              <input type="hidden" name="orderId" value={orderId} />
              <input type="hidden" name="next" value={nextUrl} />
              <input type="hidden" name="advanceStatus" value={deliveryAdvanceToDelivered || orderStatus === "delivering" || orderStatus === "assigned" ? "delivered" : ""} />

              <div>
                <label className="text-xs font-bold text-[#0A3D2E] block mb-1">المبلغ (ألف دينار):</label>
                <input
                  type="text"
                  name="amountAlf"
                  defaultValue={totalAmountDinar ? dinarDecimalToAlfInputString(totalAmountDinar) : ""}
                  className="w-full h-11 rounded-xl border border-[#C9A86A] bg-white px-3 font-mono font-bold text-center text-lg text-[#BF360C] focus:outline-none focus:ring-2 focus:ring-[#BF360C]/20"
                  placeholder="مثال: 25"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-bold text-[#0A3D2E] block mb-1">ملاحظة (اختياري):</label>
                <textarea
                  name="mismatchNote"
                  rows={2}
                  className="w-full rounded-xl border border-[#C9A86A]/60 bg-white p-2 text-xs font-medium text-[#0A3D2E] focus:outline-none"
                  placeholder="أي ملاحظات إضافية على الوارد..."
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={closePanels}
                  className="px-4 py-2 rounded-xl bg-slate-100 text-xs font-bold text-slate-700 hover:bg-slate-200 cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={deliveryPending}
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-[#FF8A65] to-[#E65100] text-xs font-black text-white shadow-sm hover:scale-105 active:scale-95 transition cursor-pointer"
                >
                  {deliveryPending ? "جاري الحفظ..." : "💾 تأكيد الوارد"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
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
  noRedirect = false,
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
  noRedirect?: boolean;
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
    orderStatusMatchClient(orderSubtotalDinar, projectedTotal) === false &&
    (amount.trim() !== "" || (advanceToDelivering && pickupSumDinar > 0));

  function orderStatusMatchClient(expected: number | null, actual: number): boolean {
    if (expected == null) return true;
    return Math.abs(expected - actual) < 0.01;
  }

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
    <div className="space-y-3 select-none">
      <p className="font-black text-xs sm:text-sm text-[#F5D77F] drop-shadow-sm flex items-center gap-1.5">
        <span>💸</span> اكتب المبلغ الذي سلّمته للعميل (صادر)
      </p>
      {!advanceToDelivering ? (
        <p className="text-[11px] font-bold text-emerald-200/90">
          تسجيل صادر فقط — دون تغيير حالة الطلب.
        </p>
      ) : null}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border-2 border-[#C9A86A] bg-gradient-to-r from-[#06281D] via-[#0A3D2E] to-[#06281D] p-3 text-xs shadow-lg text-[#FFF8F0]">
        <span className="min-w-0 flex-1 sm:flex-none font-bold">
          سعر الطلب:{" "}
          <span className="font-mono text-sm sm:text-base font-black text-[#F5D77F] bg-[#0F4D3A] px-2.5 py-0.5 rounded-lg border border-[#C9A86A]/50 shadow-inner">{expectedAlfHint || "—"}</span>
        </span>
        <span className="min-w-0 flex-1 text-end sm:flex-none sm:text-start font-bold">
          المتبقي للصادر:{" "}
          <span className="font-mono text-sm sm:text-base font-black text-emerald-300 bg-[#0F4D3A] px-2.5 py-0.5 rounded-lg border border-[#C9A86A]/50 shadow-inner">{remainingAlfHint || "—"}</span>
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
        {noRedirect ? <input type="hidden" name="noRedirect" value="1" /> : null}
        <input
          type="hidden"
          name="advanceStatus"
          value={advanceToDelivering ? "delivering" : ""}
        />
        {/* سطر الإدخال: باليمين خانة مصغرة جداً يدوياً ، وباليسار زر مربع كبيييير جداً للنقر السريع */}
        <div className="flex items-center justify-between gap-3 pt-2">
          {/* اليمين: خانة كتابة السعر يدوياً مصغرة ومضغوطة جداً بتصميم إسلامي مذهب */}
          <div className="w-28 sm:w-32 shrink-0 space-y-1">
            <label className="text-[10px] font-black text-[#F5D77F] block text-center truncate">سعر آخر يدوياً:</label>
            <input
              ref={amountRef}
              name="amountAlf"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              onKeyDown={onPickupAmountKeyDown}
              className="w-full text-center text-xs sm:text-sm h-11 rounded-xl border-2 border-[#C9A86A] bg-[#06281D] text-[#F5D77F] placeholder-[#F5D77F]/40 font-black shadow-inner focus:ring-2 focus:ring-[#F5D77F] outline-none"
              placeholder="اكتب السعر"
              inputMode="decimal"
              enterKeyHint="done"
              required
            />
          </div>

          {/* اليسار: زر مربع كبيييييير جداً وضخم بتصميم ملكي إسلامي زمردي مذهب */}
          {remainingAlfHint && (
            <div className="relative flex-1 flex justify-end min-w-0">
              {/* النجوم المتلاشية السحرية الجاذبة للنظر */}
              <span className="pointer-events-none absolute -top-4 -right-1 text-sm star-particle-1 z-10 select-none">✨</span>
              <span className="pointer-events-none absolute -bottom-3 left-1 text-sm star-particle-2 z-10 select-none">💫</span>

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  if (amountRef.current) {
                    amountRef.current.value = remainingAlfHint;
                  }
                  if (pickupSubmitModeRef.current) {
                    pickupSubmitModeRef.current.value = "";
                  }
                  if (noteRef.current) {
                    noteRef.current.value = "";
                  }
                  setAmount(remainingAlfHint);
                  setNote("");
                  setTimeout(() => {
                    if (formRef.current) {
                      formRef.current.requestSubmit(mainSubmitRef.current ?? undefined);
                    }
                  }, 40);
                }}
                className="w-full max-w-[210px] h-20 flex items-center justify-center rounded-2xl border-2 border-[#F5D77F] bg-gradient-to-r from-[#0F4D3A] via-[#165B45] to-[#0F4D3A] p-2 font-black text-[#F5D77F] shadow-[0_0_20px_rgba(201,168,106,0.35)] active:scale-95 transition-all cursor-pointer select-none group"
                title="اضغط لتأكيد وإرسال المبلغ مباشرة"
              >
                <div className="flex items-baseline justify-center gap-1">
                  <span className="text-4xl sm:text-5xl font-black drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] tracking-tighter leading-none text-[#F5D77F]">
                    {remainingAlfHint}
                  </span>
                  <span className="text-xs sm:text-sm font-bold opacity-90 shrink-0 select-none text-emerald-200">
                    ألف
                  </span>
                </div>
              </button>
            </div>
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
            className="w-full rounded-xl border-2 border-amber-400 bg-[#06281D] text-amber-200 px-3 py-2 text-xs sm:text-sm shadow-inner placeholder-amber-400/60 focus:ring-2 focus:ring-amber-400 outline-none"
            placeholder="المبلغ مختلف — اكتب السبب"
          />
        )}
        {error ? <p className="text-sm font-bold text-rose-300">{error}</p> : null}
        <div className="flex flex-wrap gap-2 pt-1">
          <button
            ref={mainSubmitRef}
            type="submit"
            disabled={pending}
            onClick={() => {
              if (pickupSubmitModeRef.current) pickupSubmitModeRef.current.value = "";
            }}
            className="rounded-xl bg-gradient-to-r from-[#F5D77F] via-[#E5C158] to-[#C9A86A] text-[#06281D] font-black border border-[#C9A86A] px-4 py-2.5 text-xs sm:text-sm shadow-lg hover:brightness-110 active:scale-95 transition-all disabled:opacity-60 cursor-pointer"
          >
            {pending ? "جارٍ الحفظ…" : advanceToDelivering ? "✓ تسجيل وتحويل الحالة" : "✓ تأكيد"}
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
              className="rounded-xl border-2 border-[#C9A86A] bg-[#0F4D3A] px-4 py-2.5 text-xs sm:text-sm font-black text-[#F5D77F] shadow-sm transition hover:bg-[#165B45] active:scale-95 disabled:opacity-60 cursor-pointer"
              title="تحويل الحالة إلى «عند المندوب» دون تسجيل مبلغ صادر في هذه الخطوة"
            >
              لم أدفع
            </button>
          ) : null}
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-[#C9A86A]/60 bg-[#06281D] px-4 py-2.5 text-xs sm:text-sm font-black text-[#FFF8F0]/80 hover:bg-[#0A3D2E] active:scale-95 transition-all cursor-pointer"
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
  noRedirect = false,
  prepaidAll = false,
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
  noRedirect?: boolean;
  prepaidAll?: boolean;
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

  const [prepaidConfirmState, setPrepaidConfirmState] = useState<"ask" | "took_money" | null>(
    prepaidAll && advanceToDelivered ? "ask" : null
  );

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
    if (isSkip) {
      const skipBtn = formRef.current?.querySelector('button[data-mandoub-action="skip-no-amount"]') as HTMLButtonElement | null;
      if (skipBtn) {
        formRef.current?.requestSubmit(skipBtn);
      } else {
        formRef.current?.requestSubmit();
      }
    } else {
      formRef.current?.requestSubmit(mainSubmitRef.current ?? undefined);
    }
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
    if (latRef.current) latRef.current.value = "";
    if (lngRef.current) lngRef.current.value = "";
    locationPromptDoneRef.current = true;
    setLocationModalOpen(false);
    submitDeliveryAfterLocationChoice();
  }

  if (prepaidConfirmState === "ask") {
    return (
      <div className="space-y-4 p-4 text-right bg-gradient-to-b from-[#06281D] via-[#0A3D2E] to-[#06281D] rounded-2xl border-2 border-[#C9A86A] shadow-2xl text-[#FFF8F0]">
        <div className="flex flex-col items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#0F4D3A] text-[#F5D77F] border-2 border-[#C9A86A] shadow-md">
            <svg className="size-6 animate-pulse" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
            </svg>
          </div>
          <h4 className="text-sm sm:text-base font-black text-[#F5D77F] text-center drop-shadow-sm">تأكد أنك لم تأخذ أي مبلغ من الزبون</h4>
          <p className="text-xs font-bold text-white/90 text-center leading-relaxed">هذه الطلبية مسجلة بأنها "واصلة مسبقاً"، ويتم تحصيل أجور التوصيل فقط.</p>
        </div>

        <div className="flex gap-3 mt-2">
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              if (deliverySubmitModeRef.current) {
                deliverySubmitModeRef.current.value = "statusOnlyNoAmount";
              }
              if (amountRef.current) {
                amountRef.current.removeAttribute("required");
              }
              const skipBtn = formRef.current?.querySelector('button[data-mandoub-action="skip-no-amount"]') as HTMLButtonElement | null;
              if (skipBtn) {
                formRef.current?.requestSubmit(skipBtn);
              } else {
                formRef.current?.requestSubmit();
              }
            }}
            className="flex-1 py-2.5 px-4 rounded-xl bg-gradient-to-r from-[#F5D77F] via-[#E5C158] to-[#C9A86A] text-[#06281D] font-black text-center shadow-lg active:scale-95 transition-all text-xs sm:text-sm disabled:opacity-50 cursor-pointer border border-[#C9A86A]"
          >
            {pending ? "جارٍ الحفظ…" : "✓ لا، لم آخذ"}
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              setPrepaidConfirmState("took_money");
            }}
            className="flex-1 py-2.5 px-4 rounded-xl bg-gradient-to-r from-rose-700 to-rose-900 border border-[#C9A86A] text-[#F5D77F] font-black text-center shadow-md active:scale-95 transition-all text-xs sm:text-sm disabled:opacity-50 cursor-pointer"
          >
            نعم، أخذت مبلغاً
          </button>
        </div>

        <div className="flex justify-center border-t border-[#C9A86A]/30 pt-3 mt-3">
          <button
            type="button"
            onClick={onClose}
            className="text-xs font-black text-[#F5D77F]/80 hover:text-white transition cursor-pointer"
            disabled={pending}
          >
            إلغاء والرجوع
          </button>
        </div>

        {/* نموذج مخفي في الخلفية ليتمكن requestSubmit من إرساله */}
        <form
          ref={formRef}
          action={formAction}
          className="hidden"
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
          <input ref={deliverySubmitModeRef} type="hidden" name="mandoubMoneySubmitMode" value="statusOnlyNoAmount" />
          <input type="hidden" name="c" value={auth.c} />
          <input type="hidden" name="exp" value={auth.exp} />
          <input type="hidden" name="s" value={auth.s} />
          <input type="hidden" name="orderId" value={orderId} />
          <input type="hidden" name="next" value={nextUrl} />
          {noRedirect ? <input type="hidden" name="noRedirect" value="1" /> : null}
          <input type="hidden" name="advanceStatus" value="delivered" />
          <input ref={latRef} type="hidden" name="lat" value="" />
          <input ref={lngRef} type="hidden" name="lng" value="" />
        </form>

        {portalReady && locationModalOpen && createPortal(
          <div className="fixed inset-0 z-[1300] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm" dir="rtl">
            <div className="max-w-md w-full rounded-[24px] border-2 border-[#C9A86A] bg-gradient-to-b from-[#06281D] via-[#0A3D2E] to-[#06281D] p-5 shadow-2xl text-[#FFF8F0]">
              <p className="text-base font-black text-[#F5D77F] drop-shadow-sm flex items-center gap-1.5"><span>📍</span> هذا الطلب لا يحتوي على موقع للزبون</p>
              <p className="mt-3 text-xs font-bold text-white/90 leading-relaxed">أتممت تسليم الطلب الآن؟ هل تريد رفع موقعك الحالي كـ موقع للزبون في الأرشيف؟</p>
              {geoError && <p className="mt-3 text-xs font-bold text-rose-300 bg-rose-950/80 p-2 rounded-xl border border-rose-500/50">{geoError}</p>}
              <div className="mt-5 flex flex-col gap-2">
                <button type="button" onClick={onConfirmGps} className="rounded-xl bg-gradient-to-r from-[#F5D77F] via-[#E5C158] to-[#C9A86A] text-[#06281D] py-3 text-xs sm:text-sm font-black border border-[#C9A86A] shadow-md hover:brightness-110 active:scale-95 transition-all cursor-pointer">✓ نعم، ارفع موقعي الحالي</button>
                <button type="button" onClick={onSkipLocation} className="rounded-xl border border-[#C9A86A]/60 bg-[#06281D] py-2.5 text-xs sm:text-sm font-black text-[#FFF8F0]/80 hover:bg-[#0A3D2E] active:scale-95 transition-all cursor-pointer">لا، لا ترفع موقعي</button>
              </div>
            </div>
          </div>,
          document.body
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3 select-none">
      <p className="font-black text-xs sm:text-sm text-[#F5D77F] drop-shadow-sm flex items-center gap-1.5">
        <span>🫴</span> {prepaidConfirmState === "took_money"
          ? "الطلب واصل حسابه لكن يبدو أنك أخذت مبلغاً، اكتب المبلغ الذي أخذته واكتب السبب"
          : "اكتب المبلغ الذي استلمته من الزبون (وارد)"}
      </p>
      {!advanceToDelivered ? (
        <p className="text-[11px] font-bold text-rose-300/90">
          تسجيل وارد فقط — دون تغيير حالة الطلب.
        </p>
      ) : null}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border-2 border-[#C9A86A] bg-gradient-to-r from-[#06281D] via-[#0A3D2E] to-[#06281D] p-3 text-xs shadow-lg text-[#FFF8F0]">
        <span className="min-w-0 flex-1 sm:flex-none font-bold">
          المبلغ الكلي:{" "}
          <span className="font-mono text-sm sm:text-base font-black text-[#F5D77F] bg-[#0F4D3A] px-2.5 py-0.5 rounded-lg border border-[#C9A86A]/50 shadow-inner">{expectedAlfHint || "—"}</span>
        </span>
        <span className="min-w-0 flex-1 text-end sm:flex-none sm:text-start font-bold">
          المتبقي للوارد:{" "}
          <span className="font-mono text-sm sm:text-base font-black text-rose-300 bg-[#0F4D3A] px-2.5 py-0.5 rounded-lg border border-[#C9A86A]/50 shadow-inner">{remainingAlfHint || "—"}</span>
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
        {noRedirect ? <input type="hidden" name="noRedirect" value="1" /> : null}
        <input
          type="hidden"
          name="advanceStatus"
          value={advanceToDelivered ? "delivered" : ""}
        />
        <input ref={latRef} type="hidden" name="lat" value="" />
        <input ref={lngRef} type="hidden" name="lng" value="" />
        {/* سطر الإدخال: باليمين خانة مصغرة جداً يدوياً ، وباليسار زر مربع كبيييير جداً للنقر السريع */}
        <div className="flex items-center justify-between gap-3 pt-2">
          {/* اليمين: خانة كتابة السعر يدوياً مصغرة ومضغوطة جداً بتصميم إسلامي مذهب */}
          <div className="w-28 sm:w-32 shrink-0 space-y-1">
            <label className="text-[10px] font-black text-[#F5D77F] block text-center truncate">سعر آخر يدوياً:</label>
            <input
              ref={amountRef}
              name="amountAlf"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              onKeyDown={onDeliveryAmountKeyDown}
              className="w-full text-center text-xs sm:text-sm h-11 rounded-xl border-2 border-[#C9A86A] bg-[#06281D] text-[#F5D77F] placeholder-[#F5D77F]/40 font-black shadow-inner focus:ring-2 focus:ring-[#F5D77F] outline-none"
              placeholder="اكتب السعر"
              inputMode="decimal"
              enterKeyHint="done"
              required
            />
          </div>

          {/* اليسار: زر مربع كبيييييير جداً وضخم بتصميم ملكي إسلامي زمردي مذهب */}
          {remainingAlfHint && (
            <div className="relative flex-1 flex justify-end min-w-0">
              {/* النجوم المتلاشية السحرية الجاذبة للنظر */}
              <span className="pointer-events-none absolute -top-4 -right-1 text-sm star-particle-1 z-10 select-none">✨</span>
              <span className="pointer-events-none absolute -bottom-3 left-1 text-sm star-particle-2 z-10 select-none">💫</span>

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  if (amountRef.current) {
                    amountRef.current.value = remainingAlfHint;
                  }
                  if (deliverySubmitModeRef.current) {
                    deliverySubmitModeRef.current.value = "";
                  }
                  if (noteRef.current) {
                    noteRef.current.value = "";
                  }
                  setAmount(remainingAlfHint);
                  setNote("");
                  setTimeout(() => {
                    if (formRef.current) {
                      formRef.current.requestSubmit(mainSubmitRef.current ?? undefined);
                    }
                  }, 40);
                }}
                className="w-full max-w-[210px] h-20 flex items-center justify-center rounded-2xl border-2 border-[#F5D77F] bg-gradient-to-r from-[#0F4D3A] via-[#165B45] to-[#0F4D3A] p-2 font-black text-[#F5D77F] shadow-[0_0_20px_rgba(201,168,106,0.35)] active:scale-95 transition-all cursor-pointer select-none group"
                title="اضغط لتأكيد وإرسال المبلغ مباشرة"
              >
                <div className="flex items-baseline justify-center gap-1">
                  <span className="text-4xl sm:text-5xl font-black drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] tracking-tighter leading-none text-[#F5D77F]">
                    {remainingAlfHint}
                  </span>
                  <span className="text-xs sm:text-sm font-bold opacity-90 shrink-0 select-none text-emerald-200">
                    ألف
                  </span>
                </div>
              </button>
            </div>
          )}
        </div>
        <input type="hidden" name="mismatchReason" value="" />
        {(isMismatch || prepaidConfirmState === "took_money") && (
          <textarea
            ref={noteRef}
            name="mismatchNote"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            onKeyDown={onDeliveryNoteKeyDown}
            rows={2}
            required
            className="w-full rounded-xl border-2 border-amber-400 bg-[#06281D] text-amber-200 px-3 py-2 text-xs sm:text-sm shadow-inner placeholder-amber-400/60 focus:ring-2 focus:ring-amber-400 outline-none"
            placeholder={prepaidConfirmState === "took_money" ? "اكتب سبب أخذ المبلغ بالتفصيل (مثلاً: أخذت أجور التوصيل)" : "المبلغ مختلف — اكتب السبب"}
          />
        )}
        {error ? <p className="text-sm font-bold text-rose-300">{error}</p> : null}
        <div className="flex flex-wrap gap-2 pt-1">
          <button
            ref={mainSubmitRef}
            type="submit"
            disabled={pending}
            data-mandoub-action="with-amount"
            onClick={() => {
              if (deliverySubmitModeRef.current) deliverySubmitModeRef.current.value = "";
            }}
            className="rounded-xl bg-gradient-to-r from-[#F5D77F] via-[#E5C158] to-[#C9A86A] text-[#06281D] font-black border border-[#C9A86A] px-4 py-2.5 text-xs sm:text-sm shadow-lg hover:brightness-110 active:scale-95 transition-all disabled:opacity-60 cursor-pointer"
          >
            {pending ? "جارٍ الحفظ…" : advanceToDelivered ? "✓ تسجيل وتحويل الحالة" : "✓ تأكيد"}
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
              className="rounded-xl border-2 border-[#C9A86A] bg-[#0F4D3A] px-4 py-2.5 text-xs sm:text-sm font-black text-[#F5D77F] shadow-sm transition hover:bg-[#165B45] active:scale-95 disabled:opacity-60 cursor-pointer"
              title="تحويل الحالة إلى «تم التسليم» دون تسجيل مبلغ وارد في هذه الخطوة"
            >
              لم أستلم
            </button>
          ) : null}
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-[#C9A86A]/60 bg-[#06281D] px-4 py-2.5 text-xs sm:text-sm font-black text-[#FFF8F0]/80 hover:bg-[#0A3D2E] active:scale-95 transition-all cursor-pointer"
            disabled={pending}
          >
            إلغاء
          </button>
        </div>
      </form>

      {portalReady && locationModalOpen
        ? createPortal(
            <div
              className="fixed inset-0 z-[1300] flex items-center justify-center bg-black/75 backdrop-blur-sm p-4"
              dir="rtl"
              role="dialog"
              aria-modal="true"
              aria-labelledby="mandoub-delivery-loc-title"
            >
              <div className="max-w-md rounded-2xl border-2 border-[#C9A86A] bg-[#06281D] p-5 shadow-2xl text-[#FFF8F0]">
                <p
                  id="mandoub-delivery-loc-title"
                  className="text-base font-black leading-relaxed text-[#F5D77F]"
                >
                  هذا الطلب لا يحتوي على موقع للزبون
                </p>
                <p className="mt-3 text-sm leading-relaxed text-[#FFF8F0]/85">
                  أتممت تسليم الطلب الآن؟ هل تريد رفع{" "}
                  <strong className="text-[#F5D77F]">موقعك الحالي</strong> (حيث أنت الآن) على أنه
                  موقع الزبون؟ قد تكون قد غيرت مكانك بعد مغادرة الزبون — اختر بعناية.
                </p>
                {geoError ? (
                  <p className="mt-3 text-sm font-bold text-rose-300">{geoError}</p>
                ) : null}
                <div className="mt-5 flex flex-col gap-2.5">
                  <button
                    type="button"
                    onClick={onConfirmGps}
                    disabled={pending}
                    className="rounded-xl bg-gradient-to-r from-[#F5D77F] via-[#E5C158] to-[#C9A86A] px-4 py-3 text-sm font-black text-[#06281D] shadow-lg hover:brightness-110 active:scale-95 transition-all disabled:opacity-60 cursor-pointer"
                  >
                    ✓ نعم، ارفع موقعي الحالي
                  </button>
                  <button
                    type="button"
                    onClick={onSkipLocation}
                    disabled={pending}
                    className="rounded-xl border-2 border-[#C9A86A] bg-[#0F4D3A] px-4 py-3 text-sm font-black text-[#F5D77F] shadow-sm transition hover:bg-[#165B45] active:scale-95 disabled:opacity-60 cursor-pointer"
                  >
                    ✕ لا، لا ترفع موقعي
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setLocationModalOpen(false);
                      setGeoError("");
                    }}
                    className="mt-2 text-center text-sm font-bold text-[#C9A86A] hover:underline cursor-pointer"
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
