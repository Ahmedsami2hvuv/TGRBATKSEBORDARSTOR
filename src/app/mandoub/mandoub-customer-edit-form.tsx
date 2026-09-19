"use client";

import { useActionState, useEffect, useState } from "react";
import { updateMandoubCustomerDetails } from "./actions";
import { MandoubEditCustomerState } from "./types";
import { MANDOUB_ORDER_EDIT_TOGGLE } from "./mandoub-order-detail-actions";
import { MandoubLocationManageButtons } from "./mandoub-location-manage-buttons";
import { useRouter } from "next/navigation";

const initialEdit: MandoubEditCustomerState = {};

export function MandoubCustomerEditForm({
  orderId,
  defaultOrderStatus,
  defaultCustomerPhone,
  defaultCustomerLocationUrl,
  defaultCustomerLandmark,
  defaultAlternatePhone,
  isDoubleRoute,
  defaultSecondCustomerPhone,
  defaultSecondCustomerLocationUrl,
  defaultSecondCustomerLandmark,
  defaultSecondAlternatePhone,
  auth,
  nextUrl,
}: {
  orderId: string;
  defaultOrderStatus: string;
  defaultCustomerPhone: string;
  defaultCustomerLocationUrl: string;
  defaultCustomerLandmark: string;
  defaultAlternatePhone: string;
  isDoubleRoute?: boolean;
  defaultSecondCustomerPhone?: string;
  defaultSecondCustomerLocationUrl?: string;
  defaultSecondCustomerLandmark?: string;
  defaultSecondAlternatePhone?: string;
  auth: { c: string; exp: string; s: string };
  nextUrl: string;
}) {
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState<string>(
    defaultOrderStatus === "delivered" ? "delivered" : defaultOrderStatus === "delivering" ? "delivering" : "assigned"
  );

  const [editState, editAction, editPending] = useActionState(
    updateMandoubCustomerDetails,
    initialEdit
  );

  useEffect(() => {
    const handleToggle = (e: CustomEvent) => {
      if (!e.detail?.orderId || e.detail?.orderId === orderId) {
        setEditOpen((prev) => !prev);
      }
    };
    window.addEventListener(MANDOUB_ORDER_EDIT_TOGGLE, handleToggle as any);
    return () => window.removeEventListener(MANDOUB_ORDER_EDIT_TOGGLE, handleToggle as any);
  }, [orderId]);

  useEffect(() => {
    setSelectedStatus(
      defaultOrderStatus === "delivered" ? "delivered" : defaultOrderStatus === "delivering" ? "delivering" : "assigned"
    );
  }, [defaultOrderStatus]);

  useEffect(() => {
    if (editState.success && !editPending) {
      setEditOpen(false);
      router.refresh();
    }
  }, [editState.success, editPending, router]);

  const MANDOUB_STATUS_OPTIONS = [
    { value: "assigned", label: "بانتظار المندوب" },
    { value: "delivering", label: "استلام" },
    ...(defaultOrderStatus === "delivered"
      ? [{ value: "delivered", label: "تسليم" }]
      : []),
  ];

  if (!editOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[150] flex items-center justify-center p-3 sm:p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200 overflow-y-auto"
      onClick={() => {
        if (!editPending) setEditOpen(false);
      }}
    >
      <div
        className="w-full max-w-lg rounded-[22px] border-[2px] border-[#C9A86A] bg-[#FFFEF8] p-4 sm:p-5 shadow-[0_12px_40px_rgba(0,0,0,0.35),inset_0_1px_0_white,0_0_0_1px_#E8D5A3_inset] text-right animate-in zoom-in-95 duration-200 relative overflow-hidden my-auto max-h-[92vh] flex flex-col select-none"
        onClick={(e) => e.stopPropagation()}
        dir="rtl"
      >
        {/* معينات الزوايا المذهبة الملكية */}
        <div className="absolute top-[8px] right-[8px] w-[6px] h-[6px] rotate-45 bg-gradient-to-br from-[#E8C77E] to-[#C9A86A] pointer-events-none" />
        <div className="absolute top-[8px] left-[8px] w-[6px] h-[6px] rotate-45 bg-gradient-to-br from-[#E8C77E] to-[#C9A86A] pointer-events-none" />
        <div className="absolute bottom-[8px] right-[8px] w-[6px] h-[6px] rotate-45 bg-gradient-to-br from-[#E8C77E] to-[#C9A86A] pointer-events-none" />
        <div className="absolute bottom-[8px] left-[8px] w-[6px] h-[6px] rotate-45 bg-gradient-to-br from-[#E8C77E] to-[#C9A86A] pointer-events-none" />

        {/* ترويسة المودال الفاخرة */}
        <div className="flex items-center justify-between border-b-[1.5px] border-[#E8D5A3] pb-3 mb-3 bg-gradient-to-r from-[#FFFEF8] to-[#FDF6E3] -mx-4 -mt-4 p-3.5 sm:-mx-5 sm:-mt-5 sm:p-4 shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-[30px] h-[30px] rounded-[10px] bg-gradient-to-b from-[#F1D99A] via-[#E8C77E] to-[#C9A86A] flex items-center justify-center shadow-sm border border-[#9C7D46]/30">
              <svg className="w-[14px] h-[14px] text-[#0A3D2E]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 20h9" />
                <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
              </svg>
            </div>
            <h3 className="text-sm sm:text-base font-black text-[#0A3D2E] leading-none">تعديل بيانات الطلب</h3>
          </div>
          <button
            type="button"
            onClick={() => setEditOpen(false)}
            className="w-7 h-7 rounded-full bg-white border border-[#C9A86A]/40 text-slate-700 hover:text-[#0A3D2E] hover:bg-[#FDF6E3] font-bold flex items-center justify-center cursor-pointer text-xs shadow-xs transition"
            title="إغلاق"
          >
            ✕
          </button>
        </div>

        {/* محتوى الفورم */}
        <form
          key={`${orderId}-${defaultOrderStatus}-${defaultCustomerLocationUrl}`}
          action={editAction}
          className="space-y-3.5 overflow-y-auto pr-0.5 max-h-[calc(92vh-135px)]"
        >
          <input type="hidden" name="orderId" value={orderId} />
          <input type="hidden" name="next" value={nextUrl} />
          <input type="hidden" name="c" value={auth.c} />
          <input type="hidden" name="exp" value={auth.exp} />
          <input type="hidden" name="s" value={auth.s} />
          {isDoubleRoute && <input type="hidden" name="isDoubleRoute" value="true" />}

          {/* 1. أزرار حالة الطلبية في سطر واحد بدون علامة صح وبإضاءة الخلية */}
          <div className="space-y-1.5">
            <label className="text-[12px] font-black text-[#0A3D2E] block">حالة الطلبية:</label>
            <div
              className={`grid gap-1.5 ${
                MANDOUB_STATUS_OPTIONS.length === 3
                  ? "grid-cols-[1.3fr_1fr_1fr]"
                  : "grid-cols-2"
              }`}
              dir="rtl"
            >
              {MANDOUB_STATUS_OPTIONS.map((opt) => {
                const isSelected = selectedStatus === opt.value;
                return (
                  <label
                    key={opt.value}
                    className={`min-h-[38px] px-1.5 py-1 rounded-[12px] border-[1.5px] flex items-center justify-center text-center cursor-pointer transition-all active:scale-95 select-none ${
                      isSelected
                        ? "bg-gradient-to-b from-[#0E3D2B] via-[#0A3525] to-[#07281C] border-[#C9A86A] text-[#E8C77E] shadow-[0_2px_8px_rgba(10,46,32,0.35),inset_0_1px_0_rgba(232,199,126,0.3)] font-black text-[11px] sm:text-[12px]"
                        : "bg-[#FFFEF8] border-[#E8D5A3] text-[#0A3D2E] hover:border-[#C9A86A] hover:bg-[#FDF6E3] font-bold text-[11px] sm:text-[12px]"
                    }`}
                  >
                    <input
                      type="radio"
                      name="status"
                      value={opt.value}
                      checked={isSelected}
                      onChange={() => setSelectedStatus(opt.value)}
                      className="sr-only"
                    />
                    <span className="truncate leading-none">{opt.label}</span>
                  </label>
                );
              })}
            </div>
          </div>

          {/* 2. رقم الزبون والرقم الثاني جنباً إلى جنب في سطر واحد مصغر */}
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <label className="text-[12px] font-black text-[#0A3D2E] block">
                {isDoubleRoute ? "رقم المرسل" : "رقم الزبون"}
              </label>
              <input
                name="customerPhone"
                required
                inputMode="numeric"
                defaultValue={defaultCustomerPhone}
                className="w-full h-[38px] rounded-xl border-[1.5px] border-[#C9A86A]/60 bg-white px-3 text-xs sm:text-sm font-black text-[#0A3D2E] font-mono tabular-nums focus:border-[#0A3D2E] focus:outline-none focus:ring-2 focus:ring-[#0A3D2E]/10 shadow-[inset_0_1px_2px_rgba(0,0,0,0.05)]"
                dir="ltr"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[12px] font-black text-[#0A3D2E] block">
                رقم ثانٍ (اختياري)
              </label>
              <input
                name="alternatePhone"
                inputMode="numeric"
                defaultValue={defaultAlternatePhone}
                placeholder="إن وجد"
                className="w-full h-[38px] rounded-xl border-[1.5px] border-[#C9A86A]/60 bg-white px-3 text-xs sm:text-sm font-black text-[#0A3D2E] font-mono tabular-nums focus:border-[#0A3D2E] focus:outline-none focus:ring-2 focus:ring-[#0A3D2E]/10 shadow-[inset_0_1px_2px_rgba(0,0,0,0.05)]"
                dir="ltr"
              />
            </div>
          </div>

          {/* 3. بلوك إدخال اللوكيشن المصغر */}
          <div className="space-y-1.5">
            <label className="text-[12px] font-black text-[#0A3D2E] block">
              {isDoubleRoute ? "رابط لوكيشن المرسل" : "رابط لوكيشن الزبون"}
            </label>
            <div className="flex flex-col gap-1.5">
              <input
                name="customerLocationUrl"
                defaultValue={defaultCustomerLocationUrl}
                placeholder="الصق رابط خرائط جوجل أو اللوكيشن..."
                className="w-full h-[38px] rounded-xl border-[1.5px] border-[#C9A86A]/60 bg-white px-3 text-xs font-bold text-[#0A3D2E] font-mono focus:border-[#0A3D2E] focus:outline-none focus:ring-2 focus:ring-[#0A3D2E]/10 shadow-[inset_0_1px_2px_rgba(0,0,0,0.05)]"
                dir="ltr"
              />
              {defaultCustomerLocationUrl.trim() ? (
                <div className="mt-0.5">
                  <MandoubLocationManageButtons
                    orderId={orderId}
                    auth={auth}
                    nextUrl={nextUrl}
                  />
                </div>
              ) : null}
            </div>
          </div>

          {/* 4. أقرب نقطة دالة */}
          <div className="space-y-1">
            <label className="text-[12px] font-black text-[#0A3D2E] block">أقرب نقطة دالة:</label>
            <input
              name="customerLandmark"
              defaultValue={defaultCustomerLandmark}
              placeholder="اكتب أقرب نقطة دالة..."
              className="w-full h-[38px] rounded-xl border-[1.5px] border-[#C9A86A]/60 bg-white px-3 text-xs sm:text-sm font-black text-[#0A3D2E] focus:border-[#0A3D2E] focus:outline-none focus:ring-2 focus:ring-[#0A3D2E]/10 shadow-[inset_0_1px_2px_rgba(0,0,0,0.05)]"
            />
          </div>

          {/* في حالة المسار المزدوج (الوجهة الثانية) */}
          {isDoubleRoute && (
            <div className="mt-4 pt-3 border-t-[1.5px] border-[#C9A86A]/30 space-y-3 bg-[#FDF6E3]/40 -mx-2 p-2.5 rounded-xl border border-[#C9A86A]/20">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#0A3D2E]" />
                <h4 className="text-xs font-black text-[#0A3D2E]">بيانات المستلم (الوجهة الثانية)</h4>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-[#0A3D2E] block">رقم المستلم</label>
                  <input
                    name="secondCustomerPhone"
                    inputMode="numeric"
                    defaultValue={defaultSecondCustomerPhone}
                    className="w-full h-[36px] rounded-xl border border-[#C9A86A]/60 bg-white px-3 text-xs font-black text-[#0A3D2E] font-mono tabular-nums focus:border-[#0A3D2E] focus:outline-none"
                    dir="ltr"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-[#0A3D2E] block">رقم مستلم ثانٍ</label>
                  <input
                    name="secondAlternatePhone"
                    inputMode="numeric"
                    defaultValue={defaultSecondAlternatePhone}
                    placeholder="إن وجد"
                    className="w-full h-[36px] rounded-xl border border-[#C9A86A]/60 bg-white px-3 text-xs font-black text-[#0A3D2E] font-mono tabular-nums focus:border-[#0A3D2E] focus:outline-none"
                    dir="ltr"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-[#0A3D2E] block">لوكيشن المستلم</label>
                <input
                  name="secondCustomerLocationUrl"
                  defaultValue={defaultSecondCustomerLocationUrl}
                  placeholder="الصق رابط لوكيشن المستلم..."
                  className="w-full h-[36px] rounded-xl border border-[#C9A86A]/60 bg-white px-3 text-xs font-bold text-[#0A3D2E] font-mono focus:border-[#0A3D2E] focus:outline-none"
                  dir="ltr"
                />
                {defaultSecondCustomerLocationUrl?.trim() ? (
                  <div className="mt-1">
                    <MandoubLocationManageButtons
                      orderId={orderId}
                      auth={auth}
                      nextUrl={nextUrl}
                      target="second"
                    />
                  </div>
                ) : null}
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-[#0A3D2E] block">نقطة دالة للمستلم</label>
                <input
                  name="secondCustomerLandmark"
                  defaultValue={defaultSecondCustomerLandmark}
                  placeholder="أقرب نقطة دالة للمستلم..."
                  className="w-full h-[36px] rounded-xl border border-[#C9A86A]/60 bg-white px-3 text-xs font-black text-[#0A3D2E] focus:border-[#0A3D2E] focus:outline-none"
                />
              </div>
            </div>
          )}

          {editState.error ? (
            <p className="rounded-xl border border-rose-300 bg-rose-50 p-2.5 text-center text-xs font-black text-rose-800 shadow-xs">
              {editState.error}
            </p>
          ) : null}

          {/* أزرار الحفظ والإلغاء في أسفل المودال */}
          <div className="flex items-center justify-end gap-2 pt-3 mt-2 border-t border-[#C9A86A]/20 shrink-0">
            <button
              type="button"
              onClick={() => setEditOpen(false)}
              disabled={editPending}
              className="h-[38px] px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs active:scale-95 transition cursor-pointer"
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={editPending}
              className="h-[38px] px-6 rounded-xl bg-gradient-to-b from-[#0E3D2B] via-[#0A3525] to-[#07281C] border border-[#C9A86A] text-[#E8C77E] font-black text-xs shadow-[0_2px_8px_rgba(10,46,32,0.3)] hover:text-[#FFF8E1] hover:border-[#E8C77E] active:scale-95 transition cursor-pointer disabled:opacity-60 flex items-center justify-center gap-1.5"
            >
              {editPending ? "جارٍ التحديث…" : "💾 حفظ وتحديث الطلب"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
