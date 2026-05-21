"use client";

import { useActionState, useRef, useState } from "react";
import {
  WHATSAPP_TEMPLATE_VARIABLES,
  getDefaultEmployeeWhatsappShareTemplate,
  getDefaultCustomerOrderTemplate,
} from "@/lib/whatsapp-template-settings";
import { getDefaultTelegramNewOrderTemplate } from "@/lib/telegram-notify";
import {
  saveWhatsappTemplateSettings,
  type WhatsappTemplateSettingsState,
} from "./actions";

export function WhatsappTemplateSettingsForm({
  initialEmployeeTemplate,
  initialCustomerTemplate,
  initialTelegramTemplate,
}: {
  initialEmployeeTemplate: string;
  initialCustomerTemplate: string;
  initialTelegramTemplate: string;
}) {
  const [state, action, pending] = useActionState(
    saveWhatsappTemplateSettings,
    {} as WhatsappTemplateSettingsState,
  );
  const [employeeTemplate, setEmployeeTemplate] = useState(initialEmployeeTemplate);
  const [customerTemplate, setCustomerTemplate] = useState(initialCustomerTemplate);
  const [telegramTemplate, setTelegramTemplate] = useState(initialTelegramTemplate);

  const [activeTextarea, setActiveTextarea] = useState<"employee" | "customer" | "telegram">("employee");

  const employeeRef = useRef<HTMLTextAreaElement | null>(null);
  const customerRef = useRef<HTMLTextAreaElement | null>(null);
  const telegramRef = useRef<HTMLTextAreaElement | null>(null);

  const insertVariable = (variableName: string) => {
    let textarea;
    let template;
    let setTemplate;

    if (activeTextarea === "employee") {
      textarea = employeeRef.current;
      template = employeeTemplate;
      setTemplate = setEmployeeTemplate;
    } else if (activeTextarea === "customer") {
      textarea = customerRef.current;
      template = customerTemplate;
      setTemplate = setCustomerTemplate;
    } else {
      textarea = telegramRef.current;
      template = telegramTemplate;
      setTemplate = setTelegramTemplate;
    }

    if (!textarea) return;

    const start = textarea.selectionStart ?? textarea.value.length;
    const end = textarea.selectionEnd ?? textarea.value.length;
    const next = `${template.slice(0, start)}${variableName}${template.slice(end)}`;
    setTemplate(next);
    queueMicrotask(() => {
      textarea.focus();
      const pos = start + variableName.length;
      textarea.setSelectionRange(pos, pos);
    });
  };

  const resetEmployee = () => {
    setEmployeeTemplate(getDefaultEmployeeWhatsappShareTemplate());
    employeeRef.current?.focus();
  };

  const resetCustomer = () => {
    setCustomerTemplate(getDefaultCustomerOrderTemplate());
    customerRef.current?.focus();
  };

  const resetTelegram = () => {
    setTelegramTemplate(getDefaultTelegramNewOrderTemplate());
    telegramRef.current?.focus();
  };

  return (
    <form action={action} className="space-y-6">
      <div className="space-y-4">
        <div className="space-y-2">
          <p className="text-sm font-bold text-slate-800">نص رسالة زر إرسال الرابط للواتساب (للموظف)</p>
          <p className="text-xs text-slate-500">
            اكتب الرسالة بالطريقة التي تريدها، ثم اضغط على أي متغير لإضافته داخل النص.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {WHATSAPP_TEMPLATE_VARIABLES.filter(v => !['{orderItems}', '{regionName}', '{orderNumber}'].includes(v)).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => {
                setActiveTextarea("employee");
                insertVariable(v);
              }}
              className="rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[10px] font-bold text-emerald-700 hover:bg-emerald-100"
            >
              {v}
            </button>
          ))}
        </div>

        <textarea
          ref={employeeRef}
          name="employeeShareTemplate"
          value={employeeTemplate}
          onFocus={() => setActiveTextarea("employee")}
          onChange={(e) => setEmployeeTemplate(e.target.value)}
          rows={5}
          className="w-full rounded-xl border border-emerald-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200"
        />

        <div className="flex justify-end">
           <button
            type="button"
            onClick={resetEmployee}
            className="text-xs font-bold text-slate-500 hover:text-emerald-600 underline"
          >
            استرجاع الرسالة الافتراضية للموظف
          </button>
        </div>
      </div>

      <hr className="border-emerald-100" />

      <div className="space-y-4">
        <div className="space-y-2">
          <p className="text-sm font-bold text-slate-800">نص رسالة ملخص الطلب (للزبون)</p>
          <p className="text-xs text-slate-500">
             هذه الرسالة تظهر للزبون بعد إتمام الطلب ليقوم بإرسالها عبر الواتساب.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {WHATSAPP_TEMPLATE_VARIABLES.map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => {
                setActiveTextarea("customer");
                insertVariable(v);
              }}
              className="rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1 text-[10px] font-bold text-blue-700 hover:bg-blue-100"
            >
              {v}
            </button>
          ))}
        </div>

        <textarea
          ref={customerRef}
          name="customerOrderTemplate"
          value={customerTemplate}
          onFocus={() => setActiveTextarea("customer")}
          onChange={(e) => setCustomerTemplate(e.target.value)}
          rows={6}
          className="w-full rounded-xl border border-blue-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
        />

        <div className="flex justify-end">
           <button
            type="button"
            onClick={resetCustomer}
            className="text-xs font-bold text-slate-500 hover:text-blue-600 underline"
          >
            استرجاع الرسالة الافتراضية للزبون
          </button>
        </div>
      </div>

      <hr className="border-blue-100" />

      <div className="space-y-4">
        <div className="space-y-2">
          <p className="text-sm font-bold text-slate-800">نص رسالة إشعارات تليجرام (للإدارة والمجهز)</p>
          <p className="text-xs text-slate-500">
             تحكم في شكل الرسالة التي تصل لمجموعات تليجرام عند وصول طلب جديد.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {["{shopName}", "{customerName}", "{regionName}", "{orderType}", "{subtotal}", "{delivery}", "{total}", "{noteTime}", "{orderNumber}", "{customerPhone}", "{vehicleEmoji}"].map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => {
                setActiveTextarea("telegram");
                insertVariable(v);
              }}
              className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-[10px] font-bold text-slate-700 hover:bg-slate-100"
            >
              {v}
            </button>
          ))}
        </div>

        <textarea
          ref={telegramRef}
          name="telegramNewOrderTemplate"
          value={telegramTemplate}
          onFocus={() => setActiveTextarea("telegram")}
          onChange={(e) => setTelegramTemplate(e.target.value)}
          rows={6}
          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
        />

        <div className="flex justify-end">
           <button
            type="button"
            onClick={resetTelegram}
            className="text-xs font-bold text-slate-500 hover:text-slate-600 underline"
          >
            استرجاع الرسالة الافتراضية لتليجرام
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-[10px] text-slate-600 space-y-1">
        <p><strong>شرح المتغيرات:</strong></p>
        <p>{`{customerName}`} اسم العميل، {`{shopName}`} اسم المحل، {`{customerLink}`} رابط العميل، {`{shopLocation}`} موقع المحل.</p>
        <p>{`{orderItems}`} قائمة الأصناف، {`{regionName}`} اسم المنطقة، {`{orderNumber}`} رقم الطلب.</p>
      </div>

      {state.error ? (
        <p className="rounded-lg border border-rose-300 bg-rose-50 px-3 py-2 text-sm font-bold text-rose-700">
          {state.error}
        </p>
      ) : null}
      {state.ok ? (
        <p className="rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm font-bold text-emerald-700">
          تم حفظ قوالب رسائل واتساب بنجاح.
        </p>
      ) : null}

      <div>
        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-emerald-700 disabled:opacity-60"
        >
          {pending ? "جارٍ الحفظ..." : "حفظ القوالب"}
        </button>
      </div>
    </form>
  );
}
