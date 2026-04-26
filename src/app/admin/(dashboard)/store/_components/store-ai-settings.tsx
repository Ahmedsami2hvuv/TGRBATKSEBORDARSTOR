"use client";

import { useState, useEffect } from "react";

export function StoreAiSettings() {
  const [keys, setKeys] = useState<{ id: string; apiKey: string; usedToday: number }[]>([]);
  const [isLoadingKeys, setIsLoadingKeys] = useState(false);
  const [testImage, setTestImage] = useState<string | null>(null);
  const [isTesting, setIsTesting] = useState(false);
  const [newKeyInput, setNewKeyInput] = useState("");
  const [isKeysVisible, setIsKeysVisible] = useState(false);

  useEffect(() => {
    refreshData();
  }, []);

  async function refreshData() {
    setIsLoadingKeys(true);
    try {
      const keysRes = await fetch("/api/admin/store/settings/ai-keys/list");
      const keysData = await keysRes.json();
      if (Array.isArray(keysData)) setKeys(keysData);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoadingKeys(false);
    }
  }

  async function addKey() {
    if (!newKeyInput) return;
    try {
      const res = await fetch("/api/admin/store/settings/ai-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: "removebg", apiKey: newKeyInput }),
      });
      if (res.ok) {
        setNewKeyInput("");
        await refreshData();
      }
    } catch (e) {
      alert("فشل إضافة المفتاح");
    }
  }

  async function deleteKey(id: string) {
    if (!window.confirm("هل تريد حذف هذا المفتاح؟")) return;
    try {
      const res = await fetch("/api/admin/store/settings/ai-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete", id }),
      });
      if (res.ok) {
        await refreshData();
      }
    } catch (e) {
      alert("فشل الحذف");
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="bg-white dark:bg-slate-900 p-6 rounded-[2rem] border border-slate-100 dark:border-slate-800 shadow-xl shadow-slate-200/40 flex flex-wrap items-center gap-6">
        <div className="flex-1">
          <h3 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
            <span>✨</span> الذكاء الاصطناعي ومسح الخلفية
          </h3>
          <p className="text-xs text-slate-500 font-bold mt-1">إدارة مفاتيح الـ API لإزالة خلفيات المنتجات تلقائياً وجعلها بيضاء</p>
        </div>

        <div className="flex items-center gap-6">
          <div className="flex flex-col gap-3 min-w-[350px] bg-slate-50 dark:bg-slate-800/30 p-4 rounded-[2rem] border border-dashed border-slate-200 dark:border-slate-700">
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between px-1">
                <p className="text-[10px] font-black text-slate-400 uppercase">مفاتيح الـ API (Remove.bg)</p>
                {keys.length > 0 && (
                  <button
                    onClick={() => setIsKeysVisible(!isKeysVisible)}
                    className="text-[10px] font-black text-indigo-600 hover:underline"
                  >
                    {isKeysVisible ? "إخفاء القائمة ▲" : `عرض القائمة (${keys.length}) ▼`}
                  </button>
                )}
              </div>
              <div className="flex gap-2">
                <input
                  value={newKeyInput}
                  onChange={(e) => setNewKeyInput(e.target.value)}
                  placeholder="ضع المفتاح هنا..."
                  className="flex-1 px-4 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                />
                <button
                  onClick={addKey}
                  disabled={!newKeyInput}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-xl font-black text-xs hover:bg-indigo-700 disabled:opacity-50 transition-all shadow-md shadow-indigo-100"
                >
                  إضافة
                </button>
              </div>
            </div>

            {keys.length > 0 && isKeysVisible && (
              <div className="flex flex-col gap-2 mt-2 pt-2 border-t border-slate-100 dark:border-slate-800 animate-in slide-in-from-top-2 duration-300">
                <div className="grid grid-cols-2 gap-2">
                  {keys.map((k, idx) => (
                    <div key={k.id} className="flex items-center justify-between p-2 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl shadow-sm group">
                      <div className="flex flex-col">
                        <span className="text-[9px] font-black text-slate-400">Key {idx + 1}</span>
                        <span className={`text-[10px] font-bold ${k.usedToday >= 50 ? 'text-rose-500' : 'text-emerald-600'}`}>
                          {k.usedToday}/50
                        </span>
                      </div>
                      <button
                        onClick={() => deleteKey(k.id)}
                        className="w-6 h-6 flex items-center justify-center rounded-lg bg-rose-50 text-rose-400 opacity-0 group-hover:opacity-100 transition-all hover:bg-rose-500 hover:text-white"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
