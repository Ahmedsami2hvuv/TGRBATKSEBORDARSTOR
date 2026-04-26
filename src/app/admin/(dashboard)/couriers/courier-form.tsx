"use client";

import { useActionState, useState } from "react";
import { ad } from "@/lib/admin-ui";
import { createCourier, type CourierFormState } from "./actions";

const initial: CourierFormState = {};

export function CourierForm() {
  const [state, formAction, pending] = useActionState(createCourier, initial);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [telegramUserId, setTelegramUserId] = useState("");
  const [vehicleType, setVehicleType] = useState<"car" | "bike">("car");

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className={ad.btnPrimary}>
        ➕ إضافة مندوب جديد
      </button>
    );
  }

  return (
    <div className="rounded-2xl border border-sky-200 bg-sky-50/40 p-4 sm:p-5">
      <div className="flex justify-between items-center mb-4">
        <h2 className={ad.h2}>إضافة مندوب جديد</h2>
        <button type="button" onClick={() => setOpen(false)} className={ad.btnDark}>
          إلغاء
        </button>
      </div>
      <form action={formAction} className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm">
            <span className={ad.label}>اسم المندوب</span>
            <input
              name="name"
              required
              className={ad.input}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className={ad.label}>رقم الهاتف</span>
            <input
              name="phone"
              type="tel"
              inputMode="numeric"
              required
              placeholder="07… أو +964 77x xxx xxxx"
              className={ad.input}
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className={ad.label}>Telegram User ID (للإشعارات)</span>
            <input
              name="telegramUserId"
              inputMode="numeric"
              placeholder="مثال: 123456789"
              className={ad.input}
              value={telegramUserId}
              onChange={(e) => setTelegramUserId(e.target.value)}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm sm:col-span-2">
            <span className={ad.label}>نوع المركبة (لحساب أجر التوصيل)</span>
            <select
              name="vehicleType"
              className={ad.select}
              value={vehicleType}
              onChange={(e) => setVehicleType(e.target.value === "bike" ? "bike" : "car")}
            >
              <option value="car">سيارة — ثلثي كلفة التوصيل لكل طلب مُسلَّم</option>
              <option value="bike">دراجة — نصف كلفة التوصيل لكل طلب مُسلَّم</option>
            </select>
          </label>
        </div>
        {state.error ? (
          <p className={ad.error} role="alert">
            {state.error}
          </p>
        ) : null}
        {state.ok ? <p className={ad.success}>تمت إضافة المندوب.</p> : null}
        <button type="submit" disabled={pending} className={ad.btnPrimary}>
          {pending ? "جارٍ الحفظ…" : "حفظ المندوب"}
        </button>
      </form>
    </div>
  );
}
