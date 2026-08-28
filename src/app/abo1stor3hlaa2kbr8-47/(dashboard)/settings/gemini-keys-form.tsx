"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { addGeminiApiKeyAction, deleteGeminiApiKeyAction, toggleGeminiApiKeyActiveAction } from "./actions";

type GeminiKeyItem = {
  id: string;
  key: string;
  label: string | null;
  active: boolean;
  errorCount: number;
  lastUsedAt: Date | null;
};

export function GeminiKeysForm({ initialKeys }: { initialKeys: GeminiKeyItem[] }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [key, setKey] = useState("");
  const [label, setLabel] = useState("");

  const handleAdd = async () => {
    if (!key.trim()) return;
    setLoading(true);
    try {
      const res = await addGeminiApiKeyAction(key, label);
      if (res.error) {
        alert(res.error);
      } else {
        setKey("");
        setLabel("");
        router.refresh();
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="space-y-3 bg-slate-50 p-4 rounded-2xl border border-slate-200">
        <h3 className="text-xs font-black text-slate-800">إضافة مفتاح Gemini API جديد</h3>
        <p className="text-[11px] text-slate-500 leading-relaxed">
          يمكنك إضافة عدة مفاتيح من حسابات جمناي مختلفة لرفع حد الاستخدام المسموح ولضمان تدوير المفاتيح وعدم توقف الذكاء الاصطناعي للبوت.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-[10px] font-black text-slate-500 mr-1">تسمية المفتاح (اختياري)</label>
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="مثلاً: مفتاح حساب 1"
              className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm font-bold bg-white"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-black text-slate-500 mr-1">مفتاح API Key</label>
            <input
              value={key}
              onChange={(e) => setKey(e.target.value)}
              placeholder="AIzaSy..."
              className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm font-bold bg-white font-mono"
            />
          </div>
        </div>

        <button
          disabled={loading || !key.trim()}
          onClick={handleAdd}
          className="w-full py-2 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition-all text-sm mt-2"
        >
          {loading ? "جاري الإضافة..." : "إضافة المفتاح للمجمّع"}
        </button>
      </div>

      <div className="space-y-2">
        <h3 className="text-xs font-black text-slate-500 px-1">المفاتيح المضافة في المجمّع ({initialKeys.length})</h3>
        {initialKeys.length === 0 ? (
          <p className="text-[10px] text-center text-slate-400 py-4 border border-dashed rounded-2xl">
            لا توجد مفاتيح مضافة حالياً. سيتم التراجع تلقائياً للمفتاح المخزن في البيئة (إن وجد).
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-2">
            {initialKeys.map((item) => (
              <div
                key={item.id}
                className={`flex items-center justify-between gap-3 p-3 rounded-2xl border ${
                  item.active ? "bg-white border-slate-200" : "bg-slate-50 border-slate-100 opacity-60"
                }`}
              >
                <div className="min-w-0">
                  <p className="text-xs font-black text-slate-800 truncate">
                    {item.label || "مفتاح بدون اسم"}
                  </p>
                  <p className="text-[9px] font-mono text-slate-500 truncate mt-0.5">
                    {item.key.substring(0, 8)}...{item.key.substring(item.key.length - 4)}
                  </p>
                  {item.errorCount > 0 && (
                    <span className="text-[8px] font-black text-rose-500 bg-rose-50 px-1.5 py-0.5 rounded mt-1 inline-block">
                      عدد الأخطاء: {item.errorCount}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={async () => {
                      await toggleGeminiApiKeyActiveAction(item.id, !item.active);
                      router.refresh();
                    }}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                      item.active ? "bg-amber-50 text-amber-600 border border-amber-200" : "bg-emerald-50 text-emerald-600 border border-emerald-200"
                    }`}
                  >
                    {item.active ? "تعطيل" : "تفعيل"}
                  </button>
                  <button
                    onClick={async () => {
                      if (!confirm("هل أنت متأكد من حذف هذا المفتاح؟")) return;
                      await deleteGeminiApiKeyAction(item.id);
                      router.refresh();
                    }}
                    className="p-1.5 text-rose-600 bg-rose-50 border border-rose-200 rounded-xl hover:bg-rose-100 transition"
                  >
                    🗑️
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
