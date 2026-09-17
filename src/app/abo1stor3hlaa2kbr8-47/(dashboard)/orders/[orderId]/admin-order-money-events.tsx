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
              <input type="hidden" name="orderId" value={orderId} />
              <input type="hidden" name="next" value={nextPath} />
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

      {/* --- مودال تسجيل الوارد (أخذت) --- */}
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
              <input type="hidden" name="orderId" value={orderId} />
              <input type="hidden" name="next" value={nextPath} />
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
