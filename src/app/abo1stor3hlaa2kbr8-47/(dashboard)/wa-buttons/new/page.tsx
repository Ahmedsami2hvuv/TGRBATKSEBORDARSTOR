"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { upsertMandoubWaButton, type WaButtonsFormState } from "../actions";
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
  const [recipients, setRecipients] = useState<string[]>(["customer"]);
  const [showNextToLocation, setShowNextToLocation] = useState(false);

  const toggleRecipient = (val: string) => {
    setRecipients((prev) => {
      let next;
      if (prev.includes(val)) {
        next = prev.filter((s) => s !== val);
      } else {
        next = [...new Set([...prev, val])];
      }
      return next.length ? next : ["customer"];
    });
  };

  useEffect(() => {
    if (state.ok) {
      router.push("/abo1stor3hlaa2kbr8-47/wa-buttons");
      router.refresh();
    }
  }, [state.ok, router]);

  const toggleVisibility = (val: VisibilityScope) => {
    setVisibilityScopes((prev) => {
      if (val === "all") {
        return prev.includes("all") ? [] : ["all"];
      }
      const withoutAll = prev.filter((x) => x !== "all");
      const next = withoutAll.includes(val)
        ? withoutAll.filter((x) => x !== val)
        : [...withoutAll, val];
      return next.length ? next : ["all"];
    });
  };

  const toggleLocationRule = (val: CustomerLocationRule) => {
    setCustomerLocationRules((prev) => {
      if (val === "any") {
        return prev.includes("any") ? [] : ["any"];
      }
      const withoutAny = prev.filter((x) => x !== "any");
      const next = withoutAny.includes(val)
        ? withoutAny.filter((x) => x !== val)
        : [...withoutAny, val];
      return next.length ? next : ["any"];
    });
  };

  const toggleStatus = (val: string) => {
    setStatuses((prev) => {
      if (prev.includes(val)) {
        return prev.filter((s) => s !== val);
      }
      return [...new Set([...prev, val])];
    });
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-12">
      {/* الترويسة الرئيسية */}
      <div className="rounded-3xl border border-sky-150 bg-gradient-to-r from-sky-50 via-white to-cyan-50/40 p-6 sm:p-7 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-sky-200 bg-sky-500 text-3xl shadow-sm text-white">
              ➕
            </div>
            <div>
              <h1 className="text-2xl font-extrabold text-slate-900 sm:text-3xl">
                إضافة زر واتساب جديد
              </h1>
              <p className="mt-1 text-sm text-slate-600">
                عرّف خصائص وحالات ظهور الزر الجديد، ثم ستتمكن من كتابة نماذج الرسائل مباشرة.
              </p>
            </div>
          </div>

          <Link
            href="/abo1stor3hlaa2kbr8-47/wa-buttons"
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50 transition shadow-sm"
          >
            ← العودة للقائمة
          </Link>
        </div>
      </div>

      <div className="rounded-3xl border border-sky-150 bg-white p-6 sm:p-8 shadow-sm">
        <form action={formAction} className="space-y-6">
          <input type="hidden" name="id" value="" />
          <input type="hidden" name="recipient" value={recipients.join(",")} />
          <input type="hidden" name="showNextToLocation" value={showNextToLocation ? "true" : "false"} />

          <div className="grid gap-6 sm:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                <span>اسم الزر</span>
                <span className="text-rose-500">*</span>
              </label>
              <input
                name="label"
                className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-2.5 text-base font-bold text-slate-800 outline-none focus:border-sky-500 focus:bg-white focus:ring-2 focus:ring-sky-100 transition"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                required
                autoComplete="off"
                placeholder="مثال: تأكيد الطلب، لوكيشن الزبون، وصول المندوب..."
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-800">أيقونة الزر</label>
              <select
                name="iconKey"
                className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-2.5 text-base font-bold text-slate-800 outline-none focus:border-sky-500 focus:bg-white focus:ring-2 focus:ring-sky-100 transition"
                value={iconKey}
                onChange={(e) => setIconKey(e.target.value)}
              >
                {ICON_CHOICES.map((ic) => (
                  <option key={ic} value={ic}>
                    {ic}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-5 pt-2">
            {/* 1. من يظهر له الزر */}
            <div className="rounded-2xl border border-sky-100 bg-sky-50/20 p-5 space-y-3">
              <div className="flex items-center justify-between border-b border-sky-100 pb-2">
                <span className="text-sm font-extrabold text-slate-800">
                  1. من يظهر له الزر (Visibility Scope)
                </span>
                <span className="text-xs text-slate-500">اختر الفئات المصرح لها</span>
              </div>
              <div className="flex flex-wrap gap-2 pt-1">
                {VISIBILITY_OPTIONS.map((opt) => {
                  const isSelected = visibilityScopes.includes(opt.value);
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => toggleVisibility(opt.value)}
                      className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs sm:text-sm font-extrabold transition shadow-2xs ${
                        isSelected
                          ? "bg-sky-600 text-white shadow-sm"
                          : "bg-white text-slate-700 border border-slate-200 hover:bg-sky-50"
                      }`}
                    >
                      <span>{isSelected ? "✓" : "+"}</span>
                      <span>{opt.label}</span>
                    </button>
                  );
                })}
              </div>
              {visibilityScopes.map((v) => (
                <input key={v} type="hidden" name="visibilityScopes" value={v} />
              ))}
            </div>

            {/* 2. حالة لوكيشن الزبون */}
            <div className="rounded-2xl border border-sky-100 bg-sky-50/20 p-5 space-y-3">
              <div className="flex items-center justify-between border-b border-sky-100 pb-2">
                <span className="text-sm font-extrabold text-slate-800">
                  2. شرط توفر لوكيشن الزبون
                </span>
                <span className="text-xs text-slate-500">متى يظهر الزر حسب موقع الزبون</span>
              </div>
              <div className="flex flex-wrap gap-2 pt-1">
                {(
                  [
                    { value: "any", label: "الكل (في جميع الحالات)" },
                    { value: "exists", label: "موجود لوكيشن للزبون" },
                    { value: "missing", label: "بدون لوكيشن (اللوكيشن مفقود)" },
                    { value: "courier_gps", label: "لوكيشن مرفوع من المندوب (GPS)" },
                  ] as Array<{ value: CustomerLocationRule; label: string }>
                ).map((opt) => {
                  const isSelected = customerLocationRules.includes(opt.value);
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => toggleLocationRule(opt.value)}
                      className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs sm:text-sm font-extrabold transition shadow-2xs ${
                        isSelected
                          ? "bg-sky-600 text-white shadow-sm"
                          : "bg-white text-slate-700 border border-slate-200 hover:bg-sky-50"
                      }`}
                    >
                      <span>{isSelected ? "✓" : "+"}</span>
                      <span>{opt.label}</span>
                    </button>
                  );
                })}
              </div>
              {customerLocationRules.map((r) => (
                <input key={r} type="hidden" name="customerLocationRules" value={r} />
              ))}
            </div>

            {/* 3. حالات الطلب */}
            <div className="rounded-2xl border border-sky-100 bg-sky-50/20 p-5 space-y-3">
              <div className="flex items-center justify-between border-b border-sky-100 pb-2">
                <span className="text-sm font-extrabold text-slate-800">
                  3. حالات الطلب لظهور الزر
                </span>
                <span className="text-xs text-slate-500">الحالات التي ينشط فيها الزر</span>
              </div>
              <div className="flex flex-wrap gap-2 pt-1">
                {ORDER_STATUS_OPTIONS.map((opt) => {
                  const isSelected = statuses.includes(opt.value);
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => toggleStatus(opt.value)}
                      className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs sm:text-sm font-extrabold transition shadow-2xs ${
                        isSelected
                          ? "bg-sky-600 text-white shadow-sm"
                          : "bg-white text-slate-700 border border-slate-200 hover:bg-sky-50"
                      }`}
                    >
                      <span>{isSelected ? "✓" : "+"}</span>
                      <span>{opt.label}</span>
                    </button>
                  );
                })}
              </div>
              {statuses.map((st) => (
                <input key={st} type="hidden" name="statuses" value={st} />
              ))}
            </div>

            {/* 4. موقع الإظهار المباشر بجانب زر اللوكيشن */}
            <div className="rounded-2xl border border-indigo-200 bg-indigo-50/30 p-5 space-y-2">
              <div className="flex items-center justify-between">
                <label className="inline-flex items-center gap-2.5 text-sm font-extrabold text-slate-900 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={showNextToLocation}
                    onChange={(e) => setShowNextToLocation(e.target.checked)}
                    className="h-5 w-5 rounded border-indigo-400 text-indigo-600 focus:ring-indigo-300"
                  />
                  <span>📍 إظهار بجانب زر رفع / لصق اللوكيشن في تفاصيل الطلب</span>
                </label>
              </div>
              <p className="text-xs text-slate-600 pr-7">
                عند التفعيل، سيظهر هذا الزر بنصف الحجم بجانب زر رفع اللوكيشن في تفاصيل الطلبية لدى المندوب والإدارة للوصول السريع.
              </p>
            </div>

            {/* 5. جهات الاتصال المستلمة */}
            <div className="rounded-2xl border border-sky-100 bg-sky-50/20 p-5 space-y-3">
              <div className="flex items-center justify-between border-b border-sky-100 pb-2">
                <span className="text-sm font-extrabold text-slate-800">
                  5. جهات الاتصال المستلمة (Recipient)
                </span>
                <span className="text-xs text-slate-500">لمن تُرسل الرسالة</span>
              </div>
              <div className="flex flex-wrap gap-2 pt-1">
                {[
                  { value: "customer", label: "الزبون الأول (رقم الهاتف 1)" },
                  { value: "customer2", label: "الزبون الثاني (رقم الهاتف 2)" },
                  { value: "shop", label: "المحل / العميل صاحب الطلب" },
                ].map((opt) => {
                  const isSelected = recipients.includes(opt.value);
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => toggleRecipient(opt.value)}
                      className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs sm:text-sm font-extrabold transition shadow-2xs ${
                        isSelected
                          ? "bg-purple-600 text-white shadow-sm"
                          : "bg-white text-slate-700 border border-slate-200 hover:bg-purple-50"
                      }`}
                    >
                      <span>{isSelected ? "✓" : "+"}</span>
                      <span>{opt.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {state.error ? (
            <p className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-bold text-rose-700">
              {state.error}
            </p>
          ) : null}

          <div className="pt-4 border-t border-slate-200 flex items-center gap-3">
            <button
              type="submit"
              disabled={pending}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-sky-600 px-6 py-3 text-base font-extrabold text-white shadow-md shadow-sky-200 transition hover:bg-sky-700 disabled:opacity-50"
            >
              <span>➕</span>
              <span>{pending ? "جارٍ الإنشاء…" : "إنشاء الزر وحفظه"}</span>
            </button>
            <Link
              href="/abo1stor3hlaa2kbr8-47/wa-buttons"
              className="inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white px-5 py-3 text-base font-bold text-slate-700 hover:bg-slate-50 transition"
            >
              إلغاء
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}

