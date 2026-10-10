"use client";

import { useActionState, useEffect, useMemo, useState, useRef } from "react";
import { useRouter } from "next/navigation";
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
} from "@/lib/money-alf";
import { MONEY_KIND_DELIVERY, MONEY_KIND_PICKUP } from "@/lib/mandoub-money-events";
import { formatBaghdadMoneyRecordedAt } from "@/lib/baghdad-time";
import { LuxuryReverseOrderButton } from "@/components/luxury-reverse-order-button";

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

  // الاستماع لحدث النقر من الزر العائم للاستلام والتسليم في الإدارة
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

    window.addEventListener("OPEN_ADMIN_PICKUP_MODAL", handlePickupEvent);
    window.addEventListener("OPEN_ADMIN_DELIVERY_MODAL", handleDeliveryEvent);
    return () => {
      window.removeEventListener("OPEN_ADMIN_PICKUP_MODAL", handlePickupEvent);
      window.removeEventListener("OPEN_ADMIN_DELIVERY_MODAL", handleDeliveryEvent);
    };
  }, [orderId]);

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

  const isDelivered = orderStatus === "delivered";

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

      {/* كارت المعاملات المالية بهوية وصلي الرسمية */}
      <div className="relative rounded-[24px] border-[1.5px] border-[#D0DDFB] bg-white shadow-[0_4px_20px_rgba(11,46,140,0.06)] overflow-hidden">
        {/* هيدر الكارت بهوية وصلي */}
        <div className="flex items-center justify-between bg-[#F8FAFF] px-4 py-3 border-b border-[#D0DDFB]/50">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#FFC107] text-base text-[#0B2E8C] shadow-xs">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="6" x2="12" y2="18" />
                <path d="M15 9H10.5a2 2 0 0 0 0 4h3a2 2 0 0 1 0 4H9" />
              </svg>
            </span>
            <h3 className="text-[14px] font-extrabold text-[#0B2E8C]">المعاملات المالية</h3>
          </div>
          <div className="flex items-center gap-1.5 rounded-full bg-[#E8EEFF] px-2.5 py-1">
            <span className="h-1.5 w-1.5 rounded-full bg-[#1E4DB7]" />
            <span className="text-[10px] font-bold text-[#0B2E8C]">الإدارة</span>
          </div>
        </div>

        <div className="relative p-4 space-y-4">
          {/* زري استلام وتسليم بهوية وصلي مع عرض المبالغ المالية */}
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
          {events.length === 0 ? (
            <p className="text-center text-[#8B6A2A]/70 py-4 bg-[#FDF6E3]/60 rounded-xl border border-[#C9A86A]/25 text-xs font-bold">
              لا توجد معاملات نقد مسجّلة لهذا الطلب بعد.
            </p>
          ) : (
            <div className="space-y-2.5">
              {events.map((ev) => {
                const isSader = ev.kind === MONEY_KIND_PICKUP;
                const timeInfo = formatBaghdadMoneyRecordedAt(ev.recordedAt);
                const noteText = [ev.mismatchReason, ev.mismatchNote].filter(Boolean).join(" - ");

                return (
                  <div
                    key={ev.id}
                    className="relative rounded-[14px] bg-[#FFFEF8] border-[1.5px] border-[#C9A86A]/40 shadow-[0_2px_8px_rgba(201,168,106,0.08),inset_0_1px_0_white] p-2.5 overflow-hidden"
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
                              {ev.performedByDisplayName || "الإدارة"}
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

                      {/* زر الحذف الوردي الصغير كما في الصورة */}
                      <form action={softAction}>
                        <input type="hidden" name="eventId" value={ev.id} />
                        <input type="hidden" name="nextPath" value={nextPath} />
                        <button
                          type="submit"
                          disabled={softPending}
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
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* --- مودال تسجيل الصادر (أعطيت) --- */}
      {pickupOpen && orderId && (
        <AdminPickupModal
          orderId={orderId}
          nextPath={nextPath}
          advanceStatus={pickupAdvanceToDelivering || orderStatus === "assigned" || orderStatus === "pending" ? "delivering" : ""}
          defaultAlf={orderSubtotalDinar ? dinarDecimalToAlfInputString(orderSubtotalDinar) : ""}
          pickupAction={pickupAction}
          pickupPending={pickupPending}
          onClose={closePanels}
        />
      )}

      {/* --- مودال تسجيل الوارد (أخذت) --- */}
      {deliveryOpen && orderId && (
        <AdminDeliveryModal
          orderId={orderId}
          nextPath={nextPath}
          advanceStatus={deliveryAdvanceToDelivered || orderStatus === "delivering" || orderStatus === "assigned" ? "delivered" : ""}
          defaultAlf={totalAmountDinar ? dinarDecimalToAlfInputString(totalAmountDinar) : ""}
          deliveryAction={deliveryAction}
          deliveryPending={deliveryPending}
          onClose={closePanels}
        />
      )}
    </div>
  );
}

/* مكونات المربعات التفاعلية بهوية وصلي الرسمية */
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
  const isSader = color === "emerald";
  const activeBg = isSader ? "#0B2E8C" : "#FFC107";
  const inactiveBg = "#EEF3FF";
  const activeBorder = isSader ? "#FFC107" : "#0B2E8C";
  const inactiveBorder = "#D0DDFB";
  const textColor = selected ? (isSader ? "#FFC107" : "#0B2E8C") : "#0B2E8C";

  return (
    <button
      type="button"
      onClick={onClick}
      className={`
        w-[120px] h-[120px] min-w-[120px] min-h-[120px]
        rounded-[22px] border-2 flex items-center justify-center
        text-[48px] font-black leading-none tracking-tight
        transition-all duration-200 active:scale-[0.97]
        select-none cursor-pointer
        ${selected ? "shadow-[0_8px_24px_rgba(11,46,140,0.25)] scale-[1.02]" : "shadow-sm hover:shadow-md hover:border-[#0B2E8C]/40"}
      `}
      style={{
        backgroundColor: selected ? activeBg : inactiveBg,
        borderColor: selected ? activeBorder : inactiveBorder,
        color: textColor,
      }}
    >
      <span style={{ fontSize: "48px", fontWeight: "900", lineHeight: "1" }}>
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
  const isSader = color === "emerald";
  const activeBg = isSader ? "#0B2E8C" : "#FFC107";
  const inactiveBg = "#EEF3FF";
  const activeBorder = isSader ? "#FFC107" : "#0B2E8C";
  const inactiveBorder = "#D0DDFB";
  const textColor = selected ? (isSader ? "#FFC107" : "#0B2E8C") : "#0B2E8C";

  return (
    <button
      type="button"
      onClick={onClick}
      className={`
        w-[120px] h-[120px] min-w-[120px] min-h-[120px]
        rounded-[22px] border-2 flex flex-col items-center justify-center
        transition-all duration-200 active:scale-[0.97]
        select-none cursor-pointer
        ${selected ? "shadow-[0_8px_24px_rgba(11,46,140,0.25)] scale-[1.02]" : "shadow-sm hover:shadow-md hover:border-[#0B2E8C]/40"}
      `}
      style={{
        backgroundColor: selected ? activeBg : inactiveBg,
        borderColor: selected ? activeBorder : inactiveBorder,
        color: textColor,
      }}
    >
      <span
        className={`font-black leading-none ${selected ? "text-[48px]" : "text-[20px]"}`}
        style={{ fontSize: selected ? "48px" : "20px", fontWeight: "900", lineHeight: "1" }}
      >
        {selected ? activeLabel : label}
      </span>
      {selected && (
        <span className="text-[11px] font-bold mt-1 tracking-wide opacity-80">
          {label}
        </span>
      )}
    </button>
  );
}

function AdminPickupModal({
  orderId,
  nextPath,
  advanceStatus,
  defaultAlf,
  pickupAction,
  pickupPending,
  onClose,
}: {
  orderId: string;
  nextPath: string;
  advanceStatus: string;
  defaultAlf: string;
  pickupAction: (formData: FormData) => void | Promise<void>;
  pickupPending: boolean;
  onClose: () => void;
}) {
  const [amountAlf, setAmountAlf] = useState("");
  const [selectedBox, setSelectedBox] = useState<"num" | "zero" | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const isMismatch =
    amountAlf.trim() !== "" &&
    amountAlf.trim() !== defaultAlf &&
    amountAlf.trim() !== "0" &&
    selectedBox !== "zero";

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-3 sm:p-4 bg-[#0A1840]/60 backdrop-blur-[6px] overflow-y-auto animate-in fade-in" onClick={onClose}>
      <div
        className="bg-white border-2 border-[#0B2E8C] rounded-[28px] shadow-[0_20px_60px_rgba(11,46,140,0.3)] overflow-hidden w-full max-w-[420px] text-right animate-in zoom-in-95 duration-200 select-none"
        dir="rtl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* رأس النافذة بهوية وصلي */}
        <div className="px-5 pt-4 pb-3 flex items-center justify-between border-b border-[#D0DDFB]/70 bg-[#F8FAFF]">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-[10px] bg-[#EEF3FF] border border-[#D0DDFB] flex items-center justify-center text-[#0B2E8C]">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
              </svg>
            </div>
            <div>
              <h2 className="text-[15px] font-black text-[#0B2E8C]">تسجيل استلام (صادر)</h2>
              <p className="text-[10px] font-bold text-[#64748B]">تسجيل مدفوع المحل من الإدارة</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-[#EEF3FF] border border-[#D0DDFB] flex items-center justify-center text-[#0B2E8C] hover:bg-white transition cursor-pointer"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="p-5">
          <form
            ref={formRef}
            action={pickupAction}
            className="space-y-4"
            onSubmit={(e) => {
              const amtInput = formRef.current?.querySelector('input[name="amountAlf"]') as HTMLInputElement;
              if (amtInput && !amtInput.value.trim() && selectedBox !== "zero") {
                amtInput.value = defaultAlf || "0";
              }
            }}
          >
            <input type="hidden" name="orderId" value={orderId} />
            <input type="hidden" name="next" value={nextPath} />
            <input type="hidden" name="advanceStatus" value={advanceStatus} />

            <div className="text-right">
              <span className="text-[13px] font-bold text-[#0B2E8C]">المبلغ (ألف دينار):</span>
            </div>

            {/* مربعات الاختيار السريع 120x120 */}
            <div className="flex gap-4 justify-center" dir="ltr">
              <AmountSquareBtn
                value={defaultAlf || "0"}
                selected={selectedBox === "num" || (amountAlf === defaultAlf && defaultAlf !== "" && defaultAlf !== "0")}
                onClick={() => {
                  setAmountAlf(defaultAlf);
                  setSelectedBox("num");
                  const amtInput = formRef.current?.querySelector('input[name="amountAlf"]') as HTMLInputElement;
                  if (amtInput) amtInput.value = defaultAlf;
                  setTimeout(() => {
                    formRef.current?.requestSubmit();
                  }, 30);
                }}
                color="emerald"
              />
              <ZeroSquareBtn
                label="لم أدفع"
                activeLabel="0"
                selected={selectedBox === "zero" || amountAlf === "0"}
                onClick={() => {
                  setAmountAlf("0");
                  setSelectedBox("zero");
                  const amtInput = formRef.current?.querySelector('input[name="amountAlf"]') as HTMLInputElement;
                  if (amtInput) amtInput.value = "0";
                  setTimeout(() => {
                    formRef.current?.requestSubmit();
                  }, 30);
                }}
                color="emerald"
              />
            </div>

            {/* حقل إدخال المبلغ */}
            <div>
              <input
                name="amountAlf"
                inputMode="numeric"
                value={amountAlf}
                onChange={(e) => {
                  const v = e.target.value;
                  setAmountAlf(v);
                  if (v === defaultAlf && defaultAlf !== "" && defaultAlf !== "0") setSelectedBox("num");
                  else if (v === "0") setSelectedBox("zero");
                  else setSelectedBox(null);
                }}
                placeholder={defaultAlf || "0"}
                className="w-full h-[54px] rounded-[18px] border-2 border-[#D0DDFB] bg-white text-center text-[26px] font-black text-[#0B2E8C] placeholder:text-[#0B2E8C]/30 focus:outline-none focus:border-[#0B2E8C] focus:ring-2 focus:ring-[#0B2E8C]/20 transition"
              />
            </div>

            {/* حقل سبب اختلاف المبلغ: يظهر فقط إذا كتب المستخدم سعراً مختلفاً عن المتوقع */}
            {isMismatch ? (
              <div className="space-y-1.5 animate-in fade-in duration-200">
                <div className="text-right">
                  <span className="text-[13px] font-bold text-[#0B2E8C]">
                    سبب اختلاف الصادر <span className="text-rose-600">*</span>
                  </span>
                </div>
                <textarea
                  name="mismatchNote"
                  required
                  rows={2}
                  className="w-full min-h-[78px] rounded-[16px] border border-[#D0DDFB] bg-white px-4 py-3 text-[13px] text-right text-[#0B2E8C] placeholder:text-[#0B2E8C]/40 focus:outline-none focus:border-[#0B2E8C] focus:ring-2 focus:ring-[#0B2E8C]/20 resize-none font-medium"
                  placeholder="اكتب سبب اختلاف المبلغ عن المطلوب..."
                />
              </div>
            ) : (
              <input type="hidden" name="mismatchNote" value="" />
            )}

            <div className="h-[1px] bg-[#D0DDFB]/60 my-4" />

            <div className="flex gap-3">
              <button
                type="submit"
                disabled={pickupPending}
                className="flex-1 h-[48px] rounded-[16px] font-black text-[15px] text-white bg-[#0B2E8C] hover:bg-[#082269] border border-[#D0DDFB] shadow-md hover:shadow-lg active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
              >
                <svg className="w-4 h-4 text-[#FFC107]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                  <polyline points="17 21 17 13 7 13 7 21" />
                  <polyline points="7 3 7 8 15 8" />
                </svg>
                <span>{pickupPending ? "جاري الحفظ..." : "تأكيد الصادر"}</span>
              </button>
              <button
                type="button"
                onClick={onClose}
                className="w-[88px] h-[48px] rounded-[16px] bg-[#EEF3FF] border border-[#D0DDFB] font-bold text-[14px] text-[#0B2E8C] hover:bg-white transition active:scale-[0.98] cursor-pointer"
              >
                إلغاء
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

function AdminDeliveryModal({
  orderId,
  nextPath,
  advanceStatus,
  defaultAlf,
  deliveryAction,
  deliveryPending,
  onClose,
}: {
  orderId: string;
  nextPath: string;
  advanceStatus: string;
  defaultAlf: string;
  deliveryAction: (formData: FormData) => void | Promise<void>;
  deliveryPending: boolean;
  onClose: () => void;
}) {
  const [amountAlf, setAmountAlf] = useState("");
  const [selectedBox, setSelectedBox] = useState<"num" | "zero" | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const isMismatch =
    amountAlf.trim() !== "" &&
    amountAlf.trim() !== defaultAlf &&
    amountAlf.trim() !== "0" &&
    selectedBox !== "zero";

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-3 sm:p-4 bg-[#0A1840]/60 backdrop-blur-[6px] overflow-y-auto animate-in fade-in" onClick={onClose}>
      <div
        className="bg-white border-2 border-[#0B2E8C] rounded-[28px] shadow-[0_20px_60px_rgba(11,46,140,0.3)] overflow-hidden w-full max-w-[420px] text-right animate-in zoom-in-95 duration-200 select-none"
        dir="rtl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* رأس النافذة بهوية وصلي */}
        <div className="px-5 pt-4 pb-3 flex items-center justify-between border-b border-[#D0DDFB]/70 bg-[#F8FAFF]">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-[10px] bg-[#FFC107]/20 border border-[#D0DDFB] flex items-center justify-center text-[#0B2E8C]">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <div>
              <h2 className="text-[15px] font-black text-[#0B2E8C]">تسجيل تسليم (وارد)</h2>
              <p className="text-[10px] font-bold text-[#64748B]">تسجيل مقبوض الزبون من الإدارة</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-[#EEF3FF] border border-[#D0DDFB] flex items-center justify-center text-[#0B2E8C] hover:bg-white transition cursor-pointer"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="p-5">
          <form
            ref={formRef}
            action={deliveryAction}
            className="space-y-4"
            onSubmit={(e) => {
              const amtInput = formRef.current?.querySelector('input[name="amountAlf"]') as HTMLInputElement;
              if (amtInput && !amtInput.value.trim() && selectedBox !== "zero") {
                amtInput.value = defaultAlf || "0";
              }
            }}
          >
            <input type="hidden" name="orderId" value={orderId} />
            <input type="hidden" name="next" value={nextPath} />
            <input type="hidden" name="advanceStatus" value={advanceStatus} />

            <div className="text-right">
              <span className="text-[13px] font-bold text-[#0B2E8C]">المبلغ (ألف دينار):</span>
            </div>

            {/* مربعات الاختيار السريع 120x120 */}
            <div className="flex gap-4 justify-center" dir="ltr">
              <AmountSquareBtn
                value={defaultAlf || "0"}
                selected={selectedBox === "num" || (amountAlf === defaultAlf && defaultAlf !== "" && defaultAlf !== "0")}
                onClick={() => {
                  setAmountAlf(defaultAlf);
                  setSelectedBox("num");
                  const amtInput = formRef.current?.querySelector('input[name="amountAlf"]') as HTMLInputElement;
                  if (amtInput) amtInput.value = defaultAlf;
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
                  const amtInput = formRef.current?.querySelector('input[name="amountAlf"]') as HTMLInputElement;
                  if (amtInput) amtInput.value = "0";
                  setTimeout(() => {
                    formRef.current?.requestSubmit();
                  }, 30);
                }}
                color="orange"
              />
            </div>

            {/* حقل إدخال المبلغ */}
            <div>
              <input
                name="amountAlf"
                inputMode="numeric"
                value={amountAlf}
                onChange={(e) => {
                  const v = e.target.value;
                  setAmountAlf(v);
                  if (v === defaultAlf && defaultAlf !== "" && defaultAlf !== "0") setSelectedBox("num");
                  else if (v === "0") setSelectedBox("zero");
                  else setSelectedBox(null);
                }}
                placeholder={defaultAlf || "0"}
                className="w-full h-[54px] rounded-[18px] border-2 border-[#D0DDFB] bg-white text-center text-[26px] font-black text-[#0B2E8C] placeholder:text-[#0B2E8C]/30 focus:outline-none focus:border-[#0B2E8C] focus:ring-2 focus:ring-[#0B2E8C]/20 transition"
              />
            </div>

            {/* حقل سبب اختلاف المبلغ: يظهر فقط إذا كتب المستخدم سعراً مختلفاً عن المتوقع */}
            {isMismatch ? (
              <div className="space-y-1.5 animate-in fade-in duration-200">
                <div className="text-right">
                  <span className="text-[13px] font-bold text-[#0B2E8C]">
                    سبب اختلاف الوارد <span className="text-rose-600">*</span>
                  </span>
                </div>
                <textarea
                  name="mismatchNote"
                  required
                  rows={2}
                  className="w-full min-h-[78px] rounded-[16px] border border-[#D0DDFB] bg-white px-4 py-3 text-[13px] text-right text-[#0B2E8C] placeholder:text-[#0B2E8C]/40 focus:outline-none focus:border-[#0B2E8C] focus:ring-2 focus:ring-[#0B2E8C]/20 resize-none font-medium"
                  placeholder="اكتب سبب اختلاف المبلغ عن المطلوب..."
                />
              </div>
            ) : (
              <input type="hidden" name="mismatchNote" value="" />
            )}

            <div className="h-[1px] bg-[#D0DDFB]/60 my-4" />

            <div className="flex gap-3">
              <button
                type="submit"
                disabled={deliveryPending}
                className="flex-1 h-[48px] rounded-[16px] font-black text-[15px] text-[#0B2E8C] bg-[#FFC107] hover:bg-[#eab308] border border-[#D0DDFB] shadow-md hover:shadow-lg active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
              >
                <svg className="w-4 h-4 text-[#0B2E8C]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                <span>{deliveryPending ? "جاري الحفظ..." : "تأكيد الوارد"}</span>
              </button>
              <button
                type="button"
                onClick={onClose}
                className="w-[88px] h-[48px] rounded-[16px] bg-[#EEF3FF] border border-[#D0DDFB] font-bold text-[14px] text-[#0B2E8C] hover:bg-white transition active:scale-[0.98] cursor-pointer"
              >
                إلغاء
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
