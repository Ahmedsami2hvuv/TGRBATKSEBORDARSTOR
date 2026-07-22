"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { ad } from "@/lib/admin-ui";
import { createRegion, type RegionFormState } from "./actions";

const initial: RegionFormState = {};

export function RegionForm() {
  const [state, formAction, pending] = useActionState(createRegion, initial);
  const [open, setOpen] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);
  const prevPending = useRef(false);
  const [name, setName] = useState("");
  const [deliveryPrice, setDeliveryPrice] = useState("");

  useEffect(() => {
    if (prevPending.current && !pending && state.ok) {
      setName("");
      setDeliveryPrice("");
      nameRef.current?.focus();
    }
    prevPending.current = pending;
  }, [pending, state.ok]);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold rounded-2xl shadow-md hover:shadow-lg transition-all duration-200 flex items-center gap-2 text-sm"
      >
        <span>➕</span>
        <span>إضافة منطقة جديدة</span>
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl border border-slate-100 p-6 space-y-5 animate-scale-up">
        <div className="flex justify-between items-center pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <span className="text-2xl">📍</span>
            <h2 className="text-xl font-bold text-slate-800">إضافة منطقة جديدة</h2>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="w-9 h-9 flex items-center justify-center rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 font-bold transition-colors"
          >
            ✕
          </button>
        </div>

        <form action={formAction} className="space-y-4">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1.5">
                اسم المنطقة <span className="text-rose-500">*</span>
              </label>
              <input
                ref={nameRef}
                name="name"
                required
                placeholder="مثال: المنصور، الكرادة، الشعب..."
                className="w-full px-4 py-3 rounded-2xl border border-slate-200 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition-all font-medium text-slate-800 placeholder:text-slate-400 text-sm"
                autoComplete="off"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1.5">
                كلفة التوصيل (بالآلاف) <span className="text-rose-500">*</span>
              </label>
              <input
                name="deliveryPrice"
                type="text"
                inputMode="decimal"
                required
                placeholder="مثال: 3 أو 3.5"
                className="w-full px-4 py-3 rounded-2xl border border-slate-200 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition-all font-medium text-slate-800 placeholder:text-slate-400 text-sm"
                value={deliveryPrice}
                onChange={(e) => setDeliveryPrice(e.target.value)}
              />
              <p className="text-xs text-slate-500 mt-1">ملاحظة: أدخل الرقم 3 لـ 3,000 دينار أو 3.5 لـ 3,500 دينار.</p>
            </div>
          </div>

          {state.error ? (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold flex items-center gap-2">
              <span>⚠️</span>
              <span>{state.error}</span>
            </div>
          ) : null}

          {state.ok ? (
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-bold flex items-center gap-2">
              <span>✅</span>
              <span>تمت إضافة المنطقة بنجاح!</span>
            </div>
          ) : null}

          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={pending}
              className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-2xl shadow-md disabled:opacity-50 transition-all text-sm"
            >
              {pending ? "جارٍ الحفظ…" : "حفظ المنطقة"}
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="px-5 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-2xl transition-all text-sm"
            >
              إلغاء
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
