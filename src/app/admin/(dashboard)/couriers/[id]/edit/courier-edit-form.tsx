"use client";

import { Fragment, useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ad } from "@/lib/admin-ui";
import {
  resetCourierMandoubTotals,
  updateCourier,
  type CourierFormState,
  type CourierMandoubResetState,
} from "../../actions";

const initial: CourierFormState = {};
const initialReset: CourierMandoubResetState = {};

export function CourierEditForm({
  courierId,
  defaultName,
  defaultPhone,
  defaultTelegramUserId,
  defaultVehicleType,
  defaultHiddenFromReports,
  defaultBlocked,
  lastMandoubTotalsResetLabel,
  mandoubWalletCarryOverLabel,
}: {
  courierId: string;
  defaultName: string;
  defaultPhone: string;
  defaultTelegramUserId: string;
  defaultVehicleType: "car" | "bike";
  defaultHiddenFromReports: boolean;
  defaultBlocked: boolean;
  lastMandoubTotalsResetLabel: string | null;
  /** متبقي المحفظة المحمول (يُعرض للمندوب بعد التصفير) */
  mandoubWalletCarryOverLabel: string;
}) {
  const bound = updateCourier.bind(null, courierId);
  const [state, formAction, pending] = useActionState(bound, initial);
  const boundReset = resetCourierMandoubTotals.bind(null, courierId);
  const [resetState, resetAction, resetPending] = useActionState(
    boundReset,
    initialReset,
  );
  const router = useRouter();

  useEffect(() => {
    if (resetState.ok) {
      router.refresh();
    }
  }, [resetState.ok, router]);

  return (
    <Fragment>
    <form action={formAction} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm">
          <span className={ad.label}>اسم المندوب</span>
          <input
            name="name"
            required
            defaultValue={defaultName}
            className={ad.input}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className={ad.label}>رقم الهاتف</span>
          <input
            name="phone"
            type="tel"
            inputMode="numeric"
            required
            defaultValue={defaultPhone}
            className={ad.input}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className={ad.label}>Telegram User ID (للإشعارات)</span>
          <input
            name="telegramUserId"
            inputMode="numeric"
            placeholder="مثال: 123456789"
            defaultValue={defaultTelegramUserId}
            className={ad.input}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm sm:col-span-2">
          <span className={ad.label}>نوع المركبة (لحساب أجر التوصيل)</span>
          <select
            name="vehicleType"
            className={ad.select}
            defaultValue={defaultVehicleType}
          >
            <option value="car">سيارة — ثلثي كلفة التوصيل لكل طلب مُسلَّم</option>
            <option value="bike">دراجة — نصف كلفة التوصيل لكل طلب مُسلَّم</option>
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm sm:col-span-2">
          <input
            type="checkbox"
            name="hiddenFromReports"
            defaultChecked={defaultHiddenFromReports}
            className="h-4 w-4 rounded border-sky-300"
          />
          <span className={ad.label}>إخفاء من قوائم الإسناد (لا يظهر عند اختيار مندوب)</span>
        </label>
        <label className="flex items-center gap-2 text-sm sm:col-span-2">
          <input
            type="checkbox"
            name="blocked"
            defaultChecked={defaultBlocked}
            className="h-4 w-4 rounded border-sky-300"
          />
          <span className={ad.label}>محظور — لا يظهر في الإسناد والتقرير</span>
        </label>
      </div>
      {state.error ? (
        <p className={ad.error} role="alert">
          {state.error}
        </p>
      ) : null}
      {state.ok ? <p className={ad.success}>تم حفظ التعديلات.</p> : null}
      <button type="submit" disabled={pending} className={ad.btnPrimary}>
        {pending ? "جارٍ الحفظ…" : "حفظ"}
      </button>
    </form>

    <div className="mt-8 border-t border-slate-200 pt-6">
      <h2 className={`${ad.h2} mb-1`}>لوحة المندوب — تصفير الأرقام</h2>
      <p className={`${ad.muted} mb-4 max-w-xl`}>
        زر «تصفير» يصفّر عرض الوارد والصادر والمتبقي وأرباحي للفترة الجديدة فقط، ويبدأ العد من جديد
        للحركات المسجّلة بعد التصفير. يُحفظ تلقائياً <strong>متبقي المحفظة</strong> الحالي في رصيد
        محمول حتى لا يضيع عند المتابعة بالصادر والوارد. لا يحذف الطلبات ولا الحركات من النظام.
      </p>
      <p className="mb-3 text-sm font-medium text-slate-700">
        الرصيد المحمول لـ «متبقي المحفظة» عند المندوب الآن:{" "}
        <span className="font-black tabular-nums text-violet-950">{mandoubWalletCarryOverLabel}</span>
      </p>
      {lastMandoubTotalsResetLabel ? (
        <p className="mb-3 text-sm font-medium text-slate-600">
          آخر تصفير مسجّل:{" "}
          <span className="font-bold tabular-nums text-slate-900">
            {lastMandoubTotalsResetLabel}
          </span>
        </p>
      ) : (
        <p className="mb-3 text-sm text-slate-500">لم يُجرَ تصفير بعد لهذا المندوب.</p>
      )}
      <form
        action={resetAction}
        className="flex flex-wrap items-center gap-3"
        onSubmit={(e) => {
          if (
            !window.confirm(
              "تأكيد تصفير أرقام لوحة المندوب؟ ستُصفَّر عرض الفترة للوارد/الصادر/المتبقي/أرباحي، ويُحفظ متبقي المحفظة الحالي في رصيد محمول، ثم تُحسب الحركات الجديدة فوق ذلك.",
            )
          ) {
            e.preventDefault();
          }
        }}
      >
        <button
          type="submit"
          disabled={resetPending}
          className="rounded-xl border-2 border-amber-500 bg-amber-50 px-5 py-2.5 text-sm font-black text-amber-950 shadow-sm transition hover:bg-amber-100 disabled:opacity-60"
        >
          {resetPending ? "جارٍ التصفير…" : "تصفير"}
        </button>
        {resetState.error ? (
          <p className={ad.error} role="alert">
            {resetState.error}
          </p>
        ) : null}
        {resetState.ok ? (
          <p className={ad.success}>
            تم التصفير. الأرقام تبدأ فترة جديدة مع الإبقاء على متبقي المحفظة في الرصيد المحمول.
          </p>
        ) : null}
      </form>
    </div>
    </Fragment>
  );
}
