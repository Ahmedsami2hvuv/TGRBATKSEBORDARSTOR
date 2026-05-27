"use client";

import { useState, useEffect } from "react";
import { DynamicIcon } from "@/components/dynamic-icon";
import { GlobalIconsConfig } from "@/lib/icon-settings";

interface CustomLink {
  id: string;
  name: string;
  url: string;
}

interface CustomCategory {
  id: string;
  name: string;
  color: string;
  icon: string;
  links: CustomLink[];
}

const COLORS = ["#3b82f6", "#f59e0b", "#10b981", "#ef4444", "#8b5cf6", "#06b6d4", "#f97316", "#64748b"];

export function FloatingMenuSettings({ icons }: { icons: GlobalIconsConfig }) {
  const [categories, setCategories] = useState<CustomCategory[]>([]);
  const [isLocked, setIsLocked] = useState(false);
  const [menuScale, setMenuScale] = useState(1);
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/abo1stor3hlaa2kbr8-47/settings/floating-menu")
      .then(res => res.json())
      .then(data => {
        if (data.categories) setCategories(data.categories);
        if (data.isLocked !== undefined) setIsLocked(data.isLocked);
        if (data.menuScale !== undefined) setMenuScale(data.menuScale);
      })
      .catch(err => console.error("Failed to fetch menu settings", err))
      .finally(() => {
        setMounted(true);
        setLoading(false);
      });
  }, []);

  // Auto-save logic
  useEffect(() => {
    if (!mounted || loading) return;

    const timeout = setTimeout(async () => {
      try {
        await fetch("/api/abo1stor3hlaa2kbr8-47/settings/floating-menu", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ categories, isLocked, menuScale })
        });

        // Update local storage for immediate feedback in the floating menu component
        localStorage.setItem("kse_admin_floating_data", JSON.stringify(categories));
        localStorage.setItem("kse_admin_floating_locked", isLocked.toString());
        localStorage.setItem("kse_admin_floating_scale", menuScale.toString());
        window.dispatchEvent(new Event("storage"));
      } catch (e) {
        console.error("Auto-save failed", e);
      }
    }, 1000);

    return () => clearTimeout(timeout);
  }, [categories, isLocked, menuScale, mounted, loading]);

  const addCategory = () => {
    const newCat: CustomCategory = {
      id: Date.now().toString(),
      name: "قسم جديد",
      icon: "⭐",
      color: COLORS[categories.length % COLORS.length],
      links: []
    };
    setCategories([...categories, newCat]);
  };

  const deleteCategory = (id: string) => {
    if (confirm("هل أنت متأكد من حذف هذا القسم بجميع روابطه؟")) {
      setCategories(categories.filter(c => c.id !== id));
    }
  };

  const addLink = (catId: string) => {
    setCategories(prev => prev.map(c =>
      c.id === catId ? { ...c, links: [...c.links, { id: Date.now().toString(), name: "رابط جديد", url: "https://" }] } : c
    ));
  };

  const deleteLink = (catId: string, linkId: string) => {
    setCategories(prev => prev.map(c =>
      c.id === catId ? { ...c, links: c.links.filter(l => l.id !== linkId) } : c
    ));
  };

  const updateCategory = (id: string, updates: Partial<CustomCategory>) => {
    setCategories(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c));
  };

  if (!mounted) return null;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3">
        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200">
           <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={isLocked}
                onChange={e => setIsLocked(e.target.checked)}
                className="w-5 h-5 rounded border-slate-300 text-indigo-600"
              />
              <span className="text-sm font-black text-slate-800">قفل موضع القائمة</span>
           </label>
           <p className="text-[10px] text-slate-500 mt-1">يمنع سحب القائمة وتغيير مكانها بالخطأ.</p>
        </div>
        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200">
           <label className="block text-sm font-black text-slate-800 mb-2">حجم القائمة ({menuScale}x)</label>
           <input
              type="range" min="0.5" max="1.5" step="0.1"
              value={menuScale}
              onChange={e => setMenuScale(parseFloat(e.target.value))}
              className="w-full"
           />
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-black text-slate-800 flex items-center gap-2">
            الأقسام والروابط
            {!loading && <span className="text-[10px] text-emerald-500 font-bold bg-emerald-50 px-2 py-0.5 rounded-full animate-pulse">● مزامنة تلقائية</span>}
          </h3>
          <button
            onClick={addCategory}
            className="px-3 py-1.5 bg-indigo-600 text-white text-xs font-bold rounded-xl hover:bg-indigo-700 transition"
          >
            + إضافة قسم
          </button>
        </div>

        <div className="grid grid-cols-1 gap-4">
          {categories.map((cat, idx) => (
            <div key={cat.id} className="border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-sm">
              <div className="flex items-center justify-between p-3 bg-slate-50 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <div
                    className="w-4 h-4 rounded-full border border-black/10"
                    style={{ backgroundColor: cat.color }}
                    onClick={() => {
                        const nextColor = COLORS[(COLORS.indexOf(cat.color) + 1) % COLORS.length];
                        updateCategory(cat.id, { color: nextColor });
                    }}
                  />
                  <input
                    value={cat.name}
                    onChange={e => updateCategory(cat.id, { name: e.target.value })}
                    className="bg-transparent border-none p-0 text-sm font-black text-slate-800 focus:ring-0 w-32"
                  />
                  <input
                    value={cat.icon}
                    onChange={e => {
                        const val = e.target.value;
                        const folderEmojis = ["📂", "📁", "🗂️", "💼", "🗄️"];
                        if (!folderEmojis.includes(val.trim())) {
                            updateCategory(cat.id, { icon: val });
                        }
                    }}
                    placeholder="Emoji"
                    className="bg-transparent border-none p-0 text-center text-sm focus:ring-0 w-10"
                  />
                </div>
                <button onClick={() => deleteCategory(cat.id)} className="text-rose-500 p-1 hover:bg-rose-50 rounded-lg transition">
                  <DynamicIcon iconKey="ui_trash" config={icons} className="w-4 h-4" fallback={<span>🗑️</span>} />
                </button>
              </div>

              <div className="p-3 space-y-2">
                {cat.links.map(link => (
                  <div key={link.id} className="flex items-center gap-2 group">
                    <input
                      value={link.name}
                      onChange={e => {
                        setCategories(prev => prev.map(c => c.id === cat.id ? {
                           ...c, links: c.links.map(l => l.id === link.id ? { ...l, name: e.target.value } : l)
                        } : c));
                      }}
                      className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-xs font-bold focus:border-indigo-400 outline-none"
                    />
                    <input
                      value={link.url}
                      onChange={e => {
                        setCategories(prev => prev.map(c => c.id === cat.id ? {
                           ...c, links: c.links.map(l => l.id === link.id ? { ...l, url: e.target.value } : l)
                        } : c));
                      }}
                      className="flex-[2] bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-xs text-slate-500 focus:border-indigo-400 outline-none"
                    />
                    <button onClick={() => deleteLink(cat.id, link.id)} className="text-slate-400 hover:text-rose-500 transition">
                      <DynamicIcon iconKey="ui_close" config={icons} className="w-3 h-3" fallback={<span>×</span>} />
                    </button>
                  </div>
                ))}
                <button
                  onClick={() => addLink(cat.id)}
                  className="w-full py-1.5 border border-dashed border-slate-300 rounded-lg text-[10px] font-black text-slate-500 hover:bg-slate-50 transition"
                >
                  + إضافة رابط لـ {cat.name}
                </button>
              </div>
            </div>
          ))}
          {categories.length === 0 && (
            <div className="text-center py-8 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200">
               <p className="text-sm text-slate-400 font-bold">لا يوجد أقسام مضافة بعد.</p>
            </div>
          )}
        </div>
      </div>

      {loading && (
        <div className="text-center py-4">
          <p className="text-xs text-slate-500 font-bold animate-bounce">جاري جلب البيانات من السحابة...</p>
        </div>
      )}
    </div>
  );
}
