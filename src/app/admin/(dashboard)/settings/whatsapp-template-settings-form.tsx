"use client";

import { useActionState, useRef, useState } from "react";
import {
  WHATSAPP_TEMPLATE_VARIABLES,
  getDefaultEmployeeWhatsappShareTemplate,
} from "@/lib/whatsapp-template-settings";
import {
  saveWhatsappTemplateSettings,
  type WhatsappTemplateSettingsState,
} from "./actions";

export function WhatsappTemplateSettingsForm({ initialTemplate }: { initialTemplate: string }) {
  const [state, action, pending] = useActionState(
    saveWhatsappTemplateSettings,
    {} as WhatsappTemplateSettingsState,
  );
  const [template, setTemplate] = useState(initialTemplate);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const insertVariable = (variableName: string) => {
    const textarea = textareaRef.current;
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

  const resetToDefault = () => {
    setTemplate(getDefaultEmployeeWhatsappShareTemplate());
    textareaRef.current?.focus();
  };

  return (
    <form action={action} className="space-y-4">
      <div className="space-y-2">
        <p className="text-sm font-bold text-slate-800">نص رسالة زر إرسال الرابط للواتساب</p>
        <p className="text-xs text-slate-500">
          اكتب الرسالة بالطريقة التي تريدها، ثم اضغط على أي متغير لإضافته داخل النص.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {WHATSAPP_TEMPLATE_VARIABLES.map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => insertVariable(v)}
            className="rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700 hover:bg-emerald-100"
          >
            {v}
          </button>
        ))}
      </div>

      <textarea
        ref={textareaRef}
        name="employeeShareTemplate"
        value={template}
        onChange={(e) => setTemplate(e.target.value)}
        rows={8}
        className="w-full rounded-xl border border-emerald-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200"
      />

      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
        المتغيرات: {`{customerName}`} اسم العميل، {`{shopName}`} اسم المحل، {`{customerLink}`} رابط العميل،
        {` {shopLocation} `} رابط موقع المحل.
      </div>

      {state.error ? (
        <p className="rounded-lg border border-rose-300 bg-rose-50 px-3 py-2 text-sm font-bold text-rose-700">
          {state.error}
        </p>
      ) : null}
      {state.ok ? (
        <p className="rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm font-bold text-emerald-700">
          تم حفظ قالب رسالة واتساب.
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-emerald-700 disabled:opacity-60"
        >
          {pending ? "جارٍ الحفظ..." : "حفظ الرسالة"}
        </button>
        <button
          type="button"
          onClick={resetToDefault}
          className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50"
        >
          استرجاع الرسالة الافتراضية
        </button>
      </div>
    </form>
  );
}
