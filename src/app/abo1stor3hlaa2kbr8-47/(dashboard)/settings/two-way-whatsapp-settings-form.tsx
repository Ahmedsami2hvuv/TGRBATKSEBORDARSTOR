"use client";

import { useActionState, useRef, useState } from "react";
import {
  type TwoWayTemplatesConfig,
  type TwoWayButtonRule,
  type LocationCondition,
  type OrderStatusCondition,
  type TargetParty,
  getDefaultTwoWayLocationSenderTemplate,
  getDefaultTwoWayLocationRecipientTemplate,
  getDefaultTwoWayNotifySenderTemplate,
  getDefaultTwoWayNotifyRecipientTemplate,
  getDefaultTwoWayChatSenderTemplate,
  getDefaultTwoWayChatRecipientTemplate,
  getDefaultTwoWayButtonRules,
} from "@/lib/two-way-whatsapp-helpers";
import {
  saveTwoWayWhatsappTemplateSettings,
  type WhatsappTemplateSettingsState,
} from "./actions";

// قائمة المتغيرات مع الشرح العربي الصريح والواضح
const VARIABLE_LABELS: Array<{ code: string; label: string; icon: string }> = [
  { code: "{orderNumber}", label: "رقم الطلب", icon: "🔢" },
  { code: "{senderName}", label: "اسم المرسل", icon: "👤" },
  { code: "{senderPhone}", label: "رقم هاتف المرسل", icon: "📞" },
  { code: "{recipientName}", label: "اسم المستلم", icon: "👤" },
  { code: "{recipientPhone}", label: "رقم هاتف المستلم", icon: "📞" },
  { code: "{senderRegion}", label: "منطقة المرسل", icon: "📍" },
  { code: "{recipientRegion}", label: "منطقة المستلم", icon: "📍" },
  { code: "{subtotal}", label: "سعر الطلب (بدون توصيل)", icon: "💰" },
  { code: "{delivery}", label: "أجرة التوصيل", icon: "🚚" },
  { code: "{total}", label: "المجموع الكلي", icon: "💵" },
  { code: "{notes}", label: "الملاحظات", icon: "📝" },
];

const ORDER_STATUS_OPTIONS: Array<{ code: OrderStatusCondition; label: string }> = [
  { code: "pending", label: "طلب جديد (pending)" },
  { code: "assigned", label: "بانتظار المندوب (assigned)" },
  { code: "delivering", label: "عند المندوب (delivering)" },
  { code: "delivered", label: "تم التسليم (delivered)" },
  { code: "cancelled", label: "ملغى/مرفوض (cancelled)" },
  { code: "archived", label: "مؤرشف (archived)" },
];

const LOCATION_CONDITION_OPTIONS: Array<{ code: LocationCondition; label: string }> = [
  { code: "all", label: "الكل" },
  { code: "has_location", label: "موجـود لوكيشن" },
  { code: "no_location", label: "بدون لوكيشن" },
  { code: "gps_uploaded", label: "مرفوع GPS" },
];

const TARGET_PARTY_OPTIONS: Array<{ code: TargetParty; label: string }> = [
  { code: "sender_1", label: "المرسل الأول (الوجهة 1)" },
  { code: "sender_2", label: "المرسل الثاني (الوجهة 1)" },
  { code: "recipient_1", label: "المستلم الأول (الوجهة 2)" },
  { code: "recipient_2", label: "المستلم الثاني (الوجهة 2)" },
  { code: "any", label: "أي طرف متاح" },
];

export function TwoWayWhatsappSettingsForm({
  initialTemplates,
}: {
  initialTemplates: TwoWayTemplatesConfig;
}) {
  const [state, action, pending] = useActionState(
    saveTwoWayWhatsappTemplateSettings,
    {} as WhatsappTemplateSettingsState
  );

  const [locationSender, setLocationSender] = useState(initialTemplates.locationSenderTemplate);
  const [locationRecipient, setLocationRecipient] = useState(initialTemplates.locationRecipientTemplate);
  const [notifySender, setNotifySender] = useState(initialTemplates.notifySenderTemplate);
  const [notifyRecipient, setNotifyRecipient] = useState(initialTemplates.notifyRecipientTemplate);
  const [chatSender, setChatSender] = useState(initialTemplates.chatSenderTemplate);
  const [chatRecipient, setChatRecipient] = useState(initialTemplates.chatRecipientTemplate);

  // قواعد وشروط ظهور كل زر بشكل منفصل
  const [buttonRules, setButtonRules] = useState<TwoWayButtonRule[]>(
    initialTemplates.buttonRules || getDefaultTwoWayButtonRules()
  );

  // التحكم بالنافذة المنبثقة للتعديل المريح والكبير لنموذج أي زر
  const [editingRuleModal, setEditingRuleModal] = useState<{
    open: boolean;
    ruleId: string | null;
  }>({ open: false, ruleId: null });

  const modalTextareaRef = useRef<HTMLTextAreaElement | null>(null);

  const activeRule = buttonRules.find((r) => r.id === editingRuleModal.ruleId);

  const updateRuleField = (id: string, field: keyof TwoWayButtonRule, value: any) => {
    setButtonRules((prev) =>
      prev.map((r) => (r.id === id ? { ...r, [field]: value } : r))
    );
  };

  const toggleLocationCondition = (ruleId: string, condition: LocationCondition) => {
    setButtonRules((prev) =>
      prev.map((r) => {
        if (r.id !== ruleId) return r;
        let next = [...r.locationConditions];
        if (condition === "all") {
          next = ["all"];
        } else {
          next = next.filter((c) => c !== "all");
          if (next.includes(condition)) {
            next = next.filter((c) => c !== condition);
          } else {
            next.push(condition);
          }
          if (next.length === 0) next = ["all"];
        }
        return { ...r, locationConditions: next };
      })
    );
  };

  const toggleStatusCondition = (ruleId: string, status: OrderStatusCondition) => {
    setButtonRules((prev) =>
      prev.map((r) => {
        if (r.id !== ruleId) return r;
        let next = [...r.statusConditions];
        if (next.includes(status)) {
          next = next.filter((s) => s !== status);
        } else {
          next.push(status);
        }
        return { ...r, statusConditions: next };
      })
    );
  };

  const addNewRule = () => {
    const newId = `btn_custom_${Date.now()}`;
    const newRule: TwoWayButtonRule = {
      id: newId,
      title: "زر جديد مخصص",
      targetParty: "recipient_1",
      actionType: "notify",
      template: "مرحباً، تفاصيل طلبك رقم {orderNumber}: المجموع الكلي {total} د.ع.",
      locationConditions: ["all"],
      statusConditions: ["assigned", "delivering"],
      active: true,
    };
    setButtonRules((prev) => [...prev, newRule]);
    setEditingRuleModal({ open: true, ruleId: newId });
  };

  const deleteRule = (id: string) => {
    setButtonRules((prev) => prev.filter((r) => r.id !== id));
  };

  const insertVariableIntoActiveRule = (variableCode: string) => {
    if (!activeRule || !modalTextareaRef.current) return;
    const textarea = modalTextareaRef.current;
    const template = activeRule.template || "";

    const start = textarea.selectionStart ?? template.length;
    const end = textarea.selectionEnd ?? template.length;
    const next = `${template.slice(0, start)}${variableCode}${template.slice(end)}`;
    
    updateRuleField(activeRule.id, "template", next);

    queueMicrotask(() => {
      textarea.focus();
      const pos = start + variableCode.length;
      textarea.setSelectionRange(pos, pos);
    });
  };

  return (
    <form action={action} className="space-y-6">
      {/* إرسال قواعد الأزرار كـ JSON خفي للسيرفر */}
      <input
        type="hidden"
        name="buttonRulesJson"
        value={JSON.stringify(buttonRules)}
      />

      <div className="rounded-3xl border border-indigo-200 bg-gradient-to-br from-indigo-50/80 via-purple-50/50 to-white p-4 sm:p-7 space-y-7 shadow-sm">
        {/* هيدر الشاشة */}
        <div className="flex items-center justify-between border-b border-indigo-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-600 text-white font-black text-xl shadow-md">
              ⇄
            </div>
            <div>
              <h3 className="text-lg font-extrabold text-indigo-950">
                برمجة وتخصيص شروط ظهور كل زر بشكل منفصل
              </h3>
              <p className="text-xs text-indigo-700 mt-0.5">
                يمكنك تحديد حالات الطلب وحالات لوكيشن الزبون لظهور أو إخفاء كل زر تلقائياً لدى المندوب والإدارة.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={addNewRule}
            className="rounded-2xl bg-emerald-600 px-4 py-2.5 text-xs sm:text-sm font-extrabold text-white shadow-md hover:bg-emerald-700 transition"
          >
            ➕ إضافة زر جديد
          </button>
        </div>

        {/* --- الأزرار المخصصة وشروطها (مطابقة للصورة بالكامل) --- */}
        <div className="space-y-6">
          {buttonRules.map((rule, idx) => (
            <div
              key={rule.id}
              className={`rounded-3xl border transition p-4 sm:p-6 space-y-4 shadow-sm ${
                rule.active
                  ? "border-indigo-200 bg-white"
                  : "border-slate-200 bg-slate-50/60 opacity-60"
              }`}
            >
              {/* هيدر الزر */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
                <div className="flex items-center gap-3">
                  <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-100 font-extrabold text-indigo-800 text-xs">
                    #{idx + 1}
                  </span>
                  <input
                    type="text"
                    value={rule.title}
                    onChange={(e) => updateRuleField(rule.id, "title", e.target.value)}
                    placeholder="اسم الزر..."
                    className="rounded-xl border border-slate-300 bg-slate-50 px-3 py-1.5 text-sm font-extrabold text-slate-900 outline-none focus:border-indigo-600 focus:bg-white min-w-[200px]"
                  />
                  <select
                    value={rule.targetParty}
                    onChange={(e) => updateRuleField(rule.id, "targetParty", e.target.value)}
                    className="rounded-xl border border-slate-300 bg-slate-50 px-2.5 py-1.5 text-xs font-bold text-slate-800 outline-none"
                  >
                    {TARGET_PARTY_OPTIONS.map((t) => (
                      <option key={t.code} value={t.code}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setEditingRuleModal({ open: true, ruleId: rule.id })}
                    className="rounded-xl bg-indigo-600 px-3 py-1.5 text-xs font-extrabold text-white shadow-2xs hover:bg-indigo-700 transition"
                  >
                    📝 تعديل نموذج الرسالة
                  </button>
                  <label className="flex items-center gap-1.5 text-xs font-bold cursor-pointer bg-slate-100 px-3 py-1.5 rounded-xl border border-slate-200">
                    <input
                      type="checkbox"
                      checked={rule.active}
                      onChange={(e) => updateRuleField(rule.id, "active", e.target.checked)}
                      className="rounded text-indigo-600"
                    />
                    مفعّل
                  </label>
                  <button
                    type="button"
                    onClick={() => deleteRule(rule.id)}
                    className="rounded-xl bg-rose-50 border border-rose-200 px-2.5 py-1.5 text-xs font-bold text-rose-600 hover:bg-rose-100 transition"
                  >
                    🗑️ حذف
                  </button>
                </div>
              </div>

              {/* قسم شروط الظهور (مثل الصورة المرفقة بالكامل) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 rounded-2xl bg-indigo-50/40 p-4 border border-indigo-100/80">
                {/* 1. حالة لوكيشن الزبون */}
                <div className="space-y-2">
                  <p className="text-xs font-black text-slate-800 border-b border-indigo-100/60 pb-1">
                    حالة لوكيشن الزبون لظهور الزر:
                  </p>
                  <div className="flex flex-wrap gap-4 pt-1">
                    {LOCATION_CONDITION_OPTIONS.map((opt) => {
                      const checked = rule.locationConditions?.includes(opt.code);
                      return (
                        <label
                          key={opt.code}
                          className="flex items-center gap-2 text-xs font-extrabold text-slate-800 cursor-pointer select-none"
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleLocationCondition(rule.id, opt.code)}
                            className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                          />
                          <span>{opt.label}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>

                {/* 2. حالات الطلب لظهور الزر */}
                <div className="space-y-2">
                  <p className="text-xs font-black text-slate-800 border-b border-indigo-100/60 pb-1">
                    حالات الطلب لظهور الزر:
                  </p>
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    {ORDER_STATUS_OPTIONS.map((opt) => {
                      const checked = rule.statusConditions?.includes(opt.code);
                      return (
                        <label
                          key={opt.code}
                          className="flex items-center gap-2 text-xs font-extrabold text-slate-800 cursor-pointer select-none"
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleStatusCondition(rule.id, opt.code)}
                            className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                          />
                          <span>{opt.label}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {state.error ? (
          <p className="rounded-xl border border-rose-300 bg-rose-50 px-4 py-3 text-xs font-bold text-rose-700">
            {state.error}
          </p>
        ) : null}
        {state.ok ? (
          <p className="rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-xs font-bold text-emerald-700">
            تم حفظ جميع قواعد وشروط ظهور الأزرار ونماذجها بنجاح.
          </p>
        ) : null}

        <div>
          <button
            type="submit"
            disabled={pending}
            className="w-full rounded-2xl bg-indigo-600 px-4 py-4 text-sm font-black text-white transition hover:bg-indigo-700 shadow-md disabled:opacity-60"
          >
            {pending ? "جارٍ حفظ القواعد والأزرار..." : "حفظ جميع القواعد وشروط ظهور الأزرار"}
          </button>
        </div>
      </div>

      {/* --- النافذة المنبثقة للتعديل المريح للنموذج --- */}
      {editingRuleModal.open && activeRule && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-3 sm:p-6">
          <div className="w-full max-w-4xl max-h-[92vh] flex flex-col rounded-3xl border border-indigo-200 bg-white p-4 sm:p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in duration-150 overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 shrink-0">
              <div className="flex items-center gap-2">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600 text-white font-black text-base shadow-sm">
                  📝
                </span>
                <div>
                  <h3 className="text-base sm:text-lg font-black text-indigo-950">
                    تعديل نموذج النص لزر: {activeRule.title}
                  </h3>
                  <p className="text-xs text-slate-500">
                    خصص نص الرسالة التي يتم تعبئتها تلقائياً عند الضغط على الزر.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingRuleModal({ open: false, ruleId: null })}
                className="rounded-full bg-slate-100 p-2 text-slate-600 hover:bg-rose-50 hover:text-rose-600 transition text-xs font-bold"
              >
                ✕ إغلاق
              </button>
            </div>

            {/* أزرار المتغيرات */}
            <div className="space-y-1.5 shrink-0 bg-indigo-50/50 p-3 rounded-2xl border border-indigo-100">
              <p className="text-xs font-bold text-indigo-900">إضافة كلمة تلقائية إلى هذا النموذج:</p>
              <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                {VARIABLE_LABELS.map((item) => (
                  <button
                    key={item.code}
                    type="button"
                    onClick={() => insertVariableIntoActiveRule(item.code)}
                    className="flex items-center gap-1 rounded-lg border border-indigo-200 bg-white px-2.5 py-1 text-xs font-bold text-indigo-800 hover:bg-indigo-100 transition shadow-2xs"
                  >
                    <span>{item.icon}</span>
                    <span>{item.label}</span>
                    <span className="text-[10px] text-slate-400 font-mono">({item.code})</span>
                  </button>
                ))}
              </div>
            </div>

            {/* صندوق النص المكبر */}
            <div className="flex-1 min-h-[280px]">
              <textarea
                ref={modalTextareaRef}
                value={activeRule.template}
                onChange={(e) => updateRuleField(activeRule.id, "template", e.target.value)}
                className="w-full h-full min-h-[300px] sm:min-h-[360px] rounded-2xl border border-slate-300 bg-slate-50/50 p-4 text-sm sm:text-base font-medium text-slate-900 outline-none focus:border-indigo-600 focus:bg-white focus:ring-2 focus:ring-indigo-200 leading-relaxed shadow-inner"
              />
            </div>

            <div className="flex items-center justify-end border-t border-slate-100 pt-3 shrink-0">
              <button
                type="button"
                onClick={() => setEditingRuleModal({ open: false, ruleId: null })}
                className="rounded-xl bg-indigo-600 px-6 py-2.5 text-xs sm:text-sm font-black text-white shadow-md hover:bg-indigo-700 transition"
              >
                ✓ اعتماد وإنهاء التعديل
              </button>
            </div>
          </div>
        </div>
      )}
    </form>
  );
}
