"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  upsertMandoubWaButton,
  updateMandoubWaButtonTemplates,
  type WaButtonsFormState,
} from "../actions";
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
import {
  splitMandoubWaTemplateVariants,
  applyMandoubWaTemplate,
} from "@/lib/mandoub-wa-button-template";
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

const SAMPLE_DATA: Record<string, string> = {
  clientshop: "متجر الفخامة للأزياء",
  city: "بغداد - المنصور",
  total_price: "45,000 د.ع",
  delivery: "أحمد المندوب",
  location_url: "https://maps.google.com/?q=33.3152,44.3661",
  landmark: "قرب تقاطع الرواد - مقابل مول المنصور",
  order_number: "#ORD-9842",
  customer_phone: "07701234567",
  customer_phone2: "07809876543",
  shop_phone: "07700000000",
  driver_review_url: "https://aboakbr.com/rate-driver?order=9842",
};

export function WaButtonDetailClient({ row }: Props) {
  const router = useRouter();

  // --- تبويبات الصفحة أو الشاشة ---
  const [activeTab, setActiveTab] = useState<"templates" | "properties">("templates");

  // --- Form 1: Button Properties ---
  const [propState, propFormAction, propPending] = useActionState(
    upsertMandoubWaButton,
    {} as WaButtonsFormState
  );
  const [label, setLabel] = useState(row.label);
  const [iconKey, setIconKey] = useState(row.iconKey || "💬");
  const [showNextToLocation, setShowNextToLocation] = useState(row.showNextToLocation ?? false);

  useEffect(() => {
    setShowNextToLocation(row.showNextToLocation ?? false);
  }, [row.showNextToLocation]);

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

  // --- Form 2: Direct Inline Templates Management ---
  const [tempState, tempFormAction, tempPending] = useActionState(
    updateMandoubWaButtonTemplates,
    {} as WaButtonsFormState
  );

  // مصفوفة النماذج (كل نموذج نص مستقل)
  const [variants, setVariants] = useState<string[]>(() => {
    const loaded = splitMandoubWaTemplateVariants(row.templateText);
    return loaded.length ? loaded : [""];
  });

  // مصفوفة حالات المعاينة الحية للنماذج
  const [previewOpen, setPreviewOpen] = useState<Record<number, boolean>>({});

  // مصفوفة مؤشرات التركيز في كل مربع نص
  const textareaRefs = useRef<(HTMLTextAreaElement | null)[]>([]);

  // تحويل النماذج إلى النص الكامل المجمع لقاعدة البيانات
  const combinedTemplateText = useMemo(() => {
    return variants
      .map((s) => s.trim())
      .filter(Boolean)
      .join("\n---\n");
  }, [variants]);

  // تحديث نص نموذج معين في مكانه مباشرة
  const updateVariantText = (index: number, newText: string) => {
    setVariants((prev) => {
      const next = [...prev];
      next[index] = newText;
      return next;
    });
  };

  // إضافة نموذج رسالة جديد في الأسفل والتركيز عليه
  const addNewVariant = () => {
    setVariants((prev) => [...prev, ""]);
    setTimeout(() => {
      const lastIndex = variants.length;
      textareaRefs.current[lastIndex]?.focus();
    }, 100);
  };

  // تكرار / نسخ نموذج معين
  const duplicateVariant = (index: number) => {
    setVariants((prev) => {
      const next = [...prev];
      next.splice(index + 1, 0, prev[index]);
      return next;
    });
  };

  // حذف نموذج
  const removeVariant = (index: number) => {
    if (variants.length <= 1) {
      // تفريغ النموذج إذا كان الوحيد
      setVariants([""]);
      return;
    }
    setVariants((prev) => prev.filter((_, i) => i !== index));
  };

  // تحريك النموذج لأعلى
  const moveVariantUp = (index: number) => {
    if (index === 0) return;
    setVariants((prev) => {
      const next = [...prev];
      const temp = next[index - 1];
      next[index - 1] = next[index];
      next[index] = temp;
      return next;
    });
  };

  // تحريك النموذج لأسفل
  const moveVariantDown = (index: number) => {
    if (index === variants.length - 1) return;
    setVariants((prev) => {
      const next = [...prev];
      const temp = next[index + 1];
      next[index + 1] = next[index];
      next[index] = temp;
      return next;
    });
  };

  // إدراج متغير في مكان المؤشر داخل مربع نص نموذج محدد
  const insertVariableIntoVariant = (index: number, varKey: string) => {
    const el = textareaRefs.current[index];
    const currentVal = variants[index] || "";
    const token = `{{{${varKey}}}}`;

    if (!el) {
      updateVariantText(index, currentVal + " " + token);
      return;
    }

    const start = el.selectionStart ?? currentVal.length;
    const end = el.selectionEnd ?? currentVal.length;
    const nextVal = currentVal.slice(0, start) + token + currentVal.slice(end);

    updateVariantText(index, nextVal);

    setTimeout(() => {
      el.focus();
      const newPos = start + token.length;
      el.setSelectionRange(newPos, newPos);
    }, 50);
  };

  // تبديل المعاينة الحية لنموذج معين
  const togglePreview = (index: number) => {
    setPreviewOpen((prev) => ({
      ...prev,
      [index]: !prev[index],
    }));
  };

  // تحديث البيانات عند الحفظ
  useEffect(() => {
    if (propState.ok || tempState.ok) {
      router.refresh();
    }
  }, [propState.ok, tempState.ok, router]);

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-16">
      {/* الترويسة الرئيسية */}
      <div className="rounded-3xl border border-sky-150 bg-gradient-to-r from-sky-50 via-white to-cyan-50/40 p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-sky-200 bg-white text-3xl shadow-sm">
              {iconKey || "💬"}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-extrabold text-slate-900">{label}</h1>
                <span className="rounded-lg bg-sky-100 px-2.5 py-0.5 text-xs font-bold text-sky-800">
                  معرّف: {row.name || row.id}
                </span>
              </div>
              <p className="mt-1 text-sm text-slate-600">
                عدّل نماذج الرسائل المباشرة في مكانها بكل سهولة، أو اضبط شروط وحالات ظهور الزر.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/abo1stor3hlaa2kbr8-47/wa-buttons"
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50 transition shadow-sm"
            >
              ← العودة للقائمة
            </Link>
          </div>
        </div>

        {/* أزرار التبديل السريع بين التبويبات (للشاشات المختلفة وللترتيب العالي) */}
        <div className="mt-6 flex gap-2 border-t border-sky-150/70 pt-4">
          <button
            type="button"
            onClick={() => setActiveTab("templates")}
            className={`inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-extrabold transition shadow-sm ${
              activeTab === "templates"
                ? "bg-sky-600 text-white shadow-sky-200"
                : "bg-white text-slate-700 hover:bg-sky-50 border border-slate-200"
            }`}
          >
            <span>📝</span>
            <span>نماذج وصيغ الرسائل ({variants.filter((v) => v.trim()).length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("properties")}
            className={`inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-extrabold transition shadow-sm ${
              activeTab === "properties"
                ? "bg-sky-600 text-white shadow-sky-200"
                : "bg-white text-slate-700 hover:bg-sky-50 border border-slate-200"
            }`}
          >
            <span>⚙️</span>
            <span>خصائص وشروط ظهور الزر</span>
          </button>
        </div>
      </div>

      {/* المحتوى حسب التبويب */}

      {/* ======================= التبويب 1: إدارة النماذج المباشرة ======================= */}
      {activeTab === "templates" ? (
        <div className="space-y-6">
          <form action={tempFormAction} className="space-y-6">
            <input type="hidden" name="id" value={row.id} />
            <input type="hidden" name="templateText" value={combinedTemplateText} />

            {/* رسائل التنبيه والنجاح */}
            {tempState.error ? (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-bold text-rose-700 shadow-sm flex items-center gap-2">
                <span>⚠️</span>
                <span>{tempState.error}</span>
              </div>
            ) : null}

            {tempState.ok ? (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold text-emerald-800 shadow-sm flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <span>✓</span>
                  <span>تم حفظ وتحديث جميع نماذج الرسائل بنجاح تام!</span>
                </span>
                <span className="text-xs font-normal text-emerald-700">التغييرات سارية فوراً</span>
              </div>
            ) : null}

            {/* إرشادات سريعة واضحة */}
            <div className="rounded-2xl border border-blue-150 bg-blue-50/50 p-4 text-xs sm:text-sm text-blue-900 leading-relaxed">
              💡 <strong>تعديل مباشر في مكانه:</strong> اكتب وعدّل في أي نموذج رسالة أدناه مباشرة داخل الصندوق الواسع. استخدم أزرار المتغيرات السريعة فوق كل نموذج لإدراج البيانات (مثل رقم الطلب، السعر، اسم المحل) بنقرة واحدة. عند وجود أكثر من نموذج، سيتمكن المندوب أو النظام من التبديل بينها بسلاسة.
            </div>

            {/* قائمة بطاقات النماذج */}
            <div className="space-y-5">
              {variants.map((text, idx) => {
                const isPreview = !!previewOpen[idx];
                const previewResult = applyMandoubWaTemplate(text, SAMPLE_DATA);

                return (
                  <div
                    key={`template-card-${idx}`}
                    className="relative rounded-3xl border-2 border-sky-150 bg-white p-5 sm:p-6 shadow-sm transition-all focus-within:border-sky-500 focus-within:shadow-md"
                  >
                    {/* شريط رأس بطاقة النموذج */}
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
                      <div className="flex items-center gap-2.5">
                        <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-sky-600 to-cyan-600 text-sm font-extrabold text-white shadow-sm">
                          {idx + 1}
                        </span>
                        <div>
                          <h3 className="text-base font-extrabold text-slate-800">
                            النموذج رقم #{idx + 1}
                          </h3>
                          <span className="text-[11px] text-slate-400 font-medium">
                            {text.trim() ? `${text.length} حرف` : "نموذج فارغ"}
                          </span>
                        </div>
                      </div>

                      {/* أدوات التحكم بالنموذج (ترتيب، تكرار، معاينة، حذف) */}
                      <div className="flex flex-wrap items-center gap-1.5">
                        {/* أزرار الترتيب */}
                        <button
                          type="button"
                          disabled={idx === 0}
                          onClick={() => moveVariantUp(idx)}
                          className="rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-100 disabled:opacity-30 transition"
                          title="نقل النموذج للأعلى"
                        >
                          ⬆️ رفع
                        </button>
                        <button
                          type="button"
                          disabled={idx === variants.length - 1}
                          onClick={() => moveVariantDown(idx)}
                          className="rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-100 disabled:opacity-30 transition"
                          title="نقل النموذج للأسفل"
                        >
                          ⬇️ خفض
                        </button>

                        {/* زر المعاينة الحية */}
                        <button
                          type="button"
                          onClick={() => togglePreview(idx)}
                          className={`rounded-xl px-3 py-1.5 text-xs font-bold transition ${
                            isPreview
                              ? "bg-indigo-600 text-white shadow-sm"
                              : "border border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100"
                          }`}
                          title="معاينة شكل الرسالة الحقيقي للزبون"
                        >
                          {isPreview ? "✕ إغلاق المعاينة" : "👁️ معاينة حية"}
                        </button>

                        {/* زر تكرار */}
                        <button
                          type="button"
                          onClick={() => duplicateVariant(idx)}
                          className="rounded-xl border border-sky-200 bg-sky-50 px-3 py-1.5 text-xs font-bold text-sky-800 hover:bg-sky-100 transition"
                          title="تكرار هذا النموذج"
                        >
                          📑 نسخ النموذج
                        </button>

                        {/* زر حذف */}
                        <button
                          type="button"
                          onClick={() => {
                            if (window.confirm(`هل تريد حذف النموذج رقم #${idx + 1}؟`)) {
                              removeVariant(idx);
                            }
                          }}
                          className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-bold text-rose-700 hover:bg-rose-100 transition"
                          title="حذف هذا النموذج"
                        >
                          🗑️ حذف
                        </button>
                      </div>
                    </div>

                    {/* شريط إدراج المتغيرات فوق مربع النص مباشرة */}
                    <div className="pt-3.5 pb-2">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-slate-600 mb-2">
                        <span>✨ إدراج متغير فوري في مكان المؤشر:</span>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {WA_BUTTON_VARIABLE_CHIPS.map((chip) => (
                          <button
                            key={chip.key}
                            type="button"
                            onClick={() => insertVariableIntoVariant(idx, chip.key)}
                            className="group inline-flex items-center gap-1 rounded-xl border border-sky-200 bg-gradient-to-b from-white to-sky-50/50 px-3 py-1.5 text-xs font-bold text-sky-900 shadow-2xs hover:border-sky-400 hover:bg-sky-100 hover:shadow-sm active:scale-95 transition duration-150"
                            title={`إدراج {{{${chip.key}}}}`}
                          >
                            <span>{chip.label}</span>
                            <span className="rounded bg-sky-200/60 px-1 py-0.2 text-[10px] text-sky-800 group-hover:bg-sky-300">
                              +
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* مربع نص النموذج — واسع، كبير، مريح جداً للكتابة والقراءة */}
                    <div className="mt-2">
                      <textarea
                        ref={(el) => {
                          textareaRefs.current[idx] = el;
                        }}
                        rows={6}
                        value={text}
                        onChange={(e) => updateVariantText(idx, e.target.value)}
                        placeholder="اكتب نص النموذج هنا... يمكنك كتابة نص ترحيبي، تفاصيل الطلب، عنوان الزبون، واستخدام المتغيرات بالأعلى بكل سهولة..."
                        className="w-full rounded-2xl border-2 border-slate-200 bg-slate-50/40 p-4 text-base sm:text-lg font-medium leading-relaxed text-slate-800 outline-none placeholder:text-slate-400 focus:border-sky-500 focus:bg-white focus:ring-4 focus:ring-sky-100 transition duration-200 min-h-[160px] resize-y"
                        dir="auto"
                      />
                    </div>

                    {/* قسم المعاينة الحية التفاعلية */}
                    {isPreview ? (
                      <div className="mt-3 rounded-2xl border border-indigo-200 bg-indigo-50/50 p-4 animate-fadeIn">
                        <div className="flex items-center justify-between pb-2 border-b border-indigo-100">
                          <span className="text-xs font-extrabold text-indigo-900 flex items-center gap-1.5">
                            <span>📱</span>
                            <span>معاينة شكل الرسالة كما ستصل للزبون في واتساب:</span>
                          </span>
                          <span className="text-[11px] text-indigo-600 font-medium">بيانات تجريبية</span>
                        </div>
                        <div className="mt-3 rounded-xl bg-white p-4 text-sm sm:text-base leading-relaxed text-slate-800 border border-indigo-100 shadow-sm whitespace-pre-wrap">
                          {previewResult || (
                            <span className="text-slate-400 italic">اكتب نصاً في النموذج لمعاينته هنا...</span>
                          )}
                        </div>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>

            {/* زر إضافة نموذج رسالة إضافي */}
            <div className="pt-2">
              <button
                type="button"
                onClick={addNewVariant}
                className="w-full flex items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-sky-300 bg-sky-50/60 p-4 text-base font-extrabold text-sky-800 hover:bg-sky-100 hover:border-sky-400 active:scale-[0.99] transition duration-200 shadow-sm"
              >
                <span>➕</span>
                <span>إضافة نموذج رسالة جديد لهذا الزر</span>
              </button>
            </div>

            {/* شريط الحفظ الثابت / البارز في الأسفل */}
            <div className="sticky bottom-4 z-20 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-sky-200 bg-white/95 p-4 shadow-xl backdrop-blur-md">
              <div className="flex items-center gap-2">
                <span className="flex h-3 w-3 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-xs sm:text-sm font-extrabold text-slate-700">
                  عدد النماذج الحالية: {variants.filter((v) => v.trim()).length}
                </span>
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="submit"
                  disabled={tempPending}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-sky-600 to-cyan-600 px-6 py-3 text-sm sm:text-base font-extrabold text-white shadow-md shadow-sky-200 transition hover:from-sky-700 hover:to-cyan-700 disabled:opacity-50 active:scale-95"
                >
                  <span>💾</span>
                  <span>{tempPending ? "جارٍ الحفظ…" : "حفظ جميع نماذج الرسائل"}</span>
                </button>
              </div>
            </div>
          </form>
        </div>
      ) : null}

      {/* ======================= التبويب 2: خصائص وشروط الزر ======================= */}
      {activeTab === "properties" ? (
        <div className="rounded-3xl border border-sky-150 bg-white p-6 sm:p-8 shadow-sm">
          <form action={propFormAction} className="space-y-6 max-w-4xl">
            <input type="hidden" name="id" value={row.id} />
            <input type="hidden" name="name" value={row.name} />
            <input type="hidden" name="recipient" value={recipients.join(",")} />
            <input type="hidden" name="showNextToLocation" value={showNextToLocation ? "true" : "false"} />

            {/* حقول الاسم والأيقونة */}
            <div className="grid gap-6 sm:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                  <span>اسم الزر (Label)</span>
                  <span className="text-rose-500">*</span>
                </label>
                <input
                  name="label"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-2.5 text-base font-bold text-slate-800 outline-none focus:border-sky-500 focus:bg-white focus:ring-2 focus:ring-sky-100 transition"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  required
                  autoComplete="off"
                  placeholder="مثال: لوكيشن الزبون، تأكيد الطلب..."
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

            {/* بطاقات الخيارات التفاعلية (Pills) */}
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
                {/* إرسال الحقول المخفية للنموذج */}
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

            {propState.error ? (
              <p className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-bold text-rose-700">
                {propState.error}
              </p>
            ) : null}

            {propState.ok ? (
              <p className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-bold text-emerald-800">
                ✓ تم حفظ وتحديث خصائص وشروط الزر بنجاح.
              </p>
            ) : null}

            <div className="pt-4 border-t border-slate-200 flex items-center gap-3">
              <button
                type="submit"
                disabled={propPending}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-sky-600 px-6 py-3 text-base font-extrabold text-white shadow-md shadow-sky-200 transition hover:bg-sky-700 disabled:opacity-50"
              >
                <span>💾</span>
                <span>{propPending ? "جارٍ الحفظ…" : "حفظ خصائص وشروط الزر"}</span>
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}
