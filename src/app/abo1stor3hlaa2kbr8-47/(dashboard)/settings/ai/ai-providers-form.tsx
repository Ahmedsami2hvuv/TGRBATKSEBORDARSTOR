"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  addAiAgentProviderAction,
  deleteAiAgentProviderAction,
  toggleAiAgentProviderAction,
} from "../actions";

type Provider = "gemini" | "openai" | "deepseek" | "groq";

type ProviderKey = {
  id: string;
  provider: Provider;
  label: string;
  maskedKey: string;
  isActive: boolean;
};

const PROVIDER_LABELS: Record<Provider, string> = {
  gemini: "Gemini",
  openai: "OpenAI",
  deepseek: "DeepSeek",
  groq: "Groq",
};

export function AiProvidersForm({ initialProviders }: { initialProviders: ProviderKey[] }) {
  const router = useRouter();
  const [provider, setProvider] = useState<Provider>("openai");
  const [apiKey, setApiKey] = useState("");
  const [label, setLabel] = useState("");
  const [busy, setBusy] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const addProvider = async () => {
    if (!apiKey.trim() || busy) return;
    setBusy(true);
    try {
      const result = await addAiAgentProviderAction(provider, apiKey, label);
      if (result.error) {
        alert(result.error);
        return;
      }
      setApiKey("");
      setLabel("");
      router.refresh();
    } finally {
      setBusy(false);
    }
  };

  const toggleProvider = async (item: ProviderKey) => {
    setBusyId(item.id);
    try {
      const result = await toggleAiAgentProviderAction(item.id, !item.isActive);
      if (result.error) alert(result.error);
      else router.refresh();
    } finally {
      setBusyId(null);
    }
  };

  const deleteProvider = async (item: ProviderKey) => {
    if (!confirm(`تحذف مفتاح ${PROVIDER_LABELS[item.provider]}؟`)) return;
    setBusyId(item.id);
    try {
      const result = await deleteAiAgentProviderAction(item.id);
      if (result.error) alert(result.error);
      else router.refresh();
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-indigo-200 bg-indigo-50 p-4 text-xs leading-6 text-indigo-950">
        أضف مفتاح مزود ذكاء آخر إذا كانت إجابات Gemini لا تناسبك. الوكيل يجرب المفاتيح الفعالة،
        وإذا تعذر أحدها ينتقل إلى مزود آخر. تُحفظ المفاتيح في الخادم ولا تظهر كاملة في هذه الصفحة.
        عند السؤال، تُرسل للمزود الحقول والسجلات اللازمة للإجابة فقط، وليس نسخة كاملة من قاعدة البيانات.
      </div>

      <div className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:grid-cols-2">
        <label className="space-y-1 text-xs font-bold text-slate-600">
          مزود الذكاء
          <select
            value={provider}
            onChange={(event) => setProvider(event.target.value as Provider)}
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
          >
            {Object.entries(PROVIDER_LABELS).map(([value, name]) => (
              <option key={value} value={value}>{name}</option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-xs font-bold text-slate-600">
          اسم المفتاح (اختياري)
          <input
            value={label}
            onChange={(event) => setLabel(event.target.value)}
            maxLength={80}
            placeholder={`مفتاح ${PROVIDER_LABELS[provider]}`}
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
          />
        </label>
        <label className="space-y-1 text-xs font-bold text-slate-600 sm:col-span-2">
          مفتاح واجهة البرمجة
          <input
            value={apiKey}
            onChange={(event) => setApiKey(event.target.value)}
            autoComplete="off"
            type="password"
            placeholder="الصق مفتاح المزود هنا"
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
          />
        </label>
        <button
          type="button"
          onClick={addProvider}
          disabled={busy || !apiKey.trim()}
          className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-bold text-white hover:bg-indigo-700 disabled:opacity-50 sm:col-span-2"
        >
          {busy ? "جاري الحفظ..." : "إضافة المفتاح وتشغيله"}
        </button>
      </div>

      <div className="space-y-2">
        <h3 className="px-1 text-xs font-black text-slate-600">
          المفاتيح المضافة ({initialProviders.length})
        </h3>
        {initialProviders.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-slate-300 py-5 text-center text-xs text-slate-400">
            ماكو مفاتيح مزودات إضافية. تقدر تستمر باستخدام مفاتيح Gemini الموجودة بالأسفل.
          </p>
        ) : (
          initialProviders.map((item) => (
            <div
              key={item.id}
              className={`flex items-center justify-between gap-3 rounded-xl border p-3 ${
                item.isActive ? "border-slate-200 bg-white" : "border-slate-100 bg-slate-50 opacity-60"
              }`}
            >
              <div className="min-w-0">
                <p className="truncate text-xs font-black text-slate-800">
                  {item.label || PROVIDER_LABELS[item.provider]} · {PROVIDER_LABELS[item.provider]}
                </p>
                <p dir="ltr" className="mt-1 truncate font-mono text-[10px] text-slate-500">
                  {item.maskedKey}
                </p>
              </div>
              <div className="flex shrink-0 gap-2">
                <button
                  type="button"
                  disabled={busyId === item.id}
                  onClick={() => toggleProvider(item)}
                  className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-bold text-slate-700 disabled:opacity-50"
                >
                  {item.isActive ? "إيقاف" : "تشغيل"}
                </button>
                <button
                  type="button"
                  disabled={busyId === item.id}
                  onClick={() => deleteProvider(item)}
                  className="rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-xs font-bold text-rose-700 disabled:opacity-50"
                >
                  حذف
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
