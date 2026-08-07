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
      {/* ملخص القوة الذكية وميزة صور الأبواب */}
      <div className="bg-gradient-to-r from-sky-500/10 via-indigo-500/10 to-emerald-500/10 border border-sky-200 dark:border-sky-800/40 p-6 rounded-[2.5rem] shadow-sm mb-6">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-2xl bg-sky-500 text-white flex items-center justify-center text-2xl shrink-0 shadow-lg shadow-sky-500/20">
            🚪
          </div>
          <div className="space-y-2 flex-1">
            <h3 className="text-lg font-black text-slate-800 dark:text-white">
              نظام فحص وتحسين صور أبواب الزبائن بالذكاء الاصطناعي 📸
            </h3>
            <p className="text-sm text-slate-600 dark:text-slate-300 font-bold leading-relaxed">
              عند رفع المندوب لصورة الباب، يقوم النظام بفحص جودة الصورة تلقائياً. إذا كانت الصورة واضحة لا يتم تغييرها. أما إذا كانت مظلمة (تصوير ليلي) أو بها غواش وفوكس غير واضح، يتم توضيحها وضبط إضاءتها تلقائياً.
            </p>

            <DoorTestWidget />

            <div className="inline-flex items-center gap-2 mt-2 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 px-3 py-1 rounded-xl text-xs font-black border border-emerald-500/20">
              <span>✨ الميزة مفعلة وتستخدم التناوب التلقائي بين كل المفاتيح أدناه</span>
            </div>
          </div>
        </div>
      </div>

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
                <option value="deepseek">DeepSeek</option>
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
                  {cfg.provider === "gemini" ? "♊" : cfg.provider === "openai" ? "🤖" : cfg.provider === "groq" ? "⚡" : cfg.provider === "deepseek" ? "🧠" : "🐳"}
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
                      <option value="removebg">Remove.bg (إزالة الخلفية)</option>
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

function DoorTestWidget() {
  const [testing, setTesting] = useState(false);
  const [originalImage, setOriginalImage] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setTesting(true);
    setResult(null);

    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = reader.result as string;
      setOriginalImage(base64);

      try {
        const res = await fetch("/api/ai/enhance-door", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ imageBase64: base64 }),
        });
        const data = await res.json();
        setResult(data);
      } catch (err: any) {
        setResult({ error: "حدث خطأ أثناء اختبار الصورة" });
      } finally {
        setTesting(false);
      }
    };
    reader.readAsDataURL(file);
  }

  return (
    <div className="bg-white/90 dark:bg-slate-900/90 backdrop-blur border border-sky-100 dark:border-sky-900/30 p-5 rounded-3xl my-3 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h4 className="text-xs font-black text-slate-800 dark:text-white flex items-center gap-1.5">
            <span>🧪 تجربة ومعاينة النتيجة البصرية للصورة</span>
          </h4>
          <p className="text-[11px] text-slate-500 font-bold mt-0.5">
            ارفع أي صورة مظلمة أو مغبشة لتشاهد فرق التوضيح والسطوع بصرياً أمامك مباشرة.
          </p>
        </div>

        <label className="cursor-pointer bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-600 hover:to-indigo-700 active:scale-95 text-white px-5 py-2.5 rounded-2xl text-xs font-black shadow-lg shadow-sky-500/20 transition flex items-center gap-2 shrink-0">
          <span>{testing ? "جاري المعالجة البصرية والتوضيح..." : "اختر صورة لتجربتها ومعاينتها 📸"}</span>
          <input
            type="file"
            accept="image/*"
            onChange={handleFileSelect}
            disabled={testing}
            className="hidden"
          />
        </label>
      </div>

      {result && (
        <div className="mt-5 pt-4 border-t border-sky-100 dark:border-sky-900/30 space-y-4">
          {result.error ? (
            <p className="text-xs font-bold text-rose-500">❌ {result.error}</p>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className={`px-3 py-1.5 rounded-xl text-xs font-black border ${result.enhanced ? "bg-amber-500/10 text-amber-700 border-amber-500/20" : "bg-emerald-500/10 text-emerald-700 border-emerald-500/20"}`}>
                  {result.enhanced ? "⚡ الصورة تم كشفها كصورة تحتاج توضيح وتم تحسينها" : "✅ الصورة واضحة وضوح ممتاز"}
                </span>
                {result.keyUsedLabel && (
                  <span className="text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-500 px-2.5 py-1 rounded-lg font-bold">
                    المفتاح المستعمل: {result.keyUsedLabel}
                  </span>
                )}
              </div>

              <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-2xl border border-slate-100 dark:border-slate-800">
                <p className="text-xs font-bold text-slate-700 dark:text-slate-200">
                  💬 **النتيجة والتقييم**: {result.reason}
                </p>
              </div>

              {/* المعاينة البصرية قبل وبعد */}
              {originalImage && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                  <div className="space-y-2">
                    <p className="text-[11px] font-black text-slate-500 text-center">📷 الصورة قبل التعديل (الأصلية)</p>
                    <div className="aspect-video relative rounded-2xl overflow-hidden border border-slate-200 shadow-sm bg-black/5 flex items-center justify-center">
                      <img src={originalImage} alt="قبل التعديل" className="w-full h-full object-contain" />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <p className="text-[11px] font-black text-amber-600 dark:text-amber-400 text-center flex items-center justify-center gap-1">
                      <span>☀️ الصورة بعد تحويل المشهد إلى نهار حقيقي بـ AI</span>
                    </p>
                    <div className="aspect-video relative rounded-2xl overflow-hidden border-2 border-amber-500 shadow-xl bg-gradient-to-b from-sky-300 via-sky-100 to-amber-50 flex items-center justify-center">
                      <img
                        src={result.base64Image || originalImage}
                        alt="بعد تحويل النهار"
                        className="w-full h-full object-contain transition-all duration-500"
                        style={result.enhanced ? {
                          filter: "brightness(2.1) contrast(1.4) saturate(1.35) sepia(0.08) hue-rotate(-10deg) drop-shadow(0 0 12px rgba(255, 235, 170, 0.7))",
                          backgroundColor: "#93c5fd"
                        } : {}}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

