"use client";

import { useActionState, useRef, useState } from "react";
import {
  type TwoWayTemplatesConfig,
  getDefaultTwoWayLocationSenderTemplate,
  getDefaultTwoWayLocationRecipientTemplate,
  getDefaultTwoWayNotifySenderTemplate,
  getDefaultTwoWayNotifyRecipientTemplate,
  getDefaultTwoWayChatSenderTemplate,
  getDefaultTwoWayChatRecipientTemplate,
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

  type FieldKey =
    | "locSender"
    | "locRecipient"
    | "notSender"
    | "notRecipient"
    | "chatSender"
    | "chatRecipient";

  const [activeTextarea, setActiveTextarea] = useState<FieldKey>("locSender");

  // التحكم بالنافذة المنبثقة للتعديل المريح والكبير
  const [expandedModal, setExpandedModal] = useState<{
    open: boolean;
    key: FieldKey | null;
    title: string;
  }>({ open: false, key: null, title: "" });

  const locSenderRef = useRef<HTMLTextAreaElement | null>(null);
  const locRecipientRef = useRef<HTMLTextAreaElement | null>(null);
  const notSenderRef = useRef<HTMLTextAreaElement | null>(null);
  const notRecipientRef = useRef<HTMLTextAreaElement | null>(null);
  const chatSenderRef = useRef<HTMLTextAreaElement | null>(null);
  const chatRecipientRef = useRef<HTMLTextAreaElement | null>(null);
  const modalTextareaRef = useRef<HTMLTextAreaElement | null>(null);

  const getFieldValue = (key: FieldKey): string => {
    switch (key) {
      case "locSender": return locationSender;
      case "locRecipient": return locationRecipient;
      case "notSender": return notifySender;
      case "notRecipient": return notifyRecipient;
      case "chatSender": return chatSender;
      case "chatRecipient": return chatRecipient;
    }
  };

  const setFieldValue = (key: FieldKey, val: string) => {
    switch (key) {
      case "locSender": setLocationSender(val); break;
      case "locRecipient": setLocationRecipient(val); break;
      case "notSender": setNotifySender(val); break;
      case "notRecipient": setNotifyRecipient(val); break;
      case "chatSender": setChatSender(val); break;
      case "chatRecipient": setChatRecipient(val); break;
    }
  };

  const getRef = (key: FieldKey) => {
    switch (key) {
      case "locSender": return locSenderRef;
      case "locRecipient": return locRecipientRef;
      case "notSender": return notSenderRef;
      case "notRecipient": return notRecipientRef;
      case "chatSender": return chatSenderRef;
      case "chatRecipient": return chatRecipientRef;
    }
  };

  const resetToDefault = (key: FieldKey) => {
    switch (key) {
      case "locSender": setLocationSender(getDefaultTwoWayLocationSenderTemplate()); break;
      case "locRecipient": setLocationRecipient(getDefaultTwoWayLocationRecipientTemplate()); break;
      case "notSender": setNotifySender(getDefaultTwoWayNotifySenderTemplate()); break;
      case "notRecipient": setNotifyRecipient(getDefaultTwoWayNotifyRecipientTemplate()); break;
      case "chatSender": setChatSender(getDefaultTwoWayChatSenderTemplate()); break;
      case "chatRecipient": setChatRecipient(getDefaultTwoWayChatRecipientTemplate()); break;
    }
  };

  const insertVariable = (variableCode: string, isModal = false) => {
    const key = isModal ? expandedModal.key : activeTextarea;
    if (!key) return;

    const textarea = isModal ? modalTextareaRef.current : getRef(key).current;
    const template = getFieldValue(key);

    if (!textarea) {
      setFieldValue(key, template + variableCode);
      return;
    }

    const start = textarea.selectionStart ?? template.length;
    const end = textarea.selectionEnd ?? template.length;
    const next = `${template.slice(0, start)}${variableCode}${template.slice(end)}`;
    setFieldValue(key, next);

    queueMicrotask(() => {
      textarea.focus();
      const pos = start + variableCode.length;
      textarea.setSelectionRange(pos, pos);
    });
  };

  return (
    <form action={action} className="space-y-6">
      <div className="rounded-2xl border border-indigo-200 bg-gradient-to-br from-indigo-50/70 via-purple-50/40 to-white p-4 sm:p-6 space-y-6 shadow-sm">
        {/* هيدر الشاشة */}
        <div className="flex items-center gap-3 border-b border-indigo-100 pb-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-600 text-white font-black text-xl shadow-md">
            ⇄
          </div>
          <div>
            <h3 className="text-lg font-extrabold text-indigo-950">
              إعدادات أزرار ونماذج الطلبات ذات الوجهتين (ذو وجهتين)
            </h3>
            <p className="text-xs text-indigo-700 mt-0.5">
              يمكنك تخصيص وتعديل قوالب ونماذج رسائل الواتساب والتبليغ وطلب اللوكيشن بكل راحة وسهولة.
            </p>
          </div>
        </div>

        {/* دليل وشرح المتغيرات بالعربي الصريح */}
        <div className="rounded-2xl border border-indigo-200 bg-white p-4 space-y-3 shadow-xs">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <p className="text-xs font-black text-slate-800 flex items-center gap-1.5">
              <span>💡</span> دليل الكلمات والتنقل التلقائي (المتغيرات):
            </p>
            <span className="text-[11px] font-bold text-indigo-600 bg-indigo-50 px-2.5 py-0.5 rounded-full border border-indigo-100">
              اضغط على أي زر لإضافته داخل النص مباشرة
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
            {VARIABLE_LABELS.map((item) => (
              <button
                key={item.code}
                type="button"
                onClick={() => insertVariable(item.code, expandedModal.open)}
                className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-right transition hover:border-indigo-400 hover:bg-indigo-50/60 active:scale-95 shadow-2xs"
              >
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="text-sm">{item.icon}</span>
                  <span className="text-xs font-bold text-slate-800 truncate">{item.label}</span>
                </div>
                <span className="text-[10px] font-mono font-bold text-indigo-700 bg-white px-1.5 py-0.5 rounded border border-slate-200">
                  {item.code}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* 1. قوالب طلب اللوكيشن */}
        <div className="space-y-4 rounded-2xl bg-white p-4 sm:p-5 border border-indigo-100 shadow-xs">
          <div className="flex items-center justify-between border-b border-emerald-100 pb-2">
            <h4 className="text-sm font-extrabold text-emerald-900 flex items-center gap-2">
              📍 1. قوالب طلب اللوكيشن (الموقع)
            </h4>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* طلب لوكيشن للمرسل */}
            <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50/70 p-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-extrabold text-slate-800">
                  طلب لوكيشن من (المرسل)
                </label>
                <button
                  type="button"
                  onClick={() => setExpandedModal({ open: true, key: "locSender", title: "طلب لوكيشن للمرسل (الوجهة الأولى)" })}
                  className="rounded-lg bg-emerald-600 px-2.5 py-1 text-[11px] font-bold text-white shadow-2xs hover:bg-emerald-700 transition"
                >
                  🔍 تكديم / فتح في نافذة كبيرة
                </button>
              </div>

              <textarea
                ref={locSenderRef}
                name="locationSenderTemplate"
                value={locationSender}
                onFocus={() => setActiveTextarea("locSender")}
                onChange={(e) => setLocationSender(e.target.value)}
                rows={6}
                className="w-full rounded-xl border border-slate-300 bg-white p-3 text-xs sm:text-sm font-medium text-slate-800 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 leading-relaxed"
              />
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => resetToDefault("locSender")}
                  className="text-[11px] font-bold text-slate-500 hover:text-emerald-600 underline"
                >
                  استرجاع النص الافتراضي للمرسل
                </button>
              </div>
            </div>

            {/* طلب لوكيشن للمستلم */}
            <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50/70 p-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-extrabold text-slate-800">
                  طلب لوكيشن من (المستلم)
                </label>
                <button
                  type="button"
                  onClick={() => setExpandedModal({ open: true, key: "locRecipient", title: "طلب لوكيشن للمستلم (الوجهة الثانية)" })}
                  className="rounded-lg bg-emerald-600 px-2.5 py-1 text-[11px] font-bold text-white shadow-2xs hover:bg-emerald-700 transition"
                >
                  🔍 تكديم / فتح في نافذة كبيرة
                </button>
              </div>

              <textarea
                ref={locRecipientRef}
                name="locationRecipientTemplate"
                value={locationRecipient}
                onFocus={() => setActiveTextarea("locRecipient")}
                onChange={(e) => setLocationRecipient(e.target.value)}
                rows={6}
                className="w-full rounded-xl border border-slate-300 bg-white p-3 text-xs sm:text-sm font-medium text-slate-800 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 leading-relaxed"
              />
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => resetToDefault("locRecipient")}
                  className="text-[11px] font-bold text-slate-500 hover:text-emerald-600 underline"
                >
                  استرجاع النص الافتراضي للمستلم
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* 2. قوالب تبليغ الطرفين */}
        <div className="space-y-4 rounded-2xl bg-white p-4 sm:p-5 border border-indigo-100 shadow-xs">
          <div className="flex items-center justify-between border-b border-blue-100 pb-2">
            <h4 className="text-sm font-extrabold text-blue-900 flex items-center gap-2">
              🔔 2. قوالب التبليغ والإشعارات للطرفين
            </h4>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* تبليغ للمرسل */}
            <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50/70 p-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-extrabold text-slate-800">
                  تبليغ وإشعار (المرسل)
                </label>
                <button
                  type="button"
                  onClick={() => setExpandedModal({ open: true, key: "notSender", title: "تبليغ للمرسل (الوجهة الأولى)" })}
                  className="rounded-lg bg-blue-600 px-2.5 py-1 text-[11px] font-bold text-white shadow-2xs hover:bg-blue-700 transition"
                >
                  🔍 تكديم / فتح في نافذة كبيرة
                </button>
              </div>

              <textarea
                ref={notSenderRef}
                name="notifySenderTemplate"
                value={notifySender}
                onFocus={() => setActiveTextarea("notSender")}
                onChange={(e) => setNotifySender(e.target.value)}
                rows={6}
                className="w-full rounded-xl border border-slate-300 bg-white p-3 text-xs sm:text-sm font-medium text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 leading-relaxed"
              />
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => resetToDefault("notSender")}
                  className="text-[11px] font-bold text-slate-500 hover:text-blue-600 underline"
                >
                  استرجاع النص الافتراضي لتبليغ المرسل
                </button>
              </div>
            </div>

            {/* تبليغ للمستلم */}
            <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50/70 p-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-extrabold text-slate-800">
                  تبليغ وإشعار (المستلم)
                </label>
                <button
                  type="button"
                  onClick={() => setExpandedModal({ open: true, key: "notRecipient", title: "تبليغ للمستلم (الوجهة الثانية)" })}
                  className="rounded-lg bg-blue-600 px-2.5 py-1 text-[11px] font-bold text-white shadow-2xs hover:bg-blue-700 transition"
                >
                  🔍 تكديم / فتح في نافذة كبيرة
                </button>
              </div>

              <textarea
                ref={notRecipientRef}
                name="notifyRecipientTemplate"
                value={notifyRecipient}
                onFocus={() => setActiveTextarea("notRecipient")}
                onChange={(e) => setNotifyRecipient(e.target.value)}
                rows={6}
                className="w-full rounded-xl border border-slate-300 bg-white p-3 text-xs sm:text-sm font-medium text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 leading-relaxed"
              />
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => resetToDefault("notRecipient")}
                  className="text-[11px] font-bold text-slate-500 hover:text-blue-600 underline"
                >
                  استرجاع النص الافتراضي لتبليغ المستلم
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* 3. قوالب المراسلة العامة */}
        <div className="space-y-4 rounded-2xl bg-white p-4 sm:p-5 border border-indigo-100 shadow-xs">
          <div className="flex items-center justify-between border-b border-purple-100 pb-2">
            <h4 className="text-sm font-extrabold text-purple-900 flex items-center gap-2">
              💬 3. قوالب المراسلة المباشرة للواتساب
            </h4>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* مراسلة للمرسل */}
            <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50/70 p-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-extrabold text-slate-800">
                  مراسلة الواتساب (للمرسل)
                </label>
                <button
                  type="button"
                  onClick={() => setExpandedModal({ open: true, key: "chatSender", title: "مراسلة الواتساب للمرسل" })}
                  className="rounded-lg bg-purple-600 px-2.5 py-1 text-[11px] font-bold text-white shadow-2xs hover:bg-purple-700 transition"
                >
                  🔍 تكديم / فتح في نافذة كبيرة
                </button>
              </div>

              <textarea
                ref={chatSenderRef}
                name="chatSenderTemplate"
                value={chatSender}
                onFocus={() => setActiveTextarea("chatSender")}
                onChange={(e) => setChatSender(e.target.value)}
                rows={5}
                className="w-full rounded-xl border border-slate-300 bg-white p-3 text-xs sm:text-sm font-medium text-slate-800 outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-200 leading-relaxed"
              />
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => resetToDefault("chatSender")}
                  className="text-[11px] font-bold text-slate-500 hover:text-purple-600 underline"
                >
                  استرجاع النص الافتراضي لمراسلة المرسل
                </button>
              </div>
            </div>

            {/* مراسلة للمستلم */}
            <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50/70 p-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-extrabold text-slate-800">
                  مراسلة الواتساب (للمستلم)
                </label>
                <button
                  type="button"
                  onClick={() => setExpandedModal({ open: true, key: "chatRecipient", title: "مراسلة الواتساب للمستلم" })}
                  className="rounded-lg bg-purple-600 px-2.5 py-1 text-[11px] font-bold text-white shadow-2xs hover:bg-purple-700 transition"
                >
                  🔍 تكديم / فتح في نافذة كبيرة
                </button>
              </div>

              <textarea
                ref={chatRecipientRef}
                name="chatRecipientTemplate"
                value={chatRecipient}
                onFocus={() => setActiveTextarea("chatRecipient")}
                onChange={(e) => setChatRecipient(e.target.value)}
                rows={5}
                className="w-full rounded-xl border border-slate-300 bg-white p-3 text-xs sm:text-sm font-medium text-slate-800 outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-200 leading-relaxed"
              />
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => resetToDefault("chatRecipient")}
                  className="text-[11px] font-bold text-slate-500 hover:text-purple-600 underline"
                >
                  استرجاع النص الافتراضي لمراسلة المستلم
                </button>
              </div>
            </div>
          </div>
        </div>

        {state.error ? (
          <p className="rounded-xl border border-rose-300 bg-rose-50 px-4 py-3 text-xs font-bold text-rose-700">
            {state.error}
          </p>
        ) : null}
        {state.ok ? (
          <p className="rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-xs font-bold text-emerald-700">
            تم حفظ جميع القوالب للطلبات ذات الوجهتين بنجاح.
          </p>
        ) : null}

        <div>
          <button
            type="submit"
            disabled={pending}
            className="w-full rounded-xl bg-indigo-600 px-4 py-3.5 text-sm font-black text-white transition hover:bg-indigo-700 shadow-md disabled:opacity-60"
          >
            {pending ? "جارٍ حفظ قوالب الوجهتين..." : "حفظ جميع القوالب والرسائل"}
          </button>
        </div>
      </div>

      {/* --- النافذة المنبثقة الكبيرة والمريحة جداً للتعديل والقراءة --- */}
      {expandedModal.open && expandedModal.key && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-3 sm:p-6">
          <div className="w-full max-w-4xl max-h-[92vh] flex flex-col rounded-3xl border border-indigo-200 bg-white p-4 sm:p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in duration-150 overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 shrink-0">
              <div className="flex items-center gap-2">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600 text-white font-black text-base shadow-sm">
                  🔍
                </span>
                <div>
                  <h3 className="text-base sm:text-lg font-black text-indigo-950">
                    نافذة التعديل الكبيرة: {expandedModal.title}
                  </h3>
                  <p className="text-xs text-slate-500">
                    اقرأ وعدّل الرسالة بحرية كاملة وفي مكان واسع ومريح للعين.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setExpandedModal({ open: false, key: null, title: "" })}
                className="rounded-full bg-slate-100 p-2 text-slate-600 hover:bg-rose-50 hover:text-rose-600 transition"
              >
                ✕ إغلاق
              </button>
            </div>

            {/* أزرار المتغيرات داخل النافذة الكبيرة */}
            <div className="space-y-1.5 shrink-0 bg-indigo-50/50 p-3 rounded-2xl border border-indigo-100">
              <p className="text-xs font-bold text-indigo-900">إضافة كلمة تلقائية إلى هذا النموذج:</p>
              <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                {VARIABLE_LABELS.map((item) => (
                  <button
                    key={item.code}
                    type="button"
                    onClick={() => insertVariable(item.code, true)}
                    className="flex items-center gap-1 rounded-lg border border-indigo-200 bg-white px-2.5 py-1 text-xs font-bold text-indigo-800 hover:bg-indigo-100 transition shadow-2xs"
                  >
                    <span>{item.icon}</span>
                    <span>{item.label}</span>
                    <span className="text-[10px] text-slate-400 font-mono">({item.code})</span>
                  </button>
                ))}
              </div>
            </div>

            {/* صندوق الكتابة المكبر بمرونة وتجاوب عالي */}
            <div className="flex-1 min-h-[280px]">
              <textarea
                ref={modalTextareaRef}
                value={getFieldValue(expandedModal.key)}
                onChange={(e) => setFieldValue(expandedModal.key!, e.target.value)}
                className="w-full h-full min-h-[300px] sm:min-h-[360px] rounded-2xl border border-slate-300 bg-slate-50/50 p-4 text-sm sm:text-base font-medium text-slate-900 outline-none focus:border-indigo-600 focus:bg-white focus:ring-2 focus:ring-indigo-200 leading-relaxed shadow-inner"
              />
            </div>

            <div className="flex items-center justify-between border-t border-slate-100 pt-3 shrink-0">
              <button
                type="button"
                onClick={() => resetToDefault(expandedModal.key!)}
                className="text-xs font-bold text-slate-500 hover:text-indigo-600 underline"
              >
                استرجاع النص الافتراضي لهذا النموذج
              </button>
              <button
                type="button"
                onClick={() => setExpandedModal({ open: false, key: null, title: "" })}
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
