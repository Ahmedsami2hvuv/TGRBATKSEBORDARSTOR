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

      {/* كارت المعاملات المالية المتطابق 100% مع التصميم 3 والصورة 3 */}
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
          {/* زري استلام وتسليم (أعطيت وأخذت) الفاخرين بالصور */}
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

              {/* زر طلب عكسي 🔄 */}
              <LuxuryReverseOrderButton
                orderId={orderId}
                orderNumber={orderNumber}
                role="admin"
                size="lg"
              />
            </div>
          )}

          {/* فاصل ذهبي ناعم */}
          <div className="flex items-center gap-2 py-0.5">
            <div className="h-[1px] flex-1 bg-gradient-to-l from-[#C9A86A]/40 to-transparent" />
            <div className="w-[6px] h-[6px] rotate-45 bg-[#C9A86A]/60" />
            <div className="h-[1px] flex-1 bg-gradient-to-r from-[#C9A86A]/40 to-transparent" />
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

/* مكونات المربعات التفاعلية الفاخرة المطابقة لـ Mnt-Data-Photo3607594841302210502-Jpeg.html */
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
  const textColor = selected ? "#C9A86A" : isEmerald ? "#0A3D2A" : "#8B2E1A";

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
        ${selected ? "shadow-[0_0_0_3px_#C9A86A44,0_8px_20px_rgba(0,0,0,0.15)] scale-[1.02]" : "shadow-[0_4px_14px_rgba(0,0,0,0.08)] hover:shadow-[0_6px_18px_rgba(0,0,0,0.12)]"}
      `}
      style={{
        backgroundColor: selected ? activeBg : inactiveBg,
        borderColor: "#C9A86A",
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
  const isEmerald = color === "emerald";
  const activeBg = isEmerald ? "#0A3D2A" : "#8B2E1A";
  const textColor = selected ? "#C9A86A" : "#0A3D2A";

  return (
    <button
      type="button"
      onClick={onClick}
      className={`
        w-[120px] h-[120px] min-w-[120px] min-h-[120px]
        rounded-[18px] border-[2.5px] flex flex-col items-center justify-center
        transition-all duration-200 active:scale-[0.97]
        select-none cursor-pointer
        ${selected ? "shadow-[0_0_0_3px_#C9A86A44,0_8px_20px_rgba(0,0,0,0.12)] scale-[1.02]" : "shadow-[0_4px_14px_rgba(0,0,0,0.06)] hover:shadow-[0_6px_18px_rgba(0,0,0,0.10)]"}
      `}
      style={{
        backgroundColor: selected ? activeBg : "#E8E0D0",
        borderColor: "#C9A86A",
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
        <span className="text-[11px] font-bold mt-1 tracking-wide opacity-70" style={{ color: "#C9A86A" }}>
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
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-3 sm:p-4 bg-black/70 backdrop-blur-sm overflow-y-auto" onClick={onClose}>
      <div
        className="bg-[#FDF8EE] border-[2px] border-[#C9A86A] rounded-[28px] shadow-[0_12px_40px_rgba(10,61,42,0.10)] overflow-hidden w-full max-w-[440px] text-right animate-in fade-in zoom-in-95"
        dir="rtl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 pt-5 pb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-[18px]">💸</span>
            <h2 className="text-[18px] font-black text-[#0A3D2A]">تسجيل صادر</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-[#F0EAD8] border border-[#C9A86A]/40 flex items-center justify-center text-[#0A3D2A] text-[16px] cursor-pointer hover:bg-[#E8E0D0] transition font-bold"
          >
            ×
          </button>
        </div>
        <div className="h-[1px] bg-[#C9A86A]/30 mx-6" />

        <div className="p-6">
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
              <span className="text-[14px] font-bold text-[#0A3D2A]">المبلغ (ألف دينار):</span>
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
                className="w-full h-[56px] rounded-[16px] border-[1.5px] border-[#C9A86A] bg-white text-center text-[26px] font-black text-[#0A3D2A] placeholder:text-[#0A3D2A]/30 focus:outline-none focus:ring-2 focus:ring-[#C9A86A]/40"
              />
            </div>

            {/* حقل سبب اختلاف المبلغ: يظهر فقط إذا كتب المستخدم سعراً مختلفاً عن المتوقع */}
            {isMismatch ? (
              <div className="space-y-1.5 animate-in fade-in duration-200">
                <div className="text-right">
                  <span className="text-[13px] font-bold text-[#0A3D2A]">
                    سبب اختلاف الصادر <span className="text-rose-600">*</span>
                  </span>
                </div>
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

            <div className="h-[1px] bg-[#C9A86A]/20 my-4" />

            <div className="flex gap-3">
              <button
                type="submit"
                disabled={pickupPending}
                className="flex-1 h-[48px] rounded-[16px] font-black text-[15px] text-[#0A3D2A] border border-[#C9A86A] shadow-[0_4px_12px_rgba(0,0,0,0.12)] hover:brightness-[1.03] active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
                style={{ background: "linear-gradient(180deg, #E8D5A3 0%, #C9A86A 100%)" }}
              >
                <span>💾</span>
                <span>{pickupPending ? "جاري الحفظ..." : "تأكيد الصادر"}</span>
              </button>
              <button
                type="button"
                onClick={onClose}
                className="w-[88px] h-[48px] rounded-[16px] bg-[#F0EAD8] border border-[#C9A86A]/30 font-bold text-[14px] text-[#0A3D2A] hover:bg-[#E8E0D0] transition active:scale-[0.98] cursor-pointer"
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
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-3 sm:p-4 bg-black/70 backdrop-blur-sm overflow-y-auto" onClick={onClose}>
      <div
        className="bg-[#FDF8EE] border-[2px] border-[#C9A86A] rounded-[28px] shadow-[0_12px_40px_rgba(139,46,26,0.10)] overflow-hidden w-full max-w-[440px] text-right animate-in fade-in zoom-in-95"
        dir="rtl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 pt-5 pb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-[18px]">🫴</span>
            <h2 className="text-[18px] font-black text-[#8B2E1A]">تسجيل وارد</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-[#F0EAD8] border border-[#C9A86A]/40 flex items-center justify-center text-[#0A3D2A] text-[16px] cursor-pointer hover:bg-[#E8E0D0] transition font-bold"
          >
            ×
          </button>
        </div>
        <div className="h-[1px] bg-[#C9A86A]/30 mx-6" />

        <div className="p-6">
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
              <span className="text-[14px] font-bold text-[#0A3D2A]">المبلغ (ألف دينار):</span>
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
                className="w-full h-[56px] rounded-[16px] border-[1.5px] border-[#C9A86A] bg-white text-center text-[26px] font-black text-[#8B2E1A] placeholder:text-[#8B2E1A]/30 focus:outline-none focus:ring-2 focus:ring-[#C9A86A]/40"
              />
            </div>

            {/* حقل سبب اختلاف المبلغ: يظهر فقط إذا كتب المستخدم سعراً مختلفاً عن المتوقع */}
            {isMismatch ? (
              <div className="space-y-1.5 animate-in fade-in duration-200">
                <div className="text-right">
                  <span className="text-[13px] font-bold text-[#0A3D2A]">
                    سبب اختلاف الوارد <span className="text-rose-600">*</span>
                  </span>
                </div>
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

            <div className="h-[1px] bg-[#C9A86A]/20 my-4" />

            <div className="flex gap-3">
              <button
                type="submit"
                disabled={deliveryPending}
                className="flex-1 h-[48px] rounded-[16px] font-black text-[15px] text-white border border-[#C9A86A] shadow-[0_4px_12px_rgba(0,0,0,0.12)] hover:brightness-[1.05] active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
                style={{ background: "linear-gradient(180deg, #F4A27A 0%, #D96A3A 100%)" }}
              >
                <span>💾</span>
                <span>{deliveryPending ? "جاري الحفظ..." : "تأكيد الوارد"}</span>
              </button>
              <button
                type="button"
                onClick={onClose}
                className="w-[88px] h-[48px] rounded-[16px] bg-[#F0EAD8] border border-[#C9A86A]/30 font-bold text-[14px] text-[#0A3D2A] hover:bg-[#E8E0D0] transition active:scale-[0.98] cursor-pointer"
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
