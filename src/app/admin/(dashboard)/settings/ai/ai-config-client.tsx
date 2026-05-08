"use client";

import { useState } from "react";
import {
  addAIConfig,
  clearAllAIPortalTrainings,
  deleteAIConfig,
  deleteAIPortalTraining,
  toggleAIConfig,
  upsertAIPortalTraining,
  updateAIConfig,
  type AIPortalKey,
  type AIPortalTrainingConfig,
} from "./actions";
import { useRouter } from "next/navigation";

type AIConfig = {
  id: string;
  provider: string;
  apiKey: string;
  label: string;
  isActive: boolean;
  usedToday: number;
};

export default function AIConfigClient({
  initialConfigs,
  initialTrainingConfig,
}: {
  initialConfigs: any[];
  initialTrainingConfig: AIPortalTrainingConfig;
}) {
  const [configs, setConfigs] = useState<AIConfig[]>(initialConfigs as AIConfig[]);
  const [loading, setLoading] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [trainingConfig, setTrainingConfig] = useState<AIPortalTrainingConfig>(initialTrainingConfig);
  const [newTrainingByPortal, setNewTrainingByPortal] = useState<Record<AIPortalKey, { title: string; instruction: string }>>({
    admin: { title: "", instruction: "" },
    mandoub: { title: "", instruction: "" },
    preparer: { title: "", instruction: "" },
    store: { title: "", instruction: "" },
  });
  const router = useRouter();

  const portalMeta: { key: AIPortalKey; label: string; helper: string }[] = [
    { key: "mandoub", label: "بوابة المندوب", helper: "أضف أكثر من تدريب حسب حالات المندوب." },
    { key: "admin", label: "بوابة الإدارة", helper: "تدريبات خاصة بمهام الإدارة وفتح الصفحات." },
    { key: "preparer", label: "بوابة المجهز", helper: "تدريبات التجهيز واستلام الطلبات والتحديث." },
    { key: "store", label: "بوابة المتجر", helper: "تدريبات مساعدة العملاء والمنتجات والسلة." },
  ];

  async function handleAdd(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading("add");
    const formData = new FormData(e.currentTarget);
    const res = await addAIConfig(formData);
    if (res.ok) {
      setIsAdding(false);
      router.refresh();
    } else {
      alert(res.error);
    }
    setLoading(null);
  }

  async function handleUpdate(e: React.FormEvent<HTMLFormElement>, id: string) {
    e.preventDefault();
    setLoading(id);
    const formData = new FormData(e.currentTarget);
    const res = await updateAIConfig(id, formData);
    if (res.ok) {
      setEditingId(null);
      router.refresh();
    } else {
      alert(res.error);
    }
    setLoading(null);
  }

  async function handleDelete(id: string) {
    if (!confirm("هل أنت متأكد من حذف هذا المفتاح؟")) return;
    setLoading(id);
    const res = await deleteAIConfig(id);
    if (res.ok) {
      router.refresh();
    }
    setLoading(null);
  }

  async function handleToggle(id: string, currentStatus: boolean) {
    setLoading(id);
    const res = await toggleAIConfig(id, currentStatus);
    if (res.ok) {
      router.refresh();
    }
    setLoading(null);
  }

  async function handleAddTraining(portal: AIPortalKey) {
    const draft = newTrainingByPortal[portal];
    const instruction = draft.instruction.trim();
    if (!instruction) return;
    setLoading(`train:add:${portal}`);
    const item = {
      id: `tr_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      title: draft.title.trim() || "تدريب جديد",
      instruction,
      isActive: true,
    };
    const res = await upsertAIPortalTraining(portal, item);
    if (res.ok) {
      const next = structuredClone(trainingConfig);
      next.byPortal[portal].push(item);
      setTrainingConfig(next);
      setNewTrainingByPortal((prev) => ({
        ...prev,
        [portal]: { title: "", instruction: "" },
      }));
      router.refresh();
    } else {
      alert(res.error);
    }
    setLoading(null);
  }

  async function handleDeleteTraining(portal: AIPortalKey, id: string) {
    if (!confirm("هل تريد حذف هذا التدريب؟")) return;
    setLoading(`train:del:${id}`);
    const res = await deleteAIPortalTraining(portal, id);
    if (res.ok) {
      const next = structuredClone(trainingConfig);
      next.byPortal[portal] = next.byPortal[portal].filter((it) => it.id !== id);
      setTrainingConfig(next);
      router.refresh();
    } else {
      alert(res.error);
    }
    setLoading(null);
  }

  async function handleToggleTraining(portal: AIPortalKey, id: string) {
    const item = trainingConfig.byPortal[portal].find((it) => it.id === id);
    if (!item) return;
    setLoading(`train:toggle:${id}`);
    const res = await upsertAIPortalTraining(portal, { ...item, isActive: !item.isActive });
    if (res.ok) {
      const next = structuredClone(trainingConfig);
      next.byPortal[portal] = next.byPortal[portal].map((it) =>
        it.id === id ? { ...it, isActive: !it.isActive } : it,
      );
      setTrainingConfig(next);
      router.refresh();
    } else {
      alert(res.error);
    }
    setLoading(null);
  }

  async function handleClearAllTrainings() {
    if (!confirm("راح ينمسح كل تدريب بكل البوابات. متأكد؟")) return;
    setLoading("train:clear-all");
    const res = await clearAllAIPortalTrainings();
    if (res.ok) {
      setTrainingConfig({
        version: 1,
        byPortal: { admin: [], mandoub: [], preparer: [], store: [] },
      });
      router.refresh();
    } else {
      alert(res.error);
    }
    setLoading(null);
  }

  return (
    <div className="space-y-6">
      {/* ملخص القوة الذكية */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white dark:bg-[#131418] p-4 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm">
          <p className="text-[10px] font-black text-slate-400">إجمالي المفاتيح</p>
          <p className="text-2xl font-black text-indigo-600">{initialConfigs.length}</p>
        </div>
        <div className="bg-white dark:bg-[#131418] p-4 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm">
          <p className="text-[10px] font-black text-slate-400">المفاتيح النشطة</p>
          <p className="text-2xl font-black text-emerald-600">{initialConfigs.filter(c => c.isActive).length}</p>
        </div>
        <div className="bg-white dark:bg-[#131418] p-4 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm">
          <p className="text-[10px] font-black text-slate-400">استهلاك اليوم الكلي</p>
          <p className="text-2xl font-black text-amber-600">{initialConfigs.reduce((acc, curr) => acc + (curr.usedToday || 0), 0)}</p>
        </div>
        <button
          onClick={() => confirm("هل تريد تصفير عدادات الاستهلاك لجميع المفاتيح؟") && alert("سيتم تصفير العدادات تلقائياً مع تحديث الصفحة")}
          className="bg-slate-800 text-white p-4 rounded-3xl shadow-lg hover:bg-slate-900 transition flex flex-col items-center justify-center group"
        >
          <span className="text-lg group-hover:rotate-180 transition-transform duration-500">🔄</span>
          <span className="text-[10px] font-black mt-1">تصفير العدادات</span>
        </button>
      </div>

      {/* Add New Key Button */}
      <div className="flex justify-between items-center">
        <h2 className="text-sm font-black text-slate-700 dark:text-slate-300">قائمة مفاتيح الـ API المفتوحة</h2>
        <button
          onClick={() => setIsAdding(!isAdding)}
          className="bg-indigo-600 text-white px-6 py-2 rounded-2xl font-black hover:bg-indigo-700 transition shadow-lg shadow-indigo-100"
        >
          {isAdding ? "إلغاء" : "إضافة مفتاح جديد +"}
        </button>
      </div>

      {/* Add Form */}
      {isAdding && (
        <form onSubmit={handleAdd} className="bg-white dark:bg-[#131418] p-6 rounded-[2.5rem] border-2 border-indigo-100 dark:border-indigo-900 shadow-xl animate-in zoom-in-95">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <label className="text-xs font-black text-slate-500 mr-2">المزود</label>
              <select name="provider" className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-2xl px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-indigo-500">
                <option value="removebg">Remove.bg (إزالة الخلفية)</option>
                <option value="gemini">Google Gemini</option>
                <option value="openai">OpenAI (ChatGPT)</option>
                <option value="groq">Groq (Llama 3)</option>
              </select>
            </div>
            <div className="space-y-2 md:col-span-2">
              <label className="text-xs font-black text-slate-500 mr-2">اسم توضيحي (اختياري)</label>
              <input name="label" placeholder="مثلاً: حساب جمناي الأساسي" className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-2xl px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-indigo-500" />
            </div>
            <div className="space-y-2 md:col-span-3">
              <label className="text-xs font-black text-slate-500 mr-2">API Key (المفتاح السري)</label>
              <input name="apiKey" type="password" required placeholder="أدخل المفتاح هنا..." className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-2xl px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-indigo-500" />
            </div>
          </div>
          <button
            type="submit"
            disabled={loading === "add"}
            className="w-full mt-6 bg-emerald-600 text-white py-3 rounded-2xl font-black hover:bg-emerald-700 transition disabled:opacity-50"
          >
            {loading === "add" ? "جاري الحفظ..." : "حفظ المفتاح"}
          </button>
        </form>
      )}

      {/* Keys List */}
      <div className="grid grid-cols-1 gap-4">
        {initialConfigs.map((cfg) => (
          <div key={cfg.id} className="space-y-2">
            <div className={`bg-white dark:bg-[#131418] p-5 rounded-[2rem] border-2 transition shadow-sm flex items-center justify-between ${cfg.isActive ? 'border-slate-100 dark:border-slate-800' : 'border-slate-100 dark:border-slate-800 opacity-60 grayscale'}`}>
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-slate-100 dark:bg-slate-800 rounded-2xl flex items-center justify-center text-2xl">
                  {cfg.provider === "gemini" ? "♊" : cfg.provider === "openai" ? "🤖" : cfg.provider === "groq" ? "⚡" : "🐳"}
                </div>
                <div>
                  <h3 className="font-black text-slate-800 dark:text-white text-sm">{cfg.label || "مفتاح إزالة خلفية"}</h3>
                  <div className="flex flex-wrap items-center gap-2 mt-1">
                    <span className="text-[10px] font-black bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full text-slate-500 uppercase">{cfg.provider}</span>
                    <div className="flex items-center gap-1.5 bg-emerald-50 dark:bg-emerald-900/20 px-2 py-0.5 rounded-full border border-emerald-100 dark:border-emerald-800">
                        <span className="text-[9px] font-black text-emerald-600">الرصيد: {cfg.dailyLimit || 50}</span>
                        <span className="w-px h-2 bg-emerald-200" />
                        <span className="text-[9px] font-black text-amber-600">المستخدم: {cfg.usedToday || 0}</span>
                        <span className="w-px h-2 bg-emerald-200" />
                        <span className="text-[9px] font-black text-indigo-600">المتبقي: {(cfg.dailyLimit || 50) - (cfg.usedToday || 0)}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setEditingId(editingId === cfg.id ? null : cfg.id)}
                  className="bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 p-2 rounded-xl hover:bg-indigo-100 transition"
                  title="تعديل"
                >
                  ✏️
                </button>
                <button
                  onClick={() => handleToggle(cfg.id, cfg.isActive)}
                  disabled={loading === cfg.id}
                  className={`px-4 py-2 rounded-xl text-[10px] font-black transition ${cfg.isActive ? 'bg-amber-100 text-amber-700 hover:bg-amber-200' : 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'}`}
                >
                  {cfg.isActive ? "تعطيل" : "تفعيل"}
                </button>
                <button
                  onClick={() => handleDelete(cfg.id)}
                  disabled={loading === cfg.id}
                  className="bg-rose-50 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 p-2 rounded-xl hover:bg-rose-100 transition"
                >
                  🗑️
                </button>
              </div>
            </div>

            {/* Edit Form */}
            {editingId === cfg.id && (
              <form onSubmit={(e) => handleUpdate(e, cfg.id)} className="bg-slate-50 dark:bg-[#09090b] p-6 rounded-[2rem] border-2 border-indigo-200 dark:border-indigo-900/50 animate-in slide-in-from-top-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-black text-slate-500 mr-2">المزود</label>
                    <select name="provider" defaultValue={cfg.provider} className="w-full bg-white dark:bg-slate-900 border-none rounded-2xl px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-indigo-500">
                      <option value="gemini">Google Gemini</option>
                      <option value="openai">OpenAI (ChatGPT)</option>
                      <option value="groq">Groq (Llama 3)</option>
                      <option value="deepseek">DeepSeek</option>
                    </select>
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <label className="text-xs font-black text-slate-500 mr-2">اسم توضيحي</label>
                    <input name="label" defaultValue={cfg.label} placeholder="مثلاً: حساب جمناي الأساسي" className="w-full bg-white dark:bg-slate-900 border-none rounded-2xl px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-indigo-500" />
                  </div>
                  <div className="space-y-2 md:col-span-3">
                    <label className="text-xs font-black text-slate-500 mr-2">API Key</label>
                    <input name="apiKey" type="password" required defaultValue={cfg.apiKey} placeholder="أدخل المفتاح هنا..." className="w-full bg-white dark:bg-slate-900 border-none rounded-2xl px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-indigo-500" />
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={loading === cfg.id}
                  className="w-full mt-4 bg-indigo-600 text-white py-3 rounded-2xl font-black hover:bg-indigo-700 transition disabled:opacity-50"
                >
                  {loading === cfg.id ? "جاري التحديث..." : "حفظ التعديلات"}
                </button>
              </form>
            )}
          </div>
        ))}

        {initialConfigs.length === 0 && !isAdding && (
          <div className="py-20 text-center bg-slate-50 dark:bg-[#09090b] rounded-[3rem] border-2 border-dashed border-slate-200 dark:border-slate-800">
            <p className="text-slate-400 font-bold">لم تقم بإضافة أي مفاتيح ذكاء صناعي بعد.</p>
          </div>
        )}
      </div>

      <div className="pt-8 border-t border-slate-200 dark:border-slate-800 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-black text-slate-700 dark:text-slate-300">تدريب الذكاء حسب كل بوابة</h2>
            <p className="text-xs text-slate-500 font-bold mt-1">كل بوابة لها تدريباتها الخاصة، والذكاء يعرف موقعه تلقائياً.</p>
          </div>
          <button
            onClick={handleClearAllTrainings}
            disabled={loading === "train:clear-all"}
            className="bg-rose-600 text-white px-4 py-2 rounded-xl text-xs font-black hover:bg-rose-700 disabled:opacity-50"
          >
            حذف كل التدريبات
          </button>
        </div>

        {portalMeta.map((portal) => (
          <div key={portal.key} className="bg-white dark:bg-[#131418] p-5 rounded-[2rem] border border-slate-100 dark:border-slate-800 space-y-3">
            <div>
              <h3 className="font-black text-sm text-slate-800 dark:text-slate-100">{portal.label}</h3>
              <p className="text-[11px] text-slate-500 font-bold mt-1">{portal.helper}</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              <input
                value={newTrainingByPortal[portal.key].title}
                onChange={(e) => setNewTrainingByPortal((prev) => ({ ...prev, [portal.key]: { ...prev[portal.key], title: e.target.value } }))}
                placeholder="عنوان التدريب (اختياري)"
                className="md:col-span-1 bg-slate-50 dark:bg-slate-900 border-none rounded-xl px-3 py-2 text-xs font-bold"
              />
              <input
                value={newTrainingByPortal[portal.key].instruction}
                onChange={(e) => setNewTrainingByPortal((prev) => ({ ...prev, [portal.key]: { ...prev[portal.key], instruction: e.target.value } }))}
                placeholder="نص التدريب/التعليمات لهذه البوابة"
                className="md:col-span-2 bg-slate-50 dark:bg-slate-900 border-none rounded-xl px-3 py-2 text-xs font-bold"
              />
            </div>
            <button
              onClick={() => handleAddTraining(portal.key)}
              disabled={loading === `train:add:${portal.key}` || !newTrainingByPortal[portal.key].instruction.trim()}
              className="bg-indigo-600 text-white px-4 py-2 rounded-xl text-xs font-black hover:bg-indigo-700 disabled:opacity-50"
            >
              إضافة تدريب
            </button>

            <div className="space-y-2">
              {(trainingConfig.byPortal[portal.key] || []).length === 0 && (
                <p className="text-xs text-slate-400 font-bold">لا يوجد تدريبات حالياً.</p>
              )}
              {(trainingConfig.byPortal[portal.key] || []).map((item) => (
                <div key={item.id} className="border border-slate-100 dark:border-slate-800 rounded-xl p-3 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs font-black text-slate-700 dark:text-slate-200 truncate">{item.title || "بدون عنوان"}</p>
                    <p className="text-[11px] text-slate-500 font-bold mt-1">{item.instruction}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => handleToggleTraining(portal.key, item.id)}
                      disabled={loading === `train:toggle:${item.id}`}
                      className={`px-3 py-1.5 rounded-lg text-[10px] font-black ${item.isActive ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"}`}
                    >
                      {item.isActive ? "تعطيل" : "تفعيل"}
                    </button>
                    <button
                      onClick={() => handleDeleteTraining(portal.key, item.id)}
                      disabled={loading === `train:del:${item.id}`}
                      className="px-3 py-1.5 rounded-lg text-[10px] font-black bg-rose-100 text-rose-700"
                    >
                      حذف
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
