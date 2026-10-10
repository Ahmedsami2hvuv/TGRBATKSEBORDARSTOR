"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
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
import { LuxuryReverseOrderButton } from "@/components/luxury-reverse-order-button";
import { Banknote, Check, Package, X, Zap } from "lucide-react";

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
  const [localEvents, setLocalEvents] = useState<MandoubMoneyEventUi[]>(moneyEvents);
  useEffect(() => {
    setLocalEvents(moneyEvents);
  }, [moneyEvents]);

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

  const triggerBackgroundMoneyRecord = async (payload: {
    type: "pickup" | "delivery";
    amountAlf: string;
    mismatchNote?: string;
    advanceStatus?: string;
    submitMode?: string;
    lat?: string | number;
    lng?: string | number;
  }) => {
    try {
      const res = await fetch("/api/mandoub/record-money", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...payload,
          orderId,
          c: auth.c,
          exp: auth.exp,
          s: auth.s,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setToastMsg({ text: data.error || "حدث خطأ أثناء الحفظ بالسيرفر.", type: "error" });
        setLocalEvents(moneyEvents); // تراجع في حال الخطأ
      } else {
        router.refresh();
      }
    } catch (err: any) {
      console.error("Background money record error:", err);
      setToastMsg({ text: "تعذّر الاتصال بالسيرفر لحفظ المعاملة.", type: "error" });
      setLocalEvents(moneyEvents);
    }
  };

  const handleInstantDeliveryOptimistic = (
    amtAlf: string,
    note?: string,
    lat?: string | number,
    lng?: string | number,
    submitMode?: string,
  ) => {
    const numAlf = Number(amtAlf || 0);
    const amountDinar = Number.isFinite(numAlf) ? numAlf * 1000 : 0;
    const optimisticEv: MandoubMoneyEventUi = {
      id: "opt-del-" + Date.now(),
      kind: MONEY_KIND_DELIVERY,
      amountDinar,
      expectedDinar: totalAmountDinar,
      matchesExpected: true,
      mismatchReason: "",
      mismatchNote: note || (amountDinar === 0 ? "لم استلم (0)" : ""),
      recordedAt: new Date().toISOString(),
      deletedAt: null,
      deletedReason: null,
      deletedByDisplayName: null,
      performedByDisplayName: courierName || "المندوب",
      recordedByCompanyPreparerId: null,
    };
    setLocalEvents((prev) => [optimisticEv, ...prev.filter((e) => e.kind !== MONEY_KIND_DELIVERY || e.deletedAt != null)]);
    window.dispatchEvent(
      new CustomEvent("MANDOUB_ORDER_STATUS_OPTIMISTIC", {
        detail: { orderId, status: "delivered" },
      }),
    );
    setToastMsg({ text: "تم تسليم الطلب واحتساب الأرباح بنجاح!", type: "success" });
    closePanels();
    void triggerBackgroundMoneyRecord({
      type: "delivery",
      amountAlf: amtAlf,
      mismatchNote: note,
      advanceStatus:
        deliveryAdvanceToDelivered ||
        orderStatus === "delivering" ||
        orderStatus === "assigned" ||
        orderStatus === "pending"
          ? "delivered"
          : "",
      submitMode: submitMode || (amtAlf === "0" ? "statusOnlyNoAmount" : ""),
      lat,
      lng,
    });
  };

  const handleInstantPickupOptimistic = (amtAlf: string, note?: string, submitMode?: string) => {
    const numAlf = Number(amtAlf || 0);
    const amountDinar = Number.isFinite(numAlf) ? numAlf * 1000 : 0;
    const optimisticEv: MandoubMoneyEventUi = {
      id: "opt-pic-" + Date.now(),
      kind: MONEY_KIND_PICKUP,
      amountDinar,
      expectedDinar: orderSubtotalDinar,
      matchesExpected: true,
      mismatchReason: "",
      mismatchNote: note || (amountDinar === 0 ? "لم أدفع (0)" : ""),
      recordedAt: new Date().toISOString(),
      deletedAt: null,
      deletedReason: null,
      deletedByDisplayName: null,
      performedByDisplayName: courierName || "المندوب",
      recordedByCompanyPreparerId: null,
    };
    setLocalEvents((prev) => [optimisticEv, ...prev.filter((e) => e.kind !== MONEY_KIND_PICKUP || e.deletedAt != null)]);
    window.dispatchEvent(
      new CustomEvent("MANDOUB_ORDER_STATUS_OPTIMISTIC", {
        detail: { orderId, status: "delivering" },
      }),
    );
    setToastMsg({ text: "تم استلام الطلب وتسجيل الصادر بنجاح!", type: "success" });
    closePanels();
    void triggerBackgroundMoneyRecord({
      type: "pickup",
      amountAlf: amtAlf,
      mismatchNote: note,
      advanceStatus:
        pickupAdvanceToDelivering ||
        orderStatus === "assigned" ||
        orderStatus === "pending"
          ? "delivering"
          : "",
      submitMode: submitMode || (amtAlf === "0" ? "statusOnlyNoAmount" : ""),
    });
  };

  useEffect(() => {
    if (pickupState.error) {
      setToastMsg({ text: pickupState.error, type: "error" });
      setLocalEvents(moneyEvents); // تراجع في حال الخطأ
    } else if (pickupState.success || pickupState.ok) {
      setToastMsg({ text: "تم استلام الطلب وتسجيل الصادر بنجاح!", type: "success" });
      closePanels();
      router.refresh();
      setTimeout(() => setToastMsg(null), 4000);
    }
  }, [pickupState, moneyEvents, router]);

  useEffect(() => {
    if (deliveryState.error) {
      setToastMsg({ text: deliveryState.error, type: "error" });
      setLocalEvents(moneyEvents); // تراجع في حال الخطأ
    } else if (deliveryState.success || deliveryState.ok) {
      setToastMsg({ text: "تم تسليم الطلب واحتساب الأرباح بنجاح!", type: "success" });
      closePanels();
      router.refresh();
      setTimeout(() => setToastMsg(null), 4000);
    }
  }, [deliveryState, moneyEvents, router]);

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
    () => localEvents.filter((e) => e.deletedAt == null),
    [localEvents],
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

  const formatAmtAlf = (dinar: number | null | undefined): string => {
    if (!dinar || dinar <= 0) return "0";
    const alf = dinar / 1000;
    return Number.isInteger(alf) ? `${alf}` : alf.toFixed(1);
  };

  const pickupDisplayAmt = pickupSum > 0 ? pickupSum : (orderSubtotalDinar ?? 0);
  const deliveryDisplayAmt = deliverySum > 0 ? deliverySum : (totalAmountDinar ?? 0);

  const pickupDisplayAlf = formatAmtAlf(pickupDisplayAmt);
  const deliveryDisplayAlf = formatAmtAlf(deliveryDisplayAmt);

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
          <span>
            {toastMsg.type === "success" ? (
              <svg className="w-5 h-5 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            ) : (
              <svg className="w-5 h-5 text-rose-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            )}
          </span>
          <span>{toastMsg.text}</span>
          <button
            onClick={() => setToastMsg(null)}
            className="mr-2 text-white/80 hover:text-white font-bold text-lg cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* كارت وسجل المعاملات المالية بهوية وصلي الرسمية */}
      <div className="space-y-4">
        {/* زري استلام وتسليم (أعطيت وأخذت) بهوية وصلي مع عرض المبالغ المالية */}
        {orderId && (
          <div className="flex items-center justify-center gap-3 sm:gap-4 py-1">
            {/* زر استلام (صادر / أعطيت للمحل) مع المبلغ */}
            <button
              type="button"
              onClick={() => {
                setPickupAdvanceToDelivering(true);
                setPickupOpen(true);
                setDeliveryOpen(false);
              }}
              className="group relative flex-1 max-w-[210px] h-[66px] sm:h-[72px] rounded-[18px] bg-gradient-to-r from-[#0B2E8C] to-[#1E4DB7] border-2 border-[#FFC107] text-white flex items-center justify-between px-3.5 sm:px-4 py-1.5 shadow-[0_4px_16px_rgba(11,46,140,0.25)] hover:shadow-[0_6px_22px_rgba(11,46,140,0.35)] active:scale-95 transition-all cursor-pointer overflow-hidden"
              title="استلام الطلب وتسجيل الصادر (أعطيت للمحل)"
            >
              <div className="flex flex-col items-start leading-tight">
                <span className="text-[11.5px] font-bold text-[#FFC107] tracking-tight">استلام (صادر)</span>
                <span className="text-[16px] sm:text-[18px] font-black text-white font-mono leading-tight my-0.5">
                  {pickupDisplayAlf} ألف
                </span>
                <span className="text-[9.5px] font-medium text-white/75">تسجيل مدفوع المحل</span>
              </div>
              <div className="w-8 h-8 rounded-full bg-[#FFC107] text-[#0B2E8C] flex items-center justify-center shrink-0 shadow-xs group-hover:scale-105 transition-transform">
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                </svg>
              </div>
            </button>

            {/* زر تسليم (وارد / أخذت من الزبون) مع المبلغ */}
            <button
              type="button"
              onClick={() => {
                setDeliveryAdvanceToDelivered(true);
                setDeliveryOpen(true);
                setPickupOpen(false);
              }}
              className="group relative flex-1 max-w-[210px] h-[66px] sm:h-[72px] rounded-[18px] bg-gradient-to-r from-[#FFA000] via-[#FFB300] to-[#FFC107] border-2 border-white text-[#0B2E8C] flex items-center justify-between px-3.5 sm:px-4 py-1.5 shadow-[0_4px_16px_rgba(255,193,7,0.3)] hover:shadow-[0_6px_22px_rgba(255,193,7,0.4)] active:scale-95 transition-all cursor-pointer overflow-hidden"
              title="تسليم الطلب وتسجيل الوارد (أخذت من الزبون)"
            >
              <div className="flex flex-col items-start leading-tight">
                <span className="text-[11.5px] font-bold text-[#0B2E8C] tracking-tight">تسليم (وارد)</span>
                <span className="text-[16px] sm:text-[18px] font-black text-[#0B2E8C] font-mono leading-tight my-0.5">
                  {deliveryDisplayAlf} ألف
                </span>
                <span className="text-[9.5px] font-medium text-[#0B2E8C]/75">تسجيل مقبوض الزبون</span>
              </div>
              <div className="w-8 h-8 rounded-full bg-[#0B2E8C] text-[#FFC107] flex items-center justify-center shrink-0 shadow-xs group-hover:scale-105 transition-transform">
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 6L9 17l-5-5" />
                </svg>
              </div>
            </button>
          </div>
        )}

        {/* فاصل هندسي ناعم بهوية وصلي */}
        <div className="flex items-center gap-2 py-0.5">
          <div className="h-[1px] flex-1 bg-gradient-to-l from-[#D0DDFB] to-transparent" />
          <div className="w-2 h-2 rotate-45 bg-[#0B2E8C]" />
          <div className="h-[1px] flex-1 bg-gradient-to-r from-[#D0DDFB] to-transparent" />
        </div>

        {/* قائمة المعاملات */}
        {moneyEvents.length === 0 ? (
          <div className="text-center text-[#0B2E8C] py-4 bg-[#F8FAFF] rounded-[16px] border border-dashed border-[#D0DDFB] text-xs font-bold">
            لا توجد معاملات نقد مسجّلة لهذا الطلب حتى الآن.
          </div>
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
                  className={`relative rounded-[16px] bg-[#F8FAFF] border border-[#D0DDFB] shadow-2xs hover:border-[#0B2E8C]/30 p-2.5 transition-all overflow-hidden ${
                    deleted ? "opacity-50 grayscale" : ""
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      {/* أيقونة الاتجاه بهوية وصلي */}
                      <div
                        className={`w-[32px] h-[32px] rounded-full flex items-center justify-center shrink-0 shadow-2xs ${
                          isSader
                            ? "bg-[#0B2E8C] text-[#FFC107]"
                            : "bg-[#FFC107] text-[#0B2E8C]"
                        }`}
                      >
                        {isSader ? (
                          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8">
                            <line x1="7" y1="17" x2="17" y2="7" />
                            <polyline points="7 7 17 7 17 17" />
                          </svg>
                        ) : (
                          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8">
                            <line x1="7" y1="7" x2="17" y2="17" />
                            <polyline points="17 7 17 17 7 17" />
                          </svg>
                        )}
                      </div>

                      {/* تفاصيل الحركة */}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[10px] font-black ${
                              isSader
                                ? "bg-[#0B2E8C] text-white"
                                : "bg-[#FFC107] text-[#0B2E8C]"
                            }`}
                          >
                            {isSader ? "صادر" : "وارد"}
                          </span>

                          <span className="text-[12px] font-black text-[#0B2E8C]">
                            {ev.performedByDisplayName?.trim() || courierName?.trim() || "المندوب"}
                          </span>

                          <span className="text-[10px] font-bold text-slate-500 px-2 py-0.5 rounded-full bg-white border border-[#D0DDFB]">
                            {timeInfo.dateStr} {timeInfo.timeStr}
                          </span>

                          <span className="text-[13px] font-black text-[#0B2E8C] font-mono mr-auto">
                            {formatDinarAsAlfWithUnit(ev.amountDinar)}
                          </span>
                        </div>

                        {noteText && (
                          <div className="mt-1.5 text-[11px] font-bold text-slate-600 bg-white border border-[#D0DDFB]/70 rounded-[10px] p-2 leading-[1.4] line-clamp-2">
                            {noteText}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* زر الحذف */}
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
                          className="w-[28px] h-[28px] rounded-full bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-600 shadow-2xs active:scale-90 shrink-0 cursor-pointer hover:bg-rose-100 transition"
                          title="مسح المعاملة"
                          onClick={(e) => {
                            if (!confirm("هل أنت متأكد من مسح هذه المعاملة المالية؟")) {
                              e.preventDefault();
                            }
                          }}
                        >
                          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
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

      {/* --- مودال تسجيل الصادر (أعطيت للمحل/العميل) الفاخر --- */}
      {pickupOpen && orderId && (
        <MandoubPickupModal
          orderId={orderId}
          orderNumber={orderNumber}
          auth={auth}
          nextUrl={nextUrl}
          advanceStatus={pickupAdvanceToDelivering || orderStatus === "assigned" || orderStatus === "pending" ? "delivering" : ""}
          defaultAlf={orderSubtotalDinar ? dinarDecimalToAlfInputString(orderSubtotalDinar) : ""}
          pickupAction={pickupAction}
          pickupPending={pickupPending}
          onClose={closePanels}
          onInstantOptimistic={handleInstantPickupOptimistic}
        />
      )}

      {/* --- مودال تسجيل الوارد (أخذت من الزبون) الفاخر --- */}
      {deliveryOpen && orderId && (
        <MandoubDeliveryModal
          orderId={orderId}
          orderNumber={orderNumber}
          auth={auth}
          nextUrl={nextUrl}
          advanceStatus={deliveryAdvanceToDelivered || orderStatus === "delivering" || orderStatus === "assigned" ? "delivered" : ""}
          defaultAlf={totalAmountDinar ? dinarDecimalToAlfInputString(totalAmountDinar) : ""}
          deliveryAction={deliveryAction}
          deliveryPending={deliveryPending}
          onClose={closePanels}
          missingCustomerLocation={missingCustomerLocation}
          onInstantOptimistic={handleInstantDeliveryOptimistic}
        />
      )}
    </div>
  );
}

function MandoubPickupModal({
  orderId,
  orderNumber,
  auth,
  nextUrl,
  advanceStatus,
  defaultAlf,
  pickupAction,
  pickupPending,
  onClose,
  onInstantOptimistic,
}: {
  orderId: string;
  orderNumber?: number;
  auth: { c: string; exp: string; s: string };
  nextUrl: string;
  advanceStatus: string;
  defaultAlf: string;
  pickupAction: (formData: FormData) => void | Promise<void>;
  pickupPending: boolean;
  onClose: () => void;
  onInstantOptimistic?: (amtAlf: string, note?: string, submitMode?: string) => void;
}) {
  const [amountAlf, setAmountAlf] = useState("");
  const [selectedBox, setSelectedBox] = useState<"num" | "zero" | null>(null);
  const [note, setNote] = useState("");
  const formRef = useRef<HTMLFormElement>(null);
  const isMismatch =
    amountAlf.trim() !== "" &&
    amountAlf.trim() !== defaultAlf &&
    amountAlf.trim() !== "0" &&
    selectedBox !== "zero";

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center p-3 sm:p-4 bg-[#0A1840]/60 backdrop-blur-[6px] overflow-y-auto animate-in fade-in"
      onClick={onClose}
    >
      <div
        className="bg-white border-[2px] border-[#0B2E8C] rounded-[28px] shadow-[0_20px_60px_rgba(11,46,140,0.3)] p-[20px] relative overflow-hidden w-full max-w-[390px] text-right select-none my-auto animate-in zoom-in-95 duration-200"
        dir="rtl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* تدرج إضاءة علوي أزرق ناعم */}
        <div className="absolute top-0 inset-x-0 h-[84px] bg-gradient-to-b from-[#E8EEFF] to-transparent opacity-70 pointer-events-none" />

        {/* رأس النافذة */}
        <div className="relative flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-[10px] bg-[#E8EEFF] border border-[#D0DDFB] flex items-center justify-center shrink-0">
              <Banknote className="w-[18px] h-[18px] text-[#0B2E8C]" />
            </div>
            <h2 className="text-[#0B2E8C] font-black text-[15px] tracking-tight">
              تسجيل دفع {orderNumber ? `- طلب #${orderNumber}` : ""}
            </h2>
            <div className="h-6 w-6 rounded-full bg-[#FFC107] flex items-center justify-center shadow-[0_2px_6px_rgba(255,193,7,0.4)] shrink-0">
              <Zap className="w-3 h-3 text-[#0B2E8C] fill-[#0B2E8C]" />
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="h-9 w-9 rounded-full bg-[#F0F4FF] border border-[#D0DDFB] flex items-center justify-center text-[#0B2E8C] hover:bg-[#E8EEFF] transition-colors cursor-pointer shrink-0"
            title="إغلاق"
          >
            <X className="w-4 h-4" strokeWidth={2.5} />
          </button>
        </div>

        <div className="mt-4 h-[1px] w-full bg-[#D0DDFB]/80" />

        <p className="mt-4 text-right text-[#0B2E8C] text-[13px] font-bold">
          المبلغ (ألف دينار):
        </p>

        {/* خيارا الاختيار السريع لثيم وصلي */}
        <div className="mt-3 grid grid-cols-2 gap-3">
          {/* خيار لم أدفع */}
          <button
            type="button"
            onClick={() => {
              setAmountAlf("0");
              setSelectedBox("zero");
              onInstantOptimistic?.("0", undefined, "statusOnlyNoAmount");
            }}
            className={`relative h-[90px] rounded-[20px] flex flex-col items-center justify-center gap-1 transition-all border-[2px] cursor-pointer ${
              selectedBox === "zero"
                ? "bg-[#E8EEFF] border-[#0B2E8C] border-[3px] shadow-[0_4px_16px_rgba(11,46,140,0.15)] scale-[1.02]"
                : "bg-[#F8FAFF] border-[#D0DDFB] hover:border-[#0B2E8C]/40"
            }`}
          >
            {selectedBox === "zero" && (
              <div className="absolute top-2 left-2 h-5 w-5 rounded-full bg-[#0B2E8C] flex items-center justify-center">
                <Check className="w-3 h-3 text-white" strokeWidth={3} />
              </div>
            )}
            <span className={`font-bold text-[16px] ${selectedBox === "zero" ? "text-[#0B2E8C]" : "text-[#0B2E8C]/70"}`}>
              لم أدفع
            </span>
            <span className="text-[11px] text-[#0B2E8C]/40 font-medium">بعد</span>
          </button>

          {/* خيار المبلغ السريع */}
          <button
            type="button"
            onClick={() => {
              setAmountAlf(defaultAlf);
              setSelectedBox("num");
              onInstantOptimistic?.(defaultAlf);
            }}
            className={`relative h-[90px] rounded-[20px] flex items-center justify-center transition-all border-[2px] cursor-pointer ${
              selectedBox === "num"
                ? "bg-[#E8EEFF] border-[#0B2E8C] border-[3px] shadow-[0_4px_16px_rgba(11,46,140,0.15)] scale-[1.02]"
                : "bg-[#F8FAFF] border-[#D0DDFB] hover:border-[#0B2E8C]/40"
            }`}
          >
            {selectedBox === "num" && (
              <div className="absolute top-2 left-2 h-5 w-5 rounded-full bg-[#0B2E8C] flex items-center justify-center">
                <Check className="w-3 h-3 text-white" strokeWidth={3} />
              </div>
            )}
            <span className="text-[#0B2E8C] font-black text-[36px] leading-none">
              {defaultAlf || "0"}
            </span>
          </button>
        </div>

        <form
          ref={formRef}
          action={pickupAction}
          className="mt-4 space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            const val = amountAlf.trim() !== "" ? amountAlf.trim() : (selectedBox === "zero" ? "0" : (defaultAlf || "0"));
            onInstantOptimistic?.(val, note, val === "0" ? "statusOnlyNoAmount" : "");
          }}
        >
          <input type="hidden" name="c" value={auth.c} />
          <input type="hidden" name="exp" value={auth.exp} />
          <input type="hidden" name="s" value={auth.s} />
          <input type="hidden" name="orderId" value={orderId} />
          <input type="hidden" name="next" value={nextUrl} />
          <input type="hidden" name="advanceStatus" value={advanceStatus} />
          <input type="hidden" name="mandoubMoneySubmitMode" value="" />

          {/* خانة كتابة السعر: تبقى فارغة بدون أي كتابة مسبقة إلا إذا أراد المندوب */}
          <div className="relative">
            <input
              name="amountAlf"
              inputMode="numeric"
              value={amountAlf}
              onChange={(e) => {
                const v = e.target.value.replace(/[^0-9]/g, "");
                setAmountAlf(v);
                if (v === defaultAlf && defaultAlf !== "" && defaultAlf !== "0") setSelectedBox("num");
                else if (v === "0") setSelectedBox("zero");
                else setSelectedBox(null);
              }}
              placeholder={defaultAlf || "0"}
              className="w-full h-[52px] bg-white border-[2px] border-[#4AA3FF] rounded-[20px] text-center text-[#0B2E8C] font-black text-[20px] placeholder:text-[#0B2E8C]/20 focus:outline-none focus:border-[#0B2E8C] focus:ring-4 focus:ring-[#E8EEFF] transition-all"
            />
            <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[11px] font-bold text-[#4AA3FF] bg-[#F0F4FF] px-2 py-1 rounded-full border border-[#D0DDFB]">
              ألف د.ع
            </span>
          </div>

          {/* حقل سبب اختلاف المبلغ إن وجد */}
          {isMismatch ? (
            <div className="space-y-1.5 animate-in fade-in duration-200">
              <div className="text-right">
                <span className="text-[12px] font-bold text-[#0B2E8C]">
                  سبب اختلاف الصادر <span className="text-rose-600">*</span>
                </span>
              </div>
              <textarea
                name="mismatchNote"
                required
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
                className="w-full min-h-[70px] rounded-[16px] border-[1.5px] border-[#D0DDFB] bg-[#F8FAFF] px-3 py-2 text-[12px] text-right text-[#0B2E8C] placeholder:text-[#0B2E8C]/40 focus:outline-none focus:border-[#0B2E8C] focus:ring-2 focus:ring-[#E8EEFF] resize-none font-medium"
                placeholder="اكتب سبب اختلاف المبلغ عن المطلوب..."
              />
            </div>
          ) : (
            <input type="hidden" name="mismatchNote" value="" />
          )}

          <div className="h-[1px] w-full bg-[#D0DDFB]/60 my-2" />

          {/* أزرار الإجراء */}
          <div className="flex gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 h-[48px] rounded-[20px] bg-[#F0F4FF] border border-[#D0DDFB] text-[#0B2E8C] font-bold text-[13px] hover:bg-[#E8EEFF] active:scale-[0.98] transition-all cursor-pointer"
              disabled={pickupPending}
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={pickupPending}
              className="flex-[2] h-[48px] rounded-[20px] bg-gradient-to-br from-[#0B2E8C] to-[#1E4DB7] text-[#FFC107] font-black text-[14px] flex items-center justify-center gap-2 shadow-[0_8px_20px_rgba(11,46,140,0.3)] hover:shadow-[0_10px_24px_rgba(11,46,140,0.4)] active:scale-[0.98] transition-all cursor-pointer disabled:opacity-60"
            >
              <Zap className="w-4 h-4 fill-[#FFC107] text-[#FFC107]" />
              <span>{pickupPending ? "جارٍ الحفظ…" : "تأكيد الدفع"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function MandoubDeliveryModal({
  orderId,
  orderNumber,
  auth,
  nextUrl,
  advanceStatus,
  defaultAlf,
  deliveryAction,
  deliveryPending,
  onClose,
  missingCustomerLocation,
  onInstantOptimistic,
}: {
  orderId: string;
  orderNumber?: number;
  auth: { c: string; exp: string; s: string };
  nextUrl: string;
  advanceStatus: string;
  defaultAlf: string;
  deliveryAction: (formData: FormData) => void | Promise<void>;
  deliveryPending: boolean;
  onClose: () => void;
  missingCustomerLocation: boolean;
  onInstantOptimistic?: (amtAlf: string, note?: string, lat?: string | number, lng?: string | number, submitMode?: string) => void;
}) {
  const [amountAlf, setAmountAlf] = useState("");
  const [selectedBox, setSelectedBox] = useState<"num" | "zero" | null>(null);
  const [note, setNote] = useState("");
  const [locationModalOpen, setLocationModalOpen] = useState(false);
  const [geoError, setGeoError] = useState("");
  const formRef = useRef<HTMLFormElement>(null);
  const latRef = useRef<HTMLInputElement>(null);
  const lngRef = useRef<HTMLInputElement>(null);
  const locationPromptDoneRef = useRef(false);

  const isMismatch =
    amountAlf.trim() !== "" &&
    amountAlf.trim() !== defaultAlf &&
    amountAlf.trim() !== "0" &&
    selectedBox !== "zero";

  function submitAfterLocation(latVal?: string, lngVal?: string) {
    setLocationModalOpen(false);
    const amt = amountAlf.trim() !== "" ? amountAlf.trim() : (selectedBox === "zero" ? "0" : (defaultAlf || "0"));
    onInstantOptimistic?.(amt, note, latVal, lngVal, amt === "0" ? "statusOnlyNoAmount" : "");
  }

  function onConfirmGps() {
    setGeoError("");
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setGeoError("المتصفح لا يدعم تحديد الموقع.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        locationPromptDoneRef.current = true;
        submitAfterLocation(String(pos.coords.latitude), String(pos.coords.longitude));
      },
      () => {
        setGeoError("تعذّر قراءة موقعك. تأكد من تفعيل GPS والسماح للمتصفح بالموقع ثم أعد المحاولة.");
      },
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 },
    );
  }

  function onSkipLocation() {
    locationPromptDoneRef.current = true;
    submitAfterLocation();
  }

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center p-3 sm:p-4 bg-[#0A1840]/60 backdrop-blur-[6px] overflow-y-auto animate-in fade-in"
      onClick={onClose}
    >
      <div
        className="bg-white border-[2px] border-[#FFC107] rounded-[28px] shadow-[0_20px_60px_rgba(255,140,0,0.25)] p-[20px] relative overflow-hidden w-full max-w-[390px] text-right select-none my-auto animate-in zoom-in-95 duration-200"
        dir="rtl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* تدرج إضاءة علوي دافئ (حار) */}
        <div className="absolute top-0 inset-x-0 h-[84px] bg-gradient-to-b from-[#FFF8E1] to-transparent opacity-90 pointer-events-none" />

        {/* رأس النافذة الحارة */}
        <div className="relative flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-[10px] bg-[#FFF8E1] border border-[#FFECB3] flex items-center justify-center shrink-0">
              <Package className="w-[18px] h-[18px] text-[#FF8C00]" />
            </div>
            <h2 className="text-[#0B2E8C] font-black text-[15px] tracking-tight">
              تسجيل استلام {orderNumber ? `- طلب #${orderNumber}` : ""}
            </h2>
            <div className="h-6 w-6 rounded-full bg-gradient-to-br from-[#FFC107] to-[#FF8C00] flex items-center justify-center shadow-[0_2px_6px_rgba(255,140,0,0.4)] shrink-0">
              <Zap className="w-3 h-3 text-white fill-white" />
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="h-9 w-9 rounded-full bg-[#FFF8E1] border border-[#FFE082] flex items-center justify-center text-[#BF5D00] hover:bg-[#FFECB3] transition-colors cursor-pointer shrink-0"
            title="إغلاق"
          >
            <X className="w-4 h-4" strokeWidth={2.5} />
          </button>
        </div>

        <div className="mt-4 h-[1px] w-full bg-[#FFE082]/80" />

        <p className="mt-4 text-right text-[#5D4037] text-[13px] font-bold">
          المبلغ (ألف دينار):
        </p>

        {/* خيارا الاختيار السريع للنافذة الحارة */}
        <div className="mt-3 grid grid-cols-2 gap-3">
          {/* خيار لم أستلم */}
          <button
            type="button"
            onClick={() => {
              setAmountAlf("0");
              setSelectedBox("zero");
              if (missingCustomerLocation && !locationPromptDoneRef.current) {
                setGeoError("");
                setLocationModalOpen(true);
              } else {
                onInstantOptimistic?.("0", undefined, undefined, undefined, "statusOnlyNoAmount");
              }
            }}
            className={`relative h-[90px] rounded-[20px] flex flex-col items-center justify-center gap-1 transition-all border-[2px] cursor-pointer ${
              selectedBox === "zero"
                ? "bg-[#FFECB3] border-[#FF8C00] border-[3px] shadow-[0_4px_16px_rgba(255,140,0,0.2)] scale-[1.02]"
                : "bg-[#FFF8E1] border-[#FFE082] hover:border-[#FFC107]"
            }`}
          >
            {selectedBox === "zero" && (
              <div className="absolute top-2 left-2 h-5 w-5 rounded-full bg-[#FF8C00] flex items-center justify-center">
                <Check className="w-3 h-3 text-white" strokeWidth={3} />
              </div>
            )}
            <span className={`font-bold text-[16px] ${selectedBox === "zero" ? "text-[#BF5D00]" : "text-[#8D6E63]"}`}>
              لم أستلم
            </span>
            <span className="text-[11px] text-[#BF5D00]/60 font-medium">بعد</span>
          </button>

          {/* خيار المبلغ السريع */}
          <button
            type="button"
            onClick={() => {
              setAmountAlf(defaultAlf);
              setSelectedBox("num");
              if (missingCustomerLocation && !locationPromptDoneRef.current) {
                setGeoError("");
                setLocationModalOpen(true);
              } else {
                onInstantOptimistic?.(defaultAlf);
              }
            }}
            className={`relative h-[90px] rounded-[20px] flex items-center justify-center transition-all border-[2px] cursor-pointer ${
              selectedBox === "num"
                ? "bg-[#FFECB3] border-[#FF8C00] border-[3px] shadow-[0_4px_16px_rgba(255,140,0,0.2)] scale-[1.02]"
                : "bg-[#FFF8E1] border-[#FFE082] hover:border-[#FFC107]"
            }`}
          >
            {selectedBox === "num" && (
              <div className="absolute top-2 left-2 h-5 w-5 rounded-full bg-[#FF8C00] flex items-center justify-center">
                <Check className="w-3 h-3 text-white" strokeWidth={3} />
              </div>
            )}
            <span className="text-[#BF5D00] font-black text-[36px] leading-none">
              {defaultAlf || "0"}
            </span>
          </button>
        </div>

        <form
          ref={formRef}
          action={deliveryAction}
          className="mt-4 space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (missingCustomerLocation && !locationPromptDoneRef.current) {
              setGeoError("");
              setLocationModalOpen(true);
            } else {
              const val = amountAlf.trim() !== "" ? amountAlf.trim() : (selectedBox === "zero" ? "0" : (defaultAlf || "0"));
              onInstantOptimistic?.(val, note, latRef.current?.value, lngRef.current?.value, val === "0" ? "statusOnlyNoAmount" : "");
            }
          }}
        >
          <input type="hidden" name="c" value={auth.c} />
          <input type="hidden" name="exp" value={auth.exp} />
          <input type="hidden" name="s" value={auth.s} />
          <input type="hidden" name="orderId" value={orderId} />
          <input type="hidden" name="next" value={nextUrl} />
          <input type="hidden" name="advanceStatus" value={advanceStatus} />
          <input type="hidden" name="mandoubMoneySubmitMode" value="" />
          <input ref={latRef} type="hidden" name="lat" value="" />
          <input ref={lngRef} type="hidden" name="lng" value="" />

          {/* خانة كتابة السعر الحارة: فارغة تماماً بالبداية */}
          <div className="relative">
            <input
              name="amountAlf"
              inputMode="numeric"
              value={amountAlf}
              onChange={(e) => {
                const v = e.target.value.replace(/[^0-9]/g, "");
                setAmountAlf(v);
                if (v === defaultAlf && defaultAlf !== "" && defaultAlf !== "0") setSelectedBox("num");
                else if (v === "0") setSelectedBox("zero");
                else setSelectedBox(null);
              }}
              placeholder={defaultAlf || "0"}
              className="w-full h-[52px] bg-white border-[2px] border-[#FF8C00] rounded-[20px] text-center text-[#BF5D00] font-black text-[20px] placeholder:text-[#BF5D00]/20 focus:outline-none focus:border-[#FF6F00] focus:ring-4 focus:ring-[#FFF8E1] transition-all"
            />
            <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[11px] font-bold text-[#FF8C00] bg-[#FFF8E1] px-2 py-1 rounded-full border border-[#FFE082]">
              ألف د.ع
            </span>
          </div>

          {/* حقل سبب اختلاف المبلغ إن وجد */}
          {isMismatch ? (
            <div className="space-y-1.5 animate-in fade-in duration-200">
              <div className="text-right">
                <span className="text-[12px] font-bold text-[#BF5D00]">
                  سبب اختلاف الوارد <span className="text-rose-600">*</span>
                </span>
              </div>
              <textarea
                name="mismatchNote"
                required
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
                className="w-full min-h-[70px] rounded-[16px] border-[1.5px] border-[#FFE082] bg-[#FFF8E1] px-3 py-2 text-[12px] text-right text-[#5D4037] placeholder:text-[#BF5D00]/40 focus:outline-none focus:border-[#FF8C00] focus:ring-2 focus:ring-[#FFF8E1] resize-none font-medium"
                placeholder="اكتب سبب اختلاف المبلغ عن المطلوب..."
              />
            </div>
          ) : (
            <input type="hidden" name="mismatchNote" value="" />
          )}

          <div className="h-[1px] w-full bg-[#FFE082]/60 my-2" />

          {/* أزرار الإجراء */}
          <div className="flex gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 h-[48px] rounded-[20px] bg-[#FFF8E1] border border-[#FFE082] text-[#5D4037] font-bold text-[13px] hover:bg-[#FFECB3] active:scale-[0.98] transition-all cursor-pointer"
              disabled={deliveryPending}
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={deliveryPending}
              className="flex-[2] h-[48px] rounded-[20px] bg-gradient-to-br from-[#FFC107] to-[#FF8C00] text-[#0B2E8C] font-black text-[14px] flex items-center justify-center gap-2 shadow-[0_8px_20px_rgba(255,140,0,0.35)] hover:shadow-[0_10px_24px_rgba(255,140,0,0.45)] active:scale-[0.98] transition-all cursor-pointer disabled:opacity-60"
            >
              <Package className="w-4 h-4 text-[#0B2E8C]" />
              <span>{deliveryPending ? "جارٍ الحفظ…" : "تأكيد الاستلام"}</span>
            </button>
          </div>
        </form>

        {/* نافذة رفع الموقع GPS */}
        {locationModalOpen ? (
          <div
            className="fixed inset-0 z-[140] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
            role="dialog"
            aria-modal="true"
          >
            <div className="max-w-md rounded-2xl border-2 border-[#FFC107] bg-[#0A1840] p-5 shadow-2xl text-[#FFF8F0] text-right">
              <p className="text-base font-black leading-relaxed text-[#FFC107]">
                هذا الطلب لا يحتوي على موقع للزبون
              </p>
              <p className="mt-3 text-sm leading-relaxed text-[#FFF8F0]/85">
                أتممت تسليم الطلب الآن؟ هل تريد رفع <strong className="text-[#FFC107]">موقعك الحالي</strong> (حيث أنت الآن) على أنه موقع الزبون؟
              </p>
              {geoError ? (
                <p className="mt-3 text-sm font-bold text-rose-300">{geoError}</p>
              ) : null}
              <div className="mt-5 flex flex-col gap-2.5">
                <button
                  type="button"
                  onClick={onConfirmGps}
                  disabled={deliveryPending}
                  className="rounded-xl bg-gradient-to-r from-[#FFC107] via-[#FFA000] to-[#FF8C00] px-4 py-3 text-sm font-black text-[#0B2E8C] shadow-lg hover:brightness-110 active:scale-95 transition-all disabled:opacity-60 cursor-pointer"
                >
                  ✓ نعم، ارفع موقعي الحالي
                </button>
                <button
                  type="button"
                  onClick={onSkipLocation}
                  disabled={deliveryPending}
                  className="rounded-xl border-2 border-[#FFC107]/40 bg-white/10 px-4 py-3 text-sm font-black text-[#FFC107] shadow-sm transition hover:bg-white/20 active:scale-95 disabled:opacity-60 cursor-pointer"
                >
                  ✕ لا، لا ترفع موقعي
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setLocationModalOpen(false);
                    setGeoError("");
                  }}
                  className="mt-2 text-center text-sm font-bold text-[#FFC107] hover:underline cursor-pointer"
                  disabled={deliveryPending}
                >
                  إلغاء والرجوع
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}


/* مكونات المربعات التفاعلية الفاخرة المطابقة للتصميم الملكي */
function MandoubAmountSquareBtn({
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
  const textColor = selected ? "#38BDF8" : isEmerald ? "#0A3D2A" : "#8B2E1A";

  return (
    <button
      type="button"
      onClick={onClick}
      className={`
        w-[120px] h-[120px] min-w-[120px] min-h-[120px]
        rounded-[18px] border-[2.5px] flex items-center justify-center
        text-[48px] font-black leading-none tracking-tight
        transition-all duration-200 active:scale-[0.97]
        select-none cursor-pointer
        ${selected ? "shadow-[0_0_0_3px_#38BDF844,0_8px_20px_rgba(0,0,0,0.15)] scale-[1.02]" : "shadow-[0_4px_14px_rgba(0,0,0,0.08)] hover:shadow-[0_6px_18px_rgba(0,0,0,0.12)]"}
      `}
      style={{
        backgroundColor: selected ? activeBg : inactiveBg,
        borderColor: "#38BDF8",
        color: textColor,
      }}
    >
      <span style={{ fontSize: "48px", fontWeight: "900", lineHeight: "1" }}>
        {value}
      </span>
    </button>
  );
}

function MandoubZeroSquareBtn({
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
  const textColor = selected ? "#38BDF8" : "#0A3D2A";

  return (
    <button
      type="button"
      onClick={onClick}
      className={`
        w-[120px] h-[120px] min-w-[120px] min-h-[120px]
        rounded-[18px] border-[2.5px] flex flex-col items-center justify-center
        transition-all duration-200 active:scale-[0.97]
        select-none cursor-pointer
        ${selected ? "shadow-[0_0_0_3px_#38BDF844,0_8px_20px_rgba(0,0,0,0.15)] scale-[1.02]" : "shadow-[0_4px_14px_rgba(0,0,0,0.06)] hover:shadow-[0_6px_18px_rgba(0,0,0,0.10)]"}
      `}
      style={{
        backgroundColor: selected ? activeBg : "#E8E0D0",
        borderColor: "#38BDF8",
        color: textColor,
      }}
    >
      <span
        className={`font-black leading-none ${selected ? "text-[48px]" : "text-[22px]"}`}
        style={{ fontSize: selected ? "48px" : "22px", fontWeight: "900", lineHeight: "1" }}
      >
        {selected ? activeLabel : label}
      </span>
      {selected && (
        <span className="text-[11px] font-bold mt-1 tracking-wide opacity-70" style={{ color: "#38BDF8" }}>
          {label}
        </span>
      )}
    </button>
  );
}

export function PickupMoneyForm({
  orderId,
  orderShortId,
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
  onInstantOptimistic,
}: {
  orderId: string;
  orderShortId?: string | number;
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
  onInstantOptimistic?: (amtAlf: string, note?: string, submitMode?: string) => void;
}) {
  const targetValue = remainingAlfHint || expectedAlfHint || "";
  const [amount, setAmount] = useState("");
  const [selectedBox, setSelectedBox] = useState<"num" | "zero" | null>(null);
  const [note, setNote] = useState("");
  const amountRef = useRef<HTMLInputElement>(null);
  const noteRef = useRef<HTMLTextAreaElement>(null);
  const pickupSubmitModeRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    setAmount("");
    setSelectedBox(null);
  }, [remainingAlfHint, expectedAlfHint, orderId]);

  const effectiveValue = amount.trim() !== "" ? amount.trim() : (selectedBox === "zero" ? "0" : (targetValue || "0"));
  const isMismatch = amount.trim() !== "" && amount.trim() !== targetValue && amount.trim() !== "0" && selectedBox !== "zero";

  const triggerDirect = (val: string, customNote?: string, submitMode?: string) => {
    if (onInstantOptimistic) {
      onInstantOptimistic(val, customNote || note, submitMode);
    }
    // إرسال مباشر بالخلفية لضمان الحفظ 100% في سوبابيس
    void fetch("/api/mandoub/record-money", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "pickup",
        orderId,
        c: auth.c,
        exp: auth.exp,
        s: auth.s,
        amountAlf: val,
        mismatchNote: customNote || note,
        advanceStatus: advanceToDelivering ? "delivering" : "",
        submitMode: submitMode || (val === "0" ? "statusOnlyNoAmount" : ""),
      }),
    }).catch((err) => console.error("Pickup background error:", err));
  };

  return (
    <div
      className="bg-white border-[2px] border-[#0B2E8C] rounded-[28px] shadow-[0_20px_60px_rgba(11,46,140,0.3)] p-[20px] relative overflow-hidden select-none text-right"
      dir="rtl"
    >
      {/* تدرج إضاءة علوي أزرق ناعم */}
      <div className="absolute top-0 inset-x-0 h-[84px] bg-gradient-to-b from-[#E8EEFF] to-transparent opacity-70 pointer-events-none" />

      {/* رأس النافذة */}
      <div className="relative flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-[10px] bg-[#E8EEFF] border border-[#D0DDFB] flex items-center justify-center shrink-0">
            <Banknote className="w-[18px] h-[18px] text-[#0B2E8C]" />
          </div>
          <h2 className="text-[#0B2E8C] font-black text-[15px] tracking-tight">
            تسجيل دفع {orderShortId ? `- طلب #${orderShortId}` : ""}
          </h2>
          <div className="h-6 w-6 rounded-full bg-[#FFC107] flex items-center justify-center shadow-[0_2px_6px_rgba(255,193,7,0.4)] shrink-0">
            <Zap className="w-3 h-3 text-[#0B2E8C] fill-[#0B2E8C]" />
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="h-9 w-9 rounded-full bg-[#F0F4FF] border border-[#D0DDFB] flex items-center justify-center text-[#0B2E8C] hover:bg-[#E8EEFF] transition-colors cursor-pointer shrink-0"
          title="إغلاق"
        >
          <X className="w-4 h-4" strokeWidth={2.5} />
        </button>
      </div>

      <div className="mt-4 h-[1px] w-full bg-[#D0DDFB]/80" />

      {error ? (
        <div className="mt-3 rounded-xl border border-rose-400 bg-rose-50 p-2 text-xs font-bold text-rose-900 text-center">
          {error}
        </div>
      ) : null}

      <p className="mt-4 text-right text-[#0B2E8C] text-[13px] font-bold">
        المبلغ (ألف دينار):
      </p>

      {/* خيارا الاختيار السريع لثيم وصلي */}
      <div className="mt-3 grid grid-cols-2 gap-3">
        {/* خيار لم أدفع */}
        <button
          type="button"
          onClick={() => {
            setAmount("0");
            setSelectedBox("zero");
            if (pickupSubmitModeRef.current) {
              pickupSubmitModeRef.current.value = "statusOnlyNoAmount";
            }
            if (amountRef.current) {
              amountRef.current.value = "0";
            }
            triggerDirect("0", undefined, "statusOnlyNoAmount");
          }}
          className={`relative h-[90px] rounded-[20px] flex flex-col items-center justify-center gap-1 transition-all border-[2px] cursor-pointer ${
            selectedBox === "zero"
              ? "bg-[#E8EEFF] border-[#0B2E8C] border-[3px] shadow-[0_4px_16px_rgba(11,46,140,0.15)] scale-[1.02]"
              : "bg-[#F8FAFF] border-[#D0DDFB] hover:border-[#0B2E8C]/40"
          }`}
        >
          {selectedBox === "zero" && (
            <div className="absolute top-2 left-2 h-5 w-5 rounded-full bg-[#0B2E8C] flex items-center justify-center">
              <Check className="w-3 h-3 text-white" strokeWidth={3} />
            </div>
          )}
          <span className={`font-bold text-[16px] ${selectedBox === "zero" ? "text-[#0B2E8C]" : "text-[#0B2E8C]/70"}`}>
            لم أدفع
          </span>
          <span className="text-[11px] text-[#0B2E8C]/40 font-medium">بعد</span>
        </button>

        {/* خيار المبلغ السريع */}
        <button
          type="button"
          onClick={() => {
            setAmount(targetValue);
            setSelectedBox("num");
            if (pickupSubmitModeRef.current) pickupSubmitModeRef.current.value = "";
            if (amountRef.current) amountRef.current.value = targetValue;
            triggerDirect(targetValue);
          }}
          className={`relative h-[90px] rounded-[20px] flex items-center justify-center transition-all border-[2px] cursor-pointer ${
            selectedBox === "num"
              ? "bg-[#E8EEFF] border-[#0B2E8C] border-[3px] shadow-[0_4px_16px_rgba(11,46,140,0.15)] scale-[1.02]"
              : "bg-[#F8FAFF] border-[#D0DDFB] hover:border-[#0B2E8C]/40"
          }`}
        >
          {selectedBox === "num" && (
            <div className="absolute top-2 left-2 h-5 w-5 rounded-full bg-[#0B2E8C] flex items-center justify-center">
              <Check className="w-3 h-3 text-white" strokeWidth={3} />
            </div>
          )}
          <span className="text-[#0B2E8C] font-black text-[36px] leading-none">
            {targetValue || "0"}
          </span>
        </button>
      </div>

      <form
        ref={formRef}
        action={formAction}
        className="mt-4 space-y-4"
        onSubmit={(e) => {
          if (onInstantOptimistic) {
            e.preventDefault();
            const val = amount.trim() !== "" ? amount.trim() : (selectedBox === "zero" ? "0" : (targetValue || "0"));
            triggerDirect(val, noteRef.current?.value || note, val === "0" ? "statusOnlyNoAmount" : "");
          } else {
            if (amountRef.current && !amountRef.current.value.trim() && selectedBox !== "zero") {
              amountRef.current.value = targetValue || "0";
            }
          }
        }}
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
        <input type="hidden" name="mismatchReason" value="" />

        {/* خانة كتابة السعر: تبقى فارغة بدون أي كتابة مسبقة إلا إذا أراد المندوب الكتابة فيها */}
        <div className="relative">
          <input
            ref={amountRef}
            name="amountAlf"
            inputMode="numeric"
            value={amount}
            onChange={(e) => {
              const v = e.target.value.replace(/[^0-9]/g, "");
              setAmount(v);
              if (v === targetValue && targetValue !== "" && targetValue !== "0") setSelectedBox("num");
              else if (v === "0") setSelectedBox("zero");
              else setSelectedBox(null);
            }}
            placeholder={targetValue || "0"}
            className="w-full h-[52px] bg-white border-[2px] border-[#4AA3FF] rounded-[20px] text-center text-[#0B2E8C] font-black text-[20px] placeholder:text-[#0B2E8C]/20 focus:outline-none focus:border-[#0B2E8C] focus:ring-4 focus:ring-[#E8EEFF] transition-all"
          />
          <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[11px] font-bold text-[#4AA3FF] bg-[#F0F4FF] px-2 py-1 rounded-full border border-[#D0DDFB]">
            ألف د.ع
          </span>
        </div>

        {/* حقل سبب اختلاف المبلغ إن كتب المندوب سعراً مختلفاً */}
        {isMismatch ? (
          <div className="space-y-1.5 animate-in fade-in duration-200">
            <div className="text-right">
              <span className="text-[12px] font-bold text-[#0B2E8C]">
                سبب اختلاف الصادر <span className="text-rose-600">*</span>
              </span>
            </div>
            <textarea
              ref={noteRef}
              name="mismatchNote"
              required
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              className="w-full min-h-[70px] rounded-[16px] border-[1.5px] border-[#D0DDFB] bg-[#F8FAFF] px-3 py-2 text-[12px] text-right text-[#0B2E8C] placeholder:text-[#0B2E8C]/40 focus:outline-none focus:border-[#0B2E8C] focus:ring-2 focus:ring-[#E8EEFF] resize-none font-medium"
              placeholder="اكتب سبب اختلاف المبلغ عن المطلوب..."
            />
          </div>
        ) : (
          <input type="hidden" name="mismatchNote" value="" />
        )}

        <div className="h-[1px] w-full bg-[#D0DDFB]/60 my-2" />

        {/* أزرار الإجراء */}
        <div className="flex gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 h-[48px] rounded-[20px] bg-[#F0F4FF] border border-[#D0DDFB] text-[#0B2E8C] font-bold text-[13px] hover:bg-[#E8EEFF] active:scale-[0.98] transition-all cursor-pointer"
            disabled={pending}
          >
            إلغاء
          </button>
          <button
            type="submit"
            disabled={pending}
            className="flex-[2] h-[48px] rounded-[20px] bg-gradient-to-br from-[#0B2E8C] to-[#1E4DB7] text-[#FFC107] font-black text-[14px] flex items-center justify-center gap-2 shadow-[0_8px_20px_rgba(11,46,140,0.3)] hover:shadow-[0_10px_24px_rgba(11,46,140,0.4)] active:scale-[0.98] transition-all cursor-pointer disabled:opacity-60"
          >
            <Zap className="w-4 h-4 fill-[#FFC107] text-[#FFC107]" />
            <span>{pending ? "جارٍ الحفظ…" : "تأكيد الدفع"}</span>
          </button>
        </div>
      </form>
    </div>
  );
}

export function DeliveryMoneyForm({
  orderId,
  orderShortId,
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
  onInstantOptimistic,
}: {
  orderId: string;
  orderShortId?: string | number;
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
  onInstantOptimistic?: (amtAlf: string, note?: string, lat?: string | number, lng?: string | number, submitMode?: string) => void;
}) {
  const targetValue = remainingAlfHint || expectedAlfHint || "";
  const [amount, setAmount] = useState("");
  const [selectedBox, setSelectedBox] = useState<"num" | "zero" | null>(null);
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

  const [prepaidConfirmState, setPrepaidConfirmState] = useState<"ask" | "took_money" | null>(
    prepaidAll && advanceToDelivered ? "ask" : null
  );

  useEffect(() => {
    setAmount("");
    setSelectedBox(null);
  }, [remainingAlfHint, expectedAlfHint, orderId]);

  useEffect(() => {
    setPortalReady(true);
  }, []);

  const isMismatch = (amount.trim() !== "" && amount.trim() !== targetValue && amount.trim() !== "0" && selectedBox !== "zero") || prepaidConfirmState === "took_money";

  const triggerDirect = (val: string, customNote?: string, latVal?: string | number, lngVal?: string | number, submitMode?: string) => {
    if (onInstantOptimistic) {
      onInstantOptimistic(val, customNote || note, latVal, lngVal, submitMode);
    }
    // إرسال مباشر بالخلفية لضمان الحفظ 100% في سوبابيس
    void fetch("/api/mandoub/record-money", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "delivery",
        orderId,
        c: auth.c,
        exp: auth.exp,
        s: auth.s,
        amountAlf: val,
        mismatchNote: customNote || note,
        advanceStatus: advanceToDelivered ? "delivered" : "",
        submitMode: submitMode || (val === "0" ? "statusOnlyNoAmount" : ""),
        lat: latVal,
        lng: lngVal,
      }),
    }).catch((err) => console.error("Delivery background error:", err));
  };

  function submitDeliveryAfterLocationChoice(latVal?: string, lngVal?: string) {
    const isSkip = pendingAfterLocationRef.current === "skip";
    const amt = isSkip ? "0" : (amount.trim() !== "" ? amount.trim() : (selectedBox === "zero" ? "0" : (targetValue || "0")));
    triggerDirect(amt, note, latVal, lngVal, isSkip ? "statusOnlyNoAmount" : "");
  }

  function onConfirmGps() {
    setGeoError("");
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setGeoError("المتصفح لا يدعم تحديد الموقع.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        locationPromptDoneRef.current = true;
        setLocationModalOpen(false);
        submitDeliveryAfterLocationChoice(String(pos.coords.latitude), String(pos.coords.longitude));
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
    locationPromptDoneRef.current = true;
    setLocationModalOpen(false);
    submitDeliveryAfterLocationChoice();
  }

  return (
    <div
      className="bg-white border-[2px] border-[#FFC107] rounded-[28px] shadow-[0_20px_60px_rgba(255,140,0,0.25)] p-[20px] relative overflow-hidden select-none text-right"
      dir="rtl"
    >
      {/* تدرج إضاءة علوي دافئ (حار) */}
      <div className="absolute top-0 inset-x-0 h-[84px] bg-gradient-to-b from-[#FFF8E1] to-transparent opacity-90 pointer-events-none" />

      {/* رأس النافذة الحارة */}
      <div className="relative flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-[10px] bg-[#FFF8E1] border border-[#FFECB3] flex items-center justify-center shrink-0">
            <Package className="w-[18px] h-[18px] text-[#FF8C00]" />
          </div>
          <h2 className="text-[#0B2E8C] font-black text-[15px] tracking-tight">
            تسجيل استلام {orderShortId ? `- طلب #${orderShortId}` : ""}
          </h2>
          <div className="h-6 w-6 rounded-full bg-gradient-to-br from-[#FFC107] to-[#FF8C00] flex items-center justify-center shadow-[0_2px_6px_rgba(255,140,0,0.4)] shrink-0">
            <Zap className="w-3 h-3 text-white fill-white" />
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="h-9 w-9 rounded-full bg-[#FFF8E1] border border-[#FFE082] flex items-center justify-center text-[#BF5D00] hover:bg-[#FFECB3] transition-colors cursor-pointer shrink-0"
          title="إغلاق"
        >
          <X className="w-4 h-4" strokeWidth={2.5} />
        </button>
      </div>

      <div className="mt-4 h-[1px] w-full bg-[#FFE082]/80" />

      {error ? (
        <div className="mt-3 rounded-xl border border-rose-400 bg-rose-50 p-2 text-xs font-bold text-rose-900 text-center">
          {error}
        </div>
      ) : null}

      <p className="mt-4 text-right text-[#5D4037] text-[13px] font-bold">
        المبلغ (ألف دينار):
      </p>

      {/* خيارا الاختيار السريع للنافذة الحارة */}
      <div className="mt-3 grid grid-cols-2 gap-3">
        {/* زر لم أستلم */}
        <button
          type="button"
          onClick={() => {
            setAmount("0");
            setSelectedBox("zero");
            if (missingCustomerLocation && !locationPromptDoneRef.current) {
              setGeoError("");
              setLocationModalOpen(true);
            } else {
              triggerDirect("0", undefined, undefined, undefined, "statusOnlyNoAmount");
            }
          }}
          className={`relative h-[90px] rounded-[20px] flex flex-col items-center justify-center gap-1 transition-all border-[2px] cursor-pointer ${
            selectedBox === "zero"
              ? "bg-[#FFECB3] border-[#FF8C00] border-[3px] shadow-[0_4px_16px_rgba(255,140,0,0.2)] scale-[1.02]"
              : "bg-[#FFF8E1] border-[#FFE082] hover:border-[#FFC107]"
          }`}
        >
          {selectedBox === "zero" && (
            <div className="absolute top-2 left-2 h-5 w-5 rounded-full bg-[#FF8C00] flex items-center justify-center">
              <Check className="w-3 h-3 text-white" strokeWidth={3} />
            </div>
          )}
          <span className={`font-bold text-[16px] ${selectedBox === "zero" ? "text-[#BF5D00]" : "text-[#8D6E63]"}`}>
            لم أستلم
          </span>
          <span className="text-[11px] text-[#BF5D00]/60 font-medium">بعد</span>
        </button>

        {/* زر المبلغ السريع */}
        <button
          type="button"
          onClick={() => {
            setAmount(targetValue);
            setSelectedBox("num");
            if (missingCustomerLocation && !locationPromptDoneRef.current) {
              setGeoError("");
              setLocationModalOpen(true);
            } else {
              triggerDirect(targetValue);
            }
          }}
          className={`relative h-[90px] rounded-[20px] flex items-center justify-center transition-all border-[2px] cursor-pointer ${
            selectedBox === "num"
              ? "bg-[#FFECB3] border-[#FF8C00] border-[3px] shadow-[0_4px_16px_rgba(255,140,0,0.2)] scale-[1.02]"
              : "bg-[#FFF8E1] border-[#FFE082] hover:border-[#FFC107]"
          }`}
        >
          {selectedBox === "num" && (
            <div className="absolute top-2 left-2 h-5 w-5 rounded-full bg-[#FF8C00] flex items-center justify-center">
              <Check className="w-3 h-3 text-white" strokeWidth={3} />
            </div>
          )}
          <span className="text-[#BF5D00] font-black text-[36px] leading-none">
            {targetValue || "0"}
          </span>
        </button>
      </div>

      <form
        ref={formRef}
        action={formAction}
        className="mt-4 space-y-4"
        onSubmit={(e) => {
          const sub = (e.nativeEvent as SubmitEvent)?.submitter as HTMLButtonElement | null;
          pendingAfterLocationRef.current =
            sub?.dataset?.mandoubAction === "skip-no-amount" ? "skip" : "main";
          if (missingCustomerLocation && !locationPromptDoneRef.current) {
            e.preventDefault();
            setGeoError("");
            setLocationModalOpen(true);
          } else if (onInstantOptimistic) {
            e.preventDefault();
            const val = amount.trim() !== "" ? amount.trim() : (selectedBox === "zero" ? "0" : (targetValue || "0"));
            triggerDirect(val, noteRef.current?.value || note, latRef.current?.value, lngRef.current?.value, val === "0" ? "statusOnlyNoAmount" : "");
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

        {/* خانة كتابة السعر الحارة: فارغة تماماً بالبداية ولا يُكتب فيها إلا إذا كتب المندوب */}
        <div className="relative">
          <input
            ref={amountRef}
            name="amountAlf"
            inputMode="numeric"
            value={amount}
            onChange={(e) => {
              const v = e.target.value.replace(/[^0-9]/g, "");
              setAmount(v);
              if (v === targetValue && targetValue !== "" && targetValue !== "0") setSelectedBox("num");
              else if (v === "0") setSelectedBox("zero");
              else setSelectedBox(null);
            }}
            placeholder={targetValue || "0"}
            className="w-full h-[52px] bg-white border-[2px] border-[#FF8C00] rounded-[20px] text-center text-[#BF5D00] font-black text-[20px] placeholder:text-[#BF5D00]/20 focus:outline-none focus:border-[#FF6F00] focus:ring-4 focus:ring-[#FFF8E1] transition-all"
          />
          <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[11px] font-bold text-[#FF8C00] bg-[#FFF8E1] px-2 py-1 rounded-full border border-[#FFE082]">
            ألف د.ع
          </span>
        </div>

        {/* حقل سبب اختلاف المبلغ إن كتب المندوب سعراً مختلفاً */}
        {isMismatch ? (
          <div className="space-y-1.5 animate-in fade-in duration-200">
            <div className="text-right">
              <span className="text-[12px] font-bold text-[#BF5D00]">
                سبب اختلاف الوارد <span className="text-rose-600">*</span>
              </span>
            </div>
            <textarea
              ref={noteRef}
              name="mismatchNote"
              required
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              className="w-full min-h-[70px] rounded-[16px] border-[1.5px] border-[#FFE082] bg-[#FFF8E1] px-3 py-2 text-[12px] text-right text-[#5D4037] placeholder:text-[#BF5D00]/40 focus:outline-none focus:border-[#FF8C00] focus:ring-2 focus:ring-[#FFF8E1] resize-none font-medium"
              placeholder="اكتب سبب اختلاف المبلغ عن المطلوب..."
            />
          </div>
        ) : (
          <input type="hidden" name="mismatchNote" value="" />
        )}

        <div className="h-[1px] w-full bg-[#FFE082]/60 my-2" />

        {/* أزرار الإجراء */}
        <div className="flex gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 h-[48px] rounded-[20px] bg-[#FFF8E1] border border-[#FFE082] text-[#5D4037] font-bold text-[13px] hover:bg-[#FFECB3] active:scale-[0.98] transition-all cursor-pointer"
            disabled={pending}
          >
            إلغاء
          </button>
          <button
            ref={mainSubmitRef}
            type="submit"
            disabled={pending}
            className="flex-[2] h-[48px] rounded-[20px] bg-gradient-to-br from-[#FFC107] to-[#FF8C00] text-[#0B2E8C] font-black text-[14px] flex items-center justify-center gap-2 shadow-[0_8px_20px_rgba(255,140,0,0.35)] hover:shadow-[0_10px_24px_rgba(255,140,0,0.45)] active:scale-[0.98] transition-all cursor-pointer disabled:opacity-60"
          >
            <Package className="w-4 h-4 text-[#0B2E8C]" />
            <span>{pending ? "جارٍ الحفظ…" : "تأكيد الاستلام"}</span>
          </button>
        </div>
      </form>

      {/* نافذة رفع الموقع GPS المنبثقة إن لم يكن للزبون موقع */}
      {portalReady && locationModalOpen && typeof document !== "undefined"
        ? createPortal(
            <div
              className="fixed inset-0 z-[140] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
              role="dialog"
              aria-modal="true"
            >
              <div className="max-w-md rounded-2xl border-2 border-[#38BDF8] bg-[#06281D] p-5 shadow-2xl text-[#FFF8F0] text-right">
                <p className="text-base font-black leading-relaxed text-[#FDE047]">
                  هذا الطلب لا يحتوي على موقع للزبون
                </p>
                <p className="mt-3 text-sm leading-relaxed text-[#FFF8F0]/85">
                  أتممت تسليم الطلب الآن؟ هل تريد رفع <strong className="text-[#FDE047]">موقعك الحالي</strong> (حيث أنت الآن) على أنه موقع الزبون؟
                </p>
                {geoError ? (
                  <p className="mt-3 text-sm font-bold text-rose-300">{geoError}</p>
                ) : null}
                <div className="mt-5 flex flex-col gap-2.5">
                  <button
                    type="button"
                    onClick={onConfirmGps}
                    disabled={pending}
                    className="rounded-xl bg-gradient-to-r from-[#FDE047] via-[#E5C158] to-[#38BDF8] px-4 py-3 text-sm font-black text-[#06281D] shadow-lg hover:brightness-110 active:scale-95 transition-all disabled:opacity-60 cursor-pointer"
                  >
                    ✓ نعم، ارفع موقعي الحالي
                  </button>
                  <button
                    type="button"
                    onClick={onSkipLocation}
                    disabled={pending}
                    className="rounded-xl border-2 border-[#38BDF8] bg-[#0F4D3A] px-4 py-3 text-sm font-black text-[#FDE047] shadow-sm transition hover:bg-[#165B45] active:scale-95 disabled:opacity-60 cursor-pointer"
                  >
                    ✕ لا، لا ترفع موقعي
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setLocationModalOpen(false);
                      setGeoError("");
                    }}
                    className="mt-2 text-center text-sm font-bold text-[#38BDF8] hover:underline cursor-pointer"
                    disabled={pending}
                  >
                    إلغاء والرجوع
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

