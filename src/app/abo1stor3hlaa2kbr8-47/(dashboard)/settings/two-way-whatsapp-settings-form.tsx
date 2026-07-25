"use client";

import { useActionState, useRef, useState } from "react";
import {
  TWO_WAY_TEMPLATE_VARIABLES,
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

  const [activeTextarea, setActiveTextarea] = useState<
    | "locSender"
    | "locRecipient"
    | "notSender"
    | "notRecipient"
    | "chatSender"
    | "chatRecipient"
  >("locSender");

  const locSenderRef = useRef<HTMLTextAreaElement | null>(null);
  const locRecipientRef = useRef<HTMLTextAreaElement | null>(null);
  const notSenderRef = useRef<HTMLTextAreaElement | null>(null);
  const notRecipientRef = useRef<HTMLTextAreaElement | null>(null);
  const chatSenderRef = useRef<HTMLTextAreaElement | null>(null);
  const chatRecipientRef = useRef<HTMLTextAreaElement | null>(null);

  const insertVariable = (variableName: string) => {
    let textarea: HTMLTextAreaElement | null = null;
    let template = "";
    let setTemplate: (val: string) => void = () => {};

    if (activeTextarea === "locSender") {
      textarea = locSenderRef.current;
      template = locationSender;
      setTemplate = setLocationSender;
    } else if (activeTextarea === "locRecipient") {
      textarea = locRecipientRef.current;
      template = locationRecipient;
      setTemplate = setLocationRecipient;
    } else if (activeTextarea === "notSender") {
      textarea = notSenderRef.current;
      template = notifySender;
      setTemplate = setNotifySender;
    } else if (activeTextarea === "notRecipient") {
      textarea = notRecipientRef.current;
      template = notifyRecipient;
      setTemplate = setNotifyRecipient;
    } else if (activeTextarea === "chatSender") {
      textarea = chatSenderRef.current;
      template = chatSender;
      setTemplate = setChatSender;
    } else {
      textarea = chatRecipientRef.current;
      template = chatRecipient;
      setTemplate = setChatRecipient;
    }

    if (!textarea) return;

    const start = textarea.selectionStart ?? textarea.value.length;
    const end = textarea.selectionEnd ?? textarea.value.length;
    const next = `${template.slice(0, start)}${variableName}${template.slice(end)}`;
    setTemplate(next);
    queueMicrotask(() => {
      textarea?.focus();
      const pos = start + variableName.length;
      textarea?.setSelectionRange(pos, pos);
    });
  };

  return (
    <form action={action} className="space-y-6">
      <div className="rounded-2xl border border-indigo-200 bg-gradient-to-br from-indigo-50/60 to-purple-50/40 p-4 sm:p-6 space-y-6 shadow-sm">
        <div className="flex items-center gap-3 border-b border-indigo-100 pb-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 text-white font-black text-lg">
            ⇄
          </div>
          <div>
            <h3 className="text-base font-bold text-indigo-900">
              إعدادات أزرار ونماذج الطلبات ذات الوجهتين (ذو وجهتين)
            </h3>
            <p className="text-xs text-indigo-700">
              خصص قوالب ونماذج الرسائل التلقائية للمرسل (الوجهة الأولى) والمستلم (الوجهة الثانية). تظهر هذه الأزرار والنماذج للمندوب وللإدارة.
            </p>
          </div>
        </div>

        {/* المتغيرات الجاهزة */}
        <div className="space-y-2">
          <p className="text-xs font-bold text-slate-700">المتغيرات المتاحة للإدراج داخل أي نص:</p>
          <div className="flex flex-wrap gap-1.5">
            {TWO_WAY_TEMPLATE_VARIABLES.map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => insertVariable(v)}
                className="rounded-lg border border-indigo-200 bg-white px-2.5 py-1 text-xs font-bold text-indigo-700 hover:bg-indigo-50 transition shadow-xs"
              >
                {v}
              </button>
            ))}
          </div>
        </div>

        {/* 1. قوالب طلب اللوكيشن */}
        <div className="space-y-4 rounded-xl bg-white p-4 border border-indigo-100 shadow-xs">
          <h4 className="text-sm font-bold text-emerald-800 flex items-center gap-2">
            📍 قوالب طلب اللوكيشن (الموقع)
          </h4>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* طلب لوكيشن للمرسل */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-800">
                طلب لوكيشن للمرسل (الوجهة الأولى / المرسل الأول والثاني)
              </label>
              <textarea
                ref={locSenderRef}
                name="locationSenderTemplate"
                value={locationSender}
                onFocus={() => setActiveTextarea("locSender")}
                onChange={(e) => setLocationSender(e.target.value)}
                rows={4}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-800 outline-none focus:border-emerald-500 focus:bg-white focus:ring-2 focus:ring-emerald-200"
              />
              <button
                type="button"
                onClick={() => {
                  setLocationSender(getDefaultTwoWayLocationSenderTemplate());
                  locSenderRef.current?.focus();
                }}
                className="text-[11px] font-bold text-slate-500 hover:text-emerald-600 underline"
              >
                استرجاع الافتراضي للمرسل
              </button>
            </div>

            {/* طلب لوكيشن للمستلم */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-800">
                طلب لوكيشن للمستلم (الوجهة الثانية / المستلم الأول والثاني)
              </label>
              <textarea
                ref={locRecipientRef}
                name="locationRecipientTemplate"
                value={locationRecipient}
                onFocus={() => setActiveTextarea("locRecipient")}
                onChange={(e) => setLocationRecipient(e.target.value)}
                rows={4}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-800 outline-none focus:border-emerald-500 focus:bg-white focus:ring-2 focus:ring-emerald-200"
              />
              <button
                type="button"
                onClick={() => {
                  setLocationRecipient(getDefaultTwoWayLocationRecipientTemplate());
                  locRecipientRef.current?.focus();
                }}
                className="text-[11px] font-bold text-slate-500 hover:text-emerald-600 underline"
              >
                استرجاع الافتراضي للمستلم
              </button>
            </div>
          </div>
        </div>

        {/* 2. قوالب تبليغ الطرفين */}
        <div className="space-y-4 rounded-xl bg-white p-4 border border-indigo-100 shadow-xs">
          <h4 className="text-sm font-bold text-blue-800 flex items-center gap-2">
            🔔 قوالب التبليغ والإشعارات للطرفين
          </h4>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* تبليغ للمرسل */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-800">
                تبليغ المرسل (الوجهة الأولى)
              </label>
              <textarea
                ref={notSenderRef}
                name="notifySenderTemplate"
                value={notifySender}
                onFocus={() => setActiveTextarea("notSender")}
                onChange={(e) => setNotifySender(e.target.value)}
                rows={4}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-800 outline-none focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-200"
              />
              <button
                type="button"
                onClick={() => {
                  setNotifySender(getDefaultTwoWayNotifySenderTemplate());
                  notSenderRef.current?.focus();
                }}
                className="text-[11px] font-bold text-slate-500 hover:text-blue-600 underline"
              >
                استرجاع الافتراضي لتبليغ المرسل
              </button>
            </div>

            {/* تبليغ للمستلم */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-800">
                تبليغ المستلم (الوجهة الثانية)
              </label>
              <textarea
                ref={notRecipientRef}
                name="notifyRecipientTemplate"
                value={notifyRecipient}
                onFocus={() => setActiveTextarea("notRecipient")}
                onChange={(e) => setNotifyRecipient(e.target.value)}
                rows={4}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-800 outline-none focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-200"
              />
              <button
                type="button"
                onClick={() => {
                  setNotifyRecipient(getDefaultTwoWayNotifyRecipientTemplate());
                  notRecipientRef.current?.focus();
                }}
                className="text-[11px] font-bold text-slate-500 hover:text-blue-600 underline"
              >
                استرجاع الافتراضي لتبليغ المستلم
              </button>
            </div>
          </div>
        </div>

        {/* 3. قوالب المراسلة العامة */}
        <div className="space-y-4 rounded-xl bg-white p-4 border border-indigo-100 shadow-xs">
          <h4 className="text-sm font-bold text-purple-800 flex items-center gap-2">
            💬 قوالب المراسلة المباشرة العامة
          </h4>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* مراسلة للمرسل */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-800">
                مراسلة الواتساب للمرسل
              </label>
              <textarea
                ref={chatSenderRef}
                name="chatSenderTemplate"
                value={chatSender}
                onFocus={() => setActiveTextarea("chatSender")}
                onChange={(e) => setChatSender(e.target.value)}
                rows={3}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-800 outline-none focus:border-purple-500 focus:bg-white focus:ring-2 focus:ring-purple-200"
              />
              <button
                type="button"
                onClick={() => {
                  setChatSender(getDefaultTwoWayChatSenderTemplate());
                  chatSenderRef.current?.focus();
                }}
                className="text-[11px] font-bold text-slate-500 hover:text-purple-600 underline"
              >
                استرجاع الافتراضي لمراسلة المرسل
              </button>
            </div>

            {/* مراسلة للمستلم */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-800">
                مراسلة الواتساب للمستلم
              </label>
              <textarea
                ref={chatRecipientRef}
                name="chatRecipientTemplate"
                value={chatRecipient}
                onFocus={() => setActiveTextarea("chatRecipient")}
                onChange={(e) => setChatRecipient(e.target.value)}
                rows={3}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-800 outline-none focus:border-purple-500 focus:bg-white focus:ring-2 focus:ring-purple-200"
              />
              <button
                type="button"
                onClick={() => {
                  setChatRecipient(getDefaultTwoWayChatRecipientTemplate());
                  chatRecipientRef.current?.focus();
                }}
                className="text-[11px] font-bold text-slate-500 hover:text-purple-600 underline"
              >
                استرجاع الافتراضي لمراسلة المستلم
              </button>
            </div>
          </div>
        </div>

        {state.error ? (
          <p className="rounded-lg border border-rose-300 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700">
            {state.error}
          </p>
        ) : null}
        {state.ok ? (
          <p className="rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700">
            تم حفظ قوالب الرسائل والأزرار للطلبات ذات الوجهتين بنجاح.
          </p>
        ) : null}

        <div>
          <button
            type="submit"
            disabled={pending}
            className="w-full rounded-xl bg-indigo-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-indigo-700 shadow-md disabled:opacity-60"
          >
            {pending ? "جارٍ حفظ قوالب الوجهتين..." : "حفظ قوالب الطلبات ذات الوجهتين"}
          </button>
        </div>
      </div>
    </form>
  );
}
