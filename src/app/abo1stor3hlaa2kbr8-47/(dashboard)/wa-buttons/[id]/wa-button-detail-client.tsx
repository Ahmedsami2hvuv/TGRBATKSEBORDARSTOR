"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  upsertMandoubWaButton,
  updateMandoubWaButtonTemplates,
  type WaButtonsFormState,
} from "../actions";
import { ad } from "@/lib/admin-ui";
import {
  ICON_CHOICES,
  ORDER_STATUS_OPTIONS,
  VISIBILITY_OPTIONS,
  WA_BUTTON_VARIABLE_CHIPS,
  parseLocationRulesCsv,
  parseStatusesCsv,
  parseVisibilityScopesCsv,
  type CustomerLocationRule,
  type VisibilityScope,
} from "../wa-buttons-constants";
import { splitMandoubWaTemplateVariants } from "@/lib/mandoub-wa-button-template";
import Link from "next/link";

type Props = {
  row: {
    id: string;
    name: string;
    label: string;
    iconKey: string;
    templateText: string;
    statusesCsv: string;
    visibilityScope: string;
    customerLocationRule: string;
    isActive: boolean;
    recipient: string;
    showNextToLocation?: boolean;
  };
};

export function WaButtonDetailClient({ row }: Props) {
  const router = useRouter();

  // --- Form 1: Button Properties ---
  const [propState, propFormAction, propPending] = useActionState(
    upsertMandoubWaButton,
    {} as WaButtonsFormState
  );
  const [label, setLabel] = useState(row.label);
  const [iconKey, setIconKey] = useState(row.iconKey);
  const [showNextToLocation, setShowNextToLocation] = useState(row.showNextToLocation ?? false);
  const [statuses, setStatuses] = useState<string[]>(() => parseStatusesCsv(row.statusesCsv));
  const [visibilityScopes, setVisibilityScopes] = useState<VisibilityScope[]>(() =>
    parseVisibilityScopesCsv(row.visibilityScope)
  );
  const [customerLocationRules, setCustomerLocationRules] = useState<CustomerLocationRule[]>(() =>
    parseLocationRulesCsv(row.customerLocationRule)
  );
  const [recipients, setRecipients] = useState<string[]>(() => {
    const raw = row.recipient ?? "customer";
    return raw.split(",").map((s) => s.trim()).filter(Boolean);
  });

  const toggleRecipient = (val: string, checked: boolean) => {
    setRecipients((prev) => {
      let next;
      if (checked) {
        next = [...new Set([...prev, val])];
      } else {
        next = prev.filter((s) => s !== val);
      }
      return next.length ? next : ["customer"];
    });
  };

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

  // --- Form 2: Templates / Variants ---
  const [tempState, tempFormAction, tempPending] = useActionState(
    updateMandoubWaButtonTemplates,
    {} as WaButtonsFormState
  );
  const [templateVariants, setTemplateVariants] = useState<string[]>(() =>
    splitMandoubWaTemplateVariants(row.templateText)
  );
  const [draftTemplate, setDraftTemplate] = useState("");
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  const draftTextareaRef = useRef<HTMLTextAreaElement>(null);
  const nextDraftCursorRef = useRef<number | null>(null);

  const combinedTemplateText = useMemo(() => {
    const parts = templateVariants.map((s, i) =>
      editingIndex === i ? draftTemplate : s
    );
    const cleaned = parts.map((s) => s.trim()).filter(Boolean);
    if (editingIndex === null) {
      const d = draftTemplate.trim();
      if (d) cleaned.push(d);
    }
    return cleaned.join("\n---\n");
  }, [templateVariants, editingIndex, draftTemplate]);

  useEffect(() => {
    const el = draftTextareaRef.current;
    const cursor = nextDraftCursorRef.current;
    if (!el || cursor == null) return;
    el.setSelectionRange(cursor, cursor);
    nextDraftCursorRef.current = null;
  }, [draftTemplate]);

  function addDraftAsVariant() {
    if (editingIndex !== null) return;
    const t = draftTemplate.trim();
    if (!t) return;
    setTemplateVariants((prev) => [...prev, t]);
    setDraftTemplate("");
  }

  function startEditVariant(idx: number) {
    if (editingIndex !== null && editingIndex !== idx) {
      window.alert("أنهِ التعديل الحالي (تطبيق أو إلغاء) قبل تعديل نموذج آخر.");
      return;
    }
    if (editingIndex === idx) return;
    setDraftTemplate(templateVariants[idx] ?? "");
    setEditingIndex(idx);
    draftTextareaRef.current?.focus();
  }

  function applyEditVariant() {
    if (editingIndex === null) return;
    const t = draftTemplate.trim();
    if (!t) return;
    setTemplateVariants((prev) => {
      const next = [...prev];
      next[editingIndex] = t;
      return next;
    });
    setEditingIndex(null);
    setDraftTemplate("");
  }

  function cancelEditVariant() {
    setEditingIndex(null);
    setDraftTemplate("");
  }

  function insertVariable(key: string) {
    const el = draftTextareaRef.current;
    if (!el) return;
    el.focus();

    const token = `{{{${key}}}}`;
    const start = el.selectionStart ?? el.value.length;
    const end = el.selectionEnd ?? el.value.length;

    const next = el.value.slice(0, start) + token + el.value.slice(end);
    setDraftTemplate(next);
    nextDraftCursorRef.current = start + token.length;
  }

  // Refresh router data when actions complete
  useEffect(() => {
    if (propState.ok || tempState.ok) {
      router.refresh();
    }
  }, [propState.ok, tempState.ok, router]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className={ad.h1}>إدارة وتعديل زر: {row.label}</h1>
          <p className={ad.lead}>تحكم في شروط ظهور هذا الزر، وقم بإنشاء وتعديل نماذج رسائله.</p>
        </div>
        <Link
          href="/abo1stor3hlaa2kbr8-47/wa-buttons"
          className={ad.btnDark}
        >
          ← العودة إلى القائمة
        </Link>
      </div>

      {/* Main Grid */}
      <div className="grid gap-6 lg:grid-cols-12 items-start">
        {/* Column 1: Properties Form (Left) */}
        <div className={`${ad.section} lg:col-span-5 space-y-4`}>
          <h2 className={ad.h2}>⚙️ خصائص وشروط الزر</h2>
          <form action={propFormAction} className="space-y-4">
            <input type="hidden" name="id" value={row.id} />
            <input type="hidden" name="name" value={row.name} />
            <input type="hidden" name="recipient" value={recipients.join(",")} />

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
                />
              </label>

              <label className="flex flex-col gap-1 text-sm">
                <span className={ad.label}>أيقونة</span>
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

            <div className="space-y-3 rounded-xl border border-sky-100 bg-sky-50/10 p-3.5">
              <p className="text-xs font-bold text-slate-800 border-b border-sky-100/60 pb-1.5">
                يظهر للمستخدمين (Visibility)
              </p>
              <div className="flex flex-wrap gap-x-4 gap-y-2">
                {VISIBILITY_OPTIONS.map((opt) => (
                  <label key={opt.value} className="inline-flex items-center gap-2 text-sm cursor-pointer select-none">
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
            </div>

            <div className="space-y-3 rounded-xl border border-sky-100 bg-sky-50/10 p-3.5">
              <p className="text-xs font-bold text-slate-800 border-b border-sky-100/60 pb-1.5">
                حالة لوكيشن الزبون
              </p>
              <div className="flex flex-wrap gap-x-4 gap-y-2">
                {(
                  [
                    { value: "any", label: "الكل" },
                    { value: "exists", label: "موجود لوكيشن" },
                    { value: "missing", label: "بدون لوكيشن" },
                    { value: "courier_gps", label: "مرفوع GPS" },
                  ] as Array<{ value: CustomerLocationRule; label: string }>
                ).map((opt) => (
                  <label key={opt.value} className="inline-flex items-center gap-2 text-sm cursor-pointer select-none">
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
            </div>

            <div className="space-y-3 rounded-xl border border-sky-100 bg-sky-50/10 p-3.5">
              <p className="text-xs font-bold text-slate-800 border-b border-sky-100/60 pb-1.5">
                حالات الطلب لظهور الزر
              </p>
              <div className="grid grid-cols-2 gap-2">
                {ORDER_STATUS_OPTIONS.map((opt) => (
                  <label key={opt.value} className="inline-flex items-center gap-2 text-sm cursor-pointer select-none">
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

            <div className="space-y-3 rounded-xl border border-emerald-100 bg-emerald-50/20 p-3.5">
              <p className="text-xs font-bold text-emerald-900 border-b border-emerald-100 pb-1.5 flex items-center gap-1.5">
                <span>📍 موقع الإظهار المباشر</span>
              </p>
              <label className="inline-flex items-center gap-2 text-sm font-bold text-slate-800 cursor-pointer select-none">
                <input
                  type="checkbox"
                  name="showNextToLocation"
                  value="true"
                  checked={showNextToLocation}
                  onChange={(e) => setShowNextToLocation(e.target.checked)}
                  className="rounded border-emerald-400 text-emerald-600 focus:ring-emerald-200 h-4 w-4"
                />
                <span>إظهار بجانب زر رفع/لصق لوكيشن</span>
              </label>
              <p className="text-[11px] text-slate-500">
                عند تحديد هذا الخيار، سيظهر هذا الزر بنصف الحجم بجانب زر رفع اللوكيشن في تفاصيل الطلبية لدى المندوب والإدارة.
              </p>
            </div>

            <div className="space-y-3 rounded-xl border border-sky-100 bg-sky-50/10 p-3.5">
              <p className="text-xs font-bold text-slate-800 border-b border-sky-100/60 pb-1.5">
                جهات الاتصال المستلمة للرسالة (Recipient)
              </p>
              <div className="flex flex-wrap gap-x-4 gap-y-2">
                {[
                  { value: "shop", label: "المحل (العميل)" },
                  { value: "customer", label: "الزبون الأول" },
                  { value: "customer2", label: "الزبون الثاني" },
                ].map((opt) => (
                  <label key={opt.value} className="inline-flex items-center gap-2 text-sm cursor-pointer select-none">
                    <input
                      type="checkbox"
                      value={opt.value}
                      checked={recipients.includes(opt.value)}
                      onChange={(e) => toggleRecipient(opt.value, e.target.checked)}
                      className="rounded border-sky-300 text-sky-600 focus:ring-sky-200"
                    />
                    <span>{opt.label}</span>
                  </label>
                ))}
              </div>
              <p className="text-[11px] text-slate-500">
                اختر جهات الاتصال المسموح بظهورها عند نقر هذا الزر. إذا اخترت جهة واحدة، فسيتم الإرسال إليها مباشرة دون تخيير المندوب.
              </p>
            </div>

            {propState.error ? <p className={ad.error}>{propState.error}</p> : null}
            {propState.ok ? <p className={ad.success}>✓ تم حفظ التغييرات بنجاح.</p> : null}

            <button
              type="submit"
              disabled={propPending}
              className={`${ad.btnPrimary} w-full`}
            >
              {propPending ? "جارٍ الحفظ…" : "حفظ خصائص الزر"}
            </button>
          </form>
        </div>

        {/* Column 2: Templates & Messages Form (Right) */}
        <div className={`${ad.section} lg:col-span-7 space-y-4`}>
          <h2 className={ad.h2}>📝 إدارة نماذج وصيغ الرسائل</h2>

          <form action={tempFormAction} className="space-y-4">
            <input type="hidden" name="id" value={row.id} />
            <input type="hidden" name="templateText" value={combinedTemplateText} readOnly />

            <div className="rounded-xl border border-sky-150 bg-sky-50/30 p-4 space-y-3">
              <p className="text-xs font-bold text-slate-800">مربع كتابة مسودة الرسالة</p>

              <textarea
                ref={draftTextareaRef}
                className={`${ad.input} w-full min-h-[120px] resize-y font-mono text-sm`}
                value={draftTemplate}
                onChange={(e) => setDraftTemplate(e.target.value)}
                placeholder="اكتب نموذج الرسالة هنا، يمكنك استخدام المتغيرات أدناه..."
                aria-label="مسودة الرسالة"
              />

              <div className="flex flex-wrap items-center gap-2">
                {editingIndex !== null ? (
                  <>
                    <button
                      type="button"
                      onClick={applyEditVariant}
                      className={ad.btnPrimary}
                    >
                      تطبيق التعديل على القائمة
                    </button>
                    <button
                      type="button"
                      onClick={cancelEditVariant}
                      className={ad.btnDark}
                    >
                      إلغاء التعديل
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={addDraftAsVariant}
                    className={ad.btnDark}
                  >
                    ➕ إضافة كصيغة نموذج جديدة
                  </button>
                )}
              </div>
              <p className="text-[11px] text-slate-500">
                {editingIndex !== null
                  ? "عدّل النص داخل المربع ثم طبّق التعديل."
                  : "بعد كتابة صيغة الرسالة، اضغط «إضافة كصيغة نموذج جديدة» لتجميعها في القائمة بالأسفل، ثم احفظ بالضغط على «حفظ جميع النماذج»."}
              </p>
            </div>

            {/* Variable insertion */}
            <div className="space-y-2">
              <p className="text-xs font-bold text-slate-700">إدراج متغير في النص:</p>
              <div className="flex flex-wrap gap-1.5">
                {WA_BUTTON_VARIABLE_CHIPS.map((v) => (
                  <button
                    key={v.key}
                    type="button"
                    onClick={() => insertVariable(v.key)}
                    className="rounded-xl border border-sky-200 bg-white px-2.5 py-1 text-xs font-bold text-sky-900 hover:bg-sky-50 transition"
                    title={`${v.label} — {{{${v.key}}}}`}
                  >
                    {v.label} · {"{{{" + v.key + "}}}"}
                  </button>
                ))}
              </div>
            </div>

            {/* List of current variants */}
            <div className="space-y-3">
              <h3 className="text-sm font-bold text-slate-800 border-b border-slate-100 pb-1.5">
                قائمة صيغ النماذج الحالية للزر
              </h3>

              {templateVariants.length > 0 ? (
                <ul className="space-y-2.5">
                  {templateVariants.map((text, idx) => (
                    <li
                      key={`v-${idx}-${text.slice(0, 16)}`}
                      className="flex flex-wrap items-start gap-3 rounded-xl border border-sky-100 bg-slate-50/50 p-3"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-sky-100 text-[10px] font-bold text-sky-900">
                            {idx + 1}
                          </span>
                          <span className="text-xs font-bold text-slate-500">صيغة نموذج</span>
                        </div>

                        {editingIndex === idx ? (
                          <p className="mt-1 text-xs font-bold text-amber-800 animate-pulse">
                            ⚠️ يتم تعديل هذا النموذج في الصندوق بالأعلى...
                          </p>
                        ) : (
                          <pre className="mt-2 max-h-32 overflow-y-auto whitespace-pre-wrap break-words font-mono text-xs text-slate-800 rounded bg-white p-2 border border-slate-100">
                            {text}
                          </pre>
                        )}
                      </div>

                      <div className="flex gap-1.5 self-center">
                        {editingIndex !== idx ? (
                          <>
                            <button
                              type="button"
                              onClick={() => startEditVariant(idx)}
                              className="rounded-lg border border-sky-200 bg-white px-2 py-1 text-xs font-semibold text-sky-850 hover:bg-sky-50 transition"
                            >
                              تعديل
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                setTemplateVariants((prev) => prev.filter((_, i) => i !== idx))
                              }
                              className="rounded-lg border border-rose-200 bg-white px-2 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-50 transition"
                            >
                              حذف
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              setTemplateVariants((prev) => prev.filter((_, i) => i !== idx));
                              cancelEditVariant();
                            }}
                            className="rounded-lg border border-rose-200 bg-white px-2 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-50 transition"
                          >
                            حذف
                          </button>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-slate-500 italic">لا توجد صيغ مدخلة. اكتب صيغة بالأعلى وأضفها.</p>
              )}
            </div>

            {tempState.error ? <p className={ad.error}>{tempState.error}</p> : null}
            {tempState.ok ? <p className={ad.success}>✓ تم حفظ جميع صيغ النماذج بنجاح.</p> : null}

            <div className="flex items-center gap-3 pt-4 border-t border-slate-100">
              <button
                type="submit"
                disabled={tempPending}
                className={ad.btnPrimary}
              >
                {tempPending ? "جارٍ الحفظ…" : "حفظ جميع النماذج"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
