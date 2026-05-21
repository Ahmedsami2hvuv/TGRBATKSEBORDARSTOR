"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { OrderStatusRadioGroup } from "@/components/order-status-radio-group";
import {
  updateMandoubCustomerDetails,
} from "./actions";
import { MandoubEditCustomerState } from "./types";
import { MANDOUB_ORDER_EDIT_TOGGLE } from "./mandoub-order-detail-actions";
import { MandoubLocationManageButtons } from "./mandoub-location-manage-buttons";
import { useRouter } from "next/navigation";

const initialEdit: MandoubEditCustomerState = {};

  const MANDOUB_STATUS_OPTIONS = [
    { value: "assigned", label: "بانتظار المندوب" },
    { value: "delivering", label: "تم الاستلام" },
    ...(defaultOrderStatus === "delivered"
      ? [{ value: "delivered", label: "تم التسليم" }]
      : []),
  ];

  return (
    <div id="mandoub-order-edit" className="scroll-mt-20 mt-4">
      {editOpen ? (
        <div className="mt-4 rounded-2xl border border-emerald-200/80 bg-emerald-50/40 p-4 sm:p-5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-emerald-200/60 pb-3">
            <p className="text-lg font-bold text-emerald-900">تعديل الطلب</p>
            <button
              type="button"
              onClick={() => setEditOpen(false)}
              className="text-sm font-bold text-slate-600 underline decoration-slate-400 underline-offset-2 hover:text-slate-900"
            >
              إخفاء
            </button>
          </div>
          <p className="mb-4 text-xs leading-relaxed text-slate-600">
            يمكنك تعديل رقم الزبون، لوكيشن، وأقرب نقطة دالة، وحالة الطلبية. للتعديل الكامل على
            الطلب (كل الحقول) تستخدم الإدارة لوحة التعديل.
          </p>
          <form
            key={`${orderId}-${defaultOrderStatus}-${defaultCustomerLocationUrl}`}
            action={editAction}
            className="space-y-4"
          >
            <input type="hidden" name="orderId" value={orderId} />
            <input type="hidden" name="next" value={nextUrl} />
            <input type="hidden" name="c" value={auth.c} />
            <input type="hidden" name="exp" value={auth.exp} />
            <input type="hidden" name="s" value={auth.s} />

            <OrderStatusRadioGroup
              name="status"
              defaultValue={
                MANDOUB_STATUS_OPTIONS.some((o) => o.value === defaultOrderStatus)
                  ? defaultOrderStatus
                  : defaultOrderStatus === "delivered" ? "delivered" : "assigned"
              }
              options={MANDOUB_STATUS_OPTIONS}
              legend="حالة الطلبية"
              legendClassName="font-bold text-slate-800"
            />
            <p className="text-xs text-slate-600 font-medium">
              {defaultOrderStatus !== "delivered"
                ? "ملاحظة: لتسليم الطلب نهائياً، استخدم زر «تم التسليم» في أسفل الصفحة لضمان تسجيل الحسابات والأرباح."
                : "يمكنك إرجاع الحالة (مثلاً من «تم التسليم» إلى «تم الاستلام») ثم الضغط على تحديث."}
            </p>

            <label className="flex flex-col gap-1.5">
              <span className="font-bold text-slate-800">رقم الزبون</span>
              <span className="text-xs text-slate-600">
                أي صيغة: 07… أو +964… أو مع مسافات — يُطبَّع تلقائياً.
              </span>
              <input
                ref={customerPhoneRef}
                name="customerPhone"
                required
                inputMode="numeric"
                defaultValue={defaultCustomerPhone}
                className={`${inputClass} font-mono tabular-nums`}
                dir="ltr"
              />
            </label>
            <div className="flex flex-col gap-1.5">
              <span className="font-bold text-slate-800">رابط لوكيشن الزبون</span>
              {defaultCustomerLocationUrl.trim() ? (
                <p className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-1.5 text-[11px] text-sky-900/90">
                  الحالي في الطلب:{" "}
                  <span className="font-mono tabular-nums">{defaultCustomerLocationUrl}</span>
                </p>
              ) : null}
              <textarea
                name="customerLocationUrl"
                rows={3}
                defaultValue={defaultCustomerLocationUrl}
                placeholder="الصق رابط خرائط جوجل أو أي رابط لوكيشن"
                className={`${inputClass} resize-y font-mono text-sm sm:text-base`}
                dir="ltr"
              />
              {defaultCustomerLocationUrl.trim() ? (
                <div className="mt-2">
                  <MandoubLocationManageButtons
                    orderId={orderId}
                    auth={auth}
                    nextUrl={nextUrl}
                  />
                </div>
              ) : null}
            </div>
            <label className="flex flex-col gap-1.5">
              <span className="font-bold text-slate-800">أقرب نقطة دالة</span>
              <input
                name="customerLandmark"
                defaultValue={defaultCustomerLandmark}
                className={inputClass}
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="font-bold text-slate-800">رقم ثانٍ (اختياري)</span>
              <input
                name="alternatePhone"
                inputMode="numeric"
                defaultValue={defaultAlternatePhone}
                className={`${inputClass} font-mono tabular-nums`}
                dir="ltr"
                placeholder="اتركه فارغاً إن لم يوجد"
              />
            </label>

            {editState.error ? (
              <p className="rounded-lg border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-800">
                {editState.error}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={editPending}
              className="w-full rounded-xl bg-emerald-700 px-4 py-3 text-base font-bold text-white shadow-sm hover:bg-emerald-800 disabled:opacity-60 sm:text-lg"
            >
              {editPending ? "جارٍ التحديث…" : "تحديث"}
            </button>
          </form>
        </div>
      ) : null}
    </div>
  );
}
