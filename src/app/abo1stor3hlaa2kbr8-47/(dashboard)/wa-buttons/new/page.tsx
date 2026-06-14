"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { upsertMandoubWaButton, type WaButtonsFormState } from "../actions";
import { ad } from "@/lib/admin-ui";
import {
  ICON_CHOICES,
  ORDER_STATUS_OPTIONS,
  VISIBILITY_OPTIONS,
  type CustomerLocationRule,
  type VisibilityScope,
} from "../wa-buttons-constants";
import Link from "next/link";

export default function NewWaButtonPage() {
  const router = useRouter();
  const initialState: WaButtonsFormState = {};
  const [state, formAction, pending] = useActionState(upsertMandoubWaButton, initialState);

  const [label, setLabel] = useState("");
  const [iconKey, setIconKey] = useState("💬");
  const [statuses, setStatuses] = useState<string[]>(["assigned", "delivering"]);
  const [visibilityScopes, setVisibilityScopes] = useState<VisibilityScope[]>(["all"]);
  const [customerLocationRules, setCustomerLocationRules] = useState<CustomerLocationRule[]>(["any"]);

  useEffect(() => {
    if (state.ok) {
      router.push("/abo1stor3hlaa2kbr8-47/wa-buttons");
      router.refresh();
    }
  }, [state.ok, router]);

  const toggleVisibility = (val: VisibilityScope, checked: boolean) => {
    setVisibilityScopes((prev) => {
      if (val === "all") {
        return checked ? ["all"] : [];
      }
      const withoutAll = prev.filter((x) => x !== "all");
      const next = checked ? [...withoutAll, val] : withoutAll.filter((x) => x !== val);
      return next.length ? next : ["all"];
    });
  };

  const toggleLocationRule = (val: CustomerLocationRule, checked: boolean) => {
    setCustomerLocationRules((prev) => {
      if (val === "any") {
        return checked ? ["any"] : [];
      }
      const withoutAny = prev.filter((x) => x !== "any");
      const next = checked ? [...withoutAny, val] : withoutAny.filter((x) => x !== val);
      return next.length ? next : ["any"];
    });
  };

  const toggleStatus = (val: string, checked: boolean) => {
    setStatuses((prev) => {
      if (checked) return [...new Set([...prev, val])];
      return prev.filter((s) => s !== val);
    });
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className={ad.h1}>إضافة زر واتساب جديد</h1>
          <p className={ad.lead}>عرّف خصائص وحالات ظهور الزر الجديد.</p>
        </div>
        <Link
          href="/abo1stor3hlaa2kbr8-47/wa-buttons"
          className={ad.btnDark}
        >
          ← العودة للقائمة
        </Link>
      </div>

      <div className={ad.section}>
        <form action={formAction} className="space-y-6">
          {/* We omit id for a new record */}
          <input type="hidden" name="id" value="" />

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-sm">
              <span className={ad.label}>اسم الزر</span>
              <input
                name="label"
                className={ad.input}
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                required
                autoComplete="off"
                placeholder="مثال: لوكيشن الزبون، تأكيد الطلب..."
              />
            </label>

            <label className="flex flex-col gap-1 text-sm">
              <span className={ad.label}>أيقونة الزر</span>
              <select
                name="iconKey"
                className={ad.select}
                value={iconKey}
                onChange={(e) => setIconKey(e.target.value)}
              >
                {ICON_CHOICES.map((ic) => (
                  <option key={ic} value={ic}>
                    {ic}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="space-y-4 rounded-xl border border-sky-100 bg-sky-50/20 p-4">
            <h3 className="text-sm font-bold text-slate-800 border-b border-sky-100 pb-2">شروط ظهور الزر</h3>

            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-2">
                <p className="text-xs font-bold text-slate-700">1. من يظهر له الزر (Visibility Scope)</p>
                <div className="flex flex-wrap gap-x-4 gap-y-2">
                  {VISIBILITY_OPTIONS.map((opt) => (
                    <label
                      key={opt.value}
                      className="inline-flex items-center gap-2 text-sm cursor-pointer select-none"
                    >
                      <input
                        type="checkbox"
                        name="visibilityScopes"
                        value={opt.value}
                        checked={visibilityScopes.includes(opt.value)}
                        onChange={(e) => toggleVisibility(opt.value, e.target.checked)}
                        className="rounded border-sky-300 text-sky-600 focus:ring-sky-200"
                      />
                      <span>{opt.label}</span>
                    </label>
                  ))}
                </div>
                <p className="text-[11px] text-slate-500">
                  إذا اخترت «الكل» فستُلغى الاختيارات الأخرى ويظهر للجميع.
                </p>
              </div>

              <div className="space-y-2">
                <p className="text-xs font-bold text-slate-700">2. حالة لوكيشن الزبون</p>
                <div className="flex flex-wrap gap-x-4 gap-y-2">
                  {(
                    [
                      { value: "any", label: "الكل" },
                      { value: "exists", label: "موجود لوكيشن" },
                      { value: "missing", label: "بدون لوكيشن" },
                      {
                        value: "courier_gps",
                        label: "مرفوع GPS",
                      },
                    ] as Array<{ value: CustomerLocationRule; label: string }>
                  ).map((opt) => (
                    <label
                      key={opt.value}
                      className="inline-flex items-center gap-2 text-sm cursor-pointer select-none"
                    >
                      <input
                        type="checkbox"
                        name="customerLocationRules"
                        value={opt.value}
                        checked={customerLocationRules.includes(opt.value)}
                        onChange={(e) => toggleLocationRule(opt.value, e.target.checked)}
                        className="rounded border-sky-300 text-sky-600 focus:ring-sky-200"
                      />
                      <span>{opt.label}</span>
                    </label>
                  ))}
                </div>
                <p className="text-[11px] text-slate-500">
                  تحديد ظهور الزر بناءً على توفر لوكيشن للزبون في النظام.
                </p>
              </div>
            </div>

            <div className="space-y-2 pt-2 border-t border-sky-100/60">
              <p className="text-xs font-bold text-slate-700">3. حالات الطلب لظهور الزر</p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {ORDER_STATUS_OPTIONS.map((opt) => (
                  <label
                    key={opt.value}
                    className="inline-flex items-center gap-2 text-sm cursor-pointer select-none"
                  >
                    <input
                      type="checkbox"
                      name="statuses"
                      value={opt.value}
                      checked={statuses.includes(opt.value)}
                      onChange={(e) => toggleStatus(opt.value, e.target.checked)}
                      className="rounded border-sky-300 text-sky-600 focus:ring-sky-200"
                    />
                    <span>{opt.label}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          {state.error ? <p className={ad.error}>{state.error}</p> : null}

          <div className="flex items-center gap-3 pt-4 border-t border-slate-100">
            <button
              type="submit"
              disabled={pending}
              className={ad.btnPrimary}
            >
              {pending ? "جارٍ الحفظ…" : "إضافة الزر وحفظه"}
            </button>
            <Link
              href="/abo1stor3hlaa2kbr8-47/wa-buttons"
              className={ad.btnDark}
            >
              إلغاء
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
