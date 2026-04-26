"use client";

import { useState } from "react";
import { addAIConfig, deleteAIConfig, toggleAIConfig, updateAIConfig } from "./actions";
import { useRouter } from "next/navigation";

type AIConfig = {
  id: string;
  provider: string;
  apiKey: string;
  label: string;
  isActive: boolean;
  usedToday: number;
};

export default function AIConfigClient({ initialConfigs }: { initialConfigs: any[] }) {
  const [configs, setConfigs] = useState<AIConfig[]>(initialConfigs as AIConfig[]);
  const [loading, setLoading] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const router = useRouter();

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
    </div>
  );
}
